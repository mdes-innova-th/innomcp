/**
 * routes/api/chatStream.ts — Phase C SSE streaming chat endpoint
 *
 *   POST /api/chat/stream
 *
 * Body: { message: string, sessionId?: string, preferredMode?: "local"|"remote"|"hybrid",
 *         preferredProviderId?: string, responseMode?: "normal"|"thinking", reasoningMode?: "normal"|"thinking",
 *         thinkingMode?: boolean, toolHint?: string, clientMessageId?: string, projectId?: string }
 *
 * Response: text/event-stream where each message is one AgentEvent.
 *
 * The endpoint runs the lightweight Conductor (agents/conductor.ts), wires
 * its emit callback to SSE writes, and closes the stream on `final_answer`
 * or `error`. A heartbeat comment is sent every 15 seconds to keep idle
 * proxies happy.
 *
 * Reference:
 *   docs/brain/AGENT_WORKSTREAM_CONTRACT.md
 *   docs/brain/INNOMCP_BRAIN.md
 */

import { Router, Response } from "express";
import { runConductor } from "../../agents/conductor";
import type { AgentEvent } from "../../agents/events";
import type { AgentRunMode } from "../../agents/parallelDispatch";
import type { ChatMode } from "../../providers/router";
import { optionalAuth, type AuthRequest } from "../../utils/jwt";
import { guestLimiterMiddleware, limitResponseLength, type GuestLimits } from "../../middleware/guestLimiter";
import { createTask, completeTask, appendTaskStep } from "./tasks";

const router = Router();

const HEARTBEAT_MS = 15_000;

function writeEvent(res: Response, ev: AgentEvent): void {
  const line = `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
  // Express types don't always carry .write, but Response is a Writable
  (res as unknown as { write: (chunk: string) => boolean }).write(line);
  // Flush immediately so SSE events are delivered even when Express
  // compression middleware is active, instead of buffering until close.
  if (typeof (res as any).flush === "function") (res as any).flush();
}

function writeComment(res: Response, comment: string): void {
  (res as unknown as { write: (chunk: string) => boolean }).write(`: ${comment}\n\n`);
  if (typeof (res as any).flush === "function") (res as any).flush();
}

function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function createStreamEventLimiter(limits: GuestLimits | undefined, isGuest: boolean) {
  let draftCharsSent = 0;
  const agentSummaryLimit = 180;

  return (ev: AgentEvent): AgentEvent | null => {
    if (!limits) return ev;

    if (ev.type === "final_answer" && typeof ev.finalText === "string") {
      return { ...ev, finalText: limitResponseLength(ev.finalText, limits) };
    }

    if (!isGuest) return ev;

    if (ev.type === "draft_delta" && typeof ev.deltaText === "string") {
      const remaining = limits.maxResponseLength - draftCharsSent;
      if (remaining <= 0) return null;
      const deltaText = clampText(ev.deltaText, remaining);
      draftCharsSent += deltaText.length;
      return { ...ev, deltaText };
    }

    if (ev.type === "agent_delta") {
      return { ...ev, publicSummary: clampText(ev.publicSummary, agentSummaryLimit) };
    }

    if (ev.type === "fallback" && typeof ev.fallbackReason === "string") {
      return { ...ev, fallbackReason: clampText(ev.fallbackReason, agentSummaryLimit) };
    }

    return ev;
  };
}

router.post("/", optionalAuth, guestLimiterMiddleware, async (req: AuthRequest, res: Response) => {
  const body = (req.body || {}) as {
    message?: string;
    messages?: Array<{ sender: string; text: string }>;
    sessionId?: string;
    preferredMode?: ChatMode;
    preferredProviderId?: string;
    responseMode?: AgentRunMode;
    reasoningMode?: AgentRunMode;
    thinkingMode?: boolean;
    toolHint?: string;
    clientMessageId?: string;
    projectId?: string;
  };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history: Array<{ sender: "user" | "ai"; text: string }> = Array.isArray(body.messages)
    ? (body.messages as Array<{ sender: "user" | "ai"; text: string }>).slice(-20)
    : [];
  if (message.length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  // Flush headers immediately so the client opens the stream
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  // Heartbeat to keep proxies from closing the idle connection.
  const heartbeat = setInterval(() => {
    try {
      writeComment(res, "heartbeat");
    } catch {
      // ignore — main flow will detect close
    }
  }, HEARTBEAT_MS);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  };

  // Client disconnect → cleanup. Use res.on("close") instead of req.on
  // because req emits "close" when its readable body finishes (which for
  // small POST bodies fires within milliseconds), causing premature
  // cleanup that drops everything after the first event.
  res.on("close", cleanup);

  // Latency tracking — capture wall-clock start before any async work.
  const requestStart = Date.now();

  // Capture runId/messageId from the first event emitted by the conductor so
  // that any error event we synthesize in the catch block carries the real
  // identifiers instead of a hardcoded "0".
  let capturedRunId: string | undefined;
  let capturedMessageId: string | undefined;

  // Task persistence — Phase 5: track every stream as a task in the DB.
  // taskId = runId once available; we create the DB row on first event.
  let taskId: string | undefined;
  let taskCreated = false;
  const taskStartMs = Date.now();
  let taskFinalText = "";
  let taskError = false;
  const taskTitle = message.slice(0, 120);
  const userId: number | null = req.user ? Number((req.user as any).id ?? (req.user as any).userId ?? null) : null;

  try {
    const limits = (req as any).guestLimits as GuestLimits | undefined;
    const isGuest = Boolean((req as any).isGuest ?? !req.user);
    const capabilityLevel = Number((req as any).capabilityLevel ?? (isGuest ? 50 : 100));
    const userTier = isGuest ? "guest" : req.user?.userRoleId === 0 ? "admin" : "user";
    const limitStreamEvent = createStreamEventLimiter(limits, isGuest);

    await runConductor(
      {
        message,
        history,
        sessionId: body.sessionId,
        preferredMode: body.preferredMode,
        preferredProviderId: body.preferredProviderId,
        responseMode: body.responseMode ?? body.reasoningMode,
        thinkingMode: body.thinkingMode,
        toolHint: body.toolHint,
        clientMessageId: body.clientMessageId,
        userTier,
        capabilityLevel,
        guestLimits: limits,
      },
      (ev) => {
        if (closed) return;
        if (!capturedRunId && typeof ev.runId === "string" && ev.runId.length > 0) {
          capturedRunId = ev.runId;
        }
        if (!capturedMessageId && typeof ev.messageId === "string" && ev.messageId.length > 0) {
          capturedMessageId = ev.messageId;
        }

        // Phase 5: create task row on first real event (once we have a runId)
        if (!taskCreated && capturedRunId) {
          taskId = capturedRunId;
          taskCreated = true;
          // Fire-and-forget — DB write must not block SSE stream
          createTask({
            id: taskId,
            runId: capturedRunId,
            userId,
            title: message.slice(0, 120),
            intent: (ev as any).intent ?? "general",
            projectId: typeof body.projectId === "string" ? body.projectId : null,
          }).catch(() => {/* non-critical */});
        }

        // Phase 5: persist key agent milestones as task steps (fire-and-forget)
        if (taskId && (
          ev.type === "agent_started" ||
          ev.type === "fact_found" ||
          ev.type === "route_selected" ||
          ev.type === "final_answer" ||
          ev.type === "error"
        )) {
          appendTaskStep({
            taskId,
            eventType: ev.type,
            publicSummary: ev.publicSummary ?? "",
            agentId: ev.agentId,
            toolName: (ev as any).toolName,
          }).catch(() => {/* non-critical */});
        }

        // Capture final text for task completion record
        if (ev.type === "final_answer" && typeof (ev as any).finalText === "string") {
          taskFinalText = (ev as any).finalText;
        }
        if (ev.type === "error") {
          taskError = true;
        }

        const out = limitStreamEvent(ev);
        if (!out) return;
        writeEvent(res, out);
      }
    );

    // Emit a timing event so the frontend can display total latency.
    if (!closed && capturedRunId && capturedMessageId) {
      const totalMs = Date.now() - requestStart;
      const timingEv: AgentEvent = {
        type: "timing",
        runId: capturedRunId,
        messageId: capturedMessageId,
        publicSummary: `total ${totalMs}ms`,
        isSafeForUser: true,
        timestamp: new Date().toISOString(),
        totalMs,
      };
      try {
        writeEvent(res, timingEv);
      } catch {
        /* ignore */
      }
    }
  } catch (err: any) {
    taskError = true;
    if (!closed) {
      const errEv: AgentEvent = {
        type: "error",
        runId: capturedRunId || "unknown",
        messageId: capturedMessageId || "unknown",
        publicSummary: "เกิดข้อผิดพลาดระหว่างประมวลคำขอ — โปรดลองใหม่อีกครั้ง",
        isSafeForUser: true,
        timestamp: new Date().toISOString(),
      };
      try {
        writeEvent(res, errEv);
      } catch {
        /* ignore */
      }
    }
    // Don't leak err.stack into the stream; only console.error for ops
    // eslint-disable-next-line no-console
    console.error("[chatStream] error:", err?.message || err);
  } finally {
    // Phase 5: mark task complete/failed in DB (fire-and-forget)
    if (taskId && taskCreated) {
      completeTask({
        id: taskId,
        status: taskError ? "failed" : "completed",
        elapsedMs: Date.now() - taskStartMs,
        finalAnswer: taskFinalText,
        title: taskTitle,
      }).catch(() => {/* non-critical */});
    }
    cleanup();
  }
});

export default router;

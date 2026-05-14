/**
 * routes/api/chatStream.ts — Phase C SSE streaming chat endpoint
 *
 *   POST /api/chat/stream
 *
 * Body: { message: string, sessionId?: string, preferredMode?: "local"|"remote"|"hybrid",
 *         preferredProviderId?: string }
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
import type { ChatMode } from "../../providers/router";
import { optionalAuth, type AuthRequest } from "../../utils/jwt";
import { guestLimiterMiddleware, limitResponseLength } from "../../middleware/guestLimiter";

const router = Router();

const HEARTBEAT_MS = 15_000;

function writeEvent(res: Response, ev: AgentEvent): void {
  const line = `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
  // Express types don't always carry .write, but Response is a Writable
  (res as unknown as { write: (chunk: string) => boolean }).write(line);
}

function writeComment(res: Response, comment: string): void {
  (res as unknown as { write: (chunk: string) => boolean }).write(`: ${comment}\n\n`);
}

router.post("/", optionalAuth, guestLimiterMiddleware, async (req: AuthRequest, res: Response) => {
  const body = (req.body || {}) as {
    message?: string;
    sessionId?: string;
    preferredMode?: ChatMode;
    preferredProviderId?: string;
  };

  const message = typeof body.message === "string" ? body.message.trim() : "";
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

  try {
    const limits = (req as any).guestLimits;
    const isGuest = Boolean((req as any).isGuest ?? !req.user);
    const capabilityLevel = Number((req as any).capabilityLevel ?? (isGuest ? 50 : 100));
    const userTier = isGuest ? "guest" : req.user?.userRoleId === 0 ? "admin" : "user";

    await runConductor(
      {
        message,
        sessionId: body.sessionId,
        preferredMode: body.preferredMode,
        preferredProviderId: body.preferredProviderId,
        userTier,
        capabilityLevel,
      },
      (ev) => {
        if (closed) return;
        const out =
          ev.type === "final_answer" && typeof ev.finalText === "string" && limits
            ? { ...ev, finalText: limitResponseLength(ev.finalText, limits) }
            : ev;
        writeEvent(res, out);
      }
    );
  } catch (err: any) {
    if (!closed) {
      const errEv: AgentEvent = {
        type: "error",
        runId: "0",
        messageId: "0",
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
    cleanup();
  }
});

export default router;

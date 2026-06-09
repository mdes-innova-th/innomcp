/**
 * routes/api/shell.ts — Safe shell execution endpoint (Private Agent Studio)
 *
 * POST /api/shell/exec   { command, workingDir?, timeoutMs?, taskId?, sessionId? }
 * GET  /api/shell/history?sessionId=xxx&taskId=yyy&limit=20
 */

import { Router, Response } from "express";
import * as path from "node:path";
import { executeShell, streamShell } from "../../services/shellTool";
import { assessRisk } from "../../services/riskDetector";
import { withDbConnection } from "../../utils/db";
import { type AuthRequest } from "../../middleware/auth";

const router = Router();

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(process.cwd(), "../workspace");

/**
 * In-process store: approvalId → { command, timestamp } when the 403 gate fired.
 * Key is a unique per-request ID (not the raw command) to prevent collision when
 * two concurrent requests carry the same command string.
 */
const pendingApprovals = new Map<string, { command: string; ts: number }>();
const APPROVAL_TTL_MS = 60_000;

// Prune expired entries every 5 minutes — prevents unbounded growth from abandoned approvals
setInterval(() => {
  const cutoff = Date.now() - APPROVAL_TTL_MS;
  for (const [id, entry] of pendingApprovals) {
    if (entry.ts < cutoff) pendingApprovals.delete(id);
  }
}, 5 * 60_000).unref();

// POST /api/shell/exec
router.post("/exec", async (req: AuthRequest, res: Response) => {
  const { command, workingDir, timeoutMs, taskId, sessionId } = req.body as {
    command?: string;
    workingDir?: string;
    timeoutMs?: number;
    taskId?: string;
    sessionId?: string;
  };

  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "command required" });
  }

  const risk = assessRisk(command);
  const userId = req.user?.userId ?? null;

  // Block medium/high/critical before execution — record denied attempt then return 403
  if (risk.requiresApproval && (risk.riskLevel === "medium" || risk.riskLevel === "high" || risk.riskLevel === "critical")) {
    const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingApprovals.set(approvalId, { command, ts: Date.now() });
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO shell_executions
           (task_id, session_id, user_id, command, working_dir, exit_code, risk_level, approved, duration_ms)
         VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 0)`,
        [taskId ?? null, sessionId ?? null, userId, command, workingDir ?? WORKSPACE_ROOT, risk.riskLevel]
      );
    }).catch(() => {});
    return res.status(403).json({
      error: "approval_required",
      approvalId,
      riskLevel: risk.riskLevel,
      reason: risk.reason,
      command,
    });
  }

  try {
    const result = await executeShell(command, {
      workspaceRoot: WORKSPACE_ROOT,
      workingDir,
      timeoutMs,
      taskId,
      sessionId,
      userId,
      // skipAudit: false — audit via the service itself
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "shell_exec_failed", details: String(err) });
  }
});

// GET /api/shell/history
router.get("/history", async (req: AuthRequest, res: Response) => {
  const { sessionId, taskId, limit = "20" } = req.query as Record<string, string>;
  try {
    const rows = await withDbConnection(async (conn) => {
      let q =
        "SELECT id, command, exit_code, risk_level, duration_ms, created_at FROM shell_executions WHERE 1=1";
      const params: (string | number)[] = [];
      if (sessionId) { q += " AND session_id = ?"; params.push(sessionId); }
      if (taskId)    { q += " AND task_id = ?";    params.push(taskId); }
      q += " ORDER BY created_at DESC LIMIT ?";
      params.push(Math.min(parseInt(limit, 10) || 20, 100));
      const [r] = await conn.query(q, params) as any[];
      return r;
    });
    return res.json({ executions: rows });
  } catch {
    return res.json({ executions: [] });
  }
});

// POST /api/shell/stream  { command, workingDir?, timeoutMs? }
// Streams stdout/stderr as proper SSE events with named event types
router.post("/stream", async (req: AuthRequest, res: Response) => {
  const { command, workingDir, timeoutMs = 30_000 } = req.body as {
    command?: string;
    workingDir?: string;
    timeoutMs?: number;
  };

  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "command required" });
  }

  const risk = assessRisk(command);
  const userId = req.user?.userId ?? null;
  if (risk.requiresApproval && (risk.riskLevel === "medium" || risk.riskLevel === "high" || risk.riskLevel === "critical")) {
    const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingApprovals.set(approvalId, { command, ts: Date.now() });
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO shell_executions
           (task_id, session_id, user_id, command, working_dir, exit_code, risk_level, approved, duration_ms)
         VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 0)`,
        [null, null, userId, command, workingDir ?? WORKSPACE_ROOT, risk.riskLevel]
      );
    }).catch(() => {});
    return res.status(403).json({
      error: "approval_required",
      approvalId,
      riskLevel: risk.riskLevel,
      reason: risk.reason,
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

  /** Emit a named SSE event. */
  const writeEvent = (eventName: string, data: Record<string, unknown>) => {
    if (!res.writableEnded) {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const result = await streamShell(command, {
      workspaceRoot: WORKSPACE_ROOT,
      workingDir,
      timeoutMs,
      onStdout: (chunk) => writeEvent("stdout", { chunk }),
      onStderr: (chunk) => writeEvent("stderr", { chunk }),
    });

    writeEvent("exit", {
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      truncated: result.truncated,
    });
    if (!res.writableEnded) res.end();
  } catch (err: unknown) {
    // streamShell throws for blocked commands or spawn errors
    const isBlocked = err instanceof Error && (err as any).blocked === true;
    if (isBlocked) {
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "blocked", reason: (err as any).reason })}\n\n`);
        res.end();
      }
    } else {
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`);
        res.end();
      }
    }
  }
});

// POST /api/shell/approve-and-exec  { command, workingDir?, approvalToken }
// Validates that a pending approval exists for this command (recorded within the last 60s)
// then executes it bypassing the risk gate.
router.post("/approve-and-exec", async (req: AuthRequest, res: Response) => {
  const { approvalId, workingDir } = req.body as {
    approvalId?: string;
    workingDir?: string;
  };

  if (!approvalId || typeof approvalId !== "string") {
    return res.status(400).json({ error: "approvalId required" });
  }

  // Validate that the gate previously recorded this approvalId
  const pending = pendingApprovals.get(approvalId);
  if (!pending) {
    return res.status(403).json({ error: "no_pending_approval", message: "No pending approval found." });
  }
  if (Date.now() - pending.ts > APPROVAL_TTL_MS) {
    pendingApprovals.delete(approvalId);
    return res.status(403).json({ error: "approval_expired", message: "Approval window has expired. Please retry." });
  }

  // Consume the token — one-use only
  const { command } = pending;
  pendingApprovals.delete(approvalId);

  const userId = req.user?.userId ?? null;

  try {
    const result = await executeShell(command, {
      workspaceRoot: WORKSPACE_ROOT,
      workingDir,
      taskId: approvalToken,
      userId,
    });

    return res.json({ ...result, approved: true });
  } catch (err) {
    return res.status(500).json({ error: "shell_exec_failed", details: String(err) });
  }
});

export default router;

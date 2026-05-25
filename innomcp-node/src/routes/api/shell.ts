/**
 * routes/api/shell.ts — Safe shell execution endpoint (Private Agent Studio)
 *
 * POST /api/shell/exec   { command, workingDir?, timeoutMs?, taskId?, sessionId? }
 * GET  /api/shell/history?sessionId=xxx&taskId=yyy&limit=20
 */

import { Router, Request, Response } from "express";
import * as path from "node:path";
import { executeShell, streamShell } from "../../services/shellTool";
import { assessRisk } from "../../services/riskDetector";
import { withDbConnection } from "../../utils/db";

const router = Router();

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(process.cwd(), "../workspace");

// POST /api/shell/exec
router.post("/exec", async (req: Request, res: Response) => {
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

  // Block high/critical before execution — return 403 with approval info
  if (risk.requiresApproval && (risk.riskLevel === "high" || risk.riskLevel === "critical")) {
    return res.status(403).json({
      error: "approval_required",
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
      // skipAudit: false — audit via the service itself
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "shell_exec_failed", details: String(err) });
  }
});

// GET /api/shell/history
router.get("/history", async (req: Request, res: Response) => {
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
router.post("/stream", async (req: Request, res: Response) => {
  const { command, workingDir, timeoutMs = 30_000 } = req.body as {
    command?: string;
    workingDir?: string;
    timeoutMs?: number;
  };

  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "command required" });
  }

  const risk = assessRisk(command);
  if (risk.requiresApproval && (risk.riskLevel === "high" || risk.riskLevel === "critical")) {
    return res.status(403).json({
      error: "approval_required",
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

export default router;

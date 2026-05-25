/**
 * routes/api/shell.ts — Safe shell execution endpoint (Private Agent Studio)
 *
 * POST /api/shell/exec   { command, workingDir?, timeoutMs?, taskId?, sessionId? }
 * GET  /api/shell/history?sessionId=xxx&taskId=yyy&limit=20
 */

import { Router, Request, Response } from "express";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { executeShell } from "../../services/shellTool";
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

// POST /api/shell/stream — streams stdout/stderr line-by-line as SSE
router.post("/stream", async (req: Request, res: Response) => {
  const { command, workingDir, timeoutMs = 10_000 } = req.body as { command: string; workingDir?: string; timeoutMs?: number };
  if (!command || typeof command !== "string") return res.status(400).json({ error: "command required" });

  const risk = assessRisk(command);
  if (risk.requiresApproval) return res.status(403).json({ error: "approval_required", riskLevel: risk.riskLevel, reason: risk.reason });

  const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
    ? path.resolve(process.env.WORKSPACE_ROOT)
    : path.resolve(process.cwd(), "../workspace");
  const safeWd = workingDir ? path.resolve(WORKSPACE_ROOT, workingDir.replace(/^\/+/, "")) : WORKSPACE_ROOT;
  if (!safeWd.startsWith(WORKSPACE_ROOT)) return res.status(400).json({ error: "Invalid working directory" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const write = (type: string, data: Record<string, unknown>) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  const MASKED = ["API_KEY", "SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY", "AUTH"];
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env as Record<string, string>).filter(([k]) => !MASKED.some(m => k.toUpperCase().includes(m)))
  );

  const proc = spawn(command, [], { shell: true, cwd: safeWd, env: cleanEnv as NodeJS.ProcessEnv }) as import("node:child_process").ChildProcess;
  const start = Date.now();
  const timer = setTimeout(() => { proc.kill("SIGTERM"); write("timeout", { message: `Timed out after ${timeoutMs}ms` }); }, timeoutMs as number);
  timer.unref?.();

  proc.stdout?.on("data", (chunk: Buffer) => chunk.toString().split("\n").filter(Boolean).forEach(line => write("stdout", { line })));
  proc.stderr?.on("data", (chunk: Buffer) => chunk.toString().split("\n").filter(Boolean).forEach(line => write("stderr", { line })));
  proc.on("close", (code: number | null) => { clearTimeout(timer); write("done", { exitCode: code ?? -1, durationMs: Date.now() - start }); if (!res.writableEnded) res.end(); });
  req.on("close", () => proc.kill("SIGTERM"));
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

// POST /api/shell/stream  { command, workingDir?, timeoutMs?, taskId? }
// Streams stdout line-by-line as SSE events
router.post("/stream", async (req: Request, res: Response) => {
  const { command, workingDir, timeoutMs = 10_000, taskId } = req.body as {
    command?: string;
    workingDir?: string;
    timeoutMs?: number;
    taskId?: string;
  };

  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "command required" });
  }

  const risk = assessRisk(command);
  if (risk.requiresApproval) {
    return res.status(403).json({
      error: "approval_required",
      riskLevel: risk.riskLevel,
      reason: risk.reason,
    });
  }

  // Validate working dir
  const safeWd = workingDir
    ? path.resolve(WORKSPACE_ROOT, workingDir.replace(/^\/+/, ""))
    : WORKSPACE_ROOT;
  if (!safeWd.startsWith(WORKSPACE_ROOT)) {
    return res.status(400).json({ error: "Invalid working dir" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

  const write = (type: string, data: Record<string, unknown>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }
  };

  const { spawn } = await import("child_process");
  const start = Date.now();
  const proc = spawn(command, [], {
    shell: true,
    cwd: safeWd,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([k]) =>
          !["API_KEY", "SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY", "AUTH"].some((m) =>
            k.toUpperCase().includes(m)
          )
      )
    ) as NodeJS.ProcessEnv,
  });

  const timer = setTimeout(() => {
    proc.kill("SIGTERM");
    write("timeout", { message: `Timed out after ${timeoutMs}ms` });
  }, timeoutMs);
  if (typeof (timer as any).unref === "function") (timer as any).unref();

  proc.stdout?.on("data", (chunk: Buffer) => {
    chunk
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => write("stdout", { line }));
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    chunk
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => write("stderr", { line }));
  });
  proc.on("close", (code: number | null) => {
    clearTimeout(timer);
    write("done", { exitCode: code ?? -1, durationMs: Date.now() - start });
    if (!res.writableEnded) res.end();
  });
  req.on("close", () => proc.kill("SIGTERM"));
});

export default router;

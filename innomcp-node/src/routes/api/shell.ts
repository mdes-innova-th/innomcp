/**
 * routes/api/shell.ts — Safe shell execution endpoint (Private Agent Studio)
 *
 * POST /api/shell/exec   { command, workingDir?, timeoutMs?, taskId?, sessionId? }
 * GET  /api/shell/history?sessionId=xxx&taskId=yyy&limit=20
 */

import { Router, Request, Response } from "express";
import * as path from "node:path";
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

export default router;

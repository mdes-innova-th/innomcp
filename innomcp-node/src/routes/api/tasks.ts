/**
 * /api/tasks — Task persistence CRUD for Manus-style task history.
 * Tasks are created when a chat stream starts, updated on completion/failure.
 */

import { Router, Request, Response } from "express";
import { withDbConnection } from "../../utils/db";

const router = Router();

// ── List recent tasks (authenticated user or guest by session) ────────────────
router.get("/", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id ?? null;
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  try {
    const rows = await withDbConnection(async (conn) => {
      if (userId) {
        const [r] = await conn.query(
          `SELECT id, title, intent, status, elapsed_ms, created_at, completed_at
           FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
          [userId, limit]
        );
        return r;
      }
      // Guest: no persistent tasks — return empty
      return [];
    });
    res.json({ tasks: rows });
  } catch (err) {
    console.error("[tasks] list error", err);
    res.json({ tasks: [] });
  }
});

// ── Get single task with steps ────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [task, steps] = await withDbConnection(async (conn) => {
      const [taskRows] = await conn.query(
        `SELECT * FROM tasks WHERE id = ? LIMIT 1`,
        [id]
      );
      const [stepRows] = await conn.query(
        `SELECT event_type, public_summary, agent_id, tool_name, ts FROM task_steps WHERE task_id = ? ORDER BY id ASC`,
        [id]
      );
      return [taskRows, stepRows];
    });
    const taskArr = task as any[];
    if (taskArr.length === 0) {
      return res.status(404).json({ error: "task not found" });
    }
    res.json({ task: taskArr[0], steps });
  } catch (err) {
    console.error("[tasks] get error", err);
    res.status(500).json({ error: "internal" });
  }
});

// ── Internal: create task when stream starts ──────────────────────────────────
export async function createTask(params: {
  id: string;
  runId: string;
  userId: number | null;
  title: string;
  intent: string;
}): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT IGNORE INTO tasks (id, run_id, user_id, title, intent, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'running', NOW())`,
        [params.id, params.runId, params.userId, params.title.slice(0, 254), params.intent]
      );
    });
  } catch (err) {
    console.error("[tasks] createTask error", err);
  }
}

// ── Internal: update task on completion or failure ────────────────────────────
export async function completeTask(params: {
  id: string;
  status: "completed" | "failed";
  elapsedMs?: number;
  finalAnswer?: string;
}): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `UPDATE tasks SET status = ?, elapsed_ms = ?, final_answer = ?, completed_at = NOW()
         WHERE id = ?`,
        [params.status, params.elapsedMs ?? null, (params.finalAnswer ?? "").slice(0, 2000), params.id]
      );
    });
  } catch (err) {
    console.error("[tasks] completeTask error", err);
  }
}

// ── Internal: append a step ───────────────────────────────────────────────────
export async function appendTaskStep(params: {
  taskId: string;
  eventType: string;
  publicSummary: string;
  agentId?: string;
  toolName?: string;
}): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO task_steps (task_id, event_type, public_summary, agent_id, tool_name, ts)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [params.taskId, params.eventType, params.publicSummary.slice(0, 500), params.agentId ?? null, params.toolName ?? null]
      );
    });
  } catch (err) {
    // non-critical — don't spam logs
  }
}

export default router;

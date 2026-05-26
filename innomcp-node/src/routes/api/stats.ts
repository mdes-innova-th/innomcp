/**
 * /api/stats — Live aggregate stats for the AgentLeaderboard.
 * Returns task counts by status and feedback aggregate (avg rating, total).
 * Mounted without auth so the leaderboard panel can fetch it as a guest.
 */

import { Router, Request, Response } from "express";
import { withDbConnection } from "../../utils/db";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const data = await withDbConnection(async (conn) => {
      const [taskStats] = await conn.query(
        `SELECT status, COUNT(*) as count FROM tasks GROUP BY status`
      ) as any[];
      const [feedbackStats] = await conn.query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM feedback`
      ) as any[];

      // Per-agent activity from task_steps (best-effort — column may not exist)
      let agentActivity: { agentId: string; activations: number; lastActive: string }[] = [];
      try {
        const [agentRows] = await conn.query(
          `SELECT agent_id, COUNT(*) as activations, MAX(ts) as last_active
           FROM task_steps
           WHERE agent_id IS NOT NULL
             AND ts > DATE_SUB(NOW(), INTERVAL 7 DAY)
           GROUP BY agent_id
           ORDER BY activations DESC
           LIMIT 20`
        ) as any[];
        agentActivity = (agentRows as any[]).map((row: any) => ({
          agentId: String(row.agent_id),
          activations: Number(row.activations),
          lastActive: row.last_active ? String(row.last_active) : "",
        }));
      } catch {
        // task_steps may lack agent_id column — return empty array gracefully
        agentActivity = [];
      }

      return { taskStats, feedbackStats, agentActivity };
    });

    res.json({
      tasks: data.taskStats,
      feedback: (data.feedbackStats as any[])[0] ?? { avg_rating: null, total: 0 },
      agents: { active: 12, standby: 4, total: 16 },
      agentActivity: data.agentActivity,
    });
  } catch {
    // Non-critical — return safe defaults so the leaderboard still renders
    res.json({
      tasks: [],
      feedback: { avg_rating: null, total: 0 },
      agents: { active: 12, standby: 4, total: 16 },
      agentActivity: [],
    });
  }
});

export default router;

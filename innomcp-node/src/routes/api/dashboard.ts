/**
 * /api/dashboard — Single-payload dashboard summary.
 * Returns task stats, recent tasks, feedback avg, and shell execution count.
 */

import { Router, Request, Response } from "express";
import { withDbConnection } from "../../utils/db";

const router = Router();

// GET /api/dashboard
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [taskStatsRows, recentTasksRows, feedbackRows, shellRows] =
      await withDbConnection(async (conn) => {
        return Promise.all([
          conn.query(
            "SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
          ),
          conn.query(
            "SELECT id, title, intent, status, elapsed_ms, created_at FROM tasks ORDER BY created_at DESC LIMIT 8"
          ),
          conn.query(
            "SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM feedback"
          ),
          conn.query(
            "SELECT COUNT(*) as count FROM shell_executions WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)"
          ),
        ]);
      });

    const taskStats = (taskStatsRows[0] as any[]) ?? [];
    const recentTasks = (recentTasksRows[0] as any[]) ?? [];
    const feedbackRow = ((feedbackRows[0] as any[])[0]) ?? null;
    const shellCount = ((shellRows[0] as any[])[0])?.count ?? 0;

    const statusMap: Record<string, number> = {};
    taskStats.forEach((r: any) => {
      statusMap[r.status] = Number(r.count);
    });

    res.json({
      stats: {
        totalTasks: Object.values(statusMap).reduce((a, b) => a + b, 0),
        completedTasks: statusMap["completed"] ?? 0,
        runningTasks: statusMap["running"] ?? 0,
        failedTasks: statusMap["failed"] ?? 0,
        avgRating: feedbackRow?.avg_rating
          ? Number(feedbackRow.avg_rating).toFixed(1)
          : null,
        totalFeedback: Number(feedbackRow?.total ?? 0),
        shellExecutions24h: Number(shellCount),
      },
      recentTasks,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    res.json({
      stats: {
        totalTasks: 0,
        completedTasks: 0,
        runningTasks: 0,
        failedTasks: 0,
        avgRating: null,
        totalFeedback: 0,
        shellExecutions24h: 0,
      },
      recentTasks: [],
      generatedAt: new Date().toISOString(),
    });
  }
});

export default router;

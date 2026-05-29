/**
 * /api/dashboard — Single-payload dashboard summary.
 * Returns task stats, recent tasks, feedback avg, and shell execution count.
 */

import { Router, Response } from "express";
import { withDbConnection } from "../../utils/db";
import {
  authenticateToken,
  type AuthRequest,
} from "../../utils/jwt";

const router = Router();
router.use(authenticateToken);
let tasksProjectColumnEnsured = false;

async function ensureTasksProjectColumn(): Promise<void> {
  if (tasksProjectColumnEnsured) return;
  await withDbConnection(async (conn) => {
    try {
      await conn.query("ALTER TABLE tasks ADD COLUMN project_id VARCHAR(36) NULL");
    } catch {}
    try {
      await conn.query("CREATE INDEX idx_tasks_project_created ON tasks (project_id, created_at DESC)");
    } catch {}
  });
  tasksProjectColumnEnsured = true;
}

function resolveDashboardUserId(req: AuthRequest): string | number | null {
  if (req.user?.userId != null) return req.user.userId;
  return null;
}

function buildDashboardOwnership(userId: string | number | null): {
  clause: string;
  params: Array<string | number>;
} {
  if (userId == null) {
    return { clause: "", params: [] };
  }
  return {
    clause: " AND user_id = ?",
    params: [userId],
  };
}

// GET /api/dashboard
router.get("/", async (req: AuthRequest, res: Response) => {
  const projectId = String(req.query.projectId || req.query.project_id || "").trim();
  const ownership = buildDashboardOwnership(resolveDashboardUserId(req));
  try {
    if (projectId) {
      await ensureTasksProjectColumn();
    }
    const [taskStatsRows, totalCountRows, recentTasksRows, feedbackRows, shellRows] =
      await withDbConnection(async (conn) => {
        return Promise.all([
          conn.query(
            `SELECT status, COUNT(*) as count FROM tasks WHERE (? = '' OR project_id = ?) AND status <> 'archived'${ownership.clause} GROUP BY status`,
            [projectId, projectId, ...ownership.params]
          ),
          conn.query(
            `SELECT COUNT(*) as total FROM tasks WHERE (? = '' OR project_id = ?) AND status <> 'archived'${ownership.clause}`,
            [projectId, projectId, ...ownership.params]
          ),
          conn.query(
            `SELECT id, title, intent, status, elapsed_ms, created_at, project_id FROM tasks WHERE (? = '' OR project_id = ?) AND status <> 'archived'${ownership.clause} ORDER BY created_at DESC LIMIT 8`,
            [projectId, projectId, ...ownership.params]
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
    const totalTasks = Number(((totalCountRows[0] as any[])[0])?.total ?? 0);
    const recentTasks = (recentTasksRows[0] as any[]) ?? [];
    const feedbackRow = ((feedbackRows[0] as any[])[0]) ?? null;
    const shellCount = ((shellRows[0] as any[])[0])?.count ?? 0;

    const statusMap: Record<string, number> = {};
    taskStats.forEach((r: any) => {
      statusMap[r.status] = Number(r.count);
    });

    res.json({
      stats: {
        totalTasks,
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

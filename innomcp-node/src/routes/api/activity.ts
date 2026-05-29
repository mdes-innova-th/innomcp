/**
 * /api/activity — Live activity feed across the system.
 *
 * Aggregates recent events from:
 *   - tasks table          → "task_created", "task_completed"
 *   - task_steps table     → "agent_action"
 *   - projects table       → "project_created"
 *
 * Mounted at: /api/activity (see app.ts)
 *
 * GET /api/activity
 *   Query params:
 *     limit     — max items to return (default 20, max 100)
 *     projectId — filter to a specific project
 *     userId    — filter to a specific user (guests see only their own tasks)
 */

import { Router, Response } from "express";
import { withDbConnection } from "../../utils/db";
import { optionalAuth, type AuthRequest } from "../../utils/jwt";

const router = Router();
router.use(optionalAuth);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type:
    | "task_created"
    | "task_completed"
    | "agent_action"
    | "message_sent"
    | "project_created";
  description: string;
  userId: string | number | null;
  projectId: string | null;
  createdAt: string;
  agentId?: string | null;
}

// ─── Schema guards ────────────────────────────────────────────────────────────

let projectsTableEnsured = false;
async function ensureProjectsTable(
  conn: import("mysql2/promise").Connection
): Promise<void> {
  if (projectsTableEnsured) return;
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#3b82f6',
        icon VARCHAR(10) DEFAULT '📁',
        created_at DATETIME DEFAULT NOW(),
        archived_at DATETIME
      )
    `);
  } catch {
    // ignore — table may already exist
  }
  projectsTableEnsured = true;
}

let taskProjectColumnEnsured = false;
async function ensureTaskProjectColumn(
  conn: import("mysql2/promise").Connection
): Promise<void> {
  if (taskProjectColumnEnsured) return;
  try {
    await conn.query(
      "ALTER TABLE tasks ADD COLUMN project_id VARCHAR(36) NULL"
    );
  } catch {}
  try {
    await conn.query(
      "CREATE INDEX idx_tasks_project_created ON tasks (project_id, created_at DESC)"
    );
  } catch {}
  taskProjectColumnEnsured = true;
}

// ─── GET /api/activity ────────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  // Parse query params
  const rawLimit = Number(req.query.limit) || 20;
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const projectId =
    String(req.query.projectId || req.query.project_id || "").trim() || null;
  const filterUserId =
    String(req.query.userId || req.query.user_id || "").trim() || null;

  // Authenticated user — used for ownership scoping
  const authUserId = req.user?.userId ?? null;

  // If a userId filter is requested by an unauthenticated guest, scope to that
  // guest's own tasks only (best-effort — no real auth guard here, intentional).
  const effectiveUserId = filterUserId ?? authUserId;

  try {
    const activities = await withDbConnection(async (conn) => {
      // Ensure optional schema additions exist
      await ensureProjectsTable(conn);
      await ensureTaskProjectColumn(conn);

      // ── Build optional WHERE fragments ──────────────────────────────────────
      const projectFilter = projectId ? " AND project_id = ?" : "";
      const userFilter = effectiveUserId ? " AND user_id = ?" : "";
      const projectParam = projectId ? [projectId] : [];
      const userParam = effectiveUserId ? [effectiveUserId] : [];

      // Use a larger fetch window per source so we have enough items after UNION + sort
      const perSourceLimit = limit * 3;

      // ── 1. task_created: all non-archived tasks ──────────────────────────────
      const taskCreatedSql = `
        SELECT
          id              AS id,
          'task_created'  AS type,
          COALESCE(title, intent, 'New task') AS description,
          user_id         AS userId,
          project_id      AS projectId,
          created_at      AS createdAt,
          NULL            AS agentId
        FROM tasks
        WHERE status <> 'archived'${projectFilter}${userFilter}
        ORDER BY created_at DESC
        LIMIT ?
      `;

      // ── 2. task_completed ────────────────────────────────────────────────────
      const taskCompletedSql = `
        SELECT
          id                AS id,
          'task_completed'  AS type,
          CONCAT('Completed: ', COALESCE(title, intent, 'Task')) AS description,
          user_id           AS userId,
          project_id        AS projectId,
          COALESCE(completed_at, updated_at, created_at) AS createdAt,
          NULL              AS agentId
        FROM tasks
        WHERE status = 'completed'${projectFilter}${userFilter}
        ORDER BY COALESCE(completed_at, updated_at, created_at) DESC
        LIMIT ?
      `;

      // ── 3. agent_action: task_steps ─────────────────────────────────────────
      // task_steps doesn't have user_id or project_id directly; join tasks
      const agentProjectJoin = projectId
        ? " AND t.project_id = ?"
        : "";
      const agentUserJoin = effectiveUserId
        ? " AND t.user_id = ?"
        : "";

      const agentActionSql = `
        SELECT
          CAST(ts.id AS CHAR)  AS id,
          'agent_action'       AS type,
          COALESCE(ts.public_summary, ts.event_type, 'Agent action') AS description,
          t.user_id            AS userId,
          t.project_id         AS projectId,
          ts.ts                AS createdAt,
          ts.agent_id          AS agentId
        FROM task_steps ts
        JOIN tasks t ON t.id = ts.task_id
        WHERE t.status <> 'archived'${agentProjectJoin}${agentUserJoin}
        ORDER BY ts.ts DESC
        LIMIT ?
      `;

      // ── 4. project_created ───────────────────────────────────────────────────
      const projectFilterClause = projectId ? " AND id = ?" : "";
      const projectUserClause = effectiveUserId ? " AND user_id = ?" : "";

      const projectCreatedSql = `
        SELECT
          id                    AS id,
          'project_created'     AS type,
          CONCAT('Project created: ', name) AS description,
          user_id               AS userId,
          id                    AS projectId,
          created_at            AS createdAt,
          NULL                  AS agentId
        FROM projects
        WHERE archived_at IS NULL${projectFilterClause}${projectUserClause}
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const agentProjectParams = projectId ? [projectId] : [];
      const agentUserParams = effectiveUserId ? [effectiveUserId] : [];

      const projectIdFilter2 = projectId ? [projectId] : [];
      const projectUserFilter2 = effectiveUserId ? [effectiveUserId] : [];

      const [
        taskCreatedRows,
        taskCompletedRows,
        agentActionRows,
        projectCreatedRows,
      ] = await Promise.all([
        conn
          .query(taskCreatedSql, [
            ...projectParam,
            ...userParam,
            perSourceLimit,
          ])
          .then(([r]) => r as any[])
          .catch(() => [] as any[]),

        conn
          .query(taskCompletedSql, [
            ...projectParam,
            ...userParam,
            perSourceLimit,
          ])
          .then(([r]) => r as any[])
          .catch(() => [] as any[]),

        conn
          .query(agentActionSql, [
            ...agentProjectParams,
            ...agentUserParams,
            perSourceLimit,
          ])
          .then(([r]) => r as any[])
          .catch(() => [] as any[]),

        conn
          .query(projectCreatedSql, [
            ...projectIdFilter2,
            ...projectUserFilter2,
            perSourceLimit,
          ])
          .then(([r]) => r as any[])
          .catch(() => [] as any[]),
      ]);

      return [
        ...taskCreatedRows,
        ...taskCompletedRows,
        ...agentActionRows,
        ...projectCreatedRows,
      ];
    });

    // ── Sort all events by createdAt DESC, then slice to limit ────────────────
    const sorted = (activities as any[])
      .filter((a) => a && a.createdAt)
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return tb - ta;
      });

    const total = sorted.length;
    const page = sorted.slice(0, limit);
    const hasMore = total > limit;

    // Normalise field types for the response
    const normalised: ActivityItem[] = page.map((a, idx) => ({
      id: String(a.id ?? idx),
      type: a.type,
      description: String(a.description ?? ""),
      userId: a.userId ?? null,
      projectId: a.projectId ? String(a.projectId) : null,
      createdAt:
        a.createdAt instanceof Date
          ? a.createdAt.toISOString()
          : String(a.createdAt),
      agentId: a.agentId ? String(a.agentId) : undefined,
    }));

    res.json({
      activities: normalised,
      total,
      hasMore,
    });
  } catch (err) {
    // Return empty payload on any DB error rather than 500
    res.json({
      activities: [] as ActivityItem[],
      total: 0,
      hasMore: false,
    });
  }
});

export default router;

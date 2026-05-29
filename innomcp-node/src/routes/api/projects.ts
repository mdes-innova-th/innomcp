/**
 * routes/api/projects.ts — Projects API
 *
 * Manage user projects for grouping tasks and memories.
 * Mounted at: /api/projects
 *
 * The `projects` table is created on first access if it does not exist.
 */

import { Router, Response } from "express";
import { withDbConnection } from "../../utils/db";
import { clearCache } from "../../middleware/cacheMiddleware";
import {
  authenticateToken,
  type AuthRequest,
} from "../../utils/jwt";

const router = Router();
router.use(authenticateToken);

const CREATE_TABLE_SQL = `
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
`;

async function ensureTable(): Promise<void> {
  await withDbConnection(async (conn) => {
    await conn.query(CREATE_TABLE_SQL);
  });
}

// GET /api/projects — list non-archived projects scoped to current user
router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId ?? null;
  try {
    const rows = await withDbConnection(async (conn) => {
      const [r] = await conn.query(
        "SELECT * FROM projects WHERE user_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 50",
        [userId]
      ) as any[];
      return r;
    });
    res.json({ projects: rows ?? [] });
  } catch {
    // Table may not exist yet — create it and return empty list
    try {
      await ensureTable();
    } catch {
      // ignore secondary error
    }
    res.json({ projects: [] });
  }
});

// POST /api/projects — create a new project
router.post("/", async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId ?? null;
  const { name, description, color, icon } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const id = crypto.randomUUID();
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO projects (id, user_id, name, description, color, icon)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          name.trim(),
          description ?? null,
          color ?? "#3b82f6",
          icon ?? "📁",
        ]
      );
    });
    clearCache("/api/dashboard");
    res.status(201).json({ id, name: name.trim() });
  } catch (err: any) {
    // If table missing, create it and retry once
    if (String(err?.message ?? "").includes("doesn't exist") || String(err?.code ?? "").includes("ER_NO_SUCH_TABLE")) {
      try {
        await ensureTable();
        await withDbConnection(async (conn) => {
          await conn.query(
            `INSERT INTO projects (id, user_id, name, description, color, icon)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, userId, name.trim(), description ?? null, color ?? "#3b82f6", icon ?? "📁"]
          );
        });
        clearCache("/api/dashboard");
        return res.status(201).json({ id, name: name.trim() });
      } catch {
        return res.status(500).json({ error: "Could not create project" });
      }
    }
    res.status(500).json({ error: "Could not create project" });
  }
});

// GET /api/projects/:id — get a single project
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const rows = await withDbConnection(async (conn) => {
      const [r] = await conn.query(
        "SELECT * FROM projects WHERE id = ? AND user_id = ? AND archived_at IS NULL LIMIT 1",
        [req.params.id, req.user?.userId ?? null]
      ) as any[];
      return r;
    });
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json({ project: rows[0] });
  } catch {
    res.status(500).json({ error: "Could not fetch project" });
  }
});

// PATCH /api/projects/:id — update name / description / color / icon
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const { name, description, color, icon } = req.body;
  const fields: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { fields.push("name = ?"); params.push(name.trim()); }
  if (description !== undefined) { fields.push("description = ?"); params.push(description); }
  if (color !== undefined) { fields.push("color = ?"); params.push(color); }
  if (icon !== undefined) { fields.push("icon = ?"); params.push(icon); }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  params.push(req.params.id, req.user?.userId ?? null);

  try {
    const affectedRows = await withDbConnection(async (conn) => {
      const [result] = await conn.query(
        `UPDATE projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
        params
      ) as any[];
      return Number(result?.affectedRows ?? 0);
    });
    if (affectedRows === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not update project" });
  }
});

export default router;

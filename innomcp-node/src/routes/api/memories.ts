/**
 * routes/api/memories.ts — Project Memory API (Private Agent Studio)
 *
 * Key-value store scoped to session / project / user.
 * Mounted at: /api/memories
 */

import { Router, Response } from "express";
import { withDbConnection } from "../../utils/db";
import { optionalAuth, type AuthRequest } from "../../utils/jwt";

const router = Router();
router.use(optionalAuth);

async function ensureProjectAccess(projectId: string | undefined, userId: number | null): Promise<boolean> {
  if (!projectId) return true;
  if (!userId) return false;

  const rows = await withDbConnection(async (conn) => {
    const [result] = await conn.query(
      "SELECT id FROM projects WHERE id = ? AND user_id = ? AND archived_at IS NULL LIMIT 1",
      [projectId, userId]
    ) as any[];
    return result as any[];
  });

  return Array.isArray(rows) && rows.length > 0;
}

// GET /api/memories?scope=session&sessionId=xxx&projectId=yyy
router.get("/", async (req: AuthRequest, res: Response) => {
  const { scope, sessionId, projectId } = req.query as Record<string, string>;
  const hasProjectAccess = await ensureProjectAccess(projectId, req.user?.userId ?? null).catch(() => false);
  if (projectId && !hasProjectAccess) {
    return res.status(403).json({ error: "Project access denied" });
  }

  const userId = req.user?.userId ?? null;

  try {
    const rows = await withDbConnection(async (conn) => {
      let query =
        "SELECT id, scope, key_name, value, created_at, updated_at FROM memories WHERE 1=1";
      const params: any[] = [];
      if (userId !== null) {
        query += " AND user_id = ?";
        params.push(userId);
      }
      if (scope) {
        query += " AND scope = ?";
        params.push(scope);
      }
      if (sessionId) {
        query += " AND session_id = ?";
        params.push(sessionId);
      }
      if (projectId) {
        query += " AND project_id = ?";
        params.push(projectId);
      }
      query += " ORDER BY updated_at DESC LIMIT 50";
      const [r] = await conn.query(query, params) as any[];
      return r;
    });
    res.json({ memories: rows });
  } catch {
    res.json({ memories: [] });
  }
});

// GET /api/memories/search?q=keyword&scope=session&sessionId=xxx
router.get("/search", async (req: AuthRequest, res: Response) => {
  const { q, scope, sessionId, projectId } = req.query as Record<string, string>;
  if (!q?.trim()) return res.status(400).json({ error: "q required" });
  const hasProjectAccess = await ensureProjectAccess(projectId, req.user?.userId ?? null).catch(() => false);
  if (projectId && !hasProjectAccess) {
    return res.status(403).json({ error: "Project access denied" });
  }
  const searchUserId = req.user?.userId ?? null;

  try {
    const rows = await withDbConnection(async (conn) => {
      let query = "SELECT id, scope, key_name AS keyName, value, tag, created_at AS createdAt, updated_at AS updatedAt FROM memories WHERE (key_name LIKE ? OR value LIKE ?)";
      const params: any[] = [`%${q}%`, `%${q}%`];
      if (searchUserId !== null) { query += " AND user_id = ?"; params.push(searchUserId); }
      if (scope) { query += " AND scope = ?"; params.push(scope); }
      if (sessionId) { query += " AND session_id = ?"; params.push(sessionId); }
      if (projectId) { query += " AND project_id = ?"; params.push(projectId); }
      query += " ORDER BY updated_at DESC LIMIT 20";
      const [result] = await conn.query(query, params) as any[];
      return result;
    });
    res.json({ memories: rows ?? [] });
  } catch { res.json({ memories: [] }); }
});

// POST /api/memories  { scope, keyName, value, sessionId?, projectId?, tag? }
router.post("/", async (req: AuthRequest, res: Response) => {
  const { scope = "session", keyName, value, sessionId, projectId, tag } = req.body;
  if (!keyName || value === undefined) {
    return res.status(400).json({ error: "keyName and value required" });
  }
  const hasProjectAccess = await ensureProjectAccess(projectId, req.user?.userId ?? null).catch(() => false);
  if (projectId && !hasProjectAccess) {
    return res.status(403).json({ error: "Project access denied" });
  }
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO memories (scope, key_name, value, session_id, project_id, tag)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), tag = VALUES(tag), updated_at = NOW()`,
        [scope, keyName, String(value), sessionId ?? null, projectId ?? null, tag ?? null]
      );
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not save memory" });
  }
});

// DELETE /api/memories/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await withDbConnection(async (conn) => {
      await conn.query("DELETE FROM memories WHERE id = ?", [req.params.id]);
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not delete" });
  }
});

export default router;

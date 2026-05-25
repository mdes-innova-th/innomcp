import { Router, Request, Response } from 'express';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { withDbConnection } from '../../../utils/db';
import { authenticateToken, AuthRequest } from '../../../utils/jwt';
import { WORKSPACE_ROOT, safePath } from '../files';

const router = Router();

// ---------------------------------------------------------------------------
// File Browser — public (no auth required, sandbox-enforced)
// ---------------------------------------------------------------------------

const MAX_FILES = 200;
const MAX_DEPTH = 3;

interface FileMeta {
  name: string;
  path: string;
  size: number;
  mtime: string;
  type: 'file' | 'dir';
}

/**
 * Recursively collect entries under `dir`, relative to `WORKSPACE_ROOT`.
 * `depth` counts remaining levels (0 = stop recursing).
 */
async function collectFiles(
  dir: string,
  relBase: string,
  depth: number,
  acc: FileMeta[]
): Promise<void> {
  if (acc.length >= MAX_FILES) return;
  let entries: string[];
  try {
    entries = await fsPromises.readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (acc.length >= MAX_FILES) break;
    const absEntry = path.join(dir, name);
    const relEntry = relBase ? `${relBase}/${name}` : name;
    let stat;
    try {
      stat = await fsPromises.stat(absEntry);
    } catch {
      continue;
    }
    const isDir = stat.isDirectory();
    acc.push({
      name,
      path: relEntry,
      size: isDir ? 0 : stat.size,
      mtime: stat.mtime.toISOString(),
      type: isDir ? 'dir' : 'file',
    });
    if (isDir && depth > 1) {
      await collectFiles(absEntry, relEntry, depth - 1, acc);
    }
  }
}

/**
 * GET /api/workspace/files
 * List workspace files recursively (max depth 3, max 200 entries).
 */
router.get('/files', async (_req: Request, res: Response) => {
  try {
    if (!existsSync(WORKSPACE_ROOT)) {
      return res.json({ files: [] });
    }
    const files: FileMeta[] = [];
    await collectFiles(WORKSPACE_ROOT, '', MAX_DEPTH, files);
    res.json({ files });
  } catch (err) {
    console.error('[Workspace] File listing error:', err);
    res.status(500).json({ error: 'Failed to list workspace files' });
  }
});

/**
 * GET /api/workspace/files/*
 * Read a single file's content.
 */
router.get('/files/*', async (req: Request, res: Response) => {
  const userPath = (req.params as Record<string, string>)[0] || '';
  const safe = safePath(userPath);
  if (!safe) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  try {
    const stat = await fsPromises.stat(safe);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }
    // Cap content preview at 512 KB
    if (stat.size > 512 * 1024) {
      return res.status(413).json({ error: 'File too large for preview' });
    }
    const content = await fsPromises.readFile(safe, 'utf-8');
    const ext = path.extname(userPath).slice(1).toLowerCase();
    res.json({ content, path: userPath, size: stat.size, ext });
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

// ---------------------------------------------------------------------------
// Apply authentication to all workspace routes below this line
// ---------------------------------------------------------------------------

// Apply authentication to all workspace routes
router.use(authenticateToken);

/**
 * GET /api/workspace
 * Get all workspaces for current user
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const workspaces = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT 
          workspace_id,
          workspace_name,
          workspace_slug,
          description,
          theme,
          color_scheme,
          language,
          timezone,
          storage_quota_mb,
          storage_used_mb,
          is_default,
          is_active,
          created_at,
          updated_at
        FROM user_workspaces
        WHERE user_id = ? AND is_active = 1
        ORDER BY is_default DESC, created_at DESC`,
        [userId]
      );
      return rows;
    });

    res.json({
      success: true,
      data: workspaces
    });

  } catch (error) {
    console.error('[Workspace] Get workspaces error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workspaces'
    });
  }
});

/**
 * GET /api/workspace/:id
 * Get specific workspace details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const workspaceId = parseInt(req.params.id);

    const workspace = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT 
          w.*,
          (SELECT COUNT(*) FROM user_files WHERE workspace_id = w.workspace_id) as file_count
        FROM user_workspaces w
        WHERE w.workspace_id = ? AND w.user_id = ?`,
        [workspaceId, userId]
      );
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      data: workspace
    });

  } catch (error) {
    console.error('[Workspace] Get workspace error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workspace'
    });
  }
});

/**
 * POST /api/workspace
 * Create new workspace
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, description, theme, colorScheme, language } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Workspace name is required'
      });
    }

    const workspaceId = await withDbConnection(async (conn) => {
      // Generate unique slug
      const slug = `workspace-${userId}-${Date.now()}`;

      const [result] = await conn.query(
        `INSERT INTO user_workspaces 
         (user_id, workspace_name, workspace_slug, description, theme, color_scheme, language, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, name, slug, description || null, theme || 'auto', colorScheme || 'green', language || 'en']
      );

      return (result as any).insertId;
    });

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: { workspaceId }
    });

  } catch (error) {
    console.error('[Workspace] Create workspace error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create workspace'
    });
  }
});

/**
 * PUT /api/workspace/:id
 * Update workspace settings
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const workspaceId = parseInt(req.params.id);
    const { name, description, theme, colorScheme, language, timezone } = req.body;

    // Verify ownership
    const hasAccess = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT workspace_id FROM user_workspaces WHERE workspace_id = ? AND user_id = ?',
        [workspaceId, userId]
      );
      return Array.isArray(rows) && rows.length > 0;
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await withDbConnection(async (conn) => {
      await conn.query(
        `UPDATE user_workspaces 
         SET workspace_name = COALESCE(?, workspace_name),
             description = COALESCE(?, description),
             theme = COALESCE(?, theme),
             color_scheme = COALESCE(?, color_scheme),
             language = COALESCE(?, language),
             timezone = COALESCE(?, timezone),
             updated_at = NOW()
         WHERE workspace_id = ?`,
        [name, description, theme, colorScheme, language, timezone, workspaceId]
      );
    });

    res.json({
      success: true,
      message: 'Workspace updated successfully'
    });

  } catch (error) {
    console.error('[Workspace] Update workspace error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update workspace'
    });
  }
});

/**
 * DELETE /api/workspace/:id
 * Delete workspace (soft delete)
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const workspaceId = parseInt(req.params.id);

    // Verify ownership and check if default
    const workspace = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT is_default FROM user_workspaces WHERE workspace_id = ? AND user_id = ?',
        [workspaceId, userId]
      );
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    });

    if (!workspace) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if ((workspace as any).is_default) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default workspace'
      });
    }

    await withDbConnection(async (conn) => {
      await conn.query(
        'UPDATE user_workspaces SET is_active = 0, updated_at = NOW() WHERE workspace_id = ?',
        [workspaceId]
      );
    });

    res.json({
      success: true,
      message: 'Workspace deleted successfully'
    });

  } catch (error) {
    console.error('[Workspace] Delete workspace error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete workspace'
    });
  }
});

/**
 * GET /api/workspace/:id/instructions
 * Get workspace custom instructions
 */
router.get('/:id/instructions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const workspaceId = parseInt(req.params.id);

    // Verify ownership
    const hasAccess = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT workspace_id FROM user_workspaces WHERE workspace_id = ? AND user_id = ?',
        [workspaceId, userId]
      );
      return Array.isArray(rows) && rows.length > 0;
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const instructions = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT instruction_id, instruction_type, instruction_text, priority, is_active
         FROM workspace_instructions
         WHERE workspace_id = ? AND is_active = 1
         ORDER BY priority ASC`,
        [workspaceId]
      );
      return rows;
    });

    res.json({
      success: true,
      data: instructions
    });

  } catch (error) {
    console.error('[Workspace] Get instructions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch instructions'
    });
  }
});

/**
 * POST /api/workspace/:id/instructions
 * Add custom instruction to workspace
 */
router.post('/:id/instructions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const workspaceId = parseInt(req.params.id);
    const { type, text, priority } = req.body;

    if (!type || !text) {
      return res.status(400).json({
        success: false,
        error: 'Instruction type and text are required'
      });
    }

    // Verify ownership
    const hasAccess = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT workspace_id FROM user_workspaces WHERE workspace_id = ? AND user_id = ?',
        [workspaceId, userId]
      );
      return Array.isArray(rows) && rows.length > 0;
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const instructionId = await withDbConnection(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO workspace_instructions 
         (workspace_id, instruction_type, instruction_text, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [workspaceId, type, text, priority || 10]
      );
      return (result as any).insertId;
    });

    res.status(201).json({
      success: true,
      message: 'Instruction added successfully',
      data: { instructionId }
    });

  } catch (error) {
    console.error('[Workspace] Add instruction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add instruction'
    });
  }
});

/**
 * DELETE /api/workspace/:id/instructions/:instructionId
 * Delete custom instruction
 */
router.delete('/:id/instructions/:instructionId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const workspaceId = parseInt(req.params.id);
    const instructionId = parseInt(req.params.instructionId);

    // Verify ownership
    const hasAccess = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT wi.instruction_id 
         FROM workspace_instructions wi
         JOIN user_workspaces w ON wi.workspace_id = w.workspace_id
         WHERE wi.instruction_id = ? AND wi.workspace_id = ? AND w.user_id = ?`,
        [instructionId, workspaceId, userId]
      );
      return Array.isArray(rows) && rows.length > 0;
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await withDbConnection(async (conn) => {
      await conn.query(
        'UPDATE workspace_instructions SET is_active = 0, updated_at = NOW() WHERE instruction_id = ?',
        [instructionId]
      );
    });

    res.json({
      success: true,
      message: 'Instruction deleted successfully'
    });

  } catch (error) {
    console.error('[Workspace] Delete instruction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete instruction'
    });
  }
});

export default router;

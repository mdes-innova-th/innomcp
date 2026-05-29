import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../../../utils/jwt';
import { withDbConnection } from '../../../utils/db';
import { logAdminAction } from '../../../utils/adminAuditLog';
import sessionsRouter from './sessions';

const adminRouter = Router();

// All admin routes require authentication + admin role (role ID 0)
adminRouter.use(authenticateToken, requireRole(0));

// Phase 8: Session management routes
adminRouter.use('/sessions', sessionsRouter);

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT user_id, user_dispname, user_email, userrole_id, user_active, created_at
         FROM \`user\`
         ORDER BY user_id ASC`
      );
      return rows;
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('[Admin] GET /users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Change a user's role (admin only)
 * Body: { roleId: number }
 */
adminRouter.patch('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { roleId } = req.body;

    if (isNaN(targetId) || typeof roleId !== 'number') {
      res.status(400).json({ success: false, error: 'Invalid userId or roleId' });
      return;
    }

    // Prevent self-demotion
    if (req.user && req.user.userId === targetId && roleId !== 0) {
      res.status(400).json({ success: false, error: 'Cannot change your own admin role' });
      return;
    }

    const result = await withDbConnection(async (conn) => {
      const [info] = await conn.query(
        'UPDATE `user` SET userrole_id = ? WHERE user_id = ?',
        [roleId, targetId]
      );
      return info as { affectedRows: number };
    });

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (req.user) {
      await logAdminAction({
        adminUserId: req.user.userId,
        action: 'user_role_change',
        targetUserId: targetId,
        meta: { roleId },
      });
    }

    res.json({ success: true, message: `User ${targetId} role updated to ${roleId}` });
  } catch (error) {
    console.error('[Admin] PATCH /users/:id/role error:', error);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

/**
 * PATCH /api/admin/users/:id/active
 * Toggle user active status (admin only)
 * Body: { active: boolean }
 */
adminRouter.patch('/users/:id/active', async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { active } = req.body;

    if (isNaN(targetId) || typeof active !== 'boolean') {
      res.status(400).json({ success: false, error: 'Invalid userId or active value' });
      return;
    }

    // Prevent self-deactivation
    if (req.user && req.user.userId === targetId && !active) {
      res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
      return;
    }

    const result = await withDbConnection(async (conn) => {
      const [info] = await conn.query(
        'UPDATE `user` SET user_active = ? WHERE user_id = ?',
        [active ? 1 : 0, targetId]
      );
      return info as { affectedRows: number };
    });

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (req.user) {
      await logAdminAction({
        adminUserId: req.user.userId,
        action: 'user_active_change',
        targetUserId: targetId,
        meta: { active },
      });
    }

    res.json({ success: true, message: `User ${targetId} active set to ${active}` });
  } catch (error) {
    console.error('[Admin] PATCH /users/:id/active error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user status' });
  }
});

/**
 * GET /api/admin/audit-log?limit=20&offset=0
 * Retrieve paginated admin audit log entries (admin only)
 */
adminRouter.get('/audit-log', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10) || 20, 100);
    const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;

    const { entries, total } = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT
           a.id,
           a.created_at,
           a.admin_user_id,
           u.user_email   AS admin_email,
           a.action,
           a.target_user_id AS target_id,
           a.meta         AS details
         FROM admin_audit_log a
         LEFT JOIN \`user\` u ON u.user_id = a.admin_user_id
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const [[countRow]] = await conn.query(
        'SELECT COUNT(*) AS total FROM admin_audit_log'
      ) as any;

      return { entries: rows, total: (countRow as any).total as number };
    });

    const mapped = (entries as any[]).map((row) => ({
      id:         row.id,
      timestamp:  row.created_at,
      adminEmail: row.admin_email ?? null,
      adminUserId: row.admin_user_id,
      action:     row.action,
      targetId:   row.target_id ?? null,
      details:    typeof row.details === 'string'
                    ? (() => { try { return JSON.parse(row.details); } catch { return row.details; } })()
                    : row.details ?? null,
    }));

    res.json({
      success: true,
      entries: mapped,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('[Admin] GET /audit-log error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit log' });
  }
});

export default adminRouter;

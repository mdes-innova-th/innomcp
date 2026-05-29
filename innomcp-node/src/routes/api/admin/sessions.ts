/**
 * Phase 8: Admin Session Management Routes
 *
 * All routes are mounted at /api/admin/sessions and inherit the
 * authenticateToken + requireRole(0) guards applied by the parent admin router.
 *
 * Endpoints:
 *   GET    /api/admin/sessions              — list all active sessions
 *   DELETE /api/admin/sessions/:jti        — revoke a specific session by JTI
 *   DELETE /api/admin/sessions/user/:userId — revoke all sessions for a user
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../../../utils/jwt';
import * as sessionRegistry from '../../../services/sessionRegistry';
import { logAdminAction } from '../../../utils/adminAuditLog';

const sessionsRouter = Router();

/**
 * GET /api/admin/sessions
 * List all active (non-revoked) sessions across all users.
 */
sessionsRouter.get('/', (req: AuthRequest, res: Response) => {
  try {
    const sessions = sessionRegistry.listAll();

    res.json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    console.error('[Admin] GET /sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to list sessions' });
  }
});

/**
 * DELETE /api/admin/sessions/:jti
 * Revoke a specific session by its JWT ID.
 *
 * The targeted user will receive a 401 on their next request,
 * forcing them to log in again.
 */
sessionsRouter.delete('/:jti', async (req: AuthRequest, res: Response) => {
  try {
    const { jti } = req.params;

    if (!jti || typeof jti !== 'string') {
      res.status(400).json({ success: false, error: 'Invalid jti parameter' });
      return;
    }

    // Fetch session before revoking so we can include userId in audit log
    const allSessions = sessionRegistry.listAll();
    const target = allSessions.find((s) => s.jti === jti);

    if (!target) {
      res.status(404).json({ success: false, error: 'Session not found or already revoked' });
      return;
    }

    // Prevent an admin from revoking their own current session via this endpoint
    // (they can still self-logout via /api/auth/logout)
    if (req.user && target.userId === req.user.userId) {
      res.status(400).json({
        success: false,
        error: 'Cannot revoke your own session via admin endpoint. Use /api/auth/logout instead.',
      });
      return;
    }

    const revoked = sessionRegistry.revoke(jti);

    if (revoked && req.user) {
      await logAdminAction({
        adminUserId: req.user.userId,
        action: 'session_revoke',
        targetUserId: target.userId,
        meta: { jti, email: target.email },
      });
    }

    res.json({
      success: true,
      message: `Session ${jti} revoked`,
      data: { jti, userId: target.userId, email: target.email },
    });
  } catch (error) {
    console.error('[Admin] DELETE /sessions/:jti error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
});

/**
 * DELETE /api/admin/sessions/user/:userId
 * Revoke all active sessions for a specific user (bulk force-logout).
 *
 * Useful when an account is compromised or a user is deactivated.
 * Route must be declared BEFORE /:jti to avoid Express matching "user" as a jti.
 */
sessionsRouter.delete('/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      res.status(400).json({ success: false, error: 'Invalid userId parameter' });
      return;
    }

    // Prevent self-lockout
    if (req.user && userId === req.user.userId) {
      res.status(400).json({
        success: false,
        error: 'Cannot revoke all your own sessions via admin endpoint. Use /api/auth/logout instead.',
      });
      return;
    }

    const count = sessionRegistry.revokeAllForUser(userId);

    if (req.user) {
      await logAdminAction({
        adminUserId: req.user.userId,
        action: 'session_revoke_all_for_user',
        targetUserId: userId,
        meta: { sessionsRevoked: count },
      });
    }

    res.json({
      success: true,
      message: `Revoked ${count} session(s) for user ${userId}`,
      data: { userId, sessionsRevoked: count },
    });
  } catch (error) {
    console.error('[Admin] DELETE /sessions/user/:userId error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke user sessions' });
  }
});

export default sessionsRouter;

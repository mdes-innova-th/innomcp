/**
 * src/middleware/roleGuard.ts
 *
 * Role-based access guard for INNOMCP routes.
 *
 * DB role convention (userrole_id in `user` table):
 * ┌─────────────┬────────────────────────────────────────────────────┐
 * │ userRoleId  │ Meaning                                            │
 * ├─────────────┼────────────────────────────────────────────────────┤
 * │     0       │ Admin — full access, highest privilege             │
 * │     1       │ Power user — elevated access                       │
 * │     2       │ Normal user — default for new registrations        │
 * │  undefined  │ Guest (unauthenticated) — most restricted          │
 * └─────────────┴────────────────────────────────────────────────────┘
 *
 * IMPORTANT: Lower roleId = more privilege (admin = 0, guest = no ID).
 * This is the OPPOSITE of the common "0=guest, 2=admin" pattern.
 *
 * Usage:
 *   import { requireRole, ROLE } from '../middleware/roleGuard';
 *   import { requireAuth }       from '../middleware/auth';
 *
 *   // Admin-only route
 *   router.delete('/users/:id', requireAuth, requireRole(ROLE.ADMIN), handler);
 *
 *   // Power user and above (roleId <= 1)
 *   router.post('/export', requireAuth, requireRole(ROLE.POWER_USER), handler);
 *
 *   // Any authenticated user (roleId <= 2, i.e. all registered users)
 *   router.get('/profile', requireAuth, requireRole(ROLE.USER), handler);
 */

import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../utils/jwt';

// ── Role constants ────────────────────────────────────────────────────────────

/**
 * Named role thresholds.
 * A user passes `requireRole(threshold)` when `user.userRoleId <= threshold`.
 */
export const ROLE = {
  /** roleId 0 — admins only */
  ADMIN: 0,
  /** roleId <= 1 — admins + power users */
  POWER_USER: 1,
  /** roleId <= 2 — any registered user (default) */
  USER: 2,
} as const;

// ── Middleware factory ────────────────────────────────────────────────────────

/**
 * requireRole(maxRoleId)
 *
 * Returns a middleware that rejects the request with 403 when the authenticated
 * user's roleId is GREATER than `maxRoleId` (less privileged).
 *
 * Must be used AFTER `requireAuth` (or `authenticateToken`) so that `req.user`
 * is already populated.
 *
 * @param maxRoleId  Maximum (least-privileged) roleId allowed.
 *                   Use the `ROLE` constants for readability.
 *
 * @example
 *   // Only admins (roleId === 0)
 *   router.use(requireAuth, requireRole(ROLE.ADMIN));
 *
 *   // Any authenticated user (roleId 0, 1, or 2)
 *   router.use(requireAuth, requireRole(ROLE.USER));
 */
export function requireRole(maxRoleId: number) {
  return function roleGuard(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const user = req.user;

    if (!user) {
      // requireRole must be used after requireAuth; reaching here without a
      // user means the middleware chain is misconfigured.
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No authenticated user on request — ensure requireAuth runs before requireRole',
      });
      return;
    }

    if (user.userRoleId > maxRoleId) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires roleId <= ${maxRoleId} (your roleId: ${user.userRoleId})`,
        required: maxRoleId,
        actual: user.userRoleId,
      });
      return;
    }

    next();
  };
}

/**
 * src/middleware/auth.ts
 *
 * Thin convenience re-exports from utils/jwt so route files can import auth
 * middleware from a predictable middleware path without duplicating logic.
 *
 * All implementation lives in utils/jwt.ts — do not copy it here.
 *
 * Usage:
 *   import { requireAuth, optionalAuth } from '../middleware/auth';
 *   router.get('/protected', requireAuth, handler);
 *   router.get('/public',    optionalAuth, handler);
 *
 * After `requireAuth`, `req.user` is guaranteed to be a valid JWTPayload:
 *   { userId, userEmail, userRoleId, userDispName }
 *
 * After `optionalAuth`, `req.user` is set only when a valid token was present.
 */

export {
  authenticateToken as requireAuth,
  optionalAuth,
  type AuthRequest,
  type JWTPayload,
} from '../utils/jwt';

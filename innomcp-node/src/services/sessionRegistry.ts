/**
 * Phase 8: Session Registry — in-memory store for active JWT sessions.
 *
 * Sessions are keyed by jti (JWT ID), which must be embedded in every token
 * at sign time. The registry supports:
 *   - register()     — called once at login
 *   - touch()        — updates lastSeen on every authenticated request
 *   - revoke()       — invalidates a session (force-logout)
 *   - isRevoked()    — checked by authenticateToken middleware
 *   - listForUser()  — list all sessions for one user
 *   - listAll()      — admin view of every active session
 *
 * NOTE: This is a single-process in-memory store. For multi-instance deployments,
 * replace the Map with a shared store (Redis, etc.).
 */

export interface SessionEntry {
  jti: string;
  userId: number;
  email: string;
  loginAt: Date;
  lastSeen: Date;
  userAgent: string;
  ip: string;
}

// Active sessions keyed by jti
const activeSessions = new Map<string, SessionEntry>();

// Revoked jtis — kept so a revoked token cannot be re-registered under the same jti
const revokedSet = new Set<string>();

/**
 * Register a new session on login.
 * Called after a token is signed so jti is known.
 */
export function register(
  jti: string,
  data: Omit<SessionEntry, 'jti' | 'loginAt' | 'lastSeen'>
): void {
  const now = new Date();
  activeSessions.set(jti, {
    jti,
    ...data,
    loginAt: now,
    lastSeen: now,
  });
}

/**
 * Update lastSeen for an active session.
 * Called on every authenticated request via middleware.
 */
export function touch(jti: string): void {
  const session = activeSessions.get(jti);
  if (session) {
    session.lastSeen = new Date();
  }
}

/**
 * Revoke a session by jti (force-logout).
 * Subsequent isRevoked() calls will return true.
 */
export function revoke(jti: string): boolean {
  const existed = activeSessions.has(jti);
  activeSessions.delete(jti);
  revokedSet.add(jti);
  return existed;
}

/**
 * Check whether a jti has been revoked.
 * Used by authenticateToken middleware to reject invalidated tokens.
 */
export function isRevoked(jti: string): boolean {
  return revokedSet.has(jti);
}

/**
 * List all active (non-revoked) sessions for a specific user.
 */
export function listForUser(userId: number): SessionEntry[] {
  const result: SessionEntry[] = [];
  for (const session of activeSessions.values()) {
    if (session.userId === userId) {
      result.push({ ...session });
    }
  }
  return result;
}

/**
 * List every active session across all users (admin view).
 */
export function listAll(): SessionEntry[] {
  return Array.from(activeSessions.values()).map((s) => ({ ...s }));
}

/**
 * Revoke all active sessions for a specific user.
 * Returns the count of sessions revoked.
 */
export function revokeAllForUser(userId: number): number {
  let count = 0;
  for (const [jti, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(jti);
      revokedSet.add(jti);
      count++;
    }
  }
  return count;
}

/**
 * src/routes/api/presence.ts — Multi-user Presence REST API (Phase 8)
 *
 * GET  /api/presence/:projectId        — list active users in a project (public)
 * POST /api/presence/:projectId/ping   — heartbeat to keep presence alive (requires auth)
 * POST /api/presence/:projectId/leave  — explicit leave (requires auth)
 *
 * Mounted in app.ts at:
 *   app.use("/api/presence", generalRateLimit, presenceRouter);
 *
 * Design notes:
 *  - GET is intentionally unauthenticated so dashboards / guests can see occupancy.
 *  - POST /ping requires JWT auth (requireAuth) — the user info is taken from the
 *    verified token, not from the request body, so it cannot be spoofed.
 *  - displayName falls back to userEmail when userDispName is absent.
 */

import { Router, Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import {
  getPresence,
  join,
  leave,
  type PresenceEntry,
} from "../../services/presenceService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseProjectId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/presence/:projectId
 *
 * Returns the list of users currently active in the given project.
 *
 * Response 200:
 * {
 *   projectId: number,
 *   count: number,
 *   users: PresenceEntry[]   // { userId, displayName, connectedAt, lastPingAt }
 * }
 *
 * Response 400: invalid projectId
 */
router.get("/:projectId", (req: AuthRequest, res: Response) => {
  const projectId = parseProjectId(req.params.projectId);
  if (projectId === null) {
    return res.status(400).json({ error: "projectId must be a positive integer" });
  }

  const users: PresenceEntry[] = getPresence(projectId);
  return res.json({ projectId, count: users.length, users });
});

/**
 * POST /api/presence/:projectId/ping
 *
 * Heartbeat endpoint — keeps the caller's presence entry alive.
 * Client should call this every ~30 seconds to avoid being reaped (60 s TTL).
 *
 * Requires: Authorization: Bearer <jwt>
 *
 * Response 200:
 * {
 *   projectId: number,
 *   userId: number,
 *   displayName: string,
 *   connectedAt: string,   // ISO-8601 — original join time
 *   lastPingAt: string     // ISO-8601 — just-updated
 * }
 *
 * Response 400: invalid projectId
 * Response 401: missing / invalid token
 */
router.post("/:projectId/ping", requireAuth, (req: AuthRequest, res: Response) => {
  const projectId = parseProjectId(req.params.projectId);
  if (projectId === null) {
    return res.status(400).json({ error: "projectId must be a positive integer" });
  }

  const { userId, userDispName, userEmail } = req.user!;
  const displayName = userDispName || userEmail;

  join(projectId, userId, displayName);

  // Return the caller's refreshed presence entry
  const entry = getPresence(projectId).find((u) => u.userId === userId);
  return res.json({ projectId, ...entry });
});

/**
 * POST /api/presence/:projectId/leave
 *
 * Explicit leave — removes the caller from the project room immediately.
 * Clients should call this on tab-close / logout rather than waiting for TTL.
 *
 * Requires: Authorization: Bearer <jwt>
 *
 * Response 200:
 * { projectId: number, userId: number, left: true }
 *
 * Response 400: invalid projectId
 * Response 401: missing / invalid token
 */
router.post("/:projectId/leave", requireAuth, (req: AuthRequest, res: Response) => {
  const projectId = parseProjectId(req.params.projectId);
  if (projectId === null) {
    return res.status(400).json({ error: "projectId must be a positive integer" });
  }

  const { userId } = req.user!;
  leave(projectId, userId);

  return res.json({ projectId, userId, left: true });
});

export default router;

/**
 * src/services/presenceService.ts — Multi-user Presence Service (Phase 8)
 *
 * Tracks which users are currently active in each project using an in-memory Map.
 * Designed for REST-first integration — no direct WebSocket coupling here.
 *
 * Data is volatile: restarts clear all presence. Use heartbeat pings (POST
 * /api/presence/:projectId/ping) to keep entries alive; stale entries are pruned
 * automatically by the reaper interval.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresenceEntry {
  userId: number;
  displayName: string;
  connectedAt: string; // ISO-8601
  lastPingAt: string;  // ISO-8601 — updated on every ping
}

// ─── In-memory store ──────────────────────────────────────────────────────────

/**
 * projectPresence: projectId → Set of active PresenceEntry objects.
 *
 * We use a Map of Maps rather than a Map of Sets because PresenceEntry is an
 * object; identity-based Set membership would not deduplicate by userId.
 * Inner map key: userId (number → string key for reliable Map lookup).
 */
const projectPresence = new Map<number, Map<string, PresenceEntry>>();

// Entries older than STALE_THRESHOLD_MS without a ping are pruned by the reaper.
const STALE_THRESHOLD_MS = 60_000; // 60 seconds

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * join — Add or refresh a user's presence in a project room.
 */
export function join(projectId: number, userId: number, displayName: string): void {
  if (!projectPresence.has(projectId)) {
    projectPresence.set(projectId, new Map());
  }

  const room = projectPresence.get(projectId)!;
  const key = String(userId);
  const now = new Date().toISOString();

  if (room.has(key)) {
    // Refresh existing entry rather than resetting connectedAt
    const existing = room.get(key)!;
    room.set(key, { ...existing, displayName, lastPingAt: now });
  } else {
    room.set(key, { userId, displayName, connectedAt: now, lastPingAt: now });
  }
}

/**
 * leave — Remove a user from a project room.
 */
export function leave(projectId: number, userId: number): void {
  const room = projectPresence.get(projectId);
  if (!room) return;

  room.delete(String(userId));

  // Clean up empty rooms to avoid memory growth
  if (room.size === 0) {
    projectPresence.delete(projectId);
  }
}

/**
 * ping — Refresh the lastPingAt timestamp for an existing entry.
 * If the user is not yet joined, this acts as an implicit join.
 */
export function ping(projectId: number, userId: number, displayName: string): void {
  join(projectId, userId, displayName);
}

/**
 * getPresence — Return the list of active PresenceEntry objects for a project.
 * Returns an empty array when no one is active or the project is unknown.
 */
export function getPresence(projectId: number): PresenceEntry[] {
  const room = projectPresence.get(projectId);
  if (!room) return [];
  return Array.from(room.values());
}

/**
 * broadcast — Send a JSON message to all active WebSocket clients in a project.
 *
 * This function accepts a map of WebSocket clients keyed by userId so it can be
 * wired up from the chat route without importing ws internals here.
 * Kept as a pure utility so the presence service has no direct WebSocket dep.
 *
 * @param projectId      Target project room
 * @param message        Serialisable payload
 * @param clientMap      Map<userId, WebSocket-like> — provided by caller
 */
export function broadcast(
  projectId: number,
  message: unknown,
  clientMap: Map<number, { readyState: number; send: (data: string) => void }>
): void {
  const room = projectPresence.get(projectId);
  if (!room) return;

  const payload = JSON.stringify(message);

  for (const entry of room.values()) {
    const ws = clientMap.get(entry.userId);
    // readyState 1 === WebSocket.OPEN
    if (ws && ws.readyState === 1) {
      try {
        ws.send(payload);
      } catch {
        // Ignore send errors — client likely disconnected; reaper will clean up
      }
    }
  }
}

// ─── Stale-entry Reaper ───────────────────────────────────────────────────────

/**
 * Periodically remove entries that have not pinged within STALE_THRESHOLD_MS.
 * Runs every 30 seconds; automatically clears empty rooms.
 */
function reapStaleEntries(): void {
  const cutoff = Date.now() - STALE_THRESHOLD_MS;

  for (const [projectId, room] of projectPresence.entries()) {
    for (const [key, entry] of room.entries()) {
      if (new Date(entry.lastPingAt).getTime() < cutoff) {
        room.delete(key);
      }
    }
    if (room.size === 0) {
      projectPresence.delete(projectId);
    }
  }
}

// Start reaper — unref() so it does not keep the process alive in tests
const reaperInterval = setInterval(reapStaleEntries, 30_000);
if (typeof reaperInterval.unref === "function") {
  reaperInterval.unref();
}

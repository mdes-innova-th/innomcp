/**
 * src/services/roomService.ts — WebSocket Project Room Service (Phase 9)
 *
 * Manages which WebSocket clients are connected to which project rooms.
 * Integrates with presenceService for REST-visible presence state.
 *
 * Rooms are keyed by projectId (number). Each room is a Set of live WebSocket
 * connections. When a client disconnects, leaveRoom() removes it and updates
 * the presence layer.
 */

import { WebSocket } from "ws";
import * as presenceService from "./presenceService";

// ─── Room Map ─────────────────────────────────────────────────────────────────

/**
 * projectRooms: projectId → Set of connected WebSocket clients.
 * One project can have many simultaneous WS connections.
 */
const projectRooms = new Map<number, Set<WebSocket>>();

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getOrCreateRoom(projectId: number): Set<WebSocket> {
  if (!projectRooms.has(projectId)) {
    projectRooms.set(projectId, new Set());
  }
  return projectRooms.get(projectId)!;
}

function cleanupRoom(projectId: number): void {
  const room = projectRooms.get(projectId);
  if (room && room.size === 0) {
    projectRooms.delete(projectId);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * joinRoom — Add a WebSocket client to a project room.
 *
 * Also calls presenceService.join() so the user appears in REST presence
 * queries, then broadcasts a `user_joined` event to all other room members.
 */
export function joinRoom(
  projectId: number,
  ws: WebSocket,
  userId: number,
  displayName: string
): void {
  const room = getOrCreateRoom(projectId);
  room.add(ws);

  // Update REST-visible presence
  presenceService.join(projectId, userId, displayName);

  // Notify everyone else in the room
  broadcastToRoom(
    projectId,
    { type: "user_joined", userId, displayName },
    ws // exclude the joining client itself
  );
}

/**
 * leaveRoom — Remove a WebSocket client from a project room.
 *
 * Calls presenceService.leave() and broadcasts `user_left` to remaining members.
 * Safe to call multiple times for the same ws (Set.delete is idempotent).
 */
export function leaveRoom(
  projectId: number,
  ws: WebSocket,
  userId: number
): void {
  const room = projectRooms.get(projectId);
  if (!room) return;

  room.delete(ws);

  // Update REST-visible presence
  presenceService.leave(projectId, userId);

  // Notify remaining members
  broadcastToRoom(projectId, { type: "user_left", userId });

  cleanupRoom(projectId);
}

/**
 * broadcastToRoom — Send a JSON-serialisable message to all clients in a room.
 *
 * @param projectId   Target project room
 * @param message     Any JSON-serialisable value
 * @param excludeWs   Optional: skip this specific client (e.g. the sender)
 */
export function broadcastToRoom(
  projectId: number,
  message: unknown,
  excludeWs?: WebSocket
): void {
  const room = projectRooms.get(projectId);
  if (!room) return;

  const payload = JSON.stringify(message);

  for (const client of room) {
    if (client === excludeWs) continue;
    // WebSocket.OPEN === 1
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {
        // Client likely closed mid-send; leaveRoom will handle cleanup
      }
    }
  }
}

/**
 * getRoomSize — Return the number of currently-connected clients in a room.
 */
export function getRoomSize(projectId: number): number {
  return projectRooms.get(projectId)?.size ?? 0;
}

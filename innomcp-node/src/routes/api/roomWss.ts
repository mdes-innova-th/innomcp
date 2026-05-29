/**
 * src/routes/api/roomWss.ts — WebSocket Project Room Handler (Phase 9)
 *
 * Provides a dedicated WebSocket namespace for real-time project room events:
 * presence join/leave and typing indicators.
 *
 * Connection URL: ws://<host>:<port>/room?projectId=<id>&token=<JWT>
 *
 * Message protocol (client → server):
 *   { type: "typing_start" }
 *   { type: "typing_stop" }
 *
 * Message protocol (server → client, broadcast):
 *   { type: "user_joined",  userId: number, displayName: string }
 *   { type: "user_left",    userId: number }
 *   { type: "typing_start", userId: number, displayName: string }
 *   { type: "typing_stop",  userId: number }
 *
 * Authentication: Bearer JWT passed as `?token=` query param (httpOnly cookies
 * are not forwarded by all WS client libs). Token is verified with verifyToken()
 * from utils/jwt. Unauthenticated connections are rejected with close code 4001.
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { URL } from "url";
import { verifyToken } from "../../utils/jwt";
import * as roomService from "../../services/roomService";
import logger from "../../utils/logger";

// ─── Exported WebSocketServer instance ───────────────────────────────────────

/**
 * roomWSS — noServer mode so server.ts controls the upgrade handshake,
 * matching the pattern used by chatWSS.
 */
export const roomWSS = new WebSocketServer({ noServer: true });

// ─── Connection Handler ───────────────────────────────────────────────────────

roomWSS.on(
  "connection",
  (ws: WebSocket, request: http.IncomingMessage) => {
    // Parse query params from the upgrade URL
    // request.url is relative (e.g. "/room?projectId=5&token=eyJ...")
    const reqUrl = new URL(request.url || "/", "http://localhost");
    const rawProjectId = reqUrl.searchParams.get("projectId");
    const token = reqUrl.searchParams.get("token");

    // ── Auth & param validation ───────────────────────────────────────────────

    if (!token) {
      logger.warn("[roomWss] Rejected: no token provided");
      ws.close(4001, "Unauthorized: token required");
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      logger.warn("[roomWss] Rejected: invalid or expired token");
      ws.close(4001, "Unauthorized: invalid token");
      return;
    }

    const projectId = rawProjectId ? parseInt(rawProjectId, 10) : NaN;
    if (!rawProjectId || isNaN(projectId) || projectId <= 0) {
      logger.warn("[roomWss] Rejected: missing or invalid projectId");
      ws.close(4002, "Bad Request: projectId required");
      return;
    }

    const userId = payload.userId;
    const displayName = payload.userDispName || payload.userEmail || String(userId);

    logger.info(
      `[roomWss] User ${userId} (${displayName}) joined project room ${projectId}`
    );

    // ── Join room ─────────────────────────────────────────────────────────────

    roomService.joinRoom(projectId, ws, userId, displayName);

    // ── Message handler ───────────────────────────────────────────────────────

    ws.on("message", (raw: Buffer | string) => {
      let parsed: { type?: string } | null = null;

      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        // Ignore non-JSON frames
        return;
      }

      if (!parsed || typeof parsed.type !== "string") return;

      switch (parsed.type) {
        case "typing_start":
          roomService.broadcastToRoom(
            projectId,
            { type: "typing_start", userId, displayName },
            ws // exclude sender
          );
          break;

        case "typing_stop":
          roomService.broadcastToRoom(
            projectId,
            { type: "typing_stop", userId },
            ws // exclude sender
          );
          break;

        default:
          // Unknown message types are silently dropped
          break;
      }
    });

    // ── Close / cleanup ───────────────────────────────────────────────────────

    ws.on("close", () => {
      logger.info(
        `[roomWss] User ${userId} left project room ${projectId}`
      );
      roomService.leaveRoom(projectId, ws, userId);
    });

    ws.on("error", (err: Error) => {
      logger.warn(`[roomWss] Socket error for user ${userId}: ${err.message}`);
      // `close` event fires after `error`, so leaveRoom is handled there
    });
  }
);

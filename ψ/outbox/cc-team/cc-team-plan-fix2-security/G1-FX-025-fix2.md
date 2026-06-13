<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-025 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3031,"completion_tokens":8000,"total_tokens":11031,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6800,"image_tokens":0},"cache_creation_input_tokens":0} | 74s
 generated: 2026-06-13T11:47:07.893Z -->
FILE: innomcp-node/src/services/wsEnhancer.ts
<<<<<<< SEARCH
import { WebSocketServer, WebSocket } from "ws";
=======
import { WebSocketServer, WebSocket } from "ws";
import jwt from 'jsonwebtoken';
>>>>>>> REPLACE

FILE: innomcp-node/src/services/wsEnhancer.ts
<<<<<<< SEARCH
export class WSEnhancer {
  // Room membership by clientId
=======
export class WSEnhancer {
  private static readonly MAX_QUEUE_SIZE = 100;
  // Room membership by clientId
>>>>>>> REPLACE

FILE: innomcp-node/src/services/wsEnhancer.ts
<<<<<<< SEARCH
  private clientIds = new WeakMap<WebSocket, string>();
=======
  private clientIds = new WeakMap<WebSocket, string>();
  private roomAccessList = new Map<string, Set<string>>();
>>>>>>> REPLACE

FILE: innomcp-node/src/services/wsEnhancer.ts
<<<<<<< SEARCH
  private handleClientMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const { type, clientId, roomId } = message;

      if (type === "register" && clientId && typeof clientId === "string") {
        this.registerClient(ws, clientId);
        return;
      }

      if (type === "join" && roomId && typeof roomId === "string") {
        this.joinRoom(ws, roomId);
      }
    } catch {
      // Ignore non-JSON messages
    }
  }
=======
  private handleClientMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const { type, clientId, roomId, token } = message;

      if (type === "register" && clientId && typeof clientId === "string") {
        if (clientId.length > 256) {
          this.sendSystemMessage(ws, "Client ID too long");
          return;
        }
        this.registerClient(ws, clientId, token);
        return;
      }

      if (type === "join" && roomId && typeof roomId === "string") {
        if (roomId.length > 256) {
          this.sendSystemMessage(ws, "Room ID too long");
          return;
        }
        this.joinRoom(ws, roomId);
      }
    } catch {
      // Ignore non-JSON messages
    }
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/wsEnhancer.ts
<<<<<<< SEARCH
  private registerClient(ws: WebSocket, clientId: string): void {
    const existingClientId = this.clientIds.get(ws);
    if (existingClientId) {
      // Already registered, update if needed
      if (existingClientId !== clientId) {
        // Clean up old registration
        this.connectedClients.delete(existingClientId);
        this.removeFromAllRooms(ws);
      }
    }

    // Set the clientId on this ws
    this.clientIds.set(ws, clientId);
    this.connectedClients.set(clientId, ws);

    // Re-join any rooms the client was a member of before disconnecting
    const previousRooms = this.clientRooms.get(clientId);
    if (previousRooms) {
      for (const roomId of previousRooms) {
        this.joinRoom(ws, roomId);
      }
    } else {
      this.clientRooms.set(clientId, new Set());
    }

    // Flush message queue
    const queue = this.messageQueues.get(clientId);
    if (queue && queue.length > 0) {
      for (const msg of queue) {
        this.sendToSocket(ws, msg);
      }
      this.messageQueues.delete(clientId);
    }

    // Send completion system message
    this.sendSystemMessage(ws, "เชื่อมต่อสำเร็จ");
  }
=======
  private registerClient(ws: WebSocket, clientId: string, token?: string): void {
    if (!token || !this.verifyClientToken(clientId, token)) {
      this.sendSystemMessage(ws, "Authentication failed");
      return;
    }

    const existingClientId = this.clientIds.get(ws);
    if (existingClientId) {
      // Already registered, update if needed
      if (existingClientId !== clientId) {
        // Clean up old registration
        this.connectedClients.delete(existingClientId);
        this.removeFromAllRooms(ws);
      }
    }

    // Set the clientId on this ws
    this.clientIds.set(ws, clientId);
    this.connectedClients.set(clientId, ws);

    // Re-join any rooms the client was a member of before disconnecting
    const previousRooms = this.clientRooms.get(clientId);
    if (previousRooms) {
      for (const roomId of previousRooms) {
        this.joinRoom(ws, roomId);
      }
    } else {
      this.clientRooms.set(clientId, new Set());
    }

    // Flush message queue
    const queue = this.messageQueues.get(clientId);
    if (queue && queue.length > 0) {
      for (const msg of queue) {
        this.sendToSocket(ws, msg);
      }
      this.messageQueues.delete(clientId);
    }

    // Send completion system message
    this.sendSystemMessage(ws, "เชื่อมต่อ

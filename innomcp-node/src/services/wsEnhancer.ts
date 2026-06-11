// @ts-nocheck
import { WebSocketServer, WebSocket } from "ws";

interface HeartbeatInfo {
  lastPong: number;
  interval: NodeJS.Timeout;
}

export class WSEnhancer {
  // Room membership by clientId
  private clientRooms = new Map<string, Set<string>>();
  private roomClients = new Map<string, Set<string>>();

  // Client identification and connection tracking
  private clientIds = new WeakMap<WebSocket, string>();
  private connectedClients = new Map<string, WebSocket>();

  // Message queue for disconnected clients
  private messageQueues = new Map<string, unknown[]>();

  // Heartbeat tracking
  private heartbeats = new WeakMap<WebSocket, HeartbeatInfo>();

  // Metrics
  private messageTimestamps: number[] = [];

  attachToServer(wss: WebSocketServer): void {
    wss.on("connection", (ws: WebSocket) => {
      this.setupConnection(ws);
    });
  }

  private setupConnection(ws: WebSocket): void {
    // Start heartbeat
    const info: HeartbeatInfo = {
      lastPong: Date.now(),
      interval: setInterval(() => {
        if (Date.now() - (this.heartbeats.get(ws)?.lastPong ?? 0) > 60_000) {
          ws.terminate();
          return;
        }
        ws.ping();
      }, 30_000),
    };
    this.heartbeats.set(ws, info);

    // Send initial Thai system message
    this.sendSystemMessage(ws, "กำลังเชื่อมต่อ...");

    // Listen for messages
    ws.on("message", (data: Buffer) => {
      this.handleClientMessage(ws, data);
    });

    // Listen for pong
    ws.on("pong", () => {
      const heartbeat = this.heartbeats.get(ws);
      if (heartbeat) {
        heartbeat.lastPong = Date.now();
      }
    });

    // Cleanup on close
    ws.on("close", () => {
      const heartbeat = this.heartbeats.get(ws);
      if (heartbeat) {
        clearInterval(heartbeat.interval);
        this.heartbeats.delete(ws);
      }

      const clientId = this.clientIds.get(ws);
      if (clientId) {
        // Mark as disconnected but keep room membership and queue future messages
        this.connectedClients.delete(clientId);
        this.clientIds.delete(ws);
        // Remove ws from rooms (clientId remains in roomClients set)
        this.removeFromAllRooms(ws);
      }
      // Note: connections metric handled via connectedClients.size
    });

    // Track initial connection (without clientId yet)
    // Connections count derived from connectedClients map size after identification
  }

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

  private removeFromAllRooms(ws: WebSocket): void {
    const clientId = this.clientIds.get(ws);
    if (!clientId) return;

    const rooms = this.clientRooms.get(clientId);
    if (!rooms) return;

    for (const roomId of rooms) {
      const clientsInRoom = this.roomClients.get(roomId);
      if (clientsInRoom) {
        clientsInRoom.delete(clientId);
        if (clientsInRoom.size === 0) {
          this.roomClients.delete(roomId);
        }
      }
    }
  }

  private sendSystemMessage(ws: WebSocket, message: string): void {
    const payload = JSON.stringify({ type: "system", message });
    ws.send(payload);
  }

  private sendToSocket(ws: WebSocket, message: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    ws.send(payload);
  }

  broadcast(message: unknown, except?: WebSocket): void {
    // This broadcasts to all connected websockets (not filtered by clientId)
    // We'll iterate over the connectedClients map to get all currently open websockets
    // Note: The original requirement might intend to broadcast to all connected clients across rooms.
    // We'll use all active WebSocket instances that are connected.
    let sentCount = 0;
    for (const [, ws] of this.connectedClients) {
      if (ws !== except && ws.readyState === WebSocket.OPEN) {
        this.sendToSocket(ws, message);
        sentCount++;
      }
    }
    if (sentCount > 0) {
      this.messageTimestamps.push(Date.now());
    }
  }

  sendToRoom(roomId: string, message: unknown): void {
    const clientSet = this.roomClients.get(roomId);
    if (!clientSet || clientSet.size === 0) return;

    let sentCount = 0;
    for (const clientId of clientSet) {
      const ws = this.connectedClients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendToSocket(ws, message);
        sentCount++;
      } else {
        // Queue the message for this disconnected client
        const queue = this.messageQueues.get(clientId) || [];
        queue.push(message);
        this.messageQueues.set(clientId, queue);
      }
    }
    if (sentCount > 0) {
      this.messageTimestamps.push(Date.now());
    }
  }

  joinRoom(ws: WebSocket, roomId: string): void {
    const clientId = this.clientIds.get(ws);
    if (!clientId) {
      // Client not yet identified; ignore for now.
      return;
    }

    // Ensure clientRooms set exists
    let rooms = this.clientRooms.get(clientId);
    if (!rooms) {
      rooms = new Set();
      this.clientRooms.set(clientId, rooms);
    }
    rooms.add(roomId);

    // Ensure roomClients set exists
    let clients = this.roomClients.get(roomId);
    if (!clients) {
      clients = new Set();
      this.roomClients.set(roomId, clients);
    }
    clients.add(clientId);

    // Optional: send system message
    // this.sendSystemMessage(ws, "เข้าร่วมห้องสำเร็จ");
  }

  getStats(): { connections: number; rooms: number; messagesPerMin: number } {
    const now = Date.now();
    // Remove timestamps older than 60 seconds
    this.messageTimestamps = this.messageTimestamps.filter(ts => now - ts <= 60_000);
    return {
      connections: this.connectedClients.size,
      rooms: this.roomClients.size,
      messagesPerMin: this.messageTimestamps.length,
    };
  }
}

export const wsEnhancer = new WSEnhancer();
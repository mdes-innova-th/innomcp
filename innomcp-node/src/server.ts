import { createServer as createHttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import url from "url";
import app from "./app";
import "dotenv/config";
import { fetchDashboardStats } from "./utils/wsurlstats";
import { dbNotifyDashb } from "./utils/dbNotifyDashb";
import { binlogReader } from "./utils/binlogReader";

// ใช้ 0.0.0.0 เป็นค่าเริ่มต้นเพื่อให้รับการเชื่อมต่อจากทุก network interface (สำคัญสำหรับ Docker)
const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3001", 10);

console.log(
  `[server] Starting server in ${process.env.NODE_ENV || "development"} mode`
);
console.log(
  `[server] Server host: ${host} (0.0.0.0 means listening on all network interfaces)`
);
console.log(`[server] HTTP port: ${port}`);

// Create HTTP server using the Express app
const httpServer = createHttpServer(app);

// Create WebSocket server
const wss = new WebSocketServer({
  noServer: true, // We'll handle the upgrade ourselves
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    concurrencyLimit: 10,
    threshold: 1024,
  },
});

console.log("[server] WebSocket server created");

// Store active connections
const clients = new Map();
// Store dashboard clients separately
const dashboardClients = new Map();

// Handle WebSocket connection
httpServer.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url || "").pathname;
  console.log(`[server] WebSocket upgrade request for: ${pathname}`);
  console.log(`[server] Request headers:`, request.headers);

  // Accept both the API-prefixed path and the legacy plain path. pathname includes the leading '/'.
  if (pathname === "/api/wsurlstats" || pathname === "/ws") {
    // Accept /api/wsurlstats and /ws for dashboard websocket
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, "ws-dashboard");
    });
  } else {
    console.log(`[server] Rejecting WebSocket connection to: ${pathname}`);
    socket.destroy();
  }
});

// Handle WebSocket connections
wss.on("connection", (ws: WebSocket, request: any, connectionType: string) => {
  const id = Date.now().toString();
  console.log(
    `[server] New WebSocket client connected: ${id}, Type: ${connectionType}`
  );
  console.log(`[server] Headers received:`, request.headers);

  if (connectionType === "ws-dashboard") {
    // Store the dashboard client connection
    dashboardClients.set(id, ws);

    // Register with notification service
    dbNotifyDashb.addClient(id, ws, "ws-dashboard");
  }

  // Create a simplified interface for compatibility with existing code
  const socketAdapter = {
    id,
    emit: (event: string, data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      }
    },
    handshake: {
      headers: request.headers,
    },
  };

  // Handle messages
  ws.on("message", async (message: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log(
        `[server] Received message from client ${id}:`,
        parsedMessage
      );

      if (connectionType === "ws-dashboard") {
        // Handle dashboard-specific messages
        if (parsedMessage.type === "requestUpdate") {
          // Manually refresh dashboard data
          await sendDashboardData(ws);
          console.log(`[server] Sent dashboard update to client ${id}`);
        }
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  // Handle disconnection
  ws.on("close", () => {
    console.log(`[server] Client disconnected: ${id}`);

    // Remove from notification service
    dbNotifyDashb.removeClient(id);

    if (connectionType === "ws-dashboard") {
      dashboardClients.delete(id);
    } else {
      clients.delete(id);
    }
  });

  // Handle errors
  ws.on("error", (error: Error) => {
    console.error(`WebSocket error for ${id}:`, error);
  });
});

// Function to send dashboard data to a client
async function sendDashboardData(ws: WebSocket) {
  try {
    const dashboardData = await fetchDashboardStats();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          event: "dashboardUpdate",
          data: dashboardData,
        })
      );
    }
  } catch (error) {
    console.error("Error sending dashboard data:", error);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          event: "error",
          data: { message: "Failed to fetch dashboard data" },
        })
      );
    }
  }
}

// Function to broadcast dashboard updates to all connected dashboard clients
try {
  // Start HTTP server
  httpServer.listen(port, host, () => {
    console.log(`[server] HTTP server listening on http://${host}:${port}`);
    console.log(`[server] WebSocket server listening on ws://${host}:${port}`);

    // เริ่มต้น MariaDB binary log reader
    console.log(`[server] Starting MariaDB binary log reader...`);
    binlogReader.start().catch((error) => {
      console.error("Failed to start binary log reader:", error);
    });
  });
} catch (error) {
  console.error("catch-Error starting server:", error);
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[server] SIGTERM signal received: closing HTTP server");
  try {
    await binlogReader.stop();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err?: Error) => {
        if (err) return reject(err);
        console.log("[server] HTTP server closed");
        resolve();
      });
    });
  } catch (err) {
    console.error("Error during graceful shutdown (SIGTERM):", err);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("[server] SIGINT signal received: closing HTTP server");
  try {
    await binlogReader.stop();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err?: Error) => {
        if (err) return reject(err);
        console.log("[server] HTTP server closed");
        resolve();
      });
    });
  } catch (err) {
    console.log("[server] Error during graceful shutdown (SIGINT):", err);
    console.error("Error during graceful shutdown (SIGINT):", err);
    process.exit(1);
  }
});

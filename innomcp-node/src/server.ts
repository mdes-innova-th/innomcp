import "dotenv/config";
import http from "http";
import net from "net";
import { URL } from "url";
import dotenv from "dotenv";

import logger from "./utils/logger";
import { logBoth } from "./utils/mcpLogger";

import app from "./app";
import { wss as chatWSS, mcpClient, toolHealthChecker } from "./routes/api/chat";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3011", 10);

const server = http.createServer(app);

// Phase 18: EADDRINUSE protection — fail fast with clear message
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    const msg = `❌ Port ${port} is already in use. Stop the existing process or set SERVER_PORT env var.`;
    logger.error(msg);
    console.error(msg);
    console.error(`   Hint: netstat -ano | grep ":${port}" to find the process, then taskkill /F /PID <pid>`);
  } else {
    logger.error(`Server error: ${err.message}`);
    console.error(`Server error:`, err);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  logger.info(`🚀 Backend Server running on http://${host}:${port}`);
  logger.info(`🔌 WebSocket server listening on ws://${host}:${port}/chat`);
  logBoth("info", `Server is running on http://${host}:${port}`);
});

server.on("upgrade", (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const pathname = new URL(request.url || "/", `http://${host}:${port}`).pathname;

  if (pathname === "/chat") {
    chatWSS.handleUpgrade(request, socket, head, (ws) => {
      chatWSS.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server and cleaning up`);
  
  // Stop tool health checks
  if (toolHealthChecker) {
    try {
      toolHealthChecker.stopHealthChecks();
      logger.info("Tool health checks stopped");
    } catch (err) {
      logger.error("Error stopping tool health checks:", err);
    }
  }
  
  // Stop MCP health checks
  if (mcpClient) {
    try {
      mcpClient.stopHealthCheck();
      logger.info("MCP health check stopped");
    } catch (err) {
      logger.error("Error stopping MCP health check:", err);
    }
  }
  
  // Close WebSocket connections
  chatWSS.clients.forEach((client) => {
    client.close();
  });
  
  // Close HTTP server
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default server;

// Trigger restart: DB_NAME fix - 15:38:42

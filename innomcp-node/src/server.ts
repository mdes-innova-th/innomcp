import "dotenv/config";
import http from "http";
import net from "net";
import { URL } from "url";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import logger from "./utils/logger";
import { logBoth } from "./utils/mcpLogger";
import { initMemoryRag } from "./services/memoryRagHook";
import { initializeDatabaseSchema } from "./utils/db";

import { hydrateStore } from "./providers/registry";
import app from "./app";
import { wss as chatWSS, mcpClient, toolHealthChecker } from "./routes/api/chat";
import { roomWSS } from "./routes/api/roomWss";
import { assertProductionJwtSecret } from "./utils/config/security";
import { runProbe } from "./services/providerHealthProbe";

dotenv.config();

const CRASH_LOG_PATH = path.join(__dirname, "..", "..", "logs", "backend-crash.log");

process.on("uncaughtException", (err: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] UNCAUGHT EXCEPTION:\n${err.stack || err}\n\n`;
  try {
    fs.appendFileSync(CRASH_LOG_PATH, logMessage);
  } catch (e) {
    console.error("Failed to write to crash log:", e);
  }
  logger.error(`💥 Uncaught Exception: ${err.message}\nStack: ${err.stack}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] UNHANDLED REJECTION:\n${reason.stack || reason}\nPromise: ${promise}\n\n`;
  try {
    fs.appendFileSync(CRASH_LOG_PATH, logMessage);
  } catch (e) {
    console.error("Failed to write to crash log:", e);
  }
  logger.error(`⚠️ Unhandled Rejection: ${reason.message || reason}\nStack: ${reason.stack}`);
});

// Guard: refuse to start in production with a weak or placeholder JWT_SECRET.

assertProductionJwtSecret(process.env.NODE_ENV, process.env.JWT_SECRET);

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

const startServer = async () => {
  try {
    await initializeDatabaseSchema();
    logger.info("🛠️ Database schema initialization complete");
  } catch (err: any) {
    logger.warn(`⚠️ Database schema initialization failed: ${err?.message ?? err}`);
  }

  server.listen(port, host, () => {
    logger.info(`🚀 Backend Server running on http://${host}:${port}`);
    logger.info(`🔌 WebSocket server listening on ws://${host}:${port}/chat`);
    logBoth("info", `Server is running on http://${host}:${port}`);

    // Memory + RAG: Initialize cold retriever corpus
    initMemoryRag().then((r) => {
      logBoth("info", `📚 Cold RAG ready: ${r.docCount} docs, ${r.chunkCount} chunks`);
    }).catch((err) => {
      logBoth("warn", `⚠️ Cold RAG init failed: ${err.message}`);
    });

    // Phase 24: Preflight dependency check — warn engineers about missing services
    const preflightCheck = async () => {
      const deps = [
        { name: "MCP Server", port: parseInt(process.env.MCP_SERVER_PORT || "3012", 10), critical: true },
        { name: "Detect-Evidence-API", port: parseInt(process.env.EVIDENCE_API_PORT || "3013", 10), critical: false },
        { name: "Webd-API", port: parseInt(process.env.WEBD_API_PORT || "3014", 10), critical: false },
      ];
      for (const dep of deps) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          await fetch(`http://localhost:${dep.port}/health`, { signal: controller.signal }).catch(() =>
            fetch(`http://localhost:${dep.port}/`, { signal: controller.signal })
          );
          clearTimeout(timer);
          logBoth("info", `✅ Preflight: ${dep.name} (port ${dep.port}) — reachable`);
        } catch {
          const level = dep.critical ? "error" : "warn";
          const icon = dep.critical ? "❌" : "⚠️";
          logBoth(level, `${icon} Preflight: ${dep.name} (port ${dep.port}) — NOT reachable${dep.critical ? " (CRITICAL — MCP-dependent routes will fail)" : ""}`);
        }
      }
    };
    preflightCheck().catch(() => {});

    // Fire provider health probe after 3s to let DB and other services init first
    setTimeout(() => {
      runProbe().catch((err) => {
        console.warn("[providerHealthProbe] startup probe failed:", err instanceof Error ? err.message : String(err));
      });
    }, 3000);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

server.on("upgrade", (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const pathname = new URL(request.url || "/", `http://${host}:${port}`).pathname;

  if (pathname === "/chat") {
    chatWSS.handleUpgrade(request, socket, head, (ws) => {
      chatWSS.emit("connection", ws, request);
    });
  } else if (pathname === "/room") {
    roomWSS.handleUpgrade(request, socket, head, (ws) => {
      roomWSS.emit("connection", ws, request);
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

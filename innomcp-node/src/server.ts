import "dotenv/config";
import http from "http";
import net from "net";
import { URL } from "url";
import dotenv from "dotenv";

import logger from "./utils/logger";
import { logBoth } from "./utils/mcpLogger";

import app from "./app";
import { wss as chatWSS } from "./routes/api/chat";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3011", 10);

const server = http.createServer(app);

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

export default server;

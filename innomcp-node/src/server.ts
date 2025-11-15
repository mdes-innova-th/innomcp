import "dotenv/config";
import http from "http";
import net from "net";
import url from "url";
import dotenv from "dotenv";

import app from "./app";
import { wss as chatWSS } from "./routes/api/chat";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3011", 10);

const server = http.createServer(app);

server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
  console.log(`[server] WebSocket server is listening on ws://${host}:${port}/chat`);
});

server.on("upgrade", (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const pathname = url.parse(request.url || "").pathname;

  if (pathname === "/chat") {
    chatWSS.handleUpgrade(request, socket, head, (ws) => {
      chatWSS.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

export default server;

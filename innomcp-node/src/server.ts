import { createServer as createHttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import url from "url";
import "dotenv/config";

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3001", 10);

console.log(`[server] Starting WebSocket server on ws://${host}:${port}`);

// Create HTTP server
const httpServer = createHttpServer();

// Create WebSocket server
const wss = new WebSocketServer({
  noServer: true,
});

httpServer.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url || "").pathname;
  if (pathname === "/chat") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket) => {
  console.log(`[server] New WebSocket connection established`);

  ws.on("message", (message) => {
    console.log(`[server] Received message:`, message.toString());
    // Echo the message back to the client
    ws.send(message);
  });

  ws.on("close", () => {
    console.log(`[server] WebSocket connection closed`);
  });

  ws.on("error", (error) => {
    console.error(`[server] WebSocket error:`, error);
  });
});

httpServer.listen(port, host, () => {
  console.log(
    `[server] WebSocket server is listening on ws://${host}:${port}/chat`
  );
});

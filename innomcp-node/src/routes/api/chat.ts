import { Router } from "express";
import { WebSocketServer } from "ws";

const chatRouter = Router();

// In-memory storage for chat messages
const messages: { sender: string; text: string }[] = [];

// WebSocket server for chat
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  console.log("[Chat API] New WebSocket connection established");

  // Send existing messages to the new client
  ws.send(JSON.stringify({ type: "history", messages }));

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    console.log("[Chat API] Received message:", message);

    // Add the message to the in-memory storage
    messages.push(message);

    // Broadcast the message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === ws.OPEN) {
        client.send(JSON.stringify({ type: "new_message", message }));
      }
    });
  });

  ws.on("close", () => {
    console.log("[Chat API] WebSocket connection closed");
  });
});

// HTTP endpoint to handle WebSocket upgrade
chatRouter.get("/ws", (req, res) => {
  res.status(400).send("WebSocket endpoint. Please connect via WebSocket.");
});

export { chatRouter, wss };

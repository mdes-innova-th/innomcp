import { Router } from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { Ollama } from "ollama";

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST || "localhost";
const OLLAMA_PORT = process.env.OLLAMA_PORT || "11434";

const ollama = new Ollama({ host: `${OLLAMA_HOST}:${OLLAMA_PORT}` });
const ollamaModel = process.env.OLLAMA_MODEL || "llama2";

const chatRouter = Router();

// In-memory storage for chat messages
const messages: { sender: string; text: string }[] = [];

// WebSocket server for chat with proper configuration
const wss = new WebSocketServer({
  noServer: true,
  verifyClient: (info: any) => {
    // Allow connections from allowed origins
    const origin = info.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(",") || [
      "http://localhost:3001",
    ];

    console.log(`[WebSocket] Connection attempt from origin: ${origin}`);

    if (!origin || allowedOrigins.includes(origin)) {
      return true;
    }

    console.log(`[WebSocket] Rejected connection from origin: ${origin}`);
    return false;
  },
});

wss.on("connection", (ws) => {
  console.log("[Chat API] New WebSocket connection established");

  // Send existing messages to the new client
  if (messages.length > 0) {
    ws.send(JSON.stringify({ type: "history", messages }));
  }

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("[Chat API] Received message:", message);

      // Validate message structure
      if (!message.text || typeof message.text !== "string") {
        console.warn("[Chat API] Invalid message structure:", message);
        ws.send(JSON.stringify({ error: "Invalid message structure" }));
        return;
      }

      // Add the user message to the in-memory storage
      messages.push(message);

      // Use Ollama for AI response (send word by word)
      try {
        const responseStream = await ollama.chat({
          model: ollamaModel,
          messages: [{ role: "user", content: message.text }],
          stream: true,
        });

        let aiResponse = "";
        let lastWordIndex = 0;

        for await (const chunk of responseStream) {
          if (!chunk.message || !chunk.message.content) continue;
          aiResponse += chunk.message.content;
          // แยกคำใหม่ที่เพิ่งเพิ่ม
          const words = aiResponse.split(/(\s+)/); // split by whitespace, keep spaces
          const newWords = words.slice(lastWordIndex);
          lastWordIndex = words.length;
          // ส่งเฉพาะคำใหม่ (รวมเว้นวรรค) ไปยัง client
          if (newWords.length > 0) {
            ws.send(JSON.stringify({ type: "word", text: newWords.join("") }));
          }
        }
      } catch (ollamaError) {
        console.error("[Chat API] Ollama error:", ollamaError);
        ws.send(
          JSON.stringify({ error: "Failed to get response from AI model" })
        );
        return;
      }
    } catch (error) {
      console.error("[Chat API] Error parsing message:", error);
      ws.send(JSON.stringify({ error: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    console.log("[Chat API] WebSocket connection closed");
  });

  ws.on("error", (error) => {
    console.error("[Chat API] WebSocket error:", error);
  });
});

chatRouter.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log(">>>>>Received chat message:", message);

    const response = await ollama.chat({
      model: ollamaModel,
      messages: [{ role: "user", content: message }],
    });

    console.log("<<<<<Ollama response:", response);

    res.json({ text: response.message.content });
  } catch (error) {
    console.error("Error handling chat message:", error);
    res.status(500).json({ error: "Failed to process the message" });
  }
});

// HTTP endpoint to handle WebSocket upgrade
chatRouter.get("/ws", (req, res) => {
  res.status(400).send("WebSocket endpoint. Please connect via WebSocket.");
});

export { chatRouter, wss };

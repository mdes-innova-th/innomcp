import { Router } from "express";
import { WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";

dotenv.config();

const chatRouter = Router();

// In-memory storage for chat messages
const messages: { sender: string; text: string }[] = [];

// WebSocket server for chat with proper configuration
const wss = new WebSocketServer({ 
  noServer: true,
  verifyClient: (info: any) => {
    // Allow connections from allowed origins
    const origin = info.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(",") || ["http://localhost:3001"];
    
    console.log(`[WebSocket] Connection attempt from origin: ${origin}`);
    
    if (!origin || allowedOrigins.includes(origin)) {
      return true;
    }
    
    console.log(`[WebSocket] Rejected connection from origin: ${origin}`);
    return false;
  }
});

wss.on("connection", (ws) => {
  console.log("[Chat API] New WebSocket connection established");

  // Send existing messages to the new client
  if (messages.length > 0) {
    ws.send(JSON.stringify({ type: "history", messages }));
  }

  ws.on("message", (data) => {
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

      // Simulate AI response
      setTimeout(() => {
        const aiResponse = {
          sender: "ai",
          text: `AI Response to: "${message.text}". This is a simulated response from the AI system.`
        };

        // Add AI response to messages
        messages.push(aiResponse);

        // Send AI response back to the client in the expected format
        console.log("[Chat API] Sending AI response:", aiResponse);
        ws.send(JSON.stringify({ text: aiResponse.text }));
      }, 1000); // 1 second delay to simulate AI processing
      
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

const OLLAMA_HOST = process.env.OLLAMA_HOST || "localhost";
const OLLAMA_PORT = process.env.OLLAMA_PORT || "11434";
// Define a route to handle chat messages
chatRouter.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const model = process.env.OLLAMA_MODEL || "default-model"; // Use environment variable or default model

    // Send the message to the AI via OLLAMA_HOST using native HTTP
    const requestOptions = {
      hostname: OLLAMA_HOST,
      port: parseInt(OLLAMA_PORT),
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const reqToAI = http.request(requestOptions, (responseFromAI) => {
      let responseData = "";

      responseFromAI.on("data", (chunk) => {
        responseData += chunk;
      });

      responseFromAI.on("end", () => {
        try {
          const aiResponse = JSON.parse(responseData);
          if (aiResponse && aiResponse.response) {
            res.json({ text: aiResponse.response });
          } else {
            console.error("Unexpected AI response format:", aiResponse);
            res.status(500).json({ error: "Unexpected response format from AI" });
          }
        } catch (error) {
          console.error("Error parsing AI response:", error);
          res.status(500).json({ error: "Invalid response from AI" });
        }
      });
    });

    reqToAI.on("error", (error) => {
      console.error("Error communicating with AI:", error);
      res.status(500).json({ error: "Failed to communicate with AI" });
    });

    reqToAI.write(JSON.stringify({ input: message, model })); // Include model in the request body
    reqToAI.end();
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

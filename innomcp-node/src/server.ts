import { createServer as createHttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import url from "url";
import "dotenv/config";
import express from "express";
import http from "http";
import dotenv from "dotenv";
import net from "net";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3010", 10);
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

console.log(`[server] Starting WebSocket server on ws://${host}:${port}`);

// Ensure 'app' is properly defined
const app = express();

// Create HTTP server
const httpServer = app.listen(port, host, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`[server] WebSocket server is listening on ws://${host}:${port}/chat`);
});

// Create WebSocket server
const wss = new WebSocketServer({
  noServer: true,
});

wss.on("connection", (ws: WebSocket) => {
  console.log(`[server] New WebSocket connection established`);

  ws.on("message", async (data) => {
    try {
      console.log("Received message:", data.toString());
      const { text } = JSON.parse(data.toString());

      if (!text) {
        ws.send(JSON.stringify({ error: "Message text is required" }));
        return;
      }

      // Forward the message to the AI service using native HTTP
      const requestOptions = {
        hostname: new URL(OLLAMA_HOST).hostname,
        port: new URL(OLLAMA_HOST).port || 80,
        path: "/api/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = http.request(requestOptions, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            const aiResponse = JSON.parse(responseData);
            ws.send(JSON.stringify({ text: aiResponse.text }));
          } catch (error) {
            console.error("Error parsing AI response:", error);
            ws.send(JSON.stringify({ error: "Invalid response from AI" }));
          }
        });
      });

      req.on("error", (error) => {
        console.error("Error communicating with AI:", error);
        ws.send(JSON.stringify({ error: "Failed to communicate with AI" }));
      });

      req.write(JSON.stringify({ input: text }));
      req.end();
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      ws.send(JSON.stringify({ error: "Failed to process the message" }));
    }
  });

  ws.on("close", () => {
    console.log(`[server] WebSocket connection closed`);
  });

  ws.on("error", (error) => {
    console.error(`[server] WebSocket error:`, error);
  });
});

httpServer.on("upgrade", (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const pathname = url.parse(request.url || "").pathname;
  if (pathname === "/chat") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Express fallback route
app.get("/", (req: express.Request, res: express.Response) => {
  res.send("WebSocket server is running.");
});

// Define a route to handle chat messages via HTTP POST
app.post("/api/chat", (req: express.Request, res: express.Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Send the message to the AI service using native HTTP
    const requestOptions = {
      hostname: new URL(OLLAMA_HOST).hostname,
      port: new URL(OLLAMA_HOST).port || 80,
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
          res.json({ text: aiResponse.text });
        } catch (error) {
          console.error("Error parsing AI response:", error, "Response Data:", responseData);
          res.status(500).json({ error: "Invalid response from AI" });
        }
      });
    });

    reqToAI.on("error", (error) => {
      console.error("Error communicating with AI:", error);
      res.status(500).json({
        error: "Failed to communicate with AI",
        details: error.message,
      });
    });

    reqToAI.write(JSON.stringify({ input: message }));
    reqToAI.end();
  } catch (error) {
    console.error("Error handling chat message:", error);
    res.status(500).json({ error: "Failed to process the message" });
  }
});

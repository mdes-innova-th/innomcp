import { Router } from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { Ollama } from "ollama";
import { InitMcpClient, IntelligentMCPClient } from "../../utils/mcpclient";

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST || "localhost";
const OLLAMA_PORT = process.env.OLLAMA_PORT || "11434";

const ollama = new Ollama({ host: `${OLLAMA_HOST}:${OLLAMA_PORT}` });
const ollamaModel = process.env.OLLAMA_MODEL || "llama2";

const chatRouter = Router();

// In-memory storage for chat messages
const messages: { sender: string; text: string }[] = [];

// WebSocket connection id counter
let wsConnectionIdCounter = 0;

// Initialize intelligent MCP client
let mcpClient: IntelligentMCPClient | null = null;

// Initialize MCP Client (returns immediately; initialization runs in background)
mcpClient = InitMcpClient(ollama, ollamaModel);
console.log("[Chat API] MCP client created (initializing in background)");

if (mcpClient) {
  mcpClient.on("clientConnected", (name: string) => {
    console.log("[Chat API] MCP client connected:", name);
    console.log(
      "[Chat API] Connected clients:",
      mcpClient?.getConnectedClients()
    );
  });

  mcpClient.on("connectedClients", (clients: string[]) => {
    console.log("[Chat API] Connected clients (update):", clients);
  });

  mcpClient.on("toolLoaded", (info: { client: string; tool: string }) => {
    console.log(`[Chat API] Tool loaded from ${info.client}: ${info.tool}`);
  });

  mcpClient.on("ready", () => {
    console.log("[Chat API] Intelligent MCP Client initialization completed");
    console.log(
      "[Chat API] Available tools:",
      mcpClient?.getAvailableTools().length
    );
  });

  // Also log the current connected clients immediately so we see state
  // even if some clients connected before listeners were attached.
  try {
    console.log(
      "[Chat API] Connected clients (initial):",
      mcpClient.getConnectedClients()
    );
  } catch (e) {
    // ignore
  }
}

// WebSocket server for chat with proper configuration
const wss = new WebSocketServer({
  noServer: true,
  verifyClient: (info: any) => {
    // Allow connections from allowed origins
    const origin = info.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(",") || [
      "http://localhost:3000",
    ];

    console.log(`[WebSocket] Connection attempt from origin: ${origin}`);

    if (!origin || allowedOrigins.includes(origin)) {
      return true;
    }

    console.log(`[WebSocket] Rejected connection from origin: ${origin}`);
    return false;
  },
});

// Server-side heartbeat: ping clients periodically and terminate dead ones.
// This helps keep connections alive across proxies and lets us detect dead peers.
const heartbeatInterval = 30000; // 30s
const pingInterval = setInterval(() => {
  wss.clients.forEach((client: any) => {
    // If client has no isAlive flag or it is false, terminate it
    if (client.isAlive === false) {
      console.log('[WebSocket] Terminating unresponsive client');
      try {
        client.terminate();
      } catch (e) {
        // ignore
      }
      return;
    }

    // Mark as not alive and send a ping; a healthy browser client will automatically reply with a pong
    client.isAlive = false;
    try {
      client.ping();
    } catch (e) {
      // ignore ping errors
    }
  });
}, heartbeatInterval);

// Clear interval on process exit to avoid leaks
process.on("exit", () => clearInterval(pingInterval));
process.on("SIGINT", () => {
  clearInterval(pingInterval);
  process.exit();
});

wss.on("connection", (ws) => {
  // mark connection as alive; will be toggled by the ping interval
  (ws as any).isAlive = true;
  ws.on("pong", () => {
    try {
      (ws as any).isAlive = true;
    } catch (e) {
      // ignore
    }
  });
  const connectionId = ++wsConnectionIdCounter;
  // Log connection id and current connected clients count
  console.log(
    `[Chat API] New WebSocket connection established (id=${connectionId}) - total=${wss.clients.size}`
  );

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

      let finalMessage = message.text;
      let mcpContext = "";

      // Process message with intelligent MCP client
      if (mcpClient) {
        console.log("[Chat API] Processing message with MCP client...");
        try {
          const mcpResult = await mcpClient.processMessage(message.text);

          if (mcpResult.needsTools) {
            console.log(
              "[Chat API] MCP tools executed:",
              mcpResult.toolResults?.length
            );

            // Send MCP processing status to client
            ws.send(
              JSON.stringify({
                type: "mcp-status",
                text: "กำลังประมวลผลด้วย MCP tools...",
                tools: mcpResult.toolResults?.map((r) => r.toolName) || [],
              })
            );

            // Use enhanced context for Ollama
            if (mcpResult.enhancedContext) {
              finalMessage = mcpResult.enhancedContext;
              mcpContext = " (ใช้ข้อมูลจาก MCP tools)";
            }
          }
        } catch (mcpError) {
          console.error("[Chat API] MCP processing error:", mcpError);
          // Continue with original message if MCP fails
        }
      }

      // Use Ollama for AI response (send word by word)
      try {
        const responseStream = await ollama.chat({
          model: ollamaModel,
          messages: [{ role: "user", content: finalMessage }],
          stream: true,
        });

        let aiResponse = "";
        let lastWordIndex = 0;
        let isFirstChunk = true;

        for await (const chunk of responseStream) {
          if (!chunk.message || !chunk.message.content) continue;

          // Add MCP context indicator to first chunk
          if (isFirstChunk && mcpContext) {
            ws.send(JSON.stringify({ type: "mcp-context", text: mcpContext }));
            isFirstChunk = false;
          }

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
    console.log(
      `[Chat API] WebSocket connection closed (id=${connectionId}) - total=${wss.clients.size}`
    );
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

    let finalMessage = message;
    let mcpResults = null;

    // Process message with intelligent MCP client
    if (mcpClient) {
      try {
        const mcpResult = await mcpClient.processMessage(message);

        if (mcpResult.needsTools) {
          console.log(
            "[Chat API] MCP tools executed for POST:",
            mcpResult.toolResults?.length
          );
          mcpResults = mcpResult.toolResults;

          // Use enhanced context for Ollama
          if (mcpResult.enhancedContext) {
            finalMessage = mcpResult.enhancedContext;
          }
        }
      } catch (mcpError) {
        console.error("[Chat API] MCP processing error in POST:", mcpError);
        // Continue with original message if MCP fails
      }
    }

    const response = await ollama.chat({
      model: ollamaModel,
      messages: [{ role: "user", content: finalMessage }],
    });

    console.log("<<<<<Ollama response:", response);

    res.json({
      text: response.message.content,
      mcpUsed: mcpResults ? true : false,
      mcpResults: mcpResults,
    });
  } catch (error) {
    console.error("[Chat API] Error handling chat message:", error);
    res.status(500).json({ error: "Failed to process the message" });
  }
});

// HTTP endpoint to handle WebSocket upgrade
chatRouter.get("/ws", (req, res) => {
  res.status(400).send("WebSocket endpoint. Please connect via WebSocket.");
});

// Endpoint to get available MCP tools
chatRouter.get("/mcp/tools", (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({
      error: "MCP client not initialized",
      available: false,
    });
  }

  const tools = mcpClient.getAvailableTools();
  const clients = mcpClient.getConnectedClients();

  res.json({
    available: true,
    clients: clients,
    toolsCount: tools.length,
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      keywords: tool.keywords,
      examples: tool.examples,
    })),
  });
});

export { chatRouter, wss };

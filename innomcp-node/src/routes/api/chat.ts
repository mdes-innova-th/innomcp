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

// In-memory storage for chat messages keyed by sessionId (string).
const sessionMessagesById: Map<string, { sender: string; text: string }[]> =
  new Map();
const connectionSessionMap: Map<number, string> = new Map();

let wsConnectionIdCounter = 0;
let mcpClient: IntelligentMCPClient | null = null;

// Initialize MCP Client
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

  try {
    console.log(
      "[Chat API] Connected clients (initial):",
      mcpClient.getConnectedClients()
    );
  } catch (e) {
    // ignore
  }
}

// WebSocket server
const wss = new WebSocketServer({
  noServer: true,
  verifyClient: (info: any) => {
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

// Heartbeat
const heartbeatInterval = 30000;
const pingInterval = setInterval(() => {
  wss.clients.forEach((client: any) => {
    if (client.isAlive === false) {
      console.log("[WebSocket] Terminating unresponsive client");
      try {
        client.terminate();
      } catch (e) {
        // ignore
      }
      return;
    }
    client.isAlive = false;
    try {
      client.ping();
    } catch (e) {
      // ignore
    }
  });
}, heartbeatInterval);

process.on("exit", () => clearInterval(pingInterval));
process.on("SIGINT", () => {
  clearInterval(pingInterval);
  process.exit();
});

wss.on("connection", (ws) => {
  (ws as any).isAlive = true;
  ws.on("pong", () => {
    try {
      (ws as any).isAlive = true;
    } catch (e) {
      // ignore
    }
  });

  const connectionId = ++wsConnectionIdCounter;
  const ephemeralSessionId = `conn-${connectionId}`;
  connectionSessionMap.set(connectionId, ephemeralSessionId);
  sessionMessagesById.set(ephemeralSessionId, []);

  console.log(
    `[Chat API] New WebSocket connection (id=${connectionId}) - total=${wss.clients.size}`
  );

  // Send existing messages
  const currentSessionId = connectionSessionMap.get(connectionId) as string;
  const messages = sessionMessagesById.get(currentSessionId) || [];
  if (messages.length > 0) {
    ws.send(JSON.stringify({ type: "history", messages }));
  }

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("[Chat API] Received message:", message);

      // Handle init message
      if (
        message.type === "init" &&
        message.sessionId &&
        typeof message.sessionId === "string"
      ) {
        const providedId = message.sessionId.trim();
        console.log(
          `[Chat API] Client requested sessionId=${providedId} (conn=${connectionId})`
        );

        const currentEphemeralId =
          connectionSessionMap.get(connectionId) || ephemeralSessionId;
        const ephemeralHistory =
          sessionMessagesById.get(currentEphemeralId) || [];
        const existing = sessionMessagesById.get(providedId) || [];

        if (ephemeralHistory.length > 0 && existing.length === 0) {
          sessionMessagesById.set(providedId, ephemeralHistory.slice());
        } else {
          sessionMessagesById.set(providedId, existing);
        }

        connectionSessionMap.set(connectionId, providedId);

        const hist = sessionMessagesById.get(providedId) || [];
        if (hist.length > 0) {
          ws.send(JSON.stringify({ type: "history", messages: hist }));
        }

        ws.send(JSON.stringify({ type: "init-ack", sessionId: providedId }));
        return;
      }

      // Validate message
      if (!message.text || typeof message.text !== "string") {
        console.warn("[Chat API] Invalid message structure:", message);
        ws.send(JSON.stringify({ error: "Invalid message structure" }));
        return;
      }

      // ✅ Get session and history
      const sessionId =
        connectionSessionMap.get(connectionId) || ephemeralSessionId;
      let sessionHistory = sessionMessagesById.get(sessionId);
      if (!sessionHistory) {
        sessionHistory = [];
        sessionMessagesById.set(sessionId, sessionHistory);
      }

      // ✅ Add user message
      sessionHistory.push({ sender: "user", text: message.text });
      console.log(
        `[Chat API] Session ${sessionId} history: ${sessionHistory.length} messages (before AI response)`
      );

      let finalMessage = message.text;
      let mcpContext = "";

      // Process with MCP
      if (mcpClient) {
        console.log("[Chat API] Processing message with MCP client...");
        try {
          const mcpResult = await mcpClient.processMessage(message.text);

          if (mcpResult.needsTools) {
            console.log(
              "[Chat API] MCP tools executed:",
              mcpResult.toolResults?.length
            );

            ws.send(
              JSON.stringify({
                type: "mcp-status",
                text: "กำลังประมวลผลด้วย MCP tools...",
                tools: mcpResult.toolResults?.map((r) => r.toolName) || [],
              })
            );

            if (mcpResult.enhancedContext) {
              finalMessage = mcpResult.enhancedContext;
              mcpContext = " (ใช้ข้อมูลจาก MCP tools)";
            }
          }
        } catch (mcpError) {
          console.error("[Chat API] MCP processing error:", mcpError);
        }
      }

      // ✅ Use Ollama with full history
      try {
        // Map history to Ollama format
        const ollamaMessages = sessionHistory.map((m) => ({
          role: m.sender === "ai" ? "assistant" : "user",
          content: m.text,
        }));

        // Update last message if MCP enhanced it
        if (finalMessage !== message.text && ollamaMessages.length > 0) {
          const lastMsg = ollamaMessages[ollamaMessages.length - 1];
          if (lastMsg.role === "user") {
            lastMsg.content = finalMessage;
          }
        }

        console.log(
          `[Chat API] 📤 Sending ${ollamaMessages.length} messages to Ollama`
        );
        console.log(
          `[Chat API] Messages breakdown:`,
          ollamaMessages.map(
            (m) => `${m.role}: ${m.content.substring(0, 50)}...`
          )
        );

        const responseStream = await ollama.chat({
          model: ollamaModel,
          messages: ollamaMessages,
          stream: true,
        });

        let aiResponse = "";
        let lastWordIndex = 0;
        let isFirstChunk = true;

        for await (const chunk of responseStream) {
          if (!chunk.message || !chunk.message.content) continue;

          if (isFirstChunk && mcpContext) {
            ws.send(JSON.stringify({ type: "mcp-context", text: mcpContext }));
            isFirstChunk = false;
          }

          aiResponse += chunk.message.content;
          const words = aiResponse.split(/(\s+)/);
          const newWords = words.slice(lastWordIndex);
          lastWordIndex = words.length;

          if (newWords.length > 0) {
            ws.send(JSON.stringify({ type: "word", text: newWords.join("") }));
          }
        }

        // ✅ Add AI response to history
        sessionHistory.push({ sender: "ai", text: aiResponse });
        console.log(
          `[Chat API] ✅ Session ${sessionId} now has ${sessionHistory.length} messages (after AI response)`
        );
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
      `[Chat API] WebSocket closed (id=${connectionId}) - total=${wss.clients.size}`
    );
    connectionSessionMap.delete(connectionId);
  });

  ws.on("error", (error) => {
    console.error("[Chat API] WebSocket error:", error);
  });
});

// POST endpoint with history support
chatRouter.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log(">>>>>Received chat message:", message);

    const effectiveSessionId = sessionId || `http-${Date.now()}`;

    let sessionHistory = sessionMessagesById.get(effectiveSessionId);
    if (!sessionHistory) {
      sessionHistory = [];
      sessionMessagesById.set(effectiveSessionId, sessionHistory);
    }

    sessionHistory.push({ sender: "user", text: message });
    console.log(
      `[Chat API] POST: Session ${effectiveSessionId} history: ${sessionHistory.length} messages (before AI)`
    );

    let finalMessage = message;
    let mcpResults = null;

    if (mcpClient) {
      try {
        const mcpResult = await mcpClient.processMessage(message);

        if (mcpResult.needsTools) {
          console.log(
            "[Chat API] MCP tools executed for POST:",
            mcpResult.toolResults?.length
          );
          mcpResults = mcpResult.toolResults;

          if (mcpResult.enhancedContext) {
            finalMessage = mcpResult.enhancedContext;
          }
        }
      } catch (mcpError) {
        console.error("[Chat API] MCP processing error in POST:", mcpError);
      }
    }

    const ollamaMessages = sessionHistory.map((m) => ({
      role: m.sender === "ai" ? "assistant" : "user",
      content: m.text,
    }));

    if (finalMessage !== message && ollamaMessages.length > 0) {
      const lastMsg = ollamaMessages[ollamaMessages.length - 1];
      if (lastMsg.role === "user") {
        lastMsg.content = finalMessage;
      }
    }

    console.log(
      `[Chat API] POST: 📤 Sending ${ollamaMessages.length} messages to Ollama`
    );

    const response = await ollama.chat({
      model: ollamaModel,
      messages: ollamaMessages,
    });

    console.log(
      "<<<<<Ollama response:",
      response.message.content.substring(0, 100)
    );

    sessionHistory.push({ sender: "ai", text: response.message.content });
    console.log(
      `[Chat API] POST: ✅ Session ${effectiveSessionId} now has ${sessionHistory.length} messages`
    );

    res.json({
      text: response.message.content,
      sessionId: effectiveSessionId,
      mcpUsed: mcpResults ? true : false,
      mcpResults: mcpResults,
    });
  } catch (error) {
    console.error("[Chat API] Error handling chat message:", error);
    res.status(500).json({ error: "Failed to process the message" });
  }
});

chatRouter.get("/ws", (req, res) => {
  res.status(400).send("WebSocket endpoint. Please connect via WebSocket.");
});

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

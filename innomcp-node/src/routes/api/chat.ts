import { Router } from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { Ollama } from "ollama";
import { InitMcpClient, IntelligentMCPClient } from "../../utils/mcpclient";

dotenv.config();

// --- 1. Ollama Configuration ---
const OLLAMA_HOST = process.env.OLLAMA_HOST || "localhost";
const OLLAMA_PORT = process.env.OLLAMA_PORT || "11434";

const ollama = new Ollama({ host: `${OLLAMA_HOST}:${OLLAMA_PORT}` });
const ollamaModel = process.env.OLLAMA_MODEL || "llama2";

const chatRouter = Router();

// --- 2. MCP Client ---
let mcpClient: IntelligentMCPClient | null = null;

// --- 3. Initialize MCP Client ---
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
    // list all tools
    console.log(
      "[Chat API] Tools:",
      mcpClient?.getAvailableTools().map((t) => t.name)
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

// --- 4. WebSocket Server Setup ---
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

// Heartbeat mechanism
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

// --- 5. Message interface ---
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

interface ClientMessage {
  text: string;
  messages?: ChatMessage[];
}

// --- 6. WebSocket Connection Handler ---
wss.on("connection", (ws) => {
  (ws as any).isAlive = true;
  ws.on("pong", () => {
    try {
      (ws as any).isAlive = true;
    } catch (e) {
      // ignore
    }
  });

  console.log(
    `[Chat API] New WebSocket connection - total=${wss.clients.size}`
  );

  // --- Message Handler ---
  ws.on("message", async (data) => {
    try {
      const clientMessage: ClientMessage = JSON.parse(data.toString());
      console.log("[Chat API] Received message:", clientMessage);

      // Get full message history from client or initialize empty
      let sessionHistory: ChatMessage[] = clientMessage.messages || [];
      const currentText = clientMessage.text;

      if (!currentText) {
        ws.send(JSON.stringify({ error: "Text is required" }));
        return;
      }

      // Add user message to history
      sessionHistory.push({ sender: "user", text: currentText });
      console.log(
        `[Chat API] Session history: ${sessionHistory.length} messages (before AI response)`
      );

      let finalMessage = currentText;
      let mcpContext = "";

      // **Process with MCP**
      if (mcpClient) {
        console.log("[Chat API] Processing message with MCP client...");
        try {
          const mcpResult = await mcpClient.processMessage(currentText);

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
          } else if (mcpResult.toolsFailed) {
            // Tools were selected but all failed, send sorry message
            const sorryMessage =
              "ขออภัย ฉันไม่สามารถให้ข้อมูลได้ในขณะนี้ หรือลองถามให้ละเอียดกว่านี้อีก";
            sessionHistory.push({ sender: "ai", text: sorryMessage });
            ws.send(JSON.stringify({ type: "chunk", text: sorryMessage }));
            ws.send(
              JSON.stringify({
                type: "history-update",
                messages: sessionHistory,
              })
            );
            return; // Don't proceed to Ollama
          }
        } catch (mcpError) {
          console.error("[Chat API] MCP processing error:", mcpError);
        }
      }

      // **Use Ollama with full history**
      try {
        // Map history to Ollama format with system prompt
        const systemPrompt = {
          role: "system",
          content: `คุณเป็น AI ผู้ช่วยที่มีความสำคัญ:
1. จำประวัติการสนทนาที่ผ่านมา
2. ใช้บริบทจากข้อความก่อนหน้าเพื่อให้คำตอบที่สอดคล้อง
3. หากมีข้อมูลจาก MCP tools ให้นำมาใช้
4. ไม่ตอบนอกเหนือจากที่ได้จาก MCP tools ถ้าไม่ทราบ หรือไม่สามารถเลือก MCP tools ได้ หรือ MCP tools failed หรือ MCP tools error ให้ตอบว่า "ขออภัย ฉันไม่สามารถให้ข้อมูลได้ในขณะนี้ หรือลองถามให้ละเอียดกว่านี้อีก"
5. ตอบไม่ให้รู้ว่ามีการใช้ MCP tools ถ้าไม่จำเป็น
6. ตอบเป็นภาษาไทยเป็นหลัก
7. ตอบในรูปแบบ markdown เสมอ
8. ใช้ markdown headings สำหรับหัวข้อ เช่น:
   # หัวข้อหลัก
   เนื้อหา...
   ## หัวข้อย่อย
   เนื้อหา...
   หลีกเลี่ยงการส่งข้อความธรรมดาโดยไม่มีการจัดรูปแบบ
9. ใช้ markdown table เมื่อเหมาะสม เช่น แสดงข้อมูลในรูปแบบตาราง
10. ใช้สีตัวอักษรเพื่อเน้นข้อความสำคัญหรือแยกส่วนต่างๆ ห้ามฝังสไตล์แบบ inline ใช้ Tailwind CSS classes ในการตกแต่งแทน
11. ใช้สีเพื่อทำให้คำตอบน่าสนใจและอ่านง่ายขึ้น
12. ใช้ขนาดตัวอักษรเพื่อเน้นหัวข้อหรือข้อความสำคัญ ห้ามฝังสไตล์แบบ inline ใช้ Tailwind CSS classes ในการตกแต่งแทน
13. โครงสร้างคำตอบ: เริ่มด้วยหัวข้อหลัก, ตามด้วยเนื้อหา, ใช้ bullet points (- หรือ *) หรือ numbering (1. 2.) สำหรับรายการ`,
        };

        const ollamaMessages = [
          systemPrompt,
          ...sessionHistory.slice(0, -1).map((m) => ({
            role: m.sender === "ai" ? "assistant" : "user",
            content: m.text,
          })),
          { role: "user", content: finalMessage },
        ];

        console.log(
          `[Chat API] Sending ${ollamaMessages.length} messages to Ollama with models=${ollamaModel} (including system prompt)`
        );

        // Call Ollama with streaming
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

          // Send the incoming chunk as-is to the client (frontend will append)
          ws.send(
            JSON.stringify({ type: "chunk", text: chunk.message.content })
          );
        }

        // Add AI response to history and send back to client
        sessionHistory.push({ sender: "ai", text: aiResponse });
        console.log(`[Chat API] AI response: >>>>>>>>> ${aiResponse}`);
        console.log(
          `[Chat API] Session now has ${sessionHistory.length} messages (after AI response)`
        );

        // Send updated history back to client
        ws.send(
          JSON.stringify({
            type: "history-update",
            messages: sessionHistory,
          })
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
    console.log(`[Chat API] WebSocket closed - total=${wss.clients.size}`);
  });

  ws.on("error", (error) => {
    console.error("[Chat API] WebSocket error:", error);
  });
});

// --- 7. POST Endpoint (REST API) ---
chatRouter.post("/chat", async (req, res) => {
  try {
    const { message, messages } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("[Chat API] Received POST chat message:", message);

    // Get full message history from client or initialize empty
    let sessionHistory: ChatMessage[] = messages || [];

    // Add user message to history
    sessionHistory.push({ sender: "user", text: message });
    console.log(
      `[Chat API] POST: Session history: ${sessionHistory.length} messages (before AI)`
    );

    let finalMessage = message;
    let mcpResults = null;

    // **Process with MCP**
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
        } else if (mcpResult.toolsFailed) {
          // Tools were selected but all failed, return sorry message
          const sorryMessage =
            "ขออภัย ฉันไม่สามารถให้ข้อมูลได้ในขณะนี้ หรือลองถามให้ละเอียดกว่านี้อีก";
          sessionHistory.push({ sender: "ai", text: sorryMessage });
          return res.json({
            text: sorryMessage,
            messages: sessionHistory,
            mcpUsed: false,
            mcpResults: null,
          });
        }
      } catch (mcpError) {
        console.error("[Chat API] MCP processing error in POST:", mcpError);
      }
    }

    // Map history to Ollama format
    const systemPrompt = {
      role: "system",
      content: `คุณเป็น AI ผู้ช่วยที่มีความสำคัญ:
1. จำประวัติการสนทนาที่ผ่านมา
2. ใช้บริบทจากข้อความก่อนหน้าเพื่อให้คำตอบที่สอดคล้อง
3. หากมีข้อมูลจาก MCP tools ให้นำมาใช้
4. ไม่ตอบนอกเหนือจากที่ได้จาก MCP tools ถ้าไม่ทราบ หรือไม่สามารถเลือก MCP tools ได้ หรือ MCP tools failed หรือ MCP tools error ให้ตอบว่า "ขออภัย ฉันยังไม่มีข้อมูลที่คุณต้องการ"
5. ตอบไม่ให้รู้ว่ามีการใช้ MCP tools ถ้าไม่จำเป็น
6. ตอบเป็นภาษาไทยเป็นหลัก
7. ตอบในรูปแบบ markdown เสมอ โดยใช้ headings สำหรับหัวข้อ เช่น:
   # หัวข้อหลัก
   เนื้อหา...
   ## หัวข้อย่อย
   เนื้อหา...
   หลีกเลี่ยงการส่งข้อความธรรมดาโดยไม่มีการจัดรูปแบบ
8. ใช้ markdown table เมื่อเหมาะสม เช่น แสดงข้อมูลในรูปแบบตาราง การเปรียบเทียบ หรือตัวเลขสถิติ
9. ใช้สีตัวอักษรเพื่อเน้นข้อความสำคัญหรือแยกส่วนต่างๆ โดยใช้ HTML inline และเลือกสีที่เหมาะสมเอง เช่น <span style="color: red;">ข้อความสำคัญ</span>
10. ใช้สีเพื่อทำให้คำตอบน่าสนใจและอ่านง่ายขึ้น
11. ใช้ขนาดตัวอักษรเพื่อเน้นหัวข้อหรือข้อความสำคัญ โดยใช้ HTML inline และเลือกขนาดที่เหมาะสมเอง เช่น <span style="font-size: larger;">หัวข้อ</span>
12. ใช้ Markdown heading (# ## ###) เพื่อเน้นหัวข้อและแยกส่วนต่างๆ ของคำตอบ เช่น # หัวข้อหลัก, ## หัวข้อย่อย
13. โครงสร้างคำตอบ: เริ่มด้วยหัวข้อหลัก, ตามด้วยเนื้อหา, ใช้ bullet points (- หรือ *) หรือ numbering (1. 2.) สำหรับรายการ`,
    };

    const ollamaMessages = [
      systemPrompt,
      ...sessionHistory.slice(0, -1).map((m: ChatMessage) => ({
        role: m.sender === "ai" ? "assistant" : "user",
        content: m.text,
      })),
      { role: "user", content: finalMessage },
    ];

    console.log(
      `[Chat API] POST: Sending ${ollamaMessages.length} messages to Ollama (including system prompt)`
    );

    // Call Ollama (non-streaming)
    const response = await ollama.chat({
      model: ollamaModel,
      messages: ollamaMessages,
    });

    console.log(
      "[Chat API] Ollama response:",
      response.message.content.substring(0, 100)
    );

    // Add AI response to history
    sessionHistory.push({ sender: "ai", text: response.message.content });
    console.log(
      `[Chat API] POST: Session now has ${sessionHistory.length} messages`
    );

    res.json({
      text: response.message.content,
      messages: sessionHistory,
      mcpUsed: mcpResults ? true : false,
      mcpResults: mcpResults,
    });
  } catch (error) {
    console.error("[Chat API] Error handling chat message:", error);
    res.status(500).json({ error: "Failed to process the message" });
  }
});

// --- 8. Utility Endpoints ---
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
  const resources = mcpClient.getAvailableResources();
  const clients = mcpClient.getConnectedClients();

  res.json({
    available: true,
    clients: clients,
    toolsCount: tools.length,
    resourcesCount: resources.length,
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      keywords: tool.keywords,
      examples: tool.examples,
    })),
    resources: resources.map((r) => ({
      name: r.name,
      title: r.title,
      description: r.description,
      uriTemplate: r.uriTemplate,
    })),
  });
});

export { chatRouter, wss };

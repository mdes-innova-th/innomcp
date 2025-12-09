import { Router } from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { Ollama } from "ollama";
import { InitMcpClient, IntelligentMCPClient } from "../../utils/mcp/mcpclient";

dotenv.config();

// --- 1. Ollama Configuration ---
// Support full URL in OLLAMA_HOST (including protocol) and optional OLLAMA_PORT.
const rawHost = process.env.OLLAMA_HOST || "localhost";
const rawPort = process.env.OLLAMA_PORT || "";

// Build a clean host URL for the Ollama client.
let ollamaHostUrl = rawHost;
try {
  // Ensure we have a protocol for URL parsing. If missing, assume http.
  if (!/^https?:\/\//i.test(rawHost)) {
    ollamaHostUrl = `http://${rawHost}`;
  }

  const parsed = new URL(ollamaHostUrl);

  // If a port is provided via env, override/add it. If not, keep existing.
  if (rawPort) parsed.port = rawPort;

  // Remove any trailing slash
  ollamaHostUrl = parsed.toString().replace(/\/$/, "");
} catch (e) {
  // Fallback: naive concatenation (shouldn't normally happen)
  ollamaHostUrl = rawHost.replace(/\/$/, "");
  if (rawPort) {
    // Avoid duplicating colon
    ollamaHostUrl = ollamaHostUrl.replace(/:$/, "") + ":" + rawPort;
  }
}

const ollama = new Ollama({ host: ollamaHostUrl });
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
  // Track recently processed message IDs for this connection to avoid duplicates/loops
  (ws as any).processedMessageIds = new Set<string>();
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
      // optional messageId to deduplicate repeated sends from the same client
      const incomingId = (clientMessage as any).messageId;
      if (incomingId && (ws as any).processedMessageIds.has(incomingId)) {
        console.log(`[Chat API] Duplicate messageId received, ignoring: ${incomingId}`);
        return;
      }
      if (incomingId) {
        (ws as any).processedMessageIds.add(incomingId);
        // expire this id after 60 seconds to avoid memory leak
        setTimeout(() => {
          try {
            (ws as any).processedMessageIds.delete(incomingId);
          } catch (e) {
            // ignore
          }
        }, 60000);
      }
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
      let structuredContent: any = undefined;

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

            // Extract structuredContent from tool results (e.g., chartSvg from echartsTool)
            if (mcpResult.toolResults && mcpResult.toolResults.length > 0) {
              for (const result of mcpResult.toolResults) {
                if (result.structuredContent) {
                  structuredContent = result.structuredContent;
                  console.log(
                    "[Chat API] Found structured content from tool:",
                    result.toolName
                  );
                  console.log(
                    "[Chat API] Structured content keys:",
                    Object.keys(structuredContent)
                  );
                  break; // Use first available structuredContent
                }
              }
            }

            if (mcpResult.enhancedContext) {
              finalMessage = mcpResult.enhancedContext;
              mcpContext = " (ใช้ข้อมูลจาก MCP tools)";
            }
          } else if (mcpResult.toolsFailed) {
            // Tools were selected but all failed — ask Ollama to craft a short sorry message
            let sorryMessage = "ขออภัย ขณะนี้ไม่สามารถให้ข้อมูลที่คุณต้องการได้";
            try {
              const apologyPrompt = `กรุณาสร้างข้อความขอโทษสั้นๆ (ภาษาไทย) ความยาวไม่เกิน 2 ประโยค อธิบายว่าไม่สามารถดึงข้อมูลหรือประมวลผลได้ในขณะนี้ และแนะนำทางเลือก เช่น ลองอีกครั้งภายหลัง หรือตรวจสอบรายละเอียดเพิ่มเติม ตอนจบให้สุภาพและกระชับ ตอบเฉพาะข้อความ ไม่ต้องมี markdown หรือข้อมูลเสริมอื่นๆ`;
              const apologyResp = await ollama.chat({
                model: ollamaModel,
                messages: [
                  { role: "system", content: "You are a concise and polite Thai assistant." },
                  { role: "user", content: apologyPrompt },
                ],
                stream: false,
              });
              let candidate = String(apologyResp?.message?.content || "").trim();
              // Clean up stray double-quote artifacts (e.g. trailing "" or surrounding quotes)
              const cleanCandidate = candidate.replace(/"{2,}/g, "").replace(/^"+|"+$/g, "").trim();
              if (cleanCandidate.length > 0) sorryMessage = cleanCandidate;
            } catch (e) {
              console.error("[Chat API] Failed to generate apology via Ollama:", e);
            }

            sessionHistory.push({ sender: "ai", text: sorryMessage });
            // Send as a final chunk and history update
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
1. จำประวัติการสนทนาที่ผ่านมาและใช้บริบทเพื่อให้คำตอบที่สอดคล้อง
2. หากมีข้อมูลจากภายนอกหรือกระบวนการภายใน ให้นำมาเป็นส่วนหนึ่งของผลลัพธ์เท่านั้นโดยไม่เปิดเผยแหล่งที่มา
3. ห้ามกล่าวถึงหรือบอกเป็นนัยเกี่ยวกับการใช้ tools, MCP, "MCP tools", MCP server, หรือระบบภายในใดๆ — ห้ามเผยชื่อ กระบวนการ หรืออธิบายการทำงานภายในในทุกรูปแบบ
4. หากไม่ได้รับข้อมูลที่เพียงพอ ให้ตอบว่า "ขออภัย ฉันยังไม่มีข้อมูลที่คุณต้องการ" หรือให้คำแนะนำสั้นๆ โดยไม่อธิบายสาเหตุภายใน
5. ตอบเป็นภาษาไทยเป็นหลัก และตอบในรูปแบบ markdown เสมอ
6. ใช้ markdown headings สำหรับหัวข้อ เช่น:
  # หัวข้อหลัก
  เนื้อหา...
  ## หัวข้อย่อย
  เนื้อหา...
7. ใช้ bullet points (- หรือ *) หรือ numbering (1. 2.) เมื่อเหมาะสม
8. หลีกเลี่ยงการส่งข้อความธรรมดาโดยไม่มีการจัดรูปแบบ`,
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
          `[Chat API] Sending ${ollamaMessages.length} messages to Ollama with models=${ollamaModel} (including system prompt) ✨`
        );

        // Call Ollama with streaming
        const responseStream = await ollama.chat({
          model: ollamaModel,
          messages: ollamaMessages,
          stream: true,
        });

        let aiResponse = "";
        let isFirstChunk = true;

        console.log(
          `[Chat API] Receiving streamed response from Ollama with models=${ollamaModel}... ✨`
        );

        for await (const chunk of responseStream) {
          if (!chunk.message || !chunk.message.content) continue;

          if (isFirstChunk && mcpContext) {
            ws.send(JSON.stringify({ type: "mcp-context", text: mcpContext }));
            isFirstChunk = false;
          }

          aiResponse += chunk.message.content;

          // Send the incoming chunk as-is to the client (frontend will append)
          // Include structuredContent if available (e.g., chartSvg)
          const chunkMsg: any = { type: "chunk", text: chunk.message.content };
          if (structuredContent) {
            chunkMsg.structuredContent = structuredContent;
            console.log("[Chat API] Sending chunk with structuredContent, keys:", Object.keys(structuredContent));
          }
          ws.send(JSON.stringify(chunkMsg));
        }

        // Add AI response to history and send back to client
        const aiMessage: any = { sender: "ai", text: aiResponse };
        if (structuredContent) {
          aiMessage.structuredContent = structuredContent;
          console.log("[Chat API] AI message has structuredContent, keys:", Object.keys(structuredContent));
        }
        sessionHistory.push(aiMessage);
        console.log(`[Chat API] AI response: >>>>>>>>> ${aiResponse} ✨`);
        console.log(
          `[Chat API] Session now has ${sessionHistory.length} messages (after AI response)`
        );
        console.log("[Chat API] Last message in history:", JSON.stringify(sessionHistory[sessionHistory.length - 1], null, 2).substring(0, 200));

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
            "[Chat API] Processed with MCP tools:",
            mcpResult.toolResults?.length
          );
          mcpResults = mcpResult.toolResults;

          if (mcpResult.enhancedContext) {
            finalMessage = mcpResult.enhancedContext;
          }
        } else if (mcpResult.toolsFailed) {
          // Tools were selected but all failed — ask Ollama to craft a short sorry message
          let sorryMessage = "ขออภัย ขณะนี้ไม่สามารถให้ข้อมูลที่คุณต้องการได้";
          try {
            const apologyPrompt = `กรุณาสร้างข้อความขอโทษสั้นๆ (ภาษาไทย) ความยาวไม่เกิน 2 ประโยค อธิบายว่าไม่สามารถดึงข้อมูลหรือประมวลผลได้ในขณะนี้ และแนะนำทางเลือก เช่น ลองอีกครั้งภายหลัง หรือตรวจสอบรายละเอียดเพิ่มเติม ตอนจบให้สุภาพและกระชับ ตอบเฉพาะข้อความ ไม่ต้องมี markdown หรือข้อมูลเสริมอื่นๆ`;
            const apologyResp = await ollama.chat({
              model: ollamaModel,
              messages: [
                { role: "system", content: "You are a concise and polite Thai assistant." },
                { role: "user", content: apologyPrompt },
              ],
              stream: false,
            });
            let candidate = String(apologyResp?.message?.content || "").trim();
            // Clean up stray double-quote artifacts (e.g. trailing "" or surrounding quotes)
            const cleanCandidate = candidate.replace(/"{2,}/g, "").replace(/^"+|"+$/g, "").trim();
            if (cleanCandidate.length > 0) sorryMessage = cleanCandidate;
          } catch (e) {
            console.error("[Chat API] Failed to generate apology via Ollama (POST):", e);
          }

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
1. จำประวัติการสนทนาที่ผ่านมาและใช้บริบทเพื่อให้คำตอบที่สอดคล้อง
2. หากมีข้อมูลจากภายนอกหรือกระบวนการภายใน ให้นำมาเป็นส่วนหนึ่งของผลลัพธ์เท่านั้นโดยไม่เปิดเผยแหล่งที่มา
3. ห้ามกล่าวถึงหรือบอกเป็นนัยเกี่ยวกับการใช้ tools, MCP, "MCP tools", MCP server, หรือระบบภายในใดๆ — ห้ามเผยชื่อ กระบวนการ หรืออธิบายการทำงานภายในในทุกรูปแบบ
4. หากไม่ได้รับข้อมูลที่เพียงพอ ให้ตอบว่า "ขออภัย ฉันยังไม่มีข้อมูลที่คุณต้องการ" หรือให้คำแนะนำสั้นๆ โดยไม่อธิบายสาเหตุภายใน
5. ตอบเป็นภาษาไทยเป็นหลัก และตอบในรูปแบบ markdown เสมอ โดยใช้ headings สำหรับหัวข้อ เช่น:
  # หัวข้อหลัก
  เนื้อหา...
  ## หัวข้อย่อย
  เนื้อหา...
6. ใช้ markdown table เมื่อเหมาะสม เช่น แสดงข้อมูลในรูปแบบตาราง การเปรียบเทียบ หรือตัวเลขสถิติ
7. ใช้ bullet points (- หรือ *) หรือ numbering (1. 2.) เมื่อเหมาะสม
8. หลีกเลี่ยงการส่งข้อความธรรมดาโดยไม่มีการจัดรูปแบบ
9. โครงสร้างคำตอบ: เริ่มด้วยหัวข้อหลัก, ตามด้วยเนื้อหา`,
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
      `[Chat API] POST: Sending ${ollamaMessages.length} messages to Ollama (including system prompt) ✨`
    );

    // Call Ollama (non-streaming)
    const response = await ollama.chat({
      model: ollamaModel,
      messages: ollamaMessages,
    });

    console.log(
      "[Chat API] Ollama response ✨:",
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

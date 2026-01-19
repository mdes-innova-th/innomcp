import { Router } from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import crypto from "crypto";
import { Ollama } from "ollama";
import { InitMcpClient, IntelligentMCPClient } from "../../utils/mcp/mcpclient";
import { logBoth } from "../../utils/mcpLogger";
import logger from "../../utils/logger";
import { getCurrentAIMode } from "./aiMode";
import { fastPathChatMiddleware } from "../../middleware/fastpathChatMiddleware";
import { sessionManager } from "../../utils/sessionManager";
import { buildSystemPrompt, buildIdentityPrompt } from "../../config/systemPrompt";
import { extractCorrelationIdFromUpgrade } from "../../middleware/correlationId";
import { checkRateLimit, buildRateLimitKey } from "../../fastpath/rateLimit";
import { analyzeIntent } from "../../fastpath/intentGate";
import { requestQueue } from "../../utils/requestQueue";

dotenv.config();

// ========================================
// MULTI-AI CONFIGURATION
// ========================================

// ใช้ getCurrentAIMode() แทน env variable
let AI_MODE: 'local' | 'remote' | 'hybrid' = getCurrentAIMode();
logBoth("info", `\n🚀 ========================================`);
logBoth("info", `🚀 INNOMCP AI MODE: ${AI_MODE.toUpperCase()}`);
logBoth("info", `🚀 ========================================\n`);

// --- Local Ollama (GPU) Configuration ---
const localRawHost = process.env.LOCAL_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://172.22.64.1:11434";
let localOllamaHostUrl = localRawHost;
try {
  if (!/^https?:\/\//i.test(localRawHost)) {
    localOllamaHostUrl = `http://${localRawHost}`;
  }
  const parsed = new URL(localOllamaHostUrl);
  localOllamaHostUrl = parsed.toString().replace(/\/$/, "");
} catch (e) {
  localOllamaHostUrl = localRawHost.replace(/\/$/, "");
}

const localOllama = new Ollama({ 
  host: localOllamaHostUrl,
});
const localModel = process.env.LOCAL_OLLAMA_MODEL || process.env.OLLAMA_MODEL || "gemma3:4b";
logBoth("info", `💚 Local AI: ${localOllamaHostUrl} (${localModel})`);

// --- Remote Ollama Configuration (for remote/hybrid modes) ---
let remoteOllama: Ollama | undefined;
let remoteModel: string | undefined;

if (AI_MODE === 'remote' || AI_MODE === 'hybrid') {
  const remoteRawHost = process.env.REMOTE_OLLAMA_BASE_URL;
  if (remoteRawHost) {
    let remoteOllamaHostUrl = remoteRawHost;
    try {
      if (!/^https?:\/\//i.test(remoteRawHost)) {
        remoteOllamaHostUrl = `http://${remoteRawHost}`;
      }
      const parsed = new URL(remoteOllamaHostUrl);
      remoteOllamaHostUrl = parsed.toString().replace(/\/$/, "");
    } catch (e) {
      remoteOllamaHostUrl = remoteRawHost.replace(/\/$/, "");
    }
    
    remoteOllama = new Ollama({ host: remoteOllamaHostUrl });
    remoteModel = process.env.REMOTE_OLLAMA_MODEL || localModel;
    logBoth("info", `🎯 Remote AI: ${remoteOllamaHostUrl} (${remoteModel})`);
  } else {
    logBoth("warn", `⚠️  ${AI_MODE} mode selected but REMOTE_OLLAMA_BASE_URL not configured`);
    logBoth("warn", `⚠️  Falling back to local AI only`);
  }
}

// Main Ollama instance (backward compatibility)
let ollama = AI_MODE === 'local' ? localOllama : (remoteOllama || localOllama);
let ollamaModel = AI_MODE === 'local' ? localModel : (remoteModel || localModel);

logBoth("info", `\n✨ Primary AI: ${AI_MODE === 'local' ? 'Local' : (remoteOllama ? 'Remote' : 'Local (fallback)')}\n`);

// Export function to update AI mode dynamically
export function updateChatAIMode() {
  const oldMode = AI_MODE;
  AI_MODE = getCurrentAIMode();
  
  logBoth("info", `[Chat AI] 🔄 updateChatAIMode called`);
  logBoth("info", `[Chat AI] 📊 Mode change: ${oldMode} → ${AI_MODE}`);
  
  // Initialize remote Ollama if needed (for remote/hybrid modes)
  if ((AI_MODE === 'remote' || AI_MODE === 'hybrid') && !remoteOllama) {
    const remoteRawHost = process.env.REMOTE_OLLAMA_BASE_URL;
    if (remoteRawHost) {
      let remoteOllamaHostUrl = remoteRawHost;
      try {
        if (!/^https?:\/\//i.test(remoteRawHost)) {
          remoteOllamaHostUrl = `http://${remoteRawHost}`;
        }
        const parsed = new URL(remoteOllamaHostUrl);
        remoteOllamaHostUrl = parsed.toString().replace(/\/$/, "");
      } catch (e) {
        remoteOllamaHostUrl = remoteRawHost.replace(/\/$/, "");
      }
      
      remoteOllama = new Ollama({ host: remoteOllamaHostUrl });
      remoteModel = process.env.REMOTE_OLLAMA_MODEL || localModel;
      logBoth('info', `[Chat AI] 🌐 Initializing Remote Ollama: ${remoteOllamaHostUrl}`);
      logBoth('info', `[Chat AI] 📦 Remote Model: ${remoteModel}`);
      logBoth("info", `🎯 Remote AI initialized: ${remoteOllamaHostUrl} (${remoteModel})`);
    } else {
      logBoth('warn', `[Chat AI] ⚠️  ${AI_MODE} mode requested but REMOTE_OLLAMA_BASE_URL not configured`);
      logBoth('warn', `[Chat AI] ⚠️  Will use local AI as fallback`);
    }
  }
  
  ollama = AI_MODE === 'local' ? localOllama : (remoteOllama || localOllama);
  ollamaModel = AI_MODE === 'local' ? localModel : (remoteModel || localModel);
  
  logBoth('info', `[Chat AI] 🤖 Using Ollama: ${AI_MODE === 'local' ? 'Local' : (remoteOllama ? 'Remote' : 'Local (fallback)')}`);
  logBoth('info', `[Chat AI] 📝 Model: ${ollamaModel}`);
  
  if (mcpClient) {
    const oldMcpMode = (mcpClient as any).aiMode;
    (mcpClient as any).aiMode = AI_MODE;
    logBoth('info', `[Chat AI] 🔗 MCP Client mode: ${oldMcpMode} → ${AI_MODE}`);
  } else {
    logBoth('warn', `[Chat AI] ⚠️  MCP Client not initialized`);
  }
  
  logBoth("info", `🔄 Chat AI Mode updated to: ${AI_MODE.toUpperCase()}`);
  logBoth('info', `[Chat AI] ✅ updateChatAIMode completed successfully`);
}

const chatRouter = Router();

// --- 2. MCP Client ---
let mcpClient: IntelligentMCPClient | null = null;

// --- 3. Initialize MCP Client with Multi-AI Support ---
mcpClient = InitMcpClient(ollama, ollamaModel, {
  aiMode: AI_MODE,
  localOllama: localOllama,
  remoteOllama: remoteOllama,
  localModel: localModel,
  remoteModel: remoteModel,
});

logBoth("info", "[Chat API] MCP client created (initializing in background)");

if (mcpClient) {
  mcpClient.on("clientConnected", (name: string) => {
    logBoth("info", `[Chat API] MCP client connected: ${name}`);
    logBoth("info", `[Chat API] Connected clients: ${JSON.stringify(mcpClient?.getConnectedClients())}`);
  });

  mcpClient.on("connectedClients", (clients: string[]) => {
    logBoth("info", `[Chat API] Connected clients (update): ${JSON.stringify(clients)}`);
  });

  mcpClient.on("toolLoaded", (info: { client: string; tool: string }) => {
    logBoth("info", `[Chat API] Tool loaded from ${info.client}: ${info.tool}`);
  });

  mcpClient.on("ready", () => {
    logBoth("info", "[Chat API] Intelligent MCP Client initialization completed");
    logBoth("info", `[Chat API] Available tools: ${mcpClient?.getAvailableTools().length}`);
    logBoth("info", `[Chat API] Tools: ${JSON.stringify(mcpClient?.getAvailableTools().map((t) => t.name))}`);
  });

  try {
    logBoth("info", `[Chat API] Connected clients (initial): ${JSON.stringify(mcpClient.getConnectedClients())}`);
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
    logBoth("info", `[WebSocket] Connection attempt from origin: ${origin}`);

    if (!origin || allowedOrigins.includes(origin)) {
      return true;
    }

    logBoth("warn", `[WebSocket] Rejected connection from origin: ${origin}`);
    return false;
  },
});

// Heartbeat mechanism
const heartbeatInterval = 30000;
const pingInterval = setInterval(() => {
  wss.clients.forEach((client: any) => {
    if (client.isAlive === false) {
      logBoth("warn", "[WebSocket] Terminating unresponsive client");
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
wss.on("connection", (ws, req) => {
  (ws as any).isAlive = true;
  // Track recently processed message IDs for this connection to avoid duplicates/loops
  (ws as any).processedMessageIds = new Set<string>();
  
  // 🔍 Extract Correlation ID
  const correlationId = extractCorrelationIdFromUpgrade(req);
  (ws as any).correlationId = correlationId;
  
  // Generate or extract sessionId
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>) || {};
  
  const sessionId = cookies.sessionId || 
                   req.headers['x-session-id'] as string || 
                   crypto.randomUUID();
  (ws as any).sessionId = sessionId;
  
  // Store client info
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  (ws as any).clientIp = clientIp;
  
  // Initialize session
  const userAgent = req.headers['user-agent'];
  sessionManager.getOrCreateSession(sessionId, undefined, userAgent);
  logger.info(`[Chat API] WebSocket connected [cid=${correlationId.substring(0, 8)}] sid=${sessionId.substring(0, 8)} ip=${clientIp}`);
  
  ws.on("pong", () => {
    try {
      (ws as any).isAlive = true;
    } catch (e) {
      // ignore
    }
  });

  logBoth("info", `[Chat API] New WebSocket connection - total=${wss.clients.size}`);

  // --- Message Handler with Queue Management ---
  ws.on("message", async (data) => {
    const messageId = `ws-${sessionId.substring(0, 8)}-${Date.now()}`;
    
    // Enqueue the message processing to prevent overload
    await requestQueue.enqueue(messageId, async () => {
      try {
        const clientMessage: ClientMessage = JSON.parse(data.toString());
        // optional messageId to deduplicate repeated sends from the same client
        const incomingId = (clientMessage as any).messageId;
      if (incomingId && (ws as any).processedMessageIds.has(incomingId)) {
        logBoth("warn", `[Chat API] Duplicate messageId received, ignoring: ${incomingId}`);
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
      logBoth('info', `Received WebSocket message (textLength: ${clientMessage.text?.length || 0}, historySize: ${clientMessage.messages?.length || 0})`);

      // Get full message history from client or initialize empty
      let sessionHistory: ChatMessage[] = clientMessage.messages || [];
      const currentText = clientMessage.text;

      if (!currentText) {
        ws.send(JSON.stringify({ error: "Text is required" }));
        return;
      }
      
      // 📝 Log user message to session
      const currentSessionId = (ws as any).sessionId;
      sessionManager.addMessage(currentSessionId, 'user', currentText);
      logBoth('info', `[Session] Added user message to session ${currentSessionId}`);

      // 🚀 FastPath: Check if this is a simple greeting/small-talk that can be answered instantly
      const { tryFastPathWebSocket } = await import("../../services/fastPathHandler");
      const clientIp = (ws as any).clientIp || 'unknown';
      const fastPathResult = await tryFastPathWebSocket(
        currentText,
        (payload) => {
          // Convert FastPath format to our WebSocket format
          const responseText = payload.content?.[0]?.text || "👋";
          
          // Send as chunk (streaming format)
          ws.send(JSON.stringify({ 
            type: "chunk", 
            text: responseText,
            structuredContent: payload.structuredContent
          }));
          
          // Send history update with the complete response
          const aiMessage: any = { sender: "ai", text: responseText };
          if (payload.structuredContent) {
            aiMessage.structuredContent = payload.structuredContent;
          }
          sessionHistory.push({ sender: "user", text: currentText });
          sessionHistory.push(aiMessage);
          
          // 📝 Log FastPath response to session
          sessionManager.addMessage(currentSessionId, 'assistant', responseText, ['FastPath']);
          
          ws.send(JSON.stringify({
            type: "history-update",
            messages: sessionHistory,
            structuredContent: payload.structuredContent
          }));
        },
        { mode: (process.env.FASTPATH_MODE as any) || "on" },
        clientIp,
        undefined // userId (not available yet)
      );

      if (fastPathResult.handled) {
        logBoth('info', `[FastPath] ⚡ Handled in ${fastPathResult.latencyMs}ms: ${currentText.slice(0, 50)}`);
        return; // FastPath responded, done!
      }

      // Add user message to history
      sessionHistory.push({ sender: "user", text: currentText });
      logBoth('info', `Session history prepared (totalMessages: ${sessionHistory.length}, mode: ${AI_MODE})`);

      // 🧠 Inject session context for AI memory
      const recentContext = sessionManager.buildContextString(currentSessionId, 5);
      let contextPrefix = '';
      if (recentContext) {
        contextPrefix = `<conversation_history>\n${recentContext}</conversation_history>\n\n`;
        logBoth('info', `[Session] Injected ${sessionManager.getRecentMessages(currentSessionId, 5).length} recent messages as context`);
      }

      let finalMessage = currentText;
      let mcpContext = "";
      let structuredContent: any = undefined;
      let toolsUsedInThisRequest: string[] = [];

      // **Process with MCP**
      if (mcpClient) {
        logBoth('info', `Processing with MCP client (messageLength: ${currentText.length})`);
        try {
          const mcpResult = await mcpClient.processMessage(currentText);

          if (mcpResult.needsTools) {
            logBoth("info", `[Chat API] MCP tools executed: ${mcpResult.toolResults?.length}`);
            
            // Track tools used
            if (mcpResult.toolResults) {
              toolsUsedInThisRequest = mcpResult.toolResults.map(r => r.toolName);
            }

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
                  logBoth("info", `[Chat API] Found structured content from tool: ${result.toolName}`);
                  logBoth("info", `[Chat API] Structured content keys: ${JSON.stringify(Object.keys(structuredContent))}`);
                  break; // Use first available structuredContent
                }
              }
            }

            if (mcpResult.enhancedContext) {
              mcpContext = mcpResult.enhancedContext;
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
              logBoth("error", `[Chat API] Failed to generate apology via Ollama: ${e}`);
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
          logBoth("error", `[Chat API] MCP processing error: ${mcpError}`);
        }
      }

      // **Use Ollama with full history**
      try {
        // Build comprehensive system prompt with MDES identity
        const systemPromptContent = buildSystemPrompt({
          includeTools: true,
          includeCapabilities: true,
          includeGuidelines: true
        });
        
        const systemPrompt = {
          role: "system",
          content: systemPromptContent
        };

        const ollamaMessages = [
          systemPrompt,
          ...sessionHistory.slice(0, -1).map((m) => ({
            role: m.sender === "ai" ? "assistant" : "user",
            content: m.text,
          })),
          { 
            role: "user", 
            content: contextPrefix + (mcpContext ? `${mcpContext}\n\n` : '') + currentText 
          },
        ];

        const streamStartTime = Date.now();
        logBoth('info', `Sending messages to Ollama (messageCount: ${ollamaMessages.length}, model: ${ollamaModel}, mode: ${AI_MODE})`);

        // Call Ollama with streaming and optimized options for speed
        const responseStream = await ollama.chat({
          model: ollamaModel,
          messages: ollamaMessages,
          stream: true,
          keep_alive: '30m',
          options: {
            // ULTIMATE SPEED optimizations
            temperature: 0.7,        // Balanced
            num_ctx: 2048,           // REDUCED from 4096 (2x faster)
            num_predict: 512,        // REDUCED from 2048 (4x faster)
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1,
            num_thread: 8,
            num_gpu: 99,
          },
        });

        let aiResponse = "";
        let isFirstChunk = true;
        let chunkCount = 0;

        logBoth('info', `Receiving streamed response from Ollama (model: ${ollamaModel})`);

        for await (const chunk of responseStream) {
          if (!chunk.message || !chunk.message.content) continue;
          chunkCount++;

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

        const streamDuration = Date.now() - streamStartTime;
        logBoth('info', `Stream completed (duration: ${streamDuration}ms, chunkCount: ${chunkCount}, responseLength: ${aiResponse.length}, model: ${ollamaModel})`);

        // Add AI response to history and send back to client
        const aiMessage: any = { sender: "ai", text: aiResponse };
        if (structuredContent) {
          aiMessage.structuredContent = structuredContent;
        }
        sessionHistory.push(aiMessage);
        
        // 📝 Log AI response to session with tools used
        sessionManager.addMessage(currentSessionId, 'assistant', aiResponse, toolsUsedInThisRequest.length > 0 ? toolsUsedInThisRequest : undefined);
        logBoth('info', `[Session] Added AI response to session (tools: ${toolsUsedInThisRequest.join(', ') || 'none'})`);
        
        logBoth('info', `AI response complete (responseLength: ${aiResponse.length}, totalMessages: ${sessionHistory.length})`);

        // Send updated history back to client
        ws.send(
          JSON.stringify({
            type: "history-update",
            messages: sessionHistory,
          })
        );
      } catch (ollamaError) {
        logBoth("error", `[Chat API] Ollama error: ${ollamaError}`);
        logBoth('error', `Ollama chat error: ${ollamaError instanceof Error ? ollamaError.message : String(ollamaError)} (model: ${ollamaModel}, mode: ${AI_MODE})`);
        ws.send(
          JSON.stringify({ error: "Failed to get response from AI model" })
        );
        return;
      }
    } catch (error) {
      logBoth("error", `[Chat API] Error parsing message: ${error}`);
      logBoth('error', `Message parsing error: ${error instanceof Error ? error.message : String(error)}`);
      ws.send(JSON.stringify({ error: "Invalid message format" }));
    }
    }).catch(queueError => {
      logBoth("error", `[Queue] Failed to process message: ${queueError}`);
      try {
        ws.send(JSON.stringify({ error: "Server busy, please try again" }));
      } catch (e) {
        // WebSocket might be closed
      }
    });
  });

  ws.on("close", () => {
    logBoth("info", `[Chat API] WebSocket closed - total=${wss.clients.size}`);
  });

  ws.on("error", (error) => {
    logBoth("error", `[Chat API] WebSocket error: ${error}`);
  });
});

// --- 7. POST Endpoint (REST API) with FastPath ---
// 🚀 FastPath middleware intercepts greetings and responds immediately (<1s)
chatRouter.post("/chat", fastPathChatMiddleware(), async (req, res) => {
  try {
    const { message, messages } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    logBoth("info", `[Chat API] Received POST chat message: ${JSON.stringify(message)}`);

    // Get full message history from client or initialize empty
    let sessionHistory: ChatMessage[] = messages || [];

    // Add user message to history
    sessionHistory.push({ sender: "user", text: message });
    logBoth("info", `[Chat API] POST: Session history: ${sessionHistory.length} messages (before AI)`);

    let finalMessage = message;
    let mcpResults = null;

    // **Process with MCP**
    if (mcpClient) {
      try {
        const mcpResult = await mcpClient.processMessage(message);

        if (mcpResult.needsTools) {
          logBoth("info", `[Chat API] Processed with MCP tools: ${mcpResult.toolResults?.length}`);
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
            logBoth("error", `[Chat API] Failed to generate apology via Ollama (POST): ${e}`);
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
        logBoth("error", `[Chat API] MCP processing error in POST: ${mcpError}`);
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

    logBoth("info", `[Chat API] POST: Sending ${ollamaMessages.length} messages to Ollama (including system prompt) ✨`);

    // Call Ollama (non-streaming)
    const response = await ollama.chat({
      model: ollamaModel,
      messages: ollamaMessages,
    });

    logBoth("info", `[Chat API] Ollama response ✨: ${response.message.content.substring(0, 100)}`);

    // Add AI response to history
    sessionHistory.push({ sender: "ai", text: response.message.content });
    logBoth("info", `[Chat API] POST: Session now has ${sessionHistory.length} messages`);

    res.json({
      text: response.message.content,
      messages: sessionHistory,
      mcpUsed: mcpResults ? true : false,
      mcpResults: mcpResults,
    });
  } catch (error) {
    logBoth("error", `[Chat API] Error handling chat message: ${error}`);
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

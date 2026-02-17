import { Router } from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import crypto from "crypto";
import { Ollama } from "ollama";
import { InitMcpClient, IntelligentMCPClient } from "../../utils/mcp/mcpclient";
import { ToolHealthCheckSystem } from "../../utils/mcp/toolHealthCheck";
import { logBoth } from "../../utils/mcpLogger";
import logger from "../../utils/logger";
import { getCurrentAIMode } from "./aiMode";
import { fastPathChatMiddleware } from "../../middleware/fastpathChatMiddleware";
import { sessionManager } from "../../utils/sessionManager";
import { validateThaiLanguage, createThaiOnlyFallbackPrompt, createThaiErrorResponse, sanitizeThaiSegments } from "../../utils/languageValidator";
import { buildSystemPrompt, buildIdentityPrompt } from "../../config/systemPrompt";
import { extractCorrelationIdFromUpgrade } from "../../middleware/correlationId";
import { checkRateLimit, buildRateLimitKey } from "../../fastpath/rateLimit";
import { analyzeIntent } from "../../fastpath/intentGate";
import { getSemanticRouter } from "../../utils/semanticRouter"; // 🧠 NEW: Semantic classification for hybrid mode
import { getGodTierRouter } from "../../utils/mcp/godTierRouter"; // 🎯 God-Tier Context-Aware Intent Engine (2026)
import { getABTester } from "../../utils/mcp/abTester"; // 🧪 A/B Testing: Remote vs Hybrid mode comparison
import { requestQueue } from "../../utils/requestQueue";
import reportRouter from "./chat/report";
import { optionalAuth } from "../../utils/jwt";
import { guestLimiterMiddleware, getLimitsForUser, checkToolAccess, limitResponseLength } from "../../middleware/guestLimiter";
import { tryFastPathWebSocket } from "../../services/fastPathHandler";

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
const localModel = process.env.LOCAL_OLLAMA_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:14b";
const fastModel = process.env.FAST_OLLAMA_MODEL || "qwen2.5:0.5b";  // For fast routing/classification
const heavyModel = process.env.HEAVY_OLLAMA_MODEL || "deepseek-r1:32b";  // For heavy tasks (optional)
logBoth("info", `💚 Local AI: ${localOllamaHostUrl} (${localModel})`);
logBoth("info", `⚡ Fast Model: ${fastModel} | 🧠 Heavy Model: ${heavyModel}`);

// --- Remote Ollama Configuration (for remote/hybrid modes) ---
let remoteOllama: Ollama | undefined;
let remoteModel: string | undefined;  // Primary model for main responses
let remoteFastModel: string | undefined;  // Fast model for routing

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
    remoteModel = process.env.REMOTE_OLLAMA_MODEL || localModel;  // gemma3:4b
    remoteFastModel = process.env.FAST_OLLAMA_MODEL || fastModel;  // qwen2.5:0.5b
    logBoth("info", `🎯 Remote AI: ${remoteOllamaHostUrl}`);
    logBoth("info", `  📦 Primary: ${remoteModel} | ⚡ Fast: ${remoteFastModel}`);
  } else {
    logBoth("warn", `⚠️  ${AI_MODE} mode selected but REMOTE_OLLAMA_BASE_URL not configured`);
    logBoth("warn", `⚠️  Falling back to local AI only`);
  }
}

// Main Ollama instance (backward compatibility)
let ollama = AI_MODE === 'local' ? localOllama : (remoteOllama || localOllama);
let ollamaModel = AI_MODE === 'local' ? localModel : (remoteModel || localModel);
let ollamaFastModel = AI_MODE === 'local' ? fastModel : (remoteFastModel || fastModel);

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
      remoteFastModel = process.env.FAST_OLLAMA_MODEL || fastModel;
      logBoth('info', `[Chat AI] 🌐 Initializing Remote Ollama: ${remoteOllamaHostUrl}`);
      logBoth('info', `[Chat AI] 📦 Primary Model: ${remoteModel}`);
      logBoth('info', `[Chat AI] ⚡ Fast Model: ${remoteFastModel}`);
      logBoth("info", `🎯 Remote AI initialized: ${remoteOllamaHostUrl} (${remoteModel})`);
    } else {
      logBoth('warn', `[Chat AI] ⚠️  ${AI_MODE} mode requested but REMOTE_OLLAMA_BASE_URL not configured`);
      logBoth('warn', `[Chat AI] ⚠️  Will use local AI as fallback`);
    }
  }
  
  ollama = AI_MODE === 'local' ? localOllama : (remoteOllama || localOllama);
  ollamaModel = AI_MODE === 'local' ? localModel : (remoteModel || localModel);
  ollamaFastModel = AI_MODE === 'local' ? fastModel : (remoteFastModel || fastModel);
  
  logBoth('info', `[Chat AI] 🤖 Using Ollama: ${AI_MODE === 'local' ? 'Local' : (remoteOllama ? 'Remote' : 'Local (fallback)')}`);
  logBoth('info', `[Chat AI] 📝 Model: ${ollamaModel}`);
  
  // 🧠 Initialize Semantic Router for hybrid mode
  if (AI_MODE === 'hybrid') {
    const router = getSemanticRouter();
    router.initialize().catch(err => 
      logBoth('error', `[Semantic Router] ❌ Initialization failed: ${err}`)
    );
    logBoth('info', `[Semantic Router] 🧠 Hybrid mode activated - Smart classification enabled`);
  }
  
  // 🎯 Initialize God-Tier Router (2026 Context-Aware Intent Engine)
  const godTierRouter = getGodTierRouter();
  godTierRouter.initialize().catch(err =>
    logBoth('error', `[God-Tier Router] ❌ Initialization failed: ${err}`)
  );
  logBoth('info', `[God-Tier Router] 🎯 Context-aware routing activated`);
  
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

// Report message endpoint
chatRouter.use("/report", reportRouter);

// --- 2. MCP Client ---
let mcpClient: IntelligentMCPClient | null = null;
let toolHealthChecker: ToolHealthCheckSystem | null = null;

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
    const clientCount = mcpClient?.getConnectedClients().length || 0;
    logBoth("info", `[Chat API] 🔌 Client connected: ${name} (${clientCount} total)`);
  });

  mcpClient.on("connectedClients", (clients: string[]) => {
    // Silent - already logged in clientConnected
  });

  mcpClient.on("toolLoaded", (info: { client: string; tool: string }) => {
    // Silent - tools will be summarized in ready event
  });

  mcpClient.on("ready", () => {
    const toolCount = mcpClient?.getAvailableTools().length || 0;
    logBoth("info", `[Chat API] ✅ Ready | ${toolCount} tools loaded`);
    
    // Start tool health check system
    if (mcpClient && !toolHealthChecker) {
      toolHealthChecker = new ToolHealthCheckSystem(mcpClient);
      toolHealthChecker.startHealthChecks(); // Check every 5 minutes
      logBoth("info", "[Chat API] 🏥 Tool Health Check System activated");
    }
  });

  // Health check monitoring events
  mcpClient.on("healthCheck", (status: any) => {
    if (!status.healthy) {
      logBoth("warn", `[Chat API] 🏥 Health check warning: ${status.clients} clients, ${status.tools} tools`);
    }
  });

  mcpClient.on("reconnecting", (info: any) => {
    logBoth("warn", `[Chat API] 🔄 MCP reconnecting (attempt ${info.attempt}/${info.maxAttempts}, backoff: ${info.backoff}ms)`);
  });

  mcpClient.on("reconnected", (info: any) => {
    logBoth("info", `[Chat API] ✅ MCP reconnected successfully: ${info.clients} clients, ${info.tools} tools`);
  });

  mcpClient.on("reconnectionFailed", (info: any) => {
    logBoth("error", `[Chat API] ❌ MCP reconnection failed after ${info.attempts} attempts: ${info.message}`);
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
  fileInfo?: {
    name: string;
    type: string;
    url?: string;
  };
}

interface ClientMessage {
  text: string;
  messages?: ChatMessage[];
  file?: {
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded file data
  };
}

// 🛡️ HARD SCHEMA ENFORCEMENT 🛡️
function sendSafe(ws: any, payload: any) {
  if (!payload) return;

  const safePayload = {
    id: payload.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: payload.type || "message",
    sender: payload.sender || "assistant", // "ai" is now allowed if passed
    text: payload.text || payload.message || "", // FIX: Frontend expects "text", not "message"
    timestamp: payload.timestamp || Date.now(),
    ...payload // Merge other fields (like structuredContent)
  };

  // Ensure "message" field is present for frontend compatibility
  if (!safePayload.message && safePayload.text) {
      safePayload.message = safePayload.text;
  }

  try {
      ws.send(JSON.stringify(safePayload));
  } catch(e) {
      console.error("[Chat API] Send failed:", e);
  }
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
    
    // 1. 🔍 Parse Message Immediately
    let clientMessage: ClientMessage;
    try {
        clientMessage = JSON.parse(data.toString());
    } catch (e) {
        logBoth("error", `[Chat API] Invalid JSON: ${e}`);
        sendSafe(ws, { error: "Invalid JSON", type: "error" });
        return;
    }
    const currentText = clientMessage.text;

    // 2. 🚀 HARD FASTPATH (Before Queue)
    const clientIp = (ws as any).clientIp || 'unknown';
    if (currentText) {
         try {
          const fastPathResult = await tryFastPathWebSocket(
            currentText,
            (payload) => {
                 // Direct pass-through per user request (Handler defines schema)
                 sendSafe(ws, payload);
            },
            { mode: (process.env.FASTPATH_MODE as any) || "on" },
            clientIp
          );

          if (fastPathResult.handled) {
            console.log("[FASTPATH] HARD SHORT-CIRCUIT:", currentText);
            
            // 💾 Persist Assistant Message to Session
            // We need to extract the response text from the payload to save it
            // fastPathResult.responseTextPreview is not always reliable, better to rely on what was sent?
            // Actually, let's use the result from the handler if available, or just the preview
            if (fastPathResult.structuredContent && fastPathResult.structuredContent.result) {
                // Determine text from structured content or result
                 const responseText = typeof fastPathResult.structuredContent.result === 'string' 
                    ? fastPathResult.structuredContent.result 
                    : JSON.stringify(fastPathResult.structuredContent.result);
                    
                 sessionManager.addMessage(sessionId, 'assistant', responseText);
            } else if (fastPathResult.responseTextPreview) {
                 sessionManager.addMessage(sessionId, 'assistant', fastPathResult.responseTextPreview);
            }

            // ✅ RESTORE DONE EVENT (Required for frontend lifecycle)
            sendSafe(ws, { type: "done" });
            
            return; // 🛑 HARD STOP
          }
         } catch (e) {
             console.error("FastPath Error:", e);
         }
    }

    console.log("=== AFTER FASTPATH BLOCK ==="); // KILL SWITCH TEST

    // Enqueue the message processing to prevent overload
    await requestQueue.enqueue(messageId, async () => {
      try {
        // clientMessage is already parsed above
        
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
      logBoth('info', `Received WebSocket message (textLength: ${clientMessage.text?.length || 0}, historySize: ${clientMessage.messages?.length || 0}, hasFile: ${!!clientMessage.file})`);

      // Get full message history from client or initialize empty
      let sessionHistory: ChatMessage[] = clientMessage.messages || [];
      
      // 📎 Handle file attachment
      let fileContext = "";
      if (clientMessage.file) {
        const file = clientMessage.file;
        logBoth('info', `[File Upload] Processing file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)}KB)`);
        
        // Check if it's an image file
        if (file.type.startsWith('image/')) {
          // For now, just acknowledge the image
          // TODO: Implement image processing with vision AI
          fileContext = `\n[ผู้ใช้แนบรูปภาพ: ${file.name}]`;
          logBoth('info', `[File Upload] Image file detected: ${file.name}`);
        } else {
          // Other file types
          fileContext = `\n[ผู้ใช้แนบไฟล์: ${file.name} (${file.type})]`;
          logBoth('info', `[File Upload] File attached: ${file.name} (${file.type})`);
        }
      }

      if (!currentText) {
        sendSafe(ws, { error: "Text is required", type: "error" });
        return;
      }
      
      // Add file context to the message if present
      const messageWithFile = currentText + fileContext;
      



      // 📝 Log user message to session (with file indicator if present)
      const currentSessionId = (ws as any).sessionId;
      sessionManager.addMessage(currentSessionId, 'user', messageWithFile);
      logBoth('info', `[Session] Added user message to session ${currentSessionId}${fileContext ? ' (with file)' : ''}`);
      
      // 🎯 Start response tracking
      sessionManager.startResponse(currentSessionId);

      // (FastPath check moved to top)

      // 🎯 God-Tier Router: 4-stage context-aware intent classification (Keyword + Semantic + Ambiguity + LLM)
      let semanticCategory: string | null = null;
      try {
        const godTierRouter = getGodTierRouter();
        const startTime = Date.now();
        
        // Get last 2 messages from history for context
        const conversationHistory = sessionHistory.slice(-2).map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date()
        }));
        
        const routingResult = await godTierRouter.route(messageWithFile, conversationHistory);
        semanticCategory = routingResult.category;
        const latency = Date.now() - startTime;
        
        logBoth('info', `[God-Tier Router] 🎯 Category: "${semanticCategory}" (confidence: ${routingResult.confidence.toFixed(2)}, ${latency}ms)`);
        
        if (routingResult.isAmbiguous) {
          logBoth('info', `[God-Tier Router] ⚠️  Ambiguous query - used reasoning: ${routingResult.reasoning}`);
        }
        
        // Log matched keywords and scores
        if (routingResult.matchedKeywords && routingResult.matchedKeywords.length > 0) {
          logBoth('info', `[God-Tier Router] 🔑 Keywords: ${routingResult.matchedKeywords.join(', ')}`);
        }
        if (routingResult.keywordScore !== undefined && routingResult.semanticScore !== undefined) {
          logBoth('info', `[God-Tier Router] 📊 Keyword: ${routingResult.keywordScore.toFixed(2)} | Semantic: ${routingResult.semanticScore.toFixed(2)}`);
        }
      } catch (err) {
        logBoth('warn', `[God-Tier Router] ⚠️  Routing failed: ${err}, falling back to MCP default`);
      }

      // 🎯 Intent-based handling: DISABLED FOR WEATHER (use MCP tools instead)
      // Weather queries should use NWP/TMD tools via MCP, not Open-Meteo direct API
      /*
      const { handleByIntent } = await import("../../utils/intent/handler");
      const intentResult = await handleByIntent(messageWithFile);
      
      if (intentResult.handled) {
        logBoth('info', `[Intent] ✅ Handled ${intentResult.intent} in ${intentResult.latencyMs}ms`);
        
        // Send response as chunk
        ws.send(JSON.stringify({ 
          type: "chunk", 
          text: intentResult.response,
          structuredContent: intentResult.structuredContent
        }));
        
        // Update history
        const aiMessage: any = { sender: "ai", text: intentResult.response || "" };
        if (intentResult.structuredContent) {
          aiMessage.structuredContent = intentResult.structuredContent;
        }
        sessionHistory.push({ sender: "user", text: messageWithFile });
        sessionHistory.push(aiMessage);
        
        // Log to session
        const toolsUsed = intentResult.sources?.map(s => s.name) || [intentResult.intent || 'Intent'];
        sessionManager.addMessage(currentSessionId, 'assistant', intentResult.response || "", toolsUsed);
        
        ws.send(JSON.stringify({
          type: "history-update",
          messages: sessionHistory,
          structuredContent: intentResult.structuredContent
        }));
        
        return; // Intent handler responded, done!
      }
      */
      
      logBoth('info', `[Intent] ⚠️  Weather Intent Handler DISABLED - using MCP tools (NWP/TMD priority)`);

      // Add user message to history (with file context)
      sessionHistory.push({ sender: "user", text: messageWithFile });
      logBoth('info', `Session history prepared (totalMessages: ${sessionHistory.length}, mode: ${AI_MODE})`);

      // 🎭 Detect user emotion
      const { detectEmotion, getEmotionPrompt, logEmotion } = await import("../../utils/emotionDetector");
      const emotionResult = detectEmotion(messageWithFile);
      logEmotion(currentSessionId, undefined, emotionResult);
      sessionManager.updateUserEmotion(currentSessionId, emotionResult.emotion);

      // 🧠 Inject session context for AI memory
      const recentContext = sessionManager.buildContextString(currentSessionId, 5);
      let contextPrefix = '';
      if (recentContext) {
        contextPrefix = `<conversation_history>\n${recentContext}</conversation_history>\n\n`;
        logBoth('info', `[Session] Injected ${sessionManager.getRecentMessages(currentSessionId, 5).length} recent messages as context`);
      }

      // เพิ่ม emotion context
      const emotionPrompt = getEmotionPrompt(emotionResult);
      contextPrefix += `<user_emotion>${emotionPrompt}</user_emotion>\n\n`;

      let finalMessage = currentText;
      let mcpContext = "";
      let structuredContent: any = undefined;
      let toolsUsedInThisRequest: string[] = [];

      // **Process with MCP**
      if (mcpClient) {
        logBoth('info', `Processing with MCP client (messageLength: ${currentText.length})`);
        try {
          // 🧠 Pass semantic category hint to MCP for smarter tool selection (hybrid mode)
          const mcpResult = await mcpClient.processMessage(
            currentText,
            semanticCategory || undefined
          );

          if (mcpResult.needsTools) {
            logBoth("info", `[Chat API] MCP tools executed: ${mcpResult.toolResults?.length}`);
            
            // Track tools used
            if (mcpResult.toolResults) {
              toolsUsedInThisRequest = mcpResult.toolResults.map(r => r.toolName);
            }

            sendSafe(ws, {
                type: "mcp-status",
                text: "กำลังประมวลผลด้วย MCP tools...",
                tools: mcpResult.toolResults?.map((r) => r.toolName) || [],
            });

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

            // PATCH 2 (weather performance): bypass Ollama finalize when weatherPipeline already has a complete answer.
            // Only use LLM if user explicitly asks for deeper explanation.
            const wantsDeepExplain = /อธิบายเชิงลึก|ละเอียด|สรุปเป็นภาษาคน|เหตุผล|วิเคราะห์/i.test(currentText || "");
            const weatherTool = mcpResult.toolResults?.find((r) => r && r.toolName === "weatherPipeline");
            const weatherResults = Array.isArray(weatherTool?.structuredContent)
              ? (weatherTool!.structuredContent as any[])
              : null;

            if (weatherResults && !wantsDeepExplain) {
              const renderBkkDateStr = (offsetDays: number): string => {
                const now = new Date();
                const bkkMs = now.getTime() + (7 * 60 * 60 * 1000);
                const bkk = new Date(bkkMs);
                bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
                const dd = String(bkk.getUTCDate()).padStart(2, "0");
                const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
                const yyyy = bkk.getUTCFullYear();
                return `${dd}/${mm}/${yyyy}`;
              };

              const firstOk = weatherResults.find((r: any) => r && r.type !== "error") || weatherResults[0];

              let finalText = "";

              if (!firstOk || firstOk.type === "error") {
                const err = String(firstOk?.error || "WEATHER_PIPELINE_ERROR");
                if (err === "PROVINCE_MISSING") {
                  finalText = "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการ (เช่น \"พรุ่งนี้เชียงใหม่ฝนตกไหม\")";
                } else if (err === "TIMEOUT") {
                  finalText = "ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา (TIMEOUT) ลองใหม่อีกครั้งได้ครับ";
                } else {
                  finalText = `ขออภัย ระบบพยากรณ์อากาศขัดข้อง (${err})`;
                }
              } else if (firstOk.type === "national") {
                const d = firstOk.data || {};
                const label = d.dateLabel || "พรุ่งนี้";
                const topN = d.topN ?? (Array.isArray(d.rows) ? d.rows.length : 0);
                const note = d.note ? `\n\nหมายเหตุ: ${d.note}` : "";
                const table = d.tableMarkdown ? `\n\n${d.tableMarkdown}` : "";
                finalText = `จังหวัดที่ฝนตกมากสุดในไทย (${label}) Top ${topN}${table}${note}`;
              } else if (firstOk.type === "forecast7d") {
                const province = firstOk.province || "";
                const f = firstOk.data?.forecast;
                const targetDate = /วันนี้|ตอนนี้|ขณะนี้/i.test(currentText || "") ? renderBkkDateStr(0) : renderBkkDateStr(1);

                if (f && typeof f === "object" && Array.isArray((f as any).ForecastDate)) {
                  const idx = ((f as any).ForecastDate as string[]).indexOf(targetDate);
                  const i = idx >= 0 ? idx : 0;
                  const rain = Number((f as any).PercentRainCover?.[i]) || 0;
                  const tmax = (f as any).MaximumTemperature?.[i];
                  const tmin = (f as any).MinimumTemperature?.[i];
                  const desc = String((f as any).DescriptionThai?.[i] || "").trim();
                  finalText = `พยากรณ์อากาศ${province} (${targetDate}): โอกาสฝน ~${rain}% อุณหภูมิ ${tmin ?? "—"}–${tmax ?? "—"}°C${desc ? `, ${desc}` : ""}`;
                } else {
                  finalText = `พยากรณ์อากาศ${province}: ดึงข้อมูลพยากรณ์ 7 วันสำเร็จ (หากต้องการ \"ตาราง\" บอกได้ครับ)`;
                }
              } else if (firstOk.type === "station3h") {
                const province = firstOk.province || "";
                const list = Array.isArray(firstOk.data) ? firstOk.data : [];
                const s = list[0] || {};
                const temp = s.Temp ?? s.Temperature ?? s.AirTemperature ?? s.TempC;
                finalText = `อากาศตอนนี้${province}: พบข้อมูลสถานี ${list.length} จุด${temp !== undefined ? `, อุณหภูมิประมาณ ${temp}°C` : ""}`;
              } else {
                finalText = `ผลพยากรณ์อากาศ (${firstOk.type}) สำหรับ ${firstOk.province || "พื้นที่ที่ถาม"}`;
              }

              const aiMessage: any = { sender: "ai", text: finalText };
              if (weatherTool?.structuredContent) aiMessage.structuredContent = weatherTool.structuredContent;
              if (toolsUsedInThisRequest.length > 0) aiMessage.toolsUsed = toolsUsedInThisRequest;
              sessionHistory.push(aiMessage);

              const chunkMsg: any = { type: "chunk", text: finalText };
              if (weatherTool?.structuredContent) chunkMsg.structuredContent = weatherTool.structuredContent;
              sendSafe(ws, chunkMsg);
              sendSafe(ws, { type: "history-update", messages: sessionHistory });
              return; // ✅ Skip Ollama finalize
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
            sendSafe(ws, { type: "chunk", text: sorryMessage });
            sendSafe(ws, {
                type: "history-update",
                messages: sessionHistory,
            });
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

        const ollamaMessages = [systemPrompt];

        // PERFORMANCE OPTIMIZATION: History Truncation
        // If we have fresh MCP context (e.g. weather data), we assume the user wants an answer based on THAT.
        // We drop older history (keep only last 2 turns) to maximize attention on the new data and reduce token count.
        if (mcpContext) {
            const recentHistory = sessionHistory.slice(-3, -1); // Keep last interaction only
            ollamaMessages.push(...recentHistory.map((m) => ({
                role: m.sender === "ai" ? "assistant" : "user",
                content: m.text,
            })));
            logBoth('info', `[Chat API] ⚡ Optimization: Truncated history to last ${recentHistory.length} messages due to MCP context.`);
        } else {
            // Normal conversation: use full history
            ollamaMessages.push(...sessionHistory.slice(0, -1).map((m) => ({
                role: m.sender === "ai" ? "assistant" : "user",
                content: m.text,
            })));
        }

        ollamaMessages.push({ 
            role: "user", 
            content: contextPrefix + (mcpContext ? `${mcpContext}\n\n` : '') + currentText 
        });

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
            num_predict: 1024,       // ✅ เพิ่มจาก 512 เป็น 1024 สำหรับ response ที่ยาวขึ้น (เช่น รายการจังหวัด)
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
        let lastProgressTime = Date.now();
        const progressInterval = 15000; // แจ้งทุก 15 วินาที

        logBoth('info', `Receiving streamed response from Ollama (model: ${ollamaModel})`);
        
        // 🎯 Progress Messages แบบ Random & Dynamic (Natural Language)
        const thinkingMessages = [
          "🤔 กำลังคิดคำตอบ...",
          "💭 กำลังวิเคราะห์คำถามของคุณ...",
          "🧠 กำลังประมวลผลข้อมูล...",
          "⚡ กำลังค้นหาข้อมูลที่เหมาะสม...",
          "📊 กำลังรวบรวมข้อมูล...",
          "🔍 กำลังตรวจสอบรายละเอียด...",
          "✨ กำลังเตรียมคำตอบที่ดีที่สุด...",
          "🎯 กำลังจัดเรียงข้อมูล...",
          "💡 กำลังค้นหาคำตอบ...",
          "🚀 กำลังประมวลผล...",
        ];
        const randomThinking = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
        
        // ส่ง progress indicator เริ่มต้น
        sendSafe(ws, { 
          type: "progress", 
          text: randomThinking,
          stage: "thinking"
        });

        for await (const chunk of responseStream) {
          if (!chunk.message || !chunk.message.content) continue;
          chunkCount++;

          // ส่ง progress update ทุก 15 วินาที
          const now = Date.now();
          if (now - lastProgressTime > progressInterval) {
            const elapsedSec = Math.floor((now - streamStartTime) / 1000);
            sendSafe(ws, { 
              type: "progress", 
              text: `⏳ ยังคงประมวลผล... (${elapsedSec}วินาที)`,
              stage: "processing",
              elapsed: elapsedSec
            });
            lastProgressTime = now;
          }

          if (isFirstChunk && mcpContext) {
            sendSafe(ws, { type: "mcp-context", text: mcpContext });
            isFirstChunk = false;
          }

          aiResponse += chunk.message.content;

          // Send the incoming chunk as-is to the client (frontend will append)
          // Include structuredContent if available (e.g., chartSvg)
          const chunkMsg: any = { type: "chunk", text: chunk.message.content };
          if (structuredContent) {
            chunkMsg.structuredContent = structuredContent;
            // ✅ Log only on first chunk to reduce spam
            if (isFirstChunk) {
              console.log("[Chat API] Response includes structuredContent, keys:", Object.keys(structuredContent));
            }
          }
          sendSafe(ws, chunkMsg);
        }

        const streamDuration = Date.now() - streamStartTime;
        logBoth('info', `Stream completed (duration: ${streamDuration}ms, chunkCount: ${chunkCount}, responseLength: ${aiResponse.length}, model: ${ollamaModel})`);

        // � Validate Thai language (must be Thai only)
        const languageCheck = validateThaiLanguage(aiResponse, { originalQuestion: currentText });
        if (!languageCheck.isThaiOnly) {
          logBoth('warn', `[Language Validator] ⚠️ Non-Thai response detected! Stripping non-Thai segments...`);
          logBoth('warn', `  - Original question: ${currentText}`);
          logBoth('warn', `  - Invalid response preview: ${aiResponse.substring(0, 200)}...`);
          
          // Send warning to client
          sendSafe(ws, {
            type: "warning",
            text: "⚠️ กำลังปรับปรุงคำตอบให้เป็นภาษาไทย..."
          });
          
          // Use SANITIZATION instead of REWRITE (Requirement: Strip non-Thai tokens)
          logBoth('warn', `[Language Validator] ⚠️ Non-Thai response detected! Stripping non-Thai segments...`);
          
          const sanitized = sanitizeThaiSegments(aiResponse);
          
          if (sanitized.length < 5) {
             logBoth('error', `[Language Validator] ❌ Sanitization removed almost everything.`);
             // If validation fails completely, use fallback error message
             aiResponse = createThaiErrorResponse(currentText);
          } else {
             aiResponse = sanitized;
             logBoth('info', `[Language Validator] ✅ Sanitized response (New length: ${aiResponse.length})`);
          }

        } else {
          logBoth('info', `[Language Validator] ✅ Response is Thai-only (${languageCheck.confidence.toFixed(1)}% Thai)`);
          
          // Log AI response for quality monitoring
          const previewLength = Math.min(aiResponse.length, 300);
          logBoth('info', `[AI Response] "${aiResponse.substring(0, previewLength)}${aiResponse.length > 300 ? '...' : ''}"`);
          if (aiResponse.length > 300) {
            logBoth('info', `[AI Response] Full length: ${aiResponse.length} chars`);
          }
        }

        // �📝 สำหรับ response ยาว (>1000 ตัวอักษร) ส่ง summary ก่อน
        if (aiResponse.length > 1000 && chunkCount > 300) {
          const summaryText = `📋 ตอบเสร็จแล้ว! (${aiResponse.length} ตัวอักษร, ใช้เวลา ${Math.floor(streamDuration/1000)}วินาที)`;
          sendSafe(ws, { 
            type: "response-summary", 
            text: summaryText,
            length: aiResponse.length,
            duration: streamDuration
          });
        }

        // Add AI response to history and send back to client
        const aiMessage: any = { sender: "ai", text: aiResponse };
        if (structuredContent) {
          aiMessage.structuredContent = structuredContent;
        }
        // Add toolsUsed if any tools were used
        if (toolsUsedInThisRequest.length > 0) {
          aiMessage.toolsUsed = toolsUsedInThisRequest;
        }
        sessionHistory.push(aiMessage);
        
        // 📝 Log AI response to session with tools used
        sessionManager.addMessage(currentSessionId, 'assistant', aiResponse, toolsUsedInThisRequest.length > 0 ? toolsUsedInThisRequest : undefined);
        sessionManager.completeResponse(currentSessionId); // ✅ Complete tracking
        logBoth('info', `[Session] Added AI response to session (tools: ${toolsUsedInThisRequest.join(', ') || 'none'})`);
        
        logBoth('info', `AI response complete (responseLength: ${aiResponse.length}, totalMessages: ${sessionHistory.length})`);

        // Send updated history back to client with toolsUsed
        sendSafe(ws, {
            type: "history-update",
            messages: sessionHistory,
            toolsUsed: toolsUsedInThisRequest.length > 0 ? toolsUsedInThisRequest : undefined,
          });
      } catch (ollamaError) {
        logBoth("error", `[Chat API] Ollama error: ${ollamaError}`);
        logBoth('error', `Ollama chat error: ${ollamaError instanceof Error ? ollamaError.message : String(ollamaError)} (model: ${ollamaModel}, mode: ${AI_MODE})`);
        sendSafe(ws, { error: "Failed to get response from AI model", type: "error" });
        return;
      }
    } catch (error) {
      logBoth("error", `[Chat API] Error parsing message: ${error}`);
      logBoth('error', `Message parsing error: ${error instanceof Error ? error.message : String(error)}`);
      sendSafe(ws, { error: "Invalid message format", type: "error" });
    }
    }).catch(queueError => {
      logBoth("error", `[Queue] Failed to process message: ${queueError}`);
      try {
        sendSafe(ws, { error: "Server busy, please try again", type: "error" });
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
// 🔐 optionalAuth: Attach user info if logged in, allow guests
// 🎯 guestLimiter: Restrict guests to 50% capability
// NOTE: Mounted at /api/chat, so this should be the root path
chatRouter.post("/", optionalAuth, guestLimiterMiddleware, fastPathChatMiddleware(), async (req, res) => {
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
    content: `คุณเป็น AI ผู้ช่วยภาษาไทย ที่ฉลาด เข้าใจบริบท และตอบคำถามได้แม่นยำ:

**⚠️ กฎที่สำคัญที่สุด - ภาษาไทยบริสุทธิ์ 100%:**
1. **ตอบเป็นภาษาไทยเท่านั้น** - ห้ามมีตัวอักษรจีน อังกฤษ หรือภาษาอื่นใด ๆ
2. **คำศัพท์เทคนิคเท่านั้น** - API, URL, JSON ใช้อังกฤษได้ แต่ต้องอธิบายเป็นไทย
3. **ตรวจสอบก่อนส่ง** - ถ้ามีภาษาจีน/อังกฤษปน → ห้ามส่ง แปลเป็นไทยก่อน
4. **ห้ามเอ่ยชื่อ tool/MCP/ระบบ** - ตอบเหมือนคุณรู้เองโดยธรรมชาติ

**ตัวอย่างที่ถูกต้อง:**
- ❌ "ไม่มีข้อมูล, you can check later" → ✅ "ขออภัย ยังไม่มีข้อมูลในขณะนี้"
- ❌ "กรุงเทพ temperature 30°C" → ✅ "กรุงเทพอุณหภูมิ 30 องศาเซลเซียส"
- ❌ "查询完成" → ✅ "ตรวจสอบเรียบร้อยแล้ว"

**บริบทสำคัญ:**
- คุณให้บริการผู้ใช้ชาวไทยเป็นหลัก
- เวลา/สถานที่/อากาศโดยไม่ระบุ → **สันนิษฐานว่าหมายถึงประเทศไทย**
  - "ตอนนี้กี่โมง" = เวลาไทย
  - "ฝนตกไหม" = อากาศไทย (ปัจจุบัน)
  - "พรุ่งนี้ฝนตก" = พยากรณ์อากาศไทย (อนาคต)
  - "กลางดึกคืนนี้" = เวลากลางคืนวันนี้ (อนาคต)
  - "โคราช" = นครราชสีมา, "กทม" = กรุงเทพมหานคร

**เข้าใจข้อจำกัดข้อมูล:**
- ข้อมูล **ปัจจุบัน** (3 ชั่วโมง) ≠ **พยากรณ์** (7 วัน)
- ถ้าถามเรื่อง **อนาคต** (กลางดึก/พรุ่งนี้) แต่มีแค่ข้อมูล**ปัจจุบัน** → ตอบว่า "ข้อมูลที่มีเป็นข้อมูลปัจจุบัน ไม่สามารถพยากรณ์ได้"
- **ห้ามเดา ห้ามสมมติ** - ตอบจากข้อมูลที่มีเท่านั้น

**การจัดรูปแบบ (Markdown):**
- ใช้ # หัวข้อหลัก, ## หัวข้อย่อย
- ใช้ **ตัวหนา** สำหรับข้อมูลสำคัญ
- ใช้ bullet points (-) หรือ numbering (1. 2.)
- ตาราง: | คอลัมน์ 1 | คอลัมน์ 2 |
- Code: \`\`\`python ... \`\`\`

**หลักการตอบ:**
- เข้าใจคำถามลึกซึ้ง (อ่านเจตนา ไม่ใช่แค่คำ)
- ตอบตรงประเด็น กระชับ ชัดเจน **ภาษาไทยบริสุทธิ์**
- หากข้อมูลไม่ครบ → บอกข้อจำกัด ไม่เดา
- **จำไว้: ตอบเป็นภาษาไทยเท่านั้น ห้ามปนภาษาอื่น!**`,
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

// --- 9. MCP Health & Reconnection Endpoints ---
chatRouter.get("/mcp/health", (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({
      healthy: false,
      error: "MCP client not initialized",
    });
  }

  const stats = mcpClient.getStatistics();
  const tools = mcpClient.getAvailableTools();
  const clients = mcpClient.getConnectedClients();

  const healthy = clients.length > 0 && tools.length > 0;

  res.json({
    healthy,
    timestamp: new Date().toISOString(),
    clients: {
      count: clients.length,
      names: clients,
    },
    tools: {
      count: tools.length,
      total: stats.availableTools,
    },
    resources: {
      count: stats.availableResources,
    },
    cache: {
      queries: stats.cachedQueries,
      historySize: stats.historySize,
    },
    aiMode: stats.aiMode,
  });
});

chatRouter.post("/mcp/reconnect", async (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({
      success: false,
      error: "MCP client not initialized",
    });
  }

  try {
    logBoth("info", "[Chat API] Manual MCP reconnection requested");
    
    // Trigger reconnection in background
    mcpClient.forceReconnect().catch((err) => {
      logBoth("error", `[Chat API] Manual reconnection failed: ${err}`);
    });

    res.json({
      success: true,
      message: "Reconnection initiated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logBoth("error", `[Chat API] Error initiating reconnection: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to initiate reconnection",
    });
  }
});

// --- 10. Tool Health Check Endpoints ---
chatRouter.get("/tools/health", (req, res) => {
  if (!toolHealthChecker) {
    return res.status(503).json({
      error: "Tool health checker not initialized",
      available: false,
    });
  }

  try {
    const healthData = toolHealthChecker.getHealthStatusJSON();
    res.json(healthData);
  } catch (error) {
    logBoth("error", `[Chat API] Error getting tool health: ${error}`);
    res.status(500).json({
      error: "Failed to get tool health status",
    });
  }
});

chatRouter.post("/tools/health/check", async (req, res) => {
  if (!toolHealthChecker) {
    return res.status(503).json({
      success: false,
      error: "Tool health checker not initialized",
    });
  }

  try {
    logBoth("info", "[Chat API] Manual tool health check requested");
    
    // Trigger health check in background
    toolHealthChecker.triggerManualCheck().catch((err) => {
      logBoth("error", `[Chat API] Manual health check failed: ${err}`);
    });

    res.json({
      success: true,
      message: "Health check initiated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logBoth("error", `[Chat API] Error initiating health check: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to initiate health check",
    });
  }
});

export { chatRouter, wss, mcpClient, toolHealthChecker };


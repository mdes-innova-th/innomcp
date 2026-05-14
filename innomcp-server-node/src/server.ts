import "dotenv/config";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import path from "path";
import fs from "fs";


import app from "./app";
import { logBoth } from "./utils/mcpLogger";

dotenv.config();

// Simple file logger for MCP Server


const host = process.env.SERVER_HOST || "0.0.0.0";
const port = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 3012;

// Helper: send a JSON-RPC error response (default: -32602 Invalid params)
function sendJsonRpcError(
  res: any,
  id: any = null,
  code: number = -32602,
  message: string = "Invalid params",
  data?: any
): any {
  const payload = {
    jsonrpc: "2.0",
    error: {
      code,
      message,
      data,
    },
    id,
  };

  // If headers already sent, do nothing
  if (res && res.headersSent) {
    return;
  }

  // Send JSON-RPC error response (use 200 per JSON-RPC over HTTP recommendations)
  return res.status(200).json(payload);
}

// Register tools from separate modules
import { registerDateTimeTool } from "./mcp/tools/dateTimeTool";
import { registerTmdTool as registerTmdTool } from "./mcp/tools/tmdTools";
import { registerWebdTools } from "./mcp/tools/webdTools";
import { registerEvidenceTool } from "./mcp/tools/evidenceTool";
import { registerEchartsTool } from "./mcp/tools/echartsTool";
import { registerCalculatorTool } from "./mcp/tools/calculatorTool";
import { registerThaiGeoTool } from "./mcp/tools/thaiGeoTool";
import { registerThaiHistoryTool } from "./mcp/tools/thaiHistoryTool";
import { registerThaiLawTool } from "./mcp/tools/thaiLawTool";
import { registerThaiKnowledgeTool } from "./mcp/tools/thaiKnowledgeTool";
import { registerThaiReligionTool } from "./mcp/tools/thaiReligionTool";

// NEW: Session 8.8 - Data Access & Calculation Tools
import archiveTool from "./mcp/tools/archiveTool";
import nasaTool from "./mcp/tools/nasaTool";
import weatherTool from "./mcp/tools/weatherTool";
import worldBankTool from "./mcp/tools/worldBankTool";
import govDataTool from "./mcp/tools/govDataTool";
import newtonTool from "./mcp/tools/newtonTool";

// NEW: 2026-01-05 - World-Class MCP Tools
import currencyExchangeTool from "./mcp/tools/currencyExchangeTool";
import qrCodeTool from "./mcp/tools/qrCodeTool";
import translationTool from "./mcp/tools/translationTool";
import rssFeedTool from "./mcp/tools/rssFeedTool";
import codeFormatterTool from "./mcp/tools/codeFormatterTool";

// NEW: 2026-01-05 - Essential Free Tools (Phase 2)
import ocrTool from "./mcp/tools/ocrTool";
import fileReaderTool from "./mcp/tools/fileReaderTool";
import imageGeneratorTool from "./mcp/tools/imageGeneratorTool";

// NEW: 2026-05-14 — Phase 10.19 register previously-orphaned tools
import { storageTool } from "./mcp/tools/storageTool";
import { keywordTool } from "./mcp/tools/keywordTool";

// NEW: 2026-01-06 - NWP Weather Forecast Tools (High Performance Computing)
import {
  nwpHourlyByLocationTool,
  nwpHourlyByPlaceTool,
  nwpHourlyByRegionTool
} from "./mcp/tools/nwpHourlyTool";
import {
  nwpDailyByLocationTool,
  nwpDailyByPlaceTool,
  nwpDailyByRegionTool
} from "./mcp/tools/nwpDailyTool";

// Create MCP server instance and register tools
const mcpserver = new McpServer({
  name: "INNOMCP Server",
  version: "1.0.0",
});


// Phase 4: Intelligence Pipeline Integration
import { IntelligencePipeline } from "./intelligence/pipeline";

// Feature Flag
const USE_INTELLIGENCE_PIPELINE = process.env.USE_INTELLIGENCE_PIPELINE === "true";

// Tool Registry for Pipeline
const toolsRegistry: Record<string, any> = {};

// Monkey-patch registerTool to collect tools
const originalRegister = mcpserver.registerTool.bind(mcpserver);
mcpserver.registerTool = (name: string, ...args: any[]) => {
    // args[0] might be schema or details, args[1] represents execute
    // Type definition for registerTool varies, but usually it's (name, details, execute) 
    // OR (name, schema, execute)
    // Based on usage in file: mcpserver.registerTool(name, { ... }, execute)
    
    // We need to capture the execute function. 
    // In SDK, it might be: registerTool(name, description, handler)
    // Let's safe guard.
    const execute = args[args.length - 1]; // Execute is usually last
    if (typeof execute === "function") {
        toolsRegistry[name] = { execute };
    }
    return originalRegister(name, ...args as [any, any]); 
};

// Register essential tools only (10 tools for 2025 professional system)
registerDateTimeTool(mcpserver);
registerTmdTool(mcpserver); // ENABLED for Thailand Meteorological Department Data
registerWebdTools(mcpserver);
registerEvidenceTool(mcpserver);
registerEchartsTool(mcpserver); // ✅ ENABLED for visualization
registerCalculatorTool(mcpserver); // Enhanced as MathTool
registerThaiGeoTool(mcpserver);
registerThaiHistoryTool(mcpserver);
registerThaiLawTool(mcpserver);
registerThaiKnowledgeTool(mcpserver);
registerThaiReligionTool(mcpserver); // New Phase 5 Tools

// Register NEW Session 8.8 tools (direct tool objects)
mcpserver.registerTool(archiveTool.name, {
  title: "Internet Archive Search Tool",
  description: archiveTool.description,
  inputSchema: archiveTool.inputSchema,
}, archiveTool.execute);

mcpserver.registerTool(nasaTool.name, {
  title: "NASA Open Data Tool",
  description: nasaTool.description,
  inputSchema: nasaTool.inputSchema,
}, nasaTool.execute);

mcpserver.registerTool(weatherTool.name, {
  title: "Weather Forecast Tool",
  description: weatherTool.description,
  inputSchema: weatherTool.inputSchema,
}, weatherTool.execute);

// Register worldBankTool
mcpserver.registerTool(worldBankTool.name, {
  title: "World Bank Data Tool",
  description: worldBankTool.description,
  inputSchema: worldBankTool.inputSchema
}, worldBankTool.execute);
  


mcpserver.registerTool(govDataTool.name, {
  title: "US Government Data Tool",
  description: govDataTool.description,
  inputSchema: govDataTool.inputSchema,
}, govDataTool.execute);

mcpserver.registerTool(newtonTool.name, {
  title: "Newton Symbolic Math Tool",
  description: newtonTool.description,
  inputSchema: newtonTool.inputSchema,
}, newtonTool.execute);

// Register NEW World-Class Tools (2026-01-05)
mcpserver.registerTool(currencyExchangeTool.name, {
  title: "Currency Exchange Tool",
  description: currencyExchangeTool.description,
  inputSchema: currencyExchangeTool.inputSchema,
}, currencyExchangeTool.execute);

mcpserver.registerTool(qrCodeTool.name, {
  title: "QR Code Generator Tool",
  description: qrCodeTool.description,
  inputSchema: qrCodeTool.inputSchema,
}, qrCodeTool.execute);

mcpserver.registerTool(translationTool.name, {
  title: "Translation Tool",
  description: translationTool.description,
  inputSchema: translationTool.inputSchema,
}, translationTool.execute);

mcpserver.registerTool(rssFeedTool.name, {
  title: "RSS Feed Reader Tool",
  description: rssFeedTool.description,
  inputSchema: rssFeedTool.inputSchema,
}, rssFeedTool.execute);

mcpserver.registerTool(codeFormatterTool.name, {
  title: "Code Formatter Tool",
  description: codeFormatterTool.description,
  inputSchema: codeFormatterTool.inputSchema,
}, codeFormatterTool.execute);

// Register Phase 2 Tools - Essential Free Tools
mcpserver.registerTool(ocrTool.name, {
  title: "OCR Tool - อ่านข้อความจากภาพ",
  description: ocrTool.description,
  inputSchema: ocrTool.inputSchema,
}, ocrTool.execute);

mcpserver.registerTool(fileReaderTool.name, {
  title: "File Reader Tool - อ่าน PDF/Excel/Word",
  description: fileReaderTool.description,
  inputSchema: fileReaderTool.inputSchema,
}, fileReaderTool.execute);

mcpserver.registerTool(imageGeneratorTool.name, {
  title: "Image Generator Tool - สร้างรูปภาพ",
  description: imageGeneratorTool.description,
  inputSchema: imageGeneratorTool.inputSchema,
}, imageGeneratorTool.execute);

mcpserver.registerTool(storageTool.name, {
  title: "Workspace Storage - read/write/list files",
  description: storageTool.description,
  inputSchema: storageTool.inputSchema,
}, storageTool.execute);

mcpserver.registerTool(keywordTool.name, {
  title: "Keyword Tool - smart query routing",
  description: keywordTool.description,
  inputSchema: keywordTool.inputSchema,
}, keywordTool.execute);

// Register NWP Weather Forecast Tools (HPC)
mcpserver.registerTool(nwpHourlyByLocationTool.name, {
  title: "NWP Hourly Forecast by Location",
  description: nwpHourlyByLocationTool.description,
  inputSchema: nwpHourlyByLocationTool.inputSchema,
}, nwpHourlyByLocationTool.execute);

mcpserver.registerTool(nwpHourlyByPlaceTool.name, {
  title: "NWP Hourly Forecast by Place",
  description: nwpHourlyByPlaceTool.description,
  inputSchema: nwpHourlyByPlaceTool.inputSchema,
}, nwpHourlyByPlaceTool.execute);

mcpserver.registerTool(nwpHourlyByRegionTool.name, {
  title: "NWP Hourly Forecast by Region",
  description: nwpHourlyByRegionTool.description,
  inputSchema: nwpHourlyByRegionTool.inputSchema,
}, nwpHourlyByRegionTool.execute);

mcpserver.registerTool(nwpDailyByLocationTool.name, {
  title: "NWP Daily Forecast by Location",
  description: nwpDailyByLocationTool.description,
  inputSchema: nwpDailyByLocationTool.inputSchema,
}, nwpDailyByLocationTool.execute);

mcpserver.registerTool(nwpDailyByPlaceTool.name, {
  title: "NWP Daily Forecast by Place",
  description: nwpDailyByPlaceTool.description,
  inputSchema: nwpDailyByPlaceTool.inputSchema,
}, nwpDailyByPlaceTool.execute);

mcpserver.registerTool(nwpDailyByRegionTool.name, {
  title: "NWP Daily Forecast by Region",
  description: nwpDailyByRegionTool.description,
  inputSchema: nwpDailyByRegionTool.inputSchema,
}, nwpDailyByRegionTool.execute);

logBoth('INFO', `[BOOT] Registered ${Object.keys(toolsRegistry).length} essential tools (2026 World-Class System)`);

// ============================================================
// Boot Readiness Report — แสดงทุกครั้งที่ server start
// ============================================================
(function printReadinessReport() {
  const mode = String(process.env.INNOMCP_MODE || "offline").toLowerCase();
  const smokeMode = process.env.SMOKE_MODE === "1";
  const weatherFixtureW1 = process.env.WEATHER_FIXTURE_W1 === "1";

  type ReadinessEntry = { key: string; ready: boolean; note: string; requiredOnline: boolean };
  const checks: ReadinessEntry[] = [
    {
      key: "TMD (TMD_UID / TMD_UKEY)",
      ready: !!(String(process.env.TMD_UID || "").trim() && String(process.env.TMD_UKEY || "").trim()),
      note: "tmdTools.ts — 17 tools",
      requiredOnline: true,
    },
    {
      key: "NWP (NWP_API_KEY)",
      ready: !!String(process.env.NWP_API_KEY || "").trim(),
      note: "nwpDailyTool + nwpHourlyTool — 6 tools",
      requiredOnline: true,
    },
    {
      key: "WEBDDSB (WEBDDSB_HOST / WEBDDSB_APIKEY)",
      ready: !!(String(process.env.WEBDDSB_HOST || "").trim() && String(process.env.WEBDDSB_APIKEY || "").trim()),
      note: "webdTools.ts — 3 tools",
      requiredOnline: false,
    },
    {
      key: "OpenWeather (OPENWEATHER_API_KEY)",
      ready: !!String(process.env.OPENWEATHER_API_KEY || "").trim(),
      note: "weatherTool.ts",
      requiredOnline: false,
    },
    {
      key: "DetectDB (DETECT_DB_HOST / DETECT_DB_USER / DETECT_DB_NAME)",
      ready: !!(
        String(process.env.DETECT_DB_HOST || "").trim() &&
        String(process.env.DETECT_DB_USER || "").trim() &&
        String(process.env.DETECT_DB_NAME || "").trim()
      ),
      note: "evidenceTool.ts",
      requiredOnline: false,
    },
    {
      key: "AppDB (DB_HOST / DB_USER / DB_NAME)",
      ready: !!(
        String(process.env.DB_HOST || "").trim() &&
        String(process.env.DB_USER || "").trim() &&
        String(process.env.DB_NAME || "").trim()
      ),
      note: "db.ts",
      requiredOnline: false,
    },
  ];

  const notReadyRequired = checks.filter((c) => c.requiredOnline && !c.ready);
  const deprecatedEnvDetected = [
    String(process.env.TMD_API_UID || "").trim() ? "TMD_API_UID" : "",
    String(process.env.TMD_API_UKEY || "").trim() ? "TMD_API_UKEY" : "",
  ].filter(Boolean);
  const notReadyOptional = checks.filter((c) => !c.requiredOnline && !c.ready);

  logBoth("INFO", `[READINESS] INNOMCP_MODE=${mode}${smokeMode ? " SMOKE_MODE=1" : ""}${weatherFixtureW1 ? " WEATHER_FIXTURE_W1=1" : ""}`);
  for (const c of checks) {
    const mark = c.ready ? "READY  " : (c.requiredOnline ? "MISSING*" : "missing ");
    logBoth(c.ready ? "INFO" : "WARN", `[READINESS]   ${mark} ${c.key}  (${c.note})`);
  }

  if (deprecatedEnvDetected.length > 0) {
    logBoth("WARN", `[READINESS] deprecated env vars detected (ignored): ${deprecatedEnvDetected.join(", ")}. Use TMD_UID/TMD_UKEY instead.`);
  }

  if (mode === "online" && notReadyRequired.length > 0) {
    logBoth("ERROR", `[READINESS] MODE=online แต่ขาด key จำเป็น: ${notReadyRequired.map((c) => c.key).join(", ")}`);
    logBoth("ERROR", "[READINESS] *** online tools จะ error จนกว่าจะตั้งค่า env ครบ ***");
  } else if (mode === "offline" && notReadyRequired.length > 0) {
    logBoth("INFO", "[READINESS] MODE=offline — external keys ไม่จำเป็น (ใช้ fixture/smoke)");
  } else if (mode === "online") {
    logBoth("INFO", "[READINESS] MODE=online — keys ครบ พร้อมใช้งาน");
  }

  if (notReadyOptional.length > 0) {
    logBoth("WARN", `[READINESS] optional tools ไม่พร้อม (ไม่ critical): ${notReadyOptional.map((c) => c.key).join(", ")}`);
  }
})();

// Initialize Pipeline (if enabled)
let pipeline: IntelligencePipeline | null = null;
if (USE_INTELLIGENCE_PIPELINE) {
    pipeline = new IntelligencePipeline(toolsRegistry);
    logBoth('INFO', '🚀 Intelligence Pipeline INITIALIZED (Phase 4)');
} else {
    logBoth('INFO', 'ℹ️ Intelligence Pipeline DISABLED (Phase 4)');
}

// Handle incoming MCP requests /////////////////////////////
app.post("/mcp", async (req, res) => {
  const requestStartTime = Date.now();
  const method = req.body?.method || "unknown";
  const toolName = req.body?.params?.name || "N/A";

  // Log start as 0ms (not epoch) for consistency/debuggability.
  logBoth(
    "INFO",
    `[⏱️  0ms] MCP Request started: ${method} ${toolName !== "N/A" ? `(${toolName})` : ""}`
  );
  
  // Basic validation for JSON-RPC request body
  const body = req.body;
  if (!body || (typeof body !== "object" && !Array.isArray(body))) {
    const duration = Date.now() - requestStartTime;
    logBoth('ERROR', `[⏱️  ${duration}ms] Invalid request body`);
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request",
        data: "request body must be an object or array",
      },
      id: null,
    });
  }

  // If single request object includes params, ensure params is object or array
  if (
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "params")
  ) {
    const params = (body as any).params;
    if (
      params !== undefined &&
      typeof params !== "object" &&
      !Array.isArray(params)
    ) {
      const duration = Date.now() - requestStartTime;
      logBoth('ERROR', `[⏱️  ${duration}ms] Invalid params`);
      return sendJsonRpcError(
        res,
        (body as any).id ?? null,
        -32602,
        "Invalid params",
        "params must be an object or array"
      );
    }
  }

  // Create a new transport for each request to prevent request ID collisions
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  let finalized = false;
  let didCloseTransport = false;
  const closeTransport = () => {
    if (didCloseTransport) return;
    didCloseTransport = true;
    try { transport.close(); } catch {}
  };

  const finalizeOnce = (level: "INFO" | "WARN" | "ERROR", msg: string) => {
    if (finalized) return;
    finalized = true;
    logBoth(level, msg);
    closeTransport();
  };

  // FINISH = response has been fully written (true request lifecycle)
  res.on("finish", () => {
    const duration = Date.now() - requestStartTime;
    finalizeOnce(
      "INFO",
      `[⏱️  ${duration}ms] MCP Request completed: ${method} ${toolName !== "N/A" ? `(${toolName})` : ""}`
    );
  });

  // CLOSE = underlying socket closed (may be keep-alive timeout minutes later)
  // Only treat as cancellation if it happens before finish.
  res.on("close", () => {
    if (res.writableEnded) {
      closeTransport();
      return;
    }
    const duration = Date.now() - requestStartTime;
    finalizeOnce(
      "WARN",
      `[⏱️  ${duration}ms] MCP Request closed (client disconnect): ${method} ${toolName !== "N/A" ? `(${toolName})` : ""}`
    );
  });

  // ABORTED = client aborted request before response finished
  req.on("aborted", () => {
    const duration = Date.now() - requestStartTime;
    finalizeOnce(
      "WARN",
      `[⏱️  ${duration}ms] MCP Request aborted (client abort): ${method} ${toolName !== "N/A" ? `(${toolName})` : ""}`
    );
  });

  // ERROR = request/response stream error
  req.on("error", (e: any) => {
    const duration = Date.now() - requestStartTime;
    finalizeOnce(
      "ERROR",
      `[⏱️  ${duration}ms] MCP Request error: ${method} ${toolName !== "N/A" ? `(${toolName})` : ""} err=${String(e?.message || e)}`
    );
  });

  await mcpserver.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// NEW: Smart Query Endpoint (Phase 4)
app.post("/api/smart", async (req, res) => {
    if (!USE_INTELLIGENCE_PIPELINE || !pipeline) {
        return res.status(503).json({ error: "Intelligence Pipeline Disabled" });
    }

    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const safeWrite = (payload: any) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const safeEnd = () => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`data: [DONE]\n\n`);
      res.end();
    };

    try {
      for await (const e of pipeline.execute(query)) {
        safeWrite(e);

        // Professional behavior: close SSE immediately after final answer.
        // This guarantees the high-confidence path never waits for memory.
        if ((e as any)?.type === "final_answer") {
          safeEnd();
          return;
        }
      }
      safeEnd();
    } catch (e: any) {
        safeWrite({ type: "error", message: e?.message || String(e), ms: 0 });
        safeEnd();
    }
});

const server = app.listen(port, host, () => {
  logBoth('INFO', `🚀 MCP Server running on http://${host}:${port}/mcp`);
});

server.on("error", (error: any) => {
  // Handle port in use error more gracefully
  if (error.code === 'EADDRINUSE') {
    logBoth('ERROR', `Port ${port} is already in use. Please stop the existing server or use a different port.`);
    console.error(`\n❌ Port ${port} is already in use. Please:\n  1. Stop the existing server, or\n  2. Set SERVER_PORT to a different port in .env\n`);
  } else {
    logBoth('ERROR', `Server error occurred: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Server error:", error);
  }
  // Don't exit immediately - let nodemon handle the restart
  setTimeout(() => process.exit(1), 1000);
});

export { server, mcpserver };


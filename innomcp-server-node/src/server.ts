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
import { registerEchartsTool } from "./mcp/tools/echartsTool";
import { registerCalculatorTool } from "./mcp/tools/calculatorTool";
import { registerThaiGeoTool } from "./mcp/tools/thaiGeoTool";

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

// Register essential tools only (10 tools for 2025 professional system)
registerDateTimeTool(mcpserver);
registerTmdTool(mcpserver); // ENABLED for Thailand Meteorological Department Data
// DISABLED: registerWebdTools(mcpserver); // Not in allowed list
registerEchartsTool(mcpserver); // ✅ ENABLED for visualization
registerCalculatorTool(mcpserver); // Enhanced as MathTool
registerThaiGeoTool(mcpserver);

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

logBoth('INFO', `✅ Registered 27 essential tools (2026 World-Class System):
  - Core: dateTime, calculator (MathTool)
  - Visualization: echartsTool
  - TMD Weather: 17 endpoints (seismic, climate, stations, forecasts, warnings)
  - Data Access: archive, nasa, weather, worldbank, govdata, newton
  - World-Class: currencyExchange, qrCode, translation, rssFeed, codeFormatter
  - AI/Files: ocrTool, fileReader (PDF/Excel/Word), imageGenerator (Canvas)
  - NWP HPC: 6 tools (hourly/daily by location/place/region, 2km-27km resolution)`);


// Handle incoming MCP requests /////////////////////////////
app.post("/mcp", async (req, res) => {
  const requestStartTime = Date.now();
  const method = req.body?.method || 'unknown';
  const toolName = req.body?.params?.name || 'N/A';
  
  logBoth('INFO', `[⏱️  ${requestStartTime}] MCP Request: ${method} ${toolName !== 'N/A' ? `(${toolName})` : ''}`);
  
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

  res.on("close", () => {
    const duration = Date.now() - requestStartTime;
    logBoth('INFO', `[⏱️  ${duration}ms] MCP Request completed: ${method} ${toolName !== 'N/A' ? `(${toolName})` : ''}`);
    transport.close();
  });

  await mcpserver.connect(transport);
  await transport.handleRequest(req, res, req.body);
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

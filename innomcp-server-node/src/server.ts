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

// NEW: Session 8.8 - Data Access & Calculation Tools
import archiveTool from "./mcp/tools/archiveTool";
import nasaTool from "./mcp/tools/nasaTool";
import weatherTool from "./mcp/tools/weatherTool";
import worldBankTool from "./mcp/tools/worldBankTool";
import govDataTool from "./mcp/tools/govDataTool";
import newtonTool from "./mcp/tools/newtonTool";

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

logBoth('INFO', `✅ Registered 9 essential tools (2025 Professional System):\n  - Core: dateTime, calculator (MathTool)\n  - Visualization: echartsTool\n  - Data Access: archive, nasa, weather, worldbank, govdata, newton`);


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

import "dotenv/config";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// Per-method parameter schemas (JSON-RPC method name -> zod schema)
const methodParamSchemas: Record<string, z.ZodTypeAny> = {
  // calculator tool via RPC: expects { expression: string }
  "calculator.evaluate": z.object({ expression: z.string().min(1) }),
  // datetime tool: optional format
  "dateTime.get": z.object({ format: z.string().optional() }),
  // text analysis: requires non-empty text
  "textAnalysis.analyze": z.object({ text: z.string().min(1) }),
  // webd count: expects query string
  "webd.violationGroupsCount": z.object({ query: z.string().min(1) }),
};

import app from "./app";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3012", 10);

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

// Register tools from separate modules (datetime, and webd group)
import { registerDateTimeTool } from "./mcp/tools/dateTimeTool";
import { registerWeatherTool } from "./mcp/tools/weatherTool";
import { registerWebdTools } from "./mcp/tools/webdTools";

// Create MCP server instance and register tools
const mcpserver = new McpServer({
  name: "INNOMCP Server",
  version: "1.0.0",
});

// Wrap registerTool to add extra validation เพื่อเพิ่มการตรวจสอบพิเศษสำหรับตัวจัดการ webdTool_*
const _originalRegisterTool = (mcpserver as any).registerTool.bind(mcpserver);
(mcpserver as any).registerTool = function (name: string, def: any, handler: any) {
  const wrappedHandler = async (params: any, extra: any) => {
    if (/^webdTool_/i.test(name)) {
      let ok = false;
      try {
        // 1) Prefer explicit extra.source === 'webd' or extra containing 'webd'
        if (extra && typeof extra === "object") {
          if (extra.source === "webd") ok = true;
          else {
            const s = JSON.stringify(extra || "");
            if (/webd/i.test(s)) ok = true;
          }
        } else if (typeof extra === "string") {
          if (/webd/i.test(extra)) ok = true;
        }

        // 2) If extra not present or did not indicate webd, inspect params for webd-like payloads
        if (!ok) {
          const paramsObj = params || {};
          if (paramsObj && typeof paramsObj === "object") {
            // Typical webd response bodies include success/data/markdown etc.
            if (
              paramsObj.success === true &&
              Array.isArray(paramsObj.data) &&
              paramsObj.data.length > 0
            ) {
              const first = paramsObj.data[0];
              if (
                first &&
                (first.group_name !== undefined || first.url_count !== undefined || first.url !== undefined)
              ) {
                ok = true;
              }
            }

            // Accept if markdown mentions webd keywords
            if (!ok && typeof paramsObj.markdown === "string") {
              if (/webd|เว็บไซต์|คำสั่งศาล|สถิติ|โดเมน|url/i.test(paramsObj.markdown)) {
                ok = true;
              }
            }

            // Final fallback: stringified params contain 'webd'
            if (!ok) {
              try {
                const s2 = JSON.stringify(paramsObj || "");
                if (/webd/i.test(s2)) ok = true;
              } catch (e) {
                // ignore
              }
            }
          }
        }
      } catch (e) {
        // ignore errors and continue to final check
      }

      if (!ok) {
        throw new Error(
          'webdTool_* handlers require the original request to include `extra.source === "webd"` or contain the substring "webd" (case-insensitive) in the extra object, or provide a webd-like payload in params (e.g. success/data/markdown).'
        );
      }
    }

    return handler(params, extra);
  };

  return _originalRegisterTool(name, def, wrappedHandler);
};

// Register tools after wrapping registerTool so handlers get wrapped automatically
registerDateTimeTool(mcpserver);
registerWeatherTool(mcpserver);
registerWebdTools(mcpserver);

// Handle incoming MCP requests /////////////////////////////
app.post("/mcp", async (req, res) => {
  // Basic validation for JSON-RPC request body
  const body = req.body;
  if (!body || (typeof body !== "object" && !Array.isArray(body))) {
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
      return sendJsonRpcError(
        res,
        (body as any).id ?? null,
        -32602,
        "Invalid params",
        "params must be an object or array"
      );
    }
  }

  // If this is a single JSON-RPC request with a method, run per-method schema validation
  if (!Array.isArray(body) && typeof (body as any).method === "string") {
    const methodName = (body as any).method as string;
    const schema = methodParamSchemas[methodName];
    const params = (body as any).params;

    if (schema) {
      try {
        // For positional params (array), don't attempt object parse — require named params for these methods
        if (Array.isArray(params)) {
          return sendJsonRpcError(
            res,
            (body as any).id ?? null,
            -32602,
            "Invalid params",
            "Positional params are not supported for this method; use named params (object)"
          );
        }

        schema.parse(params ?? {});
      } catch (err) {
        // zod error -> include details in data for better debugging
        if (err instanceof z.ZodError) {
          return sendJsonRpcError(
            res,
            (body as any).id ?? null,
            -32602,
            "Invalid params",
            err.errors
          );
        }
        return sendJsonRpcError(
          res,
          (body as any).id ?? null,
          -32602,
          "Invalid params",
          String(err)
        );
      }
    }
  }

  // Create a new transport for each request to prevent request ID collisions
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await mcpserver.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const server = app.listen(port, host, () => {
  console.log(`MCP Server running on http://${host}:${port}/mcp`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
  process.exit(1);
});

export { server, mcpserver };

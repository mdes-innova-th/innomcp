import "dotenv/config";
import http from "http";
import dotenv from "dotenv";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import app from "./app";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3011", 10);

// Create HTTP server /////////////////////////////////////
const server = http.createServer(app);

// Create an MCP server /////////////////////////////////////
const mcpserver = new McpServer({
  name: "innomcp-server",
  version: "1.0.0",
});

// Add an addition tool
mcpserver.registerTool(
  "add",
  {
    title: "webD Database Tool",
    description: "Query webD database for information retrieval",
    inputSchema: { a: z.number(), b: z.number() },
    outputSchema: { result: z.number() },
  },
  async ({ a, b }) => {
    const output = { result: a + b };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  }
);

// Add a dynamic greeting resource
mcpserver.registerResource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  {
    title: "Greeting Resource", // Display name for UI
    description: "Dynamic greeting generator",
  },
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `สวัสดี, ${name}!`,
      },
    ],
  })
);

// Handle incoming MCP requests /////////////////////////////
app.post("/mcp", async (req, res) => {
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

app
  .listen(port, () => {
    console.log(`MCP Server running on http://${host}:${port}/mcp`);
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });

export { server, mcpserver };

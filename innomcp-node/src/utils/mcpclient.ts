import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Ollama } from "ollama";
import EventEmitter from "events";
import path from "path";
import fs from "fs";

// Interface for MCP Tool Definition
interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  category: string;
  keywords: string[];
  examples: string[];
}

// Interface for MCP Client Configuration
interface MCPClientConfig {
  name: string;
  version: string;
  // Either provide a stdio transport `command`/`args` or an HTTP `serverUrl`.
  transport?: {
    command: string;
    args: string[];
  };
  serverUrl?: string;
}

class IntelligentMCPClient extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private ollama: Ollama;
  private ollamaModel: string;

  constructor(ollama: Ollama, ollamaModel: string) {
    super();
    this.ollama = ollama;
    this.ollamaModel = ollamaModel;
  }

  // Initialize multiple MCP clients
  async initializeClients(configs: MCPClientConfig[]) {
    for (const config of configs) {
      try {
        let transport: any = null;

        // Prefer stdio transport when command/args provided, otherwise use HTTP transport
        if (config.transport && config.transport.command) {
          transport = new StdioClientTransport({
            command: config.transport.command,
            args: config.transport.args,
          });
        } else if (config.serverUrl) {
          transport = new StreamableHTTPClientTransport(
            new URL(config.serverUrl)
          );
        } else {
          throw new Error(
            "No transport or serverUrl provided for MCP client config"
          );
        }

        const client = new Client({
          name: config.name,
          version: config.version,
        });

        await client.connect(transport as any);
        this.clients.set(config.name, client);
        console.log(`[MCP Client] Connected to ${config.name}`);
        // Emit event so callers can react when a client connects
        try {
          this.emit("clientConnected", config.name);
          this.emit("connectedClients", this.getConnectedClients());
        } catch (e) {
          // ignore emitter errors
        }

        // Load tools from this client
        await this.loadToolsFromClient(config.name, client);
      } catch (error) {
        console.error(
          `[MCP Client] Failed to connect to ${config.name}:`,
          error
        );
      }
    }
  }

  // Load tools from a specific client
  private async loadToolsFromClient(clientName: string, client: Client) {
    try {
      const toolsList = await client.listTools();

      for (const tool of toolsList.tools) {
        const mcpTool: MCPTool = {
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
          category: this.categorizeTools(tool.name, tool.description),
          keywords: this.extractKeywords(tool.name, tool.description),
          examples: this.generateExamples(tool.name, tool.description),
        };

        this.tools.set(`${clientName}:${tool.name}`, mcpTool);
        console.log(`[MCP Client] Loaded tool: ${clientName}:${tool.name}`);
        // notify listeners about tools being loaded
        try {
          this.emit("toolLoaded", { client: clientName, tool: tool.name });
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      console.error(
        `[MCP Client] Failed to load tools from ${clientName}:`,
        error
      );
    }
  }

  // Categorize tools based on name and description
  private categorizeTools(name: string, description?: string): string {
    const text = `${name} ${description || ""}`.toLowerCase();

    if (
      text.includes("database") ||
      text.includes("sql") ||
      text.includes("query")
    ) {
      return "database";
    } else if (
      text.includes("file") ||
      text.includes("read") ||
      text.includes("write")
    ) {
      return "file";
    } else if (
      text.includes("api") ||
      text.includes("http") ||
      text.includes("request")
    ) {
      return "api";
    } else if (
      text.includes("math") ||
      text.includes("calculate") ||
      text.includes("compute")
    ) {
      return "computation";
    } else if (
      text.includes("text") ||
      text.includes("process") ||
      text.includes("analyze")
    ) {
      return "text-processing";
    }

    return "general";
  }

  // Extract keywords from tool name and description
  private extractKeywords(name: string, description?: string): string[] {
    const text = `${name} ${description || ""}`;
    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          !["tool", "function", "method", "the", "and", "for", "with"].includes(
            word
          )
      );

    return [...new Set(words)].slice(0, 10); // ไม่เกิน 10 keywords
  }

  // Generate example usage for tools
  private generateExamples(name: string, description?: string): string[] {
    const examples: string[] = [];

    if (name.includes("webd")) {
      examples.push("นับจำนวนเว็บไซต์ผิดกฎหมาย");
      examples.push("ตรวจสอบสถิติเว็บไซต์ผิดกฎหมาย");
      examples.push("รายงานการละเมิดเว็บไซต์");
      examples.push("เว็บไซต์ผิดกฎหมายมีกี่ url");
      examples.push("เว็บไซต์ผิดกฎหมายมีกี่ domain");
    } else if (name.includes("greeting")) {
      examples.push("สร้างข้อความทักทาย");
      examples.push("สวัสดีภาษาไทย");
    }

    return examples;
  }

  // Intelligent tool selection using Ollama
  async selectTools(userMessage: string): Promise<string[]> {
    try {
      const toolDescriptions = Array.from(this.tools.entries())
        .map(([key, tool]) => {
          return `${key}: ${tool.description} (คำสำคัญ: ${tool.keywords.join(
            ", "
          )}) (ตัวอย่าง: ${tool.examples.join(", ")})`;
        })
        .join("\n");

      const prompt = `
คุณเป็น AI ผู้ช่วยที่ช่วยเลือก MCP tools ที่เหมาะสมสำหรับคำขอของผู้ใช้

ข้อความจากผู้ใช้: "${userMessage}"

MCP Tools ที่มีอยู่:
${toolDescriptions}

กรุณาวิเคราะห์ข้อความของผู้ใช้และเลือก MCP tools ที่เหมาะสม หากไม่มี tools ที่เหมาะสม ให้ตอบว่า "none"
ตอบเฉพาะชื่อ tools ที่เลือก คั่นด้วยเครื่องหมายจุลภาค เช่น: "client1:tool1,client2:tool2"
หรือ "none" หากไม่มี tools ที่เหมาะสม`;

      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      });

      const selectedTools = response.message.content.trim();
      console.log(`[MCP Client] Ollama selected tools: ${selectedTools}`);

      if (selectedTools === "none" || selectedTools === "") {
        return [];
      }

      return selectedTools
        .split(/\s*,\s*|\s+/)
        .map((tool) => tool.trim())
        .filter((tool) => this.tools.has(tool));
    } catch (error) {
      console.error("[MCP Client] Error in tool selection:", error);
      return [];
    }
  }

  // Execute selected tools
  async executeTools(toolNames: string[], userMessage: string): Promise<any[]> {
    const results: any[] = [];

    for (const toolName of toolNames) {
      try {
        const [clientName, actualToolName] = toolName.split(":");
        const client = this.clients.get(clientName);
        const tool = this.tools.get(toolName);

        if (!client || !tool) {
          console.warn(`[MCP Client] Tool or client not found: ${toolName}`);
          continue;
        }

        // Generate tool arguments using Ollama
        const args = await this.generateToolArguments(tool, userMessage);

        console.log(
          `[MCP Client] Executing tool: ${toolName} with args:`,
          args
        );

        const result = await client.callTool({
          name: actualToolName,
          arguments: args,
        });

        results.push({
          toolName,
          result: result.content,
        });
      } catch (error) {
        console.error(`[MCP Client] Error executing tool ${toolName}:`, error);
        results.push({
          toolName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  // Generate tool arguments using Ollama
  private async generateToolArguments(
    tool: MCPTool,
    userMessage: string
  ): Promise<any> {
    try {
      const schemaStr = JSON.stringify(tool.inputSchema, null, 2);

      const prompt = `
คุณเป็น AI ที่ช่วยสร้างพารามิเตอร์สำหรับ MCP tool

ข้อความจากผู้ใช้: "${userMessage}"
ชื่อ Tool: ${tool.name}
คำอธิบาย Tool: ${tool.description}
Input Schema: ${schemaStr}

กรุณาสร้างพารามิเตอร์ที่เหมาะสมสำหรับ tool นี้ตามข้อความของผู้ใช้
ตอบเป็น JSON object ที่ตรงตาม input schema เท่านั้น
ตอบเฉพาะ JSON ไม่ต้องมีคำอธิบายเพิ่มเติม`;

      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      });

      const jsonStr = response.message.content.trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error(`[MCP Client] Error generating tool arguments:`, error);
      return {};
    }
  }

  // Process user message with intelligent tool selection and execution
  async processMessage(userMessage: string): Promise<{
    needsTools: boolean;
    toolResults?: any[];
    enhancedContext?: string;
  }> {
    // Select appropriate tools
    const selectedTools = await this.selectTools(userMessage);

    if (selectedTools.length === 0) {
      return { needsTools: false };
    }

    // Execute selected tools
    const toolResults = await this.executeTools(selectedTools, userMessage);

    // Create enhanced context for Ollama
    const enhancedContext = this.createEnhancedContext(
      userMessage,
      toolResults
    );

    return {
      needsTools: true,
      toolResults,
      enhancedContext,
    };
  }

  // Create enhanced context for Ollama response
  private createEnhancedContext(
    userMessage: string,
    toolResults: any[]
  ): string {
    let context = `ข้อความเดิมจากผู้ใช้: "${userMessage}"\n\nผลลัพธ์จาก MCP Tools:\n`;

    for (const result of toolResults) {
      if (result.error) {
        context += `- ${result.toolName}: เกิดข้อผิดพลาด - ${result.error}\n`;
      } else {
        context += `- ${result.toolName}: ${JSON.stringify(result.result)}\n`;
      }
    }

    context += `\nกรุณาใช้ข้อมูลจาก tools ข้างต้นในการตอบคำถามผู้ใช้`;

    return context;
  }

  // Get available tools info
  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  // Get clients info
  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }
}

// Initialize default MCP client with multiple servers
function createDefaultConfigs(serverScript: string): MCPClientConfig[] {
  return [
    {
      name: "innomcp-server",
      version: "1.0.0",
      // Prefer connecting to the HTTP MCP endpoint provided by `innomcp-server-node`.
      // If you want to run the server as a stdio subprocess, the existing
      // `transport` (command/args) can be used instead.
      serverUrl: process.env.MCP_SERVER_URL || "http://localhost:3012/mcp",
    },
  ];
}

// Initialize default MCP client with multiple servers.
// This function returns the client immediately and starts connection in background
// so callers can attach event listeners first to receive connection events.
function InitMcpClient(
  ollama: Ollama,
  ollamaModel: string
): IntelligentMCPClient {
  const mcpClient = new IntelligentMCPClient(ollama, ollamaModel);

  // Resolve the expected path to the innomcp-server-node built script.
  const serverScript = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "innomcp-server-node",
    "dist",
    "index.js"
  );

  if (!fs.existsSync(serverScript)) {
    console.warn(
      `[MCP Client] Expected server script not found at ${serverScript}. ` +
        "Ensure `innomcp-server-node` is built (run its `build` script)."
    );
  }

  const configs = createDefaultConfigs(serverScript);

  // Start initializing in background so callers get the client immediately
  mcpClient
    .initializeClients(configs)
    .then(() => {
      console.log("[MCP Client] Initialization completed");
      try {
        mcpClient.emit("ready");
      } catch (e) {
        // ignore
      }
    })
    .catch((err) => {
      console.error("[MCP Client] Initialization error:", err);
    });

  return mcpClient;
}

export { InitMcpClient, IntelligentMCPClient, MCPTool, MCPClientConfig };

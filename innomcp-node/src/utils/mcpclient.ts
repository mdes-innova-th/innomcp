import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Ollama } from "ollama";

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
  transport: {
    command: string;
    args: string[];
  };
  serverUrl?: string;
}

class IntelligentMCPClient {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private ollama: Ollama;
  private ollamaModel: string;

  constructor(ollama: Ollama, ollamaModel: string) {
    this.ollama = ollama;
    this.ollamaModel = ollamaModel;
  }

  // Initialize multiple MCP clients
  async initializeClients(configs: MCPClientConfig[]) {
    for (const config of configs) {
      try {
        const transport = new StdioClientTransport({
          command: config.transport.command,
          args: config.transport.args,
        });

        const client = new Client({
          name: config.name,
          version: config.version,
        });

        await client.connect(transport);
        this.clients.set(config.name, client);
        console.log(`[MCPClient] Connected to ${config.name}`);

        // Load tools from this client
        await this.loadToolsFromClient(config.name, client);
      } catch (error) {
        console.error(
          `[MCPClient] Failed to connect to ${config.name}:`,
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
        console.log(`[MCPClient] Loaded tool: ${clientName}:${tool.name}`);
      }
    } catch (error) {
      console.error(
        `[MCPClient] Failed to load tools from ${clientName}:`,
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

    if (name.includes("violation")) {
      examples.push("นับจำนวนเว็บไซต์ที่ละเมิด");
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
      console.log(`[MCPClient] Ollama selected tools: ${selectedTools}`);

      if (selectedTools === "none" || selectedTools === "") {
        return [];
      }

      return selectedTools
        .split(",")
        .map((tool) => tool.trim())
        .filter((tool) => this.tools.has(tool));
    } catch (error) {
      console.error("[MCPClient] Error in tool selection:", error);
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
          console.warn(`[MCPClient] Tool or client not found: ${toolName}`);
          continue;
        }

        // Generate tool arguments using Ollama
        const args = await this.generateToolArguments(tool, userMessage);

        console.log(`[MCPClient] Executing tool: ${toolName} with args:`, args);

        const result = await client.callTool({
          name: actualToolName,
          arguments: args,
        });

        results.push({
          toolName,
          result: result.content,
        });
      } catch (error) {
        console.error(`[MCPClient] Error executing tool ${toolName}:`, error);
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
      console.error(`[MCPClient] Error generating tool arguments:`, error);
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
async function InitMcpClient(
  ollama: Ollama,
  ollamaModel: string
): Promise<IntelligentMCPClient> {
  const mcpClient = new IntelligentMCPClient(ollama, ollamaModel);

  // Configure multiple MCP servers
  const configs: MCPClientConfig[] = [
    {
      name: "innomcp-server",
      version: "1.0.0",
      transport: {
        command: "node",
        args: ["../server.js"],
      },
    },
    // Add more MCP servers here as needed
  ];

  await mcpClient.initializeClients(configs);

  return mcpClient;
}

export { InitMcpClient, IntelligentMCPClient, MCPTool, MCPClientConfig };

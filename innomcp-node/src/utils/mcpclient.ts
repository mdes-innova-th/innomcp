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

    // Mapping of category -> keywords. This is easier to extend
    // and avoids a long if/else chain or a less-idiomatic switch(true).
    const categories: { category: string; keywords: string[] }[] = [
      { category: "database", keywords: ["database", "sql", "query"] },
      { category: "file", keywords: ["file", "read", "write"] },
      { category: "api", keywords: ["api", "http", "request"] },
      { category: "computation", keywords: ["math", "calculate", "compute"] },
      { category: "text-processing", keywords: ["text", "process", "analyze"] },
    ];

    for (const c of categories) {
      if (c.keywords.some((k) => text.includes(k))) {
        console.log(
          `[MCP Client] Tool categorized as '${c.category}': ${name}`
        );
        return c.category;
      }
    }

    console.log(`[MCP Client] Tool categorized as 'general': ${name}`);
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
    const key = `${name} ${description || ""}`.toLowerCase();

    // Use switch(true) to allow boolean/regex checks per case
    switch (true) {
      case /greeting/.test(key): {
        console.log(
          `[MCP Client] Generating examples for greeting tool: ${name}`
        );
        examples.push("สร้างข้อความทักทาย");
        examples.push("สวัสดีภาษาไทย");
        break;
      }

      case /datetime|time|date/.test(key): {
        console.log(
          `[MCP Client] Generating examples for datetime tool: ${name}`
        );
        examples.push("แสดงวันเวลาปัจจุบัน");
        examples.push("วันที่และเวลาปัจจุบัน");
        examples.push("วันนี้วันที่เท่าไหร่");
        examples.push("วันนี้วันอะไร");
        examples.push("เวลาปัจจุบัน");
        examples.push("เวลาตอนนี้");
        examples.push("เวลาตอนนี้ที่ประเทศไทย");
        examples.push("เวลาปัจจุบันในรูปแบบ ISO");
        examples.push("เวลาปัจจุบันในรูปแบบ timestamp");
        examples.push("เวลาปัจจุบันในรูปแบบไทย");
        break;
      }

      case /webd/.test(key): {
        console.log(`[MCP Client] Generating examples for webd tool: ${name}`);
        examples.push("นับจำนวนเว็บไซต์ผิดกฎหมาย");
        examples.push("ตรวจสอบสถิติเว็บไซต์ผิดกฎหมาย");
        examples.push("รายงานการละเมิดเว็บไซต์");
        examples.push("เว็บไซต์ผิดกฎหมายมีกี่ url");
        examples.push("เว็บไซต์ผิดกฎหมายมีกี่ domain");
        break;
      }

      default: {
        console.log(
          `[MCP Client] Generating examples for general tool: ${name}`
        );
        // Small fallback: prefer a short example derived from the description if available,
        // otherwise add a generic example to help the model.
        if (description && description.trim().length > 0) {
          const short = description.trim().split(/\.|\n/)[0];
          examples.push(`ตัวอย่างการใช้งาน: ${short}`);
        } else {
          examples.push("ตัวอย่าง: ขอข้อมูลโดยใช้ tool นี้");
        }
        break;
      }
    }

    return examples;
  }

  // Intelligent tool selection using Ollama
  async selectTools(userMessage: string): Promise<string[]> {
    try {
      // First, check for specific patterns that should directly select certain tools
      const lowerMessage = userMessage.toLowerCase();

      // Direct pattern matching for common queries
      if (
        lowerMessage.includes("วันนี้") ||
        lowerMessage.includes("วันที่") ||
        lowerMessage.includes("เวลา") ||
        lowerMessage.includes("ตอนนี้") ||
        lowerMessage.includes("ปัจจุบัน") ||
        lowerMessage.includes("now") ||
        lowerMessage.includes("today") ||
        lowerMessage.includes("time") ||
        lowerMessage.includes("date")
      ) {
        console.log(
          `[MCP Client] Direct match for datetime tool: ${userMessage}`
        );
        const datetimeTool = Array.from(this.tools.keys()).find((key) =>
          key.includes("dateTimeTool")
        );
        if (datetimeTool) {
          return [datetimeTool];
        }
      }

      if (
        lowerMessage.includes("คำนวณ") ||
        lowerMessage.includes("calculate") ||
        lowerMessage.includes("math") ||
        /[\d+\-*/=]/.test(lowerMessage)
      ) {
        console.log(
          `[MCP Client] Direct match for calculator tool: ${userMessage}`
        );
        const calcTool = Array.from(this.tools.keys()).find((key) =>
          key.includes("calculatorTool")
        );
        if (calcTool) {
          return [calcTool];
        }
      }

      if (
        lowerMessage.includes("วิเคราะห์") ||
        lowerMessage.includes("analyze") ||
        lowerMessage.includes("นับคำ") ||
        lowerMessage.includes("word count")
      ) {
        console.log(
          `[MCP Client] Direct match for text analysis tool: ${userMessage}`
        );
        const textTool = Array.from(this.tools.keys()).find((key) =>
          key.includes("textAnalysisTool")
        );
        if (textTool) {
          return [textTool];
        }
      }

      if (
        lowerMessage.includes("webd") ||
        lowerMessage.includes("เว็บไซต์ผิดกฎหมาย") ||
        lowerMessage.includes("violation") ||
        lowerMessage.includes("สถิติ")
      ) {
        console.log(`[MCP Client] Direct match for webd tool: ${userMessage}`);
        const webdTool = Array.from(this.tools.keys()).find((key) =>
          key.includes("webdCountInputAndGroupTool")
        );
        if (webdTool) {
          return [webdTool];
        }
      }

      // Then, try keyword-based filtering
      const userKeywords = this.extractKeywords("", userMessage);
      const candidateTools: string[] = [];

      for (const [toolKey, tool] of this.tools.entries()) {
        const overlap = userKeywords.filter((keyword) =>
          tool.keywords.some(
            (toolKeyword) =>
              toolKeyword.includes(keyword) || keyword.includes(toolKeyword)
          )
        );
        if (overlap.length > 0) {
          candidateTools.push(toolKey);
        }
      }

      // If no candidates from keywords, use all tools
      const toolsToConsider =
        candidateTools.length > 0
          ? candidateTools
          : Array.from(this.tools.keys());

      const toolDescriptions = toolsToConsider
        .map((key) => {
          const tool = this.tools.get(key)!;
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

กรุณาวิเคราะห์ข้อความของผู้ใช้และเลือก MCP tools ที่เหมาะสมที่สุด หากไม่มี tools ที่เหมาะสม ให้ตอบว่า "none"
ตอบเฉพาะชื่อ tools ที่เลือก คั่นด้วยเครื่องหมายจุลภาค เช่น: "client1:tool1,client2:tool2"
หรือ "none" หากไม่มี tools ที่เหมาะสม

คำแนะนำสำคัญ:
- ถ้าถามเกี่ยวกับเวลา วันที่ หรือวันนี้: เลือก dateTimeTool
- ถ้าถามเกี่ยวกับการคำนวณทางคณิตศาสตร์: เลือก calculatorTool  
- ถ้าถามเกี่ยวกับการวิเคราะห์ข้อความ: เลือก textAnalysisTool
- ถ้าถามเกี่ยวกับสถิติเว็บไซต์ผิดกฎหมาย: เลือก webdCountInputAndGroupTool
- เลือกเฉพาะ tools ที่จำเป็น ไม่ต้องเลือกหลายตัวถ้าไม่จำเป็น`;

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
ตอบเฉพาะ JSON ไม่ต้องมีคำอธิบายเพิ่มเติม

ตัวอย่างสำหรับ dateTimeTool: {}
ตัวอย่างสำหรับ calculatorTool: {"expression": "2+2"}
ตัวอย่างสำหรับ textAnalysisTool: {"text": "ข้อความที่ต้องการวิเคราะห์"}`;

      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      });

      const jsonStr = response.message.content.trim();
      console.log(`[MCP Client] Generated args for ${tool.name}: ${jsonStr}`);

      try {
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.warn(
          `[MCP Client] Failed to parse generated JSON for ${tool.name}, using default args:`,
          parseError
        );
        return {}; // Return empty object as fallback
      }
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
    toolsFailed?: boolean;
  }> {
    // Select appropriate tools
    const selectedTools = await this.selectTools(userMessage);

    if (selectedTools.length === 0) {
      return { needsTools: false };
    }

    // Execute selected tools
    const toolResults = await this.executeTools(selectedTools, userMessage);

    // Check if any tools executed successfully
    const successfulResults = toolResults.filter((result) => !result.error);
    if (successfulResults.length === 0) {
      console.log("[MCP Client] All tools failed, skipping tool usage");
      return { needsTools: false, toolsFailed: true };
    }

    // Create enhanced context for Ollama
    const enhancedContext = this.createEnhancedContext(
      userMessage,
      successfulResults
    );

    return {
      needsTools: true,
      toolResults: successfulResults,
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

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Ollama } from "ollama";
import EventEmitter from "events";
import path from "path";
import fs from "fs";
import Ajv from "ajv"; // เพิ่ม JSON Schema validator

// Define the system prompt for Ollama
const SYSTEM_PROMPT = `คุณเป็น AI ผู้ช่วยที่มีความสำคัญ:
1. จำประวัติการสนทนาที่ผ่านมา
2. ใช้บริบทจากข้อความก่อนหน้าเพื่อให้คำตอบที่สอดคล้อง
3. หากมีข้อมูลจาก MCP tools ให้นำมาใช้
4. ไม่ตอบนอกเหนือจากที่ได้จาก MCP tools ถ้าไม่ทราบ หรือไม่สามารถเลือก MCP tools ได้ หรือ MCP tools failed หรือ MCP tools error ให้ตอบว่า \"ขออภัย ฉันยังไม่มีข้อมูลที่คุณต้องการ\"
5. ตอบเป็นภาษาไทยเป็นหลัก`;

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
  transport?: {
    command: string;
    args: string[];
  };
  serverUrl?: string;
}

// Interface for Tool Selection Cache
interface ToolSelectionCache {
  query: string;
  tools: string[];
  timestamp: number;
}

class IntelligentMCPClient extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private ollama: Ollama;
  private ollamaModel: string;
  private ajv: Ajv; // JSON Schema validator
  private selectionCache: Map<string, ToolSelectionCache> = new Map();
  private cacheTTL: number = 300000; // 5 minutes cache TTL

  constructor(ollama: Ollama, ollamaModel: string) {
    super();
    this.ollama = ollama;
    this.ollamaModel = ollamaModel;
    this.ajv = new Ajv({ allErrors: true });
  }

  // Initialize multiple MCP clients
  async initializeClients(configs: MCPClientConfig[]) {
    for (const config of configs) {
      try {
        let transport: any = null;

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

        try {
          this.emit("clientConnected", config.name);
          this.emit("connectedClients", this.getConnectedClients());
        } catch (e) {
          // ignore emitter errors
        }

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

    const categories: { category: string; keywords: string[] }[] = [
      {
        category: "database",
        keywords: ["database", "sql", "query", "ฐานข้อมูล"],
      },
      {
        category: "file",
        keywords: ["file", "read", "write", "ไฟล์", "อ่าน", "เขียน"],
      },
      { category: "api", keywords: ["api", "http", "request", "เรียก"] },
      {
        category: "computation",
        keywords: ["math", "calculate", "compute", "คำนวณ", "คณิตศาสตร์"],
      },
      {
        category: "text-processing",
        keywords: ["text", "process", "analyze", "ข้อความ", "วิเคราะห์"],
      },
      {
        category: "datetime",
        keywords: ["time", "date", "datetime", "เวลา", "วันที่"],
      },
      {
        category: "statistics",
        keywords: ["stats", "count", "statistics", "สถิติ", "นับ"],
      },
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

  // Enhanced keyword extraction supporting Thai language
  private extractKeywords(name: string, description?: string): string[] {
    const text = `${name} ${description || ""}`;

    // Extract English words
    const englishWords = text.toLowerCase().match(/[a-z]+/g) || [];

    // Extract Thai words (simplified - in production use proper Thai tokenizer)
    const thaiWords = text.match(/[\u0E00-\u0E7F]+/g) || [];

    const allWords = [...englishWords, ...thaiWords]
      .filter((word) => word.length > 2) // Reduced from 3 for Thai
      .filter(
        (word) =>
          ![
            "tool",
            "function",
            "method",
            "the",
            "and",
            "for",
            "with",
            "การ",
            "ของ",
            "ที่",
          ].includes(word)
      );

    return [...new Set(allWords)].slice(0, 15);
  }

  // Generate example usage for tools
  private generateExamples(name: string, description?: string): string[] {
    const examples: string[] = [];
    const key = `${name} ${description || ""}`.toLowerCase();

    const exampleMap: { pattern: RegExp; examples: string[] }[] = [
      {
        pattern: /greeting|สวัสดี|ทักทาย/,
        examples: ["สร้างข้อความทักทาย", "สวัสดีภาษาไทย"],
      },
      {
        pattern: /datetime|time|date|เวลา|วันที่/,
        examples: [
          "แสดงวันเวลาปัจจุบัน",
          "วันที่และเวลาปัจจุบัน",
          "วันนี้วันที่เท่าไหร่",
          "เวลาตอนนี้",
          "เวลาปัจจุบันในรูปแบบไทย",
          "วันนี้วันอะไร",
        ],
      },
      {
        pattern: /webd|ผิดกฎหมาย|violation/,
        examples: [
          "นับจำนวนเว็บไซต์ผิดกฎหมาย",
          "ตรวจสอบสถิติเว็บไซต์",
          "เว็บไซต์ผิดกฎหมายมีกี่ url",
        ],
      },
      {
        pattern: /calculator|calculate|คำนวณ|math/,
        examples: ["คำนวณ 2+2", "หาผลบวก", "คำนวณทางคณิตศาสตร์"],
      },
      {
        pattern: /text|analyze|วิเคราะห์|ข้อความ/,
        examples: ["วิเคราะห์ข้อความ", "นับคำ", "วิเคราะห์เนื้อหา"],
      },
    ];

    for (const { pattern, examples: exs } of exampleMap) {
      if (pattern.test(key)) {
        console.log(`[MCP Client] Generating examples for ${name}`);
        examples.push(...exs);
        return examples;
      }
    }

    // Fallback
    if (description && description.trim().length > 0) {
      const short = description.trim().split(/\.|\n/)[0];
      examples.push(`ตัวอย่างการใช้งาน: ${short}`);
    } else {
      examples.push("ตัวอย่าง: ขอข้อมูลโดยใช้ tool นี้");
    }

    return examples;
  }

  // Normalize query for caching
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, " ");
  }

  // Check cache for tool selection
  private getCachedSelection(query: string): string[] | null {
    const normalized = this.normalizeQuery(query);
    const cached = this.selectionCache.get(normalized);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[MCP Client] Using cached tool selection for: ${query}`);
      return cached.tools;
    }

    return null;
  }

  // Cache tool selection
  private cacheSelection(query: string, tools: string[]) {
    const normalized = this.normalizeQuery(query);
    this.selectionCache.set(normalized, {
      query: normalized,
      tools,
      timestamp: Date.now(),
    });
  }

  // Clear expired cache entries
  private cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.selectionCache.entries()) {
      if (now - value.timestamp >= this.cacheTTL) {
        this.selectionCache.delete(key);
      }
    }
  }

  // Intelligent tool selection with improved pattern matching
  async selectTools(userMessage: string): Promise<string[]> {
    try {
      // Check cache first
      const cached = this.getCachedSelection(userMessage);
      if (cached) {
        return cached;
      }

      const lowerMessage = userMessage.toLowerCase();

      // Enhanced pattern matching with priority scoring
      const patternMatches: { tool: string; score: number }[] = [];

      // Date/Time patterns (highest priority for date queries)
      if (
        /วันนี้|วันที่|เวลา|ตอนนี้|ปัจจุบัน|now|today|time|date|current/i.test(
          userMessage
        )
      ) {
        const datetimeTool = Array.from(this.tools.keys()).find((key) =>
          /datetime|time|date/i.test(key)
        );
        if (datetimeTool) {
          patternMatches.push({ tool: datetimeTool, score: 10 });
        }
      }

      // Calculator patterns
      if (/คำนวณ|calculate|math|\d+\s*[\+\-\*\/]\s*\d+/i.test(userMessage)) {
        const calcTool = Array.from(this.tools.keys()).find((key) =>
          /calculator|calculate/i.test(key)
        );
        if (calcTool) {
          patternMatches.push({ tool: calcTool, score: 9 });
        }
      }

      // Text analysis patterns
      if (/วิเคราะห์|analyze|นับคำ|word\s+count/i.test(userMessage)) {
        const textTool = Array.from(this.tools.keys()).find((key) =>
          /text|analyze/i.test(key)
        );
        if (textTool) {
          patternMatches.push({ tool: textTool, score: 8 });
        }
      }

      // Webd patterns
      if (/webd|เว็บไซต์ผิดกฎหมาย|violation|สถิติ.*เว็บ/i.test(userMessage)) {
        const webdTool = Array.from(this.tools.keys()).find((key) =>
          /webd/i.test(key)
        );
        if (webdTool) {
          patternMatches.push({ tool: webdTool, score: 9 });
        }
      }

      // If we have high-confidence pattern matches, use them
      if (patternMatches.length > 0) {
        const topMatches = patternMatches
          .sort((a, b) => b.score - a.score)
          .slice(0, 2) // Take top 2 matches
          .map((m) => m.tool);

        console.log(
          `[MCP Client] Pattern matched tools: ${topMatches.join(", ")}`
        );
        this.cacheSelection(userMessage, topMatches);
        return topMatches;
      }

      // Fallback to Ollama-based selection with improved prompt
      const toolDescriptions = getToolDescriptions(this.tools);
      const prompt = `คุณเป็น AI ที่เชี่ยวชาญในการเลือก MCP tools ที่เหมาะสมที่สุด

คำขอจากผู้ใช้: "${userMessage}"

Tools ที่มี:
${toolDescriptions}

กฎการเลือก:
1. เลือกเฉพาะ tools ที่ตรงกับความต้องการมากที่สุด
2. ถ้าไม่มี tool ที่เหมาะสม ตอบว่า \"none\"
3. ไม่ต้องเลือกหลาย tools เว้นแต่จำเป็นจริงๆ
4. ตอบเป็นรายการชื่อ tool คั่นด้วยเครื่องหมายจุลภาค

ตัวอย่างคำตอบที่ถูกต้อง:
- \"innomcp-server:dateTimeTool\"
- \"innomcp-server:calculatorTool,innomcp-server:textAnalysisTool\"
- \"none\"

คำตอบ (เฉพาะชื่อ tool เท่านั้น):`;

      const ollamaMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ];

      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.1, // Lower temperature for more consistent results
          num_predict: 100, // Limit response length
        },
      });

      const selectedTools = response.message.content.trim();
      console.log(`[MCP Client] Ollama selected tools: ${selectedTools}`);

      if (selectedTools === "none" || selectedTools === "") {
        this.cacheSelection(userMessage, []);
        return [];
      }

      const tools = selectedTools
        .split(/\s*,\s*|\n/)
        .map((tool) => tool.trim())
        .filter((tool) => this.tools.has(tool));

      this.cacheSelection(userMessage, tools);
      this.cleanCache(); // Clean expired cache

      return tools;
    } catch (error) {
      console.error("[MCP Client] Error in tool selection:", error);
      return [];
    }
  }

  // Validate arguments against schema
  private validateArguments(
    args: any,
    schema: any
  ): { valid: boolean; errors?: string[] } {
    const validate = this.ajv.compile(schema);
    const valid = validate(args);

    if (!valid && validate.errors) {
      return {
        valid: false,
        errors: validate.errors.map((e) => `${e.instancePath} ${e.message}`),
      };
    }

    return { valid: true };
  }

  // Execute selected tools with retry logic
  async executeTools(toolNames: string[], userMessage: string): Promise<any[]> {
    const results: any[] = [];

    for (const toolName of toolNames) {
      let retries = 2;
      let lastError: any = null;

      while (retries > 0) {
        try {
          const [clientName, actualToolName] = toolName.split(":");
          const client = this.clients.get(clientName);
          const tool = this.tools.get(toolName);

          if (!client || !tool) {
            console.warn(`[MCP Client] Tool or client not found: ${toolName}`);
            break;
          }

          const args = await this.generateToolArguments(tool, userMessage);

          // Validate arguments
          const validation = this.validateArguments(args, tool.inputSchema);
          if (!validation.valid) {
            console.warn(
              `[MCP Client] Invalid arguments for ${toolName}:`,
              validation.errors
            );

            // Try with empty args as fallback
            const emptyArgs = {};
            const emptyValidation = this.validateArguments(
              emptyArgs,
              tool.inputSchema
            );
            if (!emptyValidation.valid) {
              throw new Error(
                `Invalid arguments: ${validation.errors?.join(", ")}`
              );
            }
            console.log(`[MCP Client] Using empty args for ${toolName}`);
          }

          console.log(
            `[MCP Client] Executing tool: ${toolName} with args:`,
            JSON.stringify(args)
          );

          const result = await client.callTool({
            name: actualToolName,
            arguments: args,
          });

          results.push({
            toolName,
            result: result.content,
            success: true,
          });

          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          retries--;

          if (retries > 0) {
            console.warn(
              `[MCP Client] Retry executing tool ${toolName}, ${retries} attempts left`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
          }
        }
      }

      // If all retries failed, add error result
      if (retries === 0 && lastError) {
        console.error(
          `[MCP Client] Error executing tool ${toolName}:`,
          lastError
        );
        results.push({
          toolName,
          error:
            lastError instanceof Error ? lastError.message : String(lastError),
          success: false,
        });
      }
    }

    return results;
  }

  // Generate tool arguments with improved prompt
  private async generateToolArguments(
    tool: MCPTool,
    userMessage: string
  ): Promise<any> {
    try {
      const schemaStr = JSON.stringify(tool.inputSchema, null, 2);
      const required = tool.inputSchema.required || [];
      const properties = tool.inputSchema.properties || {};

      const prompt = `สร้างพารามิเตอร์ JSON สำหรับ tool ตามข้อมูลด้านล่าง

คำขอ: "${userMessage}"
Tool: ${tool.name}
คำอธิบาย: ${tool.description}

Schema:
${schemaStr}

พารามิเตอร์ที่จำเป็น: ${required.length > 0 ? required.join(", ") : "ไม่มี"}

กฎสำคัญ:
1. ตอบเป็น JSON object เท่านั้น ไม่มีข้อความอื่น
2. ไม่ต้องใช้ markdown code blocks
3. ถ้าไม่แน่ใจให้ใช้ค่า default หรือ empty object {}

ตัวอย่าง:
- dateTimeTool: {}
- calculatorTool: {"expression": "2+2"}
- textAnalysisTool: {"text": "sample text"}

JSON:`;

      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 200,
        },
      });

      let jsonStr = response.message.content.trim();
      console.log(`[MCP Client] Raw args response: ${jsonStr}`);

      // Clean up response
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      // Extract JSON if embedded in text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      try {
        const parsed = JSON.parse(jsonStr);
        console.log(`[MCP Client] Generated args for ${tool.name}:`, parsed);
        return parsed;
      } catch (parseError) {
        console.warn(
          `[MCP Client] Failed to parse JSON, using default args:`,
          parseError
        );
        return {};
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
    const selectedTools = await this.selectTools(userMessage);

    if (selectedTools.length === 0) {
      return { needsTools: false };
    }

    const toolResults = await this.executeTools(selectedTools, userMessage);

    const successfulResults = toolResults.filter((result) => result.success);
    if (successfulResults.length === 0) {
      console.log("[MCP Client] All tools failed, skipping tool usage");
      return { needsTools: false, toolsFailed: true };
    }

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
    let context = `คำถามเดิม: "${userMessage}"\n\nข้อมูลจาก MCP Tools:\n\n`;

    for (const result of toolResults) {
      if (result.error) {
        context += `❌ ${result.toolName}: เกิดข้อผิดพลาด - ${result.error}\n`;
      } else {
        const resultStr =
          typeof result.result === "string"
            ? result.result
            : JSON.stringify(result.result, null, 2);
        context += `✓ ${result.toolName}:\n${resultStr}\n\n`;
      }
    }

    context += `\nคำแนะนำ: ใช้ข้อมูลจาก tools ข้างต้นตอบคำถามอย่างชัดเจนและเป็นธรรมชาติ`;

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

  // Clear all caches
  clearCache() {
    this.selectionCache.clear();
    console.log("[MCP Client] Cache cleared");
  }
}
// Helper function to generate tool descriptions from a Map<string, MCPTool>
function getToolDescriptions(tools: Map<string, MCPTool>): string {
  return Array.from(tools.values())
    .map((tool) => {
      return `- ${tool.name}\n  คำอธิบาย: ${tool.description}\n  หมวดหมู่: ${tool.category}\n  ตัวอย่าง: ${tool.examples.slice(0, 3).join(", ")}`;
    })
    .join("\n\n");
}

// Initialize default MCP client configuration
function createDefaultConfigs(serverScript: string): MCPClientConfig[] {
  return [
    {
      name: "innomcp-server",
      version: "1.0.0",
      serverUrl: process.env.MCP_SERVER_URL || "http://localhost:3012/mcp",
    },
  ];
}

// Initialize MCP client with event-driven architecture
function InitMcpClient(
  ollama: Ollama,
  ollamaModel: string
): IntelligentMCPClient {
  const mcpClient = new IntelligentMCPClient(ollama, ollamaModel);

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
        "Ensure innomcp-server-node is built."
    );
  }

  const configs = createDefaultConfigs(serverScript);

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

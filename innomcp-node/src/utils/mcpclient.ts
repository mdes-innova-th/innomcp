import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Ollama } from "ollama";
import EventEmitter from "events";
import path from "path";
import fs from "fs";
import Ajv from "ajv";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";
import Fuse from "fuse.js";
import * as natural from "natural";
import { makeFuse, runSearch } from "./fuseSearch";

// ========================================
// INTERFACES
// ========================================

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  category: string;
  keywords: string[];
  examples: string[];
}

interface MCPResource {
  name: string;
  title?: string;
  description?: string;
  uriTemplate?: string;
  inputSchema?: any;
}

interface MCPClientConfig {
  name: string;
  version: string;
  transport?: {
    command: string;
    args: string[];
  };
  serverUrl?: string;
}

interface ToolSelectionCache {
  query: string;
  tools: string[];
  timestamp: number;
}

interface ConversationContext {
  query: string;
  tools: string[];
  timestamp: number;
}

interface ToolPattern {
  keywords: string[];
  toolPattern: RegExp;
  priority: "high" | "medium" | "low";
  category?: string;
}

// ========================================
// NEW: TOOL CHAINING INTERFACES
// ========================================

interface ToolChainStep {
  toolName: string;
  args?: any;
  dependsOn?: number[]; // index ของ steps ก่อนหน้าที่ต้องรอ
  description: string;
  condition?: string; // เงื่อนไขในการ execute (optional)
}

interface ToolChainPlan {
  steps: ToolChainStep[];
  reasoning: string;
  isChainable: boolean;
}

interface ChainExecutionResult {
  step: number;
  toolName: string;
  description: string;
  result?: any;
  error?: string;
  success: boolean;
  executionTime?: number;
}

// ========================================
// SYSTEM PROMPT
// ========================================

const SYSTEM_PROMPT = `คุณเป็น AI ที่จะตอบกลับเป็น JSON เท่านั้น:
1. ตอบกลับเฉพาะ JSON ที่ถูกต้อง (valid JSON) เท่านั้น — ไม่มี HTML, ไม่มี code fence, ไม่มีข้อความนอก JSON
2. JSON ต้องมีฟิลด์ระดับบนสุดชื่อ "markdown" ซึ่งเป็นข้อความสตริงที่มีคำตอบสำหรับผู้ใช้ในรูปแบบ Markdown
3. โครงสร้าง JSON สามารถมีฟิลด์เพิ่มเติมได้ เช่น "success", "data", "meta" ฯลฯ แต่ต้องมี "markdown" เสมอ
4. หากไม่สามารถให้ข้อมูลตามคำขอ ให้ตอบเป็น JSON เช่น:
  {"success": false, "error": "สาเหตุที่ไม่สามารถตอบได้", "markdown":""}
5. ห้ามส่งคำอธิบายเพิ่มเติมใดๆ นอก JSON
6. อย่าใส่ styling หรือ HTML tags ใดๆ ในฟิลด์ markdown — ให้ใช้ Markdown ธรรมดาเท่านั้น
7. ภาษาในการคืนค่าควรเป็นไทยเป็นหลัก แต่ข้อความในฟิลด์อื่นๆ สามารถเป็นภาษาอังกฤษได้ตามสมควร
8. ห้ามอธิบายผู้ใช้ทราบว่ามีการใช้ MCP server, MCP tools หรือ tools ใดๆ — เพียงให้ผลลัพธ์สุดท้ายในฟิลด์ markdown เท่านั้น`;

// ========================================
// MAIN CLASS
// ========================================

class IntelligentMCPClient extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private ollama: Ollama;
  private ollamaModel: string;
  private ajv: Ajv;
  private selectionCache: Map<string, ToolSelectionCache> = new Map();
  private cacheTTL: number = 300000; // 5 minutes
  private conversationHistory: ConversationContext[] = [];
  private maxHistorySize: number = 10;

  // Natural language processing components
  private tfidf = new natural.TfIdf();
  private stemmer = natural.PorterStemmer;
  private tokenizer = new natural.WordTokenizer();

  // Tool patterns for enhanced matching
  private toolPatterns: ToolPattern[] = [
    {
      keywords: ["สวัสดี", "ทักทาย", "hello", "hi", "greeting"],
      toolPattern: /greeting|สวัสดี|ทักทาย/i,
      priority: "high",
      category: "greeting",
    },
    {
      keywords: [
        "วันนี้",
        "วันที่",
        "เวลา",
        "ตอนนี้",
        "today",
        "now",
        "time",
        "date",
      ],
      toolPattern: /datetime|time|date/i,
      priority: "high",
      category: "datetime",
    },
    {
      keywords: [
        "พยากรณ์อากาศ",
        "อากาศ",
        "weather",
        "forecast",
        "ฝน",
        "อุณหภูมิ",
      ],
      toolPattern: /^tmdTool_*/i,
      priority: "high",
      category: "weather",
    },
    {
      keywords: ["ระบบ webd", "webd", "ผิดกฎหมาย", "คำสั่งศาล", "url", "โดเมน"],
      toolPattern: /^webdTool_*/i,
      priority: "high",
      category: "webd",
    },
    {
      keywords: ["กราฟ", "chart", "graph", "echarts", "visualize"],
      toolPattern: /^echartsTool*/i,
      priority: "high",
      category: "visualization",
    },
  ];

  constructor(ollama: Ollama, ollamaModel: string) {
    super();
    this.ollama = ollama;
    this.ollamaModel = ollamaModel;
    this.ajv = new Ajv({ allErrors: true });
  }

  // ========================================
  // OLLAMA CHAT WRAPPER
  // ========================================

  private async chatWithOllama(messages: any[], options?: any): Promise<any> {
    console.log("===== Starting chatWithOllama =====");

    try {
      console.log(
        `[MCP Client] Calling ollama.chat with model: ${this.ollamaModel} ✨`
      );
      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages,
        stream: false,
        options: options || {},
      });

      if (response && response.message) return response;

      console.warn(
        "[MCP Client] Ollama returned unexpected response, trying stream fallback"
      );
    } catch (err) {
      console.warn(
        "[MCP Client] Ollama sync chat failed, attempting stream fallback:",
        String(err)
      );
    }

    // Streaming fallback
    try {
      const stream = await this.ollama.chat({
        model: this.ollamaModel,
        messages,
        stream: true,
        options: options || {},
      });

      let content = "";
      for await (const chunk of stream as any) {
        if (!chunk) continue;
        if (chunk.message && chunk.message.content) {
          content += chunk.message.content;
        } else if (chunk.content) {
          content += chunk.content;
        } else if (typeof chunk === "string") {
          content += chunk;
        }
      }

      return { message: { content } };
    } catch (err) {
      console.error("[MCP Client] Ollama stream fallback failed:", err);
      throw err;
    }
  }

  // ========================================
  // CLIENT INITIALIZATION
  // ========================================

  async initializeClients(configs: MCPClientConfig[]) {
    console.log("Starting initializeClients");
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
          throw new Error("No transport or serverUrl provided");
        }

        const client = new Client({
          name: config.name,
          version: config.version,
        });

        await client.connect(transport as any);
        this.clients.set(config.name, client);
        console.log(`[MCP Client] Connected to ${config.name}`);

        this.emit("clientConnected", config.name);
        await this.loadToolsFromClient(config.name, client);
      } catch (error) {
        console.error(
          `[MCP Client] Failed to connect to ${config.name}:`,
          error
        );
      }
    }
  }

  private async loadToolsFromClient(clientName: string, client: Client) {
    try {
      const toolsList = await client.listTools();

      for (const tool of toolsList.tools) {
        const mcpTool: MCPTool = {
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
          category: this.categorizeTools(tool.name, tool.description),
          keywords: await this.extractKeywords(tool.name, tool.description),
          examples: this.generateExamples(tool.name, tool.description),
        };

        this.tools.set(`${clientName}:${tool.name}`, mcpTool);
        console.log(`[MCP Client] Loaded tool: ${clientName}:${tool.name}`);
      }
    } catch (error) {
      console.error(
        `[MCP Client] Failed to load tools from ${clientName}:`,
        error
      );
    }

    // Load resources
    try {
      const resourcesList = await (client as any).listResources?.();

      if (resourcesList && Array.isArray(resourcesList.resources)) {
        for (const r of resourcesList.resources) {
          const res: MCPResource = {
            name: r.name || r.template || "unknown",
            title: r.title,
            description: r.description,
            uriTemplate: r.template || r.uriTemplate,
            inputSchema: r.inputSchema,
          };

          this.resources.set(`${clientName}:${res.name}`, res);
          console.log(
            `[MCP Client] Loaded resource: ${clientName}:${res.name}`
          );
        }
      }
    } catch (err) {
      console.debug(
        `[MCP Client] listResources not available for ${clientName}`
      );
    }
  }

  // ========================================
  // TOOL CATEGORIZATION & KEYWORD EXTRACTION
  // ========================================

  private categorizeTools(name: string, description?: string): string {
    const text = `${name} ${description || ""}`.toLowerCase();

    const categories: { category: string; keywords: string[] }[] = [
      {
        category: "database",
        keywords: ["database", "sql", "query", "ฐานข้อมูล"],
      },
      { category: "file", keywords: ["file", "read", "write", "ไฟล์"] },
      { category: "api", keywords: ["api", "http", "request"] },
      {
        category: "computation",
        keywords: ["math", "calculate", "compute", "คำนวณ"],
      },
      {
        category: "datetime",
        keywords: ["time", "date", "datetime", "เวลา", "วันที่"],
      },
      {
        category: "statistics",
        keywords: ["stats", "count", "statistics", "สถิติ"],
      },
      {
        category: "webd",
        keywords: ["webd", "violation", "ผิดกฎหมาย", "url", "โดเมน"],
      },
      {
        category: "weather",
        keywords: ["tmd", "weather", "ฝน", "พยากรณ์", "อากาศ"],
      },
      {
        category: "visualization",
        keywords: ["chart", "graph", "visualize", "กราฟ"],
      },
    ];

    for (const c of categories) {
      if (c.keywords.some((k) => text.includes(k))) {
        return c.category;
      }
    }

    return "general";
  }

  private async extractKeywords(
    name: string,
    description?: string
  ): Promise<string[]> {
    const text = `${name} ${description || ""}`;

    let thaiTokens: string[] = [];
    try {
      thaiTokens = await this.tokenizeThaiWithOllama(text);
    } catch (error) {
      console.warn("[MCP Client] Thai tokenization failed:", error);
    }

    const englishTokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
    const allTokens = [...new Set([...thaiTokens, ...englishTokens])];

    const englishWords = allTokens.filter((token) => /^[a-z]{3,}$/.test(token));
    const englishStopWords = [
      "tool",
      "function",
      "method",
      "the",
      "and",
      "for",
      "with",
    ];
    const filteredEnglish = englishWords.filter(
      (w) => !englishStopWords.includes(w)
    );

    const thaiWords = allTokens.filter((token) =>
      /[\u0E00-\u0E7F]{2,}/.test(token)
    );
    const thaiStopWords = ["การ", "ของ", "ที่", "และ", "ใน"];
    const filteredThai = thaiWords.filter((w) => !thaiStopWords.includes(w));

    const stemmedEnglish = filteredEnglish.map((w) => this.stemmer.stem(w));

    return [...new Set([...stemmedEnglish, ...filteredThai])].slice(0, 20);
  }

  private generateExamples(name: string, description?: string): string[] {
    const key = `${name} ${description || ""}`.toLowerCase();

    if (/datetime|time|date/.test(key)) {
      return ["วันนี้วันที่เท่าไหร่", "เวลาตอนนี้", "แสดงวันเวลาปัจจุบัน"];
    }
    if (/webd/.test(key)) {
      return ["นับจำนวนเว็บไซต์ผิดกฎหมาย", "สถิติ URL ในระบบ webd"];
    }
    if (/chart|graph/.test(key)) {
      return ["สร้างกราฟแท่ง", "สร้างกราฟวงกลม"];
    }

    return ["ตัวอย่างการใช้งาน"];
  }

  // ========================================
  // NEW: TOOL CHAINING LOGIC
  // ========================================

  /**
   * วิเคราะห์ว่าคำถามต้องใช้ tool chaining หรือไม่
   * และวางแผนลำดับการใช้ tools
   */
  private async planToolChain(
    userMessage: string,
    selectedTools: string[]
  ): Promise<ToolChainPlan | null> {
    console.log("===== Starting planToolChain =====");

    // ถ้ามี tool เดียวไม่ต้อง chain
    if (selectedTools.length <= 1) {
      console.log("[Chain] Only 1 tool, no chaining needed");
      return null;
    }

    try {
      // สร้าง descriptions ของ tools ที่เลือก
      const toolDescriptions = selectedTools
        .map((toolName) => {
          const tool = this.tools.get(toolName);
          const resource = this.resources.get(toolName);

          const description =
            tool?.description || resource?.description || "ไม่มีคำอธิบาย";
          const category = tool?.category || "general";
          const examples = tool?.examples?.slice(0, 2).join(", ") || "ไม่มี";

          return `${toolName}:
  - หมวดหมู่: ${category}
  - คำอธิบาย: ${description}
  - ตัวอย่าง: ${examples}`;
        })
        .join("\n\n");

      const prompt = `วิเคราะห์คำถามและวางแผนการใช้ tools ตามลำดับ

คำถาม: "${userMessage}"

Tools ที่มี:
${toolDescriptions}

วิเคราะห์ว่า:
1. ต้องใช้ tools ตามลำดับหรือไม่? (tool chaining)
2. tool ใดต้องรอผลจาก tool ใดก่อน?
3. วัตถุประสงค์ของแต่ละ step คือะไร?

ตัวอย่างที่ต้อง chain:
- "หาข้อมูลเว็บไซต์ผิดกฎหมายแล้วสร้างกราฟ" → ต้อง chain (ดึงข้อมูล → สร้างกราฟ)
- "ดูอากาศวันนี้แล้วแนะนำกิจกรรม" → ต้อง chain (ดูอากาศ → แนะนำ)

ตัวอย่างที่ไม่ต้อง chain:
- "วันนี้วันที่เท่าไหร่" → ไม่ต้อง chain (ใช้ tool เดียว)
- "สวัสดี" → ไม่ต้อง chain

ตอบเป็น JSON เท่านั้น:
{
  "isChainable": true/false,
  "reasoning": "เหตุผลที่ต้อง/ไม่ต้อง chain",
  "steps": [
    {
      "toolName": "ชื่อ tool เต็ม",
      "description": "สิ่งที่ tool นี้จะทำ",
      "dependsOn": [0, 1]  // optional: array ของ step index ที่ต้องรอ (เริ่มจาก 0)
    }
  ]
}

หมายเหตุ:
- dependsOn: ถ้า step นี้ต้องรอผลจาก step อื่น ให้ระบุ index
- ถ้าไม่ต้อง chain ให้ตอบ isChainable: false และ steps: []

JSON:`;

      console.log("[Chain] Calling Ollama for chain planning...");
      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.2, num_predict: 500 }
      );

      const rawText = String(response.message?.content || "").trim();
      console.log(`[Chain] Ollama response: ${rawText.slice(0, 200)}...`);

      const jsonStr = this.extractJsonFromText(rawText);
      if (!jsonStr) {
        console.warn("[Chain] No JSON found in response");
        return null;
      }

      const plan: ToolChainPlan = JSON.parse(jsonStr);

      // Validate plan
      if (!plan.isChainable || !plan.steps || plan.steps.length === 0) {
        console.log("[Chain] Plan indicates no chaining needed");
        return null;
      }

      // Validate tool names in steps
      plan.steps = plan.steps.filter((step) => {
        const exists = selectedTools.includes(step.toolName);
        if (!exists) {
          console.warn(`[Chain] Invalid tool in plan: ${step.toolName}`);
        }
        return exists;
      });

      if (plan.steps.length === 0) {
        console.warn("[Chain] No valid steps after validation");
        return null;
      }

      console.log(
        `[Chain] ✅ Created chain plan with ${plan.steps.length} steps`
      );
      console.log(`[Chain] Reasoning: ${plan.reasoning}`);

      return plan;
    } catch (error) {
      console.error("[Chain] Error planning tool chain:", error);
      return null;
    }
  }

  /**
   * Execute tool chain ตามแผนที่วางไว้
   */
  private async executeToolChain(
    plan: ToolChainPlan,
    userMessage: string
  ): Promise<ChainExecutionResult[]> {
    console.log("===== Starting executeToolChain =====");
    console.log(`[Chain] Executing ${plan.steps.length} steps`);
    console.log(`[Chain] Reasoning: ${plan.reasoning}`);

    const results: ChainExecutionResult[] = [];
    const stepResults = new Map<number, any>(); // เก็บผลของแต่ละ step

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const startTime = Date.now();

      console.log(`\n[Chain] ===== Step ${i + 1}/${plan.steps.length} =====`);
      console.log(`[Chain] Tool: ${step.toolName}`);
      console.log(`[Chain] Description: ${step.description}`);

      try {
        // ตรวจสอบ dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          console.log(
            `[Chain] Waiting for dependencies: ${step.dependsOn.join(", ")}`
          );

          // ดึงผลจาก dependencies
          const dependencyResults = step.dependsOn
            .map((idx) => stepResults.get(idx))
            .filter((r) => r); // กรองเฉพาะที่มีค่า

          // ตรวจสอบว่า dependencies สำเร็จหรือไม่
          const failedDeps = step.dependsOn.filter((idx) => {
            const result = stepResults.get(idx);
            return !result || result.error;
          });

          if (failedDeps.length > 0) {
            console.error(
              `[Chain] Dependencies failed: ${failedDeps.join(", ")}`
            );
            results.push({
              step: i + 1,
              toolName: step.toolName,
              description: step.description,
              error: `Dependencies failed: steps ${failedDeps
                .map((d) => d + 1)
                .join(", ")}`,
              success: false,
              executionTime: Date.now() - startTime,
            });
            break; // หยุด chain
          }

          // สร้าง context จาก dependencies
          const contextForArgs = this.createDependencyContext(
            userMessage,
            step,
            dependencyResults
          );

          console.log(`[Chain] Created context from dependencies`);

          // Regenerate args ด้วย context ใหม่
          const tool = this.tools.get(step.toolName);
          if (tool) {
            step.args = await this.generateToolArgumentsWithContext(
              tool,
              userMessage,
              contextForArgs
            );
            console.log(
              `[Chain] Generated args with dependencies: ${JSON.stringify(
                step.args
              )}`
            );
          }
        } else {
          console.log(`[Chain] No dependencies, generating args normally`);
          const tool = this.tools.get(step.toolName);
          if (tool) {
            step.args = await this.generateToolArguments(tool, userMessage);
          }
        }

        // Execute tool
        console.log(`[Chain] Executing tool...`);
        const toolResults = await this.executeTools(
          [step.toolName],
          userMessage
        );

        if (toolResults.length === 0) {
          throw new Error("No results from tool execution");
        }

        const toolResult = toolResults[0];

        // บันทึกผล
        const executionTime = Date.now() - startTime;

        if (toolResult.error) {
          console.error(`[Chain] ❌ Step ${i + 1} failed: ${toolResult.error}`);
          results.push({
            step: i + 1,
            toolName: step.toolName,
            description: step.description,
            error: toolResult.error,
            success: false,
            executionTime,
          });

          // หยุด chain ถ้ามี error
          break;
        } else {
          console.log(
            `[Chain] ✅ Step ${i + 1} succeeded (${executionTime}ms)`
          );
          stepResults.set(i, toolResult.result);

          results.push({
            step: i + 1,
            toolName: step.toolName,
            description: step.description,
            result: toolResult.result,
            success: true,
            executionTime,
          });
        }
      } catch (error) {
        console.error(`[Chain] ❌ Step ${i + 1} error:`, error);
        results.push({
          step: i + 1,
          toolName: step.toolName,
          description: step.description,
          error: error instanceof Error ? error.message : String(error),
          success: false,
          executionTime: Date.now() - startTime,
        });
        break; // หยุด chain
      }
    }

    console.log(`[Chain] ===== Chain Execution Complete =====`);
    console.log(`[Chain] Total steps: ${results.length}/${plan.steps.length}`);
    console.log(
      `[Chain] Successful: ${results.filter((r) => r.success).length}/${
        results.length
      }`
    );

    return results;
  }

  /**
   * สร้าง context จาก dependencies สำหรับการสร้าง args
   */
  private createDependencyContext(
    userMessage: string,
    step: ToolChainStep,
    dependencyResults: any[]
  ): string {
    let context = `คำถามเดิม: "${userMessage}"\n\n`;
    context += `ขั้นตอนปัจจุบัน: ${step.description}\n`;
    context += `Tool ที่จะใช้: ${step.toolName}\n\n`;
    context += `ผลลัพธ์จากขั้นตอนก่อนหน้า:\n`;

    dependencyResults.forEach((result, idx) => {
      if (!result) return;

      const resultStr =
        typeof result === "string" ? result : JSON.stringify(result, null, 2);

      context += `\n--- ผลจาก Step ${idx + 1} ---\n`;
      context += resultStr;
      context += `\n`;
    });

    context += `\nให้สร้าง parameters สำหรับ ${step.toolName} โดยใช้ข้อมูลจากผลลัพธ์ข้างต้น`;

    return context;
  }

  /**
   * สร้าง tool arguments โดยใช้ context จาก dependencies
   */
  private async generateToolArgumentsWithContext(
    tool: MCPTool,
    userMessage: string,
    context: string
  ): Promise<any> {
    try {
      const schema = tool.inputSchema || {};
      const schemaStr = JSON.stringify(schema, null, 2);
      const required = schema.required || [];

      const prompt = `สร้าง parameters JSON สำหรับ tool โดยใช้ข้อมูลจาก context

${context}

Schema ของ tool:
${schemaStr}

Parameters ที่จำเป็น: ${required.length > 0 ? required.join(", ") : "ไม่มี"}

กฎ:
1. ตอบเป็น JSON object ที่มีเฉพาะ parameters เท่านั้น
2. ใช้ข้อมูลจาก context ข้างต้นในการสร้าง parameters
3. ห้ามส่งผลลัพธ์ (result) หรือข้อมูลอื่นที่ไม่ใช่ parameters
4. ถ้าไม่มี parameter ให้ส่ง {}

JSON:`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 300 }
      );

      let jsonStr = String(response?.message?.content || "").trim();
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const extracted = this.extractJsonFromText(jsonStr);
      if (extracted) {
        jsonStr = extracted;
      }

      let parsed: any = {};
      try {
        if (jsonStr && jsonStr.length > 0) {
          parsed = JSON.parse(jsonStr);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            parsed = {};
          }
        }

        // ลบฟิลด์ที่ไม่ใช่ parameters
        const invalidFields = [
          "success",
          "data",
          "markdown",
          "error",
          "result",
        ];
        for (const field of invalidFields) {
          if (field in parsed) delete parsed[field];
        }

        // ลบ numeric keys
        for (const key of Object.keys(parsed)) {
          if (/^\d+$/.test(key)) delete parsed[key];
        }
      } catch (parseError) {
        console.warn("[Chain] Failed to parse JSON, using empty object");
        parsed = {};
      }

      // เติม required fields ที่ขาด
      for (const key of required) {
        if (!(key in parsed)) {
          parsed[key] = schema.properties?.[key]?.default ?? "";
        }
      }

      return parsed;
    } catch (error) {
      console.error("[Chain] Error generating args with context:", error);
      return {};
    }
  }

  /**
   * สร้าง enhanced context จาก chain results
   */
  private createChainContext(
    userMessage: string,
    chainResults: ChainExecutionResult[]
  ): string {
    let context = `คำถามเดิม: "${userMessage}"\n\n`;
    context += `ผลลัพธ์จาก Tool Chain (${chainResults.length} steps):\n\n`;

    for (const result of chainResults) {
      const statusIcon = result.success ? "✅" : "❌";
      const timeStr = result.executionTime ? `(${result.executionTime}ms)` : "";

      context += `${statusIcon} Step ${result.step}: ${result.toolName} ${timeStr}\n`;
      context += `   วัตถุประสงค์: ${result.description}\n`;

      if (result.error) {
        context += `   ❌ Error: ${result.error}\n\n`;
      } else if (result.result) {
        const resultStr =
          typeof result.result === "string"
            ? result.result
            : JSON.stringify(result.result, null, 2);
        context += `   ผลลัพธ์:\n${resultStr}\n\n`;
      }
    }

    // เพิ่มคำแนะนำ
    const successCount = chainResults.filter((r) => r.success).length;
    const successRate = (successCount / chainResults.length) * 100;

    context += `\nสรุป: สำเร็จ ${successCount}/${
      chainResults.length
    } steps (${successRate.toFixed(0)}%)\n`;

    if (successRate === 100) {
      context += `💡 ข้อมูลครบถ้วน ใช้ผลจากทุก steps ในการตอบ\n`;
    } else if (successRate >= 50) {
      context += `⚠️ มีบาง steps ล้มเหลว ให้ใช้ข้อมูลที่มีในการตอบ\n`;
    } else {
      context += `❌ Tool chain ล้มเหลวส่วนใหญ่ ให้ตอบโดยไม่พึ่งพาข้อมูลมาก\n`;
    }

    return context;
  }

  // ========================================
  // MAIN PROCESS MESSAGE (WITH CHAINING)
  // ========================================

  /**
   * ประมวลผลข้อความจากผู้ใช้ พร้อม tool chaining
   */
  async processMessage(userMessage: string): Promise<{
    needsTools: boolean;
    toolResults?: any[];
    enhancedContext?: string;
    toolsFailed?: boolean;
    usedChaining?: boolean;
    chainPlan?: ToolChainPlan;
  }> {
    console.log("===== Starting processMessage =====");

    // เลือก tools
    const selectedTools = await this.selectTools(userMessage);

    if (selectedTools.length === 0) {
      console.log("[Process] No tools selected");
      return { needsTools: false };
    }

    // ลองวางแผน chain
    const chainPlan = await this.planToolChain(userMessage, selectedTools);

    if (chainPlan && chainPlan.isChainable) {
      console.log(
        `[Process] 🔗 Using tool chain with ${chainPlan.steps.length} steps`
      );

      // Execute chain
      const chainResults = await this.executeToolChain(chainPlan, userMessage);

      const successfulResults = chainResults.filter((r) => r.success);

      if (successfulResults.length === 0) {
        console.log("[Process] All chain steps failed");
        return { needsTools: false, toolsFailed: true, usedChaining: true };
      }

      // สร้าง enhanced context จาก chain
      const enhancedContext = this.createChainContext(
        userMessage,
        chainResults
      );

      return {
        needsTools: true,
        toolResults: chainResults,
        enhancedContext,
        usedChaining: true,
        chainPlan,
      };
    }

    // ถ้าไม่ต้อง chain ให้ execute ปกติ
    console.log("[Process] No chaining needed, executing tools normally");

    const toolResults = await this.executeTools(selectedTools, userMessage);
    const successfulResults = toolResults.filter((r) => r.success);

    if (successfulResults.length === 0) {
      console.log("[Process] All tools failed");
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
      usedChaining: false,
    };
  }

  // ========================================
  // TOOL EXECUTION
  // ========================================

  async executeTools(toolNames: string[], userMessage: string): Promise<any[]> {
    console.log("===== Starting executeTools =====");
    const results: any[] = [];

    for (const toolName of toolNames) {
      let retries = 2;
      let lastError: any = null;

      while (retries > 0) {
        try {
          const [clientName, actualToolName] = toolName.split(":");
          const client = this.clients.get(clientName);
          const tool = this.tools.get(toolName);
          const resource = this.resources.get(toolName);

          if (!client) {
            console.warn(`[MCP Client] Client not found: ${toolName}`);
            break;
          }

          let args = resource
            ? await this.generateToolArguments(
                {
                  name: resource.name,
                  description: resource.description,
                  inputSchema: resource.inputSchema,
                  category: "resource",
                  keywords: [],
                  examples: [],
                } as MCPTool,
                userMessage
              )
            : await this.generateToolArguments(tool!, userMessage);

          const schema = tool ? tool.inputSchema : resource?.inputSchema;

          if (schema) {
            const validation = this.validateArguments(args, schema);
            if (!validation.valid) {
              console.warn(
                `[MCP Client] Invalid arguments:`,
                validation.errors
              );
              for (const key of schema.required || []) {
                if (!(key in args)) {
                  args[key] = schema.properties?.[key]?.default || "";
                }
              }
            }
          }

          console.log(`[MCP Client] Executing: ${toolName}`);

          let result: any;

          if (resource) {
            result = await client.callTool({
              name: resource.name,
              arguments: args,
            });
          } else {
            result = await client.callTool({
              name: actualToolName,
              arguments: args,
            });
          }

          if (result.isError) {
            const errText =
              result.content && result.content.length > 0
                ? result.content[0].text
                : "Tool execution error";

            results.push({
              toolName,
              error: errText,
              success: false,
            });
          } else {
            let payload: any = result.content;

            try {
              if (Array.isArray(result.content) && result.content.length > 0) {
                const first = result.content[0] as any;
                if (first && typeof first.text === "string") {
                  const extracted = this.extractJsonFromText(first.text);
                  if (extracted) {
                    payload = JSON.parse(extracted);
                  }
                }
              }
            } catch (e) {
              // use original payload
            }

            results.push({
              toolName,
              result: payload,
              structuredContent: result.structuredContent,
              success: true,
            });
          }

          break;
        } catch (error) {
          lastError = error;
          retries--;

          if (retries > 0) {
            console.warn(`[MCP Client] Retry ${toolName}, ${retries} left`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (retries === 0 && lastError) {
        console.error(`[MCP Client] Error executing ${toolName}:`, lastError);
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

  private async generateToolArguments(
    tool: MCPTool,
    userMessage: string
  ): Promise<any> {
    try {
      const schema = tool.inputSchema || {};
      const schemaStr = JSON.stringify(schema, null, 2);
      const required = schema.required || [];

      const prompt = `สร้าง parameters JSON สำหรับ tool

คำขอ: "${userMessage}"
Tool: ${tool.name}
คำอธิบาย: ${tool.description || "ไม่มี"}

Schema:
${schemaStr}

Parameters ที่จำเป็น: ${required.length > 0 ? required.join(", ") : "ไม่มี"}

กฎ:
1. ตอบเป็น JSON object ที่มีเฉพาะ parameters เท่านั้น
2. ห้ามส่งผลลัพธ์หรือข้อมูลอื่น
3. ถ้าไม่มี parameter ให้ส่ง {}

JSON:`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 200 }
      );

      let jsonStr = String(response?.message?.content || "").trim();
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const extracted = this.extractJsonFromText(jsonStr);
      if (extracted) jsonStr = extracted;

      let parsed: any = {};
      try {
        if (jsonStr && jsonStr.length > 0) {
          parsed = JSON.parse(jsonStr);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            parsed = {};
          }
        }

        const invalidFields = [
          "success",
          "data",
          "markdown",
          "error",
          "result",
        ];
        for (const field of invalidFields) {
          if (field in parsed) delete parsed[field];
        }

        for (const key of Object.keys(parsed)) {
          if (/^\d+$/.test(key)) delete parsed[key];
        }
      } catch (parseError) {
        parsed = {};
      }

      for (const key of required) {
        if (!(key in parsed)) {
          parsed[key] = schema.properties?.[key]?.default ?? "";
        }
      }

      return parsed;
    } catch (error) {
      console.error("[MCP Client] Error generating args:", error);
      return {};
    }
  }

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

  private extractJsonFromText(text: string): string | null {
    if (!text || typeof text !== "string") return null;

    const firstIdx = text.search(/[\{\[]/);
    if (firstIdx === -1) return null;

    const openChar = text[firstIdx];
    const closeChar = openChar === "{" ? "}" : "]";

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = firstIdx; i < text.length; i++) {
      const ch = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === "\\") {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          return text.slice(firstIdx, i + 1).trim();
        }
      }
    }

    return null;
  }

  private createEnhancedContext(
    userMessage: string,
    toolResults: any[]
  ): string {
    let context = `คำถาม: "${userMessage}"\n\nข้อมูลจาก Tools:\n\n`;

    for (const result of toolResults) {
      if (result.error) {
        context += `❌ ${result.toolName}: ${result.error}\n`;
      } else {
        const resultStr =
          typeof result.result === "string"
            ? result.result
            : JSON.stringify(result.result, null, 2);
        context += `✅ ${result.toolName}:\n${resultStr}\n\n`;
      }
    }

    return context;
  }

  async generateHtmlResponse(
    userInstruction: string,
    extraContext?: string,
    options?: any
  ): Promise<string> {
    try {
      const contextPart = extraContext ? `${extraContext}\n\n` : "";
      const fullPrompt = `${contextPart}${userInstruction}`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: fullPrompt }],
        Object.assign({ temperature: 0.2, num_predict: 400 }, options || {})
      );

      return String(response?.message?.content || "").trim();
    } catch (err) {
      console.error("[MCP Client] generateHtmlResponse error:", err);
      return "";
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getAvailableResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  getConversationHistory(): ConversationContext[] {
    return [...this.conversationHistory];
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  clearCache() {
    this.selectionCache.clear();
  }

  clearAll() {
    this.clearCache();
    this.clearHistory();
  }

  getStatistics() {
    return {
      connectedClients: this.clients.size,
      availableTools: this.tools.size,
      availableResources: this.resources.size,
      cachedQueries: this.selectionCache.size,
      historySize: this.conversationHistory.length,
      patterns: this.toolPatterns.length,
    };
  }

  // ========================================
  // CACHING & HISTORY
  // ========================================

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, " ");
  }

  private getCachedSelection(query: string): string[] | null {
    const normalized = this.normalizeQuery(query);
    const cached = this.selectionCache.get(normalized);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[MCP Client] Using cached tool selection`);
      return cached.tools;
    }

    return null;
  }

  private cacheSelection(query: string, tools: string[]) {
    const normalized = this.normalizeQuery(query);
    this.selectionCache.set(normalized, {
      query: normalized,
      tools,
      timestamp: Date.now(),
    });
  }

  private addToHistory(query: string, tools: string[]) {
    this.conversationHistory.push({
      query,
      tools,
      timestamp: Date.now(),
    });

    if (this.conversationHistory.length > this.maxHistorySize) {
      this.conversationHistory.shift();
    }
  }

  // ========================================
  // TOOL SELECTION & SCORING
  // ========================================

  private isGreetingQuery(query: string): boolean {
    const greetingPatterns = [
      /^(สวัสดี|hi|hello|hey)/i,
      /^(good\s*(morning|afternoon|evening))/i,
    ];
    return greetingPatterns.some((p) => p.test(query.trim()));
  }

  private async scoreToolRelevance(
    toolName: string,
    userMessage: string
  ): Promise<number> {
    const tool = this.tools.get(toolName);
    const resource = this.resources.get(toolName);

    if (!tool && !resource) return 0;

    const description = tool?.description || resource?.description || "";
    const keywords =
      tool?.keywords || (await this.extractKeywords(toolName, description));
    const searchText = `${toolName} ${description} ${keywords.join(
      " "
    )}`.toLowerCase();

    let userTokens: string[] = [];
    try {
      userTokens = await this.tokenizeThaiWithOllama(userMessage);
      const englishTokens =
        this.tokenizer.tokenize(userMessage.toLowerCase()) || [];
      userTokens = [...new Set([...userTokens, ...englishTokens])];
    } catch (error) {
      userTokens = this.tokenizer.tokenize(userMessage.toLowerCase()) || [];
    }

    // TF-IDF scoring
    let tfidfScore = 0;
    const tempTfidf = new natural.TfIdf();
    tempTfidf.addDocument(searchText);
    userTokens.forEach((token) => {
      tempTfidf.tfidfs(token, (i, measure) => {
        tfidfScore += measure;
      });
    });
    tfidfScore = Math.min(tfidfScore * 10, 50);

    // Fuse.js scoring
    const fuse = new Fuse([searchText], {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
    });

    let fuseScore = 0;
    for (const token of userTokens) {
      if (token.length < 2) continue;
      const results = fuse.search(token.toLowerCase());
      if (results.length > 0) {
        fuseScore += Math.max(0, (1 - (results[0].score || 1)) * 100);
      }
    }
    fuseScore = fuseScore / Math.max(userTokens.length, 1);

    // Category bonus
    let categoryScore = 0;
    if (tool?.category) {
      const categoryKeywords: Record<string, string[]> = {
        datetime: ["วันนี้", "เวลา", "time", "date"],
        webd: ["webd", "ผิดกฎหมาย", "url"],
        weather: ["tmd", "weather", "ฝน", "อากาศ"],
        visualization: ["กราฟ", "chart", "graph"],
      };

      const catKeys = categoryKeywords[tool.category] || [];
      const matches = catKeys.filter((k) =>
        userTokens.some((t) => t.toLowerCase().includes(k.toLowerCase()))
      );
      categoryScore = matches.length * 5;
    }

    const totalScore = tfidfScore + fuseScore + categoryScore;
    console.log(
      `[MCP Client] Score for ${toolName}: ${totalScore.toFixed(
        2
      )} (TF-IDF: ${tfidfScore.toFixed(1)}, Fuse: ${fuseScore.toFixed(
        1
      )}, Category: ${categoryScore})`
    );

    return totalScore;
  }

  private async deduplicateAndRankTools(
    candidates: string[],
    userMessage: string
  ): Promise<string[]> {
    if (candidates.length === 0) return [];

    const uniqueCandidates = [...new Set(candidates)];

    const scoredTools = await Promise.all(
      uniqueCandidates.map(async (toolName) => ({
        toolName,
        score: await this.scoreToolRelevance(toolName, userMessage),
      }))
    );

    const sorted = scoredTools
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score);

    // Greeting special case
    if (this.isGreetingQuery(userMessage)) {
      const greetingResource = sorted.find(
        (t) => t.toolName.includes("greeting") && this.resources.has(t.toolName)
      );
      if (greetingResource) return [greetingResource.toolName];
    }

    const topScore = sorted[0]?.score || 0;
    const selected = sorted
      .filter((t) => t.score >= topScore * 0.7)
      .slice(0, 10);

    return selected.map((t) => t.toolName);
  }

  async selectTools(userMessage: string): Promise<string[]> {
    const cached = this.getCachedSelection(userMessage);
    if (cached) return cached;

    console.log(`[MCP Client] ===== Tool Selection Start =====`);
    console.log(`[MCP Client] Query: "${userMessage}"`);

    let candidates: string[] = [];

    // Pattern matching
    candidates = await this.tryPatternMatching(userMessage);
    if (candidates.length > 0) {
      console.log(`[MCP Client] ✅ Pattern matching: ${candidates.join(", ")}`);
    }

    // Keyword matching
    if (candidates.length === 0) {
      candidates = await this.tryKeywordMatching(userMessage);
      if (candidates.length > 0) {
        console.log(
          `[MCP Client] ✅ Keyword matching: ${candidates.join(", ")}`
        );
      }
    }

    // AI selection
    if (candidates.length === 0) {
      candidates = await this.tryAISelection(userMessage);
      if (candidates.length > 0) {
        console.log(`[MCP Client] ✅ AI selection: ${candidates.join(", ")}`);
      }
    }

    const finalSelection = candidates.slice(0, 3); // Allow up to 3 tools for chaining

    console.log(
      `[MCP Client] Final selection: ${finalSelection.join(", ") || "none"}`
    );
    console.log(`[MCP Client] ===== Tool Selection End =====`);

    this.cacheSelection(userMessage, finalSelection);
    this.addToHistory(userMessage, finalSelection);

    return finalSelection;
  }

  private async tryPatternMatching(userMessage: string): Promise<string[]> {
    if (this.isGreetingQuery(userMessage)) {
      const greetingResources = Array.from(this.resources.keys()).filter((k) =>
        k.includes("greeting")
      );
      if (greetingResources.length > 0) return [greetingResources[0]];
    }

    const patternData = this.toolPatterns.map((p) => ({
      category: p.category,
      keywords: p.keywords.join(" "),
      pattern: p,
    }));

    const patternFuse = makeFuse(patternData as any, {
      keys: ["keywords", "category"],
      threshold: 0.35,
    });

    const results = runSearch(patternFuse, userMessage.toLowerCase()) as any[];
    const toolScores = new Map<string, number>();

    for (const pr of results) {
      const origPattern: ToolPattern = pr.item.pattern;
      const priorityScore = origPattern.priority === "high" ? 15 : 8;

      const matchedTools = Array.from(this.tools.keys()).filter((k) =>
        origPattern.toolPattern.test(k)
      );
      const matchedResources = Array.from(this.resources.keys()).filter((k) =>
        origPattern.toolPattern.test(k)
      );

      const allMatches = [...matchedTools, ...matchedResources];
      const score = (1 - (pr.score ?? 0)) * 100 * (priorityScore / 10);

      allMatches.forEach((tool) => {
        const current = toolScores.get(tool) || 0;
        toolScores.set(tool, current + score);
      });
    }

    const candidates = Array.from(toolScores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= 10)
      .map(([tool]) => tool);

    return await this.deduplicateAndRankTools(candidates, userMessage);
  }

  private async tryKeywordMatching(userMessage: string): Promise<string[]> {
    const thaiTokens = await this.tokenizeThaiWithOllama(userMessage);
    const englishTokens =
      this.tokenizer.tokenize(userMessage.toLowerCase()) || [];
    const allTokens = [...new Set([...thaiTokens, ...englishTokens])];

    const toolData = Array.from(this.tools.entries()).map(
      ([toolName, tool]) => ({
        id: toolName,
        searchText: `${toolName} ${tool.description} ${tool.keywords.join(
          " "
        )}`.toLowerCase(),
      })
    );

    const resourceData = Array.from(this.resources.entries()).map(
      ([resourceName, resource]) => ({
        id: resourceName,
        searchText:
          `${resourceName} ${resource.description} ${resource.title}`.toLowerCase(),
      })
    );

    const combined = [...toolData, ...resourceData];
    const dataFuse = makeFuse(combined as any, {
      keys: ["searchText"],
      threshold: 0.6,
      ignoreLocation: true,
    });

    const tokenResults: any[] = [];
    for (const token of allTokens) {
      if (token.length < 2) continue;
      const results = runSearch(dataFuse, token) as any[];
      tokenResults.push(...results);
    }

    const seen = new Set<string>();
    const uniqueResults = tokenResults.filter((r) => {
      if (seen.has(r.item.id)) return false;
      seen.add(r.item.id);
      return true;
    });

    const matches = uniqueResults
      .map((r) => ({
        id: r.item.id,
        score: Math.max(0, (1 - (r.score ?? 1)) * 100),
      }))
      .filter((m) => m.score >= 10)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.id);

    return await this.deduplicateAndRankTools(matches, userMessage);
  }

  private async tryAISelection(userMessage: string): Promise<string[]> {
    try {
      const allTools = Array.from(this.tools.keys());
      const allResources = Array.from(this.resources.keys());
      const allItems = [...allTools, ...allResources].slice(0, 50);

      const selectedTools = new Map<string, MCPTool>();
      const selectedResources = new Map<string, MCPResource>();

      for (const itemName of allItems) {
        if (this.tools.has(itemName)) {
          selectedTools.set(itemName, this.tools.get(itemName)!);
        } else if (this.resources.has(itemName)) {
          selectedResources.set(itemName, this.resources.get(itemName)!);
        }
      }

      const toolDescriptions = await getToolDescriptions(
        selectedTools,
        selectedResources
      );

      const prompt = `เลือก tool ที่เหมาะสมสำหรับคำถาม (สูงสุด 3 tools)

คำถาม: "${userMessage}"

${toolDescriptions}

กฎ:
1. เลือก 1-3 tools ที่เกี่ยวข้อง
2. ถ้าไม่มี tool ที่เหมาะสม ตอบ "none"
3. ถ้าต้องการหลาย tools (เช่น ดึงข้อมูลแล้วสร้างกราฟ) ให้เลือกหลายตัว

ตอบเฉพาะชื่อ tool คั่นด้วย comma หรือ "none":`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 100 }
      );

      const rawText = String(response?.message?.content || "").trim();

      if (rawText.toLowerCase().includes("none")) {
        console.log("[MCP Client] AI selection: no suitable tools");
        return [];
      }

      const selectedItems = rawText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => {
          return allItems.find(
            (item) => item === t || item.endsWith(`:${t}`) || item.includes(t)
          );
        })
        .filter((t) => t) as string[];

      return await this.deduplicateAndRankTools(selectedItems, userMessage);
    } catch (error) {
      console.error("[MCP Client] AI selection error:", error);
      return [];
    }
  }

  private async tokenizeThaiWithOllama(text: string): Promise<string[]> {
    try {
      console.log(`[MCP Client] Tokenizing Thai text: "${text}"`);
      const prompt = `ตัดคำภาษาไทยจากข้อความต่อไปนี้ และตอบเฉพาะรายการคำที่ตัดแล้ว คั่นด้วย comma:

ข้อความ: "${text}"

คำที่ตัด:`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 100 }
      );

      const rawText = String(response.message?.content || "").trim();

      if (rawText.toLowerCase().includes("none")) return [];

      const tokens = rawText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      console.log(`[MCP Client] Tokenized tokens: ${tokens.join(", ")}`);
      return tokens;
    } catch (error) {
      console.warn("[MCP Client] Ollama tokenization failed:", error);
      return this.tokenizer.tokenize(text) || [];
    }
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

async function getToolDescriptions(
  tools: Map<string, MCPTool>,
  resources?: Map<string, MCPResource>,
  userMessage?: string,
  scoreToolRelevance?: (toolName: string, message: string) => Promise<number>
): Promise<string> {
  let descriptions = "**Tools**:\n";

  const toolList = Array.from(tools.values());

  let scoredTools: Array<{ tool: MCPTool; score?: number }> = toolList.map(
    (tool) => ({
      tool,
    })
  );

  if (userMessage && scoreToolRelevance) {
    const scorePromises = toolList.map(async (tool) => {
      const fullName =
        Array.from(tools.entries()).find(([, t]) => t === tool)?.[0] ||
        tool.name;
      const score = await scoreToolRelevance(fullName, userMessage);
      return { tool, score };
    });

    scoredTools = await Promise.all(scorePromises);
    scoredTools.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  descriptions += scoredTools
    .map(({ tool, score }) => {
      const scoreText =
        score !== undefined ? ` (คะแนน: ${score.toFixed(2)})` : "";
      return `- ${tool.name}${scoreText}
  คำอธิบาย: ${tool.description}
  หมวดหมู่: ${tool.category}
  ตัวอย่าง: ${tool.examples.slice(0, 2).join(", ")}`;
    })
    .join("\n\n");

  if (resources && resources.size > 0) {
    descriptions += "\n\n**Resources**:\n";

    const resourceList = Array.from(resources.values());
    let scoredResources: Array<{ resource: MCPResource; score?: number }> =
      resourceList.map((resource) => ({ resource }));

    if (userMessage && scoreToolRelevance) {
      const scorePromises = resourceList.map(async (resource) => {
        const fullName =
          Array.from(resources.entries()).find(
            ([, r]) => r === resource
          )?.[0] || resource.name;
        const score = await scoreToolRelevance(fullName, userMessage);
        return { resource, score };
      });

      scoredResources = await Promise.all(scorePromises);
      scoredResources.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    descriptions += scoredResources
      .map(({ resource, score }) => {
        const scoreText =
          score !== undefined ? ` (คะแนน: ${score.toFixed(2)})` : "";
        return `- ${resource.name}${scoreText}
  คำอธิบาย: ${resource.description || "ไม่มีคำอธิบาย"}
  ประเภท: Resource`;
      })
      .join("\n\n");
  }

  return descriptions;
}

function createDefaultConfigs(serverScript: string): MCPClientConfig[] {
  return [
    {
      name: "innomcp-server",
      version: "1.0.0",
      serverUrl: process.env.MCP_SERVER_URL || "http://localhost:3012/mcp",
    },
  ];
}

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
      console.log("[MCP Client] Statistics:", mcpClient.getStatistics());
      mcpClient.emit("ready");
    })
    .catch((err) => {
      console.error("[MCP Client] Initialization error:", err);
    });

  return mcpClient;
}

export function markdownToHtml(markdown: string): string {
  try {
    const processed = unified()
      .use(remarkParse as any)
      .use(remarkRehype as any, { allowDangerousHtml: false } as any)
      .use(rehypeSanitize as any)
      .use(rehypeStringify as any, { allowDangerousHtml: false } as any)
      .processSync(markdown as any);

    return String(processed);
  } catch (error) {
    console.error("Error converting Markdown to HTML:", error);
    return markdown;
  }
}

export {
  InitMcpClient,
  IntelligentMCPClient,
  MCPTool,
  MCPClientConfig,
  ToolChainPlan,
  ToolChainStep,
  ChainExecutionResult,
};

export default InitMcpClient;

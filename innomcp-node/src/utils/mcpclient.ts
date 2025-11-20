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

// Interface for MCP Tool Definition
interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  category: string;
  keywords: string[];
  examples: string[];
}

// Interface for MCP Resource Definition
interface MCPResource {
  name: string;
  title?: string;
  description?: string;
  uriTemplate?: string;
  inputSchema?: any;
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

// Interface for Conversation History
interface ConversationContext {
  query: string;
  tools: string[];
  timestamp: number;
}

// Interface for Tool Pattern
interface ToolPattern {
  keywords: string[];
  toolPattern: RegExp;
  priority: "high" | "medium" | "low";
  category?: string;
}

// Define the system prompt for Ollama (JSON-only enforcement with Markdown field)
// IMPORTANT: This prompt strongly instructs the model to reply with valid JSON only.
// The JSON MUST include a top-level field named "markdown" (string) that contains
// the human-facing answer formatted in Markdown. Do NOT produce HTML, code fences
// or any text outside the JSON object/array.
const SYSTEM_PROMPT = `คุณเป็น AI ที่จะตอบกลับเป็น JSON เท่านั้น:
1. ตอบกลับเฉพาะ JSON ที่ถูกต้อง (valid JSON) เท่านั้น — ไม่มี HTML, ไม่มี code fence, ไม่มีข้อความนอก JSON
2. JSON ต้องมีฟิลด์ระดับบนสุดชื่อ "markdown" ซึ่งเป็นข้อความสตริงที่มีคำตอบสำหรับผู้ใช้ในรูปแบบ Markdown (เช่น ใช้ #, ##, -, *, 
  รายการ, ตาราง Markdown เป็นต้น)
3. โครงสร้าง JSON สามารถมีฟิลด์เพิ่มเติมได้ เช่น "success", "data", "meta" ฯลฯ แต่ต้องมี "markdown" เสมอ
4. หากไม่สามารถให้ข้อมูลตามคำขอ ให้ตอบเป็น JSON เช่น:
  {"success": false, "error": "สาเหตุที่ไม่สามารถตอบได้", "markdown":""}
5. ห้ามส่งคำอธิบายเพิ่มเติมใดๆ นอก JSON (เช่น "หมายเหตุ:", "หมายเหตุเพิ่มเติม:")
6. อย่าใส่ styling หรือ HTML tags ใดๆ ในฟิลด์ markdown — ให้ใช้ Markdown ธรรมดาเท่านั้น
7. หากต้องการถามเพื่อขอข้อมูลเพิ่มเติม ให้ตอบด้วย JSON ที่ชัดเจนเช่น:
  {"success": false, "error": "missing_required_field", "missing":["field1"], "markdown":"โปรดยืนยัน field1"}
8. ภาษาในการคืนค่าควรเป็นไทยเป็นหลัก แต่ข้อความในฟิลด์อื่นๆ สามารถเป็นภาษาอังกฤษได้ตามสมควร
9. ตัวอย่างการตอบที่ถูกต้อง:
  {"success": true, "data": {"count": 3}, "markdown": "# ผลลัพธ์\n- จำนวน: 3\n- สถานะ: สำเร็จ"}`;

class IntelligentMCPClient extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private ollama: Ollama;
  private ollamaModel: string;
  private ajv: Ajv;
  private selectionCache: Map<string, ToolSelectionCache> = new Map();
  private cacheTTL: number = 300000; // 5 minutes cache TTL
  private conversationHistory: ConversationContext[] = [];
  private maxHistorySize: number = 10;

  // Tool patterns for enhanced matching
  private toolPatterns: ToolPattern[] = [
    {
      keywords: ["สวัสดี", "ทักทาย", "hello", "hi", "greeting", "ทักท"],
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
        "ปัจจุบัน",
        "today",
        "now",
        "time",
        "date",
        "current",
        "datetime",
        "วันอะไร",
        "เดือน",
        "ปี",
        "ชั่วโมง",
        "นาที",
        "วินาที",
      ],
      toolPattern: /datetime|time|date/i,
      priority: "high",
      category: "datetime",
    },
    {
      keywords: [
        "พยากรณ์อากาศ",
        "อากาศวันนี้",
        "อุณหภูมิวันนี้",
        "weather",
        "forecast",
        "สภาพอากาศ",
        "อากาศ",
        "ฝนตกไหม่",
      ],
      toolPattern: /weather|forecast|อากาศ/i,
      priority: "high",
      category: "weather",
    },
    {
      keywords: [
        "webd",
        "ผิดกฎหมาย",
        "คำสั่งศาล",
        "เว็บไซต์ผิดกฎหมาย",
        "เว็บผิดกฎหมาย",
        "สถิติเว็บไซต์",
        "จำนวนเว็บไซต์",
      ],
      toolPattern: /^webdTool_/i,
      priority: "high",
      category: "webd",
    },
  ];

  constructor(ollama: Ollama, ollamaModel: string) {
    super();
    this.ollama = ollama;
    this.ollamaModel = ollamaModel;
    this.ajv = new Ajv({ allErrors: true });
  }

  // Robust Ollama chat wrapper
  private async chatWithOllama(messages: any[], options?: any): Promise<any> {
    console.log("[MCP Client] chatWithOllama called", { messages, options });
    try {
      console.log("[MCP Client] Calling ollama.chat (sync)", {
        model: this.ollamaModel,
        messages,
        options,
      });
      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages,
        stream: false,
        options: options || {},
      });

      console.log("[MCP Client] ollama.chat (sync) response", response);
      if (response && response.message) return response;

      console.warn(
        "[MCP Client] Ollama returned unexpected response shape, trying stream fallback"
      );
    } catch (err) {
      console.warn(
        "[MCP Client] Ollama sync chat failed, attempting stream fallback:",
        String(err)
      );
    }

    // Streaming fallback
    try {
      console.log("[MCP Client] Calling ollama.chat (stream)", {
        model: this.ollamaModel,
        messages,
        options,
      });
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
        } else if (chunk.delta && chunk.delta.content) {
          content += chunk.delta.content;
        }
      }

      console.log("[MCP Client] ollama.chat (stream) result", { content });
      return { message: { content } };
    } catch (err) {
      console.error("[MCP Client] Ollama stream fallback failed:", err);
      throw err;
    }
  }

  // JSON-enforcing wrapper around chatWithOllama
  // Tries to parse the model output as JSON. If parsing fails, will attempt to extract
  // a JSON substring, and retry the model with a short system instruction up to `maxRetries` times.
  private async chatWithOllamaJSON(
    messages: any[],
    options?: any,
    maxRetries = 2,
    requiredMarkdownField = "markdown"
  ): Promise<any> {
    const retryInstruction = {
      role: "system",
      content: `สำคัญ: ตอบกลับเป็น JSON เท่านั้น และต้องมีฟิลด์ระดับบนสุดชื่อ "${requiredMarkdownField}" ซึ่งเป็นสตริง Markdown สำหรับผู้ใช้. ห้ามส่ง HTML หรือข้อความนอก JSON.`,
    };

    // Use a working copy so we don't mutate the caller's array unexpectedly
    let msgList = Array.isArray(messages) ? [...messages] : [messages];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      console.log(
        `[MCP Client] chatWithOllamaJSON: attempt ${
          attempt + 1
        } calling chatWithOllama`,
        { msgList, options }
      );
      const resp = await this.chatWithOllama(msgList, options);
      console.log(`[MCP Client] chatWithOllamaJSON: response`, resp);
      let content =
        resp?.message?.content ??
        (typeof resp === "string" ? resp : JSON.stringify(resp));

      if (typeof content !== "string") content = String(content || "");
      content = content.replace(/^\uFEFF/, "").trim();

      // Try direct parse
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        // Attempt to extract JSON substring
        const match = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e) {
            parsed = null;
          }
        }
      }

      // If we have parsed JSON, validate presence of markdown field
      if (parsed && typeof parsed === "object") {
        const hasMarkdown =
          Object.prototype.hasOwnProperty.call(parsed, requiredMarkdownField) &&
          typeof parsed[requiredMarkdownField] === "string";
        if (hasMarkdown) {
          return parsed;
        }

        // If missing markdown, attempt to extract a human-facing part from content and set it
        if (parsed && attempt < maxRetries) {
          // Ask model to provide the required markdown field only
          msgList = [...messages, retryInstruction];
          continue;
        }

        // Final attempt: if parsed but no markdown, create a wrapper that preserves parsed data and set markdown to empty
        if (parsed) {
          parsed[requiredMarkdownField] = parsed[requiredMarkdownField] || "";
          return parsed;
        }
      }

      // No valid JSON after extraction and retries
      if (attempt < maxRetries) {
        msgList = [...messages, retryInstruction];
        continue;
      }

      const preview = content.slice(0, 1000);
      throw new Error(
        `Invalid JSON response from Ollama after ${
          attempt + 1
        } attempts: ${preview}`
      );
    }

    throw new Error("Unexpected error in chatWithOllamaJSON");
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
          try {
            this.emit("resourceLoaded", {
              client: clientName,
              resource: res.name,
            });
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (err) {
      console.debug(
        `[MCP Client] listResources not available for ${clientName}`
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
        keywords: ["stats", "count", "statistics", "สถิติ", "เปรียบเทียบ"],
      },
      {
        category: "webd",
        keywords: ["webd", "violation", "court", "เว็บไซต์ผิดกฎหมาย", "มีคำสั่งศาล"],
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

    // Extract English words (3+ characters)
    const englishWords = text.toLowerCase().match(/[a-z]{3,}/g) || [];
    const englishStopWords = [
      "tool",
      "function",
      "method",
      "the",
      "and",
      "for",
      "with",
      "from",
      "that",
      "this",
      "are",
      "was",
      "were",
    ];

    // Extract Thai words (2+ characters due to Thai word structure)
    const thaiWords = text.match(/[\u0E00-\u0E7F]{2,}/g) || [];
    const thaiStopWords = [
      "การ",
      "ของ",
      "ที่",
      "และ",
      "หรือ",
      "ใน",
      "จาก",
      "ไป",
      "มา",
      "แล้ว",
      "ได้",
      "เป็น",
      "คือ",
      "มี",
      "ให้",
    ];

    const filteredEnglishWords = englishWords.filter(
      (word) => !englishStopWords.includes(word)
    );

    const filteredThaiWords = thaiWords.filter(
      (word) => !thaiStopWords.includes(word)
    );

    const allWords = [...filteredEnglishWords, ...filteredThaiWords];

    return [...new Set(allWords)].slice(0, 20);
  }

  // Generate example usage for tools
  private generateExamples(name: string, description?: string): string[] {
    const examples: string[] = [];
    const key = `${name} ${description || ""}`.toLowerCase();

    const exampleMap: { pattern: RegExp; examples: string[] }[] = [
      {
        pattern: /greeting|สวัสดี|ทักทาย/,
        examples: ["สร้างข้อความทักทาย", "สวัสดีภาษาไทย", "ทักทายแบบไทย"],
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
          "ขณะนี้กี่โมง",
        ],
      },
      {
        pattern: /webd|ผิดกฎหมาย|คำสั่งศาล|violation|court|url/,
        examples: [
          "นับจำนวนเว็บไซต์ผิดกฎหมายในระบบ webd",
          "สถิติเว็บไซต์ผิดกฎหมายในระบบ webd",
          "เว็บไซต์ผิดกฎหมายมีกี่ url ในระบบ webd",
          "เว็บไซต์ผิดกฎหมายที่มีคำสั่งศาลในระบบ webd",
          "URL ที่มีคำสั่งศาลในระบบ webd",
          "สถิติโดเมนที่มีคำสั่งศาลในระบบ webd",
        ],
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

  // Add to conversation history
  private addToHistory(query: string, tools: string[]) {
    this.conversationHistory.push({
      query,
      tools,
      timestamp: Date.now(),
    });

    // Keep only recent history
    if (this.conversationHistory.length > this.maxHistorySize) {
      this.conversationHistory.shift();
    }
  }

  // Get conversation context
  private getConversationContext(): string {
    if (this.conversationHistory.length === 0) {
      return "";
    }

    const recentContext = this.conversationHistory.slice(-3);
    let contextStr = "\n**บริบทการสนทนาก่อนหน้า**:\n";

    recentContext.forEach((ctx, idx) => {
      const toolsStr = ctx.tools.length > 0 ? ctx.tools.join(", ") : "ไม่มี";
      contextStr += `${idx + 1}. "${ctx.query}" → ใช้ ${toolsStr}\n`;
    });

    return contextStr;
  }

  // Strategy 1: Pattern matching (fastest and most accurate)
  private async tryPatternMatching(userMessage: string): Promise<string[]> {
    const lowerMessage = userMessage.toLowerCase();
    const toolScores = new Map<string, number>();

    console.log(`[MCP Client] Trying pattern matching for: "${userMessage}"`);

    // Check each pattern
    for (const pattern of this.toolPatterns) {
      const matchCount = pattern.keywords.filter((keyword) =>
        lowerMessage.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > 0) {
        // Find matching tools
        const matchedTools = Array.from(this.tools.keys()).filter((key) =>
          pattern.toolPattern.test(key)
        );

        // Find matching resources
        const matchedResources = Array.from(this.resources.keys()).filter(
          (key) => pattern.toolPattern.test(key)
        );

        // Prefer resources for greeting-like queries
        const allMatches =
          pattern.category === "greeting" && matchedResources.length > 0
            ? matchedResources
            : [...matchedTools, ...matchedResources];

        // Calculate score based on priority and match count
        const priorityScore =
          pattern.priority === "high"
            ? 10
            : pattern.priority === "medium"
            ? 5
            : 2;
        const score = matchCount * priorityScore;

        allMatches.forEach((tool) => {
          const currentScore = toolScores.get(tool) || 0;
          toolScores.set(tool, currentScore + score);
        });
      }
    }

    // Sort by score and return top matches
    const sortedTools = Array.from(toolScores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= 5) // Minimum score threshold
      .map(([tool, score]) => {
        console.log(`[MCP Client] Pattern match: ${tool} (score: ${score})`);
        return tool;
      })
      .slice(0, 2); // Top 2 tools

    if (sortedTools.length > 0) {
      console.log(
        `[MCP Client] Pattern matching found: ${sortedTools.join(", ")}`
      );
    }

    return sortedTools;
  }

  // Strategy 2: Keyword similarity matching
  private async tryKeywordMatching(userMessage: string): Promise<string[]> {
    console.log(`[MCP Client] Trying keyword matching for: "${userMessage}"`);

    const userKeywords = this.extractKeywords(userMessage);
    const matches: Array<{ tool: string; score: number }> = [];

    // Check tools
    for (const [toolName, tool] of this.tools.entries()) {
      const toolKeywords = tool.keywords;
      const commonKeywords = userKeywords.filter((uk) =>
        toolKeywords.some(
          (tk) =>
            tk.toLowerCase().includes(uk.toLowerCase()) ||
            uk.toLowerCase().includes(tk.toLowerCase())
        )
      );

      if (commonKeywords.length > 0) {
        const score =
          commonKeywords.length /
          Math.max(userKeywords.length, toolKeywords.length);
        matches.push({ tool: toolName, score });
        console.log(
          `[MCP Client] Keyword match: ${toolName} (score: ${score.toFixed(
            2
          )}, keywords: ${commonKeywords.join(", ")})`
        );
      }
    }

    // Check resources
    for (const [resourceName, resource] of this.resources.entries()) {
      const resourceKeywords = this.extractKeywords(
        resourceName,
        resource.description
      );
      const commonKeywords = userKeywords.filter((uk) =>
        resourceKeywords.some(
          (rk) =>
            rk.toLowerCase().includes(uk.toLowerCase()) ||
            uk.toLowerCase().includes(rk.toLowerCase())
        )
      );

      if (commonKeywords.length > 0) {
        const score =
          commonKeywords.length /
          Math.max(userKeywords.length, resourceKeywords.length);
        matches.push({ tool: resourceName, score });
        console.log(
          `[MCP Client] Resource keyword match: ${resourceName} (score: ${score.toFixed(
            2
          )})`
        );
      }
    }

    const selected = matches
      .sort((a, b) => b.score - a.score)
      .filter((m) => m.score > 0.15) // Lowered threshold to improve matching for short/Thai queries
      .slice(0, 2)
      .map((m) => m.tool);

    if (selected.length > 0) {
      console.log(
        `[MCP Client] Keyword matching found: ${selected.join(", ")}`
      );
    }

    return selected;
  }

  // Strategy 3: AI-based selection using Ollama
  private async tryAISelection(userMessage: string): Promise<string[]> {
    console.log(`[MCP Client] Trying AI selection for: "${userMessage}"`);

    try {
      const toolDescriptions = getToolDescriptions(this.tools, this.resources);
      const contextStr = this.getConversationContext();

      const prompt = `คุณเป็น AI ผู้เชี่ยวชาญในการเลือก MCP tools ที่เหมาะสมที่สุด
${contextStr}

**คำขอจากผู้ใช้**: "${userMessage}"

**Tools และ Resources ที่มีทั้งหมด**:
${toolDescriptions}

**วิธีการเลือก**:
1. อ่านคำขอของผู้ใช้อย่างละเอียด
2. ดูว่า tool/resource ไหนตรงกับคำขอมากที่สุด
3. เลือกเฉพาะ tool/resource ที่จำเป็น (ไม่เกิน 2 รายการ)
4. ถ้าไม่แน่ใจ 100% ให้ตอบ "none"
5. สำหรับคำทักทาย ให้เลือก resource แทน tool ถ้ามี

**ตัวอย่างการเลือก**:
- "วันนี้วันที่เท่าไหร่" → innomcp-server:dateTimeTool
- "สวัสดี" → innomcp-server:greeting (resource)
- "จำนวน URL ผิดกฎหมายในระบบ webd" → เลิอก tool ที่มี prefix "webdTool_"
- "สบายดีไหม" → none (ไม่ต้องใช้ tool)
- "ขอบคุณ" → none

**คำตอบของคุณ** (เขียนเฉพาะชื่อ tool/resource หรือ "none", ไม่ต้องมีคำอธิบาย):`;

      console.log("[MCP Client] tryAISelection: calling chatWithOllama", {
        prompt,
      });
      const response = await this.chatWithOllama(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        {
          temperature: 0.1,
          num_predict: 100,
        }
      );
      console.log(
        "[MCP Client] tryAISelection: chatWithOllama response",
        response
      );

      const selectedTools = response.message?.content?.trim() || "";
      console.log(`[MCP Client] AI selected: ${selectedTools}`);
      if (selectedTools.toLowerCase() === "none" || selectedTools === "") {
        return [];
      }

      // Parse response into raw tokens (comma/newline separated)
      const rawCandidates = selectedTools
        .split(/\s*,\s*|\n/)
        .map((tool: string) => tool.trim())
        .filter((t: string) => t.length > 0);

      const resolved: string[] = [];

      for (const candidate of rawCandidates) {
        // direct key match (may be client-prefixed)
        if (this.tools.has(candidate) || this.resources.has(candidate)) {
          resolved.push(candidate);
          continue;
        }

        // try to resolve a bare tool/resource name to a full key
        const suffixMatchTool = Array.from(this.tools.keys()).find((k) => {
          const parts = k.split(":");
          return parts[parts.length - 1] === candidate;
        });

        const suffixMatchRes = Array.from(this.resources.keys()).find((k) => {
          const parts = k.split(":");
          return parts[parts.length - 1] === candidate;
        });

        if (suffixMatchTool) {
          resolved.push(suffixMatchTool);
          continue;
        }

        if (suffixMatchRes) {
          resolved.push(suffixMatchRes);
          continue;
        }

        // fallback fuzzy contains match
        const containsTool = Array.from(this.tools.keys()).find((k) =>
          k.includes(candidate)
        );
        const containsRes = Array.from(this.resources.keys()).find((k) =>
          k.includes(candidate)
        );

        if (containsTool) {
          resolved.push(containsTool);
          continue;
        }

        if (containsRes) {
          resolved.push(containsRes);
          continue;
        }

        console.warn(
          `[MCP Client] AI suggested unknown tool/resource: ${candidate}`
        );
      }

      return [...new Set(resolved)].slice(0, 2) as string[];
    } catch (error) {
      console.error("[MCP Client] AI selection error:", error);
      return [];
    }
  }

  // Validate tool selection
  private async validateToolSelection(
    userMessage: string,
    selectedTools: string[]
  ): Promise<string[]> {
    if (selectedTools.length === 0) return [];

    console.log(`[MCP Client] Validating tools: ${selectedTools.join(", ")}`);

    const validatedTools: string[] = [];

    for (const toolName of selectedTools) {
      const tool = this.tools.get(toolName);
      const resource = this.resources.get(toolName);

      if (!tool && !resource) continue;

      const description = tool ? tool.description : resource?.description || "";

      try {
        const validationPrompt = `คำถาม: "${userMessage}"
Tool/Resource: ${toolName}
คำอธิบาย: ${description}

Tool/Resource นี้เหมาะสมกับคำถามหรือไม่? 
ตอบเฉพาะ "yes" หรือ "no" เท่านั้น:`;

        console.log(
          "[MCP Client] validateToolSelection: calling chatWithOllama",
          { validationPrompt }
        );
        const response = await this.chatWithOllama(
          [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: validationPrompt },
          ],
          {
            temperature: 0,
            num_predict: 10,
          }
        );
        console.log(
          "[MCP Client] validateToolSelection: chatWithOllama response",
          response
        );

        const answer = response.message?.content?.trim().toLowerCase() || "";

        if (answer.includes("yes")) {
          validatedTools.push(toolName);
          console.log(`[MCP Client] ✅ Validated: ${toolName}`);
        } else {
          console.log(`[MCP Client] ❌ Rejected: ${toolName}`);
        }
      } catch (error) {
        console.warn(`[MCP Client] Validation error for ${toolName}:`, error);
        // In case of error, include the tool (fail-safe)
        validatedTools.push(toolName);
      }
    }

    return validatedTools;
  }

  // Main tool selection with multi-strategy approach
  async selectTools(userMessage: string): Promise<string[]> {
    try {
      // Check cache first
      const cached = this.getCachedSelection(userMessage);
      if (cached) {
        return cached;
      }

      console.log(`\n[MCP Client] ===== Tool Selection Start =====`);
      console.log(`[MCP Client] Query: "${userMessage}"`);

      // Strategy 1: Pattern matching (fastest and most accurate)
      const patternMatched = await this.tryPatternMatching(userMessage);
      if (patternMatched.length > 0) {
        console.log(
          `[MCP Client] ✅ Pattern matching succeeded: ${patternMatched.join(
            ", "
          )}`
        );

        // Optional: Validate high-confidence matches
        // const validated = await this.validateToolSelection(userMessage, patternMatched);
        // if (validated.length > 0) {
        //   this.cacheSelection(userMessage, validated);
        //   this.addToHistory(userMessage, validated);
        //   return validated;
        // }

        this.cacheSelection(userMessage, patternMatched);
        this.addToHistory(userMessage, patternMatched);
        console.log(`[MCP Client] ===== Tool Selection End =====\n`);
        return patternMatched;
      }

      console.log(
        `[MCP Client] Pattern matching found nothing, trying keyword matching...`
      );

      // Strategy 2: Keyword similarity (medium speed)
      const keywordMatched = await this.tryKeywordMatching(userMessage);
      if (keywordMatched.length > 0) {
        console.log(
          `[MCP Client] ✅ Keyword matching succeeded: ${keywordMatched.join(
            ", "
          )}`
        );

        this.cacheSelection(userMessage, keywordMatched);
        this.addToHistory(userMessage, keywordMatched);
        console.log(`[MCP Client] ===== Tool Selection End =====\n`);
        return keywordMatched;
      }

      console.log(
        `[MCP Client] Keyword matching found nothing, trying AI selection...`
      );

      // Strategy 3: AI-based selection (slowest but most flexible)
      const aiMatched = await this.tryAISelection(userMessage);
      if (aiMatched.length > 0) {
        console.log(
          `[MCP Client] ✅ AI selection succeeded: ${aiMatched.join(", ")}`
        );

        // Validate AI selections (optional but recommended)
        const validated = await this.validateToolSelection(
          userMessage,
          aiMatched
        );

        this.cacheSelection(userMessage, validated);
        this.addToHistory(userMessage, validated);
        console.log(`[MCP Client] ===== Tool Selection End =====\n`);
        return validated;
      }

      console.log(`[MCP Client] ❌ No tools selected`);
      console.log(`[MCP Client] ===== Tool Selection End =====\n`);

      this.cacheSelection(userMessage, []);
      this.addToHistory(userMessage, []);
      this.cleanCache(); // Clean expired cache

      return [];
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

  // Extract the first balanced JSON object or array from arbitrary text
  private extractJsonFromText(text: string): string | null {
    if (!text || typeof text !== "string") return null;

    // Find the first opening brace or bracket
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

    return null; // no balanced JSON found
  }

  // Parse validation errors JSON array from an arbitrary error message text
  private parseValidationErrorsFromMessage(text: string): any[] | null {
    if (!text || typeof text !== "string") return null;

    // Try to locate a JSON array/object inside the message
    const extracted = this.extractJsonFromText(text);
    if (!extracted) return null;

    try {
      const parsed = JSON.parse(extracted);
      // If it's an array of validation errors, return it
      if (Array.isArray(parsed)) return parsed;
      // If an object with `errors` or similar, try to return that
      if (parsed && parsed.errors && Array.isArray(parsed.errors))
        return parsed.errors;
      return [parsed];
    } catch (err) {
      return null;
    }
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
          const resource = this.resources.get(toolName);

          if (!client) {
            console.warn(`[MCP Client] Client not found for: ${toolName}`);
            break;
          }

          // For resources, use resource.inputSchema if available
          const args = resource
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

          // Validate arguments using either tool schema or resource schema
          const schema = tool ? tool.inputSchema : resource?.inputSchema;
          if (schema) {
            const validation = this.validateArguments(args, schema);
            if (!validation.valid) {
              console.warn(
                `[MCP Client] Invalid arguments for ${toolName}:`,
                validation.errors
              );

              // Modify arguments to include required properties
              for (const key of schema.required || []) {
                if (!(key in args)) {
                  args[key] = schema.properties?.[key]?.default || "";
                }
              }
            }
          }

          console.log(
            `[MCP Client] Executing tool: ${toolName} with args:`,
            JSON.stringify(args)
          );

          let result: any;

          if (resource) {
            // Try several possible resource invocation methods depending on SDK
            try {
              if (typeof (client as any).callResource === "function") {
                result = await (client as any).callResource({
                  name: resource.name,
                  arguments: args,
                });
              } else if (typeof (client as any).getResource === "function") {
                result = await (client as any).getResource(resource.name, args);
              } else if (
                typeof (client as any).requestResource === "function"
              ) {
                result = await (client as any).requestResource(
                  resource.name,
                  args
                );
              } else {
                // Last resort: try calling as a tool name
                result = await client.callTool({
                  name: resource.name,
                  arguments: args,
                });
              }
            } catch (err) {
              throw err;
            }
          } else {
            result = await client.callTool({
              name: actualToolName,
              arguments: args,
            });
          }

          console.log(
            "[MCP Client] Server response JSON:",
            JSON.stringify(result, null, 2)
          );

          if (result.isError) {
            const errText =
              result.content && result.content.length > 0
                ? result.content[0].text
                : "Tool execution error";

            // Try to parse validation errors embedded in the message
            const validationErrors =
              this.parseValidationErrorsFromMessage(errText);

            results.push({
              toolName,
              error: errText,
              raw: result,
              validationErrors: validationErrors || undefined,
              success: false,
            });
          } else {
            // Try to normalize result.content: if the server returned text that contains JSON,
            // extract and parse it so downstream code gets structured data when possible.
            let payload: any = result.content;

            try {
              if (Array.isArray(result.content) && result.content.length > 0) {
                const first = result.content[0] as any;
                if (first && typeof first.text === "string") {
                  const extracted = this.extractJsonFromText(first.text);
                  if (extracted) {
                    try {
                      payload = JSON.parse(extracted);
                    } catch (e) {
                      payload = result.content; // keep original
                    }
                  } else {
                    payload = result.content;
                  }
                } else {
                  payload = result.content;
                }
              }
            } catch (e) {
              payload = result.content;
            }

            results.push({
              toolName,
              result: payload,
              success: true,
            });
          }

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

JSON:`;

      console.log(
        "[MCP Client] generateToolArguments: calling chatWithOllama",
        { prompt }
      );
      const response = await this.chatWithOllama(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        {
          temperature: 0.1,
          num_predict: 200,
        }
      );
      console.log(
        "[MCP Client] generateToolArguments: chatWithOllama response",
        response
      );

      let jsonStr = response.message?.content?.trim() || "";

      // Clean up response
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      // Try to extract a balanced JSON object/array from the model output
      const extracted = this.extractJsonFromText(jsonStr);
      if (extracted) {
        jsonStr = extracted;
      } else {
        // Fallback to regex match for the first object-like shape
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      console.log(
        `[MCP Client] Generated JSON string for ${tool.name}:`,
        jsonStr
      );

      try {
        const parsed = JSON.parse(jsonStr);

        // If the model returned a nested `data` object (common pattern), promote its fields
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.data &&
          typeof parsed.data === "object"
        ) {
          for (const prop of Object.keys(parsed.data)) {
            // Prefer non-empty nested values over empty top-level values
            if (!(prop in parsed) || parsed[prop] === "") {
              parsed[prop] = parsed.data[prop];
            }
          }
        }

        // Ensure required properties are present (use promoted values or defaults)
        for (const key of required) {
          if (!(key in parsed) || parsed[key] === "") {
            const nested = parsed.data?.[key];
            if (nested !== undefined && nested !== "") {
              parsed[key] = nested;
            } else {
              parsed[key] = properties[key]?.default || "";
            }
          }
        }

        console.log(`[MCP Client] Generated args for ${tool.name}:`, parsed);
        return parsed;
      } catch (parseError) {
        console.warn(
          `[MCP Client] Failed to parse JSON, using default args. parseError: ${String(
            parseError
          )}; snippet: ${jsonStr.slice(0, 200)}`
        );

        // Generate default arguments based on schema
        const defaultArgs: any = {};
        for (const key of required) {
          defaultArgs[key] = properties[key]?.default || "";
        }

        return defaultArgs;
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
        context += `✅ ${result.toolName}:\n${resultStr}\n\n`;
      }
    }

    context += `\nคำแนะนำ: ใช้ข้อมูลจาก tools ข้างต้นตอบคำถามอย่างชัดเจนและเป็นธรรมชาติ`;

    return context;
  }

  /**
   * Generate an HTML response from Ollama by prepending the AI_HTML_PROMPT.
   * - `userInstruction` is the main instruction for the model (e.g., "สร้าง card แชท").
   * - `extraContext` can include tool results or other contextual text.
   * - `options` are passed to `chatWithOllama` (temperature, num_predict, etc.).
   */
  async generateHtmlResponse(
    userInstruction: string,
    extraContext?: string,
    options?: any
  ): Promise<string> {
    try {
      const contextPart =
        extraContext && extraContext.trim().length > 0
          ? `${extraContext}\n\n`
          : "";

      const fullPrompt = `${contextPart}${userInstruction}`;

      console.log("[MCP Client] generateHtmlResponse: calling chatWithOllama", {
        fullPrompt,
        options,
      });
      const response = await this.chatWithOllama(
        [{ role: "user", content: fullPrompt }],
        Object.assign({ temperature: 0.2, num_predict: 400 }, options || {})
      );
      console.log(
        "[MCP Client] generateHtmlResponse: chatWithOllama response",
        response
      );

      const content = response?.message?.content || "";
      return String(content).trim();
    } catch (err) {
      console.error("[MCP Client] generateHtmlResponse error:", err);
      return "";
    }
  }

  // Get available tools info
  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  // Get available resources info
  getAvailableResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  // Get clients info
  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  // Get conversation history
  getConversationHistory(): ConversationContext[] {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
    console.log("[MCP Client] Conversation history cleared");
  }

  // Clear all caches
  clearCache() {
    this.selectionCache.clear();
    console.log("[MCP Client] Selection cache cleared");
  }

  // Clear everything
  clearAll() {
    this.clearCache();
    this.clearHistory();
    console.log("[MCP Client] All caches and history cleared");
  }

  // Get statistics
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
}

// Helper function to generate tool descriptions from Maps
function getToolDescriptions(
  tools: Map<string, MCPTool>,
  resources?: Map<string, MCPResource>
): string {
  let descriptions = "**Tools**:\n";

  descriptions += Array.from(tools.values())
    .map((tool) => {
      return `- ${tool.name}
  คำอธิบาย: ${tool.description}
  หมวดหมู่: ${tool.category}
  ตัวอย่าง: ${tool.examples.slice(0, 3).join(", ")}`;
    })
    .join("\n\n");

  if (resources && resources.size > 0) {
    descriptions += "\n\n**Resources**:\n";
    descriptions += Array.from(resources.values())
      .map((resource) => {
        return `- ${resource.name}
  คำอธิบาย: ${resource.description || "ไม่มีคำอธิบาย"}
  ประเภท: Resource`;
      })
      .join("\n\n");
  }

  return descriptions;
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
      console.log("[MCP Client] Statistics:", mcpClient.getStatistics());
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

// Function to convert Markdown to HTML using remark and rehype
export function markdownToHtml(markdown: string): string {
  try {
    // Pipeline: markdown -> mdast -> hast -> sanitized HTML
    // - `remarkRehype` converts mdast to hast. We explicitly disable parsing
    //   embedded/raw HTML via `allowDangerousHtml: false`.
    // - `rehypeSanitize` runs a strict sanitizer (defense-in-depth).
    // - `rehypeStringify` serializes hast to an HTML string. We explicitly
    //   set `allowDangerousHtml: false` here too to ensure raw HTML nodes are
    //   not emitted even if they somehow appear.
    const processed = unified()
      .use(remarkParse as any)
      .use(remarkRehype as any, { allowDangerousHtml: false } as any)
      .use(rehypeSanitize as any)
      .use(rehypeStringify as any, { allowDangerousHtml: false } as any)
      .processSync(markdown as any);

    return String(processed);
  } catch (error) {
    console.error("Error converting Markdown to HTML:", error);
    return markdown; // Return original markdown if conversion fails
  }
}

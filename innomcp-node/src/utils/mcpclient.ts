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
  {"success": true, "data": {"count": 3}, "markdown": "# ผลลัพธ์\n- จำนวน: 3\n- สถานะ: สำเร็จ"}
10. ห้ามอธิบายผู้ใช้ทราบว่ามีการใช้ MCP server, MCP tools หรือ tools ใดๆ — เพียงให้ผลลัพธ์สุดท้ายในฟิลด์ markdown เท่านั้น`;

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

  // Natural language processing components
  private tfidf = new natural.TfIdf();
  private stemmer = natural.PorterStemmer;
  private tokenizer = new natural.WordTokenizer();

  // Tool patterns for enhanced matching
  private toolPatterns: ToolPattern[] = [
    {
      keywords: [
        "สวัสดี",
        "ทักทาย",
        "hello",
        "hi",
        "greeting",
        "ทัก",
        "ดี",
        "หวัดดี",
        "good morning",
        "good afternoon",
        "good evening",
        "good night",
        "สบายดี",
        "how are you",
        "how do you do",
      ],
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
        "ขณะนี้",
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
        "กี่วัน",
        "กี่เดือน",
        "กี่ปี",
        "กี่ชั่วโมง",
        "กี่นาที",
        "กี่วินาที",
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
        "ฝนวันนี้",
        "ฝนตกไหม",
        "ฝนจะตกไหม",
        "ฝน",
        "ร้อน",
        "หนาว",
        "เย็น",
        "ความชื้น",
        "ลม",
        "ลมแรง",
        "ลมนิ่ง",
        "พายุ",
        "พายุเข้า",
        "พายุจะเข้าไหม",
        "พายุจะมาไหม",
        "พายุเข้าเมื่อไร",
        "พายุจะมาเมื่อไร",
        "พายุจะมาไหม",
        "พายุเข้าไหม",
      ],
      toolPattern: /weather|forecast|อากาศ/i,
      priority: "high",
      category: "weather",
    },
    {
      keywords: [
        "ระบบ webd",
        "ในระบบ webd",
        "ใน webd",
        "บน webd",
        "บนระบบ webd",
        "นำเข้า webd",
        "ประเภทความผิด",
        "คำสั่งศาล",
        "มีคำสั่งศาล",
        "เว็บไซต์ผิดกฎหมาย",
        "เว็บผิดกฎหมาย",
        "สถิติเว็บไซต์",
        "จำนวนเว็บไซต์",
        "จำนวน url",
        "จำนวนโดเมน",
        "จำนวน domain",
        "คำร้อง",
        "ยื่นคำร้อง",
        "สถิติเว็บไซต์ผิดกฎหมาย",
        "url",
        "โดเมน",
      ],
      toolPattern: /^webdTool_/i,
      priority: "high",
      category: "webd",
    },

    {
      keywords: [
        "ระบบ webd",
        "ในระบบ webd",
        "ใน webd",
        "บน webd",
        "บนระบบ webd",
        "นำเข้า webd",
        "ประเภทความผิด",
        "เว็บไซต์ผิดกฎหมาย",
        "เว็บผิดกฎหมาย",
        "สถิติเว็บไซต์",
        "จำนวนเว็บไซต์",
        "จำนวน url",
        "จำนวนโดเมน",
        "จำนวน domain",
        "สถิติเว็บไซต์ผิดกฎหมาย",
        "url",
        "โดเมน",
        "แพลตฟอร์ม",
        "ตามแพลตฟอร์ม",
        "แยกตามแพลตฟอร์ม",
        "กลุ่มเว็บไซต์",
        "กลุ่มแพลตฟอร์ม",
        "แพลตฟอร์มที่ระบุ",
        "platform",
        "platforms",
      ],
      toolPattern: /^webdTool_*platforms*/i,
      priority: "high",
      category: "webd",
    },

    {
      keywords: [
        "ระบบ webd",
        "ในระบบ webd",
        "ใน webd",
        "บน webd",
        "บนระบบ webd",
        "นำเข้า webd",
        "ประเภทความผิด",
        "เว็บไซต์ผิดกฎหมาย",
        "เว็บผิดกฎหมาย",
        "สถิติเว็บไซต์",
        "จำนวนเว็บไซต์",
        "จำนวน url",
        "จำนวนโดเมน",
        "จำนวน domain",
        "สถิติเว็บไซต์ผิดกฎหมาย",
        "url",
        "โดเมน",
        "ประเทศ",
        "ตามประเทศ",
        "แยกตามประเทศ",
        "ประเทศที่จดทะเบียน",
        "ประเทศโดเมน",
        "ประเทศของโดเมน",
        "ที่ตั้งโดเมน",
        "ที่ตั้งของโดเมน",
        "ที่ตั้งเว็บไซต์",
        "ที่ตั้งของเว็บไซต์",
      ],
      toolPattern: /^webdTool_*country*/i,
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
    console.log("===== Starting chatWithOllama =====");

    try {
      console.log(
        `[MCP Client] Calling ollama.chat (sync) with model: ${this.ollamaModel} ✨`
      );
      const response = await this.ollama.chat({
        model: this.ollamaModel,
        messages,
        stream: false,
        options: options || {},
      });

      console.log("[MCP Client] ollama.chat (sync) returned ✨");

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
      console.log(
        "[MCP Client] Calling ollama.chat (stream) with model: " +
          this.ollamaModel +
          " ✨"
      );
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

      console.log("[MCP Client] ollama.chat (stream) result ✨");
      return { message: { content } };
    } catch (err) {
      console.error("[MCP Client] Ollama stream fallback failed:", err);
      throw err;
    }
  }

  // Initialize multiple MCP clients
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
    console.log("===== Starting loadToolsFromClient =====");
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
        keywords: [
          "webd",
          "violation",
          "court",
          "เว็บไซต์ผิดกฎหมาย",
          "มีคำสั่งศาล",
          "นับ",
          "สถิติ",
          "url",
          "โดเมน",
        ],
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

  // Enhanced keyword extraction supporting Thai language with Natural
  private extractKeywords(name: string, description?: string): string[] {
    const text = `${name} ${description || ""}`;

    // Use Natural tokenizer for better tokenization
    const tokens = this.tokenizer.tokenize(text.toLowerCase()) || [];

    const englishWords = tokens.filter((token) => /^[a-z]{3,}$/.test(token));
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

    const thaiWords = tokens.filter((token) =>
      /[\u0E00-\u0E7F]{2,}/.test(token)
    );
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

    // Stem English words using Natural
    const stemmedEnglish = filteredEnglishWords.map((word) =>
      this.stemmer.stem(word)
    );

    const allWords = [...stemmedEnglish, ...filteredThaiWords];

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
        pattern: /webd|ผิดกฎหมาย|คำสั่งศาล|violation|court|url|นับ|สถิติ|โดเมน/,
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

  // ============================================
  // NEW: ตรวจสอบว่าเป็นคำทักทายหรือไม่
  // ============================================
  private isGreetingQuery(query: string): boolean {
    const greetingPatterns = [
      /^(สวัสดี|หวัดดี|ดี|hi|hello|hey|สบายดี)/i,
      /^(good\s*(morning|afternoon|evening|night))/i,
    ];

    return greetingPatterns.some((pattern) => pattern.test(query.trim()));
  }

  // ============================================
  // NEW: ตรวจสอบว่าเป็น webdTool หรือไม่
  // ============================================
  private isWebdTool(toolName: string): boolean {
    if (!toolName || typeof toolName !== "string") return false;
    const n = toolName.toLowerCase();
    return n.includes("webdtool");
  }

  // ============================================
  // ENHANCED: คำนวณคะแนนความเกี่ยวข้องของ tool ด้วย fuse.js + natural TF-IDF
  // ============================================
  private async scoreToolRelevance(
    toolName: string,
    userMessage: string
  ): Promise<number> {
    console.log(`[MCP Client] Scoring ${toolName} for "${userMessage}"`);

    const tool = this.tools.get(toolName);
    const resource = this.resources.get(toolName);

    if (!tool && !resource) return 0;

    const description = tool?.description || resource?.description || "";
    const keywords =
      tool?.keywords || this.extractKeywords(toolName, description);
    const searchText = `${toolName} ${description} ${keywords.join(
      " "
    )}`.toLowerCase();

    // ===== NATURAL TF-IDF SCORING =====
    let tfidfScore = 0;
    try {
      // Create a temporary TF-IDF instance for this tool
      const tempTfidf = new natural.TfIdf();
      tempTfidf.addDocument(searchText);

      // Tokenize user message
      const userTokens =
        this.tokenizer.tokenize(userMessage.toLowerCase()) || [];

      // Calculate TF-IDF score for user tokens against this tool's document
      userTokens.forEach((token) => {
        tempTfidf.tfidfs(token, (i, measure) => {
          tfidfScore += measure;
        });
      });

      // Normalize TF-IDF score (0-50 range)
      tfidfScore = Math.min(tfidfScore * 10, 50);
      console.log(
        `[MCP Client] TF-IDF score for ${toolName}: ${tfidfScore.toFixed(2)}`
      );
    } catch (error) {
      console.warn(`[MCP Client] TF-IDF scoring error for ${toolName}:`, error);
      tfidfScore = 0;
    }

    // ===== FUSE.JS FUZZY SCORING =====
    const fuse = new Fuse([searchText], {
      includeScore: true,
      threshold: 0.4,
      keys: [""],
      ignoreLocation: true,
      findAllMatches: true,
    });

    const results = fuse.search(userMessage.toLowerCase());
    let fuseScore = 0;

    if (results.length > 0) {
      const bestScore = results[0].score || 1;
      fuseScore = Math.max(0, (1 - bestScore) * 100);
      console.log(
        `[MCP Client] Fuse.js score for ${toolName}: ${fuseScore.toFixed(
          2
        )} (raw: ${bestScore.toFixed(2)})`
      );
    }

    // ===== CATEGORY BONUS =====
    let categoryScore = 0;
    if (tool?.category) {
      const categoryKeywords: Record<string, string[]> = {
        datetime: ["วันนี้", "เวลา", "วันที่", "time", "date"],
        greeting: ["สวัสดี", "ทักทาย", "hello", "hi"],
        webd: ["webd", "ผิดกฎหมาย", "คำสั่งศาล", "url"],
        weather: ["อากาศ", "weather", "ฝน"],
      };

      const categoryKeys = categoryKeywords[tool.category] || [];
      const categoryMatches = categoryKeys.filter((k) =>
        userMessage.toLowerCase().includes(k.toLowerCase())
      );
      categoryScore = categoryMatches.length * 5;
      console.log(
        `[MCP Client] Category matches for ${toolName}: ${categoryMatches.join(
          ", "
        )} (+${categoryScore})`
      );
    }

    // ===== PATTERN BONUS =====
    let patternScore = 0;
    for (const pattern of this.toolPatterns) {
      if (pattern.toolPattern.test(toolName)) {
        const patternMatches = pattern.keywords.filter((k) =>
          userMessage.toLowerCase().includes(k.toLowerCase())
        );
        if (patternMatches.length > 0) {
          patternScore +=
            pattern.priority === "high"
              ? 10
              : pattern.priority === "medium"
              ? 5
              : 2;
          console.log(
            `[MCP Client] Pattern matches for ${toolName}: ${patternMatches.join(
              ", "
            )} (+${
              pattern.priority === "high"
                ? 10
                : pattern.priority === "medium"
                ? 5
                : 2
            })`
          );
        }
      }
    }

    // ===== WEBD BONUS =====
    let webdBonus = 0;
    if (
      userMessage.toLowerCase().includes("webd") &&
      toolName.toLowerCase().includes("webd")
    ) {
      const offset =
        Array.from(toolName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 5;
      webdBonus = 10 + offset;
      console.log(`[MCP Client] Webd bonus for ${toolName}: +${webdBonus}`);
    }

    // ===== COMBINED SCORE =====
    const totalScore =
      tfidfScore + fuseScore + categoryScore + patternScore + webdBonus;
    console.log(
      `[MCP Client] Total score for ${toolName}: TF-IDF(${tfidfScore.toFixed(
        1
      )}) + Fuse(${fuseScore.toFixed(
        1
      )}) + Category(${categoryScore}) + Pattern(${patternScore}) + Webd(${webdBonus}) = ${totalScore.toFixed(
        2
      )}`
    );

    return totalScore;
  }

  // ============================================
  // NEW: กรอง tools ที่ซ้ำและจัดอันดับ
  // ============================================
  private async deduplicateAndRankTools(
    candidates: string[],
    userMessage: string
  ): Promise<string[]> {
    if (candidates.length === 0) return [];

    // ลบ duplicates
    const uniqueCandidates = [...new Set(candidates)];

    // คำนวณคะแนนความเกี่ยวข้อง
    const scoredTools = await Promise.all(
      uniqueCandidates.map(async (toolName) => ({
        toolName,
        score: await this.scoreToolRelevance(toolName, userMessage),
      }))
    );

    // เรียงตามคะแนนสูงสุด
    const sorted = scoredTools
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log("[MCP Client] Tool relevance scores:", sorted);

    // กรณีพิเศษ: ถ้ามี greeting resource ให้เอาแค่ตัวนั้น
    const greetingResource = sorted.find(
      (t) => t.toolName.includes("greeting") && this.resources.has(t.toolName)
    );
    if (greetingResource && this.isGreetingQuery(userMessage)) {
      console.log(
        "[MCP Client] Greeting detected, using only greeting resource"
      );
      return [greetingResource.toolName];
    }

    // เลือกแค่ top 1-2 tools ที่มีคะแนนสูงสุด
    const topScore = sorted[0]?.score || 0;
    const selected = sorted
      .filter(
        (t) => t.score >= topScore * 0.7 // เลือกเฉพาะที่คะแนนใกล้เคียงกับอันดับ 1
      )
      .slice(0, 10); // จำกัดไม่เกิน 10 tools

    return selected.map((t) => t.toolName);
  }

  // ============================================
  // UPDATED: Strategy 1 - Pattern matching ด้วย fuse.js
  // ============================================
  private async tryPatternMatching(userMessage: string): Promise<string[]> {
    console.log("===== Starting tryPatternMatching =====");
    const lowerMessage = userMessage.toLowerCase();
    const toolScores = new Map<string, number>();

    console.log(`[MCP Client] Trying pattern matching for: "${userMessage}"`);

    // เช็คว่าเป็น greeting หรือไม่
    if (this.isGreetingQuery(userMessage)) {
      const greetingResources = Array.from(this.resources.keys()).filter(
        (key) => key.includes("greeting")
      );
      if (greetingResources.length > 0) {
        console.log(
          `[MCP Client] Greeting detected, returning: ${greetingResources[0]}`
        );
        return [greetingResources[0]];
      }
    }

    // ใช้ Fuse เพียงอย่างเดียวในการหา pattern ที่ใกล้เคียงกับข้อความผู้ใช้
    const patternData = this.toolPatterns.map((p) => ({
      category: p.category,
      keywords: p.keywords.join(" "),
      priority: p.priority,
      pattern: p,
    }));

    const patternFuse = makeFuse(patternData as any, {
      keys: ["keywords", "category"],
      threshold: 0.35,
      distance: 100,
      includeScore: true,
    });

    const patternResults = runSearch(patternFuse, lowerMessage) as any[];

    // สำหรับ pattern ที่ match ให้แมปกลับเป็น tools/resources ตาม regex pattern.original
    for (const pr of patternResults) {
      const patternObj: any = pr.item || pr;
      const origPattern: ToolPattern = patternObj.pattern;
      const priorityScore =
        origPattern.priority === "high"
          ? 15
          : origPattern.priority === "medium"
          ? 8
          : 3;

      const matchedTools = Array.from(this.tools.keys()).filter((key) =>
        origPattern.toolPattern.test(key)
      );
      const matchedResources = Array.from(this.resources.keys()).filter((key) =>
        origPattern.toolPattern.test(key)
      );

      const allMatches = [...matchedTools, ...matchedResources];
      const score = (1 - (pr.score ?? 0)) * 100 * (priorityScore / 10);

      allMatches.forEach((tool) => {
        const currentScore = toolScores.get(tool) || 0;
        toolScores.set(tool, currentScore + score);
      });
      console.log(
        `[MCP Client] Pattern "${
          origPattern.category
        }" matched tools: ${allMatches.join(", ")}, score: ${score.toFixed(1)}`
      );
    }

    // จัดเรียงและกรอง
    const candidates = Array.from(toolScores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= 10)
      .map(([tool]) => tool);

    // ใช้ deduplicate และ ranking
    return await this.deduplicateAndRankTools(candidates, userMessage);
  }

  // ============================================
  // UPDATED: Strategy 2 - Keyword matching ด้วย fuse.js
  // ============================================
  private async tryKeywordMatching(userMessage: string): Promise<string[]> {
    console.log("===== Starting tryKeywordMatching =====");
    console.log(`[MCP Client] Trying keyword matching for: "${userMessage}"`);

    // สร้าง data สำหรับ Fuse จาก tools และ resources แล้วให้ Fuse จัดการ matching ทั้งหมด
    const toolData = Array.from(this.tools.entries()).map(
      ([toolName, tool]) => ({
        id: toolName,
        searchText: `${toolName} ${tool.description} ${tool.keywords.join(
          " "
        )} ${tool.category}`.toLowerCase(),
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
      includeScore: true,
      ignoreLocation: true,
      findAllMatches: true,
    });

    const results = runSearch(dataFuse, userMessage.toLowerCase()) as any[];

    const matches = results
      .map((r) => ({
        id: r.item.id,
        score: Math.max(0, (1 - (r.score ?? 1)) * 100),
      }))
      .filter((m) => m.score >= 10)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.id);

    return await this.deduplicateAndRankTools(matches, userMessage);
  }

  // ============================================
  // UPDATED: Strategy 3 - AI selection โดยตรง ไม่ใช้ fuse.js candidate
  // ============================================
  private async tryAISelection(userMessage: string): Promise<string[]> {
    console.log("===== Starting tryAISelection =====");
    console.log(
      `[MCP Client] Trying AI selection directly without fuse.js candidates for: "${userMessage}" ✨`
    );

    try {
      // สร้างรายการเครื่องมือทั้งหมดโดยไม่ใช้ fuse.js
      const allTools = Array.from(this.tools.keys());
      const allResources = Array.from(this.resources.keys());
      const allItems = [...allTools, ...allResources];

      // เลือกเครื่องมือทั้งหมด แต่จำกัดจำนวนเพื่อความปลอดภัย
      const maxTools = 50;
      const selectedItems = allItems.slice(0, maxTools);

      console.log(
        `[MCP Client] Sending ${selectedItems.length} tools directly to AI (total available: ${allItems.length})`
      );

      // สร้าง descriptions สำหรับ selectedItems เท่านั้น
      const selectedTools = new Map<string, MCPTool>();
      const selectedResources = new Map<string, MCPResource>();

      for (const itemName of selectedItems) {
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

      const prompt = `เลือก tool ที่เหมาะสมที่สุดสำหรับคำถามนี้

คำถาม: "${userMessage}"

${toolDescriptions}

กฎการเลือก:
1. เลือก tool ที่เกี่ยวข้องมากที่สุด (1 ตัว)
2. ถ้าไม่มี tool ที่เหมาะสมเลย ให้ตอบ "none"
3. เลือกจากรายการที่ให้มาเท่านั้น

ตอบเฉพาะชื่อ tool หรือ "none":`;

      console.log("[MCP Client] tryAISelection: calling chatWithOllama ✨");
      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 50 }
      );
      console.log("[MCP Client] tryAISelection: response received ✨");

      const rawText = String(response.message?.content || "").trim();
      console.log(`[MCP Client] AI raw selection: ${rawText}`);

      // Parse AI response
      let selectedItem = rawText.trim();
      selectedItem = selectedItem
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/\s*```/g, "")
        .split("\n")[0]
        .trim();

      if (selectedItem.toLowerCase() === "none" || selectedItem === "") {
        console.log("[MCP Client] AI selected none");
        return [];
      }

      // หา item ที่ AI เลือก
      const matched = selectedItems.find(
        (item) =>
          item === selectedItem ||
          item.endsWith(`:${selectedItem}`) ||
          item.includes(selectedItem)
      );

      if (matched) {
        console.log(`[MCP Client] ✅ AI selected directly: ${matched} ✨`);
        return [matched];
      }

      console.log(
        "[MCP Client] ⚠️ AI selected unknown item, no fallback available"
      );
      return [];
    } catch (error) {
      console.error("[MCP Client] AI selection error:", error);
      return [];
    }
  }

  // ============================================
  // NEW: Ollama Final Decision Making
  // ============================================
  private async makeFinalDecisionWithOllama(
    userMessage: string,
    candidates: Array<{ toolName: string; score: number }>
  ): Promise<string[]> {
    console.log("===== Starting makeFinalDecisionWithOllama =====");

    if (candidates.length === 0) return [];
    if (candidates.length === 1) return [candidates[0].toolName];

    try {
      // Prepare tool descriptions for Ollama
      const toolDescriptions = candidates
        .map(({ toolName, score }) => {
          const tool = this.tools.get(toolName);
          const resource = this.resources.get(toolName);

          const description =
            tool?.description || resource?.description || "ไม่มีคำอธิบาย";
          const category = tool?.category || "ไม่ระบุหมวดหมู่";

          return `${toolName}:
- คะแนน: ${score.toFixed(1)}
- หมวดหมู่: ${category}
- คำอธิบาย: ${description}
- ตัวอย่าง: ${tool?.examples?.slice(0, 2).join(", ") || "ไม่มีตัวอย่าง"}`;
        })
        .join("\n\n");

      const prompt = `วิเคราะห์คำถามและเลือกเครื่องมือที่เหมาะสมที่สุด

คำถาม: "${userMessage}"

เครื่องมือที่มีคะแนนสูงสุด:
${toolDescriptions}

กฎการตัดสินใจ:
1. เลือกเครื่องมือที่ตรงกับความต้องการมากที่สุด
2. พิจารณาคะแนนและความเกี่ยวข้อง
3. เลือกได้มากสุด 2 เครื่องมือ
4. ถ้าไม่มีเครื่องมือที่เหมาะสมเลย ให้ตอบ "none"

ตอบเฉพาะชื่อเครื่องมือที่เลือก (คั่นด้วย comma) หรือ "none":
ตัวอย่าง: tool1,tool2 หรือ tool1 หรือ none`;

      console.log(
        "[MCP Client] makeFinalDecisionWithOllama: calling chatWithOllama ✨"
      );
      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 100 }
      );
      console.log(
        "[MCP Client] makeFinalDecisionWithOllama: response received ✨"
      );

      const rawText = String(response.message?.content || "").trim();
      console.log(`[MCP Client] Ollama final decision: ${rawText}  ✨`);

      if (rawText.toLowerCase().includes("none")) {
        console.log("[MCP Client] Ollama decided no tools needed  ✨");
        return [];
      }

      // Parse selected tools
      const selectedTools = rawText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => {
          // Find the actual tool name from candidates
          const candidate = candidates.find(
            (c) =>
              c.toolName === t ||
              c.toolName.endsWith(`:${t}`) ||
              c.toolName.includes(t)
          );
          return candidate?.toolName;
        })
        .filter((t) => t) as string[];

      const validSelections = selectedTools.filter((toolName) =>
        candidates.some((c) => c.toolName === toolName)
      );

      console.log(
        `[MCP Client] ✅ Ollama final selection: ${validSelections.join(", ")} ✨`
      );
      return validSelections.slice(0, 2); // Max 2 tools
    } catch (error) {
      console.error("[MCP Client] Ollama final decision error:", error);

      // Fallback: เลือก tool ที่มีคะแนนสูงสุด
      const fallback = candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 1)
        .map((c) => c.toolName);

      console.log(
        `[MCP Client] ⚠️ Using fallback selection: ${fallback.join(", ")}`
      );
      return fallback;
    }
  }

  // ============================================
  // ENHANCED: Main tool selection with Natural + Fuse.js + Ollama final decision
  // ============================================
  async selectTools(userMessage: string): Promise<string[]> {
    console.log("===== Starting selectTools =====");
    try {
      const cached = this.getCachedSelection(userMessage);
      if (cached) return cached;

      console.log(`\n[MCP Client] ===== Tool Selection Start =====`);
      console.log(`[MCP Client] Query: "${userMessage}"`);

      let candidates: string[] = [];
      let patternMatched: string[] = [];
      let keywordMatched: string[] = [];
      let aiMatched: string[] = [];

      // Strategy 1: Pattern matching with Natural tokenization
      patternMatched = await this.tryPatternMatching(userMessage);
      if (patternMatched.length > 0) {
        console.log(
          `[MCP Client] ✅ Pattern matching: ${patternMatched.join(", ")}`
        );
        candidates = patternMatched;
      }

      // Strategy 2: Keyword matching with Natural + Fuse.js
      if (candidates.length === 0) {
        console.log(
          `[MCP Client] Pattern matching found nothing, trying keyword matching...`
        );
        keywordMatched = await this.tryKeywordMatching(userMessage);
        if (keywordMatched.length > 0) {
          console.log(
            `[MCP Client] ✅ Keyword matching: ${keywordMatched.join(", ")}`
          );
          candidates = keywordMatched;
        }
      }

      // Strategy 3: AI selection (fallback)
      if (candidates.length === 0) {
        console.log(
          `[MCP Client] Keyword matching found nothing, trying AI selection... ✨`
        );
        aiMatched = await this.tryAISelection(userMessage);
        if (aiMatched.length > 0) {
          console.log(
            `[MCP Client] ✅ AI selection: ${aiMatched.join(", ")} ✨`
          );
          candidates = aiMatched;
        }
      }

      // ===== OLLAMA FINAL DECISION =====
      if (candidates.length > 0) {
        console.log(
          `[MCP Client] Found ${candidates.length} candidates, asking Ollama for final decision...`
        );

        // Get detailed scores for Ollama decision making
        const scoredCandidates = await Promise.all(
          candidates.map(async (toolName) => ({
            toolName,
            score: await this.scoreToolRelevance(toolName, userMessage),
          }))
        );

        // Sort by score and take top candidates
        const topCandidates = scoredCandidates
          .sort((a, b) => b.score - a.score)
          .filter((c) => c.score >= 10) // Minimum threshold
          .slice(0, 5); // Max 5 for Ollama to consider

        console.log(
          `[MCP Client] Top ${topCandidates.length} candidates for Ollama:`,
          topCandidates.map((c) => `${c.toolName}(${c.score.toFixed(1)})`)
        );

        // Let Ollama make final decision
        const finalSelection = await this.makeFinalDecisionWithOllama(
          userMessage,
          topCandidates
        );

        if (finalSelection.length > 0) {
          console.log(
            `[MCP Client] 🎯 Ollama final decision: ${finalSelection.join(
              ", "
            )} ✨`
          );
          candidates = finalSelection;
        } else {
          console.log(`[MCP Client] Ollama decided no tools needed  ✨`);
          candidates = [];
        }
      }

      // Limit final result to 1 tool (except special cases)
      const finalSelection = candidates.slice(0, 1);

      console.log(
        `[MCP Client] Final selection: ${
          finalSelection.join(", ") || "❌ none"
        }`
      );
      if (finalSelection.length === 0) {
        try {
          console.error(
            `[MCP Client] Final selection empty for query: "${userMessage}". Details:`
          );
          console.error(`  patternMatched: ${JSON.stringify(patternMatched)}`);
          console.error(`  keywordMatched: ${JSON.stringify(keywordMatched)}`);
          console.error(`  aiMatched: ${JSON.stringify(aiMatched)}`);
          console.error(`  candidates: ${JSON.stringify(candidates)}`);
        } catch (logErr) {
          console.error(
            "[MCP Client] Failed to log final selection details:",
            logErr
          );
        }
      }
      console.log(`[MCP Client] ===== Tool Selection End =====\n`);

      this.cacheSelection(userMessage, finalSelection);
      this.addToHistory(userMessage, finalSelection);
      this.cleanCache();

      return finalSelection;
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

  // Parse validation errors JSON array from an arbitrary error message text
  private parseValidationErrorsFromMessage(text: string): any[] | null {
    if (!text || typeof text !== "string") return null;

    const extracted = this.extractJsonFromText(text);
    if (!extracted) return null;

    try {
      const parsed = JSON.parse(extracted);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && parsed.errors && Array.isArray(parsed.errors))
        return parsed.errors;
      return [parsed];
    } catch (err) {
      return null;
    }
  }

  // Execute selected tools with retry logic
  async executeTools(toolNames: string[], userMessage: string): Promise<any[]> {
    console.log(" ===== Starting executeTools =====");
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

          // สร้าง args จาก tool หรือ resource
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

          // ตรวจสอบว่าเป็น webdTool หรือไม่ (เช็คทั้ง actualToolName และเต็ม toolName)
          const isWebdTool =
            this.isWebdTool(actualToolName) || this.isWebdTool(toolName);

          // เพิ่ม extra.source สำหรับ webdTool (ถ้ายังไม่มี)
          if (isWebdTool) {
            args = Object.assign({}, args);
            args.extra = Object.assign({}, args.extra, {
              source: "webd",
              query: userMessage,
            });
            console.log(
              `[MCP Client] Added extra.source="webd" for ${toolName}`
            );
          }

          const schema = tool ? tool.inputSchema : resource?.inputSchema;

          // ถ้าเป็น webdTool ให้ข้ามการ validate schema (บาง webd tools ไม่ต้องการ/รับ extra)
          if (schema && !isWebdTool) {
            const validation = this.validateArguments(args, schema);
            if (!validation.valid) {
              console.warn(
                `[MCP Client] Invalid arguments for ${toolName}:`,
                validation.errors
              );

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
                      payload = result.content;
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

          break;
        } catch (error) {
          lastError = error;
          retries--;

          if (retries > 0) {
            console.warn(
              `[MCP Client] Retry executing tool ${toolName}, ${retries} attempts left`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

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
    console.log("===== Starting generateToolArguments =====");
    try {
      const schema = tool.inputSchema || {};
      const schemaStr = JSON.stringify(schema, null, 2);
      const required = schema.required || [];
      const properties = schema.properties || {};

      // ตรวจสอบว่าเป็น webdTool หรือไม่ (ใช้ helper)
      const isWebdTool = this.isWebdTool(tool.name);

      const prompt = `สร้างพารามิเตอร์ JSON สำหรับ tool ตามข้อมูลด้านล่าง

คำขอ: "${userMessage}"
Tool: ${tool.name}
คำอธิบาย: ${tool.description || "ไม่มีคำอธิบาย"}

Schema:
${schemaStr}

พารามิเตอร์ที่จำเป็น: ${required.length > 0 ? required.join(", ") : "ไม่มี"}

กฎสำคัญ:
1. ตอบเป็น JSON object ที่มีเฉพาะ INPUT PARAMETERS เท่านั้น
2. ห้ามส่งผลลัพธ์ (result) หรือข้อมูลที่ไม่ใช่ parameters
3. ไม่ต้องใช้ markdown code blocks
4. ถ้าไม่มี parameter ที่ต้องการให้ส่ง {} (empty object)
${isWebdTool ? "5. สำหรับ webdTool ให้ส่ง empty object {} เสมอ" : ""}

ตัวอย่างที่ถูกต้อง:
- dateTimeTool: {}
- webdTool_count_all_by_group: {}
- searchTool: {"query": "keyword"}

ตัวอย่างที่ผิด (ห้ามทำ):
- {"success": true, "data": [...]} ❌
- {"0": {...}, "1": {...}} ❌

JSON:`;

      console.log(
        "[MCP Client] generateToolArguments: calling chatWithOllama ✨"
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
      console.log("[MCP Client] generateToolArguments: response received ✨");

      let jsonStr = String(response?.message?.content || "").trim();

      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const extracted = this.extractJsonFromText(jsonStr);
      if (extracted) {
        jsonStr = extracted;
      } else {
        // try to pick a JSON object if present
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) jsonStr = match[0];
      }

      console.log(
        `[MCP Client] Generated JSON string for ${tool.name}: ${jsonStr.slice(
          0,
          500
        )}`
      );

      let parsed: any = {};

      try {
        if (!jsonStr || jsonStr.length === 0) {
          parsed = {};
        } else {
          parsed = JSON.parse(jsonStr);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            // If AI returned non-object, fallback to empty object
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
          "meta",
          "status",
        ];
        for (const field of invalidFields) {
          if (Object.prototype.hasOwnProperty.call(parsed, field)) {
            delete parsed[field];
          }
        }

        // ลบ numeric keys (เช่น "0", "1", "2")
        for (const key of Object.keys(parsed)) {
          if (/^\d+$/.test(key)) {
            delete parsed[key];
          }
        }

        // หากเป็น webdTool ให้สร้าง args โดยพยายามเติม required fields
        if (isWebdTool) {
          const webdArgs: any = {};

          // ถ้ามี required fields ให้ใช้มันเป็นตัวตั้งต้น
          const requiredKeys: string[] =
            required && required.length > 0
              ? required
              : Object.keys(properties || {});

          for (const key of requiredKeys) {
            const lower = String(key).toLowerCase();
            if (
              lower === "query" ||
              lower.includes("query") ||
              lower === "q" ||
              lower.includes("search")
            ) {
              webdArgs[key] = userMessage;
            } else {
              webdArgs[key] = properties[key]?.default ?? "";
            }
          }

          // ถ้าไม่มี required keys ให้เป็น empty object
          if (requiredKeys.length === 0) {
            parsed = {};
          } else {
            parsed = webdArgs;
          }

          console.log(
            `[MCP Client] webdTool detected for ${
              tool.name
            }, generated args: ${JSON.stringify(parsed)}`
          );
        }
      } catch (parseError) {
        console.warn(
          `[MCP Client] Failed to parse JSON from AI, using empty object. Error: ${String(
            parseError
          )}`
        );
        parsed = {};
      }

      // ตรวจสอบ required fields (ยกเว้น webdTool)
      if (!isWebdTool) {
        for (const key of required) {
          if (!(key in parsed)) {
            parsed[key] = properties[key]?.default ?? "";
          }
        }
      }

      console.log(
        `[MCP Client] Final args for ${tool.name}: ${JSON.stringify(parsed)}`
      );
      return parsed;
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

  // Create enhanced context for Ollama response with scoring
  private createEnhancedContext(
    userMessage: string,
    toolResults: any[]
  ): string {
    console.log("===== Starting createEnhancedContext =====");

    // คำนวณคะแนนความสำเร็จของแต่ละ tool result
    const scoredResults = toolResults.map((result) => {
      let successScore = 0;

      if (result.success) {
        successScore += 10; // base success score

        // เพิ่มคะแนนตามความซับซ้อนของ result
        if (result.result) {
          const resultStr = JSON.stringify(result.result);
          const complexity = Math.min(resultStr.length / 100, 10); // max 10 points for complexity
          successScore += complexity;
        }

        // เพิ่มคะแนนถ้าเป็น webd tool
        if (this.isWebdTool(result.toolName)) {
          successScore += 5;
        }
      } else {
        successScore = -5; // penalty for failure
      }

      return {
        ...result,
        successScore,
      };
    });

    // เรียงตามคะแนนความสำเร็จ
    scoredResults.sort((a, b) => b.successScore - a.successScore);

    let context = `คำถามเดิม: "${userMessage}"\n\nข้อมูลจาก MCP Tools (จัดอันดับตามความสำเร็จ):\n\n`;

    for (const result of scoredResults) {
      const scoreIndicator = result.success
        ? `✅ (คะแนน: ${result.successScore.toFixed(1)})`
        : `❌ (คะแนน: ${result.successScore.toFixed(1)})`;

      if (result.error) {
        context += `${scoreIndicator} ${result.toolName}: เกิดข้อผิดพลาด - ${result.error}\n`;
      } else {
        const resultStr =
          typeof result.result === "string"
            ? result.result
            : JSON.stringify(result.result, null, 2);
        context += `${scoreIndicator} ${result.toolName}:\n${resultStr}\n\n`;
      }
    }

    // เพิ่มคำแนะนำที่ปรับปรุงตามคะแนน
    const avgScore =
      scoredResults.reduce((sum, r) => sum + r.successScore, 0) /
      scoredResults.length;
    let advice = "ใช้ข้อมูลจาก tools ข้างต้นตอบคำถามอย่างชัดเจนและเป็นธรรมชาติ";

    if (avgScore > 15) {
      advice += "\n💡 ข้อมูลนี้มีความน่าเชื่อถือสูง ใช้เป็นหลักในการตอบ";
    } else if (avgScore > 5) {
      advice += "\n⚠️ ข้อมูลนี้พอใช้ได้ แต่ควรระวังความถูกต้อง";
    } else {
      advice += "\n❌ ข้อมูลมีปัญหา ควรตอบโดยไม่พึ่งพามันมาก";
    }

    context += `\nคำแนะนำ: ${advice}`;

    return context;
  }

  async generateHtmlResponse(
    userInstruction: string,
    extraContext?: string,
    options?: any
  ): Promise<string> {
    console.log("===== Starting generateHtmlResponse =====");
    try {
      const contextPart =
        extraContext && extraContext.trim().length > 0
          ? `${extraContext}\n\n`
          : "";

      const fullPrompt = `${contextPart}${userInstruction}`;

      console.log(
        "[MCP Client] generateHtmlResponse: calling chatWithOllama ✨"
      );
      const response = await this.chatWithOllama(
        [{ role: "user", content: fullPrompt }],
        Object.assign({ temperature: 0.2, num_predict: 400 }, options || {})
      );
      console.log("[MCP Client] generateHtmlResponse: response received ✨");

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

// Helper function to generate tool descriptions from Maps with scoring
async function getToolDescriptions(
  tools: Map<string, MCPTool>,
  resources?: Map<string, MCPResource>,
  userMessage?: string,
  scoreToolRelevance?: (toolName: string, message: string) => Promise<number>
): Promise<string> {
  let descriptions = "**Tools**:\n";

  const toolList = Array.from(tools.values());

  // ถ้ามี userMessage และ scoreToolRelevance ให้คำนวณคะแนน
  let scoredTools: Array<{ tool: MCPTool; score?: number }> = toolList.map(
    (tool) => ({ tool })
  );

  if (userMessage && scoreToolRelevance) {
    // คำนวณคะแนนพร้อมกัน
    const scorePromises = toolList.map(async (tool) => {
      const fullName =
        Array.from(tools.entries()).find(([, t]) => t === tool)?.[0] ||
        tool.name;
      const score = await scoreToolRelevance(fullName, userMessage);
      return { tool, score };
    });

    scoredTools = await Promise.all(scorePromises);

    // เรียงตามคะแนน
    scoredTools.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  descriptions += scoredTools
    .map(({ tool, score }) => {
      const scoreText =
        score !== undefined ? ` (คะแนน: ${score.toFixed(2)})` : "";
      return `- ${tool.name}${scoreText}
  คำอธิบาย: ${tool.description}
  หมวดหมู่: ${tool.category}
  ตัวอย่าง: ${tool.examples.slice(0, 3).join(", ")}`;
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

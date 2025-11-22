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
    console.log(
      `============ start chatWithOllama pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
    console.log("[MCP Client] chatWithOllama called ✨", messages, options);
    try {
      console.log("[MCP Client] Calling ollama.chat (sync) ✨");
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
      console.log("[MCP Client] Calling ollama.chat (stream) ✨");
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

  // JSON-enforcing wrapper around chatWithOllama
  private async chatWithOllamaJSON(
    messages: any[],
    options?: any,
    maxRetries = 2,
    requiredMarkdownField = "markdown"
  ): Promise<any> {
    console.log(
      `============ start chatWithOllamaJSON pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
    const retryInstruction = {
      role: "system",
      content: `สำคัญ: ตอบกลับเป็น JSON เท่านั้น และต้องมีฟิลด์ระดับบนสุดชื่อ "${requiredMarkdownField}" ซึ่งเป็นสตริง Markdown สำหรับผู้ใช้. ห้ามส่ง HTML หรือข้อความนอก JSON.`,
    };

    let msgList = Array.isArray(messages) ? [...messages] : [messages];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      console.log(
        `[MCP Client] chatWithOllamaJSON: attempt ${
          attempt + 1
        } calling chatWithOllama ✨`
      );
      const resp = await this.chatWithOllama(msgList, options);

      console.log(`[MCP Client] chatWithOllamaJSON: response received ✨`);

      let content =
        resp?.message?.content ??
        (typeof resp === "string" ? resp : JSON.stringify(resp));

      if (typeof content !== "string") content = String(content || "");
      content = content.replace(/^\uFEFF/, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        const match = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e) {
            parsed = null;
          }
        }
      }

      if (parsed && typeof parsed === "object") {
        const hasMarkdown =
          Object.prototype.hasOwnProperty.call(parsed, requiredMarkdownField) &&
          typeof parsed[requiredMarkdownField] === "string";
        if (hasMarkdown) {
          return parsed;
        }

        if (parsed && attempt < maxRetries) {
          msgList = [...messages, retryInstruction];
          continue;
        }

        if (parsed) {
          parsed[requiredMarkdownField] = parsed[requiredMarkdownField] || "";
          return parsed;
        }
      }

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
    console.log(
      `============ start initializeClients pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
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
    console.log(
      `============ start loadToolsFromClient pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
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

  // Enhanced keyword extraction supporting Thai language
  private extractKeywords(name: string, description?: string): string[] {
    const text = `${name} ${description || ""}`;

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
  // NEW: คำนวณคะแนนความเกี่ยวข้องของ tool
  // ============================================
  private async scoreToolRelevance(
    toolName: string,
    userMessage: string
  ): Promise<number> {
    const tool = this.tools.get(toolName);
    const resource = this.resources.get(toolName);

    if (!tool && !resource) return 0;

    const lowerMessage = userMessage.toLowerCase();
    const description = tool?.description || resource?.description || "";
    const keywords =
      tool?.keywords || this.extractKeywords(toolName, description);

    let score = 0;

    // คะแนนจาก keyword matching
    const matchedKeywords = keywords.filter((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    );
    score += matchedKeywords.length * 2;

    // คะแนนจาก category matching
    if (tool?.category) {
      const categoryKeywords: Record<string, string[]> = {
        datetime: ["วันนี้", "เวลา", "วันที่", "time", "date"],
        greeting: ["สวัสดี", "ทักทาย", "hello", "hi"],
        webd: ["webd", "ผิดกฎหมาย", "คำสั่งศาล", "url"],
        weather: ["อากาศ", "weather", "ฝน"],
      };

      const categoryKeys = categoryKeywords[tool.category] || [];
      const categoryMatches = categoryKeys.filter((k) =>
        lowerMessage.includes(k)
      );
      score += categoryMatches.length * 3;
    }

    // คะแนนจาก pattern matching
    for (const pattern of this.toolPatterns) {
      if (pattern.toolPattern.test(toolName)) {
        const patternMatches = pattern.keywords.filter((k) =>
          lowerMessage.includes(k.toLowerCase())
        );
        if (patternMatches.length > 0) {
          score +=
            pattern.priority === "high"
              ? 5
              : pattern.priority === "medium"
              ? 3
              : 1;
        }
      }
    }

    // คะแนนจากการ match คำในคำอธิบาย (description)
    try {
      const descKeywords = this.extractKeywords(
        tool?.name || toolName,
        description
      );
      const descMatches = descKeywords.filter((k) =>
        lowerMessage.includes(k.toLowerCase())
      );
      score += descMatches.length * 2;
    } catch (e) {
      // ignore
    }

    // ที่คำนวณจากชื่อ tool แบบ deterministic (ไม่ใช้ random) เพื่อให้ผลต่างกัน
    try {
      if (
        lowerMessage.includes("webd") &&
        toolName.toLowerCase().includes("webd")
      ) {
        // deterministic small offset based on toolName to break ties (0-4)
        const offset =
          Array.from(toolName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
          5;
        // base bonus near previous value (10) but slightly varied: 8..12
        score += 8 + offset;
      }
    } catch (e) {
      // ignore
    }

    return score;
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
  // UPDATED: Strategy 1 - Pattern matching
  // ============================================
  private async tryPatternMatching(userMessage: string): Promise<string[]> {
    console.log(
      `============ start tryPatternMatching pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
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

    for (const pattern of this.toolPatterns) {
      const matchCount = pattern.keywords.filter((keyword) =>
        lowerMessage.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > 0) {
        const matchedTools = Array.from(this.tools.keys()).filter((key) =>
          pattern.toolPattern.test(key)
        );
        const matchedResources = Array.from(this.resources.keys()).filter(
          (key) => pattern.toolPattern.test(key)
        );

        const allMatches = [...matchedTools, ...matchedResources];
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

    // จัดเรียงและกรอง
    const candidates = Array.from(toolScores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= 5)
      .map(([tool]) => tool);

    // ใช้ deduplicate และ ranking
    return await this.deduplicateAndRankTools(candidates, userMessage);
  }

  // ============================================
  // UPDATED: Strategy 2 - Keyword matching
  // ============================================
  private async tryKeywordMatching(userMessage: string): Promise<string[]> {
    console.log(
      `============ start tryKeywordMatching pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
    console.log(`[MCP Client] Trying keyword matching for: "${userMessage}"`);

    const userKeywords = this.extractKeywords(userMessage);
    if (userKeywords.length === 0) return [];

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

    const candidates = matches
      .sort((a, b) => b.score - a.score)
      .filter((m) => m.score >= 0.01)
      .map((m) => m.tool);

    // ใช้ deduplicate และ ranking
    return await this.deduplicateAndRankTools(candidates, userMessage);
  }

  // ============================================
  // UPDATED: Strategy 3 - AI selection
  // ============================================
  private async tryAISelection(userMessage: string): Promise<string[]> {
    console.log(
      `============ start tryAISelection pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
    console.log(`[MCP Client] Trying AI selection for: "${userMessage}" ✨`);

    try {
      const toolDescriptions = getToolDescriptions(this.tools, this.resources);
      const contextStr = this.getConversationContext();

      const prompt = `คุณเป็น AI ที่เลือก MCP tools อย่างแม่นยำ
${contextStr}

**คำขอ**: "${userMessage}"

**Tools/Resources**:
${toolDescriptions}

**กฎการเลือก**:
1. เลือกเฉพาะ 1 tool/resource ที่เหมาะสมที่สุดเท่านั้น
2. ถ้าไม่แน่ใจ 100% ให้ตอบ "none"
3. คำทักทาย → ใช้ resource (ไม่ใช้ tool)
4. คำถามทั่วไป → ตอบ "none" (ไม่ต้องใช้ tool)

**ตอบเฉพาะชื่อ tool/resource หรือ "none"**:`;

      console.log("[MCP Client] tryAISelection: calling chatWithOllama ✨");
      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 50 }
      );
      console.log("[MCP Client] tryAISelection: response received ✨");

      const rawText = String(response.message?.content || "").trim();
      console.log(
        `[MCP Client] AI raw selection text: ${rawText.slice(0, 200)}`
      );

      // Try to extract JSON first, then fall back to plain text parsing
      let parsedJson: any = null;
      const extracted = this.extractJsonFromText(rawText);
      if (extracted) {
        try {
          parsedJson = JSON.parse(extracted);
        } catch (e) {
          parsedJson = null;
        }
      }

      let rawCandidates: string[] = [];

      if (parsedJson) {
        if (typeof parsedJson === "string") {
          rawCandidates = [parsedJson];
        } else if (Array.isArray(parsedJson)) {
          rawCandidates = parsedJson.map((s) => String(s));
        } else if (typeof parsedJson === "object") {
          const fromData = parsedJson.data;
          const fromTool =
            parsedJson.tool ||
            parsedJson.tools ||
            parsedJson.selected ||
            parsedJson.selection ||
            parsedJson.toolName ||
            parsedJson.name;

          if (fromData) {
            if (typeof fromData === "string") rawCandidates = [fromData];
            else if (Array.isArray(fromData))
              rawCandidates = fromData.map((s) => String(s));
            else if (typeof fromData === "object") {
              const inner = fromData.tool || fromData.name;
              if (inner)
                rawCandidates = Array.isArray(inner)
                  ? inner.map((s) => String(s))
                  : [String(inner)];
              else
                rawCandidates = Object.values(fromData).map((v) => String(v));
            }
          } else if (fromTool) {
            rawCandidates = Array.isArray(fromTool)
              ? fromTool.map((s) => String(s))
              : [String(fromTool)];
          } else if (
            parsedJson.markdown &&
            typeof parsedJson.markdown === "string"
          ) {
            rawCandidates = parsedJson.markdown
              .split(/\s*,\s*|\n/)
              .map((s: string) => s.trim())
              .filter(Boolean);
          } else {
            rawCandidates = [String(parsedJson)];
          }
        }
      }

      if (rawCandidates.length === 0) {
        // fallback plain text split
        rawCandidates = rawText
          .split(/\s*,\s*|\n/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      rawCandidates = rawCandidates.slice(0, 1); // จำกัดแค่ 1 ตัว

      const resolved: string[] = [];

      for (const candidate of rawCandidates) {
        if (this.tools.has(candidate) || this.resources.has(candidate)) {
          resolved.push(candidate);
          continue;
        }

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

        // Log unknown candidate with detailed context to help debugging
        console.error(
          `[MCP Client] AI suggested unknown tool/resource: ${candidate}`
        );
        try {
          console.error(`[MCP Client] AI raw selection: ${rawText}`);
          try {
            console.error(
              `[MCP Client] AI response object: ${JSON.stringify(
                response
              ).slice(0, 2000)}`
            );
          } catch (e) {
            console.error(
              `[MCP Client] AI response object (stringify failed):`,
              e
            );
          }

          console.error(
            `[MCP Client] Known tools (sample): ${Array.from(this.tools.keys())
              .slice(0, 200)
              .join(", ")}`
          );
          console.error(
            `[MCP Client] Known resources (sample): ${Array.from(
              this.resources.keys()
            )
              .slice(0, 200)
              .join(", ")}`
          );
        } catch (logErr) {
          console.error(
            "[MCP Client] Failed to log AI unknown candidate context:",
            logErr
          );
        }
      }

      // ถ้าไม่มี resolved candidates ให้บันทึกเพิ่มเติม
      if (resolved.length === 0) {
        console.error(
          `[MCP Client] AI selection produced no resolvable candidates for query: "${userMessage}". AI raw selection: ${rawText}`
        );
      }

      // ใช้ deduplicate และ ranking
      return await this.deduplicateAndRankTools(resolved, userMessage);
    } catch (error) {
      console.error("[MCP Client] AI selection error:", error);
      return [];
    }
  }

  // ============================================
  // UPDATED: Validate tool selection
  // ============================================
  private async validateToolSelection(
    userMessage: string,
    selectedTools: string[]
  ): Promise<string[]> {
    console.log(
      `============ start validateToolSelection pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
    // แนวทาง 3: ใช้ AI validation เต็มรูปแบบ (พร้อม optimizations)
    if (selectedTools.length === 0) return [];

    // Special case: greeting (ไม่ต้องถาม AI)
    if (this.isGreetingQuery(userMessage)) {
      const greetingResource = selectedTools.find(
        (t) => t.includes("greeting") && this.resources.has(t)
      );
      if (greetingResource) {
        console.log(
          "[MCP Client] ✅ Validated greeting resource (no AI needed)"
        );
        return [greetingResource];
      }
    }

    // Optimization: ถ้ามีแค่ tool เดี่ยว และคะแนนสูงมาก ไม่ต้องถาม AI
    if (selectedTools.length === 1) {
      const score = await this.scoreToolRelevance(
        selectedTools[0],
        userMessage
      );
      if (score >= 15) {
        console.log(
          `[MCP Client] ✅ Single tool with high score (${score}), no AI needed`
        );
        return selectedTools;
      }
    }

    // เริ่ม AI validation
    console.log(
      `[MCP Client] Validating selected tools with AI: ${selectedTools.join(
        ", "
      )} ✨`
    );

    try {
      // สร้าง description สำหรับแต่ละ tool
      const toolDescriptions = await Promise.all(
        selectedTools.map(async (toolName) => {
          const tool = this.tools.get(toolName);
          const resource = this.resources.get(toolName);
          const desc =
            tool?.description || resource?.description || "ไม่มีคำอธิบาย";
          const score = await this.scoreToolRelevance(toolName, userMessage);

          return {
            toolName,
            description: desc,
            score,
          };
        })
      );

      // เรียงตามคะแนน
      toolDescriptions.sort((a, b) => b.score - a.score);

      const toolList = toolDescriptions
        .map(
          (t, i) =>
            `${i + 1}. ${t.toolName}\n   ${
              t.description
            }\n   (ความเกี่ยวข้อง: ${t.score})`
        )
        .join("\n\n");

      const prompt = `ตรวจสอบว่า tools ใดเหมาะสมกับคำถามนี้

คำถาม: "${userMessage}"

Tools ที่เป็นไปได้:
${toolList}

กฎการตรวจสอบ:
1. เลือกเฉพาะ tool ที่ตรงกับคำถามมากที่สุด (1 ตัว)
2. ถ้าคำถามไม่ต้องการใช้ tool ให้ตอบ "none"
3. ถ้าไม่แน่ใจ ให้เลือก tool ที่มีคะแนนความเกี่ยวข้องสูงสุด

ตอบเฉพาะชื่อ tool (เช่น "innomcp-server:webdTool_count") หรือ "none":`;

      // เรียก AI ครั้งเดียว (ไม่ loop)
      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 100 }
      );

      let selectedTool = response.message?.content?.trim() || "";

      // Clean up response
      selectedTool = selectedTool
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/\s*```/g, "")
        .split("\n")[0] // เอาแค่บรรทัดแรก
        .trim();

      console.log(`[MCP Client] AI validation result: "${selectedTool}" ✨`);

      if (selectedTool.toLowerCase() === "none" || selectedTool === "") {
        console.log("[MCP Client] ❌ AI rejected all tools ✨");
        return [];
      }

      // หา tool ที่ AI เลือก
      const matched = toolDescriptions.find(
        (t) =>
          t.toolName === selectedTool ||
          t.toolName.endsWith(`:${selectedTool}`) ||
          t.toolName.includes(selectedTool)
      );

      if (matched) {
        console.log(`[MCP Client] ✅ AI confirmed: ${matched.toolName} ✨`);
        return [matched.toolName];
      }

      // Fallback: ถ้า AI ตอบผิด ใช้ tool ที่คะแนนสูงสุด
      console.log(
        "[MCP Client] ⚠️ AI selected unknown tool, using highest score"
      );
      const fallback = toolDescriptions.filter((t) => t.score >= 5);
      return fallback.length > 0 ? [fallback[0].toolName] : [];
    } catch (error) {
      console.error("[MCP Client] AI validation error:", error);

      // Fallback: ใช้ scoring
      const scored = await Promise.all(
        selectedTools.map(async (toolName) => ({
          toolName,
          score: await this.scoreToolRelevance(toolName, userMessage),
        }))
      );

      scored.sort((a, b) => b.score - a.score);
      const fallback = scored.filter((t) => t.score >= 5);

      console.log(
        "[MCP Client] ⚠️ Using scoring fallback:",
        fallback.map((t) => `${t.toolName} (${t.score})`)
      );

      return fallback.length > 0 ? [fallback[0].toolName] : [];
    }
  }

  // ============================================
  // UPDATED: Main tool selection
  // ============================================
  async selectTools(userMessage: string): Promise<string[]> {
    console.log(
      `============ start selectTools pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
    try {
      const cached = this.getCachedSelection(userMessage);
      if (cached) return cached;

      console.log(`\n[MCP Client] ===== Tool Selection Start =====`);
      console.log(`[MCP Client] Query: "${userMessage}"`);

      let candidates: string[] = [];
      let patternMatched: string[] = [];
      let keywordMatched: string[] = [];
      let aiMatched: string[] = [];

      // Strategy 1: Pattern matching
      patternMatched = await this.tryPatternMatching(userMessage);
      if (patternMatched.length > 0) {
        console.log(
          `[MCP Client] ✅ Pattern matching: ${patternMatched.join(", ")}`
        );
        candidates = patternMatched;
      }

      // Strategy 2: Keyword matching (ถ้ายังไม่ได้)
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

      // Strategy 3: AI selection (ถ้ายังไม่ได้)
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

      // Validate ผลลัพธ์สุดท้าย
      const validated = await this.validateToolSelection(
        userMessage,
        candidates
      );

      // จำกัดผลลัพธ์สุดท้ายไม่เกิน 1 tool (ยกเว้นกรณีพิเศษ)
      const finalSelection = validated.slice(0, 1);

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
          console.error(`  validated: ${JSON.stringify(validated)}`);
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
    console.log(
      `============ start executeTools pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
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
    console.log(
      `============ start generateToolArguments pid=${
        process.pid
      } cwd=${process.cwd()} env=${process.env.NODE_ENV || "unknown"} tool=${
        tool?.name || "unknown"
      } ==============`
    );
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
    console.log(
      `============ start processMessage pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
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
    console.log(
      `============ start createEnhancedContext pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
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

  async generateHtmlResponse(
    userInstruction: string,
    extraContext?: string,
    options?: any
  ): Promise<string> {
    console.log(
      `============ start generateHtmlResponse pid=${
        process.pid
      } cwd=${process.cwd()} env=${
        process.env.NODE_ENV || "unknown"
      } ==============`
    );
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

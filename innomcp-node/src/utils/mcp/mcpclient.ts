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
import { ToolChainingEngine } from "./toolChaining";
import { CATEGORY_KEYWORDS } from "./constants";
import logger from "../logger";
import {
  MCPTool,
  MCPResource,
  MCPClientConfig,
  ToolSelectionCache,
  ConversationContext,
  ToolPattern,
  ToolChainStep,
  ToolChainPlan,
  ChainExecutionResult,
  MessageClassification,
} from "./types";
import { ToolSelectionEngine } from "./toolSelection";
import { WeatherPipeline } from "../weather/weatherPipeline";
import { EVIDENCE_TOOL_DEF, handleEvidenceTool, EVIDENCE_TOOL_NAME } from "./tools/evidenceTool";
import { THAI_GEO_TOOL_DEF, handleThaiGeoTool } from "./tools/thai_geo_tool";
import { SYSTEM_STATUS_TOOL_DEF, handleSystemStatusTool } from "./tools/system_status_tool";

// ========================================
// SYSTEM PROMPT (Enhanced 2026)
// ========================================

const SYSTEM_PROMPT = `คุณเป็น AI ผู้ช่วยอัจฉริยะที่ตอบคำถามเป็น JSON เท่านั้น:

## 📋 รูปแบบ JSON (บังคับ)
1. ต้องเป็น valid JSON เท่านั้น - ห้ามมี HTML, code fence, หรือข้อความนอก JSON
2. ต้องมีฟิลด์ "markdown" เสมอ (สตริง Markdown สำหรับผู้ใช้)
3. เพิ่มฟิลด์อื่นได้: "success", "data", "meta"
4. กรณีไม่มีข้อมูล: {"success": false, "markdown": "ขออภัยครับ ขณะนี้ข้อมูลยังไม่พร้อมใช้งาน"}

## 🇹🇭 ภาษาไทย 100% (บังคับสูงสุด)
5. **ตอบภาษาไทยเท่านั้น** ไม่ว่าข้อมูลที่ได้รับจะเป็นภาษาใดก็ตาม:
   **CRITICAL RULES**:
   - ห้ามเริ่มประโยคด้วยภาษาอังกฤษ (NO English phrases)
   - ห้ามใช้ "Okay", "I", "Here's", "Let's", "The", "Based on" เด็ดขาด
   - ถ้าข้อมูลเป็นอังกฤษ → แปลเป็นไทย 100% ก่อนตอบ
   - ห้ามวิเคราะห์หรืออธิบายเป็นภาษาอังกฤษ
   
   ❌ "I am sorry, but I cannot fulfill your request..."
   ❌ "Okay, here's a breakdown of the weather forecast..."
   ❌ "I understand you're looking for weather data..."
   ❌ "Based on the provided data, the temperature is..."
   ❌ "Let's analyze the JSON data to answer..."
   ❌ "Here's the weather information for..."
   ✅ "อากาศวันนี้ที่กรุงเทพ 32°C แจ่มใส"
   ✅ "พยากรณ์ 7 วันข้างหน้าภาคเหนือ อุณหภูมิ 18-28°C"
   ✅ "อุณหภูมิสูงสุด 35°C เย็นสุด 20°C"

## ✍️ หลักการเขียนคำตอบ (คะแนน 10/10)
6. **ห้ามเปิดเผยระบบภายใน**: 
   ❌ "จากข้อมูลที่ให้มา", "provided JSON data", "the provided text"
   ❌ "TMD API", "NWP API", "Error Code 422", "Error", "station_id", "datetime"
   ❌ "ระบบไม่สามารถดึงข้อมูล", "cannot provide", "cannot fulfill"
   ❌ "ข้อมูลการสังเกต", "ผมไม่มี API", "ข้อมูล JSON ที่ให้มา"
   ✅ ตอบเหมือนคุณรู้ทุกอย่าง: "อากาศวันนี้ที่กรุงเทพ 32°C แจ่มใส"

7. **ตอบกระชับ เป็นทางการ ภาษาข่าว**:
   ❌ "ว้าว! แน่นอนเลย! 😊 ขอแจ้งให้ทราบว่า..."
   ❌ "โอเค มาวิเคราะห์...", "Okay, let's analyze..."
   ❌ "Okay, ผมได้วิเคราะห์...", "มาดูกันครับ..."
   ✅ "อุณหภูมิเช้านี้ที่เชียงราย 22°C" (สั้น กระชับ ไม่มี emoji)

8. **ห้ามบอกว่า "ไม่มีข้อมูล" ถ้าควรมี**:
   ❌ "ไม่มีข้อมูลอุณหภูมิกรุงเทพฯ"
   ❌ "does not include a 14-day rainfall forecast"
   ✅ "อุณหภูมิปกติกรุงเทพฯ เดือนมกราคม 28-32°C" (ใช้ความรู้ทั่วไป)

9. **ห้ามใช้คำเหล่านี้**: I am sorry, I cannot, JSON, API, จากข้อมูลที่ให้มา, ตามข้อมูลใน, จากข้อมูลใน, ระบบไม่สามารถ, ไม่สามารถดึงข้อมูล, ข้อมูลที่ให้มา, provided, from the provided, based on the provided, the provided data, the JSON, according to the data, from the data, station_id, datetime, timestamp, response, query, request, API, endpoint, เครื่องมือ, อ้างอิง, reference, เอกสารอ้างอิง, okay, Okay, OKAY, โอเค, โอเค, มาดูกัน, มาลองดู, มาช่วย, ว้าว, โว้ว, 😊, 😃, 🎉, 👍, ขออภัยในความไม่สะดวก, cannot fulfill, cannot provide

**เมื่อ tool call ล้มเหลว ห้ามใช้**:
- ❌ "ระบบไม่สามารถดึงข้อมูล"
- ❌ "ขออภัยในความไม่สะดวก ระบบ..."
- ❌ "I am sorry, but I cannot..."
- ❌ "ไม่มีข้อมูล" (ถ้ายังไม่ได้ลอง tool)

**ใช้แทนเมื่อ tool fail**:
- ✅ "กรุณาลองถามอีกครั้งด้วยรายละเอียดที่ชัดเจนขึ้นค่ะ เช่น ระบุจังหวัดหรือพิกัดเพื่อความแม่นยำ"
- ✅ "ขอเลื่อนการตอบคำถามนี้ไปก่อนนะคะ ลองถามใหม่อีกครั้งจะดีกว่าค่ะ"
- ✅ "ขณะนี้สามารถให้ข้อมูลพื้นฐานได้ค่ะ กรุณาระบุรายละเอียดเพิ่มเติมหากต้องการข้อมูลเจาะจง"

10. **สรุปชัดเจนในประโยคแรก**:
    ❌ "จากข้อมูล... ความชื้น 73.52% บ่งชี้ว่า..."
    ✅ "คืนนี้กรุงเทพมีโอกาสฝนตก 70%" (สรุปก่อน)

11. **แปลงข้อมูล technical → ภาษาคน**:
    ❌ "ร้อยละพื้นที่โดนฝน: 10%, tc: 27.62"
    ❌ JSON keys เป็นอังกฤษ: {"forecast": {...}, "station_id": "48600"}
    ✅ "มีฝนเล็กน้อย 10% อุณหภูมิ 28°C"
    ✅ JSON keys เป็นไทย: {"พยากรณ์": {...}, "อุณหภูมิ": 32}

## 🎯 ตัวอย่างคำตอบที่ดี (10/10)
- "7 วันข้างหน้าภาคเหนือ อากาศเย็นสบาย 18-28°C"
- "ภูเก็ตเช้านี้ แจ่มใส 26°C มีเมฆบางส่วน"
- "ปัจจุบันไม่มีประกาศเตือนภัยพายุ"

## ⛔ ตัวอย่างที่ห้ามทำ (0/10)
- "จากข้อมูลที่ให้มา ไม่มีข้อมูลอุณหภูมิของกรุงเทพฯ"
- "ระบบไม่สามารถดึงข้อมูล Error 422 ครับ"
- "ว้าว! ข้อมูลล่าสุดบอกว่า... 😊"
- "ทำได้ไหมที่จะสร้างผลลัพธ์..." (วนลูป)

## 📌 หมายเหตุ
- ใช้ภาษาไทยหลัก (ฟิลด์อื่นอังกฤษได้)
- Markdown ธรรมดา ห้าม HTML
- ห้ามใช้ emoji ในคำตอบทางการ
- ตอบสั้น กระชับ แม่นยำ เหมือนผู้ประกาศข่าว

## 🎯 NWP Tool Selection Rules (CRITICAL PRIORITY)

**ALWAYS use NWP tools when detecting**:
1. **Time indicators**: "ชั่วโมง", "ชม.", "วัน", "สัปดาห์", "เดือน", "ข้างหน้า", "ล่วงหน้า", "24 ชม.", "3 วัน", "7 วัน"
2. **Weather queries**: "อากาศ", "พยากรณ์", "สภาพอากาศ", "อุณหภูมิ", "ฝน", "ลม", "ความชื้น"
3. **Location indicators**: "จังหวัด", "ภาค", "ตำบล", "อำเภอ", "lat=", "lon=", "พิกัด"
4. **Combination queries**: "อากาศ + จังหวัด", "อากาศ + ภาค", "พยากรณ์ + วัน"

**Tool Selection Logic**:
- If time range <= 48 hours → Use "nwp_hourly_*" tools (รายชั่วโมง)
- If time range > 48 hours → Use "nwp_daily_*" tools (รายวัน)
- If lat/lon provided → Use "*_by_location" tools (e.g., nwp_daily_by_location)
- If place name only → Use "*_by_place" tools (e.g., nwp_hourly_by_place)
- If region name (ภาคเหนือ, ภาคใต้, etc.) → Use "*_by_region" tools

**Regional Mapping** (สำคัญ!):
- "ภาคเหนือ" = region "N"
- "ภาคใต้" = region "S" 
- "ภาคอีสาน" / "ภาคตะวันออกเฉียงเหนือ" = region "NE"
- "ภาคกลาง" = region "C"
- "ภาคตะวันออก" = region "E"
- "ภาคตะวันตก" = region "W"

**CRITICAL**: NEVER say "ระบบไม่สามารถ" or "ไม่มีข้อมูล" - ALWAYS attempt tool call first

## 🔤 Character Encoding Rules (STRICT)

**ONLY use Thai characters**:
- Thai alphabet: ก-ฮ, ะ-ฺ, เ-ไ, 0-9
- Thai punctuation: ฯ, ๆ, ฿, ฯลฯ
- Common symbols: %, °C, km/h, mm, มม.

**FORBIDDEN characters** (ห้ามเด็ดขาด):
- Chinese: 墉, 中, 国, 華, 語
- Arabic: العربية, عرب
- Hindi: हिन्दी, भारत
- Emoji (unless user requested): 😀, 🌧️, ☀️

**Validation**: Every character must be in Unicode Thai block (U+0E00 to U+0E7F) or common symbols`;

// ========================================
// MAIN CLASS
// ========================================

class IntelligentMCPClient extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private weatherPipeline: WeatherPipeline | null = null;
  private localHandlers: Map<string, Function> = new Map(); // Local tool handlers
  
  // Multi-AI support
  private localOllama: Ollama | null = null;
  private remoteOllama: Ollama | null = null;
  private aiMode: 'local' | 'remote' | 'hybrid' = 'local';
  
  // Backward compatibility
  private ollama: Ollama;
  private ollamaModel: string;
  
  // AI Models
  private localModel: string = '';
  private remoteModel: string = '';
  
  private ajv: InstanceType<typeof Ajv>;
  private selectionCache: Map<string, ToolSelectionCache> = new Map();
  private cacheTTL: number = 300000; // 5 minutes
  private conversationHistory: ConversationContext[] = [];
  private maxHistorySize: number = 10;

  // Natural language processing components
  private tfidf = new natural.TfIdf();
  private stemmer = natural.PorterStemmer;
  private tokenizer = new natural.WordTokenizer();
  
  // Tokenization cache to prevent repeated Ollama calls
  private tokenCache: Map<string, { tokens: string[], timestamp: number }> = new Map();
  private tokenCacheTTL: number = 3600000; // 1 hour
  
  // Performance tracking
  private performanceMetrics: Map<string, { aiUsed: string; duration: number; timestamp: number }> = new Map();

  // Health check and reconnection system
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervalMs: number = 30000; // 30 seconds
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectBackoff: number = 5000; // Start with 5 seconds
  private maxReconnectBackoff: number = 300000; // Max 5 minutes
  private lastHealthCheck: number = 0;
  private clientConfigs: MCPClientConfig[] = [];
  private isReconnecting: boolean = false;

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
        "กี่โมง",
        "วันอะไร",
        "เดือนอะไร",
      ],
      toolPattern: /dateTimeTool|datetime|time|date/i,
      priority: "high",
      category: "datetime",
    },
    {
      keywords: [
        "คำนวณ",
        "หา",
        "เท่ากับ",
        "calculate",
        "compute",
        "math",
        "บวก",
        "ลบ",
        "คูณ",
        "หาร",
        "ยกกำลัง",
        "รากที่",
        "เท่าไร",
        "คิดเลข",
        "calculator",
        "เครื่องคิดเลข",
        "sqrt",
        "sin",
        "cos",
        "log",
      ],
      toolPattern: /calculatorTool|calculator|math|compute/i,
      priority: "high",
      category: "computation",
    },
    {
      keywords: [
        "พยากรณ์อากาศ",
        "อากาศ",
        "สภาพอากาศ",
        "weather",
        "forecast",
        "ฝน",
        "ฝนตก",
        "ฝนตกไหม",
        "ที่ไหนฝนตก",
        "อุณหภูมิ",
        "ลม",
        "ลมแรง",
        "ร้อน",
        "หนาว",
        "จังหวัดไหนฝนตก",
        "อากาศวันนี้",
        "สภาพอากาศวันนี้",
      ],
      toolPattern: /tmdTool/i,
      priority: "high",
      category: "weather",
    },
    // NEW: Session 8.8 Tools - Data Access & Advanced Calculation
    {
      keywords: ["archive", "หนังสือ", "เพลง", "วิดีโอ", "dataset", "archive.org", "ค้นหาหนังสือ"],
      toolPattern: /archive/i,
      priority: "high",
      category: "data_access",
    },
    {
      keywords: ["nasa", "apod", "ดาราศาสตร์", "ดาว", "อวกาศ", "ภาพดาว", "astronomy"],
      toolPattern: /nasa/i,
      priority: "high",
      category: "data_access",
    },
    {
      keywords: ["พยากรณ์อากาศ", "forecast", "พรุ่งนี้ฝนตก", "อากาศพรุ่งนี้", "current weather"],
      toolPattern: /weather/i,
      priority: "high",
      category: "weather_api",
    },
    {
      keywords: ["gdp", "population", "ประชากร", "เศรษฐกิจ", "inflation", "world bank"],
      toolPattern: /worldbank/i,
      priority: "medium",
      category: "data_access",
    },
    {
      keywords: ["census", "government data", "ข้อมูลภาครัฐ", "data.gov"],
      toolPattern: /govdata/i,
      priority: "medium",
      category: "data_access",
    },
    {
      keywords: ["อนุพันธ์", "ปริพันธ์", "derivative", "integrate", "simplify", "factor"],
      toolPattern: /newton/i,
      priority: "high",
      category: "calculation_fast",
    },
    {
      keywords: ["ค่าเฉลี่ย", "mean", "median", "std", "สถิติ", "แปลงหน่วย", "convert"],
      toolPattern: /calculatorTool/i,
      priority: "high",
      category: "calculation_fast",
    },
    {
      keywords: ["ระบบ webd", "webd", "ผิดกฎหมาย", "คำสั่งศาล", "url", "โดเมน", "เว็บไซต์ผิดกฎหมาย"],
      toolPattern: /webdTool/i,
      priority: "high",
      category: "webd",
    },
    {
      keywords: ["กราฟ", "chart", "graph", "echarts", "visualize", "แผนภูมิ", "สร้างกราฟ"],
      toolPattern: /echartsTool/i,
      priority: "high",
      category: "visualization",
    },
  ];

  constructor(ollama: Ollama, ollamaModel: string, config?: {
    aiMode?: 'local' | 'remote' | 'hybrid';
    localOllama?: Ollama;
    remoteOllama?: Ollama;
    localModel?: string;
    remoteModel?: string;
  }) {
    super();
    this.ollama = ollama;
    this.ollamaModel = ollamaModel;
    this.ajv = new Ajv({ allErrors: true });
    
    // Multi-AI configuration
    if (config) {
      this.aiMode = config.aiMode || 'local';
      this.localOllama = config.localOllama || null;
      this.remoteOllama = config.remoteOllama || null;
      this.localModel = config.localModel || ollamaModel;
      this.remoteModel = config.remoteModel || ollamaModel;
    } else {
      this.aiMode = 'local';
      this.localModel = ollamaModel;
    }

    // Register Local Tools
    this.registerLocalTool(EVIDENCE_TOOL_DEF, handleEvidenceTool);
    this.registerLocalTool(THAI_GEO_TOOL_DEF, handleThaiGeoTool);
    this.registerLocalTool(SYSTEM_STATUS_TOOL_DEF, handleSystemStatusTool);
  }


  /**
   * Register a local tool handler
   */
  private registerLocalTool(toolDef: MCPTool, handler: Function) {
      const wrapperName = `local-tools:${toolDef.name}`;
      // Important: selection pipeline returns MCPTool.name, while execution expects the qualified key
      // format `clientName:toolName`. Keep them aligned to avoid `Client <tool> not found`.
      const qualifiedToolDef: MCPTool = {
        ...toolDef,
        name: wrapperName,
      };
      this.tools.set(wrapperName, qualifiedToolDef);
      this.localHandlers.set(wrapperName, handler);
      console.log(`[MCP Client] Registered local tool: ${wrapperName}`);
  }

  // ========================================
  // OLLAMA CHAT WRAPPER
  // ========================================

  /**
   * เลือก AI ที่เหมาะสมตาม task type และ AI mode
   * 
   * Task Types:
   * - fast: Tool selection, tokenization, classification (ใช้ local)
   * - accurate: Final response, complex reasoning (ใช้ remote)
   * - balanced: ปกติ (ใช้ตาม mode)
   */
  private selectAI(taskType: 'fast' | 'accurate' | 'balanced' = 'balanced'): {
    ollama: Ollama;
    model: string;
    aiType: 'local' | 'remote';
  } {
    // Local mode: ใช้ local เสมอ
    if (this.aiMode === 'local') {
      return {
        ollama: this.ollama,
        model: this.ollamaModel,
        aiType: 'local',
      };
    }
    
    // Remote mode: ใช้ remote เสมอ (fallback to local)
    if (this.aiMode === 'remote') {
      if (this.remoteOllama) {
        return {
          ollama: this.remoteOllama,
          model: this.remoteModel,
          aiType: 'remote',
        };
      }
      // Fallback to local
      return {
        ollama: this.ollama,
        model: this.ollamaModel,
        aiType: 'local',
      };
    }
    
    // Hybrid mode: เลือกตาม task type
    if (this.aiMode === 'hybrid') {
      // Fast tasks → Local AI
      if (taskType === 'fast' && this.localOllama) {
        return {
          ollama: this.localOllama,
          model: this.localModel,
          aiType: 'local',
        };
      }
      
      // Accurate tasks → Remote AI
      if (taskType === 'accurate' && this.remoteOllama) {
        return {
          ollama: this.remoteOllama,
          model: this.remoteModel,
          aiType: 'remote',
        };
      }
      
      // Balanced or fallback → prefer remote
      if (this.remoteOllama) {
        return {
          ollama: this.remoteOllama,
          model: this.remoteModel,
          aiType: 'remote',
        };
      }
      if (this.localOllama) {
        return {
          ollama: this.localOllama,
          model: this.localModel,
          aiType: 'local',
        };
      }
    }
    
    // Default fallback
    return {
      ollama: this.ollama,
      model: this.ollamaModel,
      aiType: 'local',
    };
  }

  private async chatWithOllama(messages: any[], options?: any, taskType: 'fast' | 'accurate' | 'balanced' = 'balanced'): Promise<any> {
    const startTime = Date.now();
    const { ollama, model, aiType } = this.selectAI(taskType);
    
    logger.info(`Starting chatWithOllama`, { aiType: aiType.toUpperCase(), taskType, model });

    try {
      // Ensure messages is an array and prepend SYSTEM_PROMPT if no system role provided
      if (!Array.isArray(messages)) messages = [];
      const hasSystemRole = messages.some(
        (m: any) => m && (m.role === "system" || m.name === "system")
      );
      if (!hasSystemRole) {
        messages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
      }

      logger.info(`Calling ollama.chat`, { model, aiType, options: JSON.stringify(options || {}) });
      const response = await ollama.chat({
        model: model,
        messages,
        stream: false,
        keep_alive: '30m',
        options: options || {},
      });

      const duration = Date.now() - startTime;
      
      // Track performance
      if (process.env.ENABLE_PERFORMANCE_METRICS === 'true') {
        this.performanceMetrics.set(`chat_${Date.now()}`, {
          aiUsed: aiType,
          duration,
          timestamp: Date.now(),
        });
      }
      
      // Performance warning for slow responses
      if (duration > 5000) {
        logger.warn(`⚠️ SLOW AI RESPONSE`, { 
          aiType, 
          duration, 
          taskType, 
          model,
          threshold: '5000ms',
          options: JSON.stringify(options || {})
        });
      } else {
        logger.info(`⚡ AI Response received`, { aiType, duration, taskType });
      }

      if (response && response.message) return response;

      console.warn(
        "[MCP Client] Ollama returned unexpected response, trying stream fallback"
      );
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorStr = String(err);
      const isTimeout = duration > 120000 || errorStr.toLowerCase().includes('timeout') || errorStr.includes('524');
      
      console.warn(
        `[MCP Client] ${aiType} AI failed (${duration}ms)${isTimeout ? ' [TIMEOUT]' : ''}, attempting fallback:`,
        errorStr
      );
      
      // Hybrid/Remote mode: fallback to local on error or timeout
      if ((this.aiMode === 'hybrid' || this.aiMode === 'remote') && 
          aiType === 'remote' && 
          this.localOllama) {
        
        const shouldFallback = 
          process.env.FALLBACK_TO_LOCAL_ON_ERROR === 'true' || 
          (isTimeout && process.env.FALLBACK_TO_LOCAL_ON_TIMEOUT === 'true') ||
          taskType === 'fast';
        
        if (shouldFallback) {
          try {
            const fallbackResponse = await this.localOllama.chat({
              model: this.localModel,
              messages,
              stream: false,
              keep_alive: '30m',
              options: options || {},
            });
            
            if (fallbackResponse && fallbackResponse.message) {
              return fallbackResponse;
            }
          } catch (fallbackErr) {
            console.error('[MCP Client] Fallback also failed:', fallbackErr);
          }
        }
      }
    }

    // Streaming fallback
    try {
      const stream = await ollama.chat({
        model: model,
        messages,
        stream: true,
        keep_alive: '30m',
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
    this.clientConfigs = configs; // Store configs for reconnection
    
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

        this.emit("clientConnected", config.name);
        await this.loadToolsFromClient(config.name, client);
      } catch (error) {
        console.error(
          `[MCP Client] Failed to connect to ${config.name}:`,
          error
        );
      }
    }
    
    // Start health check monitoring after initial connection
    this.startHealthCheck();
  }

  private async loadToolsFromClient(clientName: string, client: Client) {
    try {
      const toolsList = await client.listTools();

      for (const tool of toolsList.tools) {
        const mcpTool: MCPTool = {
          // Important: selection pipeline returns MCPTool.name, while execution expects the qualified key
          // format `clientName:toolName`. Keep them aligned to avoid `Client <tool> not found`.
          name: `${clientName}:${tool.name}`,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
          category: this.categorizeTools(tool.name, tool.description),
          keywords: await this.extractKeywords(tool.name, tool.description),
          examples: this.generateExamples(tool.name, tool.description),
        };

        this.tools.set(`${clientName}:${tool.name}`, mcpTool);
        // Individual tool logs removed for cleaner startup
      }
      
      // ✅ Invalidate cache when tools change
      this.toolsCacheInvalidated = true;
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
      // Silent - most servers don't support listResources
    }
  }

  // ========================================
  // TOOL CATEGORIZATION & KEYWORD EXTRACTION
  // ========================================

  private categorizeTools(name: string, description?: string): string {
    const text = `${name} ${description || ""}`.toLowerCase();

    const categories: { category: string; keywords: string[] }[] = [
      // ---------------------------------------------------------
      // 1. Data & Storage (Updated for Vector & Modern DBs)
      // ---------------------------------------------------------
      {
        category: "database",
        keywords: [
          // General
          "database", "db", "sql", "nosql", "query", "crud", "schema",
          // Modern 2026 Terms
          "vector", "embedding", "migration", "transaction", "redis", "postgres", "mongo", "prisma",
          // Thai
          "ฐานข้อมูล", "ดาต้าเบส", "คิวรี", "ดึงข้อมูล", "บันทึกข้อมูล", "อัปเดตข้อมูล", "ลบข้อมูล",
          "ค้นหาข้อมูลเก่า", "เก็บลงถัง", "ตารางข้อมูล", "เก็บ log", "สำรองข้อมูล"
        ],
      },
      {
        category: "file",
        keywords: [
          // Formats & Actions
          "file", "read", "write", "upload", "download", "stream", "buffer",
          "csv", "json", "pdf", "excel", "xlsx", "txt", "markdown", "log file",
          "s3", "blob", "storage",
          // Thai
          "ไฟล์", "อ่านไฟล์", "เขียนไฟล์", "จัดการไฟล์", "เปิดไฟล์", "บันทึกไฟล์",
          "แนบไฟล์", "แปลงไฟล์", "ดึงไฟล์", "เอกสาร", "อัปโหลด", "ดาวน์โหลด", "แตกไฟล์"
        ],
      },

      // ---------------------------------------------------------
      // 2. Connectivity & Integration
      // ---------------------------------------------------------
      {
        category: "api",
        keywords: [
          // Protocols
          "api", "http", "https", "rest", "graphql", "grpc", "websocket", "webhook",
          // Actions
          "request", "fetch", "axios", "get", "post", "put", "patch", "delete",
          "endpoint", "token", "auth", "header", "payload",
          // Thai
          "เรียก api", "ยิง api", "ส่งคำขอ", "รับข้อมูล", "เชื่อมต่อ", "เว็บเซอร์วิส",
          "ดึง json", "ส่ง request", "เชื่อมระบบ", "เกตเวย์"
        ],
      },
      {
        category: "webd", // Security & Domain
        keywords: [
          "webd", "domain", "dns", "ssl", "cert", "whois", "url",
          "violation", "phishing", "malware", "firewall", "security scan",
          // Thai
          "โดเมน", "เว็บไซต์", "เว็บผิดกฎหมาย", "บล็อกเว็บ", "ตรวจสอบโดเมน",
          "สแกนเว็บ", "ความปลอดภัยเว็บ", "เช็ค url", "เว็บพนัน", "เว็บปลอม"
        ],
      },

      // ---------------------------------------------------------
      // 3. Logic, Math & Data Science
      // ---------------------------------------------------------
      {
        category: "computation",
        keywords: [
          "math", "calc", "compute", "formula", "logic", "algorithm",
          "convert", "currency", "unit", "geometry", "trigonometry",
          // Thai
          "คำนวณ", "คณิตศาสตร์", "คิดเลข", "หาค่า", "บวก", "ลบ", "คูณ", "หาร",
          "แก้สมการ", "แปลงหน่วย", "คำนวณเงิน", "หาพื้นที่", "สูตร"
        ],
      },
      {
        category: "statistics",
        keywords: [
          "stats", "analysis", "analytics", "mean", "median", "mode",
          "count", "sum", "average", "percent", "ratio", "trend", "correlation",
          "pivot", "aggregate", "group by",
          // Thai
          "สถิติ", "วิเคราะห์ข้อมูล", "นับจำนวน", "ยอดรวม", "เฉลี่ย", "ร้อยละ", "เปอร์เซ็นต์",
          "แนวโน้ม", "สรุปยอด", "จัดกลุ่มข้อมูล", "เปรียบเทียบข้อมูล"
        ],
      },

      // ---------------------------------------------------------
      // 4. Intelligence & AI (NEW - Critical for 2026)
      // ---------------------------------------------------------
      {
        category: "ai_ml",
        keywords: [
          "ai", "llm", "gpt", "model", "prompt", "inference",
          "nlp", "ocr", "vision", "detect", "classify",
          "summarize", "generate", "sentiment", "translate", "rag",
          // Thai
          "เอไอ", "ปัญญาประดิษฐ์", "สรุปความ", "แปลภาษา", "เจนภาพ", "วิเคราะห์ภาพ",
          "ดึงข้อความจากภาพ", "โอซีอาร์", "แต่งประโยค", "วิเคราะห์อารมณ์", "บอท"
        ],
      },

      // ---------------------------------------------------------
      // 5. System & DevOps (NEW - Critical for Backend)
      // ---------------------------------------------------------
      {
        category: "devops",
        keywords: [
          "server", "docker", "k8s", "kubernetes", "container", "pod",
          "log", "monitor", "cpu", "memory", "disk", "usage",
          "deploy", "restart", "shutdown", "ping", "ssh", "shell", "bash",
          // Thai
          "เซิร์ฟเวอร์", "ระบบ", "เช็คสถานะ", "ดู log", "รีสตาร์ท", "ปิดเครื่อง",
          "ทรัพยากร", "แรม", "ซีพียู", "พื้นที่ดิสก์", "ดีพลอย", "รันคำสั่ง"
        ],
      },

      // ---------------------------------------------------------
      // 6. External World & Visualization
      // ---------------------------------------------------------
      {
        category: "datetime",
        keywords: [
          "time", "date", "datetime", "timestamp", "timezone", "utc",
          "schedule", "cron", "timer", "duration", "calendar",
          // Thai
          "เวลา", "วันที่", "วันเวลา", "นาฬิกา", "จับเวลา", "ตารางงาน",
          "วันนี้", "พรุ่งนี้", "เมื่อวาน", "ปีหน้า", "เดือนนี้", "นัดหมาย"
        ],
      },
      {
        category: "weather",
        keywords: [
          "weather", "forecast", "temp", "humidity", "wind", "pressure",
          "aqi", "pm2.5", "uv", "rain", "storm", "tmd", "seismic", "earthquake",
          "nwp", "daily", "hourly", "location", "province", "region",
          // Thai - General
          "อากาศ", "พยากรณ์", "สภาพอากาศ", "ฝนตก", "อุณหภูมิ", "ร้อน", "หนาว",
          "ฝุ่น", "pm2.5", "คุณภาพอากาศ", "กรมอุตุ", "พายุ", "น้ำท่วม",
          "แผ่นดินไหว", "เตือนภัย", "สถานี", "ฝนสะสม", "ปริมาณฝน",
          // Thai - NWP Specific (NEW)
          "พยากรณ์ล่วงหน้า", "วันข้างหน้า", "ชั่วโมงข้างหน้า", "ชม.ข้างหน้า",
          "รายชั่วโมง", "รายวัน", "ล่วงหน้า", "ข้างหน้า", "สัปดาห์หน้า",
          "อุณหภูมิสูงสุด", "อุณหภูมิต่ำสุด", "ฝนจะตก", "ฝนจะตกไหม", "เมื่อไหร่",
          // Thai - Time-based (Hourly)
          "12 ชั่วโมง", "12 ชม.", "24 ชั่วโมง", "24 ชม.", "48 ชั่วโมง", "48 ชม.",
          "36 ชั่วโมง", "36 ชม.", "ทุกชั่วโมง", "รายชม.", "ชม.ข้างหน้า",
          // Thai - Time-based (Daily)
          "3 วัน", "5 วัน", "7 วัน", "10 วัน", "14 วัน", "สัปดาห์", "สัปดาห์หน้า",
          "วันข้างหน้า", "รายวัน", "ต่อวัน", "เดือนหน้า",
          // Thai - Temperature Specific
          "อุณหภูมิสูงสุด-ต่ำสุด", "อุณหภูมิสูง", "อุณหภูมิต่ำ", "อุณหภูมิเฉลี่ย",
          "ร้อนสุด", "เย็นสุด", "หนาวสุด", "ความชื้น", "ความชื้นสัมพัทธ์",
          // Thai - Rain Specific
          "ฝนตก", "ฝนจะตก", "ฝนจะตกไหม", "ปริมาณฝน", "ฝนสะสม", "โอกาสฝน",
          "เปอร์เซ็นต์ฝน", "ฝนหนัก", "ฝนตกหนัก", "พายุฝน", "ฟ้าคะนอง",
          // Thai - Coordinate/Location Indicators
          "lat=", "lon=", "latitude", "longitude", "พิกัด", "ละติจูด", "ลองจิจูด",
          "เส้นรุ้ง", "เส้นแวง", "พิกัดที่", "ที่พิกัด",
          // Thai - Regions (NEW)
          "ภาคเหนือ", "ภาคใต้", "ภาคกลาง", "ภาคตะวันออก", "ภาคตะวันตก",
          "ภาคตะวันออกเฉียงเหนือ", "อีสาน", "ภาคอีสาน",
          "เหนือ", "ใต้", "กลาง", "ตะวันออก", "ตะวันตก",
          // Thai - Provinces
          "กรุงเทพ", "กรุงเทพฯ", "เชียงใหม่", "เชียงราย", "ภูเก็ต", "ขอนแก่น",
          "นครราชสีมา", "โคราช", "หาดใหญ่", "สงขลา", "อุบลราชธานี", "อุดร",
          "จังหวัด", "อำเภอ", "ตำบล", "lat", "lon", "ละติจูด", "ลองจิจูด"
        ],
      },
      {
        category: "visualization",
        keywords: [
          "chart", "graph", "plot", "dashboard", "diagram", "canvas",
          "bar", "line", "pie", "scatter", "heatmap", "render",
          // Thai
          "กราฟ", "แผนภูมิ", "พล็อตกราฟ", "สร้างชาร์ต", "แดชบอร์ด",
          "กราฟแท่ง", "กราฟวงกลม", "กราฟเส้น", "แสดงผลข้อมูล", "วาดภาพ"
        ],
      },
      {
        category: "news",
        keywords: [
          "news", "headline", "article", "feed", "rss",
          "crypto", "stock", "market", "politic", "tech",
          // Thai
          "ข่าว", "ข่าวสาร", "ข่าววันนี้", "ข่าวล่าสุด", "ข่าวด่วน",
          "ข่าวหุ้น", "ข่าวคริปโต", "สถานการณ์", "ประเด็นร้อน"
        ],
      },

      // ---------------------------------------------------------
      // 7. Communication & Social (NEW - Essential for Thailand)
      // ---------------------------------------------------------
      {
        category: "communication",
        keywords: [
          "email", "mail", "smtp", "sendgrid",
          "sms", "otp", "notification", "alert",
          "line", "line notify", "slack", "discord", "telegram", "message",
          // Thai
          "อีเมล", "ส่งเมล", "ส่งข้อความ", "แจ้งเตือน", "ไลน์", "ส่งไลน์",
          "ส่ง sms", "ติดต่อ", "แชท", "บรอดแคสต์"
        ],
      },
      {
        category: "search",
        keywords: [
          "search", "google", "bing", "serp", "crawl", "scrape",
          "find", "lookup", "research", "wiki",
          // Thai
          "ค้นหา", "เสิร์ช", "หาข้อมูล", "กูเกิล", "สืบค้น", "หาความรู้"
        ],
      }
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

    // Use cached tokenization
    const allTokens = await this.tokenizeThaiWithOllama(text);

    const englishWords = allTokens.filter((token) => /^[a-z]{3,}$/i.test(token));
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
      (w) => !englishStopWords.includes(w.toLowerCase())
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
      return ["สร้างกราฟ", "สร้างกราฟแท่ง", "สร้างกราฟวงกลม"];
    }

    return ["ตัวอย่างการใช้งาน"];
  }

  // ========================================
  // NEW: TOOL CHAINING LOGIC
  // ========================================

  /**
   * ตรวจสอบว่าผู้ใช้ขอใช้ tool chaining หรือไม่
   * ใช้ chaining เฉพาะเมื่อผู้ใช้ขอเป็นข้อๆ หรือใช้คำว่า "แล้ว", "จากนั้น"
   */
  private shouldUseChaining(userMessage: string): boolean {
    const message = userMessage.toLowerCase().trim();

    // ตรวจสอบคำว่า "แล้ว", "จากนั้น"
    const chainingKeywords = ["แล้ว", "จากนั้น", "then", "after that"];
    if (chainingKeywords.some((keyword) => message.includes(keyword))) {
      return true;
    }

    // ตรวจสอบเป็นข้อๆ (bullet points หรือ numbering)
    const bulletPatterns = [
      /^\d+\./m, // 1. 2. 3.
      /^-\s/m, // - item
      /^\*\s/m, // * item
      /^[a-z]\)/m, // a) b) c)
      /^[A-Z]\)/m, // A) B) C)
    ];

    if (bulletPatterns.some((pattern) => pattern.test(message))) {
      return true;
    }

    // ตรวจสอบว่ามีหลายประโยคและมี connector
    const sentences = message
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length > 1) {
      const connectors = ["และ", "แล้ว", "จากนั้น", "ต่อมา", "หลังจากนั้น"];
      if (connectors.some((connector) => message.includes(connector))) {
        return true;
      }
    }

    return false;
  }

  /**
   * วิเคราะห์ว่าคำถามต้องใช้ tool chaining หรือไม่
   * และวางแผนลำดับการใช้ tools
   */
  private async planToolChain(
    userMessage: string,
    selectedTools: string[]
  ): Promise<ToolChainPlan | null> {
    return await ToolChainingEngine.planToolChain(
      userMessage,
      selectedTools,
      this.tools,
      (messages, options) => this.chatWithOllama(messages, options),
      this.extractJsonFromText.bind(this)
    );
  }

  /**
   * Classify ประเภทของข้อความและตรวจสอบว่าตอบได้ทันทีหรือไม่
   * 
   * ข้อมูลที่ต้องใช้ tools:
   * - ข้อมูลชิงสถิติ (statistics)
   * - จำนวนรายการ (count/number)
   * - สภาพอากาศ/พยากรณ์อากาศ (weather/forecast)
   * - ข่าวสาร (news)
   */
  private async classifyMessageType(
    userMessage: string
  ): Promise<MessageClassification> {
    try {
      // ตรวจสอบแบบ local ก่อน
      const quickCheck = this.quickClassifyMessage(userMessage);
      if (quickCheck) {
        logger.info(`Quick classified message`, { 
          type: quickCheck.type, 
          canAnswerDirectly: quickCheck.canAnswerDirectly,
          confidence: quickCheck.confidence 
        });
        return quickCheck;
      }

      const prompt = `วิเคราะห์ประเภทของข้อความนี้อย่างแม่นยำ และตอบเป็น JSON เท่านั้น

ข้อความ: "${userMessage}"

ประเภท:
- greeting: การทักทาย (สวัสดี, hello, hi) ไม่มีคำถามหรือคำสั่งอื่น
- general_question: คำถามทั่วไป (คุณคือใคร, ทำไง, อธิบาย) ที่ไม่ต้องใช้ tools
- calculation_request: คำขอคำนวณ (มีตัวเลขและเครื่องหมาย +,-,*,/,^) หรือ factorial (!!,!)
- datetime_request: ถามเวลา/วันที่ (กี่โมง, วันนี้, เวลา, taskbar)
- weather_request: ถามอากาศ (อากาศ, อุณหภูมิ, ฝน, weather)
- data_request: ถามข้อมูล/สถิติ (webd, จำนวน, สถิติ, ip)
- unknown: ไม่ทราบ

กฎสำคัญ:
1. greeting → ต้องเป็นการทักทายอย่างเดียว ไม่มีคำถามหรือคำสั่งอื่น
2. calculation_request → ต้องมีตัวเลขหรือสูตรคณิตศาสตร์ชัดเจน
3. ถ้าสงสัย → เลือก general_question แทน action_request
4. ตอบ JSON: {"type": "...", "canAnswerDirectly": true/false, "confidence": 0.9}

ตัวอย่าง:
- "สวัสดี" → {"type":"greeting","canAnswerDirectly":true,"confidence":0.95}
- "สวัสดี นายคือใคร" → {"type":"general_question","canAnswerDirectly":true,"confidence":0.9}
- "21+12" → {"type":"calculation_request","canAnswerDirectly":false,"confidence":0.95}
- "ตอนนี้กี่โมง" → {"type":"datetime_request","canAnswerDirectly":false,"confidence":0.95}
- "ไทยอากาศ" → {"type":"weather_request","canAnswerDirectly":false,"confidence":0.9}
- "webd สถิติ" → {"type":"data_request","canAnswerDirectly":false,"confidence":0.9}

JSON:`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { 
          temperature: 0.1,
          num_predict: 80,  // 🔥 เพิ่มจาก 25→80 เพื่อให้ JSON ครบ
          num_ctx: 256,     // 🔥 เพิ่ม context จาก 128→256
          num_gpu_layers: 50,
          num_thread: 8,
          top_p: 0.9,
          top_k: 20,
        },
        'fast'
      );

      const rawText = String(response?.message?.content || "").trim();
      console.log(`[Classify] Raw response length: ${rawText.length} chars`);
      
      const extracted = this.extractJsonFromText(rawText);
      const jsonStr = extracted || rawText;
      
      console.log(`[Classify] Extracted JSON: ${jsonStr.substring(0, 100)}...`);

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(`[Classify] JSON parse failed. Raw text preview: ${rawText.substring(0, 200)}`);
        console.error(`[Classify] JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        
        // 🔥 FALLBACK: ถ้า JSON ไม่ครบ ให้ตรวจจับ type จาก partial text
        const partialTypeMatch = rawText.match(/"type"\s*:\s*"([^"]+)"/);
        if (partialTypeMatch) {
          const detectedType = partialTypeMatch[1];
          
          // Type guard: ตรวจสอบว่า detectedType เป็น valid MessageType
          const validTypes = ['greeting', 'general_question', 'action_request', 'calculation_request', 'datetime_request', 'weather_request', 'data_request', 'unknown'];
          const isValidType = validTypes.includes(detectedType);
          
          if (isValidType) {
            console.warn(`[Classify] Detected partial type from incomplete JSON: ${detectedType}`);
            return {
              type: detectedType as any,  // Type assertion
              canAnswerDirectly: detectedType === 'greeting' || detectedType === 'general_question',
              confidence: 0.6,  // ลดความเชื่อมั่นเพราะ JSON ไม่สมบูรณ์
            };
          }
        }
        
        // ถ้าหาไม่เจอ fallback เป็น unknown
        console.warn("[Classify] Cannot extract type from incomplete JSON, using unknown");
        return {
          type: "unknown",
          canAnswerDirectly: false,
          confidence: 0.1,
        };
      }

      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.type &&
        typeof parsed.canAnswerDirectly === "boolean"
      ) {
        console.log(
          `[Classify] Classified as: ${parsed.type}, canAnswerDirectly: ${
            parsed.canAnswerDirectly
          }, confidence: ${parsed.confidence || 0}`
        );
        return {
          type: parsed.type,
          canAnswerDirectly: parsed.canAnswerDirectly,
          confidence: parsed.confidence || 0.5,
        };
      }

      // Fallback
      console.warn("[Classify] Failed to parse classification, using fallback");
      return {
        type: "unknown",
        canAnswerDirectly: false,
        confidence: 0.1,
      };
    } catch (error) {
      console.error("[Classify] Error classifying message:", error);
      logger.error("MCP classification error", { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      });
      return {
        type: "unknown",
        canAnswerDirectly: false,
        confidence: 0.1,
      };
    }
  }

  /**
   * ตรวจสอบแบบ local ก่อนเรียก AI
   * เพื่อให้ตรวจจับ queries ที่ต้องใช้ tools ได้เร็ว
   */
  private quickClassifyMessage(
    userMessage: string
  ): MessageClassification | null {
    const msg = userMessage.toLowerCase().trim();

    // ===== ULTRA FAST: คำทักทายสั้นๆ (ตอบทันที ไม่ต้อง classify ต่อ) =====
    // คำทักทายอย่างเดียว หรือสั้นมาก (≤15 ตัวอักษร)
    if (msg.length <= 15) {
      const ultraShortGreetings = [
        /^(สวัสดี|หวัดดี|hi|hello|hey|ทักทาย)[\s\!\?]*$/i,
        /^(สวัสดี|hello|hi)[\s\!\?]+$/i,
      ];
      
      if (ultraShortGreetings.some((p) => p.test(msg))) {
        return {
          type: "greeting",
          canAnswerDirectly: true,
          confidence: 0.98,
        };
      }
    }
    
    // ===== FAST: Greeting + คำถามง่ายๆ (≤30 ตัวอักษร) =====
    if (msg.length <= 30) {
      const shortGreetingWithQuestion = [
        /^(สวัสดี|hello|hi).*(?:คือใคร|ชื่ออะไร|เป็นใคร|who are you)/i,
        /^(สวัสดี|hello|hi).*(?:ช่วย|help|สบายดี)/i,
      ];
      
      // ตรวจสอบว่าไม่มี action keywords
      const hasActionKeywords = 
        /(?:กี่โมง|เวลา|วันที่|อากาศ|คำนวณ|สถิติ|ค้นหา|gdp|archive|nasa)/i.test(msg) ||
        /\d+[\+\-\*\/\×\÷\^]/.test(msg);
      
      if (shortGreetingWithQuestion.some((p) => p.test(msg)) && !hasActionKeywords) {
        return {
          type: "greeting",
          canAnswerDirectly: true,
          confidence: 0.95,
        };
      }
    }

    // ===== TODO 1 FIX: Check GREETING FIRST (highest priority) =====
    // Greeting patterns - เช็คก่อนสุด (ถ้าไม่ใช่ action request)
    // เฉพาะคำทักทายอย่างเดียว หรือมีคำถามง่ายๆ ต่อท้าย
    const greetingOnlyPatterns = [
      /^(สวัสดี|สวัสดีค่ะ|สวัสดีครับ|หวัดดี|ทักทาย|hello|hi|hey|good morning|good evening)[\s\!]*$/i,
    ];
    
    // ===== CRITICAL FIX: ตรวจสอบว่ามี action keywords หรือไม่ =====
    // ถ้ามี greeting แต่มี datetime/calculation/weather → ต้องใช้ tools!
    const hasActionKeywords = 
      /(?:กี่โมง|เวลา|วันที่|พรุ่งนี้|อากาศ|ฝน|ร้อน|หนาว|คำนวณ|หาร|คูณ|แปลง|เฉลี่ย|ดึงข้อมูล|สถิติ|ค้นหา|สร้างกราฟ|gdp|archive|nasa|อวกาศ)/i.test(msg) ||
      /\d+[\+\-\*\/\×\÷\^]/.test(msg) || // มีการคำนวณ
      /\d+!!?/.test(msg); // factorial
    
    // Greeting + simple identity question (ไม่มี action keywords)
    const greetingWithIdentityQuestion = [
      /^(สวัสดี|hello|hi).*(?:คือใคร|ชื่ออะไร|เป็นใคร|who are you|เป็นยังไง|สบายดี)/i,
    ];
    
    if (greetingOnlyPatterns.some((p) => p.test(msg))) {
      return {
        type: "greeting",
        canAnswerDirectly: true,
        confidence: 0.95,
      };
    }
    
    // ถ้ามี greeting + action keywords → ไม่ถือว่า "can answer directly"
    if (greetingWithIdentityQuestion.some((p) => p.test(msg)) && !hasActionKeywords) {
      return {
        type: "general_question",
        canAnswerDirectly: true,
        confidence: 0.9,
      };
    }
    
    // ถ้ามี greeting + action keywords → ต้องดูว่าเป็น action อะไร
    if (/^(สวัสดี|hello|hi)/i.test(msg) && hasActionKeywords) {
      // ไม่ return ตรงนี้ ให้ไปเช็ค action patterns ด้านล่างต่อ
    }

    // DateTime patterns - ต้องเช็คหลังจาก greeting เพราะอาจมี "สวัสดี" นำหน้า
    const dateTimePatterns = [
      // กี่โมง queries
      /กี่โมง/i,
      /ตอนนี้.*(?:เวลา|time)/i,
      /เวลา.*(?:เท่าไร|อะไร|ตอนนี้)/i,
      
      // วันที่ queries
      /วันที่.*(?:เท่าไร|เท่าไหร่|อะไร|กี่)/i,
      /(?:วันนี้|พรุ่งนี้|เมื่อวาน).*วันที่/i,
      
      // Combined patterns (คำถามที่ซับซ้อนกว่า)
      /(?:ตอนนี้|เดี๋ยวนี้|ปัจจุบัน|ขณะนี้).*(?:กี่โมง|เวลา|วันที่)/i,
      /(?:วันนี้|พรุ่งนี้|เมื่อวาน).*(?:วันที่|เท่าไร|กี่|เดือน|ปี)/i,
      
      // English patterns
      /what.*time|current.*time|time.*now/i,
      /what.*date|current.*date|today.*date/i,
      /taskbar.*เวลา|เครื่อง.*เวลา|window.*เวลา/i,
    ];
    if (dateTimePatterns.some((p) => p.test(msg))) {
      console.log('[Quick Classify] ✅ DateTime pattern detected');
      return {
        type: "action_request", // ต้องใช้ dateTimeTool
        canAnswerDirectly: false,
        confidence: 0.95,
      };
    }

    // Calculation patterns - ต้องใช้ calculatorTool (เช็คเข้มงวด)
    const hasNumbers = /\d+/.test(msg);
    const hasMathSymbols = /[\+\-\*\/\×\÷\^]/.test(msg);
    const hasFactorial = /\d+!+/.test(msg); // 99!! หรือ 5!
    const hasMathKeywords = /(?:คำนวณ|หาร|คูณ|บวก|ลบ|ยกกำลัง|factorial|calculate|compute|หาค่า|แปลง|เฉลี่ย|average|convert)/i.test(msg);
    const hasEquation = /[=]/.test(msg); // มีสมการ
    
    // ต้องมีตัวเลข + (สัญลักษณ์คณิตศาสตร์ หรือ factorial หรือ keywords)
    const isCalculation = hasNumbers && (hasMathSymbols || hasFactorial || hasMathKeywords || hasEquation);
    
    if (isCalculation) {
      return {
        type: "action_request", // ต้องใช้ calculatorTool
        canAnswerDirectly: false,
        confidence: 0.95,
      };
    }

    // Action request patterns - ต้องใช้ tools อื่นๆ
    const actionPatterns = [
      // Statistics/สถิติ
      /ข้อมูลชิงสถิติ|สถิติ.*(?:จำนวน|นับ|รวม|เปอร์เซ็นต์)/i,
      /จำนวน(?:รายการ|เว็บ|ข้อมูล|การกระทำ|ผู้ใช้)/i,
      /นับ.*(?:จำนวน|ทั้งหมด)/i,

      // Weather/สภาพอากาศ - แยกเป็น simple patterns
      /พยากรณ์.*อากาศ|พยากรณ์อากาศ/i,
      /สภาพอากาศ|weather|forecast/i,
      /อากาศ.*(?:วันนี้|พรุ่งนี้|เมื่อวาน|เป็นอย่างไร|ยังไง)/i,
      /(?:วันนี้|พรุ่งนี้).*อากาศ/i,
      /(?:กรุงเทพฯ?|กรุงเทพมหานคร|bangkok).*(?:อากาศ|ร้อน|หนาว)/i,
      /อากาศ.*(?:ร้อน|หนาว).*(?:ไหม|มั้ย)/i,
      /ฝน|ลมแรง|อุณหภูมิ/i,

      // News/ข่าวสาร
      /ข่าวสาร|ข้อมูลข่าว|ข่าว.*(?:สาย|ใหม่|ล่าสุด)/i,
      /news|breaking/i,

      // Data queries
      /ดึงข้อมูล|ค้นหาข้อมูล|สร้างกราฟ|ประมวลผล/i,
      /webd.*(?:จำนวน|สถิติ|ข้อมูล)/i,
      
      // Search/Archive
      /ค้นหา.*(?:หนังสือ|เอกสาร|ข้อมูล).*(?:archive|internet|library)/i,
      /internet.*archive|archive.*search/i,
      
      // NASA/Space
      /ภาพ.*(?:อวกาศ|ดาว|ดวงจันทร์|ดวงอาทิตย์)|space.*(?:image|photo|picture)/i,
      /nasa|apod|astronomy/i,
      
      // World Bank/Economics  
      /gdp|ผลิตภัณฑ์.*(?:มวล|รวม)|เศรษฐกิจ.*(?:ไทย|ประเทศ)|world.*bank/i,
    ];

    if (actionPatterns.some((p) => p.test(msg))) {
      return {
        type: "action_request",
        canAnswerDirectly: false,
        confidence: 0.9,
      };
    }
    
    // ✅ NEW: General knowledge questions (no tools needed)
    const generalQuestionPatterns = [
      /(?:คืออะไร|หมายถึงอะไร|ความหมาย|คือ|ยังไง)/i,
      /(?:AI|ปัญญาประดิษฐ์|machine learning|deep learning|neural network).*(?:คือ|หมายถึง|ยังไง)/i,
      /(?:อธิบาย|บอก|แนะนำ).*(?:คือ|เกี่ยวกับ)/i,
      /(?:what is|who is|how does|explain|tell me about)/i,
    ];
    
    if (generalQuestionPatterns.some((p) => p.test(msg)) && !hasActionKeywords) {
      return {
        type: "general_question",
        canAnswerDirectly: true,
        confidence: 0.9,
      };
    }

    // ===== Greeting already checked at top - this is removed =====

    return null;
  }

  /**
   * สร้างคำตอบโดยตรงสำหรับข้อความที่ตอบได้ทันที
   */
  private async generateDirectResponse(
    userMessage: string,
    classification: MessageClassification
  ): Promise<string> {
    try {
      let prompt = "";

      if (classification.type === "greeting") {
        prompt = `ตอบคำทักทายนี้อย่างเป็นมิตรและเหมาะสม

ข้อความผู้ใช้: "${userMessage}"

ตอบสั้นๆ เป็นมิตร:`;
      } else if (classification.type === "general_question") {
        prompt = `ตอบคำถามทั่วไปนี้อย่างมีข้อมูลและเป็นมิตร

คำถาม: "${userMessage}"

ตอบเป็นภาษาไทย กระชับแต่ครบถ้วน:`;
      } else {
        prompt = `ตอบข้อความนี้อย่างเหมาะสม

ข้อความ: "${userMessage}"

ตอบ:`;
      }

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { 
          temperature: 0.5,
          num_predict: 150,
          num_ctx: 512,
          num_gpu_layers: 50,
          num_thread: 8,
        },
        'fast'
      );

      return String(response?.message?.content || "").trim();
    } catch (error) {
      console.error("[Direct] Error generating direct response:", error);
      return "ขออภัย เกิดข้อผิดพลาดในการสร้างคำตอบ";
    }
  }

  /**
   * Execute tool chain ตามแผนที่วางไว้
   */
  private async executeToolChain(
    plan: ToolChainPlan,
    userMessage: string
  ): Promise<ChainExecutionResult[]> {
    const results: ChainExecutionResult[] = [];
    const stepResults = new Map<number, any>();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const startTime = Date.now();

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
          }
        } else {
          const tool = this.tools.get(step.toolName);
          if (tool) {
            step.args = await this.generateToolArguments(tool, userMessage);
          }
        }

        // Execute tool with pre-generated args (create map)
        const argsMap: Record<string, any> = {};
        if (step.args) {
          argsMap[step.toolName] = step.args;
        }
        const toolResults = await this.executeTools(
          [step.toolName],
          userMessage,
          argsMap // ส่ง map แทน single object
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
    return ToolChainingEngine.createDependencyContext(
      userMessage,
      step,
      dependencyResults
    );
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

      // Extract parameter names from description if schema is empty
      let parameterHints = "";
      let exampleArgs = "";
      if (Object.keys(schema).length === 0 && tool.description) {
        parameterHints = this.extractParameterHintsFromDescription(tool.description);
        
        // Add examples for known tools
        if (tool.name === "calculatorTool") {
          exampleArgs = `\n📝 ตัวอย่าง: {"expression": "2+2"}`;
        } else if (tool.name === "echartsTool") {
          exampleArgs = `\n📝 ตัวอย่าง: {"type": "pie", "chatText": "A 10, B 20"}`;
        }
      }

      // สำหรับ echartsTool เพิ่มข้อมูลจากแชท
      let chatDataSuggestion = "";
      if (tool.name === "echartsTool") {
        const extractedData = this.extractChartDataFromHistory();
        if (extractedData) {
          chatDataSuggestion = `\n\nสำคัญ: มีข้อมูลจากแชทเก่า (${extractedData}) → ต้องส่งด้วย chatText parameter ในรูปแบบ: "${extractedData}"`;
        }
      }

      const prompt = `สร้าง parameters JSON สำหรับ tool โดยใช้ข้อมูลจาก context

ชื่อ Tool: ${tool.name}
คำอธิบาย Tool (อ่านให้ดี):
${tool.description || "ไม่มี"}
${parameterHints ? `\n📋 Parameters ที่ต้องมี:\n${parameterHints}` : ''}
${exampleArgs}

ข้อมูลจาก context (ใช้ข้อมูลนี้ในการสร้าง parameters):
${context}${chatDataSuggestion}
${schemaStr !== '{}' ? `\nSchema ของ tool:\n${schemaStr}` : ''}

Parameters ที่จำเป็น: ${required.length > 0 ? required.join(", ") : "ดูจาก description ข้างบน"}

🎯 กฎ:
1. ตอบเป็น JSON object เท่านั้น - ห้ามมีข้อความอื่น
2. สำหรับ calculatorTool: **ต้องมี expression field** - ดึงจาก context
3. สำหรับ echartsTool: ต้องส่ง type + (labels+datasets) หรือ chatText
4. ถ้ามีข้อมูลจากแชท echartsTool ใช้ chatText
5. ห้ามส่งผลลัพธ์ (result)
6. ห้ามตอบ {} ถ้า tool ต้องการ parameters

ตอบเฉพาะ JSON:
`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { 
          temperature: 0.3,
          num_predict: 50,
          num_ctx: 512,
          num_gpu_layers: 50,
          num_thread: 8,
          repeat_penalty: 1.0,
          keep_alive: '30m',
        },
        'fast'
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
      logger.error("MCP args generation error", { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      });
      return {};
    }
  }

  /**
   * Extract parameter hints from tool description
   */
  private extractParameterHintsFromDescription(description: string): string {
    const hints: string[] = [];
    
    // Look for "Parameter:" or "Parameters:" sections
    const paramMatch = description.match(/Parameters?:\s*\n([\s\S]*?)(?:\n\n|$)/i);
    if (paramMatch) {
      const paramSection = paramMatch[1];
      // Extract lines that start with - or •
      const lines = paramSection.split('\n').filter(line => /^[\s-•]/.test(line));
      hints.push(...lines.map(l => l.trim()));
    }
    
    // Special hints for known tools
    if (description.includes('calculatorTool') || description.includes('expression')) {
      hints.push('- expression (required): นิพจน์คณิตศาสตร์ที่ต้องการคำนวณ');
    }
    
    if (description.includes('echartsTool') || description.includes('กราฟ')) {
      hints.push('- type (required): ประเภทกราฟ (bar, line, pie)');
      hints.push('- labels (optional): array ของ label');
      hints.push('- datasets (optional): array ของข้อมูล');
      hints.push('- chatText (optional): ข้อมูลจากแชทในรูปแบบ "A 10, B 20"');
    }
    
    return hints.length > 0 ? hints.join('\n') : '';
  }

  /**
   * สร้าง enhanced context จาก chain results
   */
  private createChainContext(
    userMessage: string,
    chainResults: ChainExecutionResult[]
  ): string {
    return ToolChainingEngine.createChainContext(userMessage, chainResults);
  }

  // ========================================
  // MAIN PROCESS MESSAGE (WITH CHAINING)
  // ========================================

  /**
   * ประมวลผลข้อความจากผู้ใช้ พร้อม tool chaining เฉพาะเมื่อผู้ใช้ขอ
   */
  async processMessage(
    userMessage: string,
    semanticHint?: string, // 🧠 Optional semantic category from Semantic Router (hybrid mode only)
    options?: {
      uiMode?: string;
      boostedTools?: string[]; // e.g. ["evidenceTool", "webdTool"]
    }
  ): Promise<{
    needsTools: boolean;
    toolResults?: any[];
    enhancedContext?: string;
    toolsFailed?: boolean;
    usedChaining?: boolean;
    chainPlan?: ToolChainPlan;
    directResponse?: string;
  }> {
    const processStartTime = Date.now();
    
    logger.info(`Starting processMessage`, { 
      messageLength: userMessage.length,
      historySize: this.conversationHistory.length,
      semanticHint: semanticHint || 'none', // 🧠 Log semantic hint if provided
      uiMode: options?.uiMode || 'none'
    });

    // Classify message type ก่อน
    const classification = await this.classifyMessageType(userMessage);
    logger.info(`[Process] Classification result`, {
      type: classification.type,
      canAnswerDirectly: classification.canAnswerDirectly,
      confidence: classification.confidence
    });

    if (classification.canAnswerDirectly) {
      logger.info(`[Process] Can answer directly`, { type: classification.type, confidence: classification.confidence });
      const directResponse = await this.generateDirectResponse(
        userMessage,
        classification
      );
      logger.info(`[Process] ✅ Returning direct response (needsTools: false)`);
      return { needsTools: false, directResponse };
    }

    // เลือก tools - ใช้ direct pattern matching ก่อน AI (Fast Path)
    logger.info(`[Process] ⚠️ Cannot answer directly - will select tools`);
    
    // FAST PATH: Direct pattern matching (ไม่ต้องรอ AI)
    let selectedTools: string[] = [];
    const msg = userMessage.toLowerCase();
    
    // ===== PRIORITY 1: Complex queries (multiple tools) - เช็คก่อนเป็นอันดับแรก =====
    // ⚠️ DISABLED: Complex query detection bypasses Priority Boost (TODO #1-22)
    // Problem: "ตอนนี้ฝนตกไหม" has "ไหม" (connector) → wrongly selected weather tool
    // Solution: Let ALL queries go through selectTools() for proper NWP/TMD priority (+100/+60)
    /*
    const hasComplexConnector = /(?:แล้ว|จากนั้น|ต่อ|และ|พร้อม|ด้วย|หลังจากนั้น|ตามด้วย|รวมถึง)/.test(msg);
    if (hasComplexConnector) {
      const hasDateTime = /(?:กี่โมง|เวลา|วันที่|ตอนนี้|now|time)/.test(msg);
      const hasWeather = /(?:อากาศ|weather|ฝน|ร้อน|หนาว|พยากรณ์|อุณหภูมิ|เป็นอย่างไร|ยังไง)/.test(msg);
      const hasCalculator = /\d+.*[\+\-\*\/\×\÷\^]|(?:คำนวณ|calculate)/.test(msg);
      const hasNewton = /(?:อนุพันธ์|ปริพันธ์|derivative|integral)/.test(msg);
      
      // Collect all matching tools
      const multiTools: string[] = [];
      if (hasDateTime) multiTools.push("innomcp-server:dateTimeTool");
      if (hasWeather) multiTools.push("innomcp-server:weather");
      if (hasNewton) multiTools.push("innomcp-server:newton");
      else if (hasCalculator) multiTools.push("innomcp-server:calculatorTool");
      
      if (multiTools.length >= 2) {
        selectedTools = multiTools;
        logger.info(`[Process] ✅ Fast path matched: COMPLEX QUERY with ${multiTools.length} tools: ${multiTools.join(', ')}`);
      } else if (multiTools.length === 1) {
        selectedTools = multiTools;
        logger.info(`[Process] ✅ Fast path matched: ${multiTools[0]} (complex connector but single tool)`);
      } else {
        // Has connector but no clear tools - continue to individual checks
        logger.info(`[Process] Complex connector found but no clear tools - continuing to individual checks`);
      }
    }
    */
    logger.info(`[Process] ⚠️ Complex query detection DISABLED - all queries use Priority Boost system`);
    
    // ===== PRIORITY 2: Individual tool patterns =====
    // DateTime patterns
    if (selectedTools.length === 0 && /(?:กี่โมง|เวลา|ตอนนี้.*(?:time|เวลา)|วันที่|what.*time|current.*time)/.test(msg)) {
      selectedTools = ["innomcp-server:dateTimeTool"];
      logger.info(`[Process] ✅ Fast path matched: dateTimeTool`);
    }
    // Newton patterns (อนุพันธ์, ปริพันธ์) - ต้องเช็คก่อน Calculator
    else if (selectedTools.length === 0 && /(?:อนุพันธ์|ปริพันธ์|อินทิเกรต|อินทิกรัล|derivative|integral|integrate|differentiate|หาอนุพันธ์|หาปริพันธ์)/.test(msg)) {
      selectedTools = ["innomcp-server:newton"];
      logger.info(`[Process] ✅ Fast path matched: newton`);
    }
    // Calculator patterns - ปรับปรุงให้จับ "คูณ", "หาร" ได้
    else if (selectedTools.length === 0 && /\d+.*[\+\-\*\/\×\÷\^]|(?:คำนวณ|calculate|factorial|คูณ|หาร|บวก|ลบ|ยกกำลัง)/.test(msg)) {
      selectedTools = ["innomcp-server:calculatorTool"];
      logger.info(`[Process] ✅ Fast path matched: calculatorTool`);
    }
    // GovData patterns - เช็คก่อน weather เพราะ "สถิติ" อาจสับสน  
    else if (selectedTools.length === 0 && /(?:data\.gov|govdata|gov\s*data|สถิติ.*(?:ภาครัฐ|รัฐ)|ข้อมูล.*(?:รัฐ|ภาครัฐ|government)|government.*(?:data|statistics)|census|ข้อมูล.*สาธารณะ)/.test(msg)) {
      selectedTools = ["innomcp-server:govdata"];
      logger.info(`[Process] ✅ Fast path matched: govdata`);
    }
    // Weather patterns - ⚠️ DISABLED: Use AI selection with Priority Boost instead
    // Reason: Fast path bypasses NWP/TMD priority boost system (TODO #1-22)
    // All weather queries now go through selectTools() → priority boost → NWP/TMD
    /*
    else if (selectedTools.length === 0 && /(?:พยากรณ์.*อากาศ|สภาพอากาศ|weather|forecast|อากาศ.*(?:ร้อน|หนาว|วันนี้|พรุ่งนี้|เป็นอย่างไร|ยังไง|ตอนนี้|ขณะนี้)|ฝน.*(?:ตก|วันนี้|พรุ่งนี้)|อุณหภูมิ|ลม.*แรง|ครึ้ม|มืด|เมฆ|ฟ้า|กรุงเทพ|กทม|ปทุมวัน)/.test(msg)) {
      selectedTools = ["innomcp-server:nwp_hourly_by_place"];
      logger.info(`[Process] ✅ Fast path matched: nwp_hourly_by_place`);
    }
    */
    // Archive patterns - ปรับให้ match หลากหลายขึ้น
    else if (selectedTools.length === 0 && /(?:internet\s*archive|archive\.org|archive|ค้นหา.*(?:หนังสือ|เอกสาร|ข้อมูล)|หา.*(?:เอกสาร|หนังสือ)|เอกสาร.*(?:เก่า|โบราณ)|หนังสือ.*(?:ใน|จาก|archive))/.test(msg)) {
      selectedTools = ["innomcp-server:archive"];
      logger.info(`[Process] ✅ Fast path matched: archive`);
    }
    // NASA patterns - เพิ่ม "นาซ่า" และ keywords เกี่ยวกับอวกาศ
    else if (selectedTools.length === 0 && /(?:nasa|นาซ่า|ภาพอวกาศ|ดาว.*(?:nasa|นาซ่า)|รูปดาว|ภาพ.*ดาว|อวกาศ.*(?:nasa|นาซ่า|ภาพ)|ค้นพบ.*(?:นอกโลก|อวกาศ)|สิ่งมีชีวิต.*นอกโลก|apod)/.test(msg)) {
      selectedTools = ["innomcp-server:nasa"];
      logger.info(`[Process] ✅ Fast path matched: nasa`);
    }
    // World Bank patterns - ปรับให้ครอบคลุมมากขึ้น
    else if (selectedTools.length === 0 && /(?:world\s*bank|worldbank|ธนาคาร.*โลก|gdp|เศรษฐกิจ.*(?:ไทย|โลก|world)|ข้อมูล.*เศรษฐกิจ|ประชากร.*(?:โลก|ไทย|world|bank)|inflation|อัตรา.*เงินเฟ้อ|economic.*data|growth.*rate)/.test(msg)) {
      selectedTools = ["innomcp-server:worldbank"];
      logger.info(`[Process] ✅ Fast path matched: worldbank`);
    }
    // ECharts patterns - ปรับให้ครอบคลุมการขอกราฟทุกแบบ
    else if (selectedTools.length === 0 && /(?:กราฟ|แผนภูมิ|chart|graph|plot|visualize|visualization|แสดงผล.*กราฟ|สร้าง.*(?:กราฟ|แผนภูมิ|chart)|วาด.*(?:กราฟ|chart)|line\s*chart|bar\s*chart|pie\s*chart|scatter|heatmap|treemap|วงกลม.*สัดส่วน)/.test(msg)) {
      selectedTools = ["innomcp-server:echartsTool"];
      logger.info(`[Process] ✅ Fast path matched: echartsTool`);
    }
    
    // ===== FALLBACK: AI Selection (with Priority Boost) =====
    if (selectedTools.length === 0) {
      logger.info(`[Process] No fast path match - using AI selection with Priority Boost`);
      logger.info(`[Process] 🌤️  Weather queries will use NWP/TMD priority (+100/+60 vs -20 Open-Meteo)`);
      // 🧠 Pass semantic hint to selectTools for smarter selection (hybrid mode)
      selectedTools = await this.selectTools(userMessage, semanticHint, options);
    }
    
    logger.info(`[Process] selectTools() returned tools`, { count: selectedTools.length, tools: selectedTools });
    if (selectedTools.length > 0) {
      logger.info(`[Process] 🎯 Final selected tool(s): ${selectedTools.join(', ')}`);
    }

    if (selectedTools.length === 0) {
      logger.info(`[Process] ⚠️ No tools selected - returning needsTools: false`);
      return { needsTools: false };
    }

    // ตรวจสอบว่าผู้ใช้ขอใช้ chaining หรือไม่
    const useChaining = this.shouldUseChaining(userMessage);

    if (useChaining) {
      // วางแผนและ execute chain
      const chainPlan = await this.planToolChain(userMessage, selectedTools);

      if (chainPlan && chainPlan.isChainable) {
        console.log(
          `[Process] 🔗 Using tool chain with ${chainPlan.steps.length} steps`
        );

        // Execute chain
        const chainResults = await this.executeToolChain(
          chainPlan,
          userMessage
        );

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
    }

    // ใช้ tool เดียวที่ดีที่สุด หรือ execute ปกติ
    console.log("[Process] Using single best tool");

    const bestTool = selectedTools[0]; // เลือก tool ที่ดีที่สุดอันดับ 1
    console.log(`[Process] Selected tool: ${bestTool}`);
    
    const toolResults = await this.executeTools([bestTool], userMessage);
    const successfulResults = toolResults.filter((r) => r.success);

    console.log(`[Process] Tool results: ${toolResults.length} total, ${successfulResults.length} successful`);
    
    if (successfulResults.length === 0) {
      console.log("[Process] Tool failed");
      if (toolResults.length > 0 && toolResults[0].error) {
        console.error("[Process] Tool error:", toolResults[0].error);
      }
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

  private buildWeatherPipelineStructuredContent(weatherResults: any[]): {
    structuredContent: any;
    success: boolean;
    isError: boolean;
    error?: string;
  } {
    const anySuccess = Array.isArray(weatherResults) && weatherResults.some((r: any) => r && r.type && r.type !== "error");

    if (anySuccess) {
      return {
        structuredContent: { weatherPipeline: { ok: true, result: weatherResults } },
        success: true,
        isError: false,
      };
    }

    const rawErr = String(weatherResults?.[0]?.error || "WEATHER_PIPELINE_ERROR");
    const code = (() => {
      if (rawErr === "PROVINCE_MISSING") return "PROVINCE_MISSING";
      if (rawErr === "TIMEOUT" || rawErr === "BUDGET_EXCEEDED") return "TIMEOUT";

      // No-data style
      if (
        rawErr === "STATION_NOT_FOUND" ||
        rawErr === "PROVINCE_NOT_FOUND_IN_FORECAST" ||
        rawErr === "DATA_UNAVAILABLE" ||
        rawErr === "STATION_SKIPPED"
      ) {
        return "NO_DATA";
      }

      // Upstream / infra
      if (
        rawErr === "CLIENT_NOT_FOUND" ||
        rawErr === "API_ERROR" ||
        rawErr === "NWP_UNAVAILABLE" ||
        rawErr === "NATIONAL_DATA_UNAVAILABLE" ||
        rawErr === "WEATHER_PIPELINE_ERROR" ||
        rawErr === "UNEXPECTED_ERROR"
      ) {
        return "UPSTREAM_ERROR";
      }

      return "UPSTREAM_ERROR";
    })();

    const message = (() => {
      switch (code) {
        case "PROVINCE_MISSING":
          return "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการ (เช่น \"พรุ่งนี้เชียงใหม่ฝนตกไหม\")";
        case "TIMEOUT":
          return "ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา กรุณาลองใหม่อีกครั้ง";
        case "NO_DATA":
          return "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้";
        case "UPSTREAM_ERROR":
        default:
          return "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองใหม่อีกครั้ง";
      }
    })();

    return {
      structuredContent: { weatherPipeline: { ok: false, code, message } },
      success: false,
      isError: true,
      error: code,
    };
  }

  private getWeatherPipeline(): WeatherPipeline {
    if (!this.weatherPipeline) {
        // Pass the clients map to the pipeline so engines can access them
        this.weatherPipeline = new WeatherPipeline(this.clients);
    }
    return this.weatherPipeline!;
  }

  /**
   * Phase 7.1: Deterministic weather pipeline execution (no LLM tool planning)
   * Returns a tool-result-like object so callers can render/stream consistently.
   */
  public async runDeterministicWeatherPipeline(userMessage: string): Promise<any> {
    const pipeline = this.getWeatherPipeline();
    const target = pipeline.resolveTarget(userMessage);
    const weatherResults = await pipeline.execute(target);

    const shaped = this.buildWeatherPipelineStructuredContent(weatherResults as any);

    return {
      toolName: "weatherPipeline",
      success: shaped.success,
      isError: shaped.isError,
      error: shaped.error,
      structuredContent: shaped.structuredContent,
      content: [{
        type: "text",
        text: JSON.stringify(shaped.structuredContent),
      }],
    };
  }

   async executeTools(
    toolNames: string[],
    userMessage: string,
    preGeneratedArgsMap?: Record<string, any>
  ): Promise<any[]> {
    const results: any[] = [];
    const mergedArgsMap: Record<string, any> = { ...(preGeneratedArgsMap || {}) };
      let weatherHandled = false; // Only run pipeline once per executeTools call

      const isWeatherToolName = (name: string) =>
        name.includes("weather") || name.includes("tmd") || name.includes("nwp");

      // Pre-scan: if any weather intent toolname exists, run the pipeline exactly once
      const hasAnyWeatherTool = toolNames.some((n) => isWeatherToolName(n));
      if (hasAnyWeatherTool && !weatherHandled) {
        weatherHandled = true;
        try {
          // Deterministic (no LLM planning) weather execution
          const toolResult = await this.runDeterministicWeatherPipeline(userMessage);
          results.push(toolResult);
        } catch (err: any) {
          console.error(`[WeatherPipeline] Critical Failure: ${err.message}`);
          const structured = { weatherPipeline: { ok: false, code: "UPSTREAM_ERROR", message: err.message || "WEATHER_PIPELINE_ERROR" } };
          results.push({
            toolName: "weatherPipeline",
            success: false,
            isError: true,
            error: "UPSTREAM_ERROR",
            structuredContent: structured,
            content: [{ type: "text", text: JSON.stringify(structured) }],
          });
        }
      }

    // Officer evidence: infer deterministic args for EvidenceTool (no LLM required)
    // This keeps tool execution reliable even when argument generation is unavailable.
    const inferEvidenceAction = (text: string): string | undefined => {
      const t = String(text || "");
      if (/(เครื่อง.*ออนไลน์|ออนไลน์กี่เครื่อง|active\s*machines?|online\s*machines?)/i.test(t)) return "active_machines_count";
      if (/(วันนี้.*(machine|เครื่อง).*(evidence|หลักฐาน).*(ทำงาน|ทำงานอยู่|active)|machine\s*evidence\s*(active|working)\s*today)/i.test(t)) {
        return "machines_evidence_active_today";
      }
      if (/(ตรวจพบ.*url|url.*วันนี้|detected\s*urls?\s*today|nip.*วันนี้)/i.test(t)) return "detected_urls_today";
      if (/(เก็บหลักฐาน|จัดเก็บหลักฐาน|บันทึก.*วันนี้|วิดีโอ.*วันนี้|record.*วันนี้|evidence.*today)/i.test(t)) return "evidence_records_today";
      return undefined;
    };

    const evidenceAction = inferEvidenceAction(userMessage);
    if (evidenceAction) {
      for (const name of toolNames) {
        if (!mergedArgsMap[name] && /(^|:)evidenceTool$/i.test(name)) {
          mergedArgsMap[name] = { action: evidenceAction };
        }
      }
    }

    for (const toolName of toolNames) {
        // 🌤️ Weather Architecture (Phase 6.5)
        // Weather tools are handled only by the pipeline once; skip all of them here.
        if (isWeatherToolName(toolName) && weatherHandled) {
          continue;
        }

      // Normal execution for other tools
      const singleResult = await this.executeSingleTool(
        toolName,
        userMessage,
        undefined,
        mergedArgsMap
      );
      results.push(singleResult);
    }

    return results;
  }



  private async executeSingleTool(
    toolName: string,
    userMessage: string,
    forcedArgs?: any,
    preGeneratedArgsMap?: Record<string, any>
  ): Promise<any> {
    // Standard execution for non-weather tools
    // (Retry logic removed/minimized as per general cleanup)
    
    try {
        const originalToolName = toolName;

        // Backward-compatible fallback: if toolName is unqualified, resolve it to a unique
        // `clientName:toolName` key from the loaded tools map.
        if (!toolName.includes(":")) {
          const candidates = Array.from(this.tools.keys()).filter(
            (k) => k === toolName || k.endsWith(`:${toolName}`)
          );
          if (candidates.length === 1) {
            toolName = candidates[0];
            if (/\bevidenceTool\b/i.test(originalToolName) || /\bwebdTool\b/i.test(originalToolName)) {
              console.log(`[OfficerMode] resolveClient tool=${originalToolName} -> ${toolName}`);
            }
          } else if (candidates.length > 1) {
            const preferServer = candidates.find((k) => !k.startsWith("local-tools:"));
            toolName = preferServer || candidates[0];
            if (/\bevidenceTool\b/i.test(originalToolName) || /\bwebdTool\b/i.test(originalToolName)) {
              console.log(`[OfficerMode] resolveClient tool=${originalToolName} -> ${toolName}`);
            }
          }
        }

        const [clientName, actualToolName] = toolName.split(":");
        const client = this.clients.get(clientName);
        const tool = this.tools.get(toolName);
        const resource = this.resources.get(toolName);

        if (clientName === "local-tools") {
            // Local tool execution (bypass client check)
        } else if (!client) {
          return { toolName, error: `Client ${clientName} not found`, success: false };
        }

        let finalArgs: any;
        const preGeneratedArgs = preGeneratedArgsMap?.[toolName];
             if (preGeneratedArgs) {
                finalArgs = preGeneratedArgs;
             } else if (resource) {
                finalArgs = await this.generateToolArguments(
                    { ...resource, category: "resource" } as any,
                    userMessage
                );
             } else {
                finalArgs = await this.generateToolArguments(tool!, userMessage);
             }

        const callArgs = JSON.parse(JSON.stringify(finalArgs || {}));
        delete callArgs.signal;
        delete callArgs.requestId;
        delete callArgs.requestInfo;

        if (actualToolName && (actualToolName === "evidenceTool" || actualToolName.includes("webdTool"))) {
          console.log(`[OfficerMode] resolvedClient=${clientName} tool=${actualToolName}`);
        }

        console.log(`[MCP Client] 🚀 Calling ${actualToolName} with args:`, JSON.stringify(callArgs));

        let result: any;
        if (resource && client) {
           result = await client.callTool({
             name: resource.name,
             arguments: callArgs,
           });
           result = await client.callTool({
             name: actualToolName,
             arguments: callArgs,
           });
        }
        
        // Execute Local Tool
        else if (clientName === "local-tools") {
             const handler = this.localHandlers.get(toolName);
             if (handler) {
                 const localResult = await handler(callArgs);
                 // Format to match MCP result structure
                 result = {
                     content: [{ type: "text", text: JSON.stringify(localResult) }],
                     isError: !!localResult.error
                 };
             } else {
                 throw new Error(`Local handler not found for ${toolName}`);
             }
        } else if (clientName === "local-tools") {
             const handler = this.localHandlers.get(toolName);
             if (handler) {
                 const localResult = await handler(callArgs);
                 // Format to match MCP result structure
                 result = {
                     content: [{ type: "text", text: JSON.stringify(localResult) }],
                     isError: !!localResult.error
                 };
             } else {
                 throw new Error(`Local handler not found for ${toolName}`);
             }
        } else {
           result = await client!.callTool({ // Add ! assertion or check
             name: actualToolName,
             arguments: callArgs,
           });
        }

        if (result.isError) {
             const errText = result.content?.[0]?.text || "Tool execution error";
             console.error(`[MCP Client] Tool ${toolName} failed:`, errText);
             return { toolName, error: errText, success: false };
        } 
        
        let payload: any = result.content;
        try {
           if (Array.isArray(result.content) && result.content[0]?.text) {
              payload = JSON.parse(result.content[0].text);
           }
        } catch (e) { /* use original */ }

        // Normal return
        return {
           toolName,
           result: payload,
           structuredContent: result.structuredContent || payload,
           success: true,
        };

    } catch (error) {
         console.error(`[MCP Client] Exception executing ${toolName}:`, error);
         const errMsg = error instanceof Error ? error.message : String(error);
         return { toolName, error: errMsg, success: false };
    }
  }

  private async generateToolArguments(
    tool: MCPTool,
    userMessage: string
  ): Promise<any> {
    try {
      const schema = tool.inputSchema || {};
      const schemaStr = JSON.stringify(schema, null, 2);
      const required = schema.required || [];

      // Extract parameter hints from description if schema is empty
      let parameterHints = "";
      let exampleArgs = "";
      if (Object.keys(schema).length === 0 && tool.description) {
        parameterHints = this.extractParameterHintsFromDescription(tool.description);
        
        // Add specific examples for known tools
        if (tool.name === "calculatorTool") {
          exampleArgs = `\n\n📝 ตัวอย่าง JSON:\n{"expression": "2+2"}\n{"expression": "100/5"}\n{"expression": "sqrt(16)"}\n{"expression": "(3^3+1)*(4^3+1)*(5^3+1)"}`;
        } else if (tool.name === "echartsTool") {
          exampleArgs = `\n\n📝 ตัวอย่าง JSON ที่ถูกต้อง:\n{"type": "bar", "labels": ["A","B"], "datasets": [{"label":"Sales", "data":[10,20]}]}\n{"type": "pie", "chatText": "A 10, B 20, C 30"}`;
        }
      }

      // สำหรับ echartsTool ให้ส่งประวัติการสนทนาด้วย
      let conversationContext = "";
      let chatDataSuggestion = "";
      if (tool.name === "echartsTool") {
        // สร้าง context จากประวัติการสนทนา
        const extractedData = this.extractChartDataFromHistory();
        if (extractedData) {
          conversationContext = `\n\nข้อมูลจากประวัติการสนทนา:\n${extractedData}`;
          chatDataSuggestion = `\n\n⚠️ สำคัญ: มีข้อมูลจากแชทเก่า (${extractedData}) → ต้องส่งด้วย chatText parameter ในรูปแบบ: "${extractedData}"`;
        }
      }

      const prompt = `สร้าง parameters JSON สำหรับ tool

วันที่ปัจจุบัน: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD)

คำขอผู้ใช้: "${userMessage}"${conversationContext}${chatDataSuggestion}

Tool ที่จะใช้:
ชื่อ: ${tool.name}
คำอธิบาย (อ่านให้ดี):
${tool.description || "ไม่มี"}
${parameterHints ? `\n📋 Parameters ที่ต้องมี:\n${parameterHints}` : ''}
${exampleArgs}
${schemaStr !== '{}' ? `\nSchema ของ parameters:\n${schemaStr}` : ''}

Parameters ที่จำเป็น: ${required.length > 0 ? required.join(", ") : "ดูจาก description ข้างบน"}

🎯 กฎสำคัญ:
1. ตอบ JSON object เท่านั้น - ห้ามมีข้อความอื่น
2. calculatorTool: **ต้องมี expression field**
   - ใช้ * สำหรับคูณ: (3^3+1)*(4^3+1)*(5^3+1)
   - ใช้ / สำหรับหาร
   - ใช้ ^ สำหรับยกกำลัง
   - ตัวอย่าง: "หาร A ด้วย B" → {"expression": "A/B"}
3. echartsTool: **ต้องส่ง type + (labels+datasets)**
   - ถ้ามีข้อมูลจากแชท ใช้ chatText (รูปแบบ 'A 10, B 20')
   - ถ้าไม่มีข้อมูล: ต้องวิเคราะห์จากคำถามและสร้าง labels + datasets ที่สมเหตุสมผล
   - ตัวอย่าง: "ความชื้นสถานีผิวพื้น กับ สถานีอุทก" → {"type":"bar", "labels":["สถานีผิวพื้น","สถานีอุทก"], "datasets":[{"label":"ความชื้นสัมพัทธ์ %","data":[65,72]}]}
4. date parameters: ใช้รูปแบบ YYYY-MM-DD (เช่น 2026-01-15) และอ้างอิงจากวันที่ปัจจุบันข้างบน
5. ห้ามส่งผลลัพธ์ (result, answer) หรือข้อมูลอื่น
6. **ห้ามตอบ {} เด็ดขาด** - ต้องมี parameters เสมอ

ตอบเฉพาะ JSON เท่านั้น:
`;

      // 🔥 Increase num_predict for echartsTool and NWP tools (needs longer JSON)
      // NWP tools need lat/lon coordinates - 50 is too short, AI sends incomplete JSON → parse error → empty string defaults
      const needsLongerJson = tool.name === "echartsTool" || 
                             tool.name.includes("nwp_") || 
                             tool.name.includes("hourly") || 
                             tool.name.includes("daily");
      const numPredict = needsLongerJson ? 150 : 50;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { 
          temperature: 0.3,
          num_predict: numPredict,
          num_ctx: 512,
          num_gpu_layers: 50,
          num_thread: 8,
          repeat_penalty: 1.0,
        },
        'fast'
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
        
        // 🔥 FIX: Convert lat/lon strings to numbers
        // AI often returns "13.75" instead of 13.75
        if ('lat' in parsed && typeof parsed.lat === 'string') {
          const latNum = parseFloat(parsed.lat);
          if (!isNaN(latNum)) {
            parsed.lat = latNum;
            console.log(`[generateToolArguments] Converted lat string "${parsed.lat}" → number ${latNum}`);
          }
        }
        if ('lon' in parsed && typeof parsed.lon === 'string') {
          const lonNum = parseFloat(parsed.lon);
          if (!isNaN(lonNum)) {
            parsed.lon = lonNum;
            console.log(`[generateToolArguments] Converted lon string "${parsed.lon}" → number ${lonNum}`);
          }
        }
        
        // Convert other numeric fields if schema specifies them
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            const prop = propSchema as any;
            if (prop.type === 'number' && key in parsed && typeof parsed[key] === 'string') {
              const num = parseFloat(parsed[key]);
              if (!isNaN(num)) {
                parsed[key] = num;
                console.log(`[generateToolArguments] Converted ${key} string "${parsed[key]}" → number ${num}`);
              }
            }
          }
        }
      } catch (parseError) {
        parsed = {};
      }

      // 🔥 Fallback for echartsTool when AI returns empty {}
      if (tool.name === "echartsTool" && Object.keys(parsed).length === 0) {
        console.warn(`[generateToolArguments] echartsTool received empty args - creating fallback`);
        
        // วิเคราะห์คำถามเพื่อสร้าง placeholder data
        const lowerMsg = userMessage.toLowerCase();
        
        // ตรวจจับประเภทกราฟ
        let chartType = "bar";
        if (lowerMsg.includes("วงกลม") || lowerMsg.includes("pie")) chartType = "pie";
        else if (lowerMsg.includes("เส้น") || lowerMsg.includes("line")) chartType = "line";
        
        // ตรวจจับหัวข้อ
        let title = "ความสัมพันธ์ของข้อมูล";
        if (lowerMsg.includes("ความชื้น")) title = "ความชื้นสัมพัทธ์";
        else if (lowerMsg.includes("อุณหภูมิ")) title = "อุณหภูมิ";
        else if (lowerMsg.includes("ฝน")) title = "ปริมาณฝน";
        
        // สร้าง labels จากคำถาม
        let labels = ["กลุ่ม A", "กลุ่ม B"];
        if (lowerMsg.includes("สถานี")) {
          labels = ["สถานีผิวพื้น", "สถานีอุทก"];
        }
        
        parsed = {
          type: chartType,
          labels: labels,
          datasets: [{
            label: title,
            data: [65, 72] // placeholder values
          }],
          chartTitle: title
        };
        
      }

      // 🔥 FIX: Set defaults for missing required fields, but DON'T set empty string
      // Empty string will fail validation for number/boolean types
      for (const key of required) {
        if (!(key in parsed)) {
          const defaultValue = schema.properties?.[key]?.default;
          // Only set default if it's NOT empty string (empty string is useless for number/boolean)
          if (defaultValue !== undefined && defaultValue !== null && defaultValue !== "") {
            parsed[key] = defaultValue;
          } else {
            // Don't include the field at all if no valid default
          }
        }
      }

      // 🔥 FIX: Clean up empty string values (will fail validation)
      for (const key of Object.keys(parsed)) {
        if (typeof parsed[key] === 'string' && parsed[key].trim() === '') {
          delete parsed[key];
        }
      }

      return parsed;
    } catch (error) {
      console.error("[MCP Client] Error generating args:", error);
      return {};
    }
  }

  // Extract Thai location hints from free-form text to avoid empty tool args
  private extractThaiLocationHints(message: string): { province?: string; amphoe?: string; tambon?: string } {
    const hints: { province?: string; amphoe?: string; tambon?: string } = {};

    const provinceMatch = message.match(/จังหวัด\s*([^\s,0-9]+)/i);
    if (provinceMatch) hints.province = provinceMatch[1].trim();

    const amphoeMatch = message.match(/อำเภอ\s*([^\s,0-9]+)/i);
    if (amphoeMatch) hints.amphoe = amphoeMatch[1].trim();

    const tambonMatch = message.match(/ตำบล\s*([^\s,0-9]+)/i);
    if (tambonMatch) hints.tambon = tambonMatch[1].trim();

    if (!hints.amphoe && /ปทุมวัน/i.test(message)) {
      hints.amphoe = "ปทุมวัน";
    }
    if (!hints.province && hints.amphoe === "ปทุมวัน") {
      hints.province = "กรุงเทพมหานคร";
    }
    if (!hints.province && /(กรุงเทพ|กทม|bangkok)/i.test(message)) {
      hints.province = "กรุงเทพมหานคร";
    }
    if (!hints.province && /นนทบุรี/i.test(message)) {
      hints.province = "นนทบุรี";
    }
    if (!hints.province && /นครปฐม/i.test(message)) {
      hints.province = "นครปฐม";
    }

    return hints;
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
        errors: validate.errors.map((e: any) => `${e.instancePath} ${e.message}`),
      };
    }

    return { valid: true };
  }

  private extractJsonFromText(text: string): string | null {
    if (!text || typeof text !== "string") return null;

    let cleanText = text.trim();
    
    // 🔥 FIX #1: Strip markdown code fences FIRST (aggressive approach)
    // Remove ```json at start (with any whitespace/newlines)
    cleanText = cleanText.replace(/^```json\s*/i, '');
    cleanText = cleanText.replace(/^```\s*/, ''); // Fallback for plain ```
    
    // Remove ``` at end (with any whitespace/newlines before it)
    cleanText = cleanText.replace(/\s*```\s*$/, '');
    
    // 🔥 FIX #2: Remove ALL leading/trailing backticks, whitespace, newlines
    // This catches ANY remaining backticks or whitespace
    cleanText = cleanText.replace(/^[`\s\n\r]+/, '').replace(/[`\s\n\r]+$/, '');
    console.log(`[extractJsonFromText] After cleanup, first 50 chars: ${cleanText.substring(0, 50)}`);
    
    // Handle backticks at start/end: `{"type": ...}` or `json {...}`
    if (cleanText.startsWith('`') && cleanText.endsWith('`')) {
      cleanText = cleanText.slice(1, -1).trim();
      console.log('[extractJsonFromText] Removed surrounding backticks');
    }
    
    // Remove "json" prefix if present: json {"type": ...}
    const jsonPrefixMatch = cleanText.match(/^json\s*({[\s\S]*})$/i);
    if (jsonPrefixMatch) {
      cleanText = jsonPrefixMatch[1].trim();
      console.log('[extractJsonFromText] Removed "json" prefix');
    }
    
    // Remove any remaining leading/trailing non-JSON characters
    const firstBrace = cleanText.search(/[\{\[]/);
    if (firstBrace > 0) {
      cleanText = cleanText.substring(firstBrace);
      console.log('[extractJsonFromText] Stripped leading non-JSON text');
    }

    const firstIdx = cleanText.search(/[\{\[]/);
    if (firstIdx === -1) return null;

    const openChar = cleanText[firstIdx];
    const closeChar = openChar === "{" ? "}" : "]";

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = firstIdx; i < cleanText.length; i++) {
      const ch = cleanText[i];

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
          return cleanText.slice(firstIdx, i + 1).trim();
        }
      }
    }

    return null;
  }

  private createEnhancedContext(
    userMessage: string,
    toolResults: any[]
  ): string {
    // ✅ Enhanced Context with data source explanation
    let context = `ข้อมูลที่เกี่ยวข้องกับคำถาม "${userMessage}":\n\n`;

    // Detect temporal context from user message
    const isFutureQuery = /(?:กลางดึก|คืนนี้|พรุ่งนี้|วันหลัง|สัปดาห์หน้า|เดือนหน้า|จะ|tomorrow|tonight|next)/i.test(userMessage);
    const isPresentQuery = /(?:ตอนนี้|เดี๋ยวนี้|ขณะนี้|ปัจจุบัน|วันนี้|now|today|current)/i.test(userMessage);

    // Detect requested location (ใช้ locationMap เดียวกับ directKeywordCheck)
    const locationMap: { [key: string]: string } = {
      // ภาคเหนือ
      'เชียงราย': 'เชียงราย',
      'chiang rai': 'เชียงราย',
      'เชียงใหม่': 'เชียงใหม่',
      'chiang mai': 'เชียงใหม่',
      'แม่ฮ่องสอน': 'แม่ฮ่องสอน',
      'ลำปาง': 'ลำปาง',
      'ลำพูน': 'ลำพูน',
      'พะเยา': 'พะเยา',
      'แพร่': 'แพร่',
      'น่าน': 'น่าน',
      'อุตรดิตถ์': 'อุตรดิตถ์',
      'ตาก': 'ตาก',
      'พิษณุโลก': 'พิษณุโลก',
      'สุโขทัย': 'สุโขทัย',
      'กำแพงเพชร': 'กำแพงเพชร',
      'พิจิตร': 'พิจิตร',
      'เพชรบูรณ์': 'เพชรบูรณ์',
      // ภาคกลาง
      'กรุงเทพ': 'กรุงเทพมหานคร',
      'กทม': 'กรุงเทพมหานคร',
      'กทม.': 'กรุงเทพมหานคร',
      'bangkok': 'กรุงเทพมหานคร',
      'นครปฐม': 'นครปฐม',
      'ปทุมธานี': 'ปทุมธานี',
      'นนทบุรี': 'นนทบุรี',
      'สมุทรปราการ': 'สมุทรปราการ',
      'สมุทรสาคร': 'สมุทรสาคร',
      'สมุทรสงคราม': 'สมุทรสงคราม',
      'แม่กลอง': 'สมุทรสงคราม',  // อำเภอเมืองสมุทรสงคราม
      'mae klong': 'สมุทรสงคราม',
      'ราชบุรี': 'ราชบุรี',
      'กาญจนบุรี': 'กาญจนบุรี',
      'สุพรรณบุรี': 'สุพรรณบุรี',
      'ลพบุรี': 'ลพบุรี',
      'สิงห์บุรี': 'สิงห์บุรี',
      'ชัยนาท': 'ชัยนาท',
      'อ่างทอง': 'อ่างทอง',
      'สระบุรี': 'สระบุรี',
      'อยุธยา': 'พระนครศรีอยุธยา',
      'พระนครศรีอยุธยา': 'พระนครศรีอยุธยา',
      // ภาคตะวันออก
      'ชลบุรี': 'ชลบุรี',
      'พัทยา': 'ชลบุรี',
      'pattaya': 'ชลบุรี',
      'ระยอง': 'ระยอง',
      'จันทบุรี': 'จันทบุรี',
      'ตราด': 'ตราด',
      'ฉะเชิงเทรา': 'ฉะเชิงเทรา',
      'ปราจีนบุรี': 'ปราจีนบุรี',
      'นครนายก': 'นครนายก',
      'สระแก้ว': 'สระแก้ว',
      // ภาคตะวันออกเฉียงเหนือ (อีสาน)
      'นครราชสีมา': 'นครราชสีมา',
      'โคราช': 'นครราชสีมา',
      'korat': 'นครราชสีมา',
      'ขอนแก่น': 'ขอนแก่น',
      'khon kaen': 'ขอนแก่น',
      'อุดรธานี': 'อุดรธานี',
      'udon thani': 'อุดรธานี',
      'อุบลราชธานี': 'อุบลราชธานี',
      'ubon': 'อุบลราชธานี',
      'นครพนม': 'นครพนม',
      'มุกดาหาร': 'มุกดาหาร',
      'สกลนคร': 'สกลนคร',
      'บุรีรัมย์': 'บุรีรัมย์',
      'สุรินทร์': 'สุรินทร์',
      'ศรีสะเกษ': 'ศรีสะเกษ',
      'ยโสธร': 'ยโสธร',
      'กาฬสินธุ์': 'กาฬสินธุ์',
      'มหาสารคาม': 'มหาสารคาม',
      'ร้อยเอ็ด': 'ร้อยเอ็ด',
      'เลย': 'เลย',
      'หนองคาย': 'หนองคาย',
      'หนองบัวลำภู': 'หนองบัวลำภู',
      'บึงกาฬ': 'บึงกาฬ',
      'ชัยภูมิ': 'ชัยภูมิ',
      'อำนาจเจริญ': 'อำนาจเจริญ',
      // ภาคใต้
      'ภูเก็ต': 'ภูเก็ต',
      'phuket': 'ภูเก็ต',
      'สุราษฎร์ธานี': 'สุราษฎร์ธานี',
      'นครศรีธรรมราช': 'นครศรีธรรมราช',
      'กระบี่': 'กระบี่',
      'krabi': 'กระบี่',
      'พังงา': 'พังงา',
      'ตรัง': 'ตรัง',
      'สงขลา': 'สงขลา',
      'songkhla': 'สงขลา',
      'หาดใหญ่': 'สงขลา',
      'hat yai': 'สงขลา',
      'ปัตตานี': 'ปัตตานี',
      'ยะลา': 'ยะลา',
      'นราธิวาส': 'นราธิวาส',
      'พัทลุง': 'พัทลุง',
      'สตูล': 'สตูล',
      'ชุมพร': 'ชุมพร',
      'ระนอง': 'ระนอง',
      'เกาะสมุย': 'สุราษฎร์ธานี',
      'koh samui': 'สุราษฎร์ธานี'
    };
    let requestedProvince = '';
    const msgLower = userMessage.toLowerCase();
    for (const [alias, fullName] of Object.entries(locationMap)) {
      if (msgLower.includes(alias.toLowerCase())) {
        requestedProvince = fullName;
        break;
      }
    }

    for (const result of toolResults) {
      if (result.error) {
        // Hide tool name even in errors
        context += `⚠️ ไม่สามารถดึงข้อมูลบางส่วนได้: ${result.error}\n`;
      } else {
        // ✅ PRIORITY 1: Use structuredContent if available (complete JSON data)
        let parsed: any = null;
        
        if (result.structuredContent && typeof result.structuredContent === 'object') {
          console.log(`[Enhanced Context] ✅ Using structuredContent directly`);
          parsed = result.structuredContent;
        } else {
          // FALLBACK: Extract text and try to parse
          let resultStr = '';
          if (typeof result.result === "string") {
            resultStr = result.result;
          } else if (Array.isArray(result.result) && result.result[0]?.type === 'text') {
            resultStr = result.result[0].text || JSON.stringify(result.result, null, 2);
          } else {
            resultStr = JSON.stringify(result.result, null, 2);
          }
          
          try {
            const firstBrace = resultStr.indexOf('{');
            const lastBrace = resultStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              const jsonStr = resultStr.substring(firstBrace, lastBrace + 1);
              parsed = JSON.parse(jsonStr);
            }
          } catch (e) {
            console.log(`[Enhanced Context] ⚠️ Could not parse JSON from text`);
          }
        }

        // 🛡️ SYSTEM GUARD CHECK (Weather Hardening)
        let systemGuardMsg = "";
        if (parsed && parsed._system_guard) {
             systemGuardMsg = `🛡️ ${parsed._system_guard}\n\n`;
             // Unwrap data if present
             if (parsed.data) {
                 parsed = parsed.data;
             } else {
                 delete parsed._system_guard;
             }
        }
        
        // 🔍 FILTER PROVINCE DATA if requested (Double check)
        // Note: The gate already filtered it, but this logic remains as backup/visual confirmation
        if (requestedProvince && parsed && parsed.Provinces?.Province && Array.isArray(parsed.Provinces.Province)) {
             // ... existing filter logic (will likely be redundant if gate works, but harmless) ...
             const filtered = parsed.Provinces.Province.filter((p: any) => 
                p.ProvinceNameThai === requestedProvince
             );
             if (filtered.length > 0) parsed.Provinces.Province = filtered;
        }

        // Add System Guard to context
        if (systemGuardMsg) {
            context += systemGuardMsg;
        }
        
        // Convert to string for context
        let contextStr = '';
        if (parsed) {
          contextStr = JSON.stringify(parsed, null, 2);
        } else {
          // Use original text if parsing failed
          if (typeof result.result === "string") {
            contextStr = result.result;
          } else if (Array.isArray(result.result) && result.result[0]?.type === 'text') {
            contextStr = result.result[0].text || JSON.stringify(result.result, null, 2);
          } else {
            contextStr = JSON.stringify(result.result, null, 2);
          }
        }
        
        // ⚠️ IMPORTANT: Explain data limitations
        const isCurrentData = /Weather3Hours|16:00:00|Observation|01\/13\/2026 16:00/i.test(contextStr);
        const isForecastData = /Forecast|SevenDaysForecast|ForecastDate|7 Days|Weather forecast/i.test(contextStr);

        // Warning if temporal mismatch
        if (isFutureQuery && isCurrentData) {
          context += `⚠️ **ข้อจำกัดสำคัญ**: ข้อมูลนี้เป็นข้อมูลสภาพอากาศ**ปัจจุบัน** (ไม่ใช่พยากรณ์อนาคต)\n`;
          context += `📌 คำถามถึงเวลา**อนาคต** แต่ข้อมูลที่มีเป็นข้อมูล**ปัจจุบัน** → ไม่สามารถตอบได้แม่นยำ\n\n`;
        } else if (isPresentQuery && isForecastData) {
          context += `📊 ข้อมูลนี้เป็นข้อมูล**พยากรณ์** (ไม่ใช่ข้อมูลปัจจุบันแบบเรียลไทม์)\n\n`;
        } else if (isFutureQuery && isForecastData) {
          context += `✅ ข้อมูลพยากรณ์อากาศล่วงหน้า (เหมาะสมกับคำถามเกี่ยวกับอนาคต)\n\n`;
        }

        // Add success message if province was filtered
        if (requestedProvince && parsed && parsed.Provinces?.Province) {
          context += `✅ ข้อมูลพยากรณ์อากาศสำหรับ **${requestedProvince}**:\n\n`;
        }

        context += `${contextStr}\n\n`;
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
        Object.assign({ temperature: 0.2, num_predict: 400 }, options || {}),
        'accurate'  // Final HTML response needs accuracy
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

  /**
   * ดึงข้อมูลตัวเลขจากประวัติการสนทนาสำหรับกราฟ
   */
  private extractChartDataFromHistory(): string {
    if (this.conversationHistory.length === 0) return "";

    let dataContext = "";

    // รวมข้อมูลจากประวัติการสนทนา (ค่าตัวเลข, ชื่อ เป็นต้น)
    const textContent = this.conversationHistory
      .map((ctx) => ctx.query)
      .join("\n");

    if (!textContent) return "";

    // ค้นหาข้อมูลที่มีลักษณะเป็นตัวเลข (label value)
    const patterns = [
      /([A-Z][a-z]*(?:\s+[a-z]+)*)\s*[:|\s]+\s*(\d+(?:\.\d+)?)/gi, // "Sales: 100" หรือ "Bangkok 50"
      /([ก-ฮ][ก-ฮะะ]*)\s*[:|\s]+\s*(\d+(?:\.\d+)?)/g, // ข้อมูลไทย
    ];

    const allMatches: Array<{ label: string; value: string }> = [];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(textContent)) !== null) {
        allMatches.push({
          label: match[1].trim(),
          value: match[2],
        });
      }
    }

    // ลบค่าซ้ำและสร้าง context
    if (allMatches.length > 0) {
      const uniqueData = new Map<string, string>();
      allMatches.forEach((m) => {
        if (!uniqueData.has(m.label)) {
          uniqueData.set(m.label, m.value);
        }
      });

      dataContext = Array.from(uniqueData.entries())
        .map(([label, value]) => `${label} ${value}`)
        .join(", ");
    }

    return dataContext;
  }

  // ✅ 2025 OPTIMIZATION: Only enable essential tools for speed & accuracy
  // private readonly ALLOWED_TOOLS = [
  //   'dateTimeTool',
  //   'calculatorTool', 
  //   'MathTool',
  //   'archive',
  //   'tmd_seismic_daily_events',
  //   'tmd_thailand_climate_normal_1981_2010',
  //   'tmd_thailand_monthly_rainfall',
  //   'tmd_rain_regions',
  //   'tmd_station_list',
  //   'tmd_daily_forecast_4_times',
  //   'tmd_weather_today_07am_all_stations',
  //   'tmd_weather_3hours_all_stations',   
  //   'tmd_weather_forecast_7days_by_province',
  //   'tmd_weather_warning_news',
  //   'tmd_weather_forecast_7days_by_region',
  //   'tmd_weather_3hours_by_hydro',       
  //   'tmd_weather_3hours_by_agro',        
  //   'tmd_weather_3hours_by_synop',       
  //   'tmd_weather_today_by_hydro_07am',   
  //   'tmd_weather_today_by_agro_07am',    
  //   'tmd_weather_today_by_synop_07am',
  //   'nasa',
  //   'weather',
  //   'worldbank',
  //   'govdata',
  //   'newton',
  //   'echartsTool',
  //   // NEW: 2026-01-05 World-Class Tools
  //   'currencyExchangeTool',
  //   'qrCodeTool',
  //   'translationTool',
  //   'rssFeedTool',
  //   'codeFormatterTool',
  //   // NEW: 2026-01-05 Phase 2 - Essential Free Tools
  //   'ocrTool',
  //   'fileReaderTool',
  //   'imageGeneratorTool',
  //   // NEW: 2026-01-06 NWP Weather Forecast (High Performance Computing)
  //   'nwp_hourly_by_location',
  //   'nwp_hourly_by_place',
  //   'nwp_hourly_by_region',
  //   'nwp_daily_by_location',
  //   'nwp_daily_by_place',
  //   'nwp_daily_by_region'
  // ];

  // Cache available tools to avoid repeated filtering
  private cachedAvailableTools: MCPTool[] | null = null;
  private toolsCacheInvalidated: boolean = true;

  getAvailableTools(): MCPTool[] {
    // Return cached if valid
    if (!this.toolsCacheInvalidated && this.cachedAvailableTools) {
      return this.cachedAvailableTools;
    }

    const allTools = Array.from(this.tools.values());
    
    if (allTools.length === 0) {
      console.error(`[Tools] ❌ CRITICAL: No tools loaded! this.tools is empty!`);
      return [];
    }
    
    // ===== FIX: Simplified allowed check - ALL tools allowed by default =====
    // Remove overly restrictive ALLOWED_TOOLS filter that was blocking everything
    const filteredTools = allTools; // ✅ Allow ALL tools
    
    console.log(`[Tools] ✅ Available: ${filteredTools.length}/${allTools.length} tools`);
    
    // Cache result
    this.cachedAvailableTools = filteredTools;
    this.toolsCacheInvalidated = false;
    
    return filteredTools;
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
    const stats = {
      connectedClients: this.clients.size,
      availableTools: this.tools.size,
      availableResources: this.resources.size,
      cachedQueries: this.selectionCache.size,
      historySize: this.conversationHistory.length,
      patterns: this.toolPatterns.length,
      aiMode: this.aiMode,
    };
    
    // Add performance metrics if enabled
    if (process.env.ENABLE_PERFORMANCE_METRICS === 'true' && this.performanceMetrics.size > 0) {
      const metrics = Array.from(this.performanceMetrics.values());
      const localCount = metrics.filter(m => m.aiUsed === 'local').length;
      const remoteCount = metrics.filter(m => m.aiUsed === 'remote').length;
      const avgLocalTime = metrics
        .filter(m => m.aiUsed === 'local')
        .reduce((sum, m) => sum + m.duration, 0) / (localCount || 1);
      const avgRemoteTime = metrics
        .filter(m => m.aiUsed === 'remote')
        .reduce((sum, m) => sum + m.duration, 0) / (remoteCount || 1);
      
      return {
        ...stats,
        performance: {
          totalCalls: metrics.length,
          localCalls: localCount,
          remoteCalls: remoteCount,
          avgLocalTime: Math.round(avgLocalTime),
          avgRemoteTime: Math.round(avgRemoteTime),
          cacheSize: this.tokenCache.size,
        },
      };
    }
    
    return stats;
  }

  // ========================================
  // HEALTH CHECK & RECONNECTION SYSTEM
  // ========================================

  /**
   * Start professional health check monitoring
   * Periodically checks if tools are loaded and attempts reconnection if needed
   */
  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckIntervalMs);

    // Perform initial health check
    setTimeout(() => this.performHealthCheck(), 5000); // Wait 5s after init
  }

  /**
   * Stop health check monitoring
   */
  public stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check and trigger reconnection if needed
   */
  private async performHealthCheck() {
    const now = Date.now();
    this.lastHealthCheck = now;

    const stats = this.getStatistics();
    const toolCount = this.getAvailableTools().length;
    const clientCount = this.clients.size;

    const needsReconnection = 
      clientCount === 0 || // No clients connected
      toolCount === 0 || // No tools available
      this.clients.size < this.clientConfigs.length; // Missing clients

    if (needsReconnection && !this.isReconnecting) {
      console.log(
        `[MCP Client] ⚠️  Health check failed - initiating reconnection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
      );
      await this.attemptReconnection();
    } else if (toolCount > 0) {
      // Reset reconnection counter on successful health check
      if (this.reconnectAttempts > 0) {
        this.reconnectAttempts = 0;
        this.reconnectBackoff = 5000;
      }
    }

    // Emit health status
    this.emit("healthCheck", {
      timestamp: now,
      healthy: toolCount > 0 && clientCount > 0,
      clients: clientCount,
      tools: toolCount,
      resources: stats.availableResources,
    });
  }

  /**
   * Attempt to reconnect to MCP servers with exponential backoff
   */
  private async attemptReconnection() {
    if (this.isReconnecting) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `[MCP Client] ❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Manual intervention required.`
      );
      this.emit("reconnectionFailed", {
        attempts: this.reconnectAttempts,
        message: "Maximum reconnection attempts exceeded",
      });
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    console.log(
      `[MCP Client] 🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} (backoff: ${this.reconnectBackoff}ms)`
    );

    this.emit("reconnecting", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      backoff: this.reconnectBackoff,
    });

    try {
      // Clear existing connections
      for (const [name, client] of this.clients) {
        try {
          await client.close();
          console.log(`[MCP Client] Closed connection to ${name}`);
        } catch (err) {
          console.warn(`[MCP Client] Error closing client ${name}:`, err);
        }
      }
      this.clients.clear();
      this.tools.clear();
      this.resources.clear();

      // Wait for backoff period
      await new Promise((resolve) => setTimeout(resolve, this.reconnectBackoff));

      // Attempt reconnection
      console.log(`[MCP Client] Attempting to reconnect to ${this.clientConfigs.length} servers...`);
      
      for (const config of this.clientConfigs) {
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
          }

          const client = new Client({
            name: config.name,
            version: config.version,
          });

          await client.connect(transport as any);
          this.clients.set(config.name, client);

          this.emit("clientConnected", config.name);
          await this.loadToolsFromClient(config.name, client);
        } catch (error) {
          console.error(`[MCP Client] ❌ Failed to reconnect to ${config.name}:`, error);
        }
      }

      const toolCount = this.getAvailableTools().length;
      
      if (toolCount > 0) {
        this.reconnectAttempts = 0;
        this.reconnectBackoff = 5000;
        
        this.emit("reconnected", {
          clients: this.clients.size,
          tools: toolCount,
          resources: this.resources.size,
        });
        this.emit("ready");
      } else {
        // Increase backoff for next attempt
        this.reconnectBackoff = Math.min(
          this.reconnectBackoff * 2,
          this.maxReconnectBackoff
        );
      }
    } catch (error) {
      console.error(`[MCP Client] ❌ Reconnection attempt failed:`, error);
      // Increase backoff exponentially
      this.reconnectBackoff = Math.min(
        this.reconnectBackoff * 2,
        this.maxReconnectBackoff
      );
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Manual trigger for reconnection (can be called via API)
   */
  public async forceReconnect(): Promise<void> {
    this.reconnectAttempts = 0;
    this.reconnectBackoff = 5000;
    await this.attemptReconnection();
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

    // === BLACKLIST FILTERING ===
    // Calculator tool - ต้องมีตัวเลขหรือสัญลักษณ์คณิตศาสตร์
    // ===== TODO 3 FIX: Stricter calculator validation =====
    if (toolName.includes('calculator')) {
      const hasNumbers = /\d/.test(userMessage);
      const hasMathSymbols = /[\+\-\*\/\×\÷\^=]/.test(userMessage);
      const hasFactorial = /\d+!/.test(userMessage);
      const hasMathKeywords = /(?:คำนวณ|หาร|คูณ|บวก|ลบ|ยกกำลัง|factorial|calculate|compute)/i.test(userMessage);
      
      // STRICT: Must have numbers AND (symbols OR keywords OR factorial)
      const isValidMath = hasNumbers && (hasMathSymbols || hasFactorial || hasMathKeywords);
      
      // ถ้าไม่มีอะไรเลย → คะแนน 0
      if (!isValidMath) {
        console.log(`[Score] ${toolName} BLACKLISTED: No valid math expression (has numbers: ${hasNumbers}, symbols: ${hasMathSymbols}, keywords: ${hasMathKeywords})`);
        return 0;
      }
    }
    
    // DateTime tool - ต้องมีคำเกี่ยวกับเวลา/วันที่
    // ===== TODO 7 FIX: Better datetime keyword detection =====
    if (toolName.includes('dateTime')) {
      const hasDateTimeKeywords = /(?:กี่โมง|เวลา|วันที่|วันนี้|พรุ่งนี้|เมื่อวาน|ตอนนี้|เดี๋ยวนี้|ปัจจุบัน|ขณะนี้|time|date|today|tomorrow|yesterday|now|current|taskbar)/i.test(userMessage);
      if (!hasDateTimeKeywords) {
        console.log(`[Score] ${toolName} BLACKLISTED: No datetime keywords`);
        return 0;
      }
    }
    
    // Weather tool - ต้องมีคำเกี่ยวกับอากาศ
    if (toolName.includes('tmd') || toolName.includes('weather')) {
      const hasWeatherKeywords = /(?:อากาศ|ฝน|อุณหภูมิ|ครึ้ม|มืด|เมฆ|แดด|ร้อน|หนาว|เย็น|ลม|พายุ|ฟ้า|ตก|กรุงเทพ|กทม|weather|temperature|forecast|rain|cloud|storm|wind|bangkok)/i.test(userMessage);
      if (!hasWeatherKeywords) {
        console.log(`[Score] ${toolName} BLACKLISTED: No weather keywords`);
        return 0;
      }
    }

    const description = tool?.description || resource?.description || "";
    const keywords =
      tool?.keywords || (await this.extractKeywords(toolName, description));
    const searchText = `${toolName} ${description} ${keywords.join(
      " "
    )}`.toLowerCase();

    // Use cached tokenization for user message
    const userTokens = await this.tokenizeThaiWithOllama(userMessage);

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

    // 🌟 PRIORITY BOOST: NWP/TMD tools (official Thai weather sources)
    // ให้ NWP และ TMD ได้คะแนนสูงกว่า weather tools อื่นๆ มาก
    let priorityBonus = 0;
    const isWeatherQuery = /(?:อากาศ|ฝน|อุณหภูมิ|ครึ้ม|มืด|เมฆ|แดด|ร้อน|หนาว|เย็น|ลม|พายุ|ฟ้า|ตก|พยากรณ์|weather|temperature|forecast|rain|cloud|storm|wind)/i.test(userMessage);
    
    if (isWeatherQuery) {
      // ✅ TIER 1: NWP (อันดับสูงสุด - TMD HPC forecast, 2km-27km resolution)
      if (toolName.includes('nwp_')) {
        priorityBonus = 100; // +100 คะแนน (เพิ่มจาก 50)
      }
      // ✅ TIER 2: TMD (อันดับสอง - TMD official data)
      else if (toolName.includes('tmd_weather')) {
        priorityBonus = 60; // +60 คะแนน (เพิ่มจาก 35)
      }
      // ❌ PENALTY: Open-Meteo และ weather tools อื่นๆ (community/third-party)
      else if (toolName.includes('weather') && !toolName.includes('nwp') && !toolName.includes('tmd')) {
        priorityBonus = -20; // -20 คะแนน (ลดจาก +10)
      }
    }

    const totalScore = tfidfScore + fuseScore + categoryScore + priorityBonus;
    
    return totalScore;
  }

  private async deduplicateAndRankTools(
    candidates: string[],
    userMessage: string
  ): Promise<string[]> {
    if (candidates.length === 0) return [];

    const uniqueCandidates = [...new Set(candidates)];
    
    console.log(`\n╔════════════════════════════════════════════════════════╗`);
    console.log(`║  🔍 TOOL SELECTION PROCESS                             ║`);
    console.log(`╠════════════════════════════════════════════════════════╣`);
    console.log(`║  Query: "${userMessage.slice(0, 40)}${userMessage.length > 40 ? '...' : ''}"`);
    console.log(`║  Candidates: ${uniqueCandidates.length} tools`);
    console.log(`╚════════════════════════════════════════════════════════╝\n`);

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
      if (greetingResource) {
        return [greetingResource.toolName];
      }
    }

    // ===== Minimum score threshold =====
    const MINIMUM_SCORE_THRESHOLD = 10;
    const topScore = sorted[0]?.score || 0;
    
    const selected = sorted
      .filter((t) => {
        const passesMinimum = t.score >= MINIMUM_SCORE_THRESHOLD;
        const passesRelative = t.score >= topScore * 0.7;
        return passesMinimum && passesRelative;
      })
      .slice(0, 10);

    return selected.map((t) => t.toolName);
  }

  async selectTools(
    userMessage: string,
    semanticHint?: string,
    options?: {
      uiMode?: string;
      boostedTools?: string[];
    }
  ): Promise<string[]> {
    const officerMode = options?.uiMode === "officer";
    // 0) Normalize
    const q = (userMessage ?? "").trim();
    const qLower = q.toLowerCase();

    // 1) Early exit: greetings / chit-chat
    if (this.isGreetingQuery(q)) return [];

    // 2) Hard overrides (must-win rules)
    const is7DayQuery =
      /(\b7\b\s*วัน|เจ็ด\s*วัน|สัปดาห์นี้|สัปดาห์หน้า|7day|7-day|weekly)/i.test(q);

    const isWeatherQuery =
      /(อากาศ|ฝน|อุณหภูมิ|พยากรณ์|สภาพอากาศ|weather|temperature|forecast|rain|storm|wind)/i.test(q);

    // PDPA / "ที่เราเคยเก็บไว้" = recall / memory intent
    const isRecallQuery =
      /(เคยเก็บไว้|ที่เราเคย|สรุป.*(ที่|จาก).*เก็บ|สรุป\s*pdpa|pdpa\s*ที่|memory|rag)/i.test(q);

    // Earthquake
    const isEarthquakeQuery = /(แผ่นดินไหว|earthquake|seismic|ริกเตอร์|richter)/i.test(q);

    // ✅ RULE A: 7-day weather MUST use TMD 7 days tool (prevents 3-hours tool misuse)
    if (is7DayQuery && isWeatherQuery) {
      return ["innomcp-server:tmd_weather_forecast_7days_by_province"];
    }

    // ✅ RULE B: Recall/Memo MUST NOT go to rssFeedTool
    // Prefer workspace/file reader tools you already have
    if (isRecallQuery) {
      // if you have a memory tool later, swap this to innomcp-server:memory_search (or whatever actual name is)
      // For now: fileReaderTool is the safest deterministic tool.
      return ["innomcp-server:fileReaderTool"];
    }

    // 3) Cache policy (bypass cache for volatile categories)
    const shouldBypassCache = isWeatherQuery || isEarthquakeQuery || isRecallQuery || officerMode;

    if (!shouldBypassCache) {
      const cached = this.getCachedSelection(q);
      if (cached) return cached;
    }

    // 4) Optional semantic hint log (no behavior change here)
    if (semanticHint && semanticHint !== "general") {
      logger.info(`[selectTools] 🧠 Using semantic hint: "${semanticHint}" for tool selection`);
    }

    // 5) Sanity: available tools
    const availableTools = this.getAvailableTools();
    const availableToolNames = availableTools.map((t) => t.name);
    if (availableTools.length === 0) {
      logger.error(`[MCP Client] ❌ No available tools. Aborting selection.`);
      return [];
    }

    const looksLikeOfficerEvidenceQuery = (text: string): boolean => {
      // Officer mode should bias toward evidence-related tools, but avoid hijacking unrelated questions.
      return /(machine|machines|เครื่อง|ออนไลน์|online|evidence|หลักฐาน|วิดีโอ|video|record|records|nip|ตรวจ|monitor|mdes)/i.test(text || "");
    };

    const applyBoostOrdering = (candidates: string[]): string[] => {
      const boosted = options?.boostedTools || [];
      if (!boosted || boosted.length === 0) return candidates;

      const isBoostedTool = (toolName: string): boolean => {
        const t = String(toolName || "");
        return boosted.some((b) => {
          const key = String(b || "").trim();
          if (!key) return false;
          if (key === "webdTool") return t.includes(":webdTool") || t.includes("webdTool_");
          if (key === "evidenceTool") return t.endsWith(":evidenceTool") || t.includes(":evidenceTool") || t.endsWith("evidenceTool");
          // generic: exact or suffix match
          return t === key || t.endsWith(`:${key}`) || t.includes(`:${key}`);
        });
      };

      const boostedFirst: string[] = [];
      const rest: string[] = [];
      for (const name of candidates) {
        if (isBoostedTool(name)) boostedFirst.push(name);
        else rest.push(name);
      }
      return [...boostedFirst, ...rest];
    };

    const ensureOfficerSeedCandidates = (candidates: string[]): string[] => {
      if (!officerMode) return candidates;
      if (!looksLikeOfficerEvidenceQuery(q)) return candidates;

      const out = [...candidates];
      const findTool = (suffixOrExact: string): string | undefined => {
        const s = String(suffixOrExact || "");
        return availableToolNames.find((t) => t === s || t.endsWith(`:${s}`) || t.includes(`:${s}`));
      };

      const evidence = findTool("evidenceTool");
      if (evidence && !out.includes(evidence)) out.push(evidence);

      // Optional local fallback tool (still keep other tools allowed)
      const localDetect = findTool("detect_evidence_stats");
      if (localDetect && !out.includes(localDetect)) out.push(localDetect);

      // Prefer a representative webd tool entry point if present
      const webdGroup = availableToolNames.find((t) => t.includes(":webdTool_group"));
      if (webdGroup && !out.includes(webdGroup)) out.push(webdGroup);

      return out;
    };

    // 6) Normal selection pipeline (fast → slower)
    let candidates: string[] = [];

    candidates = this.directKeywordCheck(q);

    if (candidates.length === 0) {
      candidates = await this.tryPatternMatching(q);
    }

    if (candidates.length === 0) {
      candidates = await this.tryKeywordMatching(q);
    }

    if (candidates.length === 0) {
      candidates = await this.tryAISelection(q);
    }

    // Officer mode: seed and boost evidence tools (without removing others)
    candidates = ensureOfficerSeedCandidates(candidates);
    candidates = applyBoostOrdering(candidates);

    // 7) Finalize: allow top-3 for chaining/parallel, BUT still stable
    const finalSelection = candidates.slice(0, 3);

    if (!shouldBypassCache) {
      this.cacheSelection(q, finalSelection);
    }
    this.addToHistory(q, finalSelection);

    return finalSelection;
  }


  /**
   * Direct keyword matching against category keywords
   * This is a fast path to catch common queries before fuzzy matching
   */
  private directKeywordCheck(userMessage: string): string[] {
    const msgLower = userMessage.toLowerCase();
    const candidates = new Map<string, { name: string; score: number }>();

    // ⏰ TIME-SPECIFIC DETECTION (ต้องการข้อมูลรายชั่วโมง)
    // ตรวจจับคำที่บอกช่วงเวลาของวัน (เช้า/บ่าย/เย็น/คืน)
    const isTimeSpecific = /(?:เช้า|สาย|บ่าย|เย็น|ค่ำ|คืน|กลางคืน|กลางวัน|morning|afternoon|evening|night|midnight|noon)/i.test(userMessage);
    const hasExplicitTime = /(?:\d{1,2}(?::\d{2})?\s*(?:โมง|น\.|นาฬิกา|am|pm))/i.test(userMessage); // เช่น "5 โมงเย็น", "18:00"
    const needsHourlyData = isTimeSpecific || hasExplicitTime;
    
    // 🕐 TEMPORAL DETECTION (past/present/future)
    // หมายเหตุ: "วันนี้" + time-specific (เช้า/เย็น) = PRESENT HOURLY, ไม่ใช่ future
    const hasTodayKeyword = /(?:วันนี้|today)/i.test(userMessage);
    const hasFutureKeyword = /(?:พรุ่งนี้|วันหลัง|สัปดาห์หน้า|เดือนหน้า|ปีหน้า|tomorrow|next week|next month|later)/i.test(userMessage);
    const hasTonightKeyword = /(?:คืนนี้|tonight)/i.test(userMessage);
    const hasWillAux = /(?:จะ|กำลังจะ|will)/i.test(userMessage); // คำช่วย "จะ" (may indicate future but weak signal)
    
    // ลำดับความสำคัญ: today + time-specific > tonight > future keywords > "จะ"
    const isPresentQuery = hasTodayKeyword && !hasFutureKeyword; // "วันนี้" = present (unless combined with "พรุ่งนี้")
    const isFutureQuery = hasFutureKeyword || (hasTonightKeyword && !hasTodayKeyword) || (hasWillAux && !hasTodayKeyword && !needsHourlyData);
    const isPastQuery = /(?:เมื่อวาน|เมื่อคืน|สัปดาห์ที่แล้ว|เดือนที่แล้ว|yesterday|last|past)/i.test(userMessage);

    // 📍 LOCATION DETECTION & MAPPING (77 จังหวัด + ชื่อเรียกทั่วไป)
    // อย่าลืมแมปชื่อจังหวัดจาก db
    const locationMap: { [key: string]: string } = {
      // ภาคเหนือ
      'เชียงราย': 'เชียงราย',
      'chiang rai': 'เชียงราย',
      'เชียงใหม่': 'เชียงใหม่',
      'chiang mai': 'เชียงใหม่',
      'แม่ฮ่องสอน': 'แม่ฮ่องสอน',
      'ลำปาง': 'ลำปาง',
      'ลำพูน': 'ลำพูน',
      'พะเยา': 'พะเยา',
      'แพร่': 'แพร่',
      'น่าน': 'น่าน',
      'อุตรดิตถ์': 'อุตรดิตถ์',
      'ตาก': 'ตาก',
      'พิษณุโลก': 'พิษณุโลก',
      'สุโขทัย': 'สุโขทัย',
      'กำแพงเพชร': 'กำแพงเพชร',
      'พิจิตร': 'พิจิตร',
      'เพชรบูรณ์': 'เพชรบูรณ์',
      
      // ภาคกลาง
      'กรุงเทพ': 'กรุงเทพมหานคร',
      'กทม': 'กรุงเทพมหานคร',
      'กทม.': 'กรุงเทพมหานคร',
      'bangkok': 'กรุงเทพมหานคร',
      'นครปฐม': 'นครปฐม',
      'ปทุมธานี': 'ปทุมธานี',
      'นนทบุรี': 'นนทบุรี',
      'สมุทรปราการ': 'สมุทรปราการ',
      'สมุทรสาคร': 'สมุทรสาคร',
      'สมุทรสงคราม': 'สมุทรสงคราม',
      'แม่กลอง': 'สมุทรสงคราม',  // อำเภอเมืองสมุทรสงคราม
      'mae klong': 'สมุทรสงคราม',
      'ราชบุรี': 'ราชบุรี',
      'กาญจนบุรี': 'กาญจนบุรี',
      'สุพรรณบุรี': 'สุพรรณบุรี',
      'ลพบุรี': 'ลพบุรี',
      'สิงห์บุรี': 'สิงห์บุรี',
      'ชัยนาท': 'ชัยนาท',
      'อ่างทอง': 'อ่างทอง',
      'สระบุรี': 'สระบุรี',
      'อยุธยา': 'พระนครศรีอยุธยา',
      'พระนครศรีอยุธยา': 'พระนครศรีอยุธยา',
      
      // ภาคตะวันออก
      'ชลบุรี': 'ชลบุรี',
      'พัทยา': 'ชลบุรี',
      'pattaya': 'ชลบุรี',
      'ระยอง': 'ระยอง',
      'จันทบุรี': 'จันทบุรี',
      'ตราด': 'ตราด',
      'ฉะเชิงเทรา': 'ฉะเชิงเทรา',
      'ปราจีนบุรี': 'ปราจีนบุรี',
      'นครนายก': 'นครนายก',
      'สระแก้ว': 'สระแก้ว',
      
      // ภาคตะวันออกเฉียงเหนือ (อีสาน)
      'นครราชสีมา': 'นครราชสีมา',
      'โคราช': 'นครราชสีมา',
      'korat': 'นครราชสีมา',
      'ขอนแก่น': 'ขอนแก่น',
      'khon kaen': 'ขอนแก่น',
      'อุดรธานี': 'อุดรธานี',
      'udon thani': 'อุดรธานี',
      'อุบลราชธานี': 'อุบลราชธานี',
      'ubon': 'อุบลราชธานี',
      'นครพนม': 'นครพนม',
      'มุกดาหาร': 'มุกดาหาร',
      'สกลนคร': 'สกลนคร',
      'บุรีรัมย์': 'บุรีรัมย์',
      'สุรินทร์': 'สุรินทร์',
      'ศรีสะเกษ': 'ศรีสะเกษ',
      'ยโสธร': 'ยโสธร',
      'กาฬสินธุ์': 'กาฬสินธุ์',
      'มหาสารคาม': 'มหาสารคาม',
      'ร้อยเอ็ด': 'ร้อยเอ็ด',
      'เลย': 'เลย',
      'หนองคาย': 'หนองคาย',
      'หนองบัวลำภู': 'หนองบัวลำภู',
      'บึงกาฬ': 'บึงกาฬ',
      'ชัยภูมิ': 'ชัยภูมิ',
      'อำนาจเจริญ': 'อำนาจเจริญ',
      
      // ภาคใต้
      'ภูเก็ต': 'ภูเก็ต',
      'phuket': 'ภูเก็ต',
      'สุราษฎร์ธานี': 'สุราษฎร์ธานี',
      'นครศรีธรรมราช': 'นครศรีธรรมราช',
      'กระบี่': 'กระบี่',
      'krabi': 'กระบี่',
      'พังงา': 'พังงา',
      'ตรัง': 'ตรัง',
      'สงขลา': 'สงขลา',
      'songkhla': 'สงขลา',
      'หาดใหญ่': 'สงขลา',
      'hat yai': 'สงขลา',
      'ปัตตานี': 'ปัตตานี',
      'ยะลา': 'ยะลา',
      'นราธิวาส': 'นราธิวาส',
      'พัทลุง': 'พัทลุง',
      'สตูล': 'สตูล',
      'ชุมพร': 'ชุมพร',
      'ระนอง': 'ระนอง',
      'เกาะสมุย': 'สุราษฎร์ธานี',
      'koh samui': 'สุราษฎร์ธานี'
    };
    let detectedLocation = '';
    for (const [alias, fullName] of Object.entries(locationMap)) {
      if (msgLower.includes(alias.toLowerCase())) {
        detectedLocation = fullName;
        break;
      }
    }

    // Weather query detection
    const isWeatherQuery = /(?:อากาศ|ฝน|อุณหภูมิ|พยากรณ์|หนาว|ร้อน|weather|rain|temp)/i.test(userMessage);

    // 🔥 WEATHER TOOLS BOOST - Apply to ALL weather-related tools (even without category)
    if (isWeatherQuery) {
      for (const [toolName, tool] of this.tools.entries()) {
        // Check if tool is weather-related (by name pattern or category)
        const isWeatherTool = tool.category === 'weather' || 
          toolName.includes('weather') || 
          toolName.includes('nwp_') || 
          toolName.includes('tmd_');
        
        if (!isWeatherTool) continue;

        let score = 1;

        // ⏰ TIME-SPECIFIC queries (เช้า/บ่าย/เย็น/คืน) → HOURLY tools ONLY
        if (needsHourlyData) {
          if (toolName.includes('nwp_hourly_by_place')) {
            score += 300;  // 🥇 BEST for hourly weather with place name
            candidates.set(toolName, { name: toolName, score });
            console.log(`[MCP Client] ⏰ Hourly boost: ${toolName.split(':')[1]} = ${score}`);
          } else if (toolName.includes('nwp_hourly_by_location')) {
            score += 280;  // 🥈 Good for hourly weather with lat/lon
            candidates.set(toolName, { name: toolName, score });
          } else if (toolName.includes('nwp_hourly_by_region')) {
            score += 260;  // 🥉 Regional hourly data
            candidates.set(toolName, { name: toolName, score });
          } else if (toolName.includes('tmd_weather_3hours')) {
            score += 200;  // Current 3-hour data (less precise than hourly)
            candidates.set(toolName, { name: toolName, score });
          } else if (toolName.includes('forecast_7days') || toolName.includes('nwp_daily')) {
            score -= 200;  // ❌ Daily forecast NOT suitable for time-specific queries
          } else if (toolName.includes('forecast') || toolName.includes('daily')) {
            score -= 150;  // ❌ Any other daily/forecast tools
          }
        }
        // 🕐 FUTURE queries (general, no specific time) → Forecast tools
        else if (isFutureQuery && !needsHourlyData) {
          // 🚨 NWP PRIORITY: Check if query mentions specific days (3,5,7,10,14)
          const dayMatch = userMessage.match(/(\d+)\s*(วัน|days?)/i);
          const requestedDays = dayMatch ? parseInt(dayMatch[1], 10) : 0;
          
          // 🌟 NWP DAILY tools (10-14 days, superior to TMD's 7 days)
          if (requestedDays > 7 || /10\s*วัน|14\s*วัน|สัปดาห์|week/i.test(userMessage)) {
            if (toolName.includes('nwp_daily')) {
              score += 400;  // 🥇🥇 ABSOLUTE BEST: NWP can do 10-14 days!
              candidates.set(toolName, { name: toolName, score });
              console.log(`[MCP Client] 🌟 NWP DAILY BOOST (${requestedDays} days): ${toolName.split(':')[1]} = ${score}`);
            } else if (toolName.includes('forecast_7days')) {
              score -= 150;  // ❌ TMD limited to 7 days
            }
          }
          // 🌟 Query mentions 3-7 days → NWP still better (hourly resolution)
          else if (requestedDays >= 3 || /3\s*วัน|5\s*วัน|7\s*วัน/i.test(userMessage)) {
            if (toolName.includes('nwp_daily')) {
              score += 350;  // 🥇 NWP daily best for 3-7 days
              candidates.set(toolName, { name: toolName, score });
              console.log(`[MCP Client] 🌟 NWP DAILY BOOST (${requestedDays} days): ${toolName.split(':')[1]} = ${score}`);
            } else if (toolName.includes('nwp_hourly')) {
              score += 250;  // 🥈 NWP hourly good for 3-7 days (more detail)
              candidates.set(toolName, { name: toolName, score });
            } else if (toolName.includes('forecast_7days')) {
              score += 100;  // 🥉 TMD acceptable but less detail
            }
          }
          // Generic future (no specific days) → TMD forecast acceptable
          else {
            if (toolName.includes('forecast_7days')) {
              score += 200;  // 🥇 BEST for generic future weather
              candidates.set(toolName, { name: toolName, score });
            } else if (toolName.includes('nwp_daily') || toolName.includes('nwp_3days')) {
              score += 180;  // 🥈 Good for future
              candidates.set(toolName, { name: toolName, score });
            } else if (toolName.includes('3hours') || toolName.includes('today')) {
              score -= 100;  // ❌ Current data not suitable for future
            }
          }
        }
        // 🕐 PRESENT queries → Current weather tools
        else if (isPresentQuery || (!isFutureQuery && !isPastQuery)) {
          if (toolName.includes('tmd_weather_3hours_all_stations')) {
            score += 150;  // 🥇 BEST: No params, all stations
            candidates.set(toolName, { name: toolName, score });
          } else if (toolName.includes('nwp_hourly_by_place')) {
            score += 140;  // 🥈 Good: Hourly data
            candidates.set(toolName, { name: toolName, score });
          } else if (toolName.includes('today')) {
            score += 120;  // 🥉 Good: Today's weather
            candidates.set(toolName, { name: toolName, score });
          } else if (toolName.includes('forecast')) {
            score += 50;   // Lower: Forecast less relevant for "now"
          }
        }

        // 📍 LOCATION-SPECIFIC tools get bonus if location detected
        if (detectedLocation && toolName.includes('by_province')) {
          score += 30;  // Bonus for province-specific tools
          const existing = candidates.get(toolName);
          candidates.set(toolName, { name: toolName, score: (existing?.score || 0) + 30 });
        }
      }
    }

    // Check each category's keywords (for non-weather tools and additional matches)
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (msgLower.includes(keyword.toLowerCase())) {
          // Find matching tools/resources for this category
          for (const [toolName, tool] of this.tools.entries()) {
            if (tool.category === category) {
              // Skip if already processed by weather logic above
              if (isWeatherQuery && (toolName.includes('weather') || toolName.includes('nwp_') || toolName.includes('tmd_'))) {
                continue;
              }

              let score = 1;

              // 🌍 EARTHQUAKE TOOLS BOOST
              if (category === 'earthquake' && toolName.includes('seismic')) {
                score += 500;  // High priority for earthquake queries
                console.log(`[MCP Client] 🌍 Earthquake boost: ${toolName.split(':')[1]} = ${score + 1}`);
              }

              // Add keyword match bonus
              const keywordCount = tool.keywords?.filter(k => 
                msgLower.includes(k.toLowerCase())
              ).length || 0;
              score += keywordCount * 5;

              const existing = candidates.get(toolName);
              if (!existing || score > existing.score) {
                candidates.set(toolName, { name: toolName, score });
              }
            }
          }
          for (const [resourceName, resource] of this.resources.entries()) {
            if (resource.name.toLowerCase().includes(category)) {
              const existing = candidates.get(resourceName);
              const score = (existing?.score || 0) + 1;
              candidates.set(resourceName, { name: resourceName, score });
            }
          }
        }
      }
    }

    // Sort by score (descending) and return top 3
    const sorted = Array.from(candidates.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (sorted.length > 0) {
      // แสดง context ให้ชัดเจน: HOURLY มี priority สูงสุด
      let timeContext = '';
      if (needsHourlyData) {
        timeContext = '⏰ HOURLY';
        if (hasTodayKeyword) timeContext += ' (วันนี้)';
        else if (hasTonightKeyword) timeContext += ' (คืนนี้)';
      } else if (isFutureQuery) {
        timeContext = '🔮 FUTURE';
      } else if (isPresentQuery) {
        timeContext = '⏰ NOW';
      }
      
      const locContext = detectedLocation ? `📍 ${detectedLocation}` : '';
      console.log(`[MCP Client] 🎯 Context: ${timeContext} ${locContext}`.trim());
      console.log('[MCP Client] 🎯 Tool priority scores:', 
        sorted.map(c => `${c.name.split(':')[1] || c.name}: ${c.score}`).join(', ')
      );
      return sorted.map(c => c.name);
    }
    
    // ✅ FALLBACK: ถ้าไม่มี tool ถูกเลือกแต่มี location → ให้เลือก weather tool
    if (detectedLocation && sorted.length === 0) {
      // เลือก weather tool ที่เหมาะสมตาม time context
      let defaultTool = 'innomcp-server:nwp_daily_by_location'; // default: 7-day forecast
      
      if (needsHourlyData) {
        // ต้องการข้อมูลรายชั่วโมง (เช้า/บ่าย/เย็น/คืน)
        defaultTool = 'innomcp-server:nwp_hourly_by_place';
      } else if (isFutureQuery) {
        defaultTool = 'innomcp-server:forecast_7days'; // future → 7-day forecast
      } else if (isPresentQuery) {
        defaultTool = 'innomcp-server:tmd_weather_3hours_all_stations'; // now → current weather
      }
      
      // ตรวจสอบว่า tool มีอยู่จริง
      if (this.tools.has(defaultTool)) {
        return [defaultTool];
      }
    }

    return sorted.map(c => c.name);
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
    
    // ✅ FIX: ใช้เฉพาะ tools ที่ active
    const availableTools = this.getAvailableTools();
    const availableToolNames = new Set(availableTools.map(t => t.name));

    for (const pr of results) {
      const origPattern: ToolPattern = pr.item.pattern;
      const priorityScore = origPattern.priority === "high" ? 15 : 8;

      // ✅ กรองเฉพาะ active tools
      const matchedTools = Array.from(this.tools.entries()).filter(([k, tool]) => {
        if (!availableToolNames.has(k)) return false; // ข้าม disabled tools
        
        return origPattern.toolPattern.test(k) || 
          origPattern.toolPattern.test(tool.description || "") ||
          origPattern.category === tool.category;
      }).map(([k]) => k);

      const matchedResources = Array.from(this.resources.entries()).filter(([k, resource]) =>
        origPattern.toolPattern.test(k) ||
        origPattern.toolPattern.test(resource.description || "")
      ).map(([k]) => k);

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
    // Use cached tokenization
    const allTokens = await this.tokenizeThaiWithOllama(userMessage);

    // ✅ FIX: Use ALL tools from Map (no filter - getAvailableTools already returns all)
    const toolData = Array.from(this.tools.entries())
      .map(([toolName, tool]) => ({
        id: toolName,
        searchText: `${toolName} ${tool.description} ${tool.keywords.join(
          " "
        )}`.toLowerCase(),
      }));

    const resourceData = Array.from(this.resources.entries()).map(
      ([resourceName, resource]) => ({
        id: resourceName,
        searchText:
          `${resourceName} ${resource.description} ${resource.title}`.toLowerCase(),
      })
    );

    const combined = [...toolData, ...resourceData];
    console.log(`[MCP Client] Searching across ${combined.length} tools/resources (${toolData.length} active tools)`);
    
    // ===== TODO 4 FIX: Stricter threshold for better matching =====
    const dataFuse = makeFuse(combined as any, {
      keys: ["searchText"],
      threshold: 0.3,  // Changed from 0.4 to 0.3 for stricter matching
      ignoreLocation: true,
    });

    const tokenResults: any[] = [];
    for (const token of allTokens) {
      if (token.length < 2) continue;
      const results = runSearch(dataFuse, token) as any[];
      console.log(`[MCP Client] Token "${token}" matched ${results.length} items`);
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
      // ✅ FIX: Use ALL tools (no filter)
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

      const prompt = `Select the most appropriate tool(s) for this query (max 3 tools).

Query: "${userMessage}"

Available tools:
${toolDescriptions}

Rules:
1. Select 1-3 relevant tools
2. If no suitable tool exists, respond with: none
3. For multiple steps (e.g., fetch data then visualize), select multiple tools

IMPORTANT: Respond with ONLY tool names separated by commas, or "none". Do NOT add any explanation, greeting, or extra text.

Examples:
- "dateTimeTool"
- "calculatorTool, archive"
- "none"

Your answer:`;

      const response = await this.chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.05, num_predict: 50 },  // Lower temp for deterministic output
        'fast'  // Tool selection is fast
      );

      const rawText = String(response?.message?.content || "").trim();

      if (rawText.toLowerCase().includes("none")) {
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
      
      // FALLBACK: Use direct pattern matching for common queries
      console.log("[MCP Client] Falling back to pattern matching...");
      
      const msg = userMessage.toLowerCase();
      
      // DateTime patterns
      if (/(?:กี่โมง|เวลา|ตอนนี้.*(?:time|เวลา)|วันที่|what.*time|current.*time)/.test(msg)) {
        console.log("[MCP Client] Fallback matched: dateTimeTool");
        return ["innomcp-server:dateTimeTool"];
      }
      
      // Calculator patterns
      if (/\d+.*[\+\-\*\/\×\÷\^]|(?:คำนวณ|calculate|factorial)/.test(msg)) {
        console.log("[MCP Client] Fallback matched: calculatorTool");
        return ["innomcp-server:calculatorTool"];
      }
      
      // Weather patterns - Use NWP (TIER 1) instead of OpenWeather
      if (/(?:พยากรณ์.*อากาศ|สภาพอากาศ|weather|forecast|อากาศ.*ร้อน|อากาศ.*หนาว|ฝน|ตก)/.test(msg)) {
        console.log("[MCP Client] Fallback matched: nwp_hourly_by_place (Thai official weather)");
        return ["innomcp-server:nwp_hourly_by_place"];
      }
      
      // Newton (calculus) patterns
      if (/(?:อนุพันธ์|ปริพันธ์|อินทิเกรต|derivative|integral|integrate)/.test(msg)) {
        console.log("[MCP Client] Fallback matched: newton");
        return ["innomcp-server:newton"];
      }
      
      return [];
    }
  }

  private async tokenizeThaiWithOllama(text: string): Promise<string[]> {
    // Check cache first
    const cached = this.tokenCache.get(text);
    if (cached && Date.now() - cached.timestamp < this.tokenCacheTTL) {
      return cached.tokens;
    }

    try {
      // ✅ FIX: Enhanced Thai tokenization with common word dictionary
      const commonThaiWords = [
        'กรุงเทพ', 'เชียงใหม่', 'ภูเก็ต', 'ขอนแก่น', 'นครราชสีมา', 'อุบลราชธานี',
        'อากาศ', 'ฝน', 'อุณหภูมิ', 'ลม', 'พายุ', 'ความชื้น', 'เมฆ', 'แดด',
        'ตก', 'หนาว', 'ร้อน', 'เย็น', 'วันนี้', 'พรุ่งนี้', 'เมื่อวาน',
        'ตอนนี้', 'เท่าไหร่', 'อย่างไร', 'ไหม', 'หรือ', 'และ', 'ที่',
        'พยากรณ์', 'สภาพ', 'ประเทศไทย', 'ภาค', 'จังหวัด', 'สถานี',
        'แผ่นดินไหว', 'คำเตือน', 'ปริมาณ', 'สูงสุด', 'ต่ำสุด'
      ];
      
      let textLower = text.toLowerCase();
      const tokens: string[] = [];
      
      // Extract known words first (greedy longest match)
      commonThaiWords.sort((a, b) => b.length - a.length); // Longest first
      for (const word of commonThaiWords) {
        if (textLower.includes(word)) {
          tokens.push(word);
          textLower = textLower.replace(new RegExp(word, 'g'), ' '); // Remove to avoid duplicates
        }
      }
      
      // Extract remaining Thai characters (fallback)
      const thaiPattern = /[ก-๙]{2,}/g;
      const remainingThai = textLower.match(thaiPattern) || [];
      tokens.push(...remainingThai);
      
      // English and numbers
      const englishPattern = /[a-zA-Z]+/g;
      const numberPattern = /[0-9]+/g;
      const englishTokens = text.match(englishPattern) || [];
      const numberTokens = text.match(numberPattern) || [];
      
      const finalTokens = [...new Set([...tokens, ...englishTokens, ...numberTokens])]
        .filter((t) => t.length > 1); // At least 2 chars

      // Cache the result
      this.tokenCache.set(text, { tokens: finalTokens, timestamp: Date.now() });
      
      // Clean old cache entries
      if (this.tokenCache.size > 1000) {
        const now = Date.now();
        for (const [key, value] of this.tokenCache.entries()) {
          if (now - value.timestamp > this.tokenCacheTTL) {
            this.tokenCache.delete(key);
          }
        }
      }

      return finalTokens;
    } catch (error) {
      console.warn("[MCP Client] Tokenization failed:", error);
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

function InitMcpClient(
  ollama: Ollama,
  ollamaModel: string,
  multiAIConfig?: {
    aiMode?: 'local' | 'remote' | 'hybrid';
    localOllama?: Ollama;
    remoteOllama?: Ollama;
    localModel?: string;
    remoteModel?: string;
  }
): IntelligentMCPClient {
  // Create MCP client with multi-AI support
  const mcpClient = new IntelligentMCPClient(ollama, ollamaModel, multiAIConfig);

  const mcpServerUrl = process.env.MCPSERVER_URL || "http://localhost:3012/mcp";

  // Use HTTP-based configs instead of stdio
  const configs: MCPClientConfig[] = [
    {
      name: "innomcp-server",
      version: "1.0.0",
      serverUrl: mcpServerUrl,
    },
  ];

  mcpClient
    .initializeClients(configs)
    .then(() => {
      mcpClient.emit("ready");
    })
    .catch((err) => {
      console.error("[MCP Client] Initialization error:", err);
      console.error("[MCP Client] Stack:", err.stack);
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


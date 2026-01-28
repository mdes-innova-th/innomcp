/**
 * MCPClient Constants and Configuration
 * System prompts, patterns, and default values
 */

import { ToolPattern } from "./types";

export const SYSTEM_PROMPT = `คุณเป็น AI ที่จะตอบกลับเป็น JSON เท่านั้น:
1. ตอบกลับเฉพาะ JSON ที่ถูกต้อง (valid JSON) เท่านั้น — ไม่มี HTML, ไม่มี code fence, ไม่มีข้อความนอก JSON
2. JSON ต้องมีฟิลด์ระดับบนสุดชื่อ "markdown" ซึ่งเป็นข้อความสตริงที่มีคำตอบสำหรับผู้ใช้ในรูปแบบ Markdown
3. โครงสร้าง JSON สามารถมีฟิลด์เพิ่มเติมได้ เช่น "success", "data", "meta" ฯลฯ แต่ต้องมี "markdown" เสมอ
4. หากไม่สามารถให้ข้อมูลตามคำขอ ให้ตอบเป็น JSON เช่น:
  {"success": false, "error": "สาเหตุที่ไม่สามารถตอบได้", "markdown":""}
5. ห้ามส่งคำอธิบายเพิ่มเติมใดๆ นอก JSON
6. อย่าใส่ styling หรือ HTML tags ใดๆ ในฟิลด์ markdown — ให้ใช้ Markdown ธรรมดาเท่านั้น
7. ภาษาในการคืนค่าควรเป็นไทยเป็นหลัก แต่ข้อความในฟิลด์อื่นๆ สามารถเป็นภาษาอังกฤษได้ตามสมควร
8. ห้ามอธิบายผู้ใช้ทราบว่ามีการใช้ MCP server, MCP tools หรือ tools ใดๆ — เพียงให้ผลลัพธ์สุดท้ายในฟิลด์ markdown เท่านั้น`;

export const TOOL_PATTERNS: ToolPattern[] = [
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
      "พายุ",
      "พายุฝน",
      "พายุฝนฟ้าคะนอง",
      "จังหวัดไหนฝนตก",
      "ตรวจสอบฝน",
      "สถานการณ์ฝน",
    ],
    toolPattern: /^tmdTool/i,
    priority: "high",
    category: "weather",
  },
  {
    keywords: [
      "ระบบ webd",
      "webd",
      "ผิดกฎหมาย",
      "คำสั่งศาล",
      "url",
      "โดเมน",
      "เว็บไซต์",
    ],
    toolPattern: /^webdTool/i,
    priority: "high",
    category: "webd",
  },
  {
    keywords: ["กราฟ", "chart", "graph", "echarts", "visualize"],
    toolPattern: /^echartsTool/i,
    priority: "high",
    category: "visualization",
  },
  {
    keywords: [
      "สถิติ",
      "ข้อมูลชิงสถิติ",
      "statistics",
      "จำนวน",
      "นับ",
      "count",
      "รวม",
      "รวมจำนวน",
      "เปอร์เซ็นต์",
      "percentage",
    ],
    toolPattern: /statistics|stats|count|จำนวน|นับ/i,
    priority: "high",
    category: "statistics",
  },
  {
    keywords: [
      "ข่าวสาร",
      "ข้อมูลข่าว",
      "news",
      "breaking",
      "ข่าวใหม่",
      "ข่าวล่าสุด",
      "ข่าวสายด่วน",
    ],
    toolPattern: /news|breaking|ข่าว/i,
    priority: "high",
    category: "news",
  },
];

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  database: [
    "database",
    "sql",
    "query",
    "ฐานข้อมูล",
    "คิวรี",
    "ข้อมูล",
    "ดึงข้อมูล",
  ],
  file: ["file", "read", "write", "ไฟล์", "อ่านไฟล์", "เขียนไฟล์"],
  api: ["api", "http", "request", "เรียก api", "ส่งคำขอ"],
  computation: ["math", "calculate", "compute", "คำนวณ", "คณิตศาสตร์"],
  datetime: [
    "time",
    "date",
    "datetime",
    "เวลา",
    "วันที่",
    "วันเวลา",
    "เวลาตอนนี้",
  ],
  statistics: [
    "stats",
    "count",
    "statistics",
    "สถิติ",
    "จำนวน",
    "นับ",
    "รวม",
    "เปอร์เซ็นต์",
    "ข้อมูลชิงสถิติ",
  ],
  webd: ["webd", "violation", "ผิดกฎหมาย", "url", "โดเมน", "เว็บ"],
  earthquake: [
    "earthquake",
    "seismic",
    "แผ่นดินไหว",
    "แผ่นดินไหวล่าสุด",
    "แผ่นดินไหววันนี้",
    "ริกเตอร์",
    "richter",
    "จุดศูนย์กลาง",
    "epicenter",
    "진도",
    "地震",
  ],
  weather: [
    "tmd",
    "weather",
    "ฝน",
    "ฝนตก",
    "ฝนตกไหม",
    "ที่ไหนฝนตก",
    "พยากรณ์",
    "อากาศ",
    "สภาพอากาศ",
    "พยากรณ์อากาศ",
    "ลม",
    "ลมแรง",
    "ร้อน",
    "หนาว",
    "อุณหภูมิ",
    "จังหวัดไหนฝนตก",
    "ตรวจสอบฝน",
    "สถานการณ์ฝน",
    "ครึ้ม",
    "มืด",
    "เมฆ",
    "แดด",
    "เย็น",
    "พายุ",
    "ฟ้า",
    "ตก",
    "กรุงเทพ",
    "กทม",
    "ปทุมวัน",
    "บางกอก",
    "bangkok",
    "rain",
    "cloud",
    "storm",
    "wind",
    "forecast",
    "temperature",
  ],
  visualization: ["chart", "graph", "visualize", "กราฟ", "แผนภูมิ"],
  news: ["news", "breaking", "ข่าวสาร", "ข้อมูลข่าว", "ข่าว", "ข่าวใหม่"],
};

export const ENGLISH_STOP_WORDS = [
  "tool",
  "function",
  "method",
  "the",
  "and",
  "for",
  "with",
];

export const THAI_STOP_WORDS = ["การ", "ของ", "ที่", "และ", "ใน"];

export const DEFAULT_OLLAMA_OPTIONS = {
  temperature: 0.2,
  num_predict: 500,
};

export const CACHE_TTL = 300000; // 5 minutes
export const MAX_HISTORY_SIZE = 10;
export const MAX_TOOLS_PER_SELECTION = 3;

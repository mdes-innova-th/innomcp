import "dotenv/config";
import http from "http";
import dotenv from "dotenv";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { set, z } from "zod";

// Per-method parameter schemas (JSON-RPC method name -> zod schema)
const methodParamSchemas: Record<string, z.ZodTypeAny> = {
  // calculator tool via RPC: expects { expression: string }
  "calculator.evaluate": z.object({ expression: z.string().min(1) }),
  // datetime tool: optional format
  "dateTime.get": z.object({ format: z.string().optional() }),
  // text analysis: requires non-empty text
  "textAnalysis.analyze": z.object({ text: z.string().min(1) }),
  // webd count: expects query string
  "webd.violationGroupsCount": z.object({ query: z.string().min(1) }),
};

import app from "./app";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3012", 10);

// Helper: send a JSON-RPC error response (default: -32602 Invalid params)
function sendJsonRpcError(
  res: any,
  id: unknown,
  code = -32602,
  message = "Invalid params",
  data?: any
) {
  res
    .status(400)
    .json({ jsonrpc: "2.0", error: { code, message, data }, id: id ?? null });
}

// Create HTTP server /////////////////////////////////////
const server = http.createServer(app);

// Create an MCP server /////////////////////////////////////
const mcpserver = new McpServer({
  name: "innomcp-server",
  version: "1.0.0",
});

// Add a dynamic greeting resource
mcpserver.registerResource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  {
    title: "Greeting Resource", // Display name for UI
    description: "Dynamic greeting generator",
  },
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `สวัสดี, ${name}!`,
      },
    ],
  })
);

// Register a new tool to interact with the API
// Register a calculator tool
mcpserver.registerTool(
  "calculatorTool",
  {
    title: "Calculator Tool",
    description: "เครื่องคิดเลขสำหรับคำนวณทางคณิตศาสตร์ รองรับการคำนวณพื้นฐาน",
    inputSchema: z.object({
      expression: z
        .string()
        .describe(
          "นิพจน์ทางคณิตศาสตร์ที่ต้องการคำนวณ เช่น 2+2, 10*5, sqrt(16)"
        ),
    }),
    outputSchema: z.object({ result: z.number() }),
  },
  async ({ expression }, _extra) => {
    console.log(
      `[MCP Server] Calculator tool request received at ${new Date().toLocaleString()}`
    ); // Log when a request is received
    try {
      // Simple safe math evaluation
      const safeExpression = expression
        .replace(/[^0-9+\-*/.()sqrt\s]/g, "")
        .replace(/sqrt\(/g, "Math.sqrt(");

      const result = eval(safeExpression);

      return {
        content: [
          { type: "text", text: `คำนวณ "${expression}" = ${result}` } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: { result, expression },
      };
    } catch (error) {
      console.error("Error in calculator:", error);
      throw new Error("ไม่สามารถคำนวณนิพจน์นี้ได้");
    }
  }
);

// Register a time/date tool
mcpserver.registerTool(
  "dateTimeTool",
  {
    title: "Date Time Tool",
    description: "เครื่องมือสำหรับแสดงเวลาและวันที่ในรูปแบบต่างๆ",
    _meta: {
      keywords: [
        "date",
        "time",
        "datetime",
        "current time",
        "current date",
        "today",
        "now",
        "วันเวลา",
        "วันที่",
        "เวลา",
        "วันนี้",
        "ปัจจุบัน",
        "ตอนนี้",
      ],
    },
    inputSchema: z.object({
      format: z
        .string()
        .optional()
        .describe("รูปแบบการแสดงผล เช่น 'thai', 'iso', 'timestamp'"),
    }),
    outputSchema: z.object({ datetime: z.string(), format: z.string() }),
  },
  async ({ format = "thai" }, _extra) => {
    console.log(
      `[MCP Server] DateTime tool request received at ${new Date().toLocaleString()}`
    ); // Log when a request is received
    try {
      const now = new Date();
      let result = "";

      switch (format.toLowerCase()) {
        case "thai":
          result = now.toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          break;
        case "iso":
          result = now.toISOString();
          break;
        case "timestamp":
          result = now.getTime().toString();
          break;
        default:
          result = now.toString();
      }

      return {
        content: [
          { type: "text", text: `วันเวลาปัจจุบัน: ${result}` } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: { datetime: result, format },
      };
    } catch (error) {
      console.error("Error in datetime tool:", error);
      throw error;
    }
  }
);

// Register a text analysis tool for generic/plain text
mcpserver.registerTool(
  "textAnalysisTool",
  {
    title: "Text Analysis Tool (plain text)",
    description:
      "เครื่องมือวิเคราะห์ข้อความทั่วไป: นับคำ นับตัวอักษร และวิเคราะห์เนื้อหาแบบข้อความธรรมดา รองรับทั้งภาษาไทยและภาษาอังกฤษ",
    _meta: {
      keywords: [
        "text analysis",
        "word count",
        "char count",
        "ข้อความ",
        "วิเคราะห์ข้อความ",
      ],
    },
    inputSchema: z.object({
      text: z
        .string()
        .min(1, "ข้อความต้องไม่ว่าง")
        .describe("ข้อความที่ต้องการวิเคราะห์"),
    }),
    outputSchema: z.object({
      content: z.array(
        z.object({
          type: z.literal("text"),
          text: z.string(),
        })
      ),
      structuredContent: z
        .object({
          wordCount: z.number(),
          charCount: z.number(),
          charCountNoSpaces: z.number(),
          sentences: z.number(),
          avgWordsPerSentence: z.number(),
          lines: z.number(),
        })
        .optional(),
    }),
  },
  async ({ text }, _extra) => {
    console.log(
      `[MCP Server] Text analysis tool request received at ${new Date().toLocaleString()}`
    ); // Log when a request is received
    try {
      console.log("[MCP Server] Input text:", text);
      // นับคำ (รองรับทั้งภาษาอังกฤษและภาษาไทย)
      // สำหรับภาษาอังกฤษใช้ whitespace, สำหรับภาษาไทยนับอักขระที่ไม่ใช่ whitespace
      const hasThaiChars = /[\u0E00-\u0E7F]/.test(text);
      let wordCount: number;

      if (hasThaiChars) {
        // สำหรับข้อความภาษาไทย: นับกลุ่มอักขระที่ไม่ใช่ whitespace
        const thaiWords = text.match(/[\u0E00-\u0E7F]+/g) || [];
        const englishWords = text.match(/[a-zA-Z]+/g) || [];
        wordCount = thaiWords.length + englishWords.length;
        console.log("[MCP Server] Thai words:", thaiWords);
        console.log("[MCP Server] English words:", englishWords);
      } else {
        // สำหรับภาษาอังกฤษ: แยกด้วย whitespace
        wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
      }

      const charCount = text.length;
      const charCountNoSpaces = text.replace(/\s/g, "").length;

      // นับประโยค (รองรับเครื่องหมายภาษาไทยและอังกฤษ)
      const sentences = text
        .split(/[.!?।]+/)
        .filter((s) => s.trim().length > 0).length;

      // นับบรรทัด
      const lines = text.split(/\n/).length;

      const analysis = {
        wordCount,
        charCount,
        charCountNoSpaces,
        sentences,
        avgWordsPerSentence:
          sentences > 0 ? Math.round((wordCount / sentences) * 100) / 100 : 0,
        lines,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Text Analysis Results:
- Words: ${analysis.wordCount}
- Characters: ${analysis.charCount} (${analysis.charCountNoSpaces} without spaces)
- Sentences: ${analysis.sentences}
- Average words per sentence: ${analysis.avgWordsPerSentence}
- Lines: ${analysis.lines}`,
          },
        ],
        structuredContent: analysis,
      };
    } catch (error) {
      console.error("[MCP Server] Error in text analysis:", error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error analyzing text: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  }
);

mcpserver.registerTool(
  "webdTool_count_input_by_group",
  {
    title: "Count all input violation records on webD Project",
    description: `ดึงจำนวนเว็บไซต์ผิดกฎหมายแยกตามกลุ่ม (Count violation URLs by category)
    
Returns statistics with these fields:
- group_name (ชื่อกลุ่ม/หมวดหมู่/ประเภท): Category of violation (e.g., "hate speech", "gambling", "pornography")
- url_count (จำนวน URL/จำนวนเว็บไซต์/จำนวนรายการ): Number of URLs in each category

Example response:
{
  "success": true,
  "data": [
    { "group_name": "hate speech", "url_count": 618 },
    { "group_name": "gambling", "url_count": 1523 }
  ]
}`,
    _meta: {
      keywords: [
        "webd",
        "webd project",
        "url",
        "เว็บ",
        "เว็บไซต์",
        "เว็บพนัน",
        "พนัน",
        "เว็บลามก",
        "ลามก",
        "ประเภท",
        "หมวดหมู่",
        "ผิดกฎหมาย",
        "จำนวน",
        "นับ",
        "สถิติ",
        "violation",
        "violation count",
        "การนำเข้า",
      ],
      examples: [
        "ฉันต้องการสถิติเว็บไซต์ผิดกฎหมายบน webd",
        "นับจำนวนรายการนำเข้าเกี่ยวกับเว็บการพนัน ใน webd",
        "แสดงจำนวนเว็บไซต์ผิดกฎหมาย ที่พบใน webd โดยแยกกลุ่ม 'การพนัน'",
      ],
    },
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "คำค้นหาหรือหมวดหมู่ที่ต้องการตรวจสอบ (Search term or category name)"
        ),
    }),
    outputSchema: z.object({
      success: z.boolean().describe("สถานะการดึงข้อมูล (Operation status)"),
      data: z
        .array(
          z.object({
            group_name: z
              .string()
              .describe("ชื่อกลุ่ม/หมวดหมู่ (Category name)"),
            url_count: z.number().describe("จำนวน URL (Number of URLs)"),
          })
        )
        .describe("รายการสถิติแยกตามกลุ่ม (Statistics by category)"),
    }),
  },
  async ({ query }, _extra) => {
    console.log(
      `[MCP Server] Webd count input and group tool request received at ${new Date().toLocaleString()}`
    ); // Log when a request is received
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first (needed by the API)
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      // endpoint in repo returns { csrfToken: "<hash>" }
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      console.log("[MCP Server] CSRF token obtained");

      // Read Set-Cookie header(s)
      // different fetch impl expose headers differently; try both patterns
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        // Node's undici may return single header string
        setCookieHeaders = [cookiehdr];
        console.log("[MCP Server] Set-Cookie header");
      } else {
        // Try to get all 'set-cookie' headers (Fetch API may not support multiple, so fallback to single)
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
          console.log("[MCP Server] Set-Cookie headers array");
        }
      }

      // Build Cookie header: take only name=value from each Set-Cookie
      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim()) // NOTE: simple split; ok for normal cookies
          .join("; ");
      }

      // POST forwarding cookie + x-csrf-token
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/violation-groups-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      console.log("[MCP Server] POST request successful... fetching data");

      const data = await postRes.json();
      console.log("[MCP Server] Violation groups count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching violation groups count:", error);
      throw error;
    }
  }
);

// นับจำนวนรายการนำเข้าเว็บไซต์ผิดกฎหมาย บนโปรเจกต์ webD ที่มีคำสั่งศาล
mcpserver.registerTool(
  "webdTool_count_court_by_group",
  {
    title: "Count all input violation records on webD Project",
    description:
      "แสดงจำนวนรายการนำเข้าเว็บไซต์ผิดกฎหมาย บนโปรเจกต์ webD ที่มีคำสั่งศาล",
    // Helpful keywords to aid model/tool-selection heuristics (put under annotations/_meta)
    _meta: {
      keywords: [
        "webd",
        "webd project",
        "court",
        "คำสั่งศาล",
        "url",
        "เว็บ",
        "เว็บไซต์",
        "เว็บพนัน",
        "พนัน",
        "เว็บลามก",
        "ลามก",
        "ประเภท",
        "หมวดหมู่",
        "ผิดกฎหมาย",
        "จำนวน",
        "นับ",
        "สถิติ",
      ],
      examples: [
        "ฉันต้องการสถิติเว็บไซต์ผิดกฎหมายบน webd ที่มีคำสั่งศาล",
        "นับจำนวนรายการนำเข้าเกี่ยวกับเว็บการพนัน ใน webd ที่มีคำสั่งศาล",
        "แสดงจำนวนเว็บไซต์ผิดกฎหมายการพนันที่มีคำสั่งศาล ใน webd",
      ],
    },
    inputSchema: z.object({
      query: z.string().describe("คำค้นหาหรือหมวดหมู่ที่ต้องการตรวจสอบ"),
    }),
    // The external API returns an object like: { success: boolean, data: [{ group_name, url_count }, ...] }
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          group_name: z.string(),
          url_count: z.number(),
        })
      ),
    }),
  },
  async ({ query }, _extra) => {
    console.log(
      `[MCP Server] Webd count input and group tool request received at ${new Date().toLocaleString()}`
    ); // Log when a request is received
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first (needed by the API)
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      // endpoint in repo returns { csrfToken: "<hash>" }
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      console.log("[MCP Server] CSRF token obtained");

      // Read Set-Cookie header(s)
      // different fetch impl expose headers differently; try both patterns
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        // Node's undici may return single header string
        setCookieHeaders = [cookiehdr];
        console.log("[MCP Server] Set-Cookie header");
      } else {
        // Try to get all 'set-cookie' headers (Fetch API may not support multiple, so fallback to single)
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
          console.log("[MCP Server] Set-Cookie headers array");
        }
      }

      // Build Cookie header: take only name=value from each Set-Cookie
      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim()) // NOTE: simple split; ok for normal cookies
          .join("; ");
      }

      // POST forwarding cookie + x-csrf-token
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/court-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      console.log("[MCP Server] POST request successful... fetching data");

      const data = await postRes.json();
      console.log("[MCP Server] Violation groups count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching violation groups count:", error);
      throw error;
    }
  }
);

// Register webdTool_violation_groups
mcpserver.registerTool(
  "webdTool_violation_groups",
  {
    title: "Get all violation groups on webD Project",
    description: "ดึงรายชื่อประเภทความผิดทั้งหมดจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "violation groups",
        "ประเภทความผิด",
        "หมวดหมู่",
        "ผิดกฎหมาย",
        "violation",
        "groups",
        "categories",
      ],
      examples: [
        "แสดงประเภทความผิดทั้งหมดใน webd",
        "ดึงรายชื่อหมวดหมู่ความผิด",
        "ฉันต้องการดูประเภทการละเมิดทั้งหมด",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(z.string()),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd violation groups tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/violation-groups`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Violation groups data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching violation groups:", error);
      throw error;
    }
  }
);

// Register webdTool_violation_groups_count
mcpserver.registerTool(
  "webdTool_violation_groups_count",
  {
    title: "Count URLs by violation groups on webD Project",
    description: "ดึงจำนวน URL แยกตามประเภทความผิดจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "violation groups count",
        "นับ URL",
        "ประเภทความผิด",
        "สถิติ",
        "violation",
        "count",
        "statistics",
      ],
      examples: [
        "นับจำนวน URL แยกตามประเภทความผิด",
        "แสดงสถิติ URL ตามหมวดหมู่การละเมิด",
        "ฉันต้องการจำนวนเว็บไซต์ผิดกฎหมายแยกตามประเภท",
      ],
    },
    inputSchema: z.object({
      startDate: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("วันที่สิ้นสุด (YYYY-MM-DD)"),
      sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
      selectedGroups: z.array(z.string()).optional().describe("กลุ่มที่เลือก"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          group_name: z.string(),
          url_count: z.number(),
        })
      ),
    }),
  },
  async ({ startDate, endDate, sourceType, selectedGroups }, _extra) => {
    console.log(
      `[MCP Server] Webd violation groups count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      // Read Set-Cookie header(s)
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        setCookieHeaders = [cookiehdr];
      } else {
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
        }
      }

      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim())
          .join("; ");
      }

      // POST request
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/violation-groups-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            startDate,
            endDate,
            sourceType,
            selectedGroups,
          }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      const data = await postRes.json();
      console.log("[MCP Server] Violation groups count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching violation groups count:", error);
      throw error;
    }
  }
);

// Register webdTool_total_count
mcpserver.registerTool(
  "webdTool_total_count",
  {
    title: "Get total URL count on webD Project",
    description: "ดึงจำนวน URL ทั้งหมดสำหรับ donut chart จากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "total count",
        "จำนวนทั้งหมด",
        "donut chart",
        "สถิติ",
        "URL",
        "count",
      ],
      examples: [
        "แสดงจำนวน URL ทั้งหมด",
        "ดึงสถิติรวมสำหรับ donut chart",
        "ฉันต้องการจำนวนเว็บไซต์ทั้งหมดในระบบ",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.number(),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd total count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/total-count`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Total count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching total count:", error);
      throw error;
    }
  }
);

// Register webdTool_petition_count
mcpserver.registerTool(
  "webdTool_petition_count",
  {
    title: "Get petition URL count on webD Project",
    description: "ดึงจำนวน URL จากคำร้องจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "petition count",
        "คำร้อง",
        "จำนวน URL",
        "สถิติ",
        "petition",
      ],
      examples: [
        "แสดงจำนวน URL จากคำร้อง",
        "นับเว็บไซต์ที่มาจากคำร้อง",
        "สถิติคำร้องในระบบ",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.number(),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd petition count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/petition-count`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Petition count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching petition count:", error);
      throw error;
    }
  }
);

// Register webdTool_court_count
mcpserver.registerTool(
  "webdTool_court_count",
  {
    title: "Get court URL count on webD Project",
    description: "ดึงจำนวน URL จากศาลจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "court count",
        "ศาล",
        "คำสั่งศาล",
        "จำนวน URL",
        "สถิติ",
        "court",
      ],
      examples: [
        "แสดงจำนวน URL จากศาล",
        "นับเว็บไซต์ที่มีคำสั่งศาล",
        "สถิติคำสั่งศาลในระบบ",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.number(),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd court count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/court-count`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Court count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching court count:", error);
      throw error;
    }
  }
);

// Register webdTool_ai_count
mcpserver.registerTool(
  "webdTool_ai_count",
  {
    title: "Get AI imported URL count on webD Project",
    description: "ดึงจำนวน URL ที่นำเข้าโดย AI จากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "ai count",
        "AI",
        "นำเข้าโดย AI",
        "จำนวน URL",
        "สถิติ",
        "artificial intelligence",
      ],
      examples: [
        "แสดงจำนวน URL ที่ AI นำเข้า",
        "นับเว็บไซต์จาก AI",
        "สถิติการนำเข้าจาก AI",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.number(),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd AI count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/ai-count`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] AI count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching AI count:", error);
      throw error;
    }
  }
);

// Register webdTool_by_date_count
mcpserver.registerTool(
  "webdTool_by_date_count",
  {
    title: "Count URLs by date and violation groups on webD Project",
    description: "นับจำนวน URL แยกตามวันที่และประเภทความผิดจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "by date count",
        "นับตามวันที่",
        "ประเภทความผิด",
        "สถิติ",
        "date",
        "count",
        "statistics",
      ],
      examples: [
        "นับจำนวน URL แยกตามวันที่และหมวดหมู่",
        "แสดงสถิติ URL ตามวันและประเภทการละเมิด",
        "ฉันต้องการจำนวนเว็บไซต์ผิดกฎหมายแยกตามวันที่",
      ],
    },
    inputSchema: z.object({
      startDate: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("วันที่สิ้นสุด (YYYY-MM-DD)"),
      sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
      selectedGroups: z.array(z.string()).optional().describe("กลุ่มที่เลือก"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          date: z.string(),
          group_name: z.string(),
          url_count: z.number(),
        })
      ),
    }),
  },
  async ({ startDate, endDate, sourceType, selectedGroups }, _extra) => {
    console.log(
      `[MCP Server] Webd by date count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      // Read Set-Cookie header(s)
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        setCookieHeaders = [cookiehdr];
      } else {
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
        }
      }

      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim())
          .join("; ");
      }

      // POST request
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/by-date-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            startDate,
            endDate,
            sourceType,
            selectedGroups,
          }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      const data = await postRes.json();
      console.log("[MCP Server] By date count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching by date count:", error);
      throw error;
    }
  }
);

// Register webdTool_by_month_count
mcpserver.registerTool(
  "webdTool_by_month_count",
  {
    title: "Count URLs by month and violation groups on webD Project",
    description: "นับจำนวน URL แยกตามเดือนและประเภทความผิดจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "by month count",
        "นับตามเดือน",
        "ประเภทความผิด",
        "สถิติ",
        "month",
        "count",
        "statistics",
      ],
      examples: [
        "นับจำนวน URL แยกตามเดือนและหมวดหมู่",
        "แสดงสถิติ URL ตามเดือนและประเภทการละเมิด",
        "ฉันต้องการจำนวนเว็บไซต์ผิดกฎหมายแยกตามเดือน",
      ],
    },
    inputSchema: z.object({
      startMonth: z.string().optional().describe("เดือนเริ่มต้น (YYYY-MM)"),
      endMonth: z.string().optional().describe("เดือนสิ้นสุด (YYYY-MM)"),
      sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
      selectedGroups: z.array(z.string()).optional().describe("กลุ่มที่เลือก"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          month: z.string(),
          group_name: z.string(),
          url_count: z.number(),
        })
      ),
    }),
  },
  async ({ startMonth, endMonth, sourceType, selectedGroups }, _extra) => {
    console.log(
      `[MCP Server] Webd by month count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      // Read Set-Cookie header(s)
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        setCookieHeaders = [cookiehdr];
      } else {
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
        }
      }

      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim())
          .join("; ");
      }

      // POST request
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/by-month-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            startMonth,
            endMonth,
            sourceType,
            selectedGroups,
          }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      const data = await postRes.json();
      console.log("[MCP Server] By month count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching by month count:", error);
      throw error;
    }
  }
);

// Register webdTool_processing_time
mcpserver.registerTool(
  "webdTool_processing_time",
  {
    title: "Get URL processing time statistics on webD Project",
    description: "ดึงเวลาที่ใช้ในการประมวลผล URL จากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "processing time",
        "เวลาประมวลผล",
        "สถิติ",
        "performance",
        "duration",
      ],
      examples: [
        "แสดงเวลาประมวลผล URL",
        "ดึงสถิติเวลาที่ใช้ในการประมวลผล",
        "ฉันต้องการดูเวลาที่ใช้ในการทำงาน",
      ],
    },
    inputSchema: z.object({
      startDate: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("วันที่สิ้นสุด (YYYY-MM-DD)"),
      sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
      durationType: z.string().optional().describe("ประเภทระยะเวลา"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          date: z.string(),
          avg_processing_time: z.number(),
          min_processing_time: z.number(),
          max_processing_time: z.number(),
        })
      ),
    }),
  },
  async ({ startDate, endDate, sourceType, durationType }, _extra) => {
    console.log(
      `[MCP Server] Webd processing time tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      // Read Set-Cookie header(s)
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        setCookieHeaders = [cookiehdr];
      } else {
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
        }
      }

      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim())
          .join("; ");
      }

      // POST request
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/processing-time`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            startDate,
            endDate,
            sourceType,
            durationType,
          }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      const data = await postRes.json();
      console.log("[MCP Server] Processing time data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching processing time:", error);
      throw error;
    }
  }
);

// Register webdTool_by_date_ai_count
mcpserver.registerTool(
  "webdTool_by_date_ai_count",
  {
    title: "Count AI URLs by date on webD Project",
    description: "นับ URL จาก AI แยกตามวันที่จากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "by date ai count",
        "AI ตามวันที่",
        "นับ AI",
        "สถิติ",
        "artificial intelligence",
        "date",
        "count",
      ],
      examples: [
        "นับ URL จาก AI แยกตามวันที่",
        "แสดงสถิติ AI ตามวัน",
        "ฉันต้องการจำนวนเว็บไซต์จาก AI แยกตามวันที่",
      ],
    },
    inputSchema: z.object({
      startDate: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("วันที่สิ้นสุด (YYYY-MM-DD)"),
      sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          date: z.string(),
          ai_url_count: z.number(),
        })
      ),
    }),
  },
  async ({ startDate, endDate, sourceType }, _extra) => {
    console.log(
      `[MCP Server] Webd by date AI count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      // Read Set-Cookie header(s)
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        setCookieHeaders = [cookiehdr];
      } else {
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
        }
      }

      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim())
          .join("; ");
      }

      // POST request
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/by-date-ai-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            startDate,
            endDate,
            sourceType,
          }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      const data = await postRes.json();
      console.log("[MCP Server] By date AI count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching by date AI count:", error);
      throw error;
    }
  }
);

// Register webdTool_by_month_ai_count
mcpserver.registerTool(
  "webdTool_by_month_ai_count",
  {
    title: "Count AI URLs by month on webD Project",
    description: "นับ URL จาก AI แยกตามเดือนจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "by month ai count",
        "AI ตามเดือน",
        "นับ AI",
        "สถิติ",
        "artificial intelligence",
        "month",
        "count",
      ],
      examples: [
        "นับ URL จาก AI แยกตามเดือน",
        "แสดงสถิติ AI ตามเดือน",
        "ฉันต้องการจำนวนเว็บไซต์จาก AI แยกตามเดือน",
      ],
    },
    inputSchema: z.object({
      startMonth: z.string().optional().describe("เดือนเริ่มต้น (YYYY-MM)"),
      endMonth: z.string().optional().describe("เดือนสิ้นสุด (YYYY-MM)"),
      sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
      selectedGroups: z.array(z.string()).optional().describe("กลุ่มที่เลือก"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          month: z.string(),
          ai_url_count: z.number(),
        })
      ),
    }),
  },
  async ({ startMonth, endMonth, sourceType, selectedGroups }, _extra) => {
    console.log(
      `[MCP Server] Webd by month AI count tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      // Fetch CSRF token first
      const csrfRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

      const csrfBody = await csrfRes.json();
      const csrfToken = csrfBody.csrfToken;
      if (!csrfToken) throw new Error("No csrfToken in response");

      // Read Set-Cookie header(s)
      let setCookieHeaders: string[] = [];
      const cookiehdr =
        csrfRes.headers.get && csrfRes.headers.get("set-cookie");
      if (cookiehdr) {
        setCookieHeaders = [cookiehdr];
      } else {
        const cookies = csrfRes.headers.get("set-cookie");
        if (cookies) {
          setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
        }
      }

      let cookieHeader = "";
      if (setCookieHeaders.length) {
        cookieHeader = setCookieHeaders
          .map((s) => s.split(";")[0].trim())
          .join("; ");
      }

      // POST request
      const postRes = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/by-month-ai-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": webddsbApiKey,
            "x-csrf-token": csrfToken,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            startMonth,
            endMonth,
            sourceType,
            selectedGroups,
          }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`API request failed with status ${postRes.status}`);
      }

      const data = await postRes.json();
      console.log("[MCP Server] By month AI count data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching by month AI count:", error);
      throw error;
    }
  }
);

// Register webdTool_top_office
mcpserver.registerTool(
  "webdTool_top_office",
  {
    title: "Get top offices by URL count on webD Project",
    description: "ดึงหน่วยงานที่มี URL มากที่สุดจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "top office",
        "หน่วยงาน",
        "มากที่สุด",
        "สถิติ",
        "office",
        "ranking",
      ],
      examples: [
        "แสดงหน่วยงานที่มี URL มากที่สุด",
        "ดึงอันดับหน่วยงาน",
        "ฉันต้องการหน่วยงานที่มีเว็บไซต์ผิดกฎหมายมากที่สุด",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          office_name: z.string(),
          url_count: z.number(),
        })
      ),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd top office tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/topoffice`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Top office data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching top office:", error);
      throw error;
    }
  }
);

// Register webdTool_top_category
mcpserver.registerTool(
  "webdTool_top_category",
  {
    title: "Get top categories by compliance rate on webD Project",
    description:
      "ดึงหมวดหมู่ที่มีอัตราการปฏิบัติตามสัญญาสูงสุดจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "top category",
        "หมวดหมู่",
        "อัตราการปฏิบัติตามสัญญา",
        "สถิติ",
        "category",
        "compliance",
        "ranking",
      ],
      examples: [
        "แสดงหมวดหมู่ที่มีอัตราการปฏิบัติตามสัญญาสูงสุด",
        "ดึงอันดับหมวดหมู่ตามการปฏิบัติตาม",
        "ฉันต้องการหมวดหมู่ที่มีการปฏิบัติตามสัญญาดีที่สุด",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          category_name: z.string(),
          compliance_rate: z.number(),
        })
      ),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd top category tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/topcategory`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Top category data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching top category:", error);
      throw error;
    }
  }
);

// Register webdTool_top_court
mcpserver.registerTool(
  "webdTool_top_court",
  {
    title: "Get top court categories by court order count on webD Project",
    description: "ดึงหมวดหมู่ศาลที่มีคำสั่งศาลมากที่สุดจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "top court",
        "หมวดหมู่ศาล",
        "คำสั่งศาล",
        "สถิติ",
        "court",
        "ranking",
      ],
      examples: [
        "แสดงหมวดหมู่ศาลที่มีคำสั่งศาลมากที่สุด",
        "ดึงอันดับหมวดหมู่ศาล",
        "ฉันต้องการหมวดหมู่ศาลที่มีคำสั่งศาลเยอะที่สุด",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          court_category: z.string(),
          court_order_count: z.number(),
        })
      ),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd top court tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/topcourt`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Top court data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching top court:", error);
      throw error;
    }
  }
);

// Register webdTool_yearly_trends
mcpserver.registerTool(
  "webdTool_yearly_trends",
  {
    title: "Get yearly trends with popular categories on webD Project",
    description: "ดึงแนวโน้มรายปีพร้อมหมวดหมู่ยอดนิยมจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "yearly trends",
        "แนวโน้มรายปี",
        "หมวดหมู่ยอดนิยม",
        "สถิติ",
        "trends",
        "yearly",
        "popular categories",
      ],
      examples: [
        "แสดงแนวโน้มรายปีพร้อมหมวดหมู่ยอดนิยม",
        "ดึงสถิติแนวโน้มตามปี",
        "ฉันต้องการดูแนวโน้มรายปีของหมวดหมู่",
      ],
    },
    inputSchema: z.object({
      yearsBack: z.number().optional().describe("จำนวนปีที่ย้อนกลับ"),
      toprank: z.number().optional().describe("อันดับยอดนิยม"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          year: z.string(),
          total_urls: z.number(),
          popular_categories: z.array(z.string()),
        })
      ),
    }),
  },
  async ({ yearsBack, toprank }, _extra) => {
    console.log(
      `[MCP Server] Webd yearly trends tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const queryParams = new URLSearchParams();
      if (yearsBack !== undefined)
        queryParams.append("yearsBack", yearsBack.toString());
      if (toprank !== undefined)
        queryParams.append("toprank", toprank.toString());

      const url = `http://${webddsbHost}:${webddsbPort}/api/urlstats/yearly-trends${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "x-api-key": webddsbApiKey },
      });

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Yearly trends data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching yearly trends:", error);
      throw error;
    }
  }
);

// Register webdTool_monthly_trends
mcpserver.registerTool(
  "webdTool_monthly_trends",
  {
    title: "Get monthly trends with popular categories on webD Project",
    description: "ดึงแนวโน้มรายเดือนพร้อมหมวดหมู่ยอดนิยมจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "monthly trends",
        "แนวโน้มรายเดือน",
        "หมวดหมู่ยอดนิยม",
        "สถิติ",
        "trends",
        "monthly",
        "popular categories",
      ],
      examples: [
        "แสดงแนวโน้มรายเดือนพร้อมหมวดหมู่ยอดนิยม",
        "ดึงสถิติแนวโน้มตามเดือน",
        "ฉันต้องการดูแนวโน้มรายเดือนของหมวดหมู่",
      ],
    },
    inputSchema: z.object({
      monthsBack: z.number().optional().describe("จำนวนเดือนที่ย้อนกลับ"),
      toprank: z.number().optional().describe("อันดับยอดนิยม"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          month: z.string(),
          total_urls: z.number(),
          popular_categories: z.array(z.string()),
        })
      ),
    }),
  },
  async ({ monthsBack, toprank }, _extra) => {
    console.log(
      `[MCP Server] Webd monthly trends tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const queryParams = new URLSearchParams();
      if (monthsBack !== undefined)
        queryParams.append("monthsBack", monthsBack.toString());
      if (toprank !== undefined)
        queryParams.append("toprank", toprank.toString());

      const url = `http://${webddsbHost}:${webddsbPort}/api/urlstats/monthly-trends${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "x-api-key": webddsbApiKey },
      });

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Monthly trends data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching monthly trends:", error);
      throw error;
    }
  }
);

// Register webdTool_yearly_process_times
mcpserver.registerTool(
  "webdTool_yearly_process_times",
  {
    title: "Get yearly processing times on webD Project",
    description: "ดึงเวลาประมวลผลแยกตามปีจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "yearly process times",
        "เวลาประมวลผลรายปี",
        "สถิติ",
        "processing time",
        "yearly",
        "performance",
      ],
      examples: [
        "แสดงเวลาประมวลผลแยกตามปี",
        "ดึงสถิติเวลาประมวลผลรายปี",
        "ฉันต้องการดูเวลาที่ใช้ในการประมวลผลตามปี",
      ],
    },
    inputSchema: z.object({
      yearsBack: z.number().optional().describe("จำนวนปีที่ย้อนกลับ"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          year: z.string(),
          avg_processing_time: z.number(),
          total_processed: z.number(),
        })
      ),
    }),
  },
  async ({ yearsBack }, _extra) => {
    console.log(
      `[MCP Server] Webd yearly process times tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const queryParams = new URLSearchParams();
      if (yearsBack !== undefined)
        queryParams.append("yearsBack", yearsBack.toString());

      const url = `http://${webddsbHost}:${webddsbPort}/api/urlstats/yearly-process-times${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "x-api-key": webddsbApiKey },
      });

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Yearly process times data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching yearly process times:", error);
      throw error;
    }
  }
);

// Register webdTool_today_by_office
mcpserver.registerTool(
  "webdTool_today_by_office",
  {
    title: "Get today's statistics by office on webD Project",
    description: "ดึงสถิติของวันนี้แยกตามหน่วยงานจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "today by office",
        "สถิติวันนี้",
        "หน่วยงาน",
        "สถิติ",
        "today",
        "office",
        "daily stats",
      ],
      examples: [
        "แสดงสถิติของวันนี้แยกตามหน่วยงาน",
        "ดึงข้อมูลวันนี้ตามหน่วยงาน",
        "ฉันต้องการสถิติประจำวันแยกตามหน่วยงาน",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          office_name: z.string(),
          today_count: z.number(),
          total_count: z.number(),
        })
      ),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd today by office tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/today-by-office`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Today by office data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching today by office:", error);
      throw error;
    }
  }
);

// Register webdTool_platforms
mcpserver.registerTool(
  "webdTool_platforms",
  {
    title: "Get URL statistics by platform on webD Project",
    description: "ดึงสถิติ URL แยกตามแพลตฟอร์มจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "platforms",
        "สถิติแพลตฟอร์ม",
        "แพลตฟอร์ม",
        "สถิติ",
        "platform",
        "statistics",
      ],
      examples: [
        "แสดงสถิติ URL แยกตามแพลตฟอร์ม",
        "ดึงข้อมูลตามแพลตฟอร์ม",
        "ฉันต้องการสถิติแพลตฟอร์ม",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          platform: z.string(),
          url_count: z.number(),
          percentage: z.number(),
        })
      ),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd platforms tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/platforms`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Platforms data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching platforms:", error);
      throw error;
    }
  }
);

// Register webdTool_register_country
mcpserver.registerTool(
  "webdTool_register_country",
  {
    title: "Get URL statistics by registered country on webD Project",
    description: "ดึงสถิติ URL แยกตามประเทศที่จดทะเบียนจากโปรเจกต์ webD",
    _meta: {
      keywords: [
        "webd",
        "register country",
        "ประเทศที่จดทะเบียน",
        "สถิติ",
        "country",
        "registration",
        "statistics",
      ],
      examples: [
        "แสดงสถิติ URL แยกตามประเทศที่จดทะเบียน",
        "ดึงข้อมูลตามประเทศ",
        "ฉันต้องการสถิติประเทศที่จดทะเบียน",
      ],
    },
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          country: z.string(),
          url_count: z.number(),
          percentage: z.number(),
        })
      ),
    }),
  },
  async (_params, _extra) => {
    console.log(
      `[MCP Server] Webd register country tool request received at ${new Date().toLocaleString()}`
    );
    const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
    const webddsbPort = process.env.WEBDDSB_PORT || "3010";
    const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
    try {
      const res = await fetch(
        `http://${webddsbHost}:${webddsbPort}/api/urlstats/register-country`,
        {
          method: "GET",
          headers: { "x-api-key": webddsbApiKey },
        }
      );

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log("[MCP Server] Register country data:", data);

      return {
        content: [
          { type: "text", text: JSON.stringify(data) } as {
            type: "text";
            text: string;
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      console.error("Error fetching register country:", error);
      throw error;
    }
  }
);

// Handle incoming MCP requests /////////////////////////////
app.post("/mcp", async (req, res) => {
  // Basic validation for JSON-RPC request body
  const body = req.body;
  if (!body || (typeof body !== "object" && !Array.isArray(body))) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request",
        data: "request body must be an object or array",
      },
      id: null,
    });
  }

  // If single request object includes params, ensure params is object or array
  if (
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "params")
  ) {
    const params = (body as any).params;
    if (
      params !== undefined &&
      typeof params !== "object" &&
      !Array.isArray(params)
    ) {
      return sendJsonRpcError(
        res,
        (body as any).id ?? null,
        -32602,
        "Invalid params",
        "params must be an object or array"
      );
    }
  }

  // If this is a single JSON-RPC request with a method, run per-method schema validation
  if (!Array.isArray(body) && typeof (body as any).method === "string") {
    const methodName = (body as any).method as string;
    const schema = methodParamSchemas[methodName];
    const params = (body as any).params;

    if (schema) {
      try {
        // For positional params (array), don't attempt object parse — require named params for these methods
        if (Array.isArray(params)) {
          return sendJsonRpcError(
            res,
            (body as any).id ?? null,
            -32602,
            "Invalid params",
            "Positional params are not supported for this method; use named params (object)"
          );
        }

        schema.parse(params ?? {});
      } catch (err) {
        // zod error -> include details in data for better debugging
        if (err instanceof z.ZodError) {
          return sendJsonRpcError(
            res,
            (body as any).id ?? null,
            -32602,
            "Invalid params",
            err.errors
          );
        }
        return sendJsonRpcError(
          res,
          (body as any).id ?? null,
          -32602,
          "Invalid params",
          String(err)
        );
      }
    }
  }

  // Create a new transport for each request to prevent request ID collisions
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await mcpserver.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app
  .listen(port, () => {
    console.log(`MCP Server running on http://${host}:${port}/mcp`);
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });

export { server, mcpserver };

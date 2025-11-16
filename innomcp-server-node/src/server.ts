import "dotenv/config";
import http from "http";
import dotenv from "dotenv";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import app from "./app";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3012", 10);

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
      text: z.string().describe("ข้อความที่ต้องการวิเคราะห์"),
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
  "webdCountInputAndGroupTool",
  {
    title: "Count all input violation records on webd Project (webd)",
    description:
      "นับจำนวนรายการนำเข้าเว็บไซต์ผิดกฎหมาย บนโปรเจกต์ webd — ค้นหาโดยคำค้นหรือหมวดหมู่ (keyword: webd, เว็บไซต์ผิดกฎหมาย, สถิติ)",
    // Helpful keywords to aid model/tool-selection heuristics (put under annotations/_meta)
    _meta: {
      keywords: [
        "webd",
        "webd project",
        "เว็บไซต์ผิดกฎหมาย",
        "จำนวน",
        "นับ",
        "สถิติ",
        "violation",
        "violation count",
        "สถิติการนำเข้า",
        "นับรายการนำเข้า",
        "จำนวนรายการนำเข้า",
        "รายการนำเข้า",
        "จำนวนเว็บไซต์ผิดกฎหมาย",
      ],
      examples: [
        "ฉันต้องการสถิติเว็บไซต์ผิดกฎหมายบน webd",
        "นับจำนวนรายการนำเข้าเกี่ยวกับเว็บการพนัน ใน webd",
        "แสดงจำนวนเว็บไซต์ผิดกฎหมาย ที่พบใน webd โดยกลุ่มหมวดหมู่ 'การพนัน'",
      ],
    },
    inputSchema: z.object({
      query: z.string().describe("คำค้นหาหรือหมวดหมู่ที่ต้องการตรวจสอบ"),
    }),
    outputSchema: z.object({ count: z.number() }),
  },
  async ({ query }, _extra) => {
    console.log(
      `[MCP Server] Webd count input and group tool request received at ${new Date().toLocaleString()}`
    ); // Log when a request is received
    try {
      const response = await fetch(
        "http://localhost:3010/api/violation-groups-count",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
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

// Handle incoming MCP requests /////////////////////////////
app.post("/mcp", async (req, res) => {
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

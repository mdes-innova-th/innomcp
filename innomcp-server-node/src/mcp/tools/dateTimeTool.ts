import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpLog } from "../../utils/mcpLogger";
import { logBoth } from "../../utils/mcpLogger";

type DateTimeInput = {
  format?: string;
};

export function registerDateTimeTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "dateTimeTool",
    {
      title: "เครื่องมือแสดงวันที่และเวลาปัจจุบัน - DateTime Tool",
      description: `
      หน้าที่: แสดงวันที่และเวลาปัจจุบัน ณ ขณะนี้
      
      ใช้เมื่อ:
      - ถามว่า "ตอนนี้กี่โมง", "เวลาเท่าไร", "กี่โมงแล้ว", "ขณะนี้เวลา"
      - ถามว่า "วันนี้วันที่เท่าไร", "วันที่เท่าไหร่", "วันอะไร"
      - ต้องการทราบเวลาปัจจุบัน, เวลาตอนนี้, เวลาในไทย
      - ถามเกี่ยวกับเวลาที่แสดงบน taskbar, เครื่องคอมพิวเตอร์, window
      - มีคำถามเกี่ยวกับ: เวลา, วันที่, กี่โมง, กี่นาที, ปัจจุบัน, ตอนนี้, เดี๋ยวนี้, ขณะนี้
      
      ไม่ใช้เมื่อ:
      - ถามเกี่ยวกับสภาพอากาศ, พยากรณ์อากาศ, ฝน, อุณหภูมิ
      - ถามเกี่ยวกับข่าวสาร, ข้อมูลทั่วไป
      - ไม่มีคำถามเกี่ยวกับเวลาหรือวันที่
      
      คำสำคัญ: เวลา, วันที่, กี่โมง, กี่นาที, ตอนนี้, ปัจจุบัน, ขณะนี้, เดี๋ยวนี้, time, datetime, current, now, clock, taskbar, วันนี้, พรุ่งนี้, เมื่อวาน
      
      พารามิเตอร์: { format?: string } (optional) — รูปแบบการแสดงผล ('thai', 'iso', 'timestamp')
      
      ตัวอย่างคำถาม: 
      - "ตอนนี้กี่โมง"
      - "วันนี้วันที่เท่าไร" 
      - "เวลาตอนนี้เท่าไหร่"
      - "taskbar แสดงเวลากี่โมง"
      
      ตัวอย่าง response: { "datetime": "21 ธันวาคม 2567, 20:34:15", "format": "thai" }
      
      ข้อผิดพลาดที่คาดได้: 400 (invalid format)
      
      หมายเหตุ: รูปแบบ 'thai' จะแสดงวันที่และเวลาในรูปแบบปฏิทินไทยพุทธศักราช`,
      inputSchema: {
        format: z
          .string()
          .optional()
          .describe("Output format: thai, iso, timestamp, or default JavaScript Date string"),
      } as any,
    },
    async (args: any) => {
      const input = args as DateTimeInput;
      const format = input.format || "thai";
      
      mcpLog('INFO', `[DateTime Tool] Request received - format: ${format}`);
      
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
            {
              type: "text" as const,
              text: `วันเวลาปัจจุบัน: ${result}`,
            },
          ],
          structuredContent: { datetime: result, format },
        };
      } catch (error) {
        logBoth('ERROR', `[DateTime Tool] Error: ${String(error)}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `เกิดข้อผิดพลาด: ${String(error)}`,
            },
          ],
          structuredContent: { datetime: "", format: "error" },
        };
      }
    }
  );
}

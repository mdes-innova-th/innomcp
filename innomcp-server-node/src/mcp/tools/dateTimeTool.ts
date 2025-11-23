import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDateTimeTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "dateTimeTool",
    {
      title: "เครื่องมือสำหรับแสดงเวลาและวันที่ในรูปแบบต่างๆ",
      description: `
      หน้าที่: แสดงวันที่และเวลาปัจจุบันในรูปแบบต่างๆ
      ใช้เมื่อ:
      - ต้องการทราบวันที่และเวลาปัจจุบัน
      - มีคำขอของผู้ใช้เกี่ยวกับวันที่และเวลา
      ไม่ใช้เมื่อ:
      - ไม่ต้องการข้อมูลวันที่และเวลา
      - ไม่มีคำขอของผู้ใช้เกี่ยวกับวันที่และเวลา
      พารามิเตอร์: { format?: string } (optional) — รูปแบบการแสดงผลที่ต้องการ ('thai', 'iso', 'timestamp')
ตัวอย่าง request: วันนี้วันที่เท่าไร แสดงวันที่และเวลาปัจจุบันในรูปแบบ ISO
ตัวอย่าง response: { "datetime": "2024-06-15T08:30:00Z", "format": "iso" }
ข้อผิดพลาดที่คาดได้: 400 (invalid format)
หมายเหตุ: รูปแบบ 'thai' จะแสดงวันที่และเวลาในรูปแบบปฏิทินไทย`,
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
      );
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
}

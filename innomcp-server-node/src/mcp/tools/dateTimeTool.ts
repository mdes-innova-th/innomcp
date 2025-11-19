import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDateTimeTool(mcpserver: McpServer) {
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

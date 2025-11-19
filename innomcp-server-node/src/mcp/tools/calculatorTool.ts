import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCalculatorTool(mcpserver: McpServer) {
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
      );
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
          structuredContent: { result },
        };
      } catch (error) {
        console.error("Error in calculator:", error);
        throw new Error("ไม่สามารถคำนวณนิพจน์นี้ได้");
      }
    }
  );
}

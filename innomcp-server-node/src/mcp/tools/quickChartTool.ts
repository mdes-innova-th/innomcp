import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerQuickChartTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "quickChartTool",
    {
      title: "สร้างกราฟด่วน (Quick Chart Tool)",
      description: `หน้าที่: สร้างกราฟด่วนในรูปแบบต่างๆ ตาม API ของ QuickChart.io
        ใช้เมื่อ: ต้องการสร้างกราฟด้วยข้อมูลที่กำหนด
ไม่ใช้เมื่อ: ไม่ต้องการสร้างกราฟ หรือใช้เครื่องมือกราฟอื่น
พารามิเตอร์: { type: string, labels: string[], datasets: { label: string, data: number[] }[] }
ตัวอย่าง request: GET https://quickchart.io/chart?c={type:'bar',data:{labels:['Q1','Q2','Q3','Q4'], datasets:[{label:'Users',data:[50,60,70,180]},{label:'Revenue',data:[100,200,300,400]}]}}
ตัวอย่าง response:
  { "success": true, "data": [{ "platform": "facebook", "url_count": 500, "percentage": 45.3 }] }
ข้อผิดพลาดที่คาดได้: 401 (API key), 500 (internal error)
หมายเหตุ: ไม่มี

        `,
      inputSchema: z.object({
        type: z
          .string()
          .describe("ประเภทของกราฟ เช่น 'bar', 'line', 'pie', 'area', 'donut'"),
        labels: z.array(z.string()).describe("ป้ายกำกับสำหรับแกน X"),
        datasets: z
          .array(
            z.object({
              label: z.string().describe("ชื่อของชุดข้อมูล"),
              data: z.array(z.number()).describe("ข้อมูลตัวเลขสำหรับชุดข้อมูล"),
            })
          )
          .describe("ชุดข้อมูลสำหรับกราฟ"),
      }),
      outputSchema: z.object({ chartUrl: z.string() }),
    },
    async ({ type, labels, datasets }, _extra) => {
      console.log(
        `[MCP Server] quickChartTool request received at ${new Date().toLocaleString()}`
      );
      try {
        const chartConfig = {
          type,
          data: {
            labels,
            datasets,
          },
        };

        const configJson = JSON.stringify(chartConfig);
        const encodedConfig = encodeURIComponent(configJson);
        const chartUrl = `https://quickchart.io/chart?c=${encodedConfig}`;

        return {
          content: [
            { type: "text", text: `URL ของกราฟที่สร้าง: ${chartUrl}` } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: { chartUrl },
        };
      } catch (error) {
        console.error("Error in quickChartTool:", error);
        throw error;
      }
    }
  );
}

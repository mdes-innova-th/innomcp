import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as echarts from "echarts";

export function registerEchartsTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "echartsTool",
    {
      title: "สร้างกราฟด้วย ECharts (ECharts Tool)",
      description: `หน้าที่: สร้างกราฟในรูปแบบต่างๆ ด้วย ECharts ตามโครงสร้าง option ของ ECharts
        ใช้เมื่อ: ต้องการสร้างกราฟด้วยข้อมูลที่กำหนด
ไม่ใช้เมื่อ: ไม่ต้องการสร้างกราฟ หรือใช้เครื่องมือกราฟอื่น
พารามิเตอร์: { type: string, labels: string[], datasets: { label: string, data: number[] }[] }
ตัวอย่าง request: { type: 'bar', labels: ['Shirts', 'Cardigans', 'Chiffons', 'Pants', 'Heels', 'Socks'], datasets: [{label:'sales',data:[5, 20, 36, 10, 10, 20]}] }
ตัวอย่าง response: SVG string ของกราฟ
ข้อผิดพลาดที่คาดได้: ข้อผิดพลาดในการสร้างกราฟ
หมายเหตุ: ใช้ ECharts สำหรับการสร้างกราฟ ตามวิธีการของ ECharts เช่น title, tooltip, legend, xAxis, yAxis, series

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
      outputSchema: z.object({ chartSvg: z.string() }),
    },
    async ({ type, labels, datasets }, _extra) => {
      console.log(
        `[MCP Server] echartsTool request received at ${new Date().toLocaleString()}`
      );
      try {
        let option: any;
        if (type === "pie" || type === "donut") {
          option = {
            title: {
              text: "ECharts Getting Started Example",
            },
            tooltip: {},
            series: [
              {
                type: "pie",
                data: labels.map((label, i) => ({
                  name: label,
                  value: datasets[0].data[i],
                })),
                radius: type === "donut" ? ["40%", "70%"] : "50%",
              },
            ],
          };
        } else {
          option = {
            title: {
              text: "ECharts",
            },
            tooltip: {},
            legend: {
              data: datasets.map((d) => d.label),
            },
            xAxis: {
              data: labels,
            },
            yAxis: {},
            series: datasets.map((d) => ({
              name: d.label,
              type: type === "area" ? "line" : type,
              data: d.data,
              areaStyle: type === "area" ? {} : undefined,
            })),
          };
        }

        const chart = echarts.init(null, null, { renderer: "svg" });
        chart.setOption(option);
        const svg = chart.renderToSVGString();

        return {
          content: [
            { type: "text", text: `SVG ของกราฟ: ${svg}` } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: { chartSvg: svg },
        };
      } catch (error) {
        console.error("Error in echartsTool:", error);
        throw error;
      }
    }
  );
}

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as echarts from "echarts";
import puppeteer from "puppeteer";

export function registerEchartsTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "echartsTool",
    {
      title: "สร้างกราฟด้วย ECharts (ECharts Tool)",
      description: `หน้าที่: สร้างกราฟในรูปแบบต่างๆ ด้วย ECharts ตามโครงสร้าง option ของ ECharts โดยรับพารามิเตอร์เป็นประเภทกราฟ, ป้ายกำกับ, และชุดข้อมูล ที่ผู้ใช้กำหนด หรือ JSON string ของข้อมูลที่คุยกันไว้
        ใช้เมื่อ: ต้องการสร้างกราฟด้วยข้อมูลกำหนด หรือข้อมูลจากแชท
        ไม่ใช้เมื่อ: ไม่ต้องการสร้างกราฟ หรือใช้เครื่องมือกราฟอื่น
พารามิเตอร์: { type: string, labels?: string[], datasets?: { label: string, data: number[] }[], dataJson?: string }
ตัวอย่าง request: { type: 'bar', labels: ['Shirts', 'Cardigans', 'Chiffons', 'Pants', 'Heels', 'Socks'], datasets: [{label:'sales',data:[5, 20, 36, 10, 10, 20]}] } หรือ { type: 'bar', dataJson: '{"labels":["A","B"],"datasets":[{"label":"data","data":[1,2]}]}' }
ตัวอย่าง response: SVG string ของกราฟ
ข้อผิดพลาดที่คาดได้: ข้อผิดพลาดในการสร้างกราฟ หรือ JSON ไม่ถูกต้อง
หมายเหตุ: ใช้ ECharts สำหรับการสร้างกราฟ ตามวิธีการของ ECharts เช่น title, tooltip, legend, xAxis, yAxis, series

        `,
      inputSchema: z.object({
        type: z
          .string()
          .describe("ประเภทของกราฟ เช่น 'bar', 'line', 'pie', 'area', 'donut'"),
        labels: z.array(z.string()).optional().describe("ป้ายกำกับสำหรับแกน X"),
        datasets: z
          .array(
            z.object({
              label: z.string().describe("ชื่อของชุดข้อมูล"),
              data: z.array(z.number()).describe("ข้อมูลตัวเลขสำหรับชุดข้อมูล"),
            })
          )
          .optional()
          .describe("ชุดข้อมูลสำหรับกราฟ"),
        dataJson: z
          .string()
          .optional()
          .describe(
            "JSON string ของข้อมูลที่คุยกันไว้ เพื่อใช้สร้างกราฟ โดยมีฟอร์แมต {labels: string[], datasets: {label: string, data: number[]}[]}"
          ),
      }),
      outputSchema: z.object({ chartSvg: z.string() }),
    },
    async ({ type, labels, datasets, dataJson }, _extra) => {
      console.log(
        `[MCP Server] echartsTool request received at ${new Date().toLocaleString()}`
      );
      try {
        let finalLabels = labels;
        let finalDatasets = datasets;

        if (dataJson) {
          try {
            const parsed = JSON.parse(dataJson);
            if (parsed.labels) finalLabels = parsed.labels;
            if (parsed.datasets) finalDatasets = parsed.datasets;
          } catch (e) {
            console.error("[MCP Server] echartsTool - Invalid dataJson:", e);
          }
        }

        if (!finalLabels || !finalDatasets) {
          throw new Error("Labels and datasets are required");
        }

        console.log(
          "[MCP Server] echartsTool received data at " +
            new Date().toLocaleString(),
          { type, finalLabels, finalDatasets }
        );

        let option: any;
        if (type === "pie" || type === "donut") {
          option = {
            title: {
              text: "ECharts",
            },
            tooltip: {},
            series: [
              {
                type: "pie",
                data: finalLabels.map((label, i) => ({
                  name: label,
                  value: finalDatasets[0].data[i],
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
              data: finalDatasets.map((d) => d.label),
            },
            xAxis: {
              data: finalLabels,
            },
            yAxis: {},
            series: finalDatasets.map((d) => ({
              name: d.label,
              type: type === "area" ? "line" : type,
              data: d.data,
              areaStyle: type === "area" ? {} : undefined,
            })),
          };
        }

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(`
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
</head>
<body>
<div id="chart" style="width: 600px; height: 400px;"></div>
<script>
window.option = ${JSON.stringify(option)};
window.chart = echarts.init(document.getElementById('chart'), null, { renderer: 'svg' });
window.chart.setOption(window.option);
</script>
</body>
</html>
        `);
        const svg = await page.evaluate(() => {
          return (window as any).chart.renderToSVGString();
        });
        await browser.close();

        return {
          content: [
            { type: "text", text: `กราฟถูกสร้างขึ้นเรียบร้อยแล้ว` } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: { chartSvg: svg },
        };
      } catch (error) {
        console.error("[MCP Server] Error in echartsTool:", error);
        throw error;
      }
    }
  );
}

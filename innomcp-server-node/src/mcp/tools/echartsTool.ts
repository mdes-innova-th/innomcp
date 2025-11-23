import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as echarts from "echarts";
import puppeteer from "puppeteer";

export function registerEchartsTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "echartsTool",
    {
      title: "สร้างกราฟด้วย ECharts (ECharts Tool)",
      description: `
หน้าที่: สร้างกราฟ/แผนภูมิ/ไดอะแกรม ในรูปแบบต่างๆ ด้วย ECharts จากข้อมูลที่มี
ใช้เมื่อ:
- ต้องมีคำว่า "กราฟ" ไม่มีคำว่า "ไม่สร้างกราฟ" หรือ "อย่าสร้างกราฟ" หรือ "ไม่ต้องสร้างกราฟ" หรือ "ห้ามสร้างกราฟ"  ในคำขอของผู้ใช้
- ผู้ใช้ขอให้สร้างกราฟ, แผนภูมิ, ไดอะแกรม, visual
- มีข้อมูลตัวเลข (sales, statistics, comparison, %) ที่สามารถแสดงเป็นกราฟ
- ข้อมูลจากการสนทนา/แชทที่ผ่านมา
ไม่ใช้เมื่อ:
- ไม่มีคำว่า "กราฟ" หรือมีคำว่า "ไม่สร้างกราฟ" หรือ "อย่าสร้างกราฟ" หรือ "ไม่ต้องสร้างกราฟ" หรือ "ห้ามสร้างกราฟ" ในคำขอของผู้ใช้
- ผู้ใช้ขอเพียงแค่คำอธิบายข้อมูลหรือสถิติ ตาราง โดยไม่ต้องการกราฟ
- ข้อมูลไม่เหมาะสมที่จะนำเสนอในรูปแบบกราฟ เช่น ข้อความยาว, รายการที่ไม่มีตัวเลข
- ข้อมูลไม่เพียงพอที่จะสร้างกราฟที่มีความหมาย

พารามิเตอร์ (ต้องส่ง 1 ในนี้):
A) ใช้ labels + datasets (แนะนำ):
   - type: 'bar', 'line', 'pie', 'area', 'donut', 'scatter'
   - labels: ['A', 'B', 'C'] (ป้ายกำกับแกน X)
   - datasets: [{label: 'ชื่อชุด', data: [10, 20, 30]}] (ข้อมูลตัวเลข)

B) ใช้ dataJson (JSON string):
   - type: 'bar' (หรือประเภทอื่น)
   - dataJson: '{"labels":["A","B"],"datasets":[{"label":"data","data":[1,2]}]}'

C) ใช้ chatText (ข้อความจากแชท):
   - type: 'pie'
   - chatText: 'A 10, B 20, C 30' (รูปแบบ 'label value' คั่นด้วย comma)

D) chartTitle (ทางเลือก): ชื่อกราฟ

ตัวอย่างการใช้:
1. bar chart: {type:'bar', labels:['Jan','Feb','Mar'], datasets:[{label:'Sales',data:[100,150,200]}], chartTitle:'Monthly Sales'}
2. pie chart: {type:'pie', chatText:'Bangkok 40%, Chiang Mai 25%, Phuket 35%'}
3. line chart: {type:'line', dataJson:'{"labels":["Q1","Q2","Q3"],"datasets":[{"label":"Revenue","data":[50000,75000,100000]}]}'}

กฎ:
- MUST: ต้องส่ง type + (labels+datasets) หรือ dataJson หรือ chatText
- MUST: ถ้าส่ง labels ต้องส่ง datasets ด้วย (จำนวน label ต้องเท่ากับจำนวนค่า data)
- MUST: ใช้ chatText เมื่อมีข้อมูลจากแชท เช่น "A 10, B 20"
- MUST: สำหรับ dataJson, datasets array ต้องมี label และ data
- ห้าม: ส่งค่าว่างเปล่าหรือ undefined
- ห้าม: ลืมส่ง labels เมื่อส่ง datasets
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
        chatText: z
          .string()
          .optional()
          .describe(
            "ข้อความจากแชทที่บรรจุข้อมูลสำหรับสร้างกราฟ ในรูปแบบ 'label1 value1, label2 value2, ...' เช่น 'Shirts 5, Cardigans 20'"
          ),
        chartTitle: z
          .string()
          .optional()
          .describe("ชื่อของกราฟ (ค่าเริ่มต้น: MDES)"),
      }),
      outputSchema: z.object({ chartSvg: z.string() }),
    },
    async (
      {
        type,
        labels,
        datasets,
        dataJson,
        chartTitle: paramChartTitle,
        chatText,
      },
      _extra
    ) => {
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

        if (chatText) {
          try {
            const pairs = chatText.split(",").map((s) => s.trim());
            finalLabels = pairs.map((p) => {
              const parts = p.split(/\s+/);
              return parts.slice(0, -1).join(" ");
            });
            finalDatasets = [
              {
                label: "data",
                data: pairs.map((p) => {
                  const parts = p.split(/\s+/);
                  return parseFloat(parts[parts.length - 1]);
                }),
              },
            ];
          } catch (e) {
            console.error("[MCP Server] echartsTool - Invalid chatText:", e);
          }
        }

        if (!finalLabels || !finalDatasets) {
          throw new Error(
            "Labels and datasets are required, or provide dataJson or chatText"
          );
        }

        console.log(
          "[MCP Server] echartsTool received data at " +
            new Date().toLocaleString(),
          { type, finalLabels, finalDatasets }
        );

        const chartTitleValue = paramChartTitle || "MDES";
        let option: any;
        if (type === "pie" || type === "donut") {
          option = {
            title: {
              text: chartTitleValue,
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
        } else if (type === "line" || type === "area") {
          // Line and Area charts
          const seriesType = type === "area" ? "line" : "line";
          option = {
            title: {
              text: chartTitleValue,
            },
            tooltip: {},
            legend: {
              data: finalDatasets.map((d) => d.label),
            },
            xAxis: {
              data: finalLabels,
              type: "category",
            },
            yAxis: {},
            series: finalDatasets.map((d) => ({
              name: d.label,
              type: seriesType,
              data: d.data,
              areaStyle: type === "area" ? {} : undefined,
              smooth: true,
            })),
          };
        } else if (type === "bar" || type === "column") {
          // Bar and Column charts
          const chartType = type === "column" ? "bar" : "bar";
          option = {
            title: {
              text: chartTitleValue,
            },
            tooltip: {},
            legend: {
              data: finalDatasets.map((d) => d.label),
            },
            xAxis: {
              data: finalLabels,
              type: "category",
            },
            yAxis: {},
            series: finalDatasets.map((d) => ({
              name: d.label,
              type: chartType,
              data: d.data,
            })),
          };
        } else if (type === "scatter") {
          // Scatter chart - expects datasets with [x, y] pairs
          option = {
            title: {
              text: chartTitleValue,
            },
            tooltip: {},
            legend: {
              data: finalDatasets.map((d) => d.label),
            },
            xAxis: {},
            yAxis: {},
            series: finalDatasets.map((d) => ({
              name: d.label,
              type: "scatter",
              data: d.data.map((val, i) => [i, val]),
            })),
          };
        } else {
          // Default to bar chart for unknown types
          option = {
            title: {
              text: chartTitleValue,
            },
            tooltip: {},
            legend: {
              data: finalDatasets.map((d) => d.label),
            },
            xAxis: {
              data: finalLabels,
              type: "category",
            },
            yAxis: {},
            series: finalDatasets.map((d) => ({
              name: d.label,
              type: "bar",
              data: d.data,
            })),
          };
        }

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
          await page.setContent(
            `
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
          `,
            { waitUntil: "networkidle2" }
          );

          // Wait a bit for chart to render
          await new Promise((resolve) => setTimeout(resolve, 500));

          const svg = await page.evaluate(() => {
            const chart = (window as any).chart;
            if (!chart) {
              throw new Error("Chart not initialized");
            }
            return chart.renderToSVGString();
          });

          await browser.close();

          if (!svg || svg.length === 0) {
            throw new Error("SVG rendering failed - empty result");
          }

          return {
            content: [
              { type: "text", text: `กราฟถูกสร้างขึ้นเรียบร้อยแล้ว` } as {
                type: "text";
                text: string;
              },
            ],
            structuredContent: { chartSvg: svg },
          };
        } catch (renderError) {
          await browser.close();
          throw new Error(
            `Failed to render chart: ${
              renderError instanceof Error
                ? renderError.message
                : String(renderError)
            }`
          );
        }
      } catch (error) {
        console.error("[MCP Server] Error in echartsTool:", error);
        throw error;
      }
    }
  );
}

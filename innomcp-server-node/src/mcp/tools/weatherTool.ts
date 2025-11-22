import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { XMLParser } from "fast-xml-parser";

const TMD_API_URL =
  "https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345";

export function registerWeatherTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "WeatherTool_TMD_province_today_xml",
    {
      title: "Weather Today by Province provided by TMD",
      description:
        "ดึงข้อมูลสภาพอากาศวันนี้จากกรมอุตุนิยมวิทยา และแปลงเป็น JSON",
      inputSchema: z.object({}),
      outputSchema: z.object({
        weatherData: z.any(),
      }),
    },
    async ({}, _extra) => {
      console.log(`[MCP Server] Weather tool request for today`);
      try {
        const resp = await fetch(TMD_API_URL, { method: "GET" });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          console.error("TMD API error", resp.status, text);
          throw new Error(`TMD API error: ${resp.status}`);
        }

        const xmlData = await resp.text();
        const parser = new XMLParser();
        const jsonData = parser.parse(xmlData);

        const text = `ข้อมูลสภาพอากาศวันนี้: ${JSON.stringify(
          jsonData,
          null,
          2
        )}`;

        return {
          content: [{ type: "text", text }],
          structuredContent: { weatherData: jsonData },
        };
      } catch (error) {
        console.error("Error in weather tool:", error);
        return {
          content: [{ type: "text", text: `เกิดข้อผิดพลาด: ${String(error)}` }],
          structuredContent: { weatherData: null },
        };
      }
    }
  );
}

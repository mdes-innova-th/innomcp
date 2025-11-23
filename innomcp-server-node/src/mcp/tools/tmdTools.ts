import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { XMLParser } from "fast-xml-parser";

const TMD_API_URL =
  "https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345";

export function registerTmdTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "tmdTool_weather_province_today_xml",
    {
      title: "ดึงข้อมูลสภาพอากาศวันนี้รายจังหวัดจากกรมอุตุนิยมวิทยา",
      description: `
        หน้าที่: ดึงข้อมูลสภาพอากาศวันนี้รายจังหวัดจากกรมอุตุนิยมวิทยา
ใช้เมื่อ:
- มีคำขอของผู้ใช้เกี่ยวกับสภาพอากาศวันนี้ 
- ต้องการข้อมูลสภาพอากาศวันนี้รายจังหวัด
- ผู้ใช้ถามว่า "ฝนตกไหม" หรือ "ที่ไหนฝนตกบ้าง"
ไม่ใช้เมื่อ: 
- ไม่มีคำขอของผู้ใช้เกี่ยวกับสภาพอากาศวันนี้
- ต้องการข้อมูลที่เป็นรายเดือน หรือรายปี
พารามิเตอร์: ไม่มี (GET)
ตัวอย่าง request: GET /api/WeatherToday/V2/?uid=api&ukey=api12345
ตัวอย่าง response:
 {
  "WmoStationNumber": 48454,
  "StationNameThai": "&#xE01;&#xE23;&#xE38;&#xE07;&#xE40;&#xE17;&#xE1E;&#xE2F; &#xE17;&#xE48;&#xE32;&#xE40;&#xE23;&#xE37;&#xE2D;&#xE04;&#xE25;&#xE2D;&#xE07;&#xE40;&#xE15;&#xE22;",
  "StationNameEnglish": "BANGKOK PORT (KLONG TOEI)",
  "Province": "&#xE01;&#xE23;&#xE38;&#xE07;&#xE40;&#xE17;&#xE1E;&#xE21;&#xE2B;&#xE32;&#xE19;&#xE04;&#xE23;",     
  "Latitude": 13.70694,
  "Longitude": 100.56805,
  "Observation": {
    "DateTime": "2025-11-22 07:00",
    "MeanSeaLevelPressure": 1014.91,
    "Temperature": 22.8,
    "MaxTemperature": 27.8,
    "DifferentFromMaxTemperature": -0.5,
    "MinTemperature": 22.3,
    "DifferentFromMinTemperature": -0.5,
    "RelativeHumidity": 64,
    "WindDirection": 60,
    "WindSpeed": 3,
    "Rainfall": 0
    }
 }
ข้อผิดพลาดที่คาดได้: 401 (API key), 500 (server error)
หมายเหตุ: ข้อมูลสภาพอากาศวันนี้จากกรมอุตุนิยมวิทยา`,
      inputSchema: z.object({
        location: z.string().optional().describe("ชื่อจังหวัด (ไม่บังคับ)"),
      }),
      outputSchema: z.object({
        weatherData: z.any(),
        location: z.string().optional(),
      }),
    },
    async ({ location }, _extra) => {
      console.log(`[MCP Server] TMD Weather tool request for today, location: ${location || "all"}`);
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

        // Filter by location if provided
        let filteredData = jsonData;
        if (location) {
          // Try to filter the data by province if it's structured
          const locationLower = location.toLowerCase();
          if (Array.isArray(jsonData)) {
            filteredData = jsonData.filter((item: any) => {
              const province = item.Province || item.province || item.ProvinceName || "";
              return String(province).toLowerCase().includes(locationLower);
            });
          }
        }

        const text = `ข้อมูลสภาพอากาศวันนี้${location ? ` สำหรับ ${location}` : ""}: ${JSON.stringify(
          filteredData,
          null,
          2
        )}`;

        return {
          content: [{ type: "text", text }],
          structuredContent: { weatherData: filteredData, location },
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

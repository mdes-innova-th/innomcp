import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const TMD_API_URL =
  "https://data.tmd.go.th/api/Weather3Hours/V2/?uid=api&ukey=api12345";

function findLargestArray(obj: any): any[] | null {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    let best: any[] | null = null;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v)) {
        if (!best || v.length > best.length) best = v;
      } else if (v && typeof v === "object") {
        const nested = findLargestArray(v);
        if (nested && (!best || nested.length > best.length)) best = nested;
      }
    }
    return best;
  }
  return null;
}

function getStringValue(obj: any, keys: string[]) {
  for (const k of keys) {
    if (!obj) continue;
    if (k in obj && obj[k] != null) return String(obj[k]);
    // case-insensitive
    const foundKey = Object.keys(obj).find(
      (x) => x.toLowerCase() === k.toLowerCase()
    );
    if (foundKey) return String(obj[foundKey]);
  }
  return undefined;
}

export function registerWeatherTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "weatherTool",
    {
      title: "Weather By Province",
      description: "ดึงข้อมูลสภาพอากาศ 3 ชั่วโมงจากกรมอุตุฯ ตามชื่อจังหวัด",
      _meta: {
        keywords: [
          "weather",
          "forecast",
          "สภาพอากาศ",
          "อากาศวันนี้",
          "พยากรณ์อากาศ",
          "อุณหภูมิวันนี้",
          "จังหวัด",
          "weather3hours",
        ],
      },
      inputSchema: z.object({
        province: z.string().describe("ชื่อจังหวัด (ภาษาไทยหรืออังกฤษ)"),
      }),
      outputSchema: z.object({
        province: z.string(),
        results: z.array(z.any()),
      }),
    },
    async ({ province }, _extra) => {
      console.log(
        `[MCP Server] Weather tool request for province: ${province}`
      );
      try {
        const resp = await fetch(TMD_API_URL, { method: "GET" });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          console.error("TMD API error", resp.status, text);
          throw new Error(`TMD API error: ${resp.status}`);
        }

        const data = await resp.json().catch((e) => {
          console.error("Failed to parse TMD API response as JSON", e);
          throw new Error("Invalid JSON from TMD API");
        });

        const arr = findLargestArray(data) || [];

        const needle = (province || "").trim().toLowerCase();
        const matches = (arr as any[]).filter((item) => {
          // try common province keys
          const provinceValue = getStringValue(item, [
            "Province",
            "province",
            "prov",
            "ProvinceName",
            "provinceName",
            "PROVINCE",
          ]);
          if (provinceValue && provinceValue.toLowerCase().includes(needle))
            return true;

          // also check nested values (string fields)
          for (const v of Object.values(item)) {
            if (typeof v === "string" && v.toLowerCase().includes(needle))
              return true;
          }
          return false;
        });

        if (!matches || matches.length === 0) {
          const msg = `ไม่พบข้อมูลสำหรับจังหวัด '${province}'`;
          return {
            content: [{ type: "text", text: msg }],
            structuredContent: { province, results: [] },
          };
        }

        // Limit results to reasonable number in text, but include structured results fully
        const preview = matches.slice(0, 10).map((m) => {
          const time = getStringValue(m, [
            "ForecastTime",
            "forecastTime",
            "Date",
            "date",
          ]);
          const temp = getStringValue(m, ["Temp", "Temperature", "temp"]);
          const desc = getStringValue(m, [
            "Weather",
            "WeatherDescription",
            "Condition",
            "Summary",
            "weather",
          ]);
          return `${time || "(time?)"} — ${temp || "(temp?)"} — ${
            desc || "(desc?)"
          }`;
        });

        const text = `พบ ${
          matches.length
        } รายการสำหรับจังหวัด '${province}'. ตัวอย่าง:\n${preview.join("\n")}`;

        return {
          content: [{ type: "text", text }],
          structuredContent: { province, results: matches },
        };
      } catch (error) {
        console.error("Error in weather tool:", error);
        return {
          content: [{ type: "text", text: `เกิดข้อผิดพลาด: ${String(error)}` }],
          structuredContent: { province, results: [] },
        };
      }
    }
  );
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { parseMcpPayload } from "../src/utils/weather/toolCall";

async function main() {
  const client = new Client({ name: "debug", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost:3012/mcp")) as any);

  const result = await client.callTool({ name: "tmd_weather_forecast_7days_by_province", arguments: {} });
  const payload = parseMcpPayload(result);
  const provinces = payload?.Provinces?.Province;
  if (Array.isArray(provinces) && provinces.length > 0) {
    const sample = provinces[0];
    console.log("Province keys:", Object.keys(sample));
    const fc = sample.SevenDaysForecast || sample.ForecastDaily;
    if (fc) {
      console.log("Forecast keys:", Object.keys(fc));
      // Show first entry of each array
      for (const [k, v] of Object.entries(fc)) {
        const arr = v as any[];
        console.log(`  ${k}: [${arr.slice(0, 3).join(", ")}${arr.length > 3 ? ", ..." : ""}]  (len=${arr.length})`);
      }
    }
  }
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });

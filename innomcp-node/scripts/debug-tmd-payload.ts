/**
 * Debug: inspect actual TMD payload structure for 3hours + today07am + forecast7d
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { parseMcpPayload } from "../src/utils/weather/toolCall";

const MCP_URL = process.env.MCPSERVER_URL || "http://localhost:3012/mcp";

async function main() {
  const client = new Client({ name: "debug", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)) as any);
  console.log("Connected\n");

  const tools = [
    "tmd_weather_3hours_all_stations",
    "tmd_weather_today_07am_all_stations",
    "tmd_weather_forecast_7days_by_province",
  ];

  for (const toolName of tools) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`Tool: ${toolName}`);
    console.log(`${"─".repeat(60)}`);

    try {
      const t0 = Date.now();
      const result = await client.callTool({ name: toolName, arguments: {} });
      const ms = Date.now() - t0;
      console.log(`Time: ${ms}ms, isError: ${(result as any).isError || false}`);

      const payload = parseMcpPayload(result);

      // Show top-level keys
      if (payload && typeof payload === "object") {
        const keys = Object.keys(payload);
        console.log(`Top-level keys: [${keys.join(", ")}]`);

        // For each key, show type and sample
        for (const key of keys.slice(0, 5)) {
          const val = payload[key];
          if (Array.isArray(val)) {
            console.log(`  ${key}: Array[${val.length}]`);
            if (val[0]) console.log(`    [0] keys: [${Object.keys(val[0]).join(", ")}]`);
          } else if (val && typeof val === "object") {
            const subkeys = Object.keys(val);
            console.log(`  ${key}: Object { ${subkeys.join(", ")} }`);
            // One more level deep
            for (const sk of subkeys.slice(0, 3)) {
              const sv = val[sk];
              if (Array.isArray(sv)) {
                console.log(`    ${sk}: Array[${sv.length}]`);
                if (sv[0]) {
                  const sample = JSON.stringify(sv[0]).slice(0, 200);
                  console.log(`      [0]: ${sample}`);
                }
              } else {
                console.log(`    ${sk}: ${typeof sv} = ${JSON.stringify(sv).slice(0, 100)}`);
              }
            }
          } else {
            console.log(`  ${key}: ${typeof val} = ${JSON.stringify(val).slice(0, 100)}`);
          }
        }
      } else if (Array.isArray(payload)) {
        console.log(`Payload is Array[${payload.length}]`);
        if (payload[0]) {
          console.log(`  [0] keys: [${Object.keys(payload[0]).join(", ")}]`);
          console.log(`  [0] sample: ${JSON.stringify(payload[0]).slice(0, 300)}`);
        }
      } else {
        console.log(`Payload type: ${typeof payload}`);
        console.log(`Sample: ${JSON.stringify(payload).slice(0, 500)}`);
      }
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });

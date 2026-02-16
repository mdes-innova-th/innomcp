/**
 * Phase 6.5 LIVE TEST - connects to real MCP server + TMD API
 * Usage: npx ts-node scripts/live-test-weather.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WeatherPipeline } from "../src/utils/weather/weatherPipeline";

const MCP_URL = process.env.MCPSERVER_URL || "http://localhost:3012/mcp";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

interface TestCase {
  id: number;
  input: string;
  expectProvinces: string[];
  expectMode: string;
  expectNoProvince?: boolean;
  expectNational?: boolean;
  description: string;
}

const TESTS: TestCase[] = [
  {
    id: 1,
    input: "ลาดกระบัง และ เชียงแสน สัปดาห์นี้ฝนตกไหม",
    expectProvinces: ["กรุงเทพมหานคร", "เชียงราย"],
    expectMode: "week",
    description: "Multi-province alias → 2 results, no PROVINCE_NOT_FOUND",
  },
  {
    id: 2,
    input: "บอกตารางแสดงอากาศ ของ สมุทรสาคร , ศรีสะเกษ",
    expectProvinces: ["สมุทรสาคร", "ศรีสะเกษ"],
    expectMode: "table",
    description: "Station engine, strict filter; fallback if timeout",
  },
  {
    id: 3,
    input: "พรุ่งนี้หลักสี่ฝนจะตกไหม",
    expectProvinces: ["กรุงเทพมหานคร"],
    expectMode: "future",
    description: "Unsegmented Thai → หลักสี่ resolves, no PROVINCE_MISSING",
  },
  {
    id: 4,
    input: "เมืองทิพย์พรุ่งนี้ฝนตกไหม",
    expectProvinces: [],
    expectMode: "future",
    expectNoProvince: true,
    description: "Fake province → PROVINCE_MISSING, no MCP call",
  },
  {
    id: 5,
    input: "กรุงเทพมหานคร พยากรณ์ 7 วัน",
    expectProvinces: ["กรุงเทพมหานคร"],
    expectMode: "week",
    description: "Direct province, forecast engine, provinceCount ~77, filtered >=1",
  },
  {
    id: 6,
    input: "พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง บอกในรูปแบบตาราง",
    expectProvinces: [],
    expectMode: "table",  // "ตาราง" has higher priority than "พรุ่งนี้" in detectMode
    expectNational: true,
    description: "Phase 6.5.1: National query → type=national, table data, NOT PROVINCE_MISSING",
  },
];

async function main() {
  console.log(cyan(`\n╔══════════════════════════════════════════════════╗`));
  console.log(cyan(`║  Phase 6.5 LIVE Weather Test  (TMD API real)     ║`));
  console.log(cyan(`╚══════════════════════════════════════════════════╝\n`));
  console.log(dim(`MCP Server: ${MCP_URL}\n`));

  // 1. Connect MCP client
  console.log(yellow("Connecting to MCP server..."));
  const client = new Client({ name: "live-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport as any);
  console.log(green("Connected!\n"));

  // 2. List tools (quick sanity)
  const { tools } = await client.listTools();
  const tmdTools = tools.filter(t => t.name.startsWith("tmd_"));
  const nwpTools = tools.filter(t => t.name.startsWith("nwp_"));
  console.log(dim(`Available: ${tmdTools.length} TMD tools, ${nwpTools.length} NWP tools (${tools.length} total)\n`));

  // 3. Create pipeline with clients map
  const clients = new Map<string, any>();
  clients.set("innomcp-server", client);
  const pipeline = new WeatherPipeline(clients);

  // 4. Run tests
  let passed = 0;
  let failed = 0;

  for (const tc of TESTS) {
    console.log(yellow(`\n${"═".repeat(60)}`));
    console.log(yellow(`TEST ${tc.id}: ${tc.description}`));
    console.log(dim(`Input: "${tc.input}"`));
    console.log(yellow(`${"─".repeat(60)}`));

    const t0 = Date.now();

    try {
      // Resolve
      const target = pipeline.resolveTarget(tc.input);
      const resolveMs = Date.now() - t0;

      console.log(`  Resolved: [${target.provinces.join(", ")}]  mode=${target.intent.mode}  national=${!!target.national}  (${resolveMs}ms)`);

      // Check provinces
      let provOk = true;
      if (tc.expectNoProvince) {
        if (target.provinces.length !== 0) {
          console.log(red(`  FAIL: Expected 0 provinces, got ${target.provinces.length}`));
          provOk = false;
        }
      } else if (tc.expectNational) {
        // National: provinces=[] is expected, national=true required
        if (target.provinces.length !== 0) {
          console.log(red(`  FAIL: National query expected 0 provinces, got ${target.provinces.length}`));
          provOk = false;
        }
        if (!target.national) {
          console.log(red(`  FAIL: Expected national=true, got ${target.national}`));
          provOk = false;
        }
      } else {
        for (const ep of tc.expectProvinces) {
          if (!target.provinces.includes(ep)) {
            console.log(red(`  FAIL: Missing province "${ep}"`));
            provOk = false;
          }
        }
      }

      // Check mode
      const modeOk = target.intent.mode === tc.expectMode;
      if (!modeOk) {
        console.log(red(`  FAIL: Expected mode="${tc.expectMode}", got "${target.intent.mode}"`));
      }

      // Execute pipeline (live TMD call)
      console.log(dim(`  Executing pipeline...`));
      const results = await pipeline.execute(target);
      const totalMs = Date.now() - t0;

      for (const r of results) {
        if (r.type === "error") {
          if (tc.expectNoProvince && r.error === "PROVINCE_MISSING") {
            console.log(green(`  ✓ PROVINCE_MISSING (blocked, no MCP call)`));
          } else {
            console.log(red(`  ✗ Error: province="${r.province}" error="${r.error}"`));
          }
        } else if (r.type === "national") {
          const tableLen = r.data?.table?.length || 0;
          console.log(green(`  ✓ NATIONAL: date=${r.data?.date} rainy=${r.data?.totalRainyProvinces} top=${tableLen}`));
          if (r.data?.table?.[0]) {
            console.log(dim(`    sample: ${JSON.stringify(r.data.table[0]).slice(0, 150)}...`));
          }
        } else {
          const dataPreview = JSON.stringify(r.data).slice(0, 200);
          console.log(green(`  ✓ ${r.province}: type=${r.type} source=${r.sourceTool}`));
          console.log(dim(`    data: ${dataPreview}...`));
        }
      }

      // Determine pass/fail
      let resultsOk: boolean;
      if (tc.expectNoProvince) {
        resultsOk = results.length === 1 && results[0].error === "PROVINCE_MISSING";
      } else if (tc.expectNational) {
        // National: expect type="national" with table data, NOT PROVINCE_MISSING
        const nat = results.find(r => r.type === "national");
        resultsOk = !!nat && Array.isArray(nat.data?.table) && nat.data.table.length > 0;
        if (!resultsOk) {
          console.log(red(`  FAIL: Expected national result with table data`));
        }
      } else {
        resultsOk = results.filter(r => r.type !== "error").length >= tc.expectProvinces.length;
      }

      const testPass = provOk && modeOk && resultsOk;

      console.log(`\n  ${testPass ? green("PASS") : red("FAIL")}  (${totalMs}ms)`);
      if (testPass) passed++; else failed++;

    } catch (err: any) {
      console.log(red(`  EXCEPTION: ${err.message}`));
      failed++;
    }
  }

  // 5. Summary
  console.log(yellow(`\n${"═".repeat(60)}`));
  console.log(`TOTAL: ${passed + failed} tests | ${green(`${passed} passed`)} | ${failed > 0 ? red(`${failed} failed`) : green("0 failed")}`);
  console.log(yellow(`${"═".repeat(60)}\n`));

  await client.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(red(`Fatal: ${err.message}`));
  process.exit(2);
});

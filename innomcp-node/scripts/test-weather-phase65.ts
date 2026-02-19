/**
 * Phase 6.5 + 6.5.2 Weather Architecture - Acceptance Tests
 * Tests locationResolver + weatherPipeline resolveTarget + mock execute (no live MCP)
 */

import { resolveProvinces } from "../src/utils/locationResolver";
import { WeatherPipeline } from "../src/utils/weather/weatherPipeline";

// ─── Colors ───
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(green(`  ✓ ${testName}`));
    passed++;
  } else {
    console.log(red(`  ✗ ${testName}`));
    if (details) console.log(red(`    → ${details}`));
    failed++;
  }
}

// ════════════════════════════════════════
// TEST 1: Multi-province with alias
// ════════════════════════════════════════
console.log(yellow("\n═══ Test 1: ลาดกระบัง + เชียงแสน ═══"));
{
  const result = resolveProvinces("ลาดกระบัง และ เชียงแสน สัปดาห์นี้ฝนตกไหม");
  console.log("  Result:", result);
  assert(result.includes("กรุงเทพมหานคร"), "ลาดกระบัง → กรุงเทพมหานคร");
  assert(result.includes("เชียงราย"), "เชียงแสน → เชียงราย");
  assert(result.length === 2, `Exactly 2 provinces (got ${result.length})`);
}

// ════════════════════════════════════════
// TEST 2: Comma-separated provinces
// ════════════════════════════════════════
console.log(yellow("\n═══ Test 2: สมุทรสาคร, ศรีสะเกษ ═══"));
{
  const result = resolveProvinces("บอกตารางแสดงอากาศ ของ สมุทรสาคร , ศรีสะเกษ");
  console.log("  Result:", result);
  assert(result.includes("สมุทรสาคร"), "สมุทรสาคร found");
  assert(result.includes("ศรีสะเกษ"), "ศรีสะเกษ found");
  assert(result.length === 2, `Exactly 2 provinces (got ${result.length})`);
}

// ════════════════════════════════════════
// TEST 3: Unsegmented Thai (no spaces)
// ════════════════════════════════════════
console.log(yellow("\n═══ Test 3: พรุ่งนี้หลักสี่ฝนจะตกไหม (no spaces) ═══"));
{
  const result = resolveProvinces("พรุ่งนี้หลักสี่ฝนจะตกไหม");
  console.log("  Result:", result);
  assert(result.includes("กรุงเทพมหานคร"), "หลักสี่ → กรุงเทพมหานคร");
  assert(result.length >= 1, "At least 1 province resolved");
}

// ════════════════════════════════════════
// TEST 4: Fake province → empty
// ════════════════════════════════════════
console.log(yellow("\n═══ Test 4: เมืองทิพย์ (fake) ═══"));
{
  const result = resolveProvinces("เมืองทิพย์พรุ่งนี้ฝนตกไหม");
  console.log("  Result:", result);
  assert(result.length === 0, `PROVINCE_MISSING (got ${result.length} provinces: [${result.join(",")}])`);
}

// ════════════════════════════════════════
// TEST 5: Direct province name
// ════════════════════════════════════════
console.log(yellow("\n═══ Test 5: กรุงเทพมหานคร พยากรณ์ 7 วัน ═══"));
{
  const result = resolveProvinces("กรุงเทพมหานคร พยากรณ์ 7 วัน");
  console.log("  Result:", result);
  assert(result.includes("กรุงเทพมหานคร"), "กรุงเทพมหานคร found");
  assert(result.length === 1, `Exactly 1 province (got ${result.length})`);
}

// ════════════════════════════════════════
// Additional edge cases
// ════════════════════════════════════════
console.log(yellow("\n═══ Extra: Edge cases ═══"));
{
  const r1 = resolveProvinces("bangkok weather today");
  assert(r1.includes("กรุงเทพมหานคร"), "bangkok → กรุงเทพมหานคร");

  const r2 = resolveProvinces("กทม อากาศวันนี้");
  assert(r2.includes("กรุงเทพมหานคร"), "กทม → กรุงเทพมหานคร");

  const r3 = resolveProvinces("โคราช ฝนตกไหม");
  assert(r3.includes("นครราชสีมา"), "โคราช → นครราชสีมา");

  const r4 = resolveProvinces("กรุงเทพเชียงใหม่");
  assert(r4.includes("กรุงเทพมหานคร"), "กรุงเทพ substring → กรุงเทพมหานคร");
  assert(r4.includes("เชียงใหม่"), "เชียงใหม่ substring → เชียงใหม่");

  const r5 = resolveProvinces("สมุทรสาคร");
  assert(r5.length === 1 && r5[0] === "สมุทรสาคร", "สมุทรสาคร exact (no false positives)");
}

// ════════════════════════════════════════
// Nationwide: mode detection via resolveTarget
// ════════════════════════════════════════
console.log(yellow("\n═══ Nationwide: mode detection ═══"));
{
  const pipeline = new WeatherPipeline(new Map());

  // Nationwide queries → mode="nationwide"
  const t1 = pipeline.resolveTarget("พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง");
  assert(t1.intent.mode === "nationwide", `"ในไทย...ที่ไหนฝนตก" → mode=nationwide (got ${t1.intent.mode})`);
  assert(t1.provinces.length === 0, `provinces=[] (got ${t1.provinces.length})`);

  const t2 = pipeline.resolveTarget("อากาศทั่วประเทศวันนี้");
  assert(t2.intent.mode === "nationwide", `"ทั่วประเทศ" → mode=nationwide (got ${t2.intent.mode})`);

  const t3 = pipeline.resolveTarget("ฝนตกที่ไหนในประเทศไทย");
  assert(t3.intent.mode === "nationwide", `"ประเทศไทย" → mode=nationwide (got ${t3.intent.mode})`);

  const t4 = pipeline.resolveTarget("สภาพอากาศทั่วไทย");
  assert(t4.intent.mode === "nationwide", `"ทั่วไทย" → mode=nationwide (got ${t4.intent.mode})`);

  const t5 = pipeline.resolveTarget("ทั้งประเทศฝนตกไหมพรุ่งนี้");
  assert(t5.intent.mode === "nationwide", `"ทั้งประเทศ" → mode=nationwide (got ${t5.intent.mode})`);

  const t6 = pipeline.resolveTarget("จังหวัดไหนฝนตกวันนี้");
  assert(t6.intent.mode === "nationwide", `"จังหวัดไหนฝนตก" → mode=nationwide (got ${t6.intent.mode})`);
}

// ════════════════════════════════════════
// Regression: fake province still blocked, province-specific not nationwide
// ════════════════════════════════════════
console.log(yellow("\n═══ Regression: Fake vs Nationwide ═══"));
{
  const pipeline = new WeatherPipeline(new Map());

  // Fake province: provinces=[], no nationwide keywords → mode stays original
  const fake = pipeline.resolveTarget("เมืองทิพย์พรุ่งนี้ฝนตกไหม");
  assert(fake.intent.mode !== "nationwide", `fake → NOT nationwide (got ${fake.intent.mode})`);
  assert(fake.provinces.length === 0, `fake → provinces=[] (got ${fake.provinces.length})`);

  // Province-specific + nationwide-like words → NOT nationwide (has province)
  const specific = pipeline.resolveTarget("กรุงเทพมหานคร ฝนตกที่ไหนในไทย");
  assert(specific.intent.mode !== "nationwide", `province + 'ในไทย' → NOT nationwide (got ${specific.intent.mode})`);
  assert(specific.provinces.includes("กรุงเทพมหานคร"), "province still resolved");

  // Greeting: no province, no nationwide keywords → NOT nationwide
  const empty = pipeline.resolveTarget("สวัสดีครับ");
  assert(empty.intent.mode !== "nationwide", `greeting → NOT nationwide (got ${empty.intent.mode})`);
  assert(empty.provinces.length === 0, "greeting → no provinces");
}

// ─── Async tests wrapper ───
async function runAsyncTests() {

// ════════════════════════════════════════
// Nationwide execute: mock single-MCP-call + >=10 rows
// ════════════════════════════════════════
console.log(yellow("\n═══ Nationwide execute: mock MCP (1 call, >=10 rows) ═══"));
await (async () => {
  // Build fake TMD payload with 20 provinces, all rainy
  const fakeProvinces = Array.from({ length: 20 }, (_, i) => {
    const dd = String(new Date(Date.now() + 7 * 3600_000 + 86400_000).getUTCDate()).padStart(2, "0");
    const mm = String(new Date(Date.now() + 7 * 3600_000 + 86400_000).getUTCMonth() + 1).padStart(2, "0");
    const yyyy = new Date(Date.now() + 7 * 3600_000 + 86400_000).getUTCFullYear();
    const tomorrowDate = `${dd}/${mm}/${yyyy}`;
    return {
      ProvinceNameThai: `จังหวัดทดสอบ${i + 1}`,
      SevenDaysForecast: {
        ForecastDate: [tomorrowDate],
        PercentRainCover: [String(90 - i * 4)],
        MaximumTemperature: ["35.0"],
        MinimumTemperature: ["25.0"],
        WindDirection: ["180"],
        WindSpeed: ["10"],
        DescriptionThai: ["ฝนฟ้าคะนอง"],
      },
    };
  });

  let callCount = 0;
  const mockClient = {
    callTool: async ({ name }: { name: string; arguments: any }) => {
      callCount++;
      return {
        structuredContent: {
          ok: true,
          meta: {},
          data: [{ Provinces: { Province: fakeProvinces } }],
        },
      };
    },
  };

  const clients = new Map<string, any>();
  clients.set("innomcp-server", mockClient);
  const pipeline = new WeatherPipeline(clients);

  const target = pipeline.resolveTarget("พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง บอกในรูปแบบตาราง");
  assert(target.intent.mode === "nationwide", `resolveTarget → mode=nationwide`);

  const results = await pipeline.execute(target);
  assert(results.length === 1, `1 result (got ${results.length})`);
  assert(results[0].type === "national", `type=national (got ${results[0].type})`);
  assert(results[0].type !== "error", `NOT error (got ${results[0].error || "ok"})`);

  const table = results[0].data?.table;
  assert(Array.isArray(table) && table.length >= 10, `table rows >=10 (got ${table?.length})`);
  assert(table.length <= 15, `table rows <=15 (got ${table?.length})`);

  // Verify column structure
  const row = table?.[0];
  assert(row?.Province !== undefined, `column Province exists`);
  assert(row?.["%Rain"] !== undefined, `column %Rain exists`);
  assert(row?.MaxTemp !== undefined, `column MaxTemp exists`);
  assert(row?.MinTemp !== undefined, `column MinTemp exists`);
  assert(row?.WindSpeed !== undefined, `column WindSpeed exists`);
  assert(row?.WindDir !== undefined, `column WindDir exists`);
  assert(row?.Humidity === "—", `column Humidity = "—"`);

  // Only ONE MCP call (cached forecast call, no station)
  assert(callCount === 1, `exactly 1 MCP call (got ${callCount})`);

  // Verify footnote
  assert(results[0].data?.footnote?.includes("ความชื้น"), `footnote mentions ความชื้น`);
})();

// ════════════════════════════════════════
// Fake province execute: PROVINCE_MISSING, zero MCP calls
// ════════════════════════════════════════
console.log(yellow("\n═══ Fake province: PROVINCE_MISSING, 0 MCP calls ═══"));
await (async () => {
  let callCount = 0;
  const mockClient = {
    callTool: async () => { callCount++; return {}; },
  };

  const clients = new Map<string, any>();
  clients.set("innomcp-server", mockClient);
  const pipeline = new WeatherPipeline(clients);

  const target = pipeline.resolveTarget("เมืองทิพย์พรุ่งนี้ฝนตกไหม");
  const results = await pipeline.execute(target);

  assert(results.length === 1 && results[0].error === "PROVINCE_MISSING", "PROVINCE_MISSING returned");
  assert(callCount === 0, `zero MCP calls (got ${callCount})`);
})();

} // end runAsyncTests

// ─── Run async tests then summarize ───
runAsyncTests().then(() => {
// ════════════════════════════════════════
// Summary
// ════════════════════════════════════════
console.log(yellow("\n═══════════════════════════════════════"));
console.log(`Total: ${passed + failed} tests | ${green(`${passed} passed`)} | ${failed > 0 ? red(`${failed} failed`) : green("0 failed")}`);
console.log(yellow("═══════════════════════════════════════\n"));

process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error(red(`Async test error: ${err.message}`));
  process.exit(2);
});

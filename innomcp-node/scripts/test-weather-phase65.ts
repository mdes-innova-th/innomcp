/**
 * Phase 6.5 + 6.5.1 Weather Architecture - Acceptance Tests
 * Tests locationResolver + weatherPipeline resolveTarget logic (no live MCP needed)
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
  // Test English alias
  const r1 = resolveProvinces("bangkok weather today");
  assert(r1.includes("กรุงเทพมหานคร"), "bangkok → กรุงเทพมหานคร");

  // Test short alias
  const r2 = resolveProvinces("กทม อากาศวันนี้");
  assert(r2.includes("กรุงเทพมหานคร"), "กทม → กรุงเทพมหานคร");

  // Test colloquial
  const r3 = resolveProvinces("โคราช ฝนตกไหม");
  assert(r3.includes("นครราชสีมา"), "โคราช → นครราชสีมา");

  // Test multi without spaces: "กรุงเทพเชียงใหม่"
  const r4 = resolveProvinces("กรุงเทพเชียงใหม่");
  // "กรุงเทพ" alias should match, and "เชียงใหม่" province should match
  assert(r4.includes("กรุงเทพมหานคร"), "กรุงเทพ substring → กรุงเทพมหานคร");
  assert(r4.includes("เชียงใหม่"), "เชียงใหม่ substring → เชียงใหม่");

  // Test that สมุทรสาคร doesn't also match สมุทรสงคราม or สมุทรปราการ
  const r5 = resolveProvinces("สมุทรสาคร");
  assert(r5.length === 1 && r5[0] === "สมุทรสาคร", "สมุทรสาคร exact (no false positives)");
}

// ════════════════════════════════════════
// Phase 6.5.1: National query detection
// ════════════════════════════════════════
console.log(yellow("\n═══ Phase 6.5.1: National query detection ═══"));
{
  // Create a mock pipeline (no live clients needed for resolveTarget)
  const pipeline = new WeatherPipeline(new Map());

  // Test 6a: National query → national=true, provinces=[]
  const t1 = pipeline.resolveTarget("พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง");
  assert(t1.national === true, "national=true for 'ในไทย...ที่ไหน...บ้าง'");
  assert(t1.provinces.length === 0, `provinces=[] (got ${t1.provinces.length})`);
  assert(t1.intent.mode === "future", `mode=future (got ${t1.intent.mode})`);

  // Test 6b: "ทั่วประเทศ" variant
  const t2 = pipeline.resolveTarget("อากาศทั่วประเทศวันนี้");
  assert(t2.national === true, "national=true for 'ทั่วประเทศ'");
  assert(t2.provinces.length === 0, `provinces=[] (got ${t2.provinces.length})`);

  // Test 6c: "ประเทศไทย" variant
  const t3 = pipeline.resolveTarget("ฝนตกที่ไหนในประเทศไทย");
  assert(t3.national === true, "national=true for 'ประเทศไทย'");

  // Test 6d: "ทั่วไทย" variant
  const t4 = pipeline.resolveTarget("สภาพอากาศทั่วไทย");
  assert(t4.national === true, "national=true for 'ทั่วไทย'");
}

// ════════════════════════════════════════
// Phase 6.5.1: Regression - fake province still blocked
// ════════════════════════════════════════
console.log(yellow("\n═══ Phase 6.5.1 Regression: Fake vs National ═══"));
{
  const pipeline = new WeatherPipeline(new Map());

  // Fake province: national=false, provinces=[]
  const fake = pipeline.resolveTarget("เมืองทิพย์พรุ่งนี้ฝนตกไหม");
  assert(fake.national === false || fake.national === undefined, "fake → national=false");
  assert(fake.provinces.length === 0, `fake → provinces=[] (got ${fake.provinces.length})`);

  // Province-specific query: national=false even with national-like words
  const specific = pipeline.resolveTarget("กรุงเทพมหานคร ฝนตกที่ไหนบ้าง");
  assert(specific.national !== true, "province + 'ที่ไหนบ้าง' → NOT national (has province)");
  assert(specific.provinces.includes("กรุงเทพมหานคร"), "province still resolved");

  // Empty non-national: no province, no national keywords
  const empty = pipeline.resolveTarget("สวัสดีครับ");
  assert(empty.national !== true, "greeting → NOT national");
  assert(empty.provinces.length === 0, "greeting → no provinces");
}

// ════════════════════════════════════════
// Summary
// ════════════════════════════════════════
console.log(yellow("\n═══════════════════════════════════════"));
console.log(`Total: ${passed + failed} tests | ${green(`${passed} passed`)} | ${failed > 0 ? red(`${failed} failed`) : green("0 failed")}`);
console.log(yellow("═══════════════════════════════════════\n"));

process.exit(failed > 0 ? 1 : 0);

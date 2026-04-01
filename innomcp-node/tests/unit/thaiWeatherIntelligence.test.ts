/**
 * Unit tests for Thai Weather Intelligence utilities
 * Tests all 20 target queries from the Thai intelligence gap closure mission.
 * Run with: npx ts-node tests/unit/thaiWeatherIntelligence.test.ts
 */

import { quickNormalize, normalizeThaiQuery, hasWeatherIntent } from "../../src/utils/thaiQueryNormalizer";
import { hasTemporalIndicators, parseThaiTemporal } from "../../src/utils/thaiTemporalParser";
import { resolveProvinces } from "../../src/utils/locationResolver";

// ---------------------------------------------------------------------------
// Minimal assertion helper (no jest dep)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, actual: unknown, expected: unknown): void {
  const ok =
    typeof expected === "boolean"
      ? actual === expected
      : JSON.stringify(actual) === JSON.stringify(expected);

  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    const msg = `  ❌ ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`;
    console.log(msg);
    failures.push(msg);
    failed++;
  }
}

function assertContains(label: string, actual: string, substring: string): void {
  if (actual.includes(substring)) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    const msg = `  ❌ ${label}\n       expected to contain: "${substring}"\n       actual: "${actual}"`;
    console.log(msg);
    failures.push(msg);
    failed++;
  }
}

function assertNotContains(label: string, actual: string, substring: string): void {
  if (!actual.includes(substring)) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    const msg = `  ❌ ${label}\n       expected NOT to contain: "${substring}"\n       actual: "${actual}"`;
    console.log(msg);
    failures.push(msg);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n── ${name}`);
}

// ---------------------------------------------------------------------------
// Section 1: Colloquial particle normalization
// ---------------------------------------------------------------------------

section("1. Colloquial particle normalization");

// Q1: มีมะ → มีไหม
assertContains("Q1: ฝนตกมีมะที่กรุงเทพ → มีไหม", quickNormalize("ฝนตกมีมะที่กรุงเทพ"), "มีไหม");
assertNotContains("Q1: มีมะ removed", quickNormalize("ฝนตกมีมะที่กรุงเทพ"), "มีมะ");

// Q2: ปะ → ไหม
assertContains("Q2: อากาศเชียงใหม่พรุ่งนี้ปะ → ไหม", quickNormalize("อากาศเชียงใหม่พรุ่งนี้ปะ"), "ไหม");

// Q4: ล่ะ removed
assertNotContains("Q4: กทม อุณหภูมิวันนี้ล่ะ → ล่ะ removed", quickNormalize("กทม อุณหภูมิวันนี้ล่ะ"), "ล่ะ");

// Q8: มั้ย → ไหม
assertContains("Q8: ภูเก็จฝนตกมั้ย → ไหม", quickNormalize("ภูเก็จฝนตกมั้ย"), "ไหม");
assertNotContains("Q8: มั้ย removed", quickNormalize("ภูเก็จฝนตกมั้ย"), "มั้ย");

// Q20: มีมะ + ล่ะ both removed
const q20norm = quickNormalize("ฝนตกมีมะที่แปดริ้วช่วงนี้ล่ะ");
assertContains("Q20: มีมะ → มีไหม", q20norm, "มีไหม");
assertNotContains("Q20: ล่ะ removed", q20norm, "ล่ะ");

// ---------------------------------------------------------------------------
// Section 2: Temporal typo corrections
// ---------------------------------------------------------------------------

section("2. Temporal typo corrections");

// Q9: ศกนี้ → ศุกร์นี้
assertContains("Q9: ศกนี้ → ศุกร์นี้", quickNormalize("ศกนี้ที่เชียงรายฝน"), "ศุกร์นี้");
assertNotContains("Q9: ศกนี้ removed", quickNormalize("ศกนี้ที่เชียงรายฝน"), "ศกนี้");

// Q11: สัปดาหน้า → สัปดาห์หน้า
assertContains("Q11: สัปดาหน้า → สัปดาห์หน้า", quickNormalize("ฝนตกไหมอยุธยาสัปดาหน้า"), "สัปดาห์หน้า");

// Q7: weekหน้า → สัปดาห์หน้า
assertContains("Q7: weekหน้า → สัปดาห์หน้า", quickNormalize("หัวหินweekหน้าฝนตกไหม"), "สัปดาห์หน้า");

// Q17: weekนี้ → สัปดาห์นี้
assertContains("Q17: weekนี้ → สัปดาห์นี้", quickNormalize("สมุยweekนี้ร้อนไหม"), "สัปดาห์นี้");

// Q15: เชียงใม่ → เชียงใหม่
assertContains("Q15: เชียงใม่ → เชียงใหม่", quickNormalize("เชียงใม่อากาศดีไหม"), "เชียงใหม่");

// ---------------------------------------------------------------------------
// Section 3: Temporal indicator detection
// ---------------------------------------------------------------------------

section("3. Temporal indicator detection (hasTemporalIndicators)");

assert("Q2: พรุ่งนี้ detected", hasTemporalIndicators("อากาศเชียงใหม่พรุ่งนี้ไหม"), true);
assert("Q3: วันศุกร์นี้ detected", hasTemporalIndicators("โคราชฝนตกไหมวันศุกร์นี้"), true);
assert("Q5: วันศุกร์ detected", hasTemporalIndicators("แม่สายวันศุกร์อากาศเป็นไง"), true);
assert("Q6: อาทิตย์นี้ detected", hasTemporalIndicators("อุบลอาทิตย์นี้เป็นไง"), true);
assert("Q9: ศุกร์นี้ (after normalize) detected", hasTemporalIndicators("ศุกร์นี้ที่เชียงรายฝน"), true);
assert("Q11: สัปดาห์หน้า detected", hasTemporalIndicators("ฝนตกไหมอยุธยาสัปดาห์หน้า"), true);
assert("Q12: อาทิตย์หน้า detected", hasTemporalIndicators("หาดใหญ่อาทิตย์หน้าเป็นยังไง"), true);
assert("Q13: พรุ่งนี้ detected", hasTemporalIndicators("นราธิวาสพรุ่งนี้อากาศเป็นไง"), true);
assert("Q14: มะรืน detected", hasTemporalIndicators("ประจวบฝนตกไหมมะรืน"), true);
assert("Q16: คืนนี้ detected", hasTemporalIndicators("กรุงเทพฝนมั้ยคืนนี้"), true);
assert("Q18: วันเสาร์ detected", hasTemporalIndicators("แม่กลองอุณหภูมิวันเสาร์"), true);
assert("Q19: สัปดาห์หน้า detected", hasTemporalIndicators("ภาคเหนือสัปดาห์หน้าอากาศเป็นไง"), true);

// ---------------------------------------------------------------------------
// Section 4: Province alias resolution
// ---------------------------------------------------------------------------

section("4. Province alias resolution (resolveProvinces)");

// Direct aliases via resolveProvinces
assert("Q3: โคราช → นครราชสีมา", resolveProvinces("โคราชฝนตกไหมวันศุกร์นี้").includes("นครราชสีมา"), true);
assert("Q4: กทม → กรุงเทพมหานคร", resolveProvinces("กทม อุณหภูมิวันนี้").includes("กรุงเทพมหานคร"), true);
assert("Q5: แม่สาย → เชียงราย", resolveProvinces("แม่สายวันศุกร์อากาศเป็นไง").includes("เชียงราย"), true);
assert("Q6: อุบล → อุบลราชธานี", resolveProvinces("อุบลอาทิตย์นี้เป็นไง").includes("อุบลราชธานี"), true);
assert("Q7: หัวหิน → ประจวบคีรีขันธ์", resolveProvinces("หัวหินweekหน้าฝนตกไหม").includes("ประจวบคีรีขันธ์"), true);
assert("Q11: อยุธยา → พระนครศรีอยุธยา", resolveProvinces("ฝนตกไหมอยุธยาสัปดาห์หน้า").includes("พระนครศรีอยุธยา"), true);
assert("Q12: หาดใหญ่ → สงขลา", resolveProvinces("หาดใหญ่อาทิตย์หน้าเป็นยังไง").includes("สงขลา"), true);
assert("Q17: สมุย → สุราษฎร์ธานี", resolveProvinces("สมุยweekนี้ร้อนไหม").includes("สุราษฎร์ธานี"), true);
assert("Q18: แม่กลอง → สมุทรสงคราม", resolveProvinces("แม่กลองอุณหภูมิวันเสาร์").includes("สมุทรสงคราม"), true);
assert("Q20: แปดริ้ว → ฉะเชิงเทรา", resolveProvinces("ฝนตกมีมะที่แปดริ้วช่วงนี้").includes("ฉะเชิงเทรา"), true);

// Direct provinces (should resolve to themselves)
assert("Q1: กรุงเทพ resolved", resolveProvinces("ฝนตกที่กรุงเทพวันนี้").includes("กรุงเทพมหานคร"), true);
assert("Q13: นราธิวาส resolved", resolveProvinces("นราธิวาสพรุ่งนี้อากาศเป็นไง").includes("นราธิวาส"), true);

// Multi-province (Q10)
const q10provinces = resolveProvinces("ยะลากับปัตตานีอากาศเทียบกันหน่อย");
assert("Q10: ยะลา resolved", q10provinces.includes("ยะลา"), true);
assert("Q10: ปัตตานี resolved", q10provinces.includes("ปัตตานี"), true);
assert("Q10: 2 provinces found", q10provinces.length >= 2, true);

// ---------------------------------------------------------------------------
// Section 5: Temporal parsing
// ---------------------------------------------------------------------------

section("5. Temporal parsing (parseThaiTemporal)");

const ref = new Date("2026-03-31T09:00:00"); // Tuesday

const todayResult = parseThaiTemporal("อากาศวันนี้เป็นอย่างไร", ref);
assert("วันนี้ → today type", todayResult?.temporalType, "today");
assert("วันนี้ → offset 0", todayResult?.offsetDays[0], 0);

const tomorrowResult = parseThaiTemporal("พรุ่งนี้ฝนตกไหม", ref);
assert("พรุ่งนี้ → tomorrow type", tomorrowResult?.temporalType, "tomorrow");
assert("พรุ่งนี้ → offset 1", tomorrowResult?.offsetDays[0], 1);

const maruenResult = parseThaiTemporal("มะรืนอากาศเป็นยังไง", ref);
assert("มะรืน → day_after_tomorrow", maruenResult?.temporalType, "day_after_tomorrow");
assert("มะรืน → offset 2", maruenResult?.offsetDays[0], 2);

const tonightResult = parseThaiTemporal("คืนนี้ฝนตกไหม", ref);
assert("คืนนี้ → tonight", tonightResult?.temporalType, "tonight");

const nextWeekResult = parseThaiTemporal("สัปดาห์หน้าอากาศเป็นไง", ref);
assert("สัปดาห์หน้า → next_week", nextWeekResult?.temporalType, "next_week");

const thisWeekResult = parseThaiTemporal("สัปดาห์นี้ฝน", ref);
assert("สัปดาห์นี้ → this_week", thisWeekResult?.temporalType, "this_week");

// Weekday: Friday (day=5). ref is Tuesday (day=2). Next Friday = 3 days ahead
const fridayResult = parseThaiTemporal("ศุกร์นี้อากาศเป็นไง", ref);
assert("ศุกร์นี้ → specific_day", fridayResult?.temporalType, "specific_day");
assert("ศุกร์นี้ → positive offset", (fridayResult?.offsetDays?.[0] ?? -1) >= 0, true);

// ---------------------------------------------------------------------------
// Section 6: Weather intent detection
// ---------------------------------------------------------------------------

section("6. Weather intent (hasWeatherIntent)");

assert("weather: อากาศ", hasWeatherIntent("อากาศเชียงใหม่วันนี้"), true);
assert("weather: ฝนตก", hasWeatherIntent("ฝนตกมั้ยที่กรุงเทพ"), true);
assert("weather: พยากรณ์", hasWeatherIntent("พยากรณ์อากาศพรุ่งนี้"), true);
assert("non-weather: สวัสดี", hasWeatherIntent("สวัสดีครับ"), false);
assert("non-weather: คำนวณ", hasWeatherIntent("2+2 เท่ากับเท่าไหร่"), false);

// ---------------------------------------------------------------------------
// Section 7: End-to-end normalization pipeline (20 queries)
// ---------------------------------------------------------------------------

section("7. End-to-end: normalizeForWeatherPipeline equivalent (20 queries)");

/** Replicate normalizeForWeatherPipeline logic here for isolated testing */
function normalizePipeline(text: string): string {
  const normalized = quickNormalize(text);
  const ALIAS_EXPAND: Record<string, string> = {
    "กทม": "กรุงเทพมหานคร",
    "โคราช": "นครราชสีมา",
    "อุบล": "อุบลราชธานี",
    "อุดร": "อุดรธานี",
    "อยุธยา": "พระนครศรีอยุธยา",
    "แม่กลอง": "สมุทรสงคราม",
    "อัมพวา": "สมุทรสงคราม",
    "หาดใหญ่": "สงขลา",
    "แม่สาย": "เชียงราย",
    "หัวหิน": "ประจวบคีรีขันธ์",
    "สมุย": "สุราษฎร์ธานี",
    "เกาะสมุย": "สุราษฎร์ธานี",
    "แปดริ้ว": "ฉะเชิงเทรา",
    "เมืองกาญ": "กาญจนบุรี",
    "เมืองคอน": "นครศรีธรรมราช",
    "นครสี": "นครศรีธรรมราช",
  };
  let result = normalized;
  for (const [alias, canonical] of Object.entries(ALIAS_EXPAND)) {
    const re = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    result = result.replace(re, canonical);
  }
  return result.trim();
}

const Q: [string, string, string][] = [
  // [id, raw, expected_fragment_in_normalized]
  ["Q1",  "ฝนตกมีมะที่กรุงเทพ",               "มีไหม"],
  ["Q2",  "อากาศเชียงใหม่พรุ่งนี้ปะ",           "ไหม"],
  ["Q3",  "โคราชฝนตกไหมวันศุกร์นี้",           "นครราชสีมา"],
  ["Q4",  "กทม อุณหภูมิวันนี้ล่ะ",             "กรุงเทพมหานคร"],
  ["Q5",  "แม่สายวันศุกร์อากาศเป็นไง",          "เชียงราย"],
  ["Q6",  "อุบลอาทิตย์นี้เป็นไง",              "อุบลราชธานี"],
  ["Q7",  "หัวหินweekหน้าฝนตกไหม",            "สัปดาห์หน้า"],
  ["Q8",  "ภูเก็จฝนตกมั้ย",                   "ภูเก็ต"],
  ["Q9",  "ศกนี้ที่เชียงรายฝน",               "ศุกร์นี้"],
  ["Q10", "ยะลากับปัตตานีอากาศเทียบกันหน่อย", "ยะลา"],
  ["Q11", "ฝนตกไหมอยุธยาสัปดาหน้า",           "สัปดาห์หน้า"],
  ["Q12", "หาดใหญ่อาทิตย์หน้าเป็นยังไง",       "สงขลา"],
  ["Q13", "นราธิวาสพรุ่งนี้อากาศเป็นไง",        "นราธิวาส"],
  ["Q14", "ประจวบฝนตกไหมมะรืน",              "ประจวบ"],
  ["Q15", "เชียงใม่อากาศดีไหม",               "เชียงใหม่"],
  ["Q16", "กรุงเทพฝนมั้ยคืนนี้",              "ไหม"],
  ["Q17", "สมุยweekนี้ร้อนไหม",               "สัปดาห์นี้"],
  ["Q18", "แม่กลองอุณหภูมิวันเสาร์",           "สมุทรสงคราม"],
  ["Q19", "ภาคเหนือสัปดาห์หน้าอากาศเป็นไง",   "สัปดาห์หน้า"],
  ["Q20", "ฝนตกมีมะที่แปดริ้วช่วงนี้ล่ะ",      "ฉะเชิงเทรา"],
];

for (const [id, raw, expected] of Q) {
  const norm = normalizePipeline(raw);
  assertContains(`${id}: "${raw}" → contains "${expected}"`, norm, expected);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(60)}`);
console.log(`Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);

if (failures.length > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(f));
  // Use throw instead of process.exit for Jest compatibility
  throw new Error(`${failures.length} test(s) failed`);
} else {
  console.log("\nAll tests passed.");
}

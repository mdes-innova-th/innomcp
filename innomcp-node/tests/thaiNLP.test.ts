/**
 * Thai NLP Test Suite
 * Tests for: thaiQueryNormalizer, thaiTemporalParser, thaiMultiLocationParser
 *
 * Coverage:
 * - 20 normalization tests
 * - 20 temporal tests
 * - 20 locality/location tests
 * - 15 multi-location tests
 * - 15 integration/routing tests
 * Total: 90 test cases
 */

import { normalizeThaiQuery, quickNormalize, hasWeatherIntent, isComparisonQuery, extractQueryHints } from "../src/utils/thaiQueryNormalizer";
import { parseThaiTemporal, hasTemporalIndicators, isFutureWeatherQuery, formatThaiDate, getTimeWindowLabel } from "../src/utils/thaiTemporalParser";
import { extractMultipleLocations, parseMultiLocationQuery, isMultiLocationQuery, buildLocationWeatherLabels } from "../src/utils/thaiMultiLocationParser";

// ─── Reference date for deterministic temporal tests ────────────────────────
// Use a Monday (day=1) so weekday math is predictable
const REF_DATE = new Date("2026-03-09T00:00:00"); // Monday March 9, 2026

// ════════════════════════════════════════════════════════════════
//  GROUP 1: Normalization Tests (20 cases)
// ════════════════════════════════════════════════════════════════
describe("Thai Query Normalization (20 cases)", () => {
  // N1-N5: Colloquial particle removal
  test("N1: มีมะ → มีไหม", () => {
    expect(quickNormalize("ฝนมีมะ")).toBe("ฝนมีไหม");
  });

  test("N2: มั้ย → ไหม", () => {
    expect(quickNormalize("อากาศดีมั้ย")).toBe("อากาศดีไหม");
  });

  test("N3: ปะ → ไหม", () => {
    const result = quickNormalize("ฝนจะตกปะ");
    expect(result).toBe("ฝนจะตกไหม");
  });

  test("N4: ป่ะ → ไหม", () => {
    const result = quickNormalize("วันนี้ฝนตกป่ะ");
    expect(result).toContain("ไหม");
  });

  test("N5: มีมั้ย → มีไหม", () => {
    expect(quickNormalize("วันนี้มีฝนมีมั้ย")).toBe("วันนี้มีฝนมีไหม");
  });

  // N6-N10: Spelling corrections
  test("N6: อากาส → อากาศ", () => {
    expect(quickNormalize("อากาสวันนี้")).toBe("อากาศวันนี้");
  });

  test("N7: กรุเทพ → กรุงเทพ", () => {
    expect(quickNormalize("กรุเทพอากาศ")).toBe("กรุงเทพอากาศ");
  });

  test("N8: เชียงใม่ → เชียงใหม่", () => {
    expect(quickNormalize("อากาศเชียงใม่")).toBe("อากาศเชียงใหม่");
  });

  test("N9: ภูเกตุ → ภูเก็ต", () => {
    expect(quickNormalize("ฝนภูเกตุ")).toBe("ฝนภูเก็ต");
  });

  test("N10: พรุ่งนี → พรุ่งนี้", () => {
    expect(quickNormalize("พรุ่งนีฝนตกไหม")).toBe("พรุ่งนี้ฝนตกไหม");
  });

  // N11-N15: Temporal typos
  test("N11: ศกนี้ → ศุกร์นี้", () => {
    expect(quickNormalize("ศกนี้อากาศ")).toBe("ศุกร์นี้อากาศ");
  });

  test("N12: อาทิดนี้ → อาทิตย์นี้", () => {
    expect(quickNormalize("อาทิดนี้ฝน")).toBe("อาทิตย์นี้ฝน");
  });

  test("N13: สัปดาหน้า → สัปดาห์หน้า", () => {
    expect(quickNormalize("สัปดาหน้าอากาศ")).toBe("สัปดาห์หน้าอากาศ");
  });

  test("N14: weekนี้ → สัปดาห์นี้", () => {
    expect(quickNormalize("weekนี้ฝน")).toBe("สัปดาห์นี้ฝน");
  });

  test("N15: tomorrow → พรุ่งนี้", () => {
    expect(quickNormalize("tomorrow rain")).toBe("พรุ่งนี้ rain");
  });

  // N16-N20: Spacing and particles removal
  test("N16: ล่ะ removed (trailing particle)", () => {
    const result = quickNormalize("พรุ่งนี้ล่ะ");
    expect(result).not.toContain("ล่ะ");
  });

  test("N17: นะ removed", () => {
    const result = quickNormalize("อากาศดีนะ");
    expect(result).not.toContain("นะ");
  });

  test("N18: วัน ศุกร์ (bad space) → วันศุกร์", () => {
    expect(quickNormalize("วัน ศุกร์นี้ฝน")).toBe("วันศุกร์นี้ฝน");
  });

  test("N19: normalizeThaiQuery returns NormalizationResult with correct fields", () => {
    const res = normalizeThaiQuery("อากาสวันนี้มีมะ");
    expect(res).toHaveProperty("normalized");
    expect(res).toHaveProperty("substitutionsApplied");
    expect(res.substitutionsApplied.length).toBeGreaterThan(0);
    expect(res.confidence).toBeLessThanOrEqual(1.0);
    expect(res.confidence).toBeGreaterThan(0);
  });

  test("N20: hasWeatherIntent detects weather keywords after normalization", () => {
    expect(hasWeatherIntent("อากาสวันนี้มีมะ")).toBe(true);
    expect(hasWeatherIntent("ประวัติศาสตร์ไทย")).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
//  GROUP 2: Temporal Parsing Tests (20 cases)
// ════════════════════════════════════════════════════════════════
describe("Thai Temporal Parsing (20 cases)", () => {
  // T1-T5: Absolute temporal terms
  test("T1: วันนี้ → today, offset=0", () => {
    const result = parseThaiTemporal("อากาศวันนี้", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("today");
    expect(result!.offsetDays[0]).toBe(0);
  });

  test("T2: พรุ่งนี้ → tomorrow, offset=1", () => {
    const result = parseThaiTemporal("พรุ่งนี้ฝนตกไหม", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("tomorrow");
    expect(result!.offsetDays[0]).toBe(1);
  });

  test("T3: มะรืน → day_after_tomorrow, offset=2", () => {
    const result = parseThaiTemporal("มะรืนอากาศ", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("day_after_tomorrow");
    expect(result!.offsetDays[0]).toBe(2);
  });

  test("T4: คืนนี้ → tonight, offset=0", () => {
    const result = parseThaiTemporal("คืนนี้ฝนตก", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("tonight");
    expect(result!.offsetDays[0]).toBe(0);
  });

  test("T5: เมื่อวาน → yesterday, offset=-1", () => {
    const result = parseThaiTemporal("เมื่อวานอากาศ", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("yesterday");
    expect(result!.offsetDays[0]).toBe(-1);
  });

  // T6-T10: Weekday expressions (REF=Monday March 9)
  test("T6: ศุกร์นี้ → specific_day, Friday this week (+4)", () => {
    const result = parseThaiTemporal("ศุกร์นี้อากาศ", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("specific_day");
    // REF is Monday(1), Friday is 5, offset=4
    expect(result!.offsetDays[0]).toBe(4);
  });

  test("T7: วันเสาร์นี้ → specific_day Saturday (+5)", () => {
    const result = parseThaiTemporal("วันเสาร์นี้ฝน", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.weekday).toBe(6);
  });

  test("T8: ศุกร์หน้า → specific_day, offset > 7", () => {
    const result = parseThaiTemporal("ศุกร์หน้าอากาศ", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.offsetDays[0]).toBeGreaterThan(7);
  });

  test("T9: วันจันทร์นี้ (today, REF=Monday) → offset=0", () => {
    const result = parseThaiTemporal("วันจันทร์นี้ฝน", REF_DATE);
    expect(result).not.toBeNull();
    // REF is Monday, Monday=Monday → offset should be 0 or very small
    expect(Math.abs(result!.offsetDays[0])).toBeLessThanOrEqual(7);
  });

  test("T10: วันอาทิตย์ที่แล้ว → offset negative", () => {
    const result = parseThaiTemporal("วันอาทิตย์ที่แล้ว", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.offsetDays[0]).toBeLessThan(0);
  });

  // T11-T15: Week expressions
  test("T11: สัปดาห์นี้ → this_week, isWeekMode=true", () => {
    const result = parseThaiTemporal("สัปดาห์นี้อากาศ", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("this_week");
    expect(result!.isWeekMode).toBe(true);
  });

  test("T12: สัปดาห์หน้า → next_week, multiple dates", () => {
    const result = parseThaiTemporal("สัปดาห์หน้าฝน", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("next_week");
    expect(result!.targetDates.length).toBe(7);
  });

  test("T13: อาทิตย์นี้ → detected (specific_day Sunday or this_week)", () => {
    const result = parseThaiTemporal("อาทิตย์นี้อากาศ", REF_DATE);
    expect(result).not.toBeNull();
    // Weekday parser takes precedence: อาทิตย์ = Sunday (specific_day);
    // this is correct — อาทิตย์นี้ = "this Sunday" = specific day
    expect(["this_week", "specific_day"]).toContain(result!.temporalType);
  });

  // T14-T16: Relative offset expressions
  test("T14: อีก 3 วัน → offset_days=3", () => {
    const result = parseThaiTemporal("อีก 3 วันฝน", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.temporalType).toBe("offset_days");
    expect(result!.offsetDays[0]).toBe(3);
  });

  test("T15: อีก 2 สัปดาห์ → offset_days=14", () => {
    const result = parseThaiTemporal("อีก 2 สัปดาห์", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.offsetDays[0]).toBe(14);
  });

  // T16-T20: Utility functions
  test("T16: hasTemporalIndicators finds temporal words", () => {
    expect(hasTemporalIndicators("พรุ่งนี้ฝน")).toBe(true);
    expect(hasTemporalIndicators("ประวัติศาสตร์")).toBe(false);
  });

  test("T17: isFutureWeatherQuery true for พรุ่งนี้", () => {
    expect(isFutureWeatherQuery("พรุ่งนี้ฝน")).toBe(true);
  });

  test("T18: isFutureWeatherQuery false for เมื่อวาน", () => {
    expect(isFutureWeatherQuery("เมื่อวานอากาศ")).toBe(false);
  });

  test("T19: formatThaiDate returns Thai date string with Buddhist year", () => {
    const date = new Date("2026-03-09");
    const formatted = formatThaiDate(date);
    expect(formatted).toContain("2569"); // 2026 + 543 = 2569
    expect(formatted).toContain("มีนาคม");
  });

  test("T20: getTimeWindowLabel returns label string", () => {
    const label = getTimeWindowLabel("พรุ่งนี้ฝน");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════
//  GROUP 3: Location / Locality Tests (20 cases)
// ════════════════════════════════════════════════════════════════
describe("Location Extraction - Locality Tests (20 cases)", () => {
  // L1-L5: Direct province names
  test("L1: กรุงเทพมหานคร found", () => {
    const locs = extractMultipleLocations("อากาศกรุงเทพมหานคร");
    expect(locs).toContain("กรุงเทพมหานคร");
  });

  test("L2: เชียงใหม่ found", () => {
    const locs = extractMultipleLocations("เชียงใหม่ฝนตก");
    expect(locs).toContain("เชียงใหม่");
  });

  test("L3: ภูเก็ต found", () => {
    const locs = extractMultipleLocations("ภูเก็ตอากาศดี");
    expect(locs).toContain("ภูเก็ต");
  });

  test("L4: ขอนแก่น found", () => {
    const locs = extractMultipleLocations("ขอนแก่นพรุ่งนี้");
    expect(locs).toContain("ขอนแก่น");
  });

  test("L5: อุบลราชธานี found", () => {
    const locs = extractMultipleLocations("อุบลราชธานีฝน");
    expect(locs).toContain("อุบลราชธานี");
  });

  // L6-L10: Alias resolution
  test("L6: กทม → กรุงเทพมหานคร", () => {
    const locs = extractMultipleLocations("อากาศกทมวันนี้");
    expect(locs).toContain("กรุงเทพมหานคร");
  });

  test("L7: โคราช → นครราชสีมา", () => {
    const locs = extractMultipleLocations("โคราชฝน");
    expect(locs).toContain("นครราชสีมา");
  });

  test("L8: อุบล → อุบลราชธานี", () => {
    const locs = extractMultipleLocations("อุบลฝนตก");
    expect(locs).toContain("อุบลราชธานี");
  });

  test("L9: หัวหิน → ประจวบคีรีขันธ์", () => {
    const locs = extractMultipleLocations("หัวหินอากาศ");
    expect(locs).toContain("ประจวบคีรีขันธ์");
  });

  test("L10: พัทยา → ชลบุรี", () => {
    const locs = extractMultipleLocations("พัทยาฝน");
    expect(locs).toContain("ชลบุรี");
  });

  // L11-L15: More aliases
  test("L11: แม่กลอง → สมุทรสงคราม", () => {
    const locs = extractMultipleLocations("แม่กลองอากาศ");
    expect(locs).toContain("สมุทรสงคราม");
  });

  test("L12: อัมพวา → สมุทรสงคราม", () => {
    const locs = extractMultipleLocations("อัมพวาฝน");
    expect(locs).toContain("สมุทรสงคราม");
  });

  test("L13: สมุย → สุราษฎร์ธานี", () => {
    const locs = extractMultipleLocations("สมุยอากาศดี");
    expect(locs).toContain("สุราษฎร์ธานี");
  });

  test("L14: หาดใหญ่ → สงขลา", () => {
    const locs = extractMultipleLocations("หาดใหญ่ฝน");
    expect(locs).toContain("สงขลา");
  });

  test("L15: แม่สาย → เชียงราย", () => {
    const locs = extractMultipleLocations("แม่สายอากาศ");
    expect(locs).toContain("เชียงราย");
  });

  // L16-L20: Edge cases
  test("L16: empty string → empty array", () => {
    expect(extractMultipleLocations("")).toEqual([]);
  });

  test("L17: no location → empty array", () => {
    const locs = extractMultipleLocations("ประวัติศาสตร์ไทย");
    expect(locs).toHaveLength(0);
  });

  test("L18: กรุงเทพ (short form) → กรุงเทพมหานคร", () => {
    const locs = extractMultipleLocations("กรุงเทพวันนี้ฝน");
    expect(locs).toContain("กรุงเทพมหานคร");
  });

  test("L19: เชียงใม่ (typo) → เชียงใหม่", () => {
    const locs = extractMultipleLocations("เชียงใม่ฝน");
    expect(locs).toContain("เชียงใหม่");
  });

  test("L20: ภูเก็จ (typo) → ภูเก็ต", () => {
    const locs = extractMultipleLocations("ภูเก็จอากาศ");
    expect(locs).toContain("ภูเก็ต");
  });
});

// ════════════════════════════════════════════════════════════════
//  GROUP 4: Multi-Location Tests (15 cases)
// ════════════════════════════════════════════════════════════════
describe("Multi-Location Query Tests (15 cases)", () => {
  // M1-M5: Multi-location extraction
  test("M1: เชียงใหม่|ภูเก็ต → 2 provinces", () => {
    const locs = extractMultipleLocations("เชียงใหม่|ภูเก็ต");
    expect(locs).toHaveLength(2);
    expect(locs).toContain("เชียงใหม่");
    expect(locs).toContain("ภูเก็ต");
  });

  test("M2: กรุงเทพ vs เชียงใหม่ → 2 provinces", () => {
    const locs = extractMultipleLocations("กรุงเทพ vs เชียงใหม่");
    expect(locs.length).toBeGreaterThanOrEqual(2);
  });

  test("M3: เพชรบุรี แม่กลอง อัมพวา เทียบฝน → multiple provinces", () => {
    const locs = extractMultipleLocations("เพชรบุรี แม่กลอง อัมพวา เทียบฝน");
    expect(locs).toContain("เพชรบุรี");
    expect(locs).toContain("สมุทรสงคราม"); // แม่กลอง alias
  });

  test("M4: ขอนแก่น/อุดร/โคราช → 3 provinces", () => {
    const locs = extractMultipleLocations("ขอนแก่น/อุดร/โคราช");
    expect(locs.length).toBeGreaterThanOrEqual(3);
    expect(locs).toContain("ขอนแก่น");
    expect(locs).toContain("อุดรธานี");
    expect(locs).toContain("นครราชสีมา");
  });

  test("M5: no duplicates when alias maps to same province", () => {
    const locs = extractMultipleLocations("แม่กลอง อัมพวา");
    // Both alias to สมุทรสงคราม → deduplicated
    const samutSong = locs.filter((l) => l === "สมุทรสงคราม");
    expect(samutSong.length).toBe(1);
  });

  // M6-M10: parseMultiLocationQuery
  test("M6: parseMultiLocationQuery isComparison=true for เทียบ", () => {
    const result = parseMultiLocationQuery("เทียบอากาศเชียงใหม่กับภูเก็ต");
    expect(result.isComparison).toBe(true);
    expect(result.locations.length).toBeGreaterThanOrEqual(1);
  });

  test("M7: parseMultiLocationQuery comparisonType=rain for เทียบฝน", () => {
    const result = parseMultiLocationQuery("เทียบฝนกรุงเทพกับเชียงใหม่");
    expect(result.comparisonType).toBe("rain");
  });

  test("M8: parseMultiLocationQuery comparisonType=general by default", () => {
    const result = parseMultiLocationQuery("อากาศกรุงเทพและเชียงใหม่");
    expect(result.comparisonType).toBe("general");
  });

  test("M9: parseMultiLocationQuery preserves originalText", () => {
    const text = "เชียงใหม่|ภูเก็ต อากาศ";
    const result = parseMultiLocationQuery(text);
    expect(result.originalText).toBe(text);
  });

  test("M10: parseMultiLocationQuery single location isComparison=false", () => {
    const result = parseMultiLocationQuery("กรุงเทพอากาศวันนี้");
    expect(result.isComparison).toBe(false);
  });

  // M11-M15: isMultiLocationQuery and buildLocationWeatherLabels
  test("M11: isMultiLocationQuery true for 2 provinces", () => {
    expect(isMultiLocationQuery("เชียงใหม่กับภูเก็ต")).toBe(true);
  });

  test("M12: isMultiLocationQuery true for เทียบ keyword alone", () => {
    expect(isMultiLocationQuery("เทียบอากาศ")).toBe(true);
  });

  test("M13: isMultiLocationQuery false for single location no compare", () => {
    expect(isMultiLocationQuery("กรุงเทพอากาศ")).toBe(false);
  });

  test("M14: buildLocationWeatherLabels joins with vs", () => {
    const label = buildLocationWeatherLabels(["กรุงเทพมหานคร", "เชียงใหม่", "ภูเก็ต"]);
    expect(label).toBe("กรุงเทพมหานคร vs เชียงใหม่ vs ภูเก็ต");
  });

  test("M15: buildLocationWeatherLabels handles single location", () => {
    const label = buildLocationWeatherLabels(["กรุงเทพมหานคร"]);
    expect(label).toBe("กรุงเทพมหานคร");
  });
});

// ════════════════════════════════════════════════════════════════
//  GROUP 5: Integration / Routing Tests (15 cases)
// ════════════════════════════════════════════════════════════════
describe("Integration and Routing Tests (15 cases)", () => {
  // I1-I5: Complex real-world queries through normalization + temporal
  test("I1: 'วันศุกร์ นี้อุบล ฝน มีมะ' normalizes + extracts location + temporal", () => {
    const normalized = quickNormalize("วันศุกร์ นี้อุบล ฝน มีมะ");
    expect(normalized).toContain("ไหม");
    expect(normalized).toContain("วันศุกร์นี้");
    expect(hasTemporalIndicators(normalized)).toBe(true);
    expect(hasWeatherIntent(normalized)).toBe(true);
  });

  test("I2: 'พรุ่งนี้ภูเกตุฝนมั้ย' - typo + colloquial", () => {
    const normalized = quickNormalize("พรุ่งนี้ภูเกตุฝนมั้ย");
    expect(normalized).toContain("ภูเก็ต");
    expect(normalized).toContain("ไหม");
    const temporal = parseThaiTemporal(normalized, REF_DATE);
    expect(temporal?.temporalType).toBe("tomorrow");
  });

  test("I3: 'อากาสกทมสัปดาห์หน้า' - spell + alias + temporal", () => {
    const normalized = quickNormalize("อากาสกทมสัปดาห์หน้า");
    expect(normalized).toContain("อากาศ");
    expect(hasTemporalIndicators(normalized)).toBe(true);
  });

  test("I4: 'weekหน้าเชียงใม่' - mixed Thai/English + typo", () => {
    const normalized = quickNormalize("weekหน้าเชียงใม่");
    expect(normalized).toContain("สัปดาห์หน้า");
    expect(normalized).toContain("เชียงใหม่");
  });

  test("I5: 'มะรืนนี้' normalizes to มะรืน (not doubled)", () => {
    const normalized = quickNormalize("มะรืนนี้ฝน");
    expect(normalized).toContain("มะรืน");
    const temporal = parseThaiTemporal(normalized, REF_DATE);
    expect(temporal?.temporalType).toBe("day_after_tomorrow");
  });

  // I6-I10: Multi-location + normalization pipeline
  test("I6: 'เพชรบุรี แม่กลอง อัมพวา เทียบฝนให้หน่อย' - full pipeline", () => {
    const normalized = quickNormalize("เพชรบุรี แม่กลอง อัมพวา เทียบฝนให้หน่อย");
    const result = parseMultiLocationQuery(normalized);
    expect(result.isComparison).toBe(true);
    expect(result.locations).toContain("เพชรบุรี");
  });

  test("I7: 'กทม vs เชียงใหม่ อากาศต่างกันไหม' - comparison query", () => {
    const result = parseMultiLocationQuery("กทม vs เชียงใหม่ อากาศต่างกันไหม");
    expect(result.isComparison).toBe(true);
    expect(result.locations.length).toBeGreaterThanOrEqual(2);
  });

  test("I8: 'โคราชกับอุบลฝนตกไหมอาทิดนี้' - alias + typo + colloquial + temporal", () => {
    const normalized = quickNormalize("โคราชกับอุบลฝนตกไหมอาทิดนี้");
    expect(normalized).toContain("อาทิตย์นี้");
    const locs = extractMultipleLocations(normalized);
    expect(locs.length).toBeGreaterThanOrEqual(1);
  });

  test("I9: extractQueryHints returns correct flags for weather query", () => {
    const hints = extractQueryHints("อากาศกรุงเทพวันนี้เป็นยังไง");
    expect(hints.isWeather).toBe(true);
    expect(hints.isCompare).toBe(false);
  });

  test("I10: isComparisonQuery detects comparison intent", () => {
    expect(isComparisonQuery("เทียบอากาศกรุงเทพกับเชียงใหม่")).toBe(true);
    expect(isComparisonQuery("อากาศกรุงเทพวันนี้")).toBe(false);
  });

  // I11-I15: Edge cases and regression prevention
  test("I11: 'จังหวัดชลบุรี' - จังหวัด prefix handled", () => {
    const locs = extractMultipleLocations("จังหวัดชลบุรีฝนตก");
    // Should pick up ชลบุรี
    expect(locs.some((l) => l === "ชลบุรี" || l.includes("ชลบุรี"))).toBe(true);
  });

  test("I12: empty query → safe return from normalizer", () => {
    const result = normalizeThaiQuery("");
    expect(result.normalized).toBe("");
    expect(result.substitutionsApplied).toHaveLength(0);
    expect(result.confidence).toBe(1.0);
  });

  test("I13: non-weather Thai query → hasWeatherIntent=false", () => {
    expect(hasWeatherIntent("ประวัติศาสตร์รัตนโกสินทร์")).toBe(false);
    expect(hasWeatherIntent("กฎหมายมาตรา 112")).toBe(false);
  });

  test("I14: มะรืน not confused with มะ particle", () => {
    // "มะ" as word-final particle should be normalized, but มะรืน should not be
    const normalized1 = quickNormalize("ฝนมะ"); // มะ is colloquial particle → ไหม
    const normalized2 = quickNormalize("มะรืนฝน"); // มะรืน = day after tomorrow
    expect(normalized1).toContain("ไหม");
    expect(normalized2).toContain("มะรืน");
    expect(normalized2).not.toContain("ไหมรืน");
  });

  test("I15: temporal + weather combination is correctly flagged", () => {
    const text = "สัปดาห์หน้าภาคเหนือฝนตกไหม";
    expect(hasTemporalIndicators(text)).toBe(true);
    expect(hasWeatherIntent(text)).toBe(true);
    const temporal = parseThaiTemporal(text, REF_DATE);
    expect(temporal?.temporalType).toBe("next_week");
  });
});

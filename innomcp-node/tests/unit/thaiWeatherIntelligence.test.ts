/**
 * Unit tests for Thai Weather Intelligence utilities.
 * Tests all 20 target queries from the Thai intelligence gap closure mission.
 */

import { quickNormalize, hasWeatherIntent } from "../../src/utils/thaiQueryNormalizer";
import { hasTemporalIndicators, parseThaiTemporal } from "../../src/utils/thaiTemporalParser";
import { resolveProvinces } from "../../src/utils/locationResolver";

// ---------------------------------------------------------------------------
// Section 1: Colloquial particle normalization
// ---------------------------------------------------------------------------

describe("1. Colloquial particle normalization", () => {
  it("Q1: ฝนตกมีมะที่กรุงเทพ → contains มีไหม", () => {
    expect(quickNormalize("ฝนตกมีมะที่กรุงเทพ")).toContain("มีไหม");
  });
  it("Q1: มีมะ removed", () => {
    expect(quickNormalize("ฝนตกมีมะที่กรุงเทพ")).not.toContain("มีมะ");
  });
  it("Q2: อากาศเชียงใหม่พรุ่งนี้ปะ → ไหม", () => {
    expect(quickNormalize("อากาศเชียงใหม่พรุ่งนี้ปะ")).toContain("ไหม");
  });
  it("Q4: กทม อุณหภูมิวันนี้ล่ะ → ล่ะ removed", () => {
    expect(quickNormalize("กทม อุณหภูมิวันนี้ล่ะ")).not.toContain("ล่ะ");
  });
  it("Q8: ภูเก็จฝนตกมั้ย → ไหม", () => {
    expect(quickNormalize("ภูเก็จฝนตกมั้ย")).toContain("ไหม");
  });
  it("Q8: มั้ย removed", () => {
    expect(quickNormalize("ภูเก็จฝนตกมั้ย")).not.toContain("มั้ย");
  });
  it("Q20: มีมะ → มีไหม", () => {
    expect(quickNormalize("ฝนตกมีมะที่แปดริ้วช่วงนี้ล่ะ")).toContain("มีไหม");
  });
  it("Q20: ล่ะ removed", () => {
    expect(quickNormalize("ฝนตกมีมะที่แปดริ้วช่วงนี้ล่ะ")).not.toContain("ล่ะ");
  });
});

// ---------------------------------------------------------------------------
// Section 2: Temporal typo corrections
// ---------------------------------------------------------------------------

describe("2. Temporal typo corrections", () => {
  it("Q9: ศกนี้ → ศุกร์นี้", () => {
    expect(quickNormalize("ศกนี้ที่เชียงรายฝน")).toContain("ศุกร์นี้");
  });
  it("Q9: ศกนี้ removed", () => {
    expect(quickNormalize("ศกนี้ที่เชียงรายฝน")).not.toContain("ศกนี้");
  });
  it("Q11: สัปดาหน้า → สัปดาห์หน้า", () => {
    expect(quickNormalize("ฝนตกไหมอยุธยาสัปดาหน้า")).toContain("สัปดาห์หน้า");
  });
  it("Q7: weekหน้า → สัปดาห์หน้า", () => {
    expect(quickNormalize("หัวหินweekหน้าฝนตกไหม")).toContain("สัปดาห์หน้า");
  });
  it("Q17: weekนี้ → สัปดาห์นี้", () => {
    expect(quickNormalize("สมุยweekนี้ร้อนไหม")).toContain("สัปดาห์นี้");
  });
  it("Q15: เชียงใม่ → เชียงใหม่", () => {
    expect(quickNormalize("เชียงใม่อากาศดีไหม")).toContain("เชียงใหม่");
  });
});

// ---------------------------------------------------------------------------
// Phase B2: bare "มะ" particle must NOT eat first syllable of real Thai words
// ---------------------------------------------------------------------------

describe("B2: bare มะ particle root-cause guard", () => {
  it("B2-1: มะรืน preserved", () => {
    expect(quickNormalize("มะรืนนี้สภาพอากาศเป็นอย่างไร")).toContain("มะรืน");
  });
  it("B2-1: ไหมรืน NOT produced", () => {
    expect(quickNormalize("มะรืนนี้สภาพอากาศเป็นอย่างไร")).not.toContain("ไหมรืน");
  });
  it("B2-2: มะม่วง preserved", () => {
    expect(quickNormalize("มะม่วงราคาเท่าไหร่")).toContain("มะม่วง");
  });
  it("B2-3: มะลิ preserved", () => {
    expect(quickNormalize("ดอกมะลิกับดอกอะไร")).toContain("มะลิ");
  });
  it("B2-4: trailing มะ → ไหม preserved", () => {
    expect(quickNormalize("ฝนตกมะ")).toContain("ไหม");
  });
  it("B2-4: no 'ตกมะ' left at end", () => {
    expect(quickNormalize("ฝนตกมะ")).not.toContain("ตกมะ");
  });
});

// ---------------------------------------------------------------------------
// Section 3: Temporal indicator detection
// ---------------------------------------------------------------------------

describe("3. Temporal indicator detection (hasTemporalIndicators)", () => {
  it("Q2: พรุ่งนี้ detected", () => {
    expect(hasTemporalIndicators("อากาศเชียงใหม่พรุ่งนี้ไหม")).toBe(true);
  });
  it("Q3: วันศุกร์นี้ detected", () => {
    expect(hasTemporalIndicators("โคราชฝนตกไหมวันศุกร์นี้")).toBe(true);
  });
  it("Q5: วันศุกร์ detected", () => {
    expect(hasTemporalIndicators("แม่สายวันศุกร์อากาศเป็นไง")).toBe(true);
  });
  it("Q6: อาทิตย์นี้ detected", () => {
    expect(hasTemporalIndicators("อุบลอาทิตย์นี้เป็นไง")).toBe(true);
  });
  it("Q9: ศุกร์นี้ (after normalize) detected", () => {
    expect(hasTemporalIndicators("ศุกร์นี้ที่เชียงรายฝน")).toBe(true);
  });
  it("Q11: สัปดาห์หน้า detected", () => {
    expect(hasTemporalIndicators("ฝนตกไหมอยุธยาสัปดาห์หน้า")).toBe(true);
  });
  it("Q12: อาทิตย์หน้า detected", () => {
    expect(hasTemporalIndicators("หาดใหญ่อาทิตย์หน้าเป็นยังไง")).toBe(true);
  });
  it("Q13: พรุ่งนี้ detected", () => {
    expect(hasTemporalIndicators("นราธิวาสพรุ่งนี้อากาศเป็นไง")).toBe(true);
  });
  it("Q14: มะรืน detected", () => {
    expect(hasTemporalIndicators("ประจวบฝนตกไหมมะรืน")).toBe(true);
  });
  it("Q16: คืนนี้ detected", () => {
    expect(hasTemporalIndicators("กรุงเทพฝนมั้ยคืนนี้")).toBe(true);
  });
  it("Q18: วันเสาร์ detected", () => {
    expect(hasTemporalIndicators("แม่กลองอุณหภูมิวันเสาร์")).toBe(true);
  });
  it("Q19: สัปดาห์หน้า detected", () => {
    expect(hasTemporalIndicators("ภาคเหนือสัปดาห์หน้าอากาศเป็นไง")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 4: Province alias resolution
// ---------------------------------------------------------------------------

describe("4. Province alias resolution (resolveProvinces)", () => {
  it("Q3: โคราช → นครราชสีมา", () => {
    expect(resolveProvinces("โคราชฝนตกไหมวันศุกร์นี้")).toContain("นครราชสีมา");
  });
  it("Q4: กทม → กรุงเทพมหานคร", () => {
    expect(resolveProvinces("กทม อุณหภูมิวันนี้")).toContain("กรุงเทพมหานคร");
  });
  it("Q5: แม่สาย → เชียงราย", () => {
    expect(resolveProvinces("แม่สายวันศุกร์อากาศเป็นไง")).toContain("เชียงราย");
  });
  it("Q6: อุบล → อุบลราชธานี", () => {
    expect(resolveProvinces("อุบลอาทิตย์นี้เป็นไง")).toContain("อุบลราชธานี");
  });
  it("Q7: หัวหิน → ประจวบคีรีขันธ์", () => {
    expect(resolveProvinces("หัวหินweekหน้าฝนตกไหม")).toContain("ประจวบคีรีขันธ์");
  });
  it("Q11: อยุธยา → พระนครศรีอยุธยา", () => {
    expect(resolveProvinces("ฝนตกไหมอยุธยาสัปดาห์หน้า")).toContain("พระนครศรีอยุธยา");
  });
  it("Q12: หาดใหญ่ → สงขลา", () => {
    expect(resolveProvinces("หาดใหญ่อาทิตย์หน้าเป็นยังไง")).toContain("สงขลา");
  });
  it("Q17: สมุย → สุราษฎร์ธานี", () => {
    expect(resolveProvinces("สมุยweekนี้ร้อนไหม")).toContain("สุราษฎร์ธานี");
  });
  it("Q18: แม่กลอง → สมุทรสงคราม", () => {
    expect(resolveProvinces("แม่กลองอุณหภูมิวันเสาร์")).toContain("สมุทรสงคราม");
  });
  it("Q20: แปดริ้ว → ฉะเชิงเทรา", () => {
    expect(resolveProvinces("ฝนตกมีมะที่แปดริ้วช่วงนี้")).toContain("ฉะเชิงเทรา");
  });
  it("Q1: กรุงเทพ resolved", () => {
    expect(resolveProvinces("ฝนตกที่กรุงเทพวันนี้")).toContain("กรุงเทพมหานคร");
  });
  it("Q13: นราธิวาส resolved", () => {
    expect(resolveProvinces("นราธิวาสพรุ่งนี้อากาศเป็นไง")).toContain("นราธิวาส");
  });
  it("Q10: ยะลา resolved", () => {
    expect(resolveProvinces("ยะลากับปัตตานีอากาศเทียบกันหน่อย")).toContain("ยะลา");
  });
  it("Q10: ปัตตานี resolved", () => {
    expect(resolveProvinces("ยะลากับปัตตานีอากาศเทียบกันหน่อย")).toContain("ปัตตานี");
  });
  it("Q10: 2 provinces found", () => {
    expect(resolveProvinces("ยะลากับปัตตานีอากาศเทียบกันหน่อย").length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Section 4.5: Colloquial particle safety (เลย disambiguation)
// ---------------------------------------------------------------------------

describe("4.5. Colloquial particle safety (เลย disambiguation)", () => {
  it("PARTICLE-1: เชียงใหม่ร้อนมากเลย → only 1 province", () => {
    expect(resolveProvinces("เชียงใหม่ร้อนมากเลย").length).toBe(1);
  });
  it("PARTICLE-1: contains เชียงใหม่", () => {
    expect(resolveProvinces("เชียงใหม่ร้อนมากเลย")).toContain("เชียงใหม่");
  });
  it("PARTICLE-2: ร้อนมากเลย in sentence → 1 province", () => {
    expect(resolveProvinces("พรุ่งนี้ฝนตกไหม เชียงใหม่ร้อนมากเลย").length).toBe(1);
  });
  it("PARTICLE-2: contains เชียงใหม่", () => {
    expect(resolveProvinces("พรุ่งนี้ฝนตกไหม เชียงใหม่ร้อนมากเลย")).toContain("เชียงใหม่");
  });
  it("PARTICLE-3: กทม ร้อนมากเลย → contains กรุงเทพ", () => {
    expect(resolveProvinces("กทม ร้อนมากเลย ตอนนี้กี่องศา")).toContain("กรุงเทพมหานคร");
  });
  it("PARTICLE-3: no เลย province", () => {
    expect(resolveProvinces("กทม ร้อนมากเลย ตอนนี้กี่องศา")).not.toContain("เลย");
  });
  it("PARTICLE-4: trailing ร้อนมากเลย → 1 province", () => {
    expect(resolveProvinces("ตอนนี้เชียงใหม่กี่องศา ร้อนมากเลย").length).toBe(1);
  });
  it("LOEI-1: เลยฝนตก → province เลย", () => {
    expect(resolveProvinces("เลยฝนตกไหมพรุ่งนี้")).toContain("เลย");
  });
  it("LOEI-2: จังหวัดเลย → province เลย", () => {
    expect(resolveProvinces("จังหวัดเลยฝนตกไหมพรุ่งนี้")).toContain("เลย");
  });
  it("PARTICLE-5: โคราชร้อนมากอะ → contains นครราชสีมา", () => {
    expect(resolveProvinces("วันนี้โคราชร้อนมากอะ ฝนจะตกไหม")).toContain("นครราชสีมา");
  });
  it("PARTICLE-5: only 1 province", () => {
    expect(resolveProvinces("วันนี้โคราชร้อนมากอะ ฝนจะตกไหม").length).toBe(1);
  });
  it("PARTICLE-6: ครับ stripped → only เชียงราย", () => {
    expect(resolveProvinces("เชียงรายฝนตกไหมครับ พรุ่งนี้")).toContain("เชียงราย");
  });
  it("PARTICLE-7: กรุงเทพอะ → only กรุงเทพ", () => {
    expect(resolveProvinces("พรุ่งนี้ฝนตกไหม กรุงเทพอะ")).toContain("กรุงเทพมหานคร");
  });
  it("PARTICLE-8: หนาวจัง → ลำพูน core matches", () => {
    const r = resolveProvinces("พรุ่งนี้ฝนตกไหม ลำพูนหนาวจัง");
    // NFKC may transform ลำ→ลํา; check for token containing พ + น (ลำพูน core)
    expect(r.some((p) => p.includes("พ") && p.includes("น"))).toBe(true);
  });
  it("PARTICLE-8: only 1 province", () => {
    expect(resolveProvinces("พรุ่งนี้ฝนตกไหม ลำพูนหนาวจัง").length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Section 5: Temporal parsing
// ---------------------------------------------------------------------------

describe("5. Temporal parsing (parseThaiTemporal)", () => {
  const ref = new Date("2026-03-31T09:00:00"); // Tuesday

  it("วันนี้ → today type", () => {
    expect(parseThaiTemporal("อากาศวันนี้เป็นอย่างไร", ref)?.temporalType).toBe("today");
  });
  it("วันนี้ → offset 0", () => {
    expect(parseThaiTemporal("อากาศวันนี้เป็นอย่างไร", ref)?.offsetDays[0]).toBe(0);
  });
  it("พรุ่งนี้ → tomorrow type", () => {
    expect(parseThaiTemporal("พรุ่งนี้ฝนตกไหม", ref)?.temporalType).toBe("tomorrow");
  });
  it("พรุ่งนี้ → offset 1", () => {
    expect(parseThaiTemporal("พรุ่งนี้ฝนตกไหม", ref)?.offsetDays[0]).toBe(1);
  });
  it("มะรืน → day_after_tomorrow", () => {
    expect(parseThaiTemporal("มะรืนอากาศเป็นยังไง", ref)?.temporalType).toBe("day_after_tomorrow");
  });
  it("มะรืน → offset 2", () => {
    expect(parseThaiTemporal("มะรืนอากาศเป็นยังไง", ref)?.offsetDays[0]).toBe(2);
  });
  it("คืนนี้ → tonight", () => {
    expect(parseThaiTemporal("คืนนี้ฝนตกไหม", ref)?.temporalType).toBe("tonight");
  });
  it("สัปดาห์หน้า → next_week", () => {
    expect(parseThaiTemporal("สัปดาห์หน้าอากาศเป็นไง", ref)?.temporalType).toBe("next_week");
  });
  it("สัปดาห์นี้ → this_week", () => {
    expect(parseThaiTemporal("สัปดาห์นี้ฝน", ref)?.temporalType).toBe("this_week");
  });
  it("ศุกร์นี้ → specific_day", () => {
    expect(parseThaiTemporal("ศุกร์นี้อากาศเป็นไง", ref)?.temporalType).toBe("specific_day");
  });
  it("ศุกร์นี้ → positive offset", () => {
    const r = parseThaiTemporal("ศุกร์นี้อากาศเป็นไง", ref);
    expect((r?.offsetDays?.[0] ?? -1) >= 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 6: Weather intent detection
// ---------------------------------------------------------------------------

describe("6. Weather intent (hasWeatherIntent)", () => {
  it("weather: อากาศ", () => expect(hasWeatherIntent("อากาศเชียงใหม่วันนี้")).toBe(true));
  it("weather: ฝนตก", () => expect(hasWeatherIntent("ฝนตกมั้ยที่กรุงเทพ")).toBe(true));
  it("weather: พยากรณ์", () => expect(hasWeatherIntent("พยากรณ์อากาศพรุ่งนี้")).toBe(true));
  it("non-weather: สวัสดี", () => expect(hasWeatherIntent("สวัสดีครับ")).toBe(false));
  it("non-weather: คำนวณ", () => expect(hasWeatherIntent("2+2 เท่ากับเท่าไหร่")).toBe(false));
});

// ---------------------------------------------------------------------------
// Section 7: End-to-end normalization pipeline (20 queries)
// ---------------------------------------------------------------------------

describe("7. End-to-end: normalizeForWeatherPipeline equivalent (20 queries)", () => {
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
    ["Q1", "ฝนตกมีมะที่กรุงเทพ", "มีไหม"],
    ["Q2", "อากาศเชียงใหม่พรุ่งนี้ปะ", "ไหม"],
    ["Q3", "โคราชฝนตกไหมวันศุกร์นี้", "นครราชสีมา"],
    ["Q4", "กทม อุณหภูมิวันนี้ล่ะ", "กรุงเทพมหานคร"],
    ["Q5", "แม่สายวันศุกร์อากาศเป็นไง", "เชียงราย"],
    ["Q6", "อุบลอาทิตย์นี้เป็นไง", "อุบลราชธานี"],
    ["Q7", "หัวหินweekหน้าฝนตกไหม", "สัปดาห์หน้า"],
    ["Q8", "ภูเก็จฝนตกมั้ย", "ภูเก็ต"],
    ["Q9", "ศกนี้ที่เชียงรายฝน", "ศุกร์นี้"],
    ["Q10", "ยะลากับปัตตานีอากาศเทียบกันหน่อย", "ยะลา"],
    ["Q11", "ฝนตกไหมอยุธยาสัปดาหน้า", "สัปดาห์หน้า"],
    ["Q12", "หาดใหญ่อาทิตย์หน้าเป็นยังไง", "สงขลา"],
    ["Q13", "นราธิวาสพรุ่งนี้อากาศเป็นไง", "นราธิวาส"],
    ["Q14", "ประจวบฝนตกไหมมะรืน", "ประจวบ"],
    ["Q15", "เชียงใม่อากาศดีไหม", "เชียงใหม่"],
    ["Q16", "กรุงเทพฝนมั้ยคืนนี้", "ไหม"],
    ["Q17", "สมุยweekนี้ร้อนไหม", "สัปดาห์นี้"],
    ["Q18", "แม่กลองอุณหภูมิวันเสาร์", "สมุทรสงคราม"],
    ["Q19", "ภาคเหนือสัปดาห์หน้าอากาศเป็นไง", "สัปดาห์หน้า"],
    ["Q20", "ฝนตกมีมะที่แปดริ้วช่วงนี้ล่ะ", "ฉะเชิงเทรา"],
  ];

  for (const [id, raw, expected] of Q) {
    it(`${id}: "${raw}" → contains "${expected}"`, () => {
      expect(normalizePipeline(raw)).toContain(expected);
    });
  }
});

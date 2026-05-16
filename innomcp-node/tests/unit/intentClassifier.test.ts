/**
 * intentClassifier.test.ts — Phase C intent classification rules
 */

import { classifyIntent } from "../../src/services/intentClassifier";

describe("classifyIntent", () => {
  test("rainy-season seminar planning is planning-broad", () => {
    const r = classifyIntent(
      "ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง"
    );
    expect(r.intent).toBe("planning-broad");
    expect(r.expectedToolUsage).toBe(true);
  });

  test("plain weather question is weather", () => {
    const r = classifyIntent("กรุงเทพอากาศวันนี้เป็นอย่างไร");
    expect(r.intent).toBe("weather");
    expect(r.expectedToolUsage).toBe(true);
  });

  test("plan + travel without weather still hits planning-broad", () => {
    const r = classifyIntent("ช่วยวางแผนการเดินทางไปเชียงใหม่หน่อย");
    expect(r.intent).toBe("planning-broad");
  });

  test("calculator question is calc", () => {
    const r = classifyIntent("คำนวณ 123 * 456 บวก 789 ให้หน่อย");
    expect(r.intent).toBe("calc");
  });

  test("calc keyword without digits falls through to general", () => {
    const r = classifyIntent("ช่วยคำนวณเรื่องนี้ให้หน่อย");
    expect(r.intent).toBe("general");
  });

  test("map keyword routes to map", () => {
    const r = classifyIntent("ขอแผนที่จังหวัดเชียงราย");
    expect(r.intent).toBe("map");
    expect(r.expectedToolUsage).toBe(true);
  });

  test("code keyword routes to code", () => {
    const r = classifyIntent("ช่วยเขียน function typescript ตรวจสอบ regex หน่อย");
    expect(r.intent).toBe("code");
  });

  test("empty input returns general", () => {
    const r = classifyIntent("");
    expect(r.intent).toBe("general");
    expect(r.reasons).toContain("empty");
  });

  test("general greeting falls through to general", () => {
    const r = classifyIntent("สวัสดีครับ คุณคือใคร?");
    expect(r.intent).toBe("general");
  });
  test("datetime tool hint routes to datetime", () => {
    const r = classifyIntent("anything", "datetime");
    expect(r.intent).toBe("datetime");
    expect(r.expectedToolUsage).toBe(true);
  });

  test("data hint routes evidence-like questions to evidence", () => {
    const r = classifyIntent("NIP top ISP yesterday", "data");
    expect(r.intent).toBe("evidence");
    expect(r.expectedToolUsage).toBe(true);
  });

  test("data hint routes non-evidence questions to knowledge", () => {
    const r = classifyIntent("อธิบาย PDPA แบบสั้น", "data");
    expect(r.intent).toBe("knowledge");
    expect(r.expectedToolUsage).toBe(true);
  });

  test("machine learning question does not route to officer evidence", () => {
    const r = classifyIntent("machine learning คืออะไร");
    expect(r.intent).toBe("knowledge");
    expect(r.expectedToolUsage).toBe(true);
  });
});

/**
 * responseComposer.test.ts — Phase 6C foundation
 * Covers:
 *  - Empty facts → passthrough Thai "no data" line
 *  - Single-fact deterministic compose
 *  - Multi-fact compose with header/footer
 *  - Confidence filtering
 *  - LLM fallback stub (currently equivalent to deterministic)
 */

import {
  composeThaiAnswer,
  composeThaiAnswerWithLLM,
  ToolFact,
} from "../../src/services/responseComposer";

describe("responseComposer — composeThaiAnswer", () => {
  test("empty facts returns passthrough with Thai 'no data' message", () => {
    const r = composeThaiAnswer({
      route: "weather",
      userQuery: "อากาศวันนี้",
      facts: [],
    });
    expect(r.mode).toBe("passthrough");
    expect(r.factCount).toBe(0);
    expect(r.text).toMatch(/ไม่พบข้อมูล/);
    expect(r.reasons).toContain("no-facts");
  });

  test("single fact compose produces a coherent Thai answer", () => {
    const r = composeThaiAnswer({
      route: "weather",
      userQuery: "อากาศกรุงเทพ",
      facts: [
        { source: "TMD", summary: "อุณหภูมิ 32°C ความชื้น 70%" },
      ],
    });
    expect(r.mode).toBe("deterministic");
    expect(r.factCount).toBe(1);
    expect(r.text).toContain("TMD");
    expect(r.text).toContain("อุณหภูมิ 32°C");
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("multi-fact compose with header and footer", () => {
    const facts: ToolFact[] = [
      { source: "TMD", summary: "อุณหภูมิ 32°C", confidence: 0.9 },
      { source: "OpenWeather", summary: "ความชื้น 70%", confidence: 0.8 },
      { source: "NWP", summary: "มีโอกาสฝนช่วงบ่าย", confidence: 0.7 },
    ];
    const r = composeThaiAnswer({
      route: "weather",
      userQuery: "อากาศกรุงเทพ",
      header: "สภาพอากาศกรุงเทพ:",
      footer: "ที่มา: tmd.go.th",
      facts,
    });
    expect(r.mode).toBe("deterministic");
    expect(r.factCount).toBe(3);
    expect(r.text.startsWith("สภาพอากาศกรุงเทพ:")).toBe(true);
    expect(r.text).toMatch(/ที่มา: tmd\.go\.th$/);
    // Each fact should appear on its own bullet line
    const bulletLines = r.text.split("\n").filter((l) => l.trim().startsWith("•"));
    expect(bulletLines.length).toBe(3);
  });

  test("filters low-confidence facts when high-confidence ones exist", () => {
    const r = composeThaiAnswer({
      route: "evidence",
      userQuery: "หลักฐานคดีล่าสุด",
      facts: [
        { source: "DB", summary: "พบ 3 รายการ", confidence: 0.85 },
        { source: "Cache", summary: "อาจไม่ตรงกัน", confidence: 0.1 },
      ],
    });
    expect(r.factCount).toBe(1);
    expect(r.text).toContain("DB");
    expect(r.text).not.toContain("อาจไม่ตรงกัน");
    expect(r.reasons.some((s) => s.startsWith("dropped-low-conf"))).toBe(true);
  });

  test("keeps all facts when every fact is below threshold", () => {
    const r = composeThaiAnswer({
      route: "evidence",
      userQuery: "x",
      facts: [
        { source: "A", summary: "fact a", confidence: 0.1 },
        { source: "B", summary: "fact b", confidence: 0.2 },
      ],
    });
    expect(r.factCount).toBe(2);
    expect(r.text).toContain("fact a");
    expect(r.text).toContain("fact b");
  });

  test("trims whitespace and ignores empty-summary facts", () => {
    const r = composeThaiAnswer({
      route: "test",
      userQuery: "x",
      facts: [
        { source: "A", summary: "   " },
        { source: "B", summary: "   ข้อมูล B   " },
      ],
    });
    expect(r.factCount).toBe(1);
    expect(r.text).toContain("ข้อมูล B");
    expect(r.text).not.toMatch(/^\s*•\s*$/m);
  });

  test("composeThaiAnswerWithLLM falls back to deterministic for now", async () => {
    const r = await composeThaiAnswerWithLLM({
      route: "weather",
      userQuery: "อากาศ",
      facts: [{ source: "TMD", summary: "32°C" }],
    });
    expect(["deterministic", "llm-fallback", "passthrough"]).toContain(r.mode);
    expect(r.text).toContain("32°C");
  });
});

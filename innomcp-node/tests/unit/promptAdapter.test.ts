/**
 * promptAdapter.test.ts — Phase 6A/6B
 * Covers:
 *  - Thai image prompt adaptation (basic + scene-rich)
 *  - English passthrough
 *  - Image-command prefix stripping
 *  - Planner normalization (typos, particles)
 *  - Latency / mode reporting
 */

import {
  adaptImagePrompt,
  normalizePlannerQuery,
  __testing,
} from "../../src/services/promptAdapter";

describe("promptAdapter — adaptImagePrompt", () => {
  test("Thai red cat cartoon → English visual prompt with red, cat, cartoon", () => {
    const r = adaptImagePrompt("สร้างรูปแมวสีแดงสไตล์การ์ตูน");
    expect(r.mode).toBe("deterministic");
    expect(r.adaptedPromptEn.toLowerCase()).toMatch(/cat/);
    expect(r.adaptedPromptEn.toLowerCase()).toMatch(/red/);
    expect(r.adaptedPromptEn.toLowerCase()).toMatch(/cartoon/);
    // Image-command prefix should be removed from the Thai-side normalization too
    expect(r.normalizedPromptTh).not.toMatch(/^สร้างรูป|^วาดภาพ/);
    expect(r.confidence).toBeGreaterThan(0.4);
  });

  test("Mixed Thai prompt with scene + lighting preserves semantic richness", () => {
    const r = adaptImagePrompt(
      "วาดภาพนักบินอวกาศยืนกลางทุ่งนาไทยตอนพระอาทิตย์ตก"
    );
    expect(r.mode).toBe("deterministic");
    const en = r.adaptedPromptEn.toLowerCase();
    expect(en).toMatch(/astronaut/);
    expect(en).toMatch(/(thai rice field|rice field)/);
    expect(en).toMatch(/(sunset|at sunset)/);
    // Should not collapse into a generic prompt
    expect(r.adaptedPromptEn.length).toBeGreaterThan(15);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  test("English prompt is passthrough", () => {
    const r = adaptImagePrompt("a red cat in cartoon style");
    expect(r.mode).toBe("passthrough");
    expect(r.adaptedPromptEn).toBe("a red cat in cartoon style");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test("empty input returns passthrough with empty output", () => {
    const r = adaptImagePrompt("");
    expect(r.mode).toBe("passthrough");
    expect(r.adaptedPromptEn).toBe("");
    expect(r.reasons).toContain("empty-input");
  });

  test("strips image-command prefix in normalized Thai", () => {
    const stripped = __testing.stripImageCommand("สร้างรูปแมวสีดำ");
    expect(stripped).toBe("แมวสีดำ");
  });

  test("strips reverse-form image-command prefix", () => {
    const stripped = __testing.stripImageCommand("รูปสร้างหุ่นยนต์");
    expect(stripped).toBe("หุ่นยนต์");
  });

  test("subject-only Thai prompt still produces an English adaptation", () => {
    const r = adaptImagePrompt("วาดมังกรสีทอง");
    expect(r.mode).toBe("deterministic");
    const en = r.adaptedPromptEn.toLowerCase();
    expect(en).toMatch(/dragon/);
    expect(en).toMatch(/gold/);
  });

  test("low-coverage Thai prompt does not crash and returns a string", () => {
    // Words not in glossary — should produce a result without throwing.
    // No explicit command verb ("สร้าง"/"วาด"), so the prefix-stripper leaves
    // the noun phrase intact — that's the correct deterministic behavior.
    const r = adaptImagePrompt("ภาพอะไรก็ได้ที่แปลกใหม่ที่สุดในโลกใบนี้");
    expect(["deterministic", "passthrough", "llm-fallback"]).toContain(r.mode);
    expect(typeof r.adaptedPromptEn).toBe("string");
    expect(r.adaptedPromptEn.length).toBeGreaterThan(0);
  });

  test("strips command verb + ภาพ prefix even when subject is Thai-only", () => {
    const r = adaptImagePrompt("วาดภาพดอกไม้");
    expect(r.normalizedPromptTh.startsWith("วาดภาพ")).toBe(false);
    expect(r.adaptedPromptEn.toLowerCase()).toMatch(/flower/);
  });

  test("latencyMs is reported and reasonable", () => {
    const r = adaptImagePrompt("สร้างรูปแมวสีแดง");
    expect(typeof r.latencyMs).toBe("number");
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.latencyMs).toBeLessThan(500);
  });

  test("does not retain raw Thai chars when English mapping succeeded", () => {
    const r = adaptImagePrompt("สร้างรูปแมวน่ารักสีฟ้า");
    expect(r.adaptedPromptEn).toMatch(/cat/i);
    expect(r.adaptedPromptEn).not.toMatch(/[฀-๿]/);
  });
});

describe("promptAdapter — normalizePlannerQuery", () => {
  test("noisy colloquial Thai is normalized without losing intent", () => {
    const r = normalizePlannerQuery("อากาสกรุเทพวันนี้มั้ย");
    expect(r.normalizedQuery).toMatch(/อากาศ/);
    expect(r.normalizedQuery).toMatch(/กรุงเทพ/);
    expect(r.normalizedQuery).toMatch(/ไหม/);
    expect(r.mode).toBe("deterministic");
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  test("clean Thai query is passthrough", () => {
    const r = normalizePlannerQuery("อากาศกรุงเทพมหานครวันนี้");
    expect(r.normalizedQuery).toContain("อากาศ");
    // No substitutions applied → passthrough
    expect(r.mode).toBe("passthrough");
  });

  test("empty input returns passthrough with confidence 0", () => {
    const r = normalizePlannerQuery("");
    expect(r.mode).toBe("passthrough");
    expect(r.normalizedQuery).toBe("");
    expect(r.confidence).toBe(0);
  });

  test("English temporal abbreviations are translated to Thai", () => {
    const r = normalizePlannerQuery("อากาศกรุงเทพ tmrw");
    expect(r.normalizedQuery).toMatch(/พรุ่งนี้/);
  });

  test("preserves the original query verbatim in originalQuery", () => {
    const original = "อากาสมั้ย";
    const r = normalizePlannerQuery(original);
    expect(r.originalQuery).toBe(original);
    expect(r.normalizedQuery).not.toBe(original);
  });
});

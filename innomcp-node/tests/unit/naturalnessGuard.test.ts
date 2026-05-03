/**
 * naturalnessGuard.test.ts — Phase C anti-robotic guard rules
 */

import { checkNaturalness } from "../../src/services/naturalnessGuard";

describe("checkNaturalness", () => {
  const seminarQuery =
    "ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง";

  test("blocks 'กรุณาระบุจังหวัด' as the whole answer to a planning-broad query", () => {
    const r = checkNaturalness("กรุณาระบุจังหวัดที่ต้องการครับ", {
      intent: "planning-broad",
      expectedToolUsage: true,
      userQuery: seminarQuery,
    });
    expect(r.ok).toBe(false);
    expect(r.ruleFired).toBe("planning-broad-province-only");
  });

  test("allows 'กรุณาระบุจังหวัด' for a non-planning weather question", () => {
    const r = checkNaturalness("กรุณาระบุจังหวัดที่ต้องการครับ", {
      intent: "weather",
      expectedToolUsage: true,
      userQuery: "กรุงเทพอากาศวันนี้เป็นอย่างไร",
    });
    // weather without method/follow-up isn't blocked by the planning-broad rule
    expect(r.ok).toBe(true);
  });

  test("blocks English-first answer to a Thai query", () => {
    const r = checkNaturalness(
      "Thank you for your question, here is the answer in English",
      {
        intent: "general",
        expectedToolUsage: false,
        userQuery: "ช่วยอธิบายเรื่องนี้หน่อย",
      }
    );
    expect(r.ok).toBe(false);
    expect(r.ruleFired).toBe("english-first-leak");
  });

  test("blocks raw JSON top-level leak", () => {
    const r = checkNaturalness('{"answer":"hi"}', {
      intent: "general",
      expectedToolUsage: false,
      userQuery: "เช็ค",
    });
    expect(r.ok).toBe(false);
    expect(r.ruleFired).toBe("raw-json-leak");
  });

  test("blocks Weather Map Placeholder leak in non-map intent", () => {
    const r = checkNaturalness(
      "ขออนุญาตเสนอแนวทางก่อน Weather Map Placeholder จะแสดงด้านล่าง",
      {
        intent: "weather",
        expectedToolUsage: true,
        userQuery: "อากาศวันนี้",
      }
    );
    expect(r.ok).toBe(false);
    expect(r.ruleFired).toMatch(/forbidden-substring/);
  });

  test("blocks shallow planning answer with no method or follow-up", () => {
    const r = checkNaturalness(
      "ดีครับ ผมเข้าใจแล้ว",
      {
        intent: "planning-broad",
        expectedToolUsage: true,
        userQuery: seminarQuery,
      }
    );
    expect(r.ok).toBe(false);
    expect(r.ruleFired).toBe("planning-broad-too-shallow");
  });

  test("allows a structured planning answer with criteria + follow-up", () => {
    const ok = `ขออนุญาตเสนอแนวทางก่อนครับ จะใช้เกณฑ์ความเสี่ยงฝน + การเดินทาง + ความพร้อมสถานที่ — รบกวนระบุเดือนเป้าหมายและจำนวนผู้เข้าร่วมเพื่อให้ shortlist แม่นยิ่งขึ้น`;
    const r = checkNaturalness(ok, {
      intent: "planning-broad",
      expectedToolUsage: true,
      userQuery: seminarQuery,
    });
    expect(r.ok).toBe(true);
  });

  test("rejects empty answer", () => {
    const r = checkNaturalness("", {
      intent: "general",
      expectedToolUsage: false,
      userQuery: "x",
    });
    expect(r.ok).toBe(false);
    expect(r.ruleFired).toBe("empty-answer");
  });
});

/**
 * services/naturalnessGuard.ts — Phase C anti-robotic answer guard
 *
 * Post-composition check that blocks the canned/robotic patterns we've
 * seen on screenshots:
 *   - "กรุณาระบุจังหวัด..." as the *whole* answer for a broad planning query
 *   - English-first answer for a Thai query
 *   - Top-level raw JSON in the visible answer
 *   - "Used tools: none" when intent had expectedToolUsage
 *   - Map placeholder leaks outside an explicit map intent
 *
 * Returns ok:true if the answer can ship as-is. Otherwise, returns ok:false
 * with the rule that fired and a Thai-friendly hint that the Stylist or
 * Conductor uses to revise.
 */

import type { ChatIntent } from "./intentClassifier";
import { checkVisibleTextSafe } from "../agents/eventGuard";

export interface NaturalnessCheckOptions {
  intent: ChatIntent;
  expectedToolUsage: boolean;
  /** The original user query — used to confirm Thai-first violations. */
  userQuery: string;
}

export interface NaturalnessResult {
  ok: boolean;
  ruleFired?: string;
  hint?: string;
}

const PROVINCE_REQUEST_RE =
  /^\s*(กรุณาระบุ(จังหวัด|พื้นที่)|โปรดระบุ(จังหวัด|พื้นที่)|please\s+specify\s+(province|area|location))[^\n]*$/i;

const RAW_JSON_RE = /^\s*[\{\[]\s*"/;

function hasThaiCharacter(s: string): boolean {
  return /[฀-๿]/.test(s);
}

function startsWithEnglish(s: string): boolean {
  return /^[A-Za-z]/.test(s.trim());
}

export function checkNaturalness(
  candidate: string,
  opts: NaturalnessCheckOptions
): NaturalnessResult {
  if (!candidate || typeof candidate !== "string") {
    return {
      ok: false,
      ruleFired: "empty-answer",
      hint: "คำตอบว่าง — โปรดเรียบเรียงคำตอบใหม่ให้สมบูรณ์",
    };
  }

  const trimmed = candidate.trim();

  // Rule 1: whole-answer is just "กรุณาระบุจังหวัด..." for broad planning
  if (opts.intent === "planning-broad" && PROVINCE_REQUEST_RE.test(trimmed)) {
    return {
      ok: false,
      ruleFired: "planning-broad-province-only",
      hint:
        "อย่าตอบแค่ 'กรุณาระบุจังหวัด' — ให้เสนอแนวทางวางแผนแบบมีสมมติฐาน " +
        "พร้อม first-pass plan และคำถามต่อ 1–3 ข้อ",
    };
  }

  // Rule 2: Thai query but answer leads with English
  const userIsThai = hasThaiCharacter(opts.userQuery);
  if (userIsThai && startsWithEnglish(trimmed) && !hasThaiCharacter(trimmed.slice(0, 50))) {
    return {
      ok: false,
      ruleFired: "english-first-leak",
      hint: "คำถามเป็นภาษาไทย แต่คำตอบขึ้นต้นด้วยภาษาอังกฤษ — โปรดขึ้นต้นด้วยภาษาไทย",
    };
  }

  // Rule 3: raw JSON top-level leak in visible answer
  if (RAW_JSON_RE.test(trimmed)) {
    return {
      ok: false,
      ruleFired: "raw-json-leak",
      hint: "อย่าตอบเป็น JSON ดิบ — โปรดเรียบเรียงเป็นข้อความภาษาไทย",
    };
  }

  // Rule 4 + 5: forbidden visible substrings via shared eventGuard scanner
  const guard = checkVisibleTextSafe(trimmed, {
    allowMapTerms: opts.intent === "map",
    expectedToolUsage: opts.expectedToolUsage,
  });
  if (!guard.ok) {
    return {
      ok: false,
      ruleFired: guard.forbiddenSubstring
        ? `forbidden-substring:${guard.forbiddenSubstring}`
        : "guard-violation",
      hint: "พบข้อความที่ไม่เหมาะกับคำตอบนี้ — โปรดตัดข้อความ placeholder/map warning ออก",
    };
  }

  // Rule 6: planning-broad must include a follow-up question or a method
  if (opts.intent === "planning-broad") {
    const hasFollowup = /\?|มี(คำถาม|ข้อเสนอ)|รบกวน(ขอ|ระบุ)|จะให้/.test(trimmed);
    const hasPlanFrame = /(แนวทาง|first-pass|เกณฑ์|ขั้นตอน|วิธี|ปัจจัย)/.test(trimmed);
    if (!hasFollowup && !hasPlanFrame) {
      return {
        ok: false,
        ruleFired: "planning-broad-too-shallow",
        hint:
          "คำตอบสำหรับคำถามวางแผนต้องมีอย่างน้อย 1 อย่างต่อไปนี้: " +
          "เกณฑ์/แนวทาง/ปัจจัย หรือ คำถามต่อ — กรุณาเพิ่มเข้ามา",
      };
    }
  }

  return { ok: true };
}

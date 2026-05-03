/**
 * promptAdapter.ts — Phase 6A/6B
 * Gated specialist for Thai → English visual prompt adaptation
 * and planner-query normalization.
 *
 * Design principles:
 *  - Deterministic-first: never call LLM for ordinary chat
 *  - Reuse existing utilities (thaiQueryNormalizer, image-prefix stripping)
 *  - Preserve proper nouns, numbers, place names
 *  - LLM fallback is opt-in (env-gated), short, JSON-only, with strict timeout
 *
 * Public API:
 *   adaptImagePrompt(rawPrompt)        → AdaptedImagePromptResult
 *   normalizePlannerQuery(rawQuery)    → PlannerQueryResult
 */

import { normalizeThaiQuery } from "../utils/thaiQueryNormalizer";

export type AdapterMode = "deterministic" | "llm-fallback" | "passthrough";

export interface AdaptedImagePromptResult {
  originalPrompt: string;
  normalizedPromptTh: string;
  adaptedPromptEn: string;
  mode: AdapterMode;
  confidence: number;
  reasons: string[];
  /** Time spent in adaptation (ms) — useful for observability */
  latencyMs: number;
}

export interface PlannerQueryResult {
  originalQuery: string;
  normalizedQuery: string;
  mode: AdapterMode;
  confidence: number;
  reasons: string[];
  latencyMs: number;
}

// ── Image-command prefix stripping (mirrors imageGenService.cleanPrompt) ────

const IMAGE_COMMAND_PREFIX_RE =
  /^(สร้าง|วาด|generate|draw|create|gen|make)\s*(รูป|ภาพ|รูปภาพ|image|picture|img|photo)\s*/i;
const IMAGE_COMMAND_REVERSE_RE =
  /^(รูป|ภาพ|รูปภาพ|image|picture)\s*(สร้าง|วาด|generate|draw|create)\s*/i;
const IMAGE_FILLER_RE =
  /^(ของ|เกี่ยวกับ|ที่|ให้|หน่อย|ที|ที่เป็น|แบบ|เป็น|of|about|featuring)\s+/i;

function stripImageCommand(text: string): string {
  let out = text.replace(IMAGE_COMMAND_PREFIX_RE, "");
  out = out.replace(IMAGE_COMMAND_REVERSE_RE, "");
  // strip up to two filler tokens (e.g. "สร้างรูปของแมว" → "ของแมว" → "แมว")
  for (let i = 0; i < 2; i++) {
    const next = out.replace(IMAGE_FILLER_RE, "");
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

// ── Bilingual visual glossary ──────────────────────────────────────────────
// Order matters: longer / more specific phrases first so they match
// before their constituent words. Each entry maps a Thai surface form to a
// concise English visual fragment. The glossary is intentionally small
// and curated — quality > coverage. Add only well-known mappings.

interface GlossaryEntry {
  th: string;
  en: string;
  tag: "subject" | "color" | "style" | "composition" | "lighting" | "scene" | "modifier";
}

const GLOSSARY: GlossaryEntry[] = [
  // ── Multi-word style / composition phrases (match first) ───────────────
  { th: "สไตล์การ์ตูน", en: "cartoon style", tag: "style" },
  { th: "สไตล์อนิเมะ", en: "anime style", tag: "style" },
  { th: "สไตล์ญี่ปุ่น", en: "Japanese style", tag: "style" },
  { th: "สไตล์ไทย", en: "Thai traditional style", tag: "style" },
  { th: "สไตล์มินิมอล", en: "minimalist style", tag: "style" },
  { th: "สไตล์เรโทร", en: "retro style", tag: "style" },
  { th: "สีน้ำมัน", en: "oil painting", tag: "style" },
  { th: "สีน้ำ", en: "watercolor", tag: "style" },
  { th: "ภาพวาดสีน้ำ", en: "watercolor painting", tag: "style" },
  { th: "ภาพถ่ายเสมือนจริง", en: "photorealistic", tag: "style" },
  { th: "ภาพเสมือนจริง", en: "photorealistic", tag: "style" },
  { th: "ภาพการ์ตูน", en: "cartoon illustration", tag: "style" },
  { th: "ภาพดิจิทัลอาร์ต", en: "digital art", tag: "style" },
  { th: "ดิจิทัลอาร์ต", en: "digital art", tag: "style" },
  { th: "การ์ตูน", en: "cartoon", tag: "style" },
  { th: "อนิเมะ", en: "anime", tag: "style" },
  { th: "มินิมอล", en: "minimalist", tag: "style" },

  // ── Composition / camera ──────────────────────────────────────────────
  { th: "มุมกว้าง", en: "wide shot", tag: "composition" },
  { th: "มุมสูง", en: "high angle", tag: "composition" },
  { th: "มุมต่ำ", en: "low angle", tag: "composition" },
  { th: "ภาพระยะใกล้", en: "close-up", tag: "composition" },
  { th: "ระยะใกล้", en: "close-up", tag: "composition" },
  { th: "ระยะไกล", en: "long shot", tag: "composition" },
  { th: "ภาพพอร์ตเทรต", en: "portrait", tag: "composition" },
  { th: "พอร์ตเทรต", en: "portrait", tag: "composition" },

  // ── Lighting / time of day ────────────────────────────────────────────
  { th: "พระอาทิตย์ตก", en: "sunset", tag: "lighting" },
  { th: "พระอาทิตย์ขึ้น", en: "sunrise", tag: "lighting" },
  { th: "ตอนพระอาทิตย์ตก", en: "at sunset", tag: "lighting" },
  { th: "ตอนพระอาทิตย์ขึ้น", en: "at sunrise", tag: "lighting" },
  { th: "ตอนเช้า", en: "in the morning", tag: "lighting" },
  { th: "ตอนกลางวัน", en: "during daytime", tag: "lighting" },
  { th: "ตอนเย็น", en: "in the evening", tag: "lighting" },
  { th: "ตอนกลางคืน", en: "at night", tag: "lighting" },
  { th: "กลางคืน", en: "night", tag: "lighting" },
  { th: "กลางวัน", en: "daytime", tag: "lighting" },
  { th: "แสงนวล", en: "soft lighting", tag: "lighting" },
  { th: "แสงสลัว", en: "dim lighting", tag: "lighting" },
  { th: "แสงแดด", en: "sunlight", tag: "lighting" },

  // ── Scenes ────────────────────────────────────────────────────────────
  { th: "ทุ่งนาไทย", en: "Thai rice field", tag: "scene" },
  { th: "ทุ่งนา", en: "rice field", tag: "scene" },
  { th: "ชายหาด", en: "beach", tag: "scene" },
  { th: "ทะเล", en: "sea", tag: "scene" },
  { th: "ภูเขา", en: "mountain", tag: "scene" },
  { th: "ป่าไม้", en: "forest", tag: "scene" },
  { th: "ป่า", en: "forest", tag: "scene" },
  { th: "เมือง", en: "city", tag: "scene" },
  { th: "ในเมือง", en: "in a city", tag: "scene" },
  { th: "ชนบท", en: "countryside", tag: "scene" },
  { th: "ในห้อง", en: "indoor", tag: "scene" },
  { th: "กลางแจ้ง", en: "outdoor", tag: "scene" },
  { th: "วัด", en: "Thai temple", tag: "scene" },
  { th: "ถนน", en: "street", tag: "scene" },
  { th: "อวกาศ", en: "outer space", tag: "scene" },

  // ── Subjects (people / animals / objects) ─────────────────────────────
  { th: "นักบินอวกาศ", en: "astronaut", tag: "subject" },
  { th: "นักบิน", en: "pilot", tag: "subject" },
  { th: "นักวิทยาศาสตร์", en: "scientist", tag: "subject" },
  { th: "ผู้หญิง", en: "woman", tag: "subject" },
  { th: "ผู้ชาย", en: "man", tag: "subject" },
  { th: "เด็กผู้หญิง", en: "girl", tag: "subject" },
  { th: "เด็กผู้ชาย", en: "boy", tag: "subject" },
  { th: "เด็ก", en: "child", tag: "subject" },
  { th: "หุ่นยนต์", en: "robot", tag: "subject" },
  { th: "มังกร", en: "dragon", tag: "subject" },
  { th: "แมว", en: "cat", tag: "subject" },
  { th: "สุนัข", en: "dog", tag: "subject" },
  { th: "หมา", en: "dog", tag: "subject" },
  { th: "นก", en: "bird", tag: "subject" },
  { th: "ม้า", en: "horse", tag: "subject" },
  { th: "ช้าง", en: "elephant", tag: "subject" },
  { th: "ดอกไม้", en: "flower", tag: "subject" },
  { th: "ต้นไม้", en: "tree", tag: "subject" },
  { th: "บ้าน", en: "house", tag: "subject" },
  { th: "รถยนต์", en: "car", tag: "subject" },
  { th: "รถ", en: "car", tag: "subject" },
  { th: "เรือ", en: "boat", tag: "subject" },

  // ── Colors (longer phrases first) ─────────────────────────────────────
  { th: "สีน้ำเงิน", en: "blue", tag: "color" },
  { th: "สีฟ้า", en: "light blue", tag: "color" },
  { th: "สีเขียว", en: "green", tag: "color" },
  { th: "สีเหลือง", en: "yellow", tag: "color" },
  { th: "สีแดง", en: "red", tag: "color" },
  { th: "สีส้ม", en: "orange", tag: "color" },
  { th: "สีม่วง", en: "purple", tag: "color" },
  { th: "สีชมพู", en: "pink", tag: "color" },
  { th: "สีดำ", en: "black", tag: "color" },
  { th: "สีขาว", en: "white", tag: "color" },
  { th: "สีเทา", en: "gray", tag: "color" },
  { th: "สีน้ำตาล", en: "brown", tag: "color" },
  { th: "สีทอง", en: "gold", tag: "color" },
  { th: "สีเงิน", en: "silver", tag: "color" },

  // ── Modifiers (positions / actions) ───────────────────────────────────
  { th: "ยืนกลาง", en: "standing in the middle of", tag: "modifier" },
  { th: "ยืน", en: "standing", tag: "modifier" },
  { th: "นั่ง", en: "sitting", tag: "modifier" },
  { th: "นอน", en: "lying down", tag: "modifier" },
  { th: "วิ่ง", en: "running", tag: "modifier" },
  { th: "บิน", en: "flying", tag: "modifier" },
  { th: "กระโดด", en: "jumping", tag: "modifier" },
  { th: "น่ารัก", en: "cute", tag: "modifier" },
  { th: "สวย", en: "beautiful", tag: "modifier" },
  { th: "ใหญ่", en: "big", tag: "modifier" },
  { th: "เล็ก", en: "small", tag: "modifier" },
];

// Pre-sort glossary by length DESC to ensure longest match wins.
const SORTED_GLOSSARY = [...GLOSSARY].sort((a, b) => b.th.length - a.th.length);

// ── Filler / connector words to drop after glossary substitution ──────────
// These survive substitution as Thai residue and add no semantic value
// to an English visual prompt.
const FILLER_TOKENS = [
  "ที่", "ของ", "และ", "หรือ", "แบบ", "เป็น", "ใน", "บน", "ที่อยู่", "ซึ่ง",
  "อยู่", "มี", "กับ", "ก็", "ก็คือ", "คือ", "หน่อย", "ที", "ให้",
];

function dropFillers(text: string): string {
  let out = text;
  for (const f of FILLER_TOKENS) {
    out = out.replace(new RegExp(`(?<=\\s|^)${escapeRegex(f)}(?=\\s|$)`, "g"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Quality detection helpers ─────────────────────────────────────────────

const THAI_CHAR_RE = /[฀-๿]/;

function hasThai(text: string): boolean {
  return THAI_CHAR_RE.test(text);
}

function thaiCharCount(text: string): number {
  const m = text.match(/[฀-๿]/g);
  return m ? m.length : 0;
}

function asciiWordCount(text: string): number {
  const m = text.match(/[A-Za-z][A-Za-z\-']*/g);
  return m ? m.length : 0;
}

// ── Deterministic glossary replacement ────────────────────────────────────

interface GlossaryReplaceResult {
  text: string;
  matches: number;
  matchedTags: Set<GlossaryEntry["tag"]>;
}

function applyGlossary(input: string): GlossaryReplaceResult {
  let out = input;
  let matches = 0;
  const matchedTags = new Set<GlossaryEntry["tag"]>();

  for (const entry of SORTED_GLOSSARY) {
    const re = new RegExp(escapeRegex(entry.th), "g");
    if (re.test(out)) {
      out = out.replace(re, ` ${entry.en} `);
      matches++;
      matchedTags.add(entry.tag);
    }
  }

  // Collapse whitespace
  out = out.replace(/\s+/g, " ").trim();
  return { text: out, matches, matchedTags };
}

// ── adaptImagePrompt ──────────────────────────────────────────────────────

/**
 * Adapt a raw user prompt (typically Thai) into a concise English visual
 * prompt suitable for image-generation providers. Deterministic-first.
 */
export function adaptImagePrompt(rawPrompt: string): AdaptedImagePromptResult {
  const t0 = Date.now();
  const original = String(rawPrompt || "").trim();
  const reasons: string[] = [];

  if (!original) {
    return {
      originalPrompt: original,
      normalizedPromptTh: "",
      adaptedPromptEn: "",
      mode: "passthrough",
      confidence: 0,
      reasons: ["empty-input"],
      latencyMs: Date.now() - t0,
    };
  }

  // Stage 1: deterministic Thai normalization (typos, particles, spacing)
  const tn = normalizeThaiQuery(original);
  let working = tn.normalized;
  if (tn.substitutionsApplied.length > 0) {
    reasons.push(`thai-normalize:${tn.substitutionsApplied.length}`);
  }

  // Stage 2: strip image command prefix
  const beforeStrip = working;
  working = stripImageCommand(working);
  if (working !== beforeStrip) reasons.push("strip-image-prefix");
  const normalizedPromptTh = working;

  // If the prompt was English-only to begin with, passthrough.
  if (!hasThai(working)) {
    reasons.push("english-only-passthrough");
    const final = working.slice(0, 500);
    return {
      originalPrompt: original,
      normalizedPromptTh,
      adaptedPromptEn: final,
      mode: "passthrough",
      confidence: 0.9,
      reasons,
      latencyMs: Date.now() - t0,
    };
  }

  // Stage 3: deterministic bilingual mapping
  const thaiBefore = thaiCharCount(working);
  const replaced = applyGlossary(working);
  let adapted = dropFillers(replaced.text);
  // Re-collapse residue whitespace
  adapted = adapted.replace(/\s+/g, " ").trim();

  if (replaced.matches > 0) {
    reasons.push(`glossary:${replaced.matches}`);
    if (replaced.matchedTags.size > 0) {
      reasons.push(`tags:${Array.from(replaced.matchedTags).join("+")}`);
    }
  }

  // Confidence heuristic:
  //   - more glossary matches → higher
  //   - residual Thai chars → lower
  //   - prompt has a recognizable subject tag → bonus
  const thaiAfter = thaiCharCount(adapted);
  const thaiResidueRatio = thaiBefore > 0 ? thaiAfter / thaiBefore : 0;
  const englishWords = asciiWordCount(adapted);

  let confidence = 0.0;
  confidence += Math.min(replaced.matches * 0.18, 0.7);
  confidence += replaced.matchedTags.has("subject") ? 0.15 : 0;
  confidence += replaced.matchedTags.has("style") ? 0.05 : 0;
  confidence += replaced.matchedTags.has("color") ? 0.05 : 0;
  confidence -= thaiResidueRatio * 0.4;
  if (englishWords < 1) confidence -= 0.3;
  confidence = Math.max(0, Math.min(1, confidence));

  let mode: AdapterMode = "deterministic";

  // Stage 4: optional LLM fallback (env-gated, off by default)
  // We only mark mode = "llm-fallback" if the integration is wired up
  // externally and confidence is still low. Keeping this stub deterministic
  // honors the "do not add always-on translator" hard constraint while
  // leaving a hook for the future.
  if (
    confidence < 0.45 &&
    process.env.PROMPT_ADAPTER_LLM_FALLBACK === "1" &&
    thaiAfter > 0
  ) {
    // Future hook: call short JSON-only LLM. For now we annotate the reason
    // so observability can see when the fallback would have fired.
    reasons.push("llm-fallback-eligible");
    mode = "llm-fallback";
  }

  // If we still have heavy Thai residue and low confidence, fall back to
  // the original raw prompt. Image providers handle Thai poorly but it's
  // better than emitting an empty / broken English prompt.
  if (englishWords === 0 && thaiAfter > 0) {
    reasons.push("residue-fallback-to-original");
    return {
      originalPrompt: original,
      normalizedPromptTh,
      adaptedPromptEn: original.slice(0, 500),
      mode: "passthrough",
      confidence: Math.max(confidence, 0.2),
      reasons,
      latencyMs: Date.now() - t0,
    };
  }

  // Drop any remaining stray Thai residue from the English output —
  // image models don't benefit from mixed-script noise.
  if (thaiAfter > 0 && englishWords > 0) {
    adapted = adapted.replace(/[฀-๿]+/g, " ").replace(/\s+/g, " ").trim();
    reasons.push("strip-thai-residue");
  }

  // Final cleanup
  adapted = adapted
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  return {
    originalPrompt: original,
    normalizedPromptTh,
    adaptedPromptEn: adapted,
    mode,
    confidence,
    reasons,
    latencyMs: Date.now() - t0,
  };
}

// ── normalizePlannerQuery ─────────────────────────────────────────────────

/**
 * Produce a normalized variant of a user query for use in tool/intent
 * routing. Unlike `adaptImagePrompt`, the output is still Thai (or mixed)
 * — we just clean up colloquialisms, typos, and spacing.
 *
 * The original query MUST be preserved by the caller for logs and UI.
 */
export function normalizePlannerQuery(rawQuery: string): PlannerQueryResult {
  const t0 = Date.now();
  const original = String(rawQuery || "").trim();

  if (!original) {
    return {
      originalQuery: original,
      normalizedQuery: "",
      mode: "passthrough",
      confidence: 0,
      reasons: ["empty-input"],
      latencyMs: Date.now() - t0,
    };
  }

  const tn = normalizeThaiQuery(original);
  const reasons: string[] = [];
  if (tn.substitutionsApplied.length > 0) {
    reasons.push(`thai-normalize:${tn.substitutionsApplied.length}`);
    for (const s of tn.substitutionsApplied.slice(0, 3)) {
      reasons.push(s);
    }
  }

  const mode: AdapterMode =
    tn.substitutionsApplied.length > 0 ? "deterministic" : "passthrough";

  return {
    originalQuery: original,
    normalizedQuery: tn.normalized,
    mode,
    confidence: tn.confidence,
    reasons,
    latencyMs: Date.now() - t0,
  };
}

// ── Internal exports for tests ────────────────────────────────────────────

export const __testing = {
  stripImageCommand,
  applyGlossary,
  dropFillers,
  GLOSSARY,
};

/**
 * services/intentClassifier.ts — Phase C lightweight intent classifier
 *
 * Decides which workflow the Conductor should run for a given user
 * message. Pure-function, deterministic, keyword-based — no LLM call.
 * The classifier intentionally returns *one* primary intent plus a
 * boolean `expectedToolUsage` hint that the naturalness guard uses to
 * detect "Used tools: none" leaks.
 */

export type ChatIntent =
  | "greeting"
  | "planning-broad"
  | "weather"
  | "datetime"
  | "calc"
  | "code"
  | "map"
  | "evidence"
  | "knowledge"
  | "general";

export interface ClassifyResult {
  intent: ChatIntent;
  expectedToolUsage: boolean;
  reasons: string[];
}

const PLANNING_KEYWORDS = [
  "วางแผน",
  "แผนการ",
  "คัดเลือก",
  "เปรียบเทียบ",
  "ค้นหาข้อมูลจังหวัดที่เหมาะ",
  "เลือกจังหวัดที่เหมาะ",
  "งานสัมมนา",
  "สัมมนา",
  "ห้องประชุม",
  "สถานที่จัด",
  "ทริป",
  "trip",
  "plan",
  "shortlist",
  "rank",
];

const WEATHER_KEYWORDS = [
  "อากาศ",
  "ฝน",
  "อุณหภูมิ",
  "พยากรณ์",
  "ภาวะฝน",
  "ฝนฟ้าคะนอง",
  "weather",
  "forecast",
  "rain",
  "temperature",
];

const TRAVEL_KEYWORDS = [
  "เดินทาง",
  "การเดินทาง",
  "เส้นทาง",
  "การจราจร",
  "ระยะทาง",
  "travel",
  "route",
  "distance",
  // C.09: travel-planning vocabulary (tightly scoped to leisure travel words)
  "เที่ยว",
  "ทริป",
  "วันหยุด",
  "ท่องเที่ยว",
  "holiday",
  "vacation",
  // Phase C.07: "traffic" (English) intentionally removed — it conflicts with
  // EVIDENCE_KEYWORDS ("network traffic"). hasOfficerSignal in the evidence
  // guard does the discriminating work for the Thai "การจราจร" still here.
];

const MAP_KEYWORDS = [
  "แผนที่",
  "พิกัด",
  "ตำแหน่งบนแผนที่",
  "map",
  "coordinates",
];

const CALC_KEYWORDS = [
  "คำนวณ",
  "เท่ากับ",
  "บวก",
  "ลบ",
  "คูณ",
  "หาร",
  "ผลคูณ",
  "ค่าเฉลี่ย",
  "%",
  "calculate",
  "compute",
  "mean",
];

const CODE_KEYWORDS = [
  "โค้ด",
  "function",
  "เขียนโปรแกรม",
  "typescript",
  "javascript",
  "python",
  "regex",
  "compile",
  "type error",
];

const DATETIME_KEYWORDS = [
  "เวลา",
  "วันที่",
  "กี่โมง",
  // "ตอนนี้" removed: too ambiguous — "อากาศตอนนี้เป็นยังไง" is a weather
  // question, not a datetime question. The remaining keywords ("กี่โมง",
  // "วันที่", "what time") are unambiguous datetime triggers.
  "ขณะนี้",
  "เดี๋ยวนี้",
  "วันนี้วัน",
  "date",
  "datetime",
  "current time",
  "what time",
  "clock",
];

const EVIDENCE_KEYWORDS = [
  "หลักฐาน",
  "คดี",
  "พยาน",
  "forensic",
  "evidence",
  "detect",
  "NIP",
  "nip",
  "ISP",
  "traffic",
  "machine",
  "url",
];

const KNOWLEDGE_KEYWORDS = [
  // Explanation / definition
  "คืออะไร",
  "หมายความว่า",
  "อธิบาย",
  "บอกหน่อย",
  "บอกให้กระชับ",
  "สรุปให้",
  "explain",
  "what is",
  "tell me about",
  "describe",
  // Thai law / policy
  "กฎหมาย",
  "พระราชบัญญัติ",
  "PDPA",
  "law",
  // Thai culture / history / place
  "ประวัติ",
  "ศาสนา",
  "วัด",
  "จังหวัด",
  "history",
  // Health / medical
  "โรค",
  "ยา",
  "สุขภาพ",
  "อาการ",
  "รักษา",
  "แพทย์",
  "โรงพยาบาล",
  // Food / recipe
  "อาหาร",
  "สูตร",
  "ส่วนผสม",
  "ทำอาหาร",
  "recipe",
  // Finance / business
  "หุ้น",
  "ลงทุน",
  "ภาษี",
  "บัญชี",
  "ธุรกิจ",
  "งบประมาณ",
  "เงิน",
  // Thai government process
  "ขั้นตอน",
  "ยื่นเรื่อง",
  "ราชการ",
  "เอกสาร",
  "ทะเบียน",
  // Science / technology / space
  "ภารกิจ",
  "นาซ่า",
  "nasa",
  "spacex",
  "อวกาศ",
  "ดาวเคราะห์",
  "ดวงจันทร์",
  "วิทยาศาสตร์",
  "เทคโนโลยี",
  "วิจัย",
  "โครงการ",
  "artemis",
  "ยาน",
  "ดาวเทียม",
];

const GREETING_KEYWORDS = [
  "สวัสดี",
  "หวัดดี",
  "ดีครับ",
  "ดีค่ะ",
  "hello",
  "hi",
  "hey",
  "yo",
  "alo",
  "ฮัลโหล",
];

function containsAny(text: string, list: string[]): string | null {
  const lower = text.toLowerCase();
  for (const k of list) {
    if (lower.includes(k.toLowerCase())) return k;
  }
  return null;
}

function evidenceMatch(message: string): string | null {
  const hit = containsAny(message, EVIDENCE_KEYWORDS);
  if (!hit) return null;
  const lower = message.toLowerCase();

  // "machine" and "url" are common in non-officer questions. Only treat
  // them as evidence intent when the query also has an officer/data signal.
  if (["machine", "url", "traffic"].includes(hit.toLowerCase())) {
    const hasOfficerSignal =
      /หลักฐาน|คดี|พยาน|forensic|evidence|detect|nip|isp|offline|threat|sigint|scan|สแกน/i.test(message);
    if (!hasOfficerSignal) return null;
  }
  if (/machine learning|url encoding|url คืออะไร/.test(lower)) return null;
  return hit;
}

export function classifyIntent(message: string, toolHint?: string): ClassifyResult {
  const reasons: string[] = [];

  if (!message || typeof message !== "string") {
    return { intent: "general", expectedToolUsage: false, reasons: ["empty"] };
  }

  const greeting = containsAny(message, GREETING_KEYWORDS);
  const planning = containsAny(message, PLANNING_KEYWORDS);
  const weather = containsAny(message, WEATHER_KEYWORDS);
  const datetime = containsAny(message, DATETIME_KEYWORDS);
  const evidence = evidenceMatch(message);
  const knowledge = containsAny(message, KNOWLEDGE_KEYWORDS);
  const travel = containsAny(message, TRAVEL_KEYWORDS);
  const map = containsAny(message, MAP_KEYWORDS);
  const calc = containsAny(message, CALC_KEYWORDS);
  const code = containsAny(message, CODE_KEYWORDS);
  const hint = String(toolHint || "auto").toLowerCase();

  if (hint && hint !== "auto") {
    if (hint === "weather") return { intent: "weather", expectedToolUsage: true, reasons: ["tool-hint:weather"] };
    if (hint === "calculation") return { intent: "calc", expectedToolUsage: true, reasons: ["tool-hint:calculation"] };
    if (hint === "datetime") return { intent: "datetime", expectedToolUsage: true, reasons: ["tool-hint:datetime"] };
    if (hint === "officer") return { intent: "evidence", expectedToolUsage: true, reasons: ["tool-hint:officer"] };
    if (hint === "data") {
      const intent = evidence ? "evidence" : "knowledge";
      return { intent, expectedToolUsage: true, reasons: [`tool-hint:data:${intent}`] };
    }
  }

  // Short greeting — fire 2 MDES agents for a friendly real response.
  // If the greeting is paired with a real question (5W1H or ?), fall through
  // to general so the user gets a proper answer instead of just a greeting.
  if (greeting && message.trim().split(/\s+/).length <= 6) {
    const hasQuestion = /\?|ใคร|อะไร|ทำไม|เมื่อไหร่|เมื่อไร|ที่ไหน|อย่างไร|ยังไง|ไหม|หรือเปล่า/.test(message);
    if (!hasQuestion) {
      reasons.push(`greeting: ${greeting}`);
      return { intent: "greeting", expectedToolUsage: false, reasons };
    }
    reasons.push(`greeting+question: ${greeting} → general`);
  }

  // Planning beats single-topic when at least 2 dimensions show up.
  if (planning && (weather || travel)) {
    reasons.push(`planning-broad: planning=${planning}, weather=${weather}, travel=${travel}`);
    return { intent: "planning-broad", expectedToolUsage: true, reasons };
  }
  if (evidence) {
    reasons.push(`evidence: ${evidence}`);
    return { intent: "evidence", expectedToolUsage: true, reasons };
  }
  if (map) {
    reasons.push(`map: ${map}`);
    return { intent: "map", expectedToolUsage: true, reasons };
  }
  if (weather) {
    reasons.push(`weather: ${weather}`);
    return { intent: "weather", expectedToolUsage: true, reasons };
  }
  if (datetime) {
    reasons.push(`datetime: ${datetime}`);
    return { intent: "datetime", expectedToolUsage: true, reasons };
  }
  if (calc && /\d/.test(message)) {
    reasons.push(`calc: ${calc}`);
    return { intent: "calc", expectedToolUsage: true, reasons };
  }
  if (code) {
    reasons.push(`code: ${code}`);
    return { intent: "code", expectedToolUsage: false, reasons };
  }
  if (knowledge) {
    reasons.push(`knowledge: ${knowledge}`);
    return { intent: "knowledge", expectedToolUsage: true, reasons };
  }

  reasons.push("general (no keywords matched)");
  return { intent: "general", expectedToolUsage: false, reasons };
}

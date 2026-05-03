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
  | "planning-broad"
  | "weather"
  | "calc"
  | "code"
  | "map"
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
  "function ",
  "เขียนโปรแกรม",
  "typescript",
  "javascript",
  "python",
  "regex",
  "compile",
  "type error",
];

function containsAny(text: string, list: string[]): string | null {
  const lower = text.toLowerCase();
  for (const k of list) {
    if (lower.includes(k.toLowerCase())) return k;
  }
  return null;
}

export function classifyIntent(message: string): ClassifyResult {
  const reasons: string[] = [];

  if (!message || typeof message !== "string") {
    return { intent: "general", expectedToolUsage: false, reasons: ["empty"] };
  }

  const planning = containsAny(message, PLANNING_KEYWORDS);
  const weather = containsAny(message, WEATHER_KEYWORDS);
  const travel = containsAny(message, TRAVEL_KEYWORDS);
  const map = containsAny(message, MAP_KEYWORDS);
  const calc = containsAny(message, CALC_KEYWORDS);
  const code = containsAny(message, CODE_KEYWORDS);

  // Planning beats single-topic when at least 2 dimensions show up.
  if (planning && (weather || travel)) {
    reasons.push(`planning-broad: planning=${planning}, weather=${weather}, travel=${travel}`);
    return { intent: "planning-broad", expectedToolUsage: true, reasons };
  }
  if (map) {
    reasons.push(`map: ${map}`);
    return { intent: "map", expectedToolUsage: false, reasons };
  }
  if (weather) {
    reasons.push(`weather: ${weather}`);
    return { intent: "weather", expectedToolUsage: true, reasons };
  }
  if (calc && /\d/.test(message)) {
    reasons.push(`calc: ${calc}`);
    return { intent: "calc", expectedToolUsage: false, reasons };
  }
  if (code) {
    reasons.push(`code: ${code}`);
    return { intent: "code", expectedToolUsage: false, reasons };
  }

  reasons.push("general (no keywords matched)");
  return { intent: "general", expectedToolUsage: false, reasons };
}

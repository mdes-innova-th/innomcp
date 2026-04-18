/**
 * Intent Gate - Smart routing for FastPath bypass
 * "999!" ไป calculator ไม่ใช่ greeting
 */

export type FastPathDecision =
  | { kind: "reply"; replyText: string; tag: string }
  | { kind: "bypass"; reason: string };

const WORK_KEYWORDS = [
  // Weather
  "ฝน", "อากาศ", "พยากรณ์", "อุณหภูมิ", "ความชื้น", "weather", "forecast", "temperature", "humidity",
  "tmd", "อุตุ", "climate", "พายุ", "storm",
  "ร้อน", "หนาว", "เย็น", "แล้ง", "หมอก",
  // NWP Time Ranges (CRITICAL - force NWP tool selection)
  "วัน", "ชั่วโมง", "ชม.", "สัปดาห์", "ข้างหน้า", "ล่วงหน้า",
  "3 วัน", "5 วัน", "7 วัน", "10 วัน", "14 วัน",
  "12 ชม.", "24 ชม.", "48 ชม.", "36 ชม.",
  
  // Time & Date (NEW - short meaningful queries)
  "กี่โมง", "เวลา", "วันนี้", "วันที่", "ตอนนี้", "time", "date", "today", "now", "when",
  "วันอะไร", "เดือน", "ปี", "year", "month", "day", "clock",
  
  // Data & Economics
  "gdp", "population", "ประชากร", "เศรษฐกิจ", "economy", "inflation", "worldbank", "เงินเฟ้อ",
  
  // Database & Tech
  "db", "mysql", "redis", "database", "ฐานข้อมูล", "api", "query",
  
  // Visualization
  "กราฟ", "chart", "echarts", "visualization", "แผนภูมิ", "แสดงผล",
  
  // Space & Science
  "นาซ่า", "nasa", "apod", "astronomy", "ดาราศาสตร์", "ดาว", "อวกาศ", "space",
  
  // Archives & Data
  "archive", "องค์กร", "govdata", "government", "ราชการ", "dataset",
  
  // Web filtering
  "webd", "ผิดกฎหมาย", "บล็อก", "เว็บไซต์", "website", "filter",

  // Geo / Coordinates
  "พิกัด", "ละติจูด", "ลองจิจูด", "latitude", "longitude", "coordinate"
];

/**
 * Normalize text for comparison
 */
export function normalizeText(s: string): string {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .toLowerCase();
}

/**
 * Extract number of days from weather query (NWP critical)
 * Examples: "5 วัน" → 5, "10 วันข้างหน้า" → 10, "สัปดาห์" → 7
 */
export function extractDaysFromQuery(text: string): number | null {
  const t = normalizeText(text);
  
  // Direct day patterns: "3 วัน", "5วัน", "10 วัน"
  const dayMatch = t.match(/(\d+)\s*(วัน|days?)/i);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  
  // Week pattern: "สัปดาห์", "1 สัปดาห์"
  if (/สัปดาห์|week/i.test(t)) {
    const weekMatch = t.match(/(\d+)\s*สัปดาห์/);
    return weekMatch ? parseInt(weekMatch[1], 10) * 7 : 7;
  }
  
  // Month pattern: "เดือน"
  if (/เดือน|month/i.test(t)) {
    const monthMatch = t.match(/(\d+)\s*เดือน/);
    return monthMatch ? parseInt(monthMatch[1], 10) * 30 : 30;
  }
  
  return null;
}

/**
 * Extract hours from query
 * Examples: "12 ชม." → 12, "24 ชั่วโมง" → 24
 */
export function extractHoursFromQuery(text: string): number | null {
  const t = normalizeText(text);
  
  const hourMatch = t.match(/(\d+)\s*(ชั่วโมง|ชม\.|hours?)/i);
  if (hourMatch) return parseInt(hourMatch[1], 10);
  
  return null;
}

/**
 * Check if text looks like math/calculation
 */
export function looksLikeMathOrCalc(text: string): boolean {
  const t = normalizeText(text);
  
  // 1) Only numbers, operators, brackets, whitespace
  const onlyNumLike = /^[\d\s,!.()^*+/\-=%×÷]+$/.test(t);
  
  // 2) Has mathematical operators
  const hasOp = /[+\-*/^=%×÷]/.test(t);
  
  // 3) Has calculation keywords
  const hasCalcWord = /(คำนวณ|คิดเลข|calculate|compute|เท่าไร|เท่าไหร่|equals?)/i.test(t);
  
  // 4) Factorial pattern (e.g., "999!", "5!") - MUST bypass FastPath for math tools
  const hasFactorial = /\d+!+/.test(t);
  
  // 5) Complex math expressions
  const complexMath = /(\d+[\^*/+\-]\d+|sqrt|log|sin|cos|tan|derivative|integral|อนุพันธ์|ปริพันธ์)/i.test(t);
  
  // If it's ONLY factorial (like "999!"), treat as math
  if (hasFactorial && /^[\d\s!]+$/.test(t)) {
    return true;
  }
  
  return onlyNumLike || hasOp || hasCalcWord || hasFactorial || complexMath;
}

/**
 * Check if text has work-related keywords
 */
export function hasWorkKeyword(text: string): boolean {
  const t = normalizeText(text);
  return WORK_KEYWORDS.some(keyword => t.includes(normalizeText(keyword)));
}

/**
 * Check if question is about identity
 */
export function isIdentityQuestion(text: string): boolean {
  const t = normalizeText(text);
  const identityPatterns = [
    /คุณคือใคร|นายคือใคร|เธอคือใคร|เป็นใคร/,
    /who are you|what are you/,
    /你是谁|你是誰/,
    /คุณชื่ออะไร|นายชื่ออะไร|ชื่ออะไร/,
    /what.*your name|what's your name/
  ];
  
  return identityPatterns.some(pattern => pattern.test(t));
}

/**
 * Check if text is asking about capabilities
 */
export function isCapabilityQuestion(text: string): boolean {
  const t = normalizeText(text);
  const capabilityPatterns = [
    /ทำอะไรได้บ้าง|สามารถทำอะไร|มีความสามารถ/,
    /what can you do|what are you capable/,
    /能做什么|可以做什么/,
    /ช่วยอะไรได้/
  ];
  
  return capabilityPatterns.some(pattern => pattern.test(t));
}

/**
 * Main intent gate decision
 */
export function analyzeIntent(text: string): {
  isMath: boolean;
  hasWorkKeyword: boolean;
  isIdentity: boolean;
  isCapability: boolean;
  shouldBypass: boolean;
  reason?: string;
} {
  const isMath = looksLikeMathOrCalc(text);
  const hasWork = hasWorkKeyword(text);
  const isIdentity = isIdentityQuestion(text);
  const isCapability = isCapabilityQuestion(text);
  
  let shouldBypass = false;
  let reason: string | undefined;
  
  if (isMath) {
    shouldBypass = true;
    reason = "MATH_OR_CALC";
  } else if (hasWork) {
    shouldBypass = true;
    reason = "WORK_KEYWORD";
  } else if (isIdentity || isCapability) {
    // These can be handled by FastPath with character profile
    shouldBypass = false;
  }
  
  return {
    isMath,
    hasWorkKeyword: hasWork,
    isIdentity,
    isCapability,
    shouldBypass,
    reason
  };
}

export default {
  normalizeText,
  looksLikeMathOrCalc,
  hasWorkKeyword,
  isIdentityQuestion,
  isCapabilityQuestion,
  analyzeIntent
};

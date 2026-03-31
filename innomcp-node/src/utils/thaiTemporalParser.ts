/**
 * Thai Temporal Parser
 * Parses Thai temporal expressions including:
 * - Absolute: วันนี้, พรุ่งนี้, มะรืน, คืนนี้
 * - Weekday: วันศุกร์นี้, ศุกร์นี้, ศุกร์หน้า, วันเสาร์หน้า
 * - Weekly: อาทิตย์นี้, สัปดาห์นี้, สัปดาห์หน้า
 * - Relative: อีก 3 วัน, ภายใน 2 สัปดาห์
 * - Ambiguous: ศุกร์นี้ (with context)
 */

export type TemporalType =
  | "today"
  | "tomorrow"
  | "day_after_tomorrow"
  | "tonight"
  | "this_week"
  | "next_week"
  | "specific_day"
  | "offset_days"
  | "unknown";

export interface ParsedTemporal {
  normalizedLabel: string;
  temporalType: TemporalType;
  targetDates: Date[];
  offsetDays: number[];
  confidence: "high" | "medium" | "low";
  interpretationReason: string;
  weekday?: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isWeekMode?: boolean;
}

// Thai weekday names (both short and full forms)
const THAI_WEEKDAYS = [
  { full: "อาทิตย์", short: "อา", en: "sunday", day: 0 },
  { full: "จันทร์", short: "จัน", en: "monday", day: 1 },
  { full: "อังคาร", short: "อัง", en: "tuesday", day: 2 },
  { full: "พุธ", short: "พุธ", en: "wednesday", day: 3 },
  { full: "พฤหัสบดี", short: "พฤหัส", en: "thursday", day: 4 },
  { full: "ศุกร์", short: "ศุก", en: "friday", day: 5 },
  { full: "เสาร์", short: "เสาร์", en: "saturday", day: 6 },
];

// Absolute day patterns
const ABSOLUTE_PATTERNS = [
  { regex: /วันนี้|ตอนนี้|ขณะนี้/, type: "today" as TemporalType, offset: 0, label: "วันนี้" },
  { regex: /คืนนี้/, type: "tonight" as TemporalType, offset: 0, label: "คืนนี้" },
  { regex: /พรุ่งนี้/, type: "tomorrow" as TemporalType, offset: 1, label: "พรุ่งนี้" },
  { regex: /มะรืน/, type: "day_after_tomorrow" as TemporalType, offset: 2, label: "มะรืน" },
];

// Week patterns
const WEEK_PATTERNS = [
  { regex: /สัปดาห์นี้|อาทิตย์นี้/, type: "this_week" as TemporalType, offset: 0, label: "สัปดาห์นี้" },
  { regex: /สัปดาห์หน้า/, type: "next_week" as TemporalType, offset: 7, label: "สัปดาห์หน้า" },
  { regex: /สัปดาห์หน้า/, type: "next_week" as TemporalType, offset: 7, label: "สัปดาห์หน้า" },
];

/**
 * Parse Thai temporal expressions from text
 */
export function parseThaiTemporal(
  text: string,
  referenceDate: Date = new Date()
): ParsedTemporal | null {
  if (!text) return null;

  const normalized = text.trim();

  // Try absolute patterns first (highest confidence)
  for (const pattern of ABSOLUTE_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      const targetDate = addDays(referenceDate, pattern.offset);
      return {
        normalizedLabel: pattern.label,
        temporalType: pattern.type,
        targetDates: [targetDate],
        offsetDays: [pattern.offset],
        confidence: "high",
        interpretationReason: `Matched pattern "${pattern.label}" with offset ${pattern.offset}`,
      };
    }
  }

  // Try weekday patterns
  const weekdayMatch = parseWeekdayExpression(normalized, referenceDate);
  if (weekdayMatch) {
    return weekdayMatch;
  }

  // Try week patterns
  const weekMatch = parseWeekExpression(normalized, referenceDate);
  if (weekMatch) {
    return weekMatch;
  }

  // Try relative offset patterns
  const offsetMatch = parseOffsetExpression(normalized, referenceDate);
  if (offsetMatch) {
    return offsetMatch;
  }

  // Default: no temporal found
  return null;
}

/**
 * Parse weekday expressions like:
 * - "ศุกร์นี้", "วันศุกร์นี้"
 * - "ศุกร์หน้า", "วันเสาร์หน้า"
 * - "ศุกร์ที่แล้ว"
 */
function parseWeekdayExpression(
  text: string,
  referenceDate: Date
): ParsedTemporal | null {
  // Match patterns like: (วัน)?ศุกร์(นี้|หน้า|ที่แล้ว)?
  const weekdayRegex = /(?:วัน)?(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัส(?:บดี)?|ศุกร์|เสาร์)(?:\s*)?(นี้|หน้า|หน|ที่\s*แล้ว|ที่แล้ว)?/i;
  const match = text.match(weekdayRegex);

  if (!match) return null;

  const weekdayName = match[1];
  const modifier = (match[2] || "").replace(/\s/g, "");

  // Find weekday info
  const weekdayInfo = THAI_WEEKDAYS.find(
    (w) =>
      w.full === weekdayName ||
      w.short === weekdayName ||
      weekdayName.startsWith(w.full)
  );

  if (!weekdayInfo) return null;

  const refDay = referenceDate.getDay();
  const targetDay = weekdayInfo.day;
  let offset: number;
  let label: string;
  let confidence: "high" | "medium" | "low" = "high";
  let reason: string;

  // Determine offset based on modifier
  if (!modifier || modifier === "นี้") {
    // "นี้" - this week's occurrence
    offset = targetDay - refDay;
    if (offset < 0) {
      // Target day already passed this week, assume next week
      offset += 7;
      label = `${weekdayInfo.full}หน้า`;
      confidence = "medium";
      reason = `${weekdayInfo.full}นี้ already passed this week, assuming next week`;
    } else if (offset === 0) {
      // Today
      offset = 0;
      label = `${weekdayInfo.full}นี้ (วันนี้)`;
      reason = `Matched ${weekdayInfo.full} which is today`;
    } else {
      label = `${weekdayInfo.full}นี้`;
      reason = `Matched ${weekdayInfo.full} this week`;
    }
  } else if (modifier === "หน้า" || modifier === "หน") {
    // "หน้า" - next week's occurrence
    offset = targetDay - refDay + 7;
    if (offset < 7) offset += 7; // Ensure it's next week
    label = `${weekdayInfo.full}หน้า`;
    reason = `Matched ${weekdayInfo.full} next week`;
  } else if (modifier.includes("แล้ว")) {
    // "ที่แล้ว" - last week's occurrence
    offset = targetDay - refDay - 7;
    label = `${weekdayInfo.full}ที่แล้ว`;
    reason = `Matched ${weekdayInfo.full} last week`;
  } else {
    // Unknown modifier
    offset = targetDay - refDay;
    label = weekdayInfo.full;
    confidence = "low";
    reason = `Matched ${weekdayInfo.full} with unknown modifier "${modifier}"`;
  }

  // Handle "ศกนี้", "ศุกนี้" etc. typos
  if (text.match(/ศ(ก|ุก|ุกร)นี้/)) {
    confidence = "high";
    label = "ศุกร์นี้";
  }

  const targetDate = addDays(referenceDate, offset);

  return {
    normalizedLabel: label,
    temporalType: "specific_day",
    targetDates: [targetDate],
    offsetDays: [offset],
    confidence,
    interpretationReason: reason,
    weekday: targetDay,
  };
}

/**
 * Parse week expressions
 */
function parseWeekExpression(
  text: string,
  referenceDate: Date
): ParsedTemporal | null {
  // Check for week patterns
  for (const pattern of WEEK_PATTERNS) {
    if (pattern.regex.test(text)) {
      // For "this week" or "next week", return 7 days
      const offsets: number[] = [];
      const dates: Date[] = [];

      if (pattern.type === "this_week") {
        // Generate offsets for current week
        const currentDay = referenceDate.getDay();
        for (let i = currentDay; i <= 6; i++) {
          offsets.push(i - currentDay);
          dates.push(addDays(referenceDate, i - currentDay));
        }
      } else {
        // Next week - all 7 days
        for (let i = 0; i < 7; i++) {
          offsets.push(pattern.offset + i);
          dates.push(addDays(referenceDate, pattern.offset + i));
        }
      }

      return {
        normalizedLabel: pattern.label,
        temporalType: pattern.type,
        targetDates: dates,
        offsetDays: offsets,
        confidence: "high",
        interpretationReason: `Matched pattern "${pattern.label}"`,
        isWeekMode: true,
      };
    }
  }

  return null;
}

/**
 * Parse offset expressions like "อีก 3 วัน", "ภายใน 2 สัปดาห์"
 */
function parseOffsetExpression(
  text: string,
  referenceDate: Date
): ParsedTemporal | null {
  // Match patterns like "อีก N วัน", "อีก ๓ วัน"
  const offsetRegex = /(?:อีก|ภายใน|ใน|ข้างหน้า)\s*(\d+|[๐-๙]+)\s*(วัน|สัปดาห์|อาทิตย์)/;
  const match = text.match(offsetRegex);

  if (match) {
    const thaiNumber = match[1];
    const unit = match[2];

    // Convert Thai digits to Arabic
    const arabicNumber = thaiDigitsToArabic(thaiNumber);
    const count = parseInt(arabicNumber, 10);

    if (Number.isFinite(count)) {
      const multiplier = unit === "วัน" ? 1 : 7;
      const offset = count * multiplier;
      const targetDate = addDays(referenceDate, offset);

      return {
        normalizedLabel: `อีก ${count} ${unit}`,
        temporalType: "offset_days",
        targetDates: [targetDate],
        offsetDays: [offset],
        confidence: "high",
        interpretationReason: `Parsed offset: ${count} ${unit} = ${offset} days`,
      };
    }
  }

  return null;
}

/**
 * Helper: Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Convert Thai digits to Arabic
 */
function thaiDigitsToArabic(text: string): string {
  const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";
  const arabicDigits = "0123456789";

  return text
    .split("")
    .map((char) => {
      const idx = thaiDigits.indexOf(char);
      return idx >= 0 ? arabicDigits[idx] : char;
    })
    .join("");
}

/**
 * Check if text has temporal indicators
 */
export function hasTemporalIndicators(text: string): boolean {
  const temporalRegex =
    /(วันนี้|พรุ่งนี้|มะรืน|คืนนี้|อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|สัปดาห์|เดือน|ปี)/;
  return temporalRegex.test(text);
}

/**
 * Format a Thai date string
 */
export function formatThaiDate(date: Date): string {
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  const dayName = days[date.getDay()];
  const dateNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear() + 543; // Buddhist year

  return `วัน${dayName}ที่ ${dateNum} ${monthName} ${year}`;
}

/**
 * Quick check if query appears to be about future weather
 */
export function isFutureWeatherQuery(text: string): boolean {
  const temporal = parseThaiTemporal(text);
  if (!temporal) return false;

  // Consider it future if it's tomorrow or later
  return temporal.offsetDays.some((offset) => offset >= 0);
}

/**
 * Get the primary target date (for single-date queries)
 */
export function getPrimaryTargetDate(
  text: string,
  referenceDate: Date = new Date()
): Date | null {
  const temporal = parseThaiTemporal(text, referenceDate);
  return temporal?.targetDates[0] || null;
}

/**
 * Get time window label for display
 */
export function getTimeWindowLabel(text: string): string {
  const temporal = parseThaiTemporal(text);
  if (temporal) {
    return temporal.normalizedLabel;
  }
  return "วันนี้";
}

/**
 * Weather Intent Parser
 * Handles multi-location weather queries and comparison queries
 * - Extracts multiple locations from text
 * - Identifies comparison intent
 * - Structures weather query for rendering
 */

import { resolveProvinces } from "./locationResolver";
import { parseThaiTemporal, ParsedTemporal } from "./thaiTemporalParser";
import { quickNormalize } from "./thaiQueryNormalizer";

export interface LocationResolution {
  originalEntity: string;
  canonicalProvince: string;
  granularity: "province" | "district" | "region" | "unknown";
  confidence: number;
  displayLabel: string;
}

export interface WeatherIntentResult {
  isWeatherQuery: boolean;
  isComparison: boolean;
  locations: LocationResolution[];
  temporal: ParsedTemporal | null;
  normalizedQuery: string;
  confidence: number;
  requiresClarification: boolean;
  clarificationReason?: string;
}

// Weather keywords in Thai
const WEATHER_KEYWORDS = [
  "อากาศ",
  "ฝน",
  "พยากรณ์",
  "อุณหภูมิ",
  "ลม",
  "ความชื้น",
  "สภาพอากาศ",
  "forecast",
  "weather",
  "temperature",
  "rain",
  "wind",
];

// Comparison keywords
const COMPARISON_KEYWORDS = [
  "เทียบ",
  "เปรียบเทียบ",
  "ต่างกัน",
  "vs",
  "versus",
  "กับ",
  "และ",
  "หรือ",
  "ช่องว่าง",
  "ความแตกต่าง",
];

// Rain-specific patterns
const RAIN_PATTERNS = [
  /ฝน\s*ตก/,
  /ตก\s*ไหม/,
  /มี\s*ฝน/,
  /ฝน\s*มี/,
  /พยากรณ์\s*ฝน/,
  /แนวโน้ม\s*ฝน/,
];

/**
 * Parse weather intent from Thai query
 */
export function parseWeatherIntent(text: string): WeatherIntentResult {
  const normalized = quickNormalize(text);

  // Step 1: Check if this is a weather query
  const isWeatherQuery = detectWeatherIntent(normalized);

  if (!isWeatherQuery) {
    return {
      isWeatherQuery: false,
      isComparison: false,
      locations: [],
      temporal: null,
      normalizedQuery: normalized,
      confidence: 0,
      requiresClarification: false,
    };
  }

  // Step 2: Extract locations
  const locations = extractLocations(text);

  // Step 3: Parse temporal
  const temporal = parseThaiTemporal(text);

  // Step 4: Detect comparison intent
  const isComparison = detectComparisonIntent(normalized);

  // Step 5: Calculate confidence and determine if clarification needed
  let confidence = 0.8;
  let requiresClarification = false;
  let clarificationReason: string | undefined;

  if (locations.length === 0) {
    confidence = 0.3;
    requiresClarification = true;
    clarificationReason = "ไม่พบจังหวัด/พื้นที่ในคำถาม";
  } else if (locations.some((l) => l.confidence < 0.5)) {
    confidence = 0.5;
    // Don't require clarification for low confidence yet - try to resolve
  }

  // If comparison but only 1 location, need clarification
  if (isComparison && locations.length < 2) {
    requiresClarification = true;
    clarificationReason = "ต้องการเปรียบเทียบแต่พบเพียง 1 พื้นที่ กรุณาระบุพื้นที่ที่สอง";
  }

  return {
    isWeatherQuery,
    isComparison,
    locations,
    temporal,
    normalizedQuery: normalized,
    confidence,
    requiresClarification,
    clarificationReason,
  };
}

/**
 * Detect if query is a weather intent
 */
function detectWeatherIntent(text: string): boolean {
  const normalized = text.toLowerCase();

  // Check for weather keywords
  const hasWeatherKeyword = WEATHER_KEYWORDS.some((kw) =>
    normalized.includes(kw.toLowerCase())
  );

  // Check for rain patterns
  const hasRainPattern = RAIN_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );

  // Location + temporal without explicit weather word (e.g., "เชียงใหม่พรุ่งนี้")
  const locations = resolveProvinces(text);
  const temporal = parseThaiTemporal(text);
  const hasLocationTemporal = locations.length > 0 && temporal !== null;

  return hasWeatherKeyword || hasRainPattern || hasLocationTemporal;
}

/**
 * Extract locations with structured resolution
 */
function extractLocations(text: string): LocationResolution[] {
  // Use existing location resolver
  const provinces = resolveProvinces(text);

  if (provinces.length === 0) {
    // Try to extract raw potential locations
    const rawLocations = extractRawLocations(text);
    return rawLocations.map((raw) => ({
      originalEntity: raw,
      canonicalProvince: raw,
      granularity: "unknown",
      confidence: 0.3,
      displayLabel: raw,
    }));
  }

  // Map provinces to structured format
  return provinces.map((province) => ({
    originalEntity: province,
    canonicalProvince: province,
    granularity: "province",
    confidence: 0.9,
    displayLabel: province,
  }));
}

/**
 * Extract raw location mentions from text
 */
function extractRawLocations(text: string): string[] {
  const locations: string[] = [];

  // Common Thai location patterns
  const patterns = [
    /จังหวัด\s*([ก-ฮ]+)/g,
    /อำเภอ\s*([ก-ฮ]+)/g,
    /ตำบล\s*([ก-ฮ]+)/g,
    /ที่\s*([ก-ฮ]{2,})/g,
    /ใน\s*([ก-ฮ]{2,})/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].length >= 2) {
        locations.push(match[1]);
      }
    }
  }

  return [...new Set(locations)];
}

/**
 * Detect comparison intent
 */
function detectComparisonIntent(text: string): boolean {
  const normalized = text.toLowerCase();

  // Check for comparison keywords
  const hasComparisonKeyword = COMPARISON_KEYWORDS.some((kw) =>
    normalized.includes(kw.toLowerCase())
  );

  // Check for multiple locations
  const locations = resolveProvinces(text);
  const hasMultipleLocations = locations.length >= 2;

  // Check for comparison patterns
  const comparisonPatterns = [
    /(\S+)\s+(เทียบ|กับ|vs|และ)\s+(\S+)/,
    /(\S+)\s+(ต่างกัน|เหมือนกัน|แตกต่าง)/,
  ];
  const hasComparisonPattern = comparisonPatterns.some((p) =>
    p.test(normalized)
  );

  return hasComparisonKeyword || (hasMultipleLocations && hasComparisonPattern);
}

/**
 * Check if query is likely a weather query (fast check)
 */
export function isLikelyWeatherQuery(text: string): boolean {
  const normalized = quickNormalize(text).toLowerCase();

  return (
    WEATHER_KEYWORDS.some((kw) =>
      normalized.includes(kw.toLowerCase())
    ) ||
    RAIN_PATTERNS.some((p) => p.test(normalized)) ||
    /(พรุ่งนี้|วันนี้|มะรืน|สัปดาห์|อาทิตย์|ศุกร์|เสาร์)/.test(normalized)
  );
}

/**
 * Get display label for location
 */
export function getLocationDisplayLabel(
  location: LocationResolution
): string {
  // Keep original display for known aliases
  const aliasDisplays: Record<string, string> = {
    "สมุทรสงคราม": "แม่กลอง/สมุทรสงคราม",
    "เชียงราย": "แม่สาย/เชียงราย",
    "สงขลา": "หาดใหญ่/สงขลา",
  };

  return aliasDisplays[location.canonicalProvince] || location.displayLabel;
}

/**
 * Generate natural Thai weather question
 */
export function generateWeatherQuestion(
  locations: LocationResolution[],
  temporal: ParsedTemporal | null
): string {
  const locationText = locations.map((l) => l.displayLabel).join(" และ ");
  const timeText = temporal?.normalizedLabel || "วันนี้";

  return `ขอสภาพอากาศ${locationText} ${timeText}`;
}

/**
 * Determine routing strategy for weather query
 */
export function getWeatherRoutingStrategy(
  intent: WeatherIntentResult
): "single" | "multi" | "compare" | "clarify" {
  if (intent.requiresClarification) {
    return "clarify";
  }

  if (intent.isComparison) {
    return "compare";
  }

  if (intent.locations.length > 1) {
    return "multi";
  }

  return "single";
}

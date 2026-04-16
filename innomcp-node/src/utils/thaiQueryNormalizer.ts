/**
 * Thai Query Normalizer
 * Handles colloquial Thai, typos, bad spacing, and noisy input
 */

export interface NormalizationResult {
  normalized: string;
  original: string;
  substitutionsApplied: string[];
  confidence: number;
}

// Colloquial particle mappings
const COLLOQUIAL_PARTICLES: Record<string, string> = {
  "มีมะ": "มีไหม",
  "มีมั้ย": "มีไหม",
  "มีมั๊ย": "มีไหม",
  "มีปะ": "มีไหม",
  "มีป่ะ": "มีไหม",
  "มีรึป่าว": "มีไหม",
  "มะ": "ไหม",
  "มั้ย": "ไหม",
  "มั๊ย": "ไหม",
  "ไม๊": "ไหม",
  "ปะ": "ไหม",
  "ป่ะ": "ไหม",
  "ป่าว": "ไหม",
  "รึป่าว": "ไหม",
  "ละ": "",
  "ล่ะ": "",
  "นะ": "",
  "เนอะ": "",
  "อ่ะ": "",
  "อ่า": "",
};

// Temporal typo mappings
const TEMPORAL_TYPOS: Record<string, string> = {
  "ศกนี้": "ศุกร์นี้",
  "ศุกนี้": "ศุกร์นี้",
  "ศุกรนี้": "ศุกร์นี้",
  "อาทิดนี้": "อาทิตย์นี้",
  "อาทิตนี้": "อาทิตย์นี้",
  "สัปดาหน้า": "สัปดาห์หน้า",
  "สัปดาห์น่า": "สัปดาห์หน้า",
  "สปดาห์หน้า": "สัปดาห์หน้า",
  "สัปดาห์หน้": "สัปดาห์หน้า",
};

// Mixed Thai-English temporal patterns
const MIXED_TEMPORAL: Record<string, string> = {
  "weekนี้": "สัปดาห์นี้",
  "weekหน้า": "สัปดาห์หน้า",
  "weekที่แล้ว": "สัปดาห์ที่แล้ว",
  "weekหน้": "สัปดาห์หน้า",
};

// Spelling corrections
const SPELLING_FIXES: Record<string, string> = {
  "อากาส": "อากาศ",
  "กรุเทพ": "กรุงเทพ",
  "กรงุเทพ": "กรุงเทพ",
  "วันี้": "วันนี้",
  "พรุ่งนี": "พรุ่งนี้",
  "พรุ่งนื้อ": "พรุ่งนี้",
  "พุ่งนี้": "พรุ่งนี้",
  "มะรืนนี้": "มะรืน",
  "เชียงใม่": "เชียงใหม่",
  "ภูเก็จ": "ภูเก็ต",
  "ภูเกตุ": "ภูเก็ต",
};

// Location aliases (for normalization, NOT replacement)
const LOCATION_ALIASES: Record<string, string> = {
  "กทม": "กรุงเทพมหานคร",
  "กรุงเทพ": "กรุงเทพมหานคร",
  "กรุงเทพฯ": "กรุงเทพมหานคร",
  "บางกอก": "กรุงเทพมหานคร",
  "โคราช": "นครราชสีมา",
  "อุบล": "อุบลราชธานี",
  "อุดร": "อุดรธานี",
  "อยุธยา": "พระนครศรีอยุธยา",
  "ยุดยา": "พระนครศรีอยุธยา",
  "แม่กลอง": "สมุทรสงคราม",
  "อัมพวา": "สมุทรสงคราม",
  "หาดใหญ่": "สงขลา",
  "แม่สาย": "เชียงราย",
  "หัวหิน": "ประจวบคีรีขันธ์",
  "สมุย": "สุราษฎร์ธานี",
  "เกาะสมุย": "สุราษฎร์ธานี",
  "แปดริ้ว": "ฉะเชิงเทรา",
  "เมืองกาญ": "กาญจนบุรี",
  "เมืองคอน": "นครศรีธรรมราช",
  "นครสี": "นครศรีธรรมราช",
  "สป": "สมุทรปราการ",
  "พัทยา": "ชลบุรี",
  "ศรีราชา": "ชลบุรี",
};

// Intention patterns (preserve these)
const INTENT_PATTERNS = {
  compare: /(เทียบ|เปรียบเทียบ|ต่างกัน|vs|versus|กับ)/i,
  weather: /(อากาศ|ฝน|พยากรณ์|อุณหภูมิ|ลม|ความชื้น|สภาพอากาศ)/i,
  rain: /(ฝน|ตก|มีฝน)/i,
};

/**
 * Normalize Thai query with comprehensive handling of:
 * - Colloquial particles (มีมะ, มั้ย, ปะ, ล่ะ)
 * - Spelling mistakes (อากาส → อากาศ)
 * - Temporal typos (ศกนี้ → ศุกร์นี้)
 * - Mixed Thai-English (weekหน้า → สัปดาห์หน้า)
 * - Location aliases (กทม → กรุงเทพมหานคร)
 * - Bad spacing (พรุ่งนี้ล่ะ → พรุ่งนี้)
 */
export function normalizeThaiQuery(text: string): NormalizationResult {
  if (!text) {
    return { normalized: "", original: "", substitutionsApplied: [], confidence: 1.0 };
  }

  const original = text.trim();
  let normalized = original;
  const substitutionsApplied: string[] = [];

  // Step 1: Basic whitespace normalization
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Step 2: Apply spelling fixes (higher priority than particles)
  for (const [typo, fix] of Object.entries(SPELLING_FIXES)) {
    const regex = new RegExp(typo, "gi");
    if (regex.test(normalized)) {
      normalized = normalized.replace(regex, fix);
      substitutionsApplied.push(`spell:${typo}→${fix}`);
    }
  }

  // Step 3: Apply temporal typo fixes
  for (const [typo, fix] of Object.entries(TEMPORAL_TYPOS)) {
    const regex = new RegExp(typo, "gi");
    if (regex.test(normalized)) {
      normalized = normalized.replace(regex, fix);
      substitutionsApplied.push(`temporal:${typo}→${fix}`);
    }
  }

  // Step 4: Apply mixed Thai-English fixes
  for (const [mixed, fix] of Object.entries(MIXED_TEMPORAL)) {
    const regex = new RegExp(mixed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (regex.test(normalized)) {
      normalized = normalized.replace(regex, fix);
      substitutionsApplied.push(`mixed:${mixed}→${fix}`);
    }
  }

  // Step 5: Handle colloquial particles
  // Process particles in order of specificity (longer matches first)
  const sortedParticles = Object.entries(COLLOQUIAL_PARTICLES).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [particle, replacement] of sortedParticles) {
    // Match particle at word boundaries or end of string
    // [\u0E00-\u0E5B] covers all Thai chars incl. vowel marks and tone marks
    //
    // B2 root-cause fix: the bare 2-char particle "มะ" used to also match the
    // first syllable of real Thai words (มะรืน, มะม่วง, มะลิ, มะนาว, มะพร้าว...)
    // because the lookahead permitted any Thai char. Restrict short bare-syllable
    // particles to word-final position (whitespace / punctuation / end of string)
    // so word-initial occurrences are left alone.
    const SHORT_SYLLABLE_FINAL_ONLY = new Set(["มะ"]);
    const lookahead = SHORT_SYLLABLE_FINAL_ONLY.has(particle)
      ? `(?=\\s|$|[\\?\\!\\.\\,])`
      : `(?=(?:\\s|$|[\u0E00-\u0E5B]))`;
    const regex = new RegExp(
      `(?<=(?:\\s|^|[\u0E00-\u0E5B]))${particle}${lookahead}`,
      "gi"
    );
    if (regex.test(normalized)) {
      normalized = normalized.replace(regex, replacement);
      if (replacement) {
        substitutionsApplied.push(`particle:${particle}→${replacement}`);
      } else {
        substitutionsApplied.push(`particle:${particle}→(removed)`);
      }
    }
  }

  // Step 6: Normalize location aliases (but keep display info)
  // Note: We apply these but track them separately - the location resolver
  // will still have access to the original for display purposes
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    const regex = new RegExp(
      `(?<=(?:\\s|^|จังหวัด|ที่|ใน|จ\\.))${alias}(?=(?:\\s|$|อากาศ|ฝน|พยากรณ์))`,
      "gi"
    );
    if (regex.test(normalized)) {
      // We don't replace here - let locationResolver handle it
      // Just log that we detected it
    }
  }

  // Step 7: Clean up extra spaces from particle removal
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Step 8: Handle specific query patterns
  // "วันศุกร์นี้" → normalize spacing
  normalized = normalized.replace(/วัน\s+ศุกร์/g, "วันศุกร์");
  normalized = normalized.replace(/วัน\s+เสาร์/g, "วันเสาร์");
  normalized = normalized.replace(/วัน\s+อาทิตย์/g, "วันอาทิตย์");
  normalized = normalized.replace(/วัน\s+จันทร์/g, "วันจันทร์");
  normalized = normalized.replace(/วัน\s+อังคาร/g, "วันอังคาร");
  normalized = normalized.replace(/วัน\s+พุธ/g, "วันพุธ");
  normalized = normalized.replace(/วัน\s+พฤหัส/g, "วันพฤหัส");

  // Calculate confidence based on substitutions
  const confidence = Math.max(0.5, 1.0 - substitutionsApplied.length * 0.05);

  return { normalized, original, substitutionsApplied, confidence };
}

/**
 * Quick normalize for routing decisions
 */
export function quickNormalize(text: string): string {
  return normalizeThaiQuery(text).normalized;
}

/**
 * Check if query has weather intent after normalization
 */
export function hasWeatherIntent(text: string): boolean {
  const normalized = quickNormalize(text);
  return INTENT_PATTERNS.weather.test(normalized);
}

/**
 * Check if query is a comparison query
 */
export function isComparisonQuery(text: string): boolean {
  const normalized = quickNormalize(text);
  return INTENT_PATTERNS.compare.test(normalized);
}

/**
 * Extract query type hints from normalized text
 */
export function extractQueryHints(text: string): {
  isWeather: boolean;
  isCompare: boolean;
  isRain: boolean;
  locations: string[];
} {
  const normalized = quickNormalize(text);

  return {
    isWeather: INTENT_PATTERNS.weather.test(normalized),
    isCompare: INTENT_PATTERNS.compare.test(normalized),
    isRain: INTENT_PATTERNS.rain.test(normalized),
    locations: [], // Will be filled by locationResolver
  };
}

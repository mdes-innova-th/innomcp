/**
 * Thai Multi-Location Parser
 * Extracts and normalizes multiple Thai province names from a single query.
 * Used for comparison queries like "เปรียบเทียบอากาศเชียงใหม่กับภูเก็ต"
 */

export interface MultiLocationResult {
  locations: string[];
  isComparison: boolean;
  comparisonType: "weather" | "rain" | "temp" | "general";
  originalText: string;
}

// All 77 Thai provinces (canonical form)
const PROVINCE_LIST: string[] = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

// Alias → canonical province name
const ALIAS_MAP: Record<string, string> = {
  // Bangkok
  "กทม": "กรุงเทพมหานคร",
  "กรุงเทพ": "กรุงเทพมหานคร",
  "กรุงเทพฯ": "กรุงเทพมหานคร",
  "บางกอก": "กรุงเทพมหานคร",
  // Nakhon Ratchasima
  "โคราช": "นครราชสีมา",
  "ปากช่อง": "นครราชสีมา",
  // Ubon Ratchathani
  "อุบล": "อุบลราชธานี",
  // Udon Thani
  "อุดร": "อุดรธานี",
  // Phra Nakhon Si Ayutthaya
  "อยุธยา": "พระนครศรีอยุธยา",
  "ยุดยา": "พระนครศรีอยุธยา",
  // Songkhla
  "หาดใหญ่": "สงขลา",
  // Surat Thani
  "สมุย": "สุราษฎร์ธานี",
  "เกาะสมุย": "สุราษฎร์ธานี",
  // Chonburi
  "พัทยา": "ชลบุรี",
  "ศรีราชา": "ชลบุรี",
  // Chachoengsao
  "แปดริ้ว": "ฉะเชิงเทรา",
  // Kanchanaburi
  "เมืองกาญ": "กาญจนบุรี",
  // Nakhon Si Thammarat
  "เมืองคอน": "นครศรีธรรมราช",
  "นครสี": "นครศรีธรรมราช",
  // Samut Prakan
  "สป": "สมุทรปราการ",
  // Chiang Rai
  "แม่สาย": "เชียงราย",
  // Prachuap Khiri Khan
  "หัวหิน": "ประจวบคีรีขันธ์",
  // Samut Songkhram
  "แม่กลอง": "สมุทรสงคราม",
  "อัมพวา": "สมุทรสงคราม",
  // Chiang Mai aliases
  "เชียงใม่": "เชียงใหม่",
  // Phuket typo
  "ภูเก็จ": "ภูเก็ต",
  "ภูเกตุ": "ภูเก็ต",
};

// Comparison indicator words
const COMPARISON_WORDS_WEATHER = ["เทียบอุณหภูมิ", "เปรียบอุณหภูมิ"];
const COMPARISON_WORDS_RAIN = ["เทียบฝน", "เปรียบฝน", "ฝนตกที่ไหนมากกว่า"];
const COMPARISON_WORDS_TEMP = ["อุณหภูมิต่างกัน", "ร้อนกว่า", "เย็นกว่า", "อุณหภูมิเทียบ"];
const COMPARISON_WORDS_GENERAL = ["เทียบ", "เปรียบเทียบ", "ต่างกัน", "vs", "versus", "กับ", "และ", "หรือ"];

/**
 * Canonicalize a single location string (alias → canonical province)
 */
function canonicalize(loc: string): string {
  return ALIAS_MAP[loc] ?? loc;
}

/**
 * Extract all Thai province names (canonical) found in the text.
 * Handles:
 * - Direct province name matches
 * - Known aliases (กทม, โคราช, etc.)
 * - Tokenization by spaces, pipes, slashes, "กับ", "และ", "vs", "เทียบ"
 */
export function extractMultipleLocations(text: string): string[] {
  if (!text) return [];

  // Split on separators: spaces, |, /, "กับ", "และ", "vs", commas
  const separatorPattern = /[|\/,\s]+|กับ|และ|หรือ|vs|versus/gi;
  const tokens = text.split(separatorPattern).map((t) => t.trim()).filter(Boolean);

  const found: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    // Try exact match in province list
    if (PROVINCE_LIST.includes(token) && !seen.has(token)) {
      found.push(token);
      seen.add(token);
      continue;
    }
    // Try alias map
    const canonical = canonicalize(token);
    if (PROVINCE_LIST.includes(canonical) && !seen.has(canonical)) {
      found.push(canonical);
      seen.add(canonical);
      continue;
    }
    // Partial match: token is a substring of a province or vice versa
    for (const province of PROVINCE_LIST) {
      if (!seen.has(province) && token.length >= 3) {
        if (province.includes(token) || token.includes(province)) {
          // Avoid overly short or ambiguous partial matches
          if (token.length >= Math.max(3, province.length - 4)) {
            found.push(province);
            seen.add(province);
            break;
          }
        }
      }
    }
  }

  // Full-text scan — handles unsegmented Thai (e.g. "โคราชฝน", "กรุงเทพวันนี้")
  // Check all alias keys first (shorter strings embedded in token)
  for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
    if (!seen.has(canonical) && alias.length >= 3 && text.includes(alias)) {
      found.push(canonical);
      seen.add(canonical);
    }
  }
  // Then check full province names as substrings
  for (const province of PROVINCE_LIST) {
    if (!seen.has(province) && text.includes(province)) {
      found.push(province);
      seen.add(province);
    }
  }

  return found;
}

/**
 * Detect comparison type from text
 */
function detectComparisonType(text: string): "weather" | "rain" | "temp" | "general" {
  if (COMPARISON_WORDS_RAIN.some((w) => text.includes(w))) return "rain";
  if (COMPARISON_WORDS_TEMP.some((w) => text.includes(w))) return "temp";
  if (COMPARISON_WORDS_WEATHER.some((w) => text.includes(w))) return "weather";
  return "general";
}

/**
 * Parse a query that may contain multiple locations with comparison intent
 */
export function parseMultiLocationQuery(text: string): MultiLocationResult {
  const locations = extractMultipleLocations(text);
  const hasComparisonWord = COMPARISON_WORDS_GENERAL.some((w) =>
    new RegExp(w, "i").test(text)
  );
  const isComparison = locations.length >= 2 || hasComparisonWord;
  const comparisonType = isComparison ? detectComparisonType(text) : "general";

  return {
    locations,
    isComparison,
    comparisonType,
    originalText: text,
  };
}

/**
 * Returns true if the query has 2+ recognized locations OR comparison words
 */
export function isMultiLocationQuery(text: string): boolean {
  const locations = extractMultipleLocations(text);
  if (locations.length >= 2) return true;
  return COMPARISON_WORDS_GENERAL.some((w) => new RegExp(w, "i").test(text));
}

/**
 * Build a human-readable display label for multiple locations
 * e.g. ["กรุงเทพมหานคร", "เชียงใหม่"] → "กรุงเทพมหานคร vs เชียงใหม่"
 */
export function buildLocationWeatherLabels(locations: string[]): string {
  return locations.join(" vs ");
}

import Fuse from "fuse.js";

export interface StructuredLocationResult {
  originalEntity: string;
  canonicalProvince: string;
  granularity: "province" | "district" | "region" | "subdistrict" | "unknown";
  confidence: number;
  displayLabel: string;
  aliases?: string[];
}

function normalizeResolverText(input: string): { original: string; lower: string } {
  const s = (input || "")
    .normalize("NFKC")
    // zero-width & BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // common punctuation → spaces (keep Thai letters)
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[\(\)\[\]{}<\>"'`~!@#$%^*&_+=|\\:;?/.,，、。·•]/g, " ")
    // Thai punctuation
    .replace(/[ๆฯ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { original: s, lower: s.toLowerCase() };
}

function normalizeProvinceOut(p: string): string {
  return String(p || "")
    .replace(/\s+/g, " ")
    .trim();
}

function finalizeResolved(found: Set<string>): string[] {
  return Array.from(found)
    .map(normalizeProvinceOut)
    .filter((x) => x.length > 0);
}

const BKK_DISTRICTS = new Set([
  "พระนคร",
  "ดุสิต",
  "หนองจอก",
  "บางรัก",
  "บางเขน",
  "บางกะปิ",
  "ปทุมวัน",
  "ป้อมปราบศัตรูพ่าย",
  "พระโขนง",
  "มีนบุรี",
  "ลาดกระบัง",
  "ยานนาวา",
  "สัมพันธวงศ์",
  "พญาไท",
  "ธนบุรี",
  "บางกอกใหญ่",
  "ห้วยขวาง",
  "คลองสาน",
  "ตลิ่งชัน",
  "บางกอกน้อย",
  "บางขุนเทียน",
  "ภาษีเจริญ",
  "หนองแขม",
  "ราษฎร์บูรณะ",
  "บางพลัด",
  "ดินแดง",
  "บึงกุ่ม",
  "สาทร",
  "บางซื่อ",
  "จตุจักร",
  "บางคอแหลม",
  "ประเวศ",
  "คลองเตย",
  "สวนหลวง",
  "จอมทอง",
  "ดอนเมือง",
  "ราชเทวี",
  "ลาดพร้าว",
  "วัฒนา",
  "บางแค",
  "หลักสี่",
  "สายไหม",
  "คันนายาว",
  "สะพานสูง",
  "วังทองหลาง",
  "คลองสามวา",
  "บางนา",
  "ทวีวัฒนา",
  "ทุ่งครุ",
  "บางบอน",
]);

// 🇹🇭 Mapping: Alias/District -> Province with confidence and display info
interface ProvinceMapping {
  canonical: string;
  granularity: "province" | "district" | "subdistrict";
  displayLabel: string;
  confidence: number;
  aliases?: string[];
}

const PROVINCE_MAP: Record<string, ProvinceMapping> = {
  // Cities / Districts
  "หาดใหญ่": { canonical: "สงขลา", granularity: "district", displayLabel: "หาดใหญ่ (สงขลา)", confidence: 0.95 },
  "พัทยา": { canonical: "ชลบุรี", granularity: "district", displayLabel: "พัทยา (ชลบุรี)", confidence: 0.95 },
  "ศรีราชา": { canonical: "ชลบุรี", granularity: "district", displayLabel: "ศรีราชา (ชลบุรี)", confidence: 0.95 },
  "สัตหีบ": { canonical: "ชลบุรี", granularity: "district", displayLabel: "สัตหีบ (ชลบุรี)", confidence: 0.95 },
  "บางละมุง": { canonical: "ชลบุรี", granularity: "district", displayLabel: "บางละมุง (ชลบุรี)", confidence: 0.95 },
  "ปากเกร็ด": { canonical: "นนทบุรี", granularity: "district", displayLabel: "ปากเกร็ด (นนทบุรี)", confidence: 0.95 },
  "บางบัวทอง": { canonical: "นนทบุรี", granularity: "district", displayLabel: "บางบัวทอง (นนทบุรี)", confidence: 0.95 },
  "ธนบุรี": { canonical: "กรุงเทพมหานคร", granularity: "district", displayLabel: "ธนบุรี (กรุงเทพ)", confidence: 0.95 },
  "รังสิต": { canonical: "ปทุมธานี", granularity: "district", displayLabel: "รังสิต (ปทุมธานี)", confidence: 0.95 },
  "ลำลูกกา": { canonical: "ปทุมธานี", granularity: "district", displayLabel: "ลำลูกกา (ปทุมธานี)", confidence: 0.95 },
  "คลองหลวง": { canonical: "ปทุมธานี", granularity: "district", displayLabel: "คลองหลวง (ปทุมธานี)", confidence: 0.95 },
  "ธัญบุรี": { canonical: "ปทุมธานี", granularity: "district", displayLabel: "ธัญบุรี (ปทุมธานี)", confidence: 0.95 },
  "หัวหิน": { canonical: "ประจวบคีรีขันธ์", granularity: "district", displayLabel: "หัวหิน (ประจวบฯ)", confidence: 0.95, aliases: ["หัวหิน"] },
  "ปราณบุรี": { canonical: "ประจวบคีรีขันธ์", granularity: "district", displayLabel: "ปราณบุรี (ประจวบฯ)", confidence: 0.95 },
  "เกาะสมุย": { canonical: "สุราษฎร์ธานี", granularity: "district", displayLabel: "เกาะสมุย (สุราษฎร์ฯ)", confidence: 0.95 },
  "สมุย": { canonical: "สุราษฎร์ธานี", granularity: "district", displayLabel: "สมุย (สุราษฎร์ฯ)", confidence: 0.95 },
  "เกาะเต่า": { canonical: "สุราษฎร์ธานี", granularity: "district", displayLabel: "เกาะเต่า (สุราษฎร์ฯ)", confidence: 0.95 },
  "เกาะพะงัน": { canonical: "สุราษฎร์ธานี", granularity: "district", displayLabel: "เกาะพะงัน (สุราษฎร์ฯ)", confidence: 0.95 },
  "เกาะล้าน": { canonical: "ชลบุรี", granularity: "district", displayLabel: "เกาะล้าน (ชลบุรี)", confidence: 0.95 },
  "เกาะช้าง": { canonical: "ตราด", granularity: "district", displayLabel: "เกาะช้าง (ตราด)", confidence: 0.95 },
  "เกาะเสม็ด": { canonical: "ระยอง", granularity: "district", displayLabel: "เกาะเสม็ด (ระยอง)", confidence: 0.95 },
  "สะเดา": { canonical: "สงขลา", granularity: "district", displayLabel: "สะเดา (สงขลา)", confidence: 0.95 },
  "เบตง": { canonical: "ยะลา", granularity: "district", displayLabel: "เบตง (ยะลา)", confidence: 0.95 },
  "สุไหงโก-ลก": { canonical: "นราธิวาส", granularity: "district", displayLabel: "สุไหงโก-ลก (นราธิวาส)", confidence: 0.95 },
  "แม่สอด": { canonical: "ตาก", granularity: "district", displayLabel: "แม่สอด (ตาก)", confidence: 0.95 },
  "อุ้มผาง": { canonical: "ตาก", granularity: "district", displayLabel: "อุ้มผาง (ตาก)", confidence: 0.95 },
  "เชียงแสน": { canonical: "เชียงราย", granularity: "district", displayLabel: "เชียงแสน (เชียงราย)", confidence: 0.95 },
  "แม่สาย": { canonical: "เชียงราย", granularity: "district", displayLabel: "แม่สาย (เชียงราย)", confidence: 0.95, aliases: ["แม่สาย", "เชียงราย"] },
  "แม่ริม": { canonical: "เชียงใหม่", granularity: "district", displayLabel: "แม่ริม (เชียงใหม่)", confidence: 0.95 },
  "ปาย": { canonical: "แม่ฮ่องสอน", granularity: "district", displayLabel: "ปาย (แม่ฮ่องสอน)", confidence: 0.95 },
  "สวนผึ้ง": { canonical: "ราชบุรี", granularity: "district", displayLabel: "สวนผึ้ง (ราชบุรี)", confidence: 0.95 },
  "ปากช่อง": { canonical: "นครราชสีมา", granularity: "district", displayLabel: "ปากช่อง (นครราชสีมา)", confidence: 0.95 },
  "เขาใหญ่": { canonical: "นครราชสีมา", granularity: "district", displayLabel: "เขาใหญ่ (นครราชสีมา)", confidence: 0.95 },
  "วังน้ำเขียว": { canonical: "นครราชสีมา", granularity: "district", displayLabel: "วังน้ำเขียว (นครราชสีมา)", confidence: 0.95 },
  "เมืองพล": { canonical: "ขอนแก่น", granularity: "district", displayLabel: "เมืองพล (ขอนแก่น)", confidence: 0.95 },
  "ทุ่งสง": { canonical: "นครศรีธรรมราช", granularity: "district", displayLabel: "ทุ่งสง (นครศรีธรรมราช)", confidence: 0.95 },
  "ขนอม": { canonical: "นครศรีธรรมราช", granularity: "district", displayLabel: "ขนอม (นครศรีธรรมราช)", confidence: 0.95 },
  "แม่กลอง": { canonical: "สมุทรสงคราม", granularity: "district", displayLabel: "แม่กลอง (สมุทรสงคราม)", confidence: 0.95, aliases: ["แม่กลอง", "สมุทรสงคราม"] },
  "อัมพวา": { canonical: "สมุทรสงคราม", granularity: "district", displayLabel: "อัมพวา (สมุทรสงคราม)", confidence: 0.95, aliases: ["อัมพวา", "สมุทรสงคราม"] },
  "มหาชัย": { canonical: "สมุทรสาคร", granularity: "district", displayLabel: "มหาชัย (สมุทรสาคร)", confidence: 0.95 },
  "กระทุ่มแบน": { canonical: "สมุทรสาคร", granularity: "district", displayLabel: "กระทุ่มแบน (สมุทรสาคร)", confidence: 0.95 },

  // Colloquial / Short names
  "โคราช": { canonical: "นครราชสีมา", granularity: "province", displayLabel: "โคราช", confidence: 0.95, aliases: ["โคราช", "นครราชสีมา"] },
  "กทม": { canonical: "กรุงเทพมหานคร", granularity: "province", displayLabel: "กรุงเทพ", confidence: 0.95, aliases: ["กทม", "กรุงเทพ", "กรุงเทพมหานคร", "บางกอก"] },
  "กรุงเทพ": { canonical: "กรุงเทพมหานคร", granularity: "province", displayLabel: "กรุงเทพ", confidence: 0.95 },
  "กรงุเทพ": { canonical: "กรุงเทพมหานคร", granularity: "province", displayLabel: "กรุงเทพ", confidence: 0.9 },
  "กรุงเทพฯ": { canonical: "กรุงเทพมหานคร", granularity: "province", displayLabel: "กรุงเทพ", confidence: 0.95 },
  "บางกอก": { canonical: "กรุงเทพมหานคร", granularity: "province", displayLabel: "กรุงเทพ", confidence: 0.95 },
  "bangkok": { canonical: "กรุงเทพมหานคร", granularity: "province", displayLabel: "กรุงเทพ", confidence: 0.95 },
  "bkk": { canonical: "กรุงเทพมหานคร", granularity: "province", displayLabel: "กรุงเทพ", confidence: 0.95 },
  "korat": { canonical: "นครราชสีมา", granularity: "province", displayLabel: "โคราช", confidence: 0.95 },
  "chiangmai": { canonical: "เชียงใหม่", granularity: "province", displayLabel: "เชียงใหม่", confidence: 0.95 },
  "chiang mai": { canonical: "เชียงใหม่", granularity: "province", displayLabel: "เชียงใหม่", confidence: 0.95 },
  "เชียงใม่": { canonical: "เชียงใหม่", granularity: "province", displayLabel: "เชียงใหม่", confidence: 0.85 },
  "chiangrai": { canonical: "เชียงราย", granularity: "province", displayLabel: "เชียงราย", confidence: 0.95 },
  "chiang rai": { canonical: "เชียงราย", granularity: "province", displayLabel: "เชียงราย", confidence: 0.95 },
  "phuket": { canonical: "ภูเก็ต", granularity: "province", displayLabel: "ภูเก็ต", confidence: 0.95 },
  "ภูเก็จ": { canonical: "ภูเก็ต", granularity: "province", displayLabel: "ภูเก็ต", confidence: 0.85 },
  "ภูเกตุ": { canonical: "ภูเก็ต", granularity: "province", displayLabel: "ภูเก็ต", confidence: 0.85 },
  "pattaya": { canonical: "ชลบุรี", granularity: "district", displayLabel: "พัทยา (ชลบุรี)", confidence: 0.95 },
  "อุบล": { canonical: "อุบลราชธานี", granularity: "province", displayLabel: "อุบลราชธานี", confidence: 0.95, aliases: ["อุบล", "อุบลราชธานี"] },
  "อุดร": { canonical: "อุดรธานี", granularity: "province", displayLabel: "อุดรธานี", confidence: 0.95, aliases: ["อุดร", "อุดรธานี"] },
  "hat yai": { canonical: "สงขลา", granularity: "district", displayLabel: "หาดใหญ่ (สงขลา)", confidence: 0.95 },
  "hatyai": { canonical: "สงขลา", granularity: "district", displayLabel: "หาดใหญ่ (สงขลา)", confidence: 0.95 },
  "samui": { canonical: "สุราษฎร์ธานี", granularity: "district", displayLabel: "สมุย (สุราษฎร์ฯ)", confidence: 0.95 },
  "แปดริ้ว": { canonical: "ฉะเชิงเทรา", granularity: "province", displayLabel: "ฉะเชิงเทรา", confidence: 0.95 },
  "เมืองกาญ": { canonical: "กาญจนบุรี", granularity: "province", displayLabel: "กาญจนบุรี", confidence: 0.95 },
  "เมืองคอน": { canonical: "นครศรีธรรมราช", granularity: "province", displayLabel: "นครศรีธรรมราช", confidence: 0.95 },
  "สป": { canonical: "สมุทรปราการ", granularity: "province", displayLabel: "สมุทรปราการ", confidence: 0.95 },
  "ยุดยา": { canonical: "พระนครศรีอยุธยา", granularity: "province", displayLabel: "พระนครศรีอยุธยา", confidence: 0.90 },
  "อยุธยา": { canonical: "พระนครศรีอยุธยา", granularity: "province", displayLabel: "พระนครศรีอยุธยา", confidence: 0.95, aliases: ["อยุธยา", "พระนครศรีอยุธยา"] },
  "นครสี": { canonical: "นครศรีธรรมราช", granularity: "province", displayLabel: "นครศรีธรรมราช", confidence: 0.90 },
  "หนองคาย": { canonical: "หนองคาย", granularity: "province", displayLabel: "หนองคาย", confidence: 1.0 },
};

// 🇹🇭 Region → representative provinces (for region-level weather queries)
const REGION_PROVINCES: [string, string[]][] = [
  ["ภาคตะวันออกเฉียงเหนือ", ["ขอนแก่น", "นครราชสีมา", "อุดรธานี", "อุบลราชธานี"]],
  ["ภาคใต้ฝั่งอ่าวไทย", ["สุราษฎร์ธานี", "นครศรีธรรมราช", "สงขลา"]],
  ["ภาคใต้ฝั่งอันดามัน", ["ภูเก็ต", "กระบี่", "พังงา"]],
  ["ภาคตะวันออก", ["ชลบุรี", "ระยอง", "จันทบุรี"]],
  ["ภาคตะวันตก", ["กาญจนบุรี", "ราชบุรี", "เพชรบุรี"]],
  ["ภาคกลาง", ["กรุงเทพมหานคร", "นครสวรรค์", "สุพรรณบุรี", "นนทบุรี"]],
  ["ภาคเหนือ", ["เชียงใหม่", "เชียงราย", "พิษณุโลก", "ลำปาง"]],
  ["ภาคอีสาน", ["ขอนแก่น", "นครราชสีมา", "อุดรธานี", "อุบลราชธานี"]],
  ["ภาคใต้", ["สุราษฎร์ธานี", "ภูเก็ต", "นครศรีธรรมราช", "สงขลา"]],
  ["อีสาน", ["ขอนแก่น", "นครราชสีมา", "อุดรธานี"]],
];

// 🇹🇭 All 77 Provinces (Normalized)
const ALL_PROVINCES = new Set([
  "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น",
  "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย",
  "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม",
  "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน",
  "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี",
  "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี",
  "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร",
  "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน",
  "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม",
  "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี",
  "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ",
  "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"
]);

// ──────────────────────────────────────────────
// PRE-COMPUTED: Sorted substring lookup tables
const PROVINCE_NAMES_SORTED = Array.from(ALL_PROVINCES).sort((a, b) => b.length - a.length);
const ALIAS_KEYS_SORTED = Object.keys(PROVINCE_MAP).sort((a, b) => b.length - a.length);

// Prepare Fuse.js data (secondary)
const fuseData = [
  ...Array.from(ALL_PROVINCES).map(p => ({ name: p, type: "province", value: p })),
  ...Object.entries(PROVINCE_MAP).map(([k, v]) => ({ name: k, type: v.granularity, value: v.canonical }))
];

const fuse = new Fuse(fuseData, {
  keys: ["name"],
  includeScore: true,
  threshold: 0.3,
  distance: 100,
});

/**
 * Extract locations from text and normalize to province names.
 * Uses a 3-phase approach:
 *   Phase 1: Substring scanning (handles Thai text without spaces)
 *   Phase 2: Token-based exact match (handles separated/comma input)
 *   Phase 3: Fuse.js fuzzy match (fallback for typos)
 * Returns unique list of provinces.
 */
export function resolveProvinces(text: string): string[] {
  const foundProvinces = new Set<string>();
  const norm = normalizeResolverText(text || "");
  const original = norm.original;
  const lowerText = norm.lower;

  const toNormalizedProvince = (p: string | undefined): string | null => {
    if (!p) return null;
    const trimmed = p.trim();
    if (!trimmed) return null;
    if (ALL_PROVINCES.has(trimmed)) return trimmed;
    return null;
  };

  // ─── Phase 0: Region Name Expansion ───
  for (const [regionName, provinceList] of REGION_PROVINCES) {
    if (original.includes(regionName)) {
      for (const p of provinceList) foundProvinces.add(p);
    }
  }
  if (foundProvinces.size > 0) {
    const resolved = finalizeResolved(foundProvinces);
    console.log(`[LocationResolver] resolvedProvinces=[${resolved.join(",")}] method=region`);
    return resolved;
  }

  // ─── Phase 1: Substring Scan (handles unsegmented Thai) ───
  let remaining = original;
  let remainingLower = lowerText;

  const replaceAll = (haystack: string, needle: string) => haystack.split(needle).join("░");

  for (const prov of PROVINCE_NAMES_SORTED) {
    if (remaining.includes(prov)) {
      const normalized = toNormalizedProvince(prov);
      if (normalized) foundProvinces.add(normalized);
      remaining = replaceAll(remaining, prov);
      remainingLower = replaceAll(remainingLower, prov.toLowerCase());
    }
  }

  for (const alias of ALIAS_KEYS_SORTED) {
    const isEnglish = /^[a-zA-Z]/.test(alias);
    const needle = isEnglish ? alias.toLowerCase() : alias;
    const haystack = isEnglish ? remainingLower : remaining;

    if (haystack.includes(needle)) {
      const mapped = toNormalizedProvince(PROVINCE_MAP[alias]?.canonical);
      if (mapped) foundProvinces.add(mapped);
      remaining = isEnglish ? remaining : replaceAll(remaining, needle);
      remainingLower = replaceAll(remainingLower, needle);
    }
  }

  if (foundProvinces.size > 0) {
    const resolved = finalizeResolved(foundProvinces);
    console.log(`[LocationResolver] resolvedProvinces=[${resolved.join(",")}] method=substring`);
    return resolved;
  }

  // ─── Phase 2: Token-based exact match ───
  const tokens = original
    .replace(/,|และ|กับ|ที่|ใน|จังหวัด|อำเภอ|เขต|แขวง|ตำบล|จ\.?\s*/g, " ")
    .split(/\s+/);

  for (const token of tokens) {
    const cleanToken = token.trim();
    if (cleanToken.length < 2) continue;

    if (BKK_DISTRICTS.has(cleanToken)) {
      foundProvinces.add("กรุงเทพมหานคร");
      continue;
    }

    if (ALL_PROVINCES.has(cleanToken)) {
      foundProvinces.add(cleanToken);
      continue;
    }
    if (PROVINCE_MAP[cleanToken]) {
      const mapped = toNormalizedProvince(PROVINCE_MAP[cleanToken]?.canonical);
      if (mapped) foundProvinces.add(mapped);
      continue;
    }
  }

  if (foundProvinces.size > 0) {
    const resolved = finalizeResolved(foundProvinces);
    console.log(`[LocationResolver] resolvedProvinces=[${resolved.join(",")}] method=token`);
    return resolved;
  }

  // ─── Phase 3: Fuzzy Match (Fuse.js) ───
  for (const token of tokens) {
    const cleanToken = token.trim();
    if (cleanToken.length < 3) continue;

    try {
      const searchResults = fuse.search(cleanToken);
      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        if (bestMatch.score !== undefined && bestMatch.score < 0.3) {
          const mapped = toNormalizedProvince(bestMatch.item.value);
          if (mapped) foundProvinces.add(mapped);
        }
      }
    } catch {
      // Ignore fuse errors
    }
  }

  if (foundProvinces.size > 0) {
    const resolved = finalizeResolved(foundProvinces);
    console.log(`[LocationResolver] resolvedProvinces=[${resolved.join(",")}] method=fuzzy`);
    return resolved;
  }

  console.log(`[LocationResolver] resolvedProvinces=[] method=none`);
  return [];
}

/**
 * Structured location resolution with confidence scores
 */
export function resolveLocationsStructured(text: string): StructuredLocationResult[] {
  const results: StructuredLocationResult[] = [];
  const norm = normalizeResolverText(text || "");
  const original = norm.original;

  // Track which parts we've processed
  const processed = new Set<string>();

  // Helper to check if already processed
  const isProcessed = (entity: string) => {
    return Array.from(processed).some((p) =>
      original.includes(p) && entity.includes(p)
    );
  };

  // ─── Phase 1: Substring Scan with structured info ───
  for (const alias of ALIAS_KEYS_SORTED) {
    if (original.includes(alias) && !isProcessed(alias)) {
      const mapping = PROVINCE_MAP[alias];
      if (mapping) {
        results.push({
          originalEntity: alias,
          canonicalProvince: mapping.canonical,
          granularity: mapping.granularity,
          confidence: mapping.confidence,
          displayLabel: mapping.displayLabel,
          aliases: mapping.aliases,
        });
        processed.add(alias);
      }
    }
  }

  // ─── Phase 2: Province substring scan ───
  for (const prov of PROVINCE_NAMES_SORTED) {
    if (original.includes(prov) && !processed.has(prov)) {
      results.push({
        originalEntity: prov,
        canonicalProvince: prov,
        granularity: "province",
        confidence: 0.95,
        displayLabel: prov,
      });
      processed.add(prov);
    }
  }

  // ─── Phase 3: Token matching for remaining ───
  const tokens = original
    .replace(/,|และ|กับ|ที่|ใน|จังหวัด|อำเภอ|เขต|แขวง|ตำบล|จ\.?\s*/g, " ")
    .split(/\s+/);

  for (const token of tokens) {
    const cleanToken = token.trim();
    if (cleanToken.length < 2) continue;
    if (processed.has(cleanToken)) continue;

    if (BKK_DISTRICTS.has(cleanToken)) {
      results.push({
        originalEntity: cleanToken,
        canonicalProvince: "กรุงเทพมหานคร",
        granularity: "district",
        confidence: 0.95,
        displayLabel: `${cleanToken} (กรุงเทพ)`,
      });
      processed.add(cleanToken);
      continue;
    }

    if (ALL_PROVINCES.has(cleanToken)) {
      results.push({
        originalEntity: cleanToken,
        canonicalProvince: cleanToken,
        granularity: "province",
        confidence: 0.95,
        displayLabel: cleanToken,
      });
      processed.add(cleanToken);
    }
  }

  return results;
}

/**
 * Get normalized province name or null
 */
export function mapToProvinceThai(location: string): string | null {
  const provinces = resolveProvinces(location);
  return provinces.length > 0 ? provinces[0] : null;
}

/**
 * Check if location is a district-level entity
 */
export function isDistrictLevel(entity: string): boolean {
  const mapping = PROVINCE_MAP[entity];
  return mapping?.granularity === "district" || false;
}

/**
 * Get display label for a location entity
 */
export function getLocationDisplayLabel(entity: string): string {
  const mapping = PROVINCE_MAP[entity];
  return mapping?.displayLabel || entity;
}

import Fuse from "fuse.js";

function normalizeResolverText(input: string): { original: string; lower: string } {
  const s = (input || "")
    .normalize("NFKC")
    // zero-width & BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // common punctuation → spaces (keep Thai letters)
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[\(\)\[\]{}<>"'`~!@#$%^&*_+=|\\:;?/.,，、。·•]/g, " ")
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

// 🇹🇭 Mapping: Alias/District -> Province
const PROVINCE_MAP: Record<string, string> = {
  // Cities / Districts
  "หาดใหญ่": "สงขลา",
  "พัทยา": "ชลบุรี",
  "ศรีราชา": "ชลบุรี",
  "สัตหีบ": "ชลบุรี",
  "บางละมุง": "ชลบุรี",
  "ปากเกร็ด": "นนทบุรี",
  "บางบัวทอง": "นนทบุรี",
  "ธนบุรี": "กรุงเทพมหานคร",
  "รังสิต": "ปทุมธานี",
  "ลำลูกกา": "ปทุมธานี",
  "คลองหลวง": "ปทุมธานี",
  "ธัญบุรี": "ปทุมธานี",
  "บางซื่อ": "กรุงเทพมหานคร",
  "บางกะปิ": "กรุงเทพมหานคร",
  "บางนา": "กรุงเทพมหานคร",
  "ลาดพร้าว": "กรุงเทพมหานคร",
  "จตุจักร": "กรุงเทพมหานคร",
  "พระนคร": "กรุงเทพมหานคร",
  "สายไหม": "กรุงเทพมหานคร",
  "ลาดกระบัง": "กรุงเทพมหานคร",
  "ดอนเมือง": "กรุงเทพมหานคร",
  "หลักสี่": "กรุงเทพมหานคร",
  "พญาไท": "กรุงเทพมหานคร",
  "ดินแดง": "กรุงเทพมหานคร",
  "ห้วยขวาง": "กรุงเทพมหานคร",
  "หัวหิน": "ประจวบคีรีขันธ์",
  "ปราณบุรี": "ประจวบคีรีขันธ์",
  "เกาะสมุย": "สุราษฎร์ธานี",
  "สมุย": "สุราษฎร์ธานี",
  "เกาะเต่า": "สุราษฎร์ธานี",
  "เกาะพะงัน": "สุราษฎร์ธานี",
  "เกาะล้าน": "ชลบุรี",
  "เกาะช้าง": "ตราด",
  "เกาะเสม็ด": "ระยอง",
  "สะเดา": "สงขลา",
  "เบตง": "ยะลา",
  "สุไหงโก-ลก": "นราธิวาส",
  "แม่สอด": "ตาก",
  "อุ้มผาง": "ตาก",
  "เชียงแสน": "เชียงราย",
  "แม่สาย": "เชียงราย",
  "แม่ริม": "เชียงใหม่",
  "ปาย": "แม่ฮ่องสอน",
  "สวนผึ้ง": "ราชบุรี",
  "ปากช่อง": "นครราชสีมา",
  "เขาใหญ่": "นครราชสีมา",
  "วังน้ำเขียว": "นครราชสีมา",
  "เมืองพล": "ขอนแก่น",
  "ทุ่งสง": "นครศรีธรรมราช",
  "ขนอม": "นครศรีธรรมราช",
  "แม่กลอง": "สมุทรสงคราม",
  "อัมพวา": "สมุทรสงคราม",
  "มหาชัย": "สมุทรสาคร",
  "กระทุ่มแบน": "สมุทรสาคร",

  // Colloquial / Short names
  "โคราช": "นครราชสีมา",
  "กทม": "กรุงเทพมหานคร",
  "กรุงเทพ": "กรุงเทพมหานคร",
  "บางกอก": "กรุงเทพมหานคร",
  "bangkok": "กรุงเทพมหานคร",
  "bkk": "กรุงเทพมหานคร",
  "korat": "นครราชสีมา",
  "chiangmai": "เชียงใหม่",
  "chiang mai": "เชียงใหม่",
  "chiangrai": "เชียงราย",
  "chiang rai": "เชียงราย",
  "phuket": "ภูเก็ต",
  "ภูเก็จ": "ภูเก็ต",
  "ภูเกตุ": "ภูเก็ต",
  "pattaya": "ชลบุรี",
  "อุบล": "อุบลราชธานี",
  "อุดร": "อุดรธานี",
  "hat yai": "สงขลา",
  "hatyai": "สงขลา",
  "samui": "สุราษฎร์ธานี",
  "แปดริ้ว": "ฉะเชิงเทรา",
  "เมืองกาญ": "กาญจนบุรี",
  "เมืองคอน": "นครศรีธรรมราช",
  "สป": "สมุทรปราการ",
  "ยุดยา": "พระนครศรีอยุธยา",
  "อยุธยา": "พระนครศรีอยุธยา",
};

// 🇹🇭 Region → representative provinces (for region-level weather queries)
// Order: longer / more-specific keys first so substring checks work correctly
const REGION_PROVINCES: [string, string[]][] = [
  ["ภาคตะวันออกเฉียงเหนือ", ["ขอนแก่น", "นครราชสีมา", "อุดรธานี", "อุบลราชธานี"]],
  ["ภาคใต้ฝั่งอ่าวไทย",    ["สุราษฎร์ธานี", "นครศรีธรรมราช", "สงขลา"]],
  ["ภาคใต้ฝั่งอันดามัน",   ["ภูเก็ต", "กระบี่", "พังงา"]],
  ["ภาคตะวันออก",          ["ชลบุรี", "ระยอง", "จันทบุรี"]],
  ["ภาคตะวันตก",           ["กาญจนบุรี", "ราชบุรี", "เพชรบุรี"]],
  ["ภาคกลาง",              ["กรุงเทพมหานคร", "นครสวรรค์", "สุพรรณบุรี", "นนทบุรี"]],
  ["ภาคเหนือ",             ["เชียงใหม่", "เชียงราย", "พิษณุโลก", "ลำปาง"]],
  ["ภาคอีสาน",             ["ขอนแก่น", "นครราชสีมา", "อุดรธานี", "อุบลราชธานี"]],
  ["ภาคใต้",               ["สุราษฎร์ธานี", "ภูเก็ต", "นครศรีธรรมราช", "สงขลา"]],
  ["อีสาน",                ["ขอนแก่น", "นครราชสีมา", "อุดรธานี"]],
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
// Sort by length DESC so longer names match first
// (prevents "เชียง" matching before "เชียงใหม่")
// ──────────────────────────────────────────────
const PROVINCE_NAMES_SORTED = Array.from(ALL_PROVINCES).sort((a, b) => b.length - a.length);
const ALIAS_KEYS_SORTED = Object.keys(PROVINCE_MAP).sort((a, b) => b.length - a.length);

// Prepare Fuse.js data (secondary)
const fuseData = [
  ...Array.from(ALL_PROVINCES).map(p => ({ name: p, type: 'province', value: p })),
  ...Object.entries(PROVINCE_MAP).map(([k, v]) => ({ name: k, type: 'district', value: v }))
];

const fuse = new Fuse(fuseData, {
  keys: ['name'],
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
  // Check longer/more-specific keys first (array order is specific→general)
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
  // Scan for province names + aliases embedded in the text (longest first)
  let remaining = original;
  let remainingLower = lowerText;

  const replaceAll = (haystack: string, needle: string) => haystack.split(needle).join("░");

  for (const prov of PROVINCE_NAMES_SORTED) {
    if (remaining.includes(prov)) {
      const normalized = toNormalizedProvince(prov);
      if (normalized) foundProvinces.add(normalized);
      remaining = replaceAll(remaining, prov);
      // keep lower in sync to avoid english alias matching inside replaced spans
      remainingLower = replaceAll(remainingLower, prov.toLowerCase());
    }
  }

  for (const alias of ALIAS_KEYS_SORTED) {
    const isEnglish = /^[a-zA-Z]/.test(alias);
    const needle = isEnglish ? alias.toLowerCase() : alias;
    const haystack = isEnglish ? remainingLower : remaining;

    if (haystack.includes(needle)) {
      const mapped = toNormalizedProvince(PROVINCE_MAP[alias]);
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

  // ─── Phase 2: Token-based exact match (for tokenized/comma input) ───
  const tokens = original
    .replace(/,|และ|กับ|ที่|ใน|จังหวัด|อำเภอ|เขต|แขวง|ตำบล|จ\.?\s*/g, " ")
    .split(/\s+/);

  for (const token of tokens) {
    const cleanToken = token.trim();
    if (cleanToken.length < 2) continue;

    // Bangkok district hardening: district-only queries must resolve to กรุงเทพมหานคร.
    if (BKK_DISTRICTS.has(cleanToken)) {
      foundProvinces.add("กรุงเทพมหานคร");
      continue;
    }

    if (ALL_PROVINCES.has(cleanToken)) {
      foundProvinces.add(cleanToken);
      continue;
    }
    if (PROVINCE_MAP[cleanToken]) {
      const mapped = toNormalizedProvince(PROVINCE_MAP[cleanToken]);
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
 * Get normalized province name or null
 */
export function mapToProvinceThai(location: string): string | null {
  const provinces = resolveProvinces(location);
  return provinces.length > 0 ? provinces[0] : null;
}

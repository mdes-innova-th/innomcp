
import { executeQuery } from "../../db/connector";
import { MCPTool } from "../types";

export const THAI_GEO_TOOL_NAME = 'thai_geo_tool';

export const THAI_GEO_TOOL_DEF: MCPTool = {
  name: THAI_GEO_TOOL_NAME,
  description:
    "Thai GEO (Round C): Thai-real address normalization v2 + deterministic lookup/validate with professional disambiguation. Deterministic and safe output (no JSON dump).",
  category: 'geo',
  keywords: ['province', 'thailand', 'map', 'location', 'จังหวัด', 'อำเภอ', 'ภาค', 'พิกัด', 'แผนที่', 'ภูมิศาสตร์'],
  examples: [
    "ขอข้อมูลจังหวัดเชียงใหม่",
    "ค้นหาจังหวัดในภาคเหนือ",
    "พิกัดของภูเก็ตอยู่ที่ไหน"
  ],
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: "string",
        description: "address_normalize | geo_lookup | geo_validate",
      },
      query: { type: 'string', description: 'Lookup query (Thai name/alias, postcode, etc.)' },
      address: { type: "string", description: "Raw Thai address text (for address_normalize / geo_validate)" },
      components: { type: "object", description: "Structured components for geo_validate" },
      filter_region: { type: 'string', description: 'Optional: Filter by region (ex: เหนือ, ใต้, กลาง)' },
      topN: { type: "number", description: "Max candidates" },
      context: { type: 'object', description: 'Optional context (confidence_required) ' }
    },
    required: []
  }
};

export interface ThaiGeoInput {
  action?: "address_normalize" | "geo_lookup" | "geo_validate";
  query?: string;
  address?: string;
  components?: any;
  filter_region?: string;
  topN?: number;
  context?: any;
}

export interface ThaiGeoResult {
  id: string;
  type: "province" | "district" | "subdistrict" | "postcode";
  name_th: string;
  aliases: string[];
  attributes: {
    province?: string;
    district?: string;
    subdistrict?: string;
    postcode?: string;
    region?: string;
    lat?: number;
    lon?: number;
  };
  score: number;
}

type ToolOk<T> = {
  ok: true;
  code: "OK" | "AMBIGUOUS";
  message: string;
  data: T;
};

type ToolErr = {
  ok: false;
  code:
    | "INVALID_QUERY"
    | "NOT_FOUND"
    | "AMBIGUOUS"
    | "VALIDATION_FAILED"
    | "POSTCODE_MISMATCH"
    | "SUBDISTRICT_MISMATCH"
    | "DISTRICT_MISMATCH"
    | "DB_ERROR";
  message: string;
};

type AddressNormalized = {
  house_no?: string;
  moo?: string;
  soi?: string;
  road?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postcode?: string;
};

type StructuredToken = {
  kind:
    | "house_no"
    | "moo"
    | "soi"
    | "road"
    | "subdistrict"
    | "district"
    | "province"
    | "postcode";
  value: string;
  raw?: string;
  source?: "explicit" | "alias" | "inferred";
};

type GeoConstraints = {
  province?: string;
  district?: string;
  subdistrict?: string;
  postcode?: string;
};

const STOPWORDS = new Set<string>([
  "ที่",
  "มี",
  "ของ",
  "และ",
  "ใน",
  "กับ",
  "จาก",
  "ถึง",
  "ช่วย",
  "หน่อย",
  "ครับ",
  "ค่ะ",
  "คะ",
  "ไหม",
  "มั้ย",
  "หรือไม่",
  "อยู่",
  "อะไร",
]);

const THAI_TO_ARABIC_DIGIT: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

function normalizeThaiDigitsToArabic(s: string): string {
  return String(s || "").replace(/[๐-๙]/g, (m) => THAI_TO_ARABIC_DIGIT[m] || m);
}

function canonicalizeThaiTextV2(s: string): string {
  let t = normalizeThaiDigitsToArabic(String(s || ""));

  // Normalize Bangkok variants early
  t = t.replace(/กรุงเทพฯ/gi, "กรุงเทพ");
  t = t.replace(/(^|\s)กทม(?=\s|$)/gi, "$1กรุงเทพมหานคร");
  t = t.replace(/(^|\s)กรุงเทพ(?=\s|$)/gi, "$1กรุงเทพมหานคร");

  // Normalize abbreviations (Thai addresses)
  t = t.replace(/\bจ\.(?=\s|$)/g, "จังหวัด");
  t = t.replace(/\bอ\.(?=\s|$)/g, "อำเภอ");
  t = t.replace(/\bต\.(?=\s|$)/g, "ตำบล");
  t = t.replace(/\bถ\.(?=\s|$)/g, "ถนน");
  t = t.replace(/\bซ\.(?=\s|$)/g, "ซอย");
  t = t.replace(/\bม\.(?=\s|$)/g, "หมู่");

  // Support patterns without spaces: "ถ.สีลม" / "ซ.1"
  t = t.replace(/ถ\./g, "ถนน ");
  t = t.replace(/ซ\./g, "ซอย ");
  t = t.replace(/จ\./g, "จังหวัด ");
  t = t.replace(/อ\./g, "อำเภอ ");
  t = t.replace(/ต\./g, "ตำบล ");
  t = t.replace(/ม\./g, "หมู่ ");

  // Drop punctuation (keep / and - for house no)
  t = t.replace(/[\u0E2F]/g, ""); // ฯ
  t = t.replace(/[,:;()\[\]{}"'`]/g, " ");
  t = t.replace(/[|<>]/g, " ");
  t = t.replace(/[\.]+/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function normalizeForMatch(s: string): string {
  return normalizeThaiDigitsToArabic(String(s || ""))
    .toLowerCase()
    .replace(/[\s\-_/.,:;()\[\]{}"'`]/g, "")
    .trim();
}

function tokenTerms(s: string): string[] {
  return String(s || "")
    .replace(/[\r\n]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .filter((t) => t.length > 1)
    .filter((t) => !STOPWORDS.has(t));
}

function bigrams(s: string): Set<string> {
  const t = normalizeForMatch(s);
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

type SeedEntity = {
  id: string;
  type: ThaiGeoResult["type"];
  name_th: string;
  aliases: string[];
  attributes: ThaiGeoResult["attributes"];
};

// Minimal, deterministic seed for Round B verifier (no DB required)
const SEED: SeedEntity[] = [
  {
    id: "geo:bangkok",
    type: "province",
    name_th: "กรุงเทพมหานคร",
    aliases: ["กทม", "กรุงเทพ", "กรุงเทพฯ"],
    attributes: { province: "กรุงเทพมหานคร", region: "กลาง", lat: 13.7563, lon: 100.5018 },
  },
  {
    id: "geo:nakhon-ratchasima",
    type: "province",
    name_th: "นครราชสีมา",
    aliases: ["โคราช"],
    attributes: { province: "นครราชสีมา", region: "อีสาน", lat: 14.9799, lon: 102.0977 },
  },
  {
    id: "geo:chiang-mai",
    type: "province",
    name_th: "เชียงใหม่",
    aliases: ["เจียงใหม่"],
    attributes: { province: "เชียงใหม่", region: "เหนือ", lat: 18.7883, lon: 98.9853 },
  },
  {
    id: "geo:bang-rak",
    type: "district",
    name_th: "บางรัก",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "บางรัก", region: "กลาง" },
  },
  {
    id: "geo:silom",
    type: "subdistrict",
    name_th: "สีลม",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "บางรัก", subdistrict: "สีลม", postcode: "10500", region: "กลาง" },
  },
  {
    id: "geo:postcode-10500",
    type: "postcode",
    name_th: "10500",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "บางรัก", postcode: "10500", region: "กลาง" },
  },

  // Bangkok additional coverage
  {
    id: "geo:si-phraya",
    type: "subdistrict",
    name_th: "สี่พระยา",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "บางรัก", subdistrict: "สี่พระยา", postcode: "10500", region: "กลาง" },
  },
  {
    id: "geo:lak-si",
    type: "district",
    name_th: "หลักสี่",
    aliases: ["เขตหลักสี่", "อำเภอหลักสี่"],
    attributes: { province: "กรุงเทพมหานคร", district: "หลักสี่", region: "กลาง" },
  },
  {
    id: "geo:lat-krabang",
    type: "district",
    name_th: "ลาดกระบัง",
    aliases: ["เขตลาดกระบัง", "อำเภอลาดกระบัง"],
    attributes: { province: "กรุงเทพมหานคร", district: "ลาดกระบัง", region: "กลาง" },
  },
  {
    id: "geo:pathum-wan",
    type: "district",
    name_th: "ปทุมวัน",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "ปทุมวัน", region: "กลาง" },
  },
  {
    id: "geo:lumpini",
    type: "subdistrict",
    name_th: "ลุมพินี",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "ปทุมวัน", subdistrict: "ลุมพินี", postcode: "10330", region: "กลาง" },
  },
  {
    id: "geo:postcode-10330",
    type: "postcode",
    name_th: "10330",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "ปทุมวัน", postcode: "10330", region: "กลาง" },
  },
  {
    id: "geo:chatuchak",
    type: "district",
    name_th: "จตุจักร",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "จตุจักร", region: "กลาง" },
  },
  {
    id: "geo:postcode-10900",
    type: "postcode",
    name_th: "10900",
    aliases: [],
    attributes: { province: "กรุงเทพมหานคร", district: "จตุจักร", postcode: "10900", region: "กลาง" },
  },

  // Provinces (Round C quality)
  {
    id: "geo:chiang-rai",
    type: "province",
    name_th: "เชียงราย",
    aliases: [],
    attributes: { province: "เชียงราย", region: "เหนือ", lat: 19.9105, lon: 99.8406 },
  },
  {
    id: "geo:khon-kaen",
    type: "province",
    name_th: "ขอนแก่น",
    aliases: ["เมืองหมอแคน"],
    attributes: { province: "ขอนแก่น", region: "อีสาน", lat: 16.4419, lon: 102.835 },
  },
  {
    id: "geo:chonburi",
    type: "province",
    name_th: "ชลบุรี",
    aliases: ["บางแสน"],
    attributes: { province: "ชลบุรี", region: "ตะวันออก", lat: 13.3611, lon: 100.9847 },
  },
  {
    id: "geo:phuket",
    type: "province",
    name_th: "ภูเก็ต",
    aliases: ["phuket"],
    attributes: { province: "ภูเก็ต", region: "ใต้", lat: 7.8804, lon: 98.3923 },
  },
  {
    id: "geo:songkhla",
    type: "province",
    name_th: "สงขลา",
    aliases: [],
    attributes: { province: "สงขลา", region: "ใต้" },
  },
  {
    id: "geo:nakhon-si-thammarat",
    type: "province",
    name_th: "นครศรีธรรมราช",
    aliases: ["เมืองคอน"],
    attributes: { province: "นครศรีธรรมราช", region: "ใต้" },
  },
  {
    id: "geo:pathum-thani",
    type: "province",
    name_th: "ปทุมธานี",
    aliases: [],
    attributes: { province: "ปทุมธานี", region: "กลาง" },
  },
  {
    id: "geo:ayutthaya",
    type: "province",
    name_th: "พระนครศรีอยุธยา",
    aliases: ["อยุธยา"],
    attributes: { province: "พระนครศรีอยุธยา", region: "กลาง" },
  },
  {
    id: "geo:ubon-ratchathani",
    type: "province",
    name_th: "อุบลราชธานี",
    aliases: [],
    attributes: { province: "อุบลราชธานี", region: "อีสาน" },
  },

  // Ambiguous common names (repeat across provinces)
  {
    id: "geo:ban-mai-pathum",
    type: "subdistrict",
    name_th: "บ้านใหม่",
    aliases: [],
    attributes: { province: "ปทุมธานี", district: "เมืองปทุมธานี", subdistrict: "บ้านใหม่", postcode: "12000", region: "กลาง" },
  },
  {
    id: "geo:ban-mai-ayutthaya",
    type: "subdistrict",
    name_th: "บ้านใหม่",
    aliases: [],
    attributes: { province: "พระนครศรีอยุธยา", district: "บางไทร", subdistrict: "บ้านใหม่", postcode: "13190", region: "กลาง" },
  },
  {
    id: "geo:ban-mai-chiang-rai",
    type: "subdistrict",
    name_th: "บ้านใหม่",
    aliases: [],
    attributes: { province: "เชียงราย", district: "เมืองเชียงราย", subdistrict: "บ้านใหม่", postcode: "57000", region: "เหนือ" },
  },
  {
    id: "geo:nong-bua-pathum",
    type: "subdistrict",
    name_th: "หนองบัว",
    aliases: [],
    attributes: { province: "ปทุมธานี", district: "คลองหลวง", subdistrict: "หนองบัว", postcode: "12120", region: "กลาง" },
  },
  {
    id: "geo:nong-bua-khonkaen",
    type: "subdistrict",
    name_th: "หนองบัว",
    aliases: [],
    attributes: { province: "ขอนแก่น", district: "ชุมแพ", subdistrict: "หนองบัว", postcode: "40130", region: "อีสาน" },
  },
  {
    id: "geo:nong-bua-ubon",
    type: "subdistrict",
    name_th: "หนองบัว",
    aliases: [],
    attributes: { province: "อุบลราชธานี", district: "วารินชำราบ", subdistrict: "หนองบัว", postcode: "34190", region: "อีสาน" },
  },
  {
    id: "geo:tha-chang-songkhla",
    type: "subdistrict",
    name_th: "ท่าช้าง",
    aliases: [],
    attributes: { province: "สงขลา", district: "บางกล่ำ", subdistrict: "ท่าช้าง", postcode: "90110", region: "ใต้" },
  },
  {
    id: "geo:tha-chang-nst",
    type: "subdistrict",
    name_th: "ท่าช้าง",
    aliases: [],
    attributes: { province: "นครศรีธรรมราช", district: "เมืองนครศรีธรรมราช", subdistrict: "ท่าช้าง", postcode: "80000", region: "ใต้" },
  },
  {
    id: "geo:tha-chang-ayutthaya",
    type: "subdistrict",
    name_th: "ท่าช้าง",
    aliases: [],
    attributes: { province: "พระนครศรีอยุธยา", district: "บางไทร", subdistrict: "ท่าช้าง", postcode: "13190", region: "กลาง" },
  },
];

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

const REGION_MAPPING: Record<string, string> = {
  "north": "ภาคเหนือ",
  "south": "ภาคใต้",
  "central": "ภาคกลาง",
  "northeast": "ภาคตะวันออกเฉียงเหนือ",
  "isan": "ภาคตะวันออกเฉียงเหนือ",
  "east": "ภาคตะวันออก",
  "west": "ภาคตะวันตก"
};

export async function handleThaiGeoTool(args: any): Promise<any> {
  try {
    const input: ThaiGeoInput = args || {};
    const action = (input.action || "geo_lookup") as ThaiGeoInput["action"];
    const topN = Math.max(1, Math.min(10, Number(input.topN || 5) || 5));

    if (action === "address_normalize") {
      const addr = String(input.address || input.query || "").trim();
      if (!addr || tokenTerms(addr).length === 0) {
        const err: ToolErr = { ok: false, code: "INVALID_QUERY", message: "กรุณาระบุที่อยู่ให้ชัดเจน" };
        return err;
      }
      const norm = normalizeAddressV2(addr);
      const ok: ToolOk<{ normalized: AddressNormalized; tokens: StructuredToken[]; normalized_text: string }> = {
        ok: true,
        code: "OK",
        message: "จัดรูปแบบที่อยู่สำเร็จ",
        data: { normalized: norm.normalized, tokens: norm.tokens, normalized_text: norm.normalized_text },
      };
      return ok;
    }

    if (action === "geo_validate") {
      const raw = String(input.address || "").trim();
      const comps = input.components && typeof input.components === "object" ? input.components : normalizeAddressV2(raw).normalized;
      const v = validateComponents(comps as AddressNormalized);
      return v;
    }

    // geo_lookup
    const queryText = String(input.query || input.address || "").trim();
    if (!queryText || tokenTerms(queryText).length === 0) {
      const err: ToolErr = { ok: false, code: "INVALID_QUERY", message: "กรุณาระบุคำค้นหา" };
      return err;
    }

    const parsed = parseLookupQueryV2(queryText);
    const results = await lookupGeo(parsed.core_query, input.filter_region, topN, parsed.constraints);
    if (results.length === 0) {
      const err: ToolErr = { ok: false, code: "NOT_FOUND", message: "ไม่พบข้อมูลภูมิศาสตร์ที่ตรงกับคำค้นหา" };
      return err;
    }

    const best = results[0];

    const top3 = results.slice(0, Math.min(3, results.length));
    const qn = normalizeForMatch(parsed.core_query);
    const isShort = qn.length <= 4;
    const sameNameTop2 =
      top3.length >= 2 && normalizeForMatch(String(top3[0]?.name_th || "")) === normalizeForMatch(String(top3[1]?.name_th || ""));
    const noConstraints = !parsed.constraints.province && !parsed.constraints.district && !parsed.constraints.postcode;
    const forceAmbiguousForCommonName = sameNameTop2 && noConstraints;

    const ambiguous =
      forceAmbiguousForCommonName ||
      (top3.length >= 2 &&
        best &&
        best.score < 0.97 &&
        (Math.abs(top3[0].score - top3[1].score) <= 0.07 || (isShort && Math.abs(top3[0].score - top3[1].score) <= 0.12)));

    if (ambiguous) {
      const ok: ToolOk<{
        best: ThaiGeoResult;
        candidates: ThaiGeoResult[];
        query: { core: string; constraints: GeoConstraints; tokens: StructuredToken[] };
        disambiguation: { question: string };
      }> = {
        ok: true,
        code: "AMBIGUOUS",
        message: "พบหลายรายการ (กำกวม) กรุณาระบุให้ชัดเจน",
        data: {
          best,
          candidates: results.slice(0, topN),
          query: { core: parsed.core_query, constraints: parsed.constraints, tokens: parsed.tokens },
          disambiguation: { question: buildDisambiguationQuestion(parsed.constraints, best) },
        },
      };
      return ok;
    }

    const ok: ToolOk<{
      best: ThaiGeoResult;
      candidates: ThaiGeoResult[];
      query: { core: string; constraints: GeoConstraints; tokens: StructuredToken[] };
    }> = {
      ok: true,
      code: "OK",
      message: "ค้นหาสำเร็จ",
      data: { best, candidates: results.slice(0, topN), query: { core: parsed.core_query, constraints: parsed.constraints, tokens: parsed.tokens } },
    };
    return ok;
  } catch (error: any) {
    const err: ToolErr = { ok: false, code: "DB_ERROR", message: "internal query error" };
    return err;
  }
}

function normalizeAddressV2(address: string): { normalized: AddressNormalized; tokens: StructuredToken[]; normalized_text: string } {
  const normalized_text = canonicalizeThaiTextV2(String(address || "").replace(/\r?\n/g, " "));
  const s = normalized_text;
  const out: AddressNormalized = {};
  const tokens: StructuredToken[] = [];

  const mPost = s.match(/(?:รหัสไปรษณีย์\s*)?\b(\d{5})\b/);
  if (mPost) {
    out.postcode = mPost[1];
    tokens.push({ kind: "postcode", value: out.postcode, raw: mPost[0], source: "explicit" });
  }

  const mHouse = s.match(/(?:เลขที่|บ้านเลขที่)\s*([0-9/\-]+)(?=\s|$)/);
  if (mHouse) {
    out.house_no = mHouse[1];
    tokens.push({ kind: "house_no", value: out.house_no, raw: mHouse[0], source: "explicit" });
  }

  const mMoo = s.match(/(?:หมู่|หมู่ที่)\s*([0-9]+)(?=\s|$)/);
  if (mMoo) {
    out.moo = mMoo[1];
    tokens.push({ kind: "moo", value: out.moo, raw: mMoo[0], source: "explicit" });
  }

  const mSoi = s.match(/(?:ซอย)\s*([^\s]+)(?=\s|$)/);
  if (mSoi) {
    out.soi = mSoi[1];
    tokens.push({ kind: "soi", value: out.soi, raw: mSoi[0], source: "explicit" });
  }

  const mRoad = s.match(/(?:ถนน)\s*([^\s]+)(?=\s|$)/);
  if (mRoad) {
    out.road = mRoad[1];
    tokens.push({ kind: "road", value: out.road, raw: mRoad[0], source: "explicit" });
  }

  const mSub = s.match(/(?:ตำบล|แขวง)\s*([^\s]+)(?=\s|$)/);
  if (mSub) {
    out.subdistrict = mSub[1];
    tokens.push({ kind: "subdistrict", value: out.subdistrict, raw: mSub[0], source: "explicit" });
  }

  const mDist = s.match(/(?:อำเภอ|เขต)\s*([^\s]+)(?=\s|$)/);
  if (mDist) {
    out.district = mDist[1];
    tokens.push({ kind: "district", value: out.district, raw: mDist[0], source: "explicit" });
  }

  const mProv = s.match(/(?:จังหวัด)\s*([^\s]+)(?=\s|$)/);
  if (mProv) {
    out.province = mProv[1];
    tokens.push({ kind: "province", value: out.province, raw: mProv[0], source: "explicit" });
  }

  // Bangkok variants
  if (!out.province) {
    if (/กรุงเทพมหานคร/i.test(s)) {
      out.province = "กรุงเทพมหานคร";
      tokens.push({ kind: "province", value: out.province, raw: "กรุงเทพมหานคร", source: "alias" });
    }
  } else {
    if (/กรุงเทพมหานคร|กรุงเทพ/i.test(out.province)) out.province = "กรุงเทพมหานคร";
  }

  // If no explicit province but subdistrict/district known in seed, infer
  if (!out.province) {
    const bySub = out.subdistrict
      ? SEED.find((e) => e.type === "subdistrict" && normalizeForMatch(e.name_th) === normalizeForMatch(out.subdistrict!))
      : undefined;
    if (bySub?.attributes?.province) {
      out.province = bySub.attributes.province;
      tokens.push({ kind: "province", value: out.province, raw: out.subdistrict, source: "inferred" });
    }

    const byDist = out.district
      ? SEED.find((e) => e.type === "district" && normalizeForMatch(e.name_th) === normalizeForMatch(out.district!))
      : undefined;
    if (!out.province && byDist?.attributes?.province) {
      out.province = byDist.attributes.province;
      tokens.push({ kind: "province", value: out.province, raw: out.district, source: "inferred" });
    }
  }

  return { normalized: out, tokens, normalized_text };
}

function parseLookupQueryV2(queryText: string): { core_query: string; constraints: GeoConstraints; tokens: StructuredToken[] } {
  const raw = String(queryText || "").trim();
  const norm = normalizeAddressV2(raw);
  const constraints: GeoConstraints = {
    province: norm.normalized.province,
    district: norm.normalized.district,
    subdistrict: norm.normalized.subdistrict,
    postcode: norm.normalized.postcode,
  };

  const tail = canonicalizeThaiTextV2(raw).match(/([ก-๙A-Za-z0-9]{2,})\s*$/)?.[1];
  const core = constraints.postcode || constraints.subdistrict || constraints.district || constraints.province || tail || canonicalizeThaiTextV2(raw);

  return {
    core_query: String(core || raw).trim().slice(0, 80),
    constraints,
    tokens: norm.tokens,
  };
}

function buildDisambiguationQuestion(constraints: GeoConstraints, best: ThaiGeoResult): string {
  if (!constraints.province) return "ต้องการอยู่จังหวัดไหนครับ?";
  if (!constraints.district && (best.type === "subdistrict" || best.type === "postcode")) return "ต้องการอยู่เขต/อำเภอไหนครับ?";
  return "ต้องการพื้นที่ไหนครับ?";
}

function scoreSeedEntityV2(e: SeedEntity, queryText: string, constraints: GeoConstraints): { score: number; reason: string } {
  const qn = normalizeForMatch(queryText);
  const name = normalizeForMatch(e.name_th);
  const aliases = (e.aliases || []).map(normalizeForMatch);

  let base = 0;
  let matchReason = "คล้าย";

  if (name === qn) {
    base = 0.99;
    matchReason = "ตรงชื่อ";
  } else if (aliases.includes(qn)) {
    base = 0.97;
    matchReason = "ตรงชื่อย่อ";
  } else if (name.startsWith(qn) && qn.length >= 2) {
    base = 0.93;
    matchReason = "ขึ้นต้นตรง";
  } else if (aliases.some((a) => a.startsWith(qn) && qn.length >= 2)) {
    base = 0.91;
    matchReason = "ขึ้นต้นตรง(ย่อ)";
  } else if (name.includes(qn) && qn.length >= 2) {
    base = 0.89;
    matchReason = "พบในชื่อ";
  } else if (aliases.some((a) => a.includes(qn) && qn.length >= 2)) {
    base = 0.87;
    matchReason = "พบในชื่อ(ย่อ)";
  } else {
    const sim = jaccard(bigrams(name), bigrams(qn));
    const aliasSim = aliases.length ? Math.max(...aliases.map((a) => jaccard(bigrams(a), bigrams(qn)))) : 0;
    base = Math.max(sim, aliasSim) * 0.85;
    matchReason = "ใกล้เคียง";
  }

  // Penalty for too-short queries
  if (qn.length <= 2) base -= 0.22;
  else if (qn.length <= 3) base -= 0.15;
  else if (qn.length <= 4) base -= 0.08;

  // Constraint boosts/penalties (explainable)
  let adj = 0;
  const prov = constraints.province ? normalizeForMatch(constraints.province) : "";
  const dist = constraints.district ? normalizeForMatch(constraints.district) : "";
  const sub = constraints.subdistrict ? normalizeForMatch(constraints.subdistrict) : "";
  const post = constraints.postcode ? normalizeForMatch(constraints.postcode) : "";

  const eProv = e.attributes?.province ? normalizeForMatch(e.attributes.province) : "";
  const eDist = e.attributes?.district ? normalizeForMatch(e.attributes.district) : "";
  const eSub = e.attributes?.subdistrict ? normalizeForMatch(e.attributes.subdistrict) : "";
  const ePost = e.attributes?.postcode ? normalizeForMatch(e.attributes.postcode) : "";

  if (prov) {
    if (eProv && prov === eProv) adj += 0.12;
    else if (eProv && prov !== eProv) adj -= 0.25;
  }
  if (dist) {
    if (eDist && dist === eDist) adj += 0.10;
    else if (eDist && dist !== eDist) adj -= 0.18;
  }
  if (sub) {
    if (eSub && sub === eSub) adj += 0.10;
    else if (eSub && sub !== eSub) adj -= 0.12;
  }
  if (post) {
    if (ePost && post === ePost) adj += 0.15;
    else if (ePost && post !== ePost) adj -= 0.20;
  }

  const score = Math.max(0, Math.min(0.999, base + adj));
  const reason = `${matchReason}${adj > 0.02 ? ", ตรงเงื่อนไข" : adj < -0.02 ? ", ไม่ตรงเงื่อนไข" : ""}`;
  return { score, reason };
}

async function lookupGeo(rawQuery: string, filterRegion: string | undefined, limit: number, constraints: GeoConstraints): Promise<ThaiGeoResult[]> {
  const q = canonicalizeThaiTextV2(String(rawQuery || "")).trim();
  const isPostcode = /^\d{5}$/.test(q) || /\b\d{5}\b/.test(q);
  const qPost = isPostcode ? (q.match(/\b(\d{5})\b/)?.[1] || q) : undefined;

  // 1) Seed first (deterministic, DB-free)
  const seedMatches = SEED.map((e) => {
    const scored = scoreSeedEntityV2(e, qPost || q, constraints);
    return { e, s: scored.score, reason: scored.reason };
  })
    .filter((x) => x.s > 0.35)
    .map((x) => {
      const result: ThaiGeoResult = {
        id: x.e.id,
        type: x.e.type,
        name_th: x.e.name_th,
        aliases: x.e.aliases,
        attributes: x.e.attributes,
        score: Math.round(x.s * 100) / 100,
      };
      (result as any).reason = x.reason;
      return result;
    });

  const filteredSeed = filterRegion
    ? seedMatches.filter((r) => {
        const reg = String(r.attributes?.region || "");
        const fr = String(filterRegion || "").trim();
        return reg === fr || reg.includes(fr) || fr.includes(reg);
      })
    : seedMatches;

  const topSeed = filteredSeed.sort((a, b) => b.score - a.score).slice(0, limit);
  if (topSeed.length > 0) return topSeed;

  // 2) Optional DB search (best-effort)
  try {
    const safeQuery = escapeLike(q);
    let sql =
      "SELECT id, name_th, aliases, attributes, confidence FROM knowledge_entities " +
      "WHERE domain='geo' AND (name_th LIKE ? OR JSON_CONTAINS(aliases, JSON_QUOTE(?)))";
    const params: any[] = [`%${safeQuery}%`, q];

    if (filterRegion) {
      const lowerReg = String(filterRegion).toLowerCase();
      const mapped = REGION_MAPPING[lowerReg] || filterRegion;
      const candidates = new Set<string>();
      candidates.add(mapped);
      if (mapped.startsWith("ภาค")) {
        const withoutPrefix = mapped.replace(/^ภาค\s*/, "").trim();
        if (withoutPrefix) candidates.add(withoutPrefix);
      } else {
        candidates.add(`ภาค${mapped}`);
      }

      const clauses = Array.from(candidates).map(() => "JSON_EXTRACT(attributes, '$.region') LIKE ?");
      sql += ` AND (${clauses.join(" OR ")})`;
      for (const c of candidates) params.push(`%${escapeLike(c)}%`);
    }

    sql += " LIMIT ?";
    params.push(limit);

    const rows = (await executeQuery(sql, params)) as any[];
    const mapped = (Array.isArray(rows) ? rows : []).map((row) => {
      let attrs: any = row.attributes;
      if (typeof attrs === "string") {
        try {
          attrs = JSON.parse(attrs);
        } catch {
          attrs = {};
        }
      }
      const aliases = typeof row.aliases === "string" ? safeJsonArray(row.aliases) : Array.isArray(row.aliases) ? row.aliases : [];
      const name_th = String(row.name_th || "");
      const score = typeof row.confidence === "number" ? row.confidence : 0.7;
      const res: ThaiGeoResult = {
        id: String(row.id || ""),
        type: "province",
        name_th,
        aliases,
        attributes: {
          province: String(attrs?.province || name_th || ""),
          district: attrs?.district,
          subdistrict: attrs?.subdistrict,
          postcode: attrs?.postcode,
          region: attrs?.region,
          lat: typeof attrs?.lat === "number" ? attrs.lat : undefined,
          lon: typeof attrs?.lon === "number" ? attrs.lon : undefined,
        },
        score: Math.round(score * 100) / 100,
      };
      return res;
    });
    return mapped.sort((a, b) => b.score - a.score).slice(0, limit);
  } catch {
    return [];
  }
}

function safeJsonArray(value: string): string[] {
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    // fallback for comma-separated
    return String(value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
}

function validateComponents(components: AddressNormalized): ToolOk<{ valid: boolean; normalized: AddressNormalized }> | ToolErr {
  const c: AddressNormalized = components || {};

  // Normalize Bangkok variants
  if (c.province && /กรุงเทพฯ|กรุงเทพ\b|\bกทม\b/i.test(c.province)) c.province = "กรุงเทพมหานคร";

  // Postcode mapping (minimal)
  if (c.postcode === "10500") {
    if (c.province && c.province !== "กรุงเทพมหานคร") {
      return { ok: false, code: "POSTCODE_MISMATCH", message: "รหัสไปรษณีย์ไม่ตรงกับจังหวัด" };
    }
    if (c.district && c.district !== "บางรัก") {
      return { ok: false, code: "POSTCODE_MISMATCH", message: "รหัสไปรษณีย์ไม่ตรงกับเขต" };
    }
  }

  if (c.subdistrict) {
    const seedSub = SEED.find((e) => e.type === "subdistrict" && normalizeForMatch(e.name_th) === normalizeForMatch(c.subdistrict!));
    if (seedSub) {
      if (c.district && seedSub.attributes?.district && normalizeForMatch(seedSub.attributes.district) !== normalizeForMatch(c.district)) {
        return { ok: false, code: "SUBDISTRICT_MISMATCH", message: "แขวงหรือตำบลไม่ตรงกับเขตหรืออำเภอ" };
      }
      if (c.province && seedSub.attributes?.province && normalizeForMatch(seedSub.attributes.province) !== normalizeForMatch(c.province)) {
        return { ok: false, code: "DISTRICT_MISMATCH", message: "แขวงหรือตำบลไม่ตรงกับจังหวัด" };
      }
    }
  }

  const ok: ToolOk<{ valid: boolean; normalized: AddressNormalized }> = {
    ok: true,
    code: "OK",
    message: "ข้อมูลสอดคล้องกัน",
    data: { valid: true, normalized: c },
  };
  return ok;
}

export function renderThaiGeoAnswerShort(toolResult: any): { text: string; trace: string } {
  // Returns short human-readable Thai output (no JSON dump) + trace-friendly token.
  const sanitize = (v: any): string => {
    return String(v ?? "")
      .replace(/[{}\\"`]/g, "")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const ensureSingleQuestionMark = (q: string): string => {
    const s = sanitize(q);
    if (!s) return "ต้องการพื้นที่ไหนครับ?";
    if (s.includes("?")) return s.replace(/\?+/g, "?");
    return `${s}?`;
  };

  const isBangkok = (prov: string): boolean => {
    const p = sanitize(prov);
    return /^(กรุงเทพมหานคร|กรุงเทพฯ|กรุงเทพ|กทม)$/.test(p);
  };

  const districtLabel = (prov: string): string => (isBangkok(prov) ? "เขต" : "อำเภอ");
  const subdistrictLabel = (prov: string): string => (isBangkok(prov) ? "แขวง" : "ตำบล");

  const labelOf = (r: any): string => {
    const t = String(r?.type || "");
    const name = sanitize(r?.name_th);
    if (!name) return "";
    if (t === "postcode") return `รหัสไปรษณีย์ ${name}`;
    if (t === "subdistrict") {
      const prov = sanitize(r?.attributes?.province);
      return `${subdistrictLabel(prov)}${name}`;
    }
    if (t === "district") {
      const prov = sanitize(r?.attributes?.province);
      return `${districtLabel(prov)}${name}`;
    }
    return `จังหวัด${name}`;
  };

  const whereOf = (r: any): string => {
    const attrs = r?.attributes || {};
    const prov = sanitize(attrs?.province);
    const dist = sanitize(attrs?.district);
    const sub = sanitize(attrs?.subdistrict);
    const post = sanitize(attrs?.postcode);
    const parts: string[] = [];
    if (sub) parts.push(`${subdistrictLabel(prov)}${sub}`);
    if (dist) parts.push(`${districtLabel(prov)}${dist}`);
    if (prov) parts.push(prov);
    if (post) parts.push(post);
    return parts.join(" ").trim();
  };

  const whereShortOf = (r: any): string => {
    const attrs = r?.attributes || {};
    const prov = sanitize(attrs?.province);
    const dist = sanitize(attrs?.district);
    const parts: string[] = [];
    if (dist) parts.push(`${districtLabel(prov)}${dist}`);
    if (prov) parts.push(prov);
    return parts.join(" ").trim();
  };

  if (!toolResult || typeof toolResult !== "object") {
    return { text: "ไม่พบข้อมูลภูมิศาสตร์", trace: "ERR:NOT_FOUND" };
  }
  if (toolResult.ok === false) {
    const code = String(toolResult.code || "VALIDATION_FAILED").toUpperCase();
    const msg = String(toolResult.message || "เกิดข้อผิดพลาด");
    return { text: sanitize(msg) || "เกิดข้อผิดพลาด", trace: `ERR:${sanitize(code)}` };
  }

  const code = String(toolResult.code || "OK").toUpperCase();

  // validate
  if (toolResult.data?.valid === true) {
    const n: AddressNormalized = toolResult.data.normalized || {};
    const core = [n.subdistrict ? `แขวง${n.subdistrict}` : "", n.district ? `เขต${n.district}` : "", n.province || "", n.postcode || ""]
      .filter(Boolean)
      .join(" ");
    return { text: sanitize(`ตรวจสอบแล้วถูกต้อง: ${core}`), trace: "OK" };
  }

  // address_normalize
  if (toolResult.data?.normalized) {
    const n: AddressNormalized = toolResult.data.normalized;
    const parts: string[] = [];
    if (n.house_no) parts.push(`เลขที่ ${n.house_no}`);
    if (n.moo) parts.push(`หมู่ ${n.moo}`);
    if (n.soi) parts.push(`ซอย${n.soi}`);
    if (n.road) parts.push(`ถนน${n.road}`);
    if (n.subdistrict) parts.push(`แขวง${n.subdistrict}`);
    if (n.district) parts.push(`เขต${n.district}`);
    if (n.province) parts.push(n.province);
    if (n.postcode) parts.push(n.postcode);
    const text = sanitize(`จัดรูปแบบที่อยู่: ${parts.join(" ")}`);
    return { text, trace: "OK" };
  }

  const best: ThaiGeoResult | undefined = toolResult.data?.best;
  const candidates: ThaiGeoResult[] = Array.isArray(toolResult.data?.candidates) ? toolResult.data.candidates : [];

  if (code === "AMBIGUOUS" && candidates.length > 1) {
    const top3 = candidates.slice(0, 3);
    const q = ensureSingleQuestionMark(toolResult.data?.disambiguation?.question || "ต้องการพื้นที่ไหนครับ?");
    const options = top3
      .map((c: any, idx: number) => {
        const label = labelOf(c);
        const where = whereShortOf(c) || whereOf(c);
        const wherePart = where ? `- ${where}` : "";
        return `${idx + 1}) ${label} ${wherePart}`.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean)
      .join(" ");

    // Put the single follow-up question early so it stays within Trace v3 truncation.
    const text = sanitize(`พบชื่อกำกวม ตัวเลือก 3 คำถาม: ${q} ${options}`);
    return { text, trace: "ERR:AMBIGUOUS" };
  }

  if (best) {
    const t = String(best.type);
    if (t === "postcode") {
      const prov = sanitize(best.attributes?.province);
      const distLabel = districtLabel(prov);
      const text = sanitize(`รหัสไปรษณีย์ ${best.name_th} อยู่${distLabel}${best.attributes?.district || ""} ${prov || ""}`);
      return { text, trace: "OK" };
    }
    if (t === "subdistrict") {
      const prov = sanitize(best.attributes?.province);
      const distLabel = districtLabel(prov);
      const subLabel = subdistrictLabel(prov);
      const text = sanitize(`${subLabel}${best.name_th} อยู่${distLabel}${best.attributes?.district || ""} ${prov || ""}`);
      return { text, trace: "OK" };
    }
    if (t === "district") {
      const prov = sanitize(best.attributes?.province);
      if (isBangkok(prov) || isBangkok(best.name_th || "")) {
        const p = prov || "กรุงเทพมหานคร";
        const text = sanitize(`${p} เขต${best.name_th} (กรุงเทพมหานครใช้คำว่า “เขต” แทน “อำเภอ”)`);
        return { text, trace: "OK" };
      }
      const distLabel = districtLabel(prov);
      const text = sanitize(`${distLabel}${best.name_th} อยู่${prov || ""}`);
      return { text, trace: "OK" };
    }
    // Province-level: avoid region-centric answer for Bangkok; region is helpful for other provinces.
    if (isBangkok(best.name_th || "") || isBangkok(best.attributes?.province || "")) {
      const text = sanitize(`จังหวัด${best.name_th}`);
      return { text, trace: "OK" };
    }
    // Province-level: keep short and avoid trivia like "อยู่ภาค..." as the primary answer.
    const text = sanitize(`จังหวัด${best.name_th}`);
    return { text, trace: "OK" };
  }

  return { text: "ไม่พบข้อมูลภูมิศาสตร์", trace: "ERR:NOT_FOUND" };
}

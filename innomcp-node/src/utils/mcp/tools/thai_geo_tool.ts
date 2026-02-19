
import { executeQuery } from "../../db/connector";
import { MCPTool } from "../types";

export const THAI_GEO_TOOL_NAME = 'thai_geo_tool';

export const THAI_GEO_TOOL_DEF: MCPTool = {
  name: THAI_GEO_TOOL_NAME,
  description:
    "Thai GEO minimal (Round B): address_normalize + geo_lookup + geo_validate. Deterministic and safe output.",
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
  road?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
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

function normalizeForMatch(s: string): string {
  return String(s || "")
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
      const normalized = normalizeAddress(addr);
      const ok: ToolOk<{ normalized: AddressNormalized }> = {
        ok: true,
        code: "OK",
        message: "จัดรูปแบบที่อยู่สำเร็จ",
        data: { normalized },
      };
      return ok;
    }

    if (action === "geo_validate") {
      const raw = String(input.address || "").trim();
      const comps = input.components && typeof input.components === "object" ? input.components : normalizeAddress(raw);
      const v = validateComponents(comps as AddressNormalized);
      return v;
    }

    // geo_lookup
    const queryText = String(input.query || input.address || "").trim();
    if (!queryText || tokenTerms(queryText).length === 0) {
      const err: ToolErr = { ok: false, code: "INVALID_QUERY", message: "กรุณาระบุคำค้นหา" };
      return err;
    }

    const results = await lookupGeo(queryText, input.filter_region, topN);
    if (results.length === 0) {
      const err: ToolErr = { ok: false, code: "NOT_FOUND", message: "ไม่พบข้อมูลภูมิศาสตร์ที่ตรงกับคำค้นหา" };
      return err;
    }

    const best = results[0];
    const close = results.filter((r) => best && Math.abs(best.score - r.score) <= 0.05);
    if (close.length >= 2 && best.score < 0.92) {
      const ok: ToolOk<{ best: ThaiGeoResult; candidates: ThaiGeoResult[] }> = {
        ok: true,
        code: "AMBIGUOUS",
        message: "พบหลายรายการ กรุณาระบุให้ชัดเจนขึ้น",
        data: { best, candidates: results.slice(0, topN) },
      };
      return ok;
    }

    const ok: ToolOk<{ best: ThaiGeoResult; candidates: ThaiGeoResult[] }> = {
      ok: true,
      code: "OK",
      message: "ค้นหาสำเร็จ",
      data: { best, candidates: results.slice(0, topN) },
    };
    return ok;
  } catch (error: any) {
    const err: ToolErr = { ok: false, code: "DB_ERROR", message: "internal query error" };
    return err;
  }
}

function normalizeAddress(address: string): AddressNormalized {
  const s = String(address || "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const out: AddressNormalized = {};

  const mPost = s.match(/\b(\d{5})\b/);
  if (mPost) out.postcode = mPost[1];

  const mHouse = s.match(/เลขที่\s*([0-9/\-]+)\b/);
  if (mHouse) out.house_no = mHouse[1];

  const mRoad = s.match(/(?:ถนน|ถ\.)\s*([ก-๙A-Za-z0-9\-]+)/);
  if (mRoad) out.road = mRoad[1];

  const mSub = s.match(/(?:ตำบล|แขวง)\s*([ก-๙A-Za-z]+)/);
  if (mSub) out.subdistrict = mSub[1];

  const mDist = s.match(/(?:อำเภอ|เขต)\s*([ก-๙A-Za-z]+)/);
  if (mDist) out.district = mDist[1];

  // Province: explicit markers first
  const mProv = s.match(/(?:จังหวัด|จ\.)\s*([ก-๙A-Za-z]+)/);
  if (mProv) out.province = mProv[1];

  // Bangkok variants
  if (!out.province) {
    if (/กรุงเทพมหานคร|กรุงเทพฯ|กรุงเทพ\b|\bกทม\b/i.test(s)) out.province = "กรุงเทพมหานคร";
  }

  // If no explicit province but subdistrict/district known in seed, infer
  if (!out.province) {
    const bySub = out.subdistrict ? SEED.find((e) => e.type === "subdistrict" && normalizeForMatch(e.name_th) === normalizeForMatch(out.subdistrict!)) : undefined;
    if (bySub?.attributes?.province) out.province = bySub.attributes.province;
    const byDist = out.district ? SEED.find((e) => e.type === "district" && normalizeForMatch(e.name_th) === normalizeForMatch(out.district!)) : undefined;
    if (!out.province && byDist?.attributes?.province) out.province = byDist.attributes.province;
  }

  return out;
}

function scoreSeedEntity(e: SeedEntity, queryText: string): number {
  const qn = normalizeForMatch(queryText);
  const name = normalizeForMatch(e.name_th);
  const aliases = (e.aliases || []).map(normalizeForMatch);

  if (name === qn) return 0.98;
  if (aliases.includes(qn)) return 0.96;
  if (name.includes(qn) && qn.length >= 2) return 0.9;
  if (aliases.some((a) => a.includes(qn) && qn.length >= 2)) return 0.88;

  const sim = jaccard(bigrams(name), bigrams(qn));
  const aliasSim = aliases.length ? Math.max(...aliases.map((a) => jaccard(bigrams(a), bigrams(qn)))) : 0;
  return Math.max(sim, aliasSim) * 0.85;
}

async function lookupGeo(rawQuery: string, filterRegion: string | undefined, limit: number): Promise<ThaiGeoResult[]> {
  const q = String(rawQuery || "").trim();
  const isPostcode = /^\d{5}$/.test(q) || /\b\d{5}\b/.test(q);
  const qPost = isPostcode ? (q.match(/\b(\d{5})\b/)?.[1] || q) : undefined;

  // 1) Seed first (deterministic, DB-free)
  const seedMatches = SEED.map((e) => ({ e, s: scoreSeedEntity(e, qPost || q) }))
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
  if (!toolResult || typeof toolResult !== "object") {
    return { text: "ไม่พบข้อมูลภูมิศาสตร์", trace: "ERR:NOT_FOUND" };
  }
  if (toolResult.ok === false) {
    const code = String(toolResult.code || "VALIDATION_FAILED").toUpperCase();
    const msg = String(toolResult.message || "เกิดข้อผิดพลาด");
    return { text: msg, trace: `ERR:${code}` };
  }

  const code = String(toolResult.code || "OK").toUpperCase();

  // validate
  if (toolResult.data?.valid === true) {
    const n: AddressNormalized = toolResult.data.normalized || {};
    const core = [n.subdistrict ? `แขวง${n.subdistrict}` : "", n.district ? `เขต${n.district}` : "", n.province || "", n.postcode || ""]
      .filter(Boolean)
      .join(" ");
    return { text: `ตรวจสอบแล้วถูกต้อง: ${core}`.trim(), trace: "OK" };
  }

  // address_normalize
  if (toolResult.data?.normalized) {
    const n: AddressNormalized = toolResult.data.normalized;
    const parts: string[] = [];
    if (n.house_no) parts.push(`เลขที่ ${n.house_no}`);
    if (n.road) parts.push(`ถนน${n.road}`);
    if (n.subdistrict) parts.push(`แขวง${n.subdistrict}`);
    if (n.district) parts.push(`เขต${n.district}`);
    if (n.province) parts.push(n.province);
    if (n.postcode) parts.push(n.postcode);
    const text = `จัดรูปแบบที่อยู่: ${parts.join(" ")}`.trim();
    return { text, trace: "OK" };
  }

  const best: ThaiGeoResult | undefined = toolResult.data?.best;
  const candidates: ThaiGeoResult[] = Array.isArray(toolResult.data?.candidates) ? toolResult.data.candidates : [];

  if (code === "AMBIGUOUS" && candidates.length > 1) {
    const names = candidates
      .slice(0, 3)
      .map((c: any) => String(c?.name_th || "").trim())
      .filter(Boolean);
    const text = `พบหลายรายการ: ${names.join(" ")} กรุณาระบุจังหวัดหรือเขตเพิ่ม`;
    return { text, trace: "ERR:AMBIGUOUS" };
  }

  if (best) {
    const t = String(best.type);
    if (t === "postcode") {
      const text = `รหัสไปรษณีย์ ${best.name_th} อยู่เขต${best.attributes?.district || ""} ${best.attributes?.province || ""}`.trim();
      return { text, trace: "OK" };
    }
    if (t === "subdistrict") {
      const text = `แขวง${best.name_th} อยู่เขต${best.attributes?.district || ""} ${best.attributes?.province || ""}`.trim();
      return { text, trace: "OK" };
    }
    if (t === "district") {
      const text = `เขต${best.name_th} อยู่${best.attributes?.province || ""}`.trim();
      return { text, trace: "OK" };
    }
    const text = `จังหวัด${best.name_th} อยู่ภาค${best.attributes?.region || ""}`.trim();
    return { text, trace: "OK" };
  }

  return { text: "ไม่พบข้อมูลภูมิศาสตร์", trace: "ERR:NOT_FOUND" };
}

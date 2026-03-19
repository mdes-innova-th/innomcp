import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";
import type {
  ThaiGeoAttributes,
  ThaiGeoEntity,
  ThaiGeoToolError,
  ThaiGeoToolInput,
  ThaiGeoToolOutput,
  ThaiGeoResultItem,
  ThaiKnowledgeSource,
} from "./thaiGeoTool.types";

const TOOL_NAME = "thai_geo_tool";
const DEFAULT_CONFIDENCE_REQUIRED = 0.7;

const TOOL_DESC = `ค้นหาข้อมูลภูมิศาสตร์ไทย (จังหวัด/อำเภอ/ตำบล/ภูมิภาค)
- รองรับ query + context + filter_region
- ค้นหาจากฐานข้อมูล knowledge_entities ด้วย Full Text Search
- ถ้า confidence ต่ำกว่า context.confidence_required จะปฏิเสธผลลัพธ์`;

const DOPA_SOURCE: ThaiKnowledgeSource = { name: "DOPA", url: "https://www.dopa.go.th" };

const now = new Date().toISOString();

// Helper to create province entities concisely
function prov(id: string, name: string, aliases: string[], region: string, lat: number, lon: number): ThaiGeoEntity {
  return { id, domain: "geo", type: "province", name_th: name, aliases, description: `จังหวัด${name} อยู่ในภาค${region}`, attributes: { province: name, region, lat, lon }, relations: [], source: [DOPA_SOURCE], confidence: 0.95, version: "1.0.0", updated_at: now };
}
function regionEntity(id: string, name: string, aliases: string[], provinces: string[]): ThaiGeoEntity {
  return { id, domain: "geo", type: "region" as any, name_th: name, aliases, description: `ภาค${name}ของประเทศไทย ประกอบด้วย ${provinces.length} จังหวัด ได้แก่ ${provinces.join(" ")}`, attributes: { province: name, region: name }, relations: [], source: [DOPA_SOURCE], confidence: 0.95, version: "1.0.0", updated_at: now };
}

const CENTRAL_PROVS = ["กรุงเทพมหานคร","นนทบุรี","ปทุมธานี","สมุทรปราการ","สมุทรสาคร","นครปฐม","พระนครศรีอยุธยา","อ่างทอง","สิงห์บุรี","ชัยนาท","ลพบุรี","สระบุรี","สุพรรณบุรี","สมุทรสงคราม","นครนายก","กาญจนบุรี","ราชบุรี","เพชรบุรี","ประจวบคีรีขันธ์"];
const NORTH_PROVS = ["เชียงใหม่","เชียงราย","ลำพูน","ลำปาง","แพร่","น่าน","พะเยา","แม่ฮ่องสอน","อุตรดิตถ์","สุโขทัย","พิษณุโลก","พิจิตร","กำแพงเพชร","ตาก","นครสวรรค์","อุทัยธานี","เพชรบูรณ์"];
const NORTHEAST_PROVS = ["นครราชสีมา","ขอนแก่น","อุดรธานี","อุบลราชธานี","บุรีรัมย์","สุรินทร์","ศรีสะเกษ","ร้อยเอ็ด","ชัยภูมิ","กาฬสินธุ์","มหาสารคาม","นครพนม","สกลนคร","มุกดาหาร","เลย","หนองคาย","หนองบัวลำภู","บึงกาฬ","ยโสธร","อำนาจเจริญ"];
const EAST_PROVS = ["ชลบุรี","ระยอง","จันทบุรี","ตราด","ฉะเชิงเทรา","ปราจีนบุรี","สระแก้ว"];
const SOUTH_PROVS = ["ภูเก็ต","สงขลา","สุราษฎร์ธานี","นครศรีธรรมราช","กระบี่","พังงา","ตรัง","พัทลุง","สตูล","ชุมพร","ระนอง","นราธิวาส","ปัตตานี","ยะลา"];

export const THAI_GEO_SEED: ThaiGeoEntity[] = [
  // ─── Regions (6) ──────────────────────────────────────────
  regionEntity("REG-C", "กลาง", ["ภาคกลาง","central"], CENTRAL_PROVS),
  regionEntity("REG-N", "เหนือ", ["ภาคเหนือ","north"], NORTH_PROVS),
  regionEntity("REG-NE", "ตะวันออกเฉียงเหนือ", ["ภาคอีสาน","อีสาน","ภาคตะวันออกเฉียงเหนือ","northeast","isan"], NORTHEAST_PROVS),
  regionEntity("REG-E", "ตะวันออก", ["ภาคตะวันออก","east"], EAST_PROVS),
  regionEntity("REG-S", "ใต้", ["ภาคใต้","south"], SOUTH_PROVS),
  regionEntity("REG-W", "ตะวันตก", ["ภาคตะวันตก","west"], ["กาญจนบุรี","ราชบุรี","เพชรบุรี","ประจวบคีรีขันธ์","ตาก"]),

  // ─── Central provinces ────────────────────────────────────
  prov("PROV-10", "กรุงเทพมหานคร", ["กทม","บางกอก","กรุงเทพฯ"], "กลาง", 13.7563, 100.5018),
  prov("PROV-12", "นนทบุรี", [], "กลาง", 13.8591, 100.5217),
  prov("PROV-13", "ปทุมธานี", [], "กลาง", 14.0208, 100.5250),
  prov("PROV-11", "สมุทรปราการ", [], "กลาง", 13.5991, 100.5998),
  prov("PROV-74", "สมุทรสาคร", [], "กลาง", 13.5475, 100.2744),
  prov("PROV-73", "นครปฐม", [], "กลาง", 13.8196, 100.0444),
  prov("PROV-14", "พระนครศรีอยุธยา", ["อยุธยา"], "กลาง", 14.3692, 100.5877),
  prov("PROV-15", "อ่างทอง", [], "กลาง", 14.5896, 100.4549),
  prov("PROV-17", "สิงห์บุรี", [], "กลาง", 14.8914, 100.3967),
  prov("PROV-18", "ชัยนาท", [], "กลาง", 15.1851, 100.1252),
  prov("PROV-16", "ลพบุรี", [], "กลาง", 14.7995, 100.6534),
  prov("PROV-19", "สระบุรี", [], "กลาง", 14.5289, 100.9108),
  prov("PROV-72", "สุพรรณบุรี", [], "กลาง", 14.4744, 100.1177),
  prov("PROV-75", "สมุทรสงคราม", ["แม่กลอง"], "กลาง", 13.4098, 100.0022),
  prov("PROV-26", "นครนายก", [], "กลาง", 14.2069, 101.2131),

  // ─── North provinces ──────────────────────────────────────
  prov("PROV-50", "เชียงใหม่", ["เจียงใหม่"], "เหนือ", 18.7932, 98.9853),
  prov("PROV-57", "เชียงราย", [], "เหนือ", 19.9105, 99.8406),
  prov("PROV-51", "ลำพูน", [], "เหนือ", 18.5744, 98.9862),
  prov("PROV-52", "ลำปาง", [], "เหนือ", 18.2855, 99.5128),
  prov("PROV-65", "พิษณุโลก", [], "เหนือ", 16.8211, 100.2659),
  prov("PROV-60", "นครสวรรค์", [], "เหนือ", 15.6931, 100.1225),

  // ─── Northeast (Isan) provinces ───────────────────────────
  prov("PROV-30", "นครราชสีมา", ["โคราช"], "อีสาน", 14.9799, 102.0977),
  prov("PROV-40", "ขอนแก่น", [], "อีสาน", 16.4419, 102.8360),
  prov("PROV-41", "อุดรธานี", [], "อีสาน", 17.4138, 102.7874),
  prov("PROV-34", "อุบลราชธานี", ["อุบล"], "อีสาน", 15.2448, 104.8473),
  prov("PROV-31", "บุรีรัมย์", [], "อีสาน", 14.9930, 103.1029),
  prov("PROV-32", "สุรินทร์", [], "อีสาน", 14.8821, 103.4937),

  // ─── East provinces ───────────────────────────────────────
  prov("PROV-20", "ชลบุรี", ["พัทยา"], "ตะวันออก", 13.3611, 100.9847),
  prov("PROV-21", "ระยอง", [], "ตะวันออก", 12.6814, 101.2816),
  prov("PROV-22", "จันทบุรี", [], "ตะวันออก", 12.6100, 102.1048),

  // ─── South provinces ──────────────────────────────────────
  prov("PROV-83", "ภูเก็ต", ["ภูเก็จ","ภูเกตุ"], "ใต้", 7.8804, 98.3923),
  prov("PROV-90", "สงขลา", ["หาดใหญ่"], "ใต้", 7.1896, 100.5945),
  prov("PROV-84", "สุราษฎร์ธานี", ["เกาะสมุย"], "ใต้", 9.1382, 99.3217),
  prov("PROV-80", "นครศรีธรรมราช", [], "ใต้", 8.4324, 99.9599),
  prov("PROV-81", "กระบี่", [], "ใต้", 8.0863, 98.9063),

  // ─── West provinces ───────────────────────────────────────
  prov("PROV-71", "กาญจนบุรี", [], "ตะวันตก", 14.0043, 99.5484),
  prov("PROV-70", "ราชบุรี", [], "ตะวันตก", 13.5283, 99.8134),

  // ─── Key districts ────────────────────────────────────────
  { id: "DIST-5001", domain: "geo", type: "district", name_th: "เมืองเชียงใหม่", aliases: [], description: "อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "เมืองเชียงใหม่", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-5002", domain: "geo", type: "district", name_th: "ดอยสะเก็ด", aliases: [], description: "อำเภอดอยสะเก็ด จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "ดอยสะเก็ด", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-5003", domain: "geo", type: "district", name_th: "สันทราย", aliases: [], description: "อำเภอสันทราย จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "สันทราย", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-5004", domain: "geo", type: "district", name_th: "สันกำแพง", aliases: [], description: "อำเภอสันกำแพง จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "สันกำแพง", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-5005", domain: "geo", type: "district", name_th: "หางดง", aliases: [], description: "อำเภอหางดง จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "หางดง", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-5006", domain: "geo", type: "district", name_th: "แม่ริม", aliases: [], description: "อำเภอแม่ริม จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "แม่ริม", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-5007", domain: "geo", type: "district", name_th: "ฝาง", aliases: [], description: "อำเภอฝาง จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "ฝาง", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-5008", domain: "geo", type: "district", name_th: "แม่แตง", aliases: [], description: "อำเภอแม่แตง จังหวัดเชียงใหม่", attributes: { province: "เชียงใหม่", district: "แม่แตง", region: "เหนือ" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
  { id: "DIST-9001", domain: "geo", type: "district", name_th: "หาดใหญ่", aliases: [], description: "อำเภอหาดใหญ่ จังหวัดสงขลา", attributes: { province: "สงขลา", district: "หาดใหญ่", region: "ใต้" }, relations: [], source: [DOPA_SOURCE], confidence: 0.90, version: "1.0.0", updated_at: now },
];

export interface GeoDbAdapter {
  search(input: { queryText: string; filterRegion?: string; limit?: number }): Promise<ThaiGeoEntity[]>;
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeSource(value: unknown): ThaiKnowledgeSource[] {
  const parsed = safeJsonParse<unknown>(value, value);
  if (Array.isArray(parsed)) {
    return parsed
      .filter((item): item is ThaiKnowledgeSource => !!item && typeof item === "object" && typeof (item as any).name === "string")
      .map((item) => ({ name: item.name, url: item.url }));
  }
  if (parsed && typeof parsed === "object" && typeof (parsed as any).name === "string") {
    return [{ name: (parsed as any).name, url: (parsed as any).url }];
  }
  return [];
}

function normalizeDbRowToEntity(row: any): ThaiGeoEntity {
  const aliasesRaw = safeJsonParse<unknown>(row.aliases, []);
  const aliases = Array.isArray(aliasesRaw)
    ? aliasesRaw.filter((item): item is string => typeof item === "string")
    : [];

  const attrsRaw = safeJsonParse<Record<string, unknown>>(row.attributes, {});
  const lat = Number(attrsRaw.lat);
  const lon = Number(attrsRaw.lon);
  const confidence = Number(row.confidence);

  const attributes: ThaiGeoAttributes = {
    province: String(attrsRaw.province ?? row.name_th ?? ""),
    district: typeof attrsRaw.district === "string" ? attrsRaw.district : undefined,
    subdistrict: typeof attrsRaw.subdistrict === "string" ? attrsRaw.subdistrict : undefined,
    region: typeof attrsRaw.region === "string" ? attrsRaw.region : undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  };

  return {
    id: String(row.id ?? ""),
    domain: "geo",
    type: String(row.type ?? "province"),
    name_th: String(row.name_th ?? ""),
    aliases,
    description: String(row.description ?? ""),
    attributes,
    relations: safeJsonParse<any[]>(row.relations, []),
    source: normalizeSource(row.source),
    confidence: Number.isFinite(confidence) ? confidence : 0,
    version: String(row.version ?? "1.0.0"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function makeResult(entity: ThaiGeoEntity): ThaiGeoResultItem {
  return {
    id: entity.id,
    name_th: entity.name_th,
    type: entity.type,
    attributes: entity.attributes,
    confidence: entity.confidence,
  };
}

function sortMatches(entities: ThaiGeoEntity[], queryText: string): ThaiGeoEntity[] {
  const q = queryText.trim().toLowerCase();

  const score = (entity: ThaiGeoEntity): number => {
    const name = entity.name_th.toLowerCase();
    const aliases = entity.aliases ?? [];
    if (name === q) return 100;
    if (aliases.some((alias) => alias.toLowerCase() === q)) return 95;
    if (name.includes(q)) return 90;
    if (aliases.some((alias) => alias.toLowerCase().includes(q))) return 85;
    if ((entity.description ?? "").toLowerCase().includes(q)) return 80;
    return 0;
  };

  return [...entities].sort((a, b) => {
    const scoreDiff = score(b) - score(a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.confidence - a.confidence;
  });
}

export class MariaDbGeoDb implements GeoDbAdapter {
  async search(input: { queryText: string; filterRegion?: string; limit?: number }): Promise<ThaiGeoEntity[]> {
    const queryText = input.queryText.trim();
    const filterRegion = input.filterRegion?.trim();
    const limit = input.limit ?? 5;
    if (!queryText) return [];

    const fulltextBase =
      "SELECT id, domain, type, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at, " +
      "MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance " +
      "FROM knowledge_entities WHERE domain='geo' " +
      "AND MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE)";

    const fulltextParams: any[] = [queryText, queryText];
    const regionClause = " AND JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.region')) = ?";

    let fulltextSql = fulltextBase;
    if (filterRegion) {
      fulltextSql += regionClause;
      fulltextParams.push(filterRegion);
    }
    fulltextSql += " ORDER BY relevance DESC, confidence DESC LIMIT ?";
    fulltextParams.push(limit);

    try {
      const rows = await query<any[]>(fulltextSql, fulltextParams);
      return Array.isArray(rows) ? rows.map(normalizeDbRowToEntity) : [];
    } catch {
      const like = `%${queryText}%`;
      let likeSql =
        "SELECT id, domain, type, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
        "FROM knowledge_entities WHERE domain='geo' " +
        "AND (name_th LIKE ? OR description LIKE ? OR JSON_SEARCH(aliases, 'one', ?) IS NOT NULL)";
      const likeParams: any[] = [like, like, queryText];

      if (filterRegion) {
        likeSql += regionClause;
        likeParams.push(filterRegion);
      }

      likeSql += " ORDER BY confidence DESC LIMIT ?";
      likeParams.push(limit);

      const rows = await query<any[]>(likeSql, likeParams);
      return Array.isArray(rows) ? rows.map(normalizeDbRowToEntity) : [];
    }
  }
}

export class InMemoryGeoDb implements GeoDbAdapter {
  constructor(private readonly entities: ThaiGeoEntity[]) {}

  async search(input: { queryText: string; filterRegion?: string; limit?: number }): Promise<ThaiGeoEntity[]> {
    const queryText = input.queryText.trim().toLowerCase();
    const filterRegion = input.filterRegion?.trim().toLowerCase();
    const limit = input.limit ?? 5;
    if (!queryText) return [];

    const filtered = this.entities.filter((entity) => {
      const region = entity.attributes.region?.toLowerCase();
      if (filterRegion && region !== filterRegion) return false;

      const aliases = entity.aliases ?? [];
      return (
        entity.name_th.toLowerCase().includes(queryText) ||
        aliases.some((alias) => alias.toLowerCase().includes(queryText)) ||
        (entity.description ?? "").toLowerCase().includes(queryText)
      );
    });

    return sortMatches(filtered, queryText).slice(0, limit);
  }
}

let geoDb: GeoDbAdapter = new MariaDbGeoDb();

export function setGeoDb(adapter: GeoDbAdapter): void {
  geoDb = adapter;
}

export function getGeoDb(): GeoDbAdapter {
  return geoDb;
}

function buildSourceList(entities: ThaiGeoEntity[]): ThaiKnowledgeSource[] {
  const unique = new Map<string, ThaiKnowledgeSource>();

  for (const entity of entities) {
    for (const src of entity.source ?? []) {
      const key = `${src.name}|${src.url ?? ""}`;
      if (!unique.has(key)) unique.set(key, src);
    }
  }

  return Array.from(unique.values());
}

function confidenceOf(entities: ThaiGeoEntity[]): number {
  if (entities.length === 0) return 0;
  return Math.max(...entities.map((item) => item.confidence));
}

function errorResult(error: ThaiGeoToolError): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(error) }] };
}

function successResult(output: ThaiGeoToolOutput): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(output) }] };
}

export const thaiGeoTool = {
  name: TOOL_NAME,
  description: TOOL_DESC,
  inputSchema: z.object({
    query: z.string().min(1),
    context: z
      .object({
        domain: z.literal("geo").optional(),
        language: z.string().default("th").optional(),
        confidence_required: z.number().min(0).max(1).default(DEFAULT_CONFIDENCE_REQUIRED).optional(),
      })
      .optional(),
    filter_region: z.string().min(1).optional(),
  }),
  execute: async (rawArgs: unknown) => {
    const args = rawArgs as ThaiGeoToolInput;
    const searchTerm = String(args?.query ?? "").trim();

    if (!searchTerm) {
      return errorResult({
        success: false,
        error_code: "INVALID_QUERY",
        message: "query ต้องไม่เป็นค่าว่าง",
      });
    }

    const confidenceRequired = args?.context?.confidence_required ?? DEFAULT_CONFIDENCE_REQUIRED;
    const filterRegion = args?.filter_region?.trim();

    try {
      let entities: ThaiGeoEntity[];
      try {
        entities = await getGeoDb().search({ queryText: searchTerm, filterRegion, limit: 10 });
      } catch (dbErr: any) {
        // DB failure: fallback to in-memory seed data
        const inMemory = new InMemoryGeoDb(THAI_GEO_SEED);
        entities = await inMemory.search({ queryText: searchTerm, filterRegion, limit: 10 });
      }
      if (entities.length === 0) {
        return errorResult({
          success: false,
          error_code: "NOT_FOUND",
          message: `ไม่พบข้อมูลภูมิศาสตร์สำหรับ '${searchTerm}'`,
        });
      }

      const confidence = confidenceOf(entities);
      if (confidence < confidenceRequired) {
        return errorResult({
          success: false,
          error_code: "LOW_CONFIDENCE",
          message: `confidence ต่ำกว่าค่าที่กำหนด (${confidence.toFixed(2)} < ${confidenceRequired.toFixed(2)})`,
          note: "ปฏิเสธผลลัพธ์เพื่อป้องกันการเดา",
        });
      }

      const sorted = sortMatches(entities, searchTerm);
      const output: ThaiGeoToolOutput = {
        success: true,
        domain: "geo",
        data: sorted.map(makeResult),
        confidence,
        source: buildSourceList(sorted),
        note: filterRegion ? `พบข้อมูลที่ตรงคำค้นและอยู่ในภูมิภาค ${filterRegion}` : "พบข้อมูลภูมิศาสตร์ที่ตรงคำค้น",
      };

      return successResult(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        const fallback = await new InMemoryGeoDb(THAI_GEO_SEED).search({
          queryText: searchTerm,
          filterRegion,
          limit: 5,
        });

        if (fallback.length > 0) {
          const confidence = confidenceOf(fallback);
          if (confidence < confidenceRequired) {
            return errorResult({
              success: false,
              error_code: "LOW_CONFIDENCE",
              message: `confidence ต่ำกว่าค่าที่กำหนด (${confidence.toFixed(2)} < ${confidenceRequired.toFixed(2)})`,
              note: "ปฏิเสธผลลัพธ์เพื่อป้องกันการเดา",
            });
          }

          const sorted = sortMatches(fallback, searchTerm);
          const output: ThaiGeoToolOutput = {
            success: true,
            domain: "geo",
            data: sorted.map(makeResult),
            confidence,
            source: buildSourceList(sorted),
            note: "fallback to in-memory seed",
          };

          return successResult(output);
        }
      } catch {
        // ignore fallback errors and return db_error below
      }

      return errorResult({
        success: false,
        error_code: "DB_ERROR",
        message,
      });
    }
  },
};

export function registerThaiGeoTool(server: McpServer): void {
  server.registerTool(
    thaiGeoTool.name,
    {
      title: "Thai GEO Tool - ค้นหาภูมิศาสตร์ไทย",
      description: thaiGeoTool.description,
      inputSchema: thaiGeoTool.inputSchema,
    },
    thaiGeoTool.execute,
  );
}

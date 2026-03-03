import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";

type ThaiKnowledgeDomain = "geo";

export interface ThaiGeoSource {
  name: string;
  url?: string;
}

export interface ThaiGeoAttributes {
  province: string;
  district?: string;
  region: string;
  lat?: number;
  lon?: number;
}

export interface ThaiGeoEntity {
  id: string;
  domain: ThaiKnowledgeDomain;
  name_th: string;
  aliases?: string[];
  description: string;
  attributes: ThaiGeoAttributes;
  relations: any[];
  source: ThaiGeoSource;
  confidence: number;
  version: string;
  updated_at: string;
}

export interface ThaiGeoResult {
  id: string;
  name_th: string;
  aliases: string[];
  description: string;
  attributes: ThaiGeoAttributes;
}

export type ThaiGeoToolErrorCode = "INVALID_QUERY" | "NOT_FOUND" | "DB_ERROR";

export interface ThaiGeoToolError {
  success: false;
  error_code: ThaiGeoToolErrorCode;
  message: string;
}

export interface ThaiGeoToolSuccess {
  success: true;
  domain: "geo";
  data: ThaiGeoResult[];
  confidence: number;
  source: string[];
  note?: string;
}

export type ThaiGeoToolOutput = ThaiGeoToolSuccess | ThaiGeoToolError;

export interface GeoDbAdapter {
  search(query: string, limit?: number): Promise<ThaiGeoEntity[]>;
}

export class MariaDbGeoDb implements GeoDbAdapter {
  async search(rawQuery: string, limit: number = 5): Promise<ThaiGeoEntity[]> {
    const q = rawQuery.trim();
    if (!q) return [];

    const like = `%${q}%`;

    const fulltextSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'geo' AND MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE) " +
      "LIMIT ?";

    const likeSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'geo' AND (name_th LIKE ? OR aliases LIKE ? OR description LIKE ? OR attributes LIKE ?) " +
      "LIMIT ?";

    try {
      const rows = await query<any[]>(fulltextSql, [q, limit]);
      return Array.isArray(rows) ? rows.map((r) => normalizeDbRowToEntity(r)) : [];
    } catch {
      const rows = await query<any[]>(likeSql, [like, like, like, like, limit]);
      return Array.isArray(rows) ? rows.map((r) => normalizeDbRowToEntity(r)) : [];
    }
  }
}

export class InMemoryGeoDb implements GeoDbAdapter {
  constructor(private readonly entities: ThaiGeoEntity[]) {}

  async search(queryText: string, limit: number = 5): Promise<ThaiGeoEntity[]> {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];

    const scored = this.entities
      .map((e) => ({ entity: e, score: this.score(e, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => s.entity);
  }

  private score(entity: ThaiGeoEntity, q: string): number {
    const aliases = entity.aliases ?? [];

    if (entity.name_th.toLowerCase() === q) return 0.95;
    if (aliases.some((a) => a.toLowerCase() === q)) return 0.92;
    if (entity.name_th.toLowerCase().includes(q)) return 0.85;
    if (aliases.some((a) => a.toLowerCase().includes(q))) return 0.82;

    const attrs = entity.attributes;
    if (attrs.region && attrs.region.toLowerCase() === q) return 0.8;

    if (entity.description.toLowerCase().includes(q)) return 0.75;

    return 0;
  }
}

const now = new Date().toISOString();
const DOPA_SOURCE: ThaiGeoSource = { name: "DOPA", url: "https://data.go.th" };

export const THAI_GEO_SEED: ThaiGeoEntity[] = [
  {
    id: "geo:nakhon-ratchasima",
    domain: "geo",
    name_th: "นครราชสีมา",
    aliases: ["โคราช"],
    description: "จังหวัดนครราชสีมา ภาคตะวันออกเฉียงเหนือ พื้นที่ใหญ่ที่สุดในอีสาน",
    attributes: { province: "นครราชสีมา", region: "อีสาน", lat: 14.9799, lon: 102.0977 },
    relations: [],
    source: DOPA_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "geo:bangkok",
    domain: "geo",
    name_th: "กรุงเทพมหานคร",
    aliases: ["กทม", "บางกอก", "กรุงเทพฯ"],
    description: "เมืองหลวงของประเทศไทย ศูนย์กลางเศรษฐกิจและการปกครอง",
    attributes: { province: "กรุงเทพมหานคร", region: "กลาง", lat: 13.7563, lon: 100.5018 },
    relations: [],
    source: DOPA_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "geo:chiang-mai",
    domain: "geo",
    name_th: "เชียงใหม่",
    aliases: ["เจียงใหม่", "นพบุรีศรีนครพิงค์เชียงใหม่"],
    description: "จังหวัดเชียงใหม่ ภาคเหนือ เมืองใหญ่อันดับ 2 ของประเทศ",
    attributes: { province: "เชียงใหม่", region: "เหนือ", lat: 18.7883, lon: 98.9853 },
    relations: [],
    source: DOPA_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "geo:phuket",
    domain: "geo",
    name_th: "ภูเก็ต",
    aliases: ["เมืองไข่มุกอันดามัน"],
    description: "จังหวัดภูเก็ต ภาคใต้ เกาะที่ใหญ่ที่สุดในประเทศไทย สถานที่ท่องเที่ยวระดับโลก",
    attributes: { province: "ภูเก็ต", region: "ใต้", lat: 7.8804, lon: 98.3923 },
    relations: [],
    source: DOPA_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
];

let geoDb: GeoDbAdapter = new MariaDbGeoDb();

export function setGeoDb(adapter: GeoDbAdapter): void {
  geoDb = adapter;
}

export function getGeoDb(): GeoDbAdapter {
  return geoDb;
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

function normalizeDbRowToEntity(row: any): ThaiGeoEntity {
  const domain = String(row.domain ?? "geo") as ThaiKnowledgeDomain;
  const name_th = String(row.name_th ?? "");

  const parsedAliases = safeJsonParse<unknown>(row.aliases, []);
  const aliases = Array.isArray(parsedAliases)
    ? parsedAliases.filter((item): item is string => typeof item === "string")
    : [];
  const attributes = safeJsonParse<any>(row.attributes, {});
  const relations = safeJsonParse<any[]>(row.relations, []);
  const lat = Number(attributes.lat);
  const lon = Number(attributes.lon);
  const confidenceNumber = Number(row.confidence);

  const sourceRaw = row.source;
  const sourceObj: ThaiGeoSource =
    typeof sourceRaw === "string" && sourceRaw.trim().startsWith("{")
      ? safeJsonParse<ThaiGeoSource>(sourceRaw, { name: sourceRaw || "unknown" })
      : { name: String(sourceRaw ?? "unknown") };

  return {
    id: String(row.id ?? ""),
    domain,
    name_th,
    aliases,
    description: String(row.description ?? ""),
    attributes: {
      province: String(attributes.province ?? name_th),
      district: attributes.district,
      region: String(attributes.region ?? ""),
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
    },
    relations,
    source: sourceObj,
    confidence: Number.isFinite(confidenceNumber) ? confidenceNumber : 1.0,
    version: String(row.version ?? "1.0.0"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function entityToResult(entity: ThaiGeoEntity): ThaiGeoResult {
  const attrs = entity.attributes;
  return {
    id: entity.id,
    name_th: entity.name_th,
    aliases: entity.aliases ?? [],
    description: entity.description,
    attributes: {
      province: attrs.province ?? entity.name_th,
      district: attrs.district,
      region: attrs.region ?? "",
      lat: attrs.lat,
      lon: attrs.lon,
    },
  };
}

function computeConfidence(entities: ThaiGeoEntity[], queryText: string): number {
  if (entities.length === 0) return 0;

  const first = entities[0];
  const q = queryText.trim().toLowerCase();

  if (first.name_th.toLowerCase() === q) return 0.95;
  if ((first.aliases ?? []).some((a) => a.toLowerCase() === q)) return 0.92;
  if (first.attributes.region?.toLowerCase() === q) return 0.8;
  if (first.name_th.toLowerCase().includes(q)) return 0.85;
  return 0.75;
}

function matchNote(entity: ThaiGeoEntity, queryText: string): string | undefined {
  const q = queryText.trim().toLowerCase();

  if (entity.name_th.toLowerCase() === q) return undefined;
  if ((entity.aliases ?? []).some((a) => a.toLowerCase() === q)) return "matched by alias";
  if (entity.attributes.region?.toLowerCase() === q) return "matched by region";
  return "matched by description";
}

const TOOL_NAME = "thai_geo_tool";
const TOOL_DESC = `ค้นหาข้อมูลภูมิศาสตร์ไทย (Thai Geography Lookup)
ใช้เมื่อ: ต้องการข้อมูลจังหวัด/อำเภอ/ภูมิภาค ของประเทศไทย
Input: query = ชื่อจังหวัด/ชื่อเล่น/ภาค เช่น "โคราช", "กทม", "อีสาน"
Output: JSON พร้อม province, region, lat/lon, confidence score`;

export const thaiGeoTool = {
  name: TOOL_NAME,
  description: TOOL_DESC,
  inputSchema: z.object({
    query: z.string().min(1).describe("คำค้น เช่น ชื่อจังหวัด/ชื่อเล่น/ภาค"),
    context: z
      .object({
        language: z.string().default("th").optional(),
        confidence_required: z.number().min(0).max(1).default(0.7).optional(),
      })
      .optional(),
  }),
  execute: async (args: any) => {
    const searchTerm = String(args?.query ?? "").trim();
    const confidenceRequired = args?.context?.confidence_required ?? 0.7;

    if (!searchTerm) {
      const err: ThaiGeoToolError = {
        success: false,
        error_code: "INVALID_QUERY",
        message: "query ต้องไม่เป็นค่าว่าง",
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
    }

    const adapter = getGeoDb();

    try {
      const entities = await adapter.search(searchTerm, 5);

      if (entities.length === 0) {
        const err: ThaiGeoToolError = {
          success: false,
          error_code: "NOT_FOUND",
          message: `ไม่พบข้อมูลภูมิศาสตร์สำหรับ '${searchTerm}'`,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
      }

      const confidence = computeConfidence(entities, searchTerm);
      if (confidence < confidenceRequired) {
        const err: ThaiGeoToolError = {
          success: false,
          error_code: "NOT_FOUND",
          message: `ผลลัพธ์มี confidence ${confidence} ต่ำกว่าที่กำหนด ${confidenceRequired}`,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
      }

      const data = entities.map(entityToResult);
      const note = matchNote(entities[0], searchTerm);
      const sources = Array.from(new Set(entities.map((e) => e.source.name).filter(Boolean)));

      const out: ThaiGeoToolSuccess = {
        success: true,
        domain: "geo",
        data,
        confidence,
        source: sources,
        ...(note ? { note } : {}),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        const fallbackEntities = await new InMemoryGeoDb(THAI_GEO_SEED).search(searchTerm, 5);
        if (fallbackEntities.length > 0) {
          const confidence = computeConfidence(fallbackEntities, searchTerm);
          if (confidence < confidenceRequired) {
            const err: ThaiGeoToolError = {
              success: false,
              error_code: "NOT_FOUND",
              message: `ผลลัพธ์มี confidence ${confidence} ต่ำกว่าที่กำหนด ${confidenceRequired}`,
            };
            return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
          }
          const data = fallbackEntities.map(entityToResult);
          const note = matchNote(fallbackEntities[0], searchTerm);
          const sources = Array.from(
            new Set(fallbackEntities.map((e) => e.source.name).filter(Boolean)),
          );

          const out: ThaiGeoToolSuccess = {
            success: true,
            domain: "geo",
            data,
            confidence,
            source: sources,
            note: note ? `${note} (fallback to stub)` : "fallback to stub",
          };

          return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
        }
      } catch {
        // ignore fallback errors
      }

      const err: ThaiGeoToolError = {
        success: false,
        error_code: "DB_ERROR",
        message,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
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

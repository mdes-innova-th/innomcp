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

export const THAI_GEO_SEED: ThaiGeoEntity[] = [
  {
    id: "PROV-10",
    domain: "geo",
    type: "province",
    name_th: "กรุงเทพมหานคร",
    aliases: ["กทม", "บางกอก", "กรุงเทพฯ"],
    description: "จังหวัดกรุงเทพมหานคร อยู่ในภาคกลาง",
    attributes: { province: "กรุงเทพมหานคร", region: "กลาง", lat: 13.7563, lon: 100.5018 },
    relations: [],
    source: [DOPA_SOURCE],
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "PROV-50",
    domain: "geo",
    type: "province",
    name_th: "เชียงใหม่",
    aliases: ["เจียงใหม่"],
    description: "จังหวัดเชียงใหม่ อยู่ในภาคเหนือ",
    attributes: { province: "เชียงใหม่", region: "เหนือ", lat: 18.7932, lon: 98.9853 },
    relations: [],
    source: [DOPA_SOURCE],
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "PROV-30",
    domain: "geo",
    type: "province",
    name_th: "นครราชสีมา",
    aliases: ["โคราช"],
    description: "จังหวัดนครราชสีมา อยู่ในภาคตะวันออกเฉียงเหนือ (อีสาน)",
    attributes: { province: "นครราชสีมา", region: "อีสาน", lat: 14.9799, lon: 102.0977 },
    relations: [],
    source: [DOPA_SOURCE],
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "PROV-83",
    domain: "geo",
    type: "province",
    name_th: "ภูเก็ต",
    aliases: [],
    description: "จังหวัดภูเก็ต อยู่ในภาคใต้",
    attributes: { province: "ภูเก็ต", region: "ใต้", lat: 7.8804, lon: 98.3923 },
    relations: [],
    source: [DOPA_SOURCE],
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
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
      const entities = await getGeoDb().search({ queryText: searchTerm, filterRegion, limit: 5 });
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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";

type ThaiKnowledgeDomain = "history";

export interface ThaiHistorySource {
  name: string;
  url?: string;
}

export interface ThaiHistoryAttributes {
  era: string;
  period?: string;
  year_start?: number;
  year_end?: number;
  event_type: string;
  key_figures?: string[];
}

export interface ThaiHistoryEntity {
  id: string;
  domain: ThaiKnowledgeDomain;
  name_th: string;
  aliases?: string[];
  description: string;
  attributes: ThaiHistoryAttributes;
  relations: any[];
  source: ThaiHistorySource;
  confidence: number;
  version: string;
  updated_at: string;
}

export interface ThaiHistoryResult {
  id: string;
  name_th: string;
  aliases: string[];
  description: string;
  attributes: ThaiHistoryAttributes;
}

export type ThaiHistoryToolErrorCode = "INVALID_QUERY" | "NOT_FOUND" | "DB_ERROR";

export interface ThaiHistoryToolError {
  success: false;
  error_code: ThaiHistoryToolErrorCode;
  message: string;
}

export interface ThaiHistoryToolSuccess {
  success: true;
  domain: "history";
  data: ThaiHistoryResult[];
  confidence: number;
  source: string[];
  note?: string;
}

export type ThaiHistoryToolOutput = ThaiHistoryToolSuccess | ThaiHistoryToolError;

export interface HistoryDbAdapter {
  search(query: string, limit?: number): Promise<ThaiHistoryEntity[]>;
}

export class MariaDbHistoryDb implements HistoryDbAdapter {
  async search(rawQuery: string, limit: number = 5): Promise<ThaiHistoryEntity[]> {
    const q = rawQuery.trim();
    if (!q) return [];

    const like = `%${q}%`;

    const fulltextSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'history' AND MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE) " +
      "LIMIT ?";

    const likeSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'history' AND (name_th LIKE ? OR aliases LIKE ? OR description LIKE ? OR attributes LIKE ?) " +
      "LIMIT ?";

    try {
      const rows = await query<any[]>(fulltextSql, [q, limit]);
      const normalized = Array.isArray(rows) ? rows.map((r) => normalizeDbRowToEntity(r)) : [];
      if (normalized.length > 0) return normalized;

      const likeRows = await query<any[]>(likeSql, [like, like, like, like, limit]);
      return Array.isArray(likeRows) ? likeRows.map((r) => normalizeDbRowToEntity(r)) : [];
    } catch {
      const rows = await query<any[]>(likeSql, [like, like, like, like, limit]);
      return Array.isArray(rows) ? rows.map((r) => normalizeDbRowToEntity(r)) : [];
    }
  }
}

export class InMemoryHistoryDb implements HistoryDbAdapter {
  constructor(private readonly entities: ThaiHistoryEntity[]) {}

  async search(queryText: string, limit: number = 5): Promise<ThaiHistoryEntity[]> {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];

    const scored = this.entities
      .map((e) => ({ entity: e, score: this.score(e, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => s.entity);
  }

  private score(entity: ThaiHistoryEntity, q: string): number {
    const aliases = entity.aliases ?? [];

    if (entity.name_th.toLowerCase() === q) return 0.95;
    if (aliases.some((a) => a.toLowerCase() === q)) return 0.92;
    if (entity.name_th.toLowerCase().includes(q)) return 0.85;
    if (aliases.some((a) => a.toLowerCase().includes(q))) return 0.82;

    const attrs = entity.attributes;
    if (attrs.era && attrs.era.toLowerCase() === q) return 0.8;

    if (entity.description.toLowerCase().includes(q)) return 0.75;

    return 0;
  }
}

const now = new Date().toISOString();
const RTGG_SOURCE: ThaiHistorySource = { name: "Royal Thai Government Gazette" };

export const THAI_HISTORY_SEED: ThaiHistoryEntity[] = [
  {
    id: "history:sukhothai",
    domain: "history",
    name_th: "อาณาจักรสุโขทัย",
    aliases: ["สุโขทัย", "กรุงสุโขทัย"],
    description: "อาณาจักรไทยแห่งแรก ก่อตั้ง พ.ศ. 1792 โดยพ่อขุนศรีอินทราทิตย์ เมืองหลวงอยู่ที่สุโขทัย",
    attributes: { era: "สุโขทัย", period: "พ.ศ. 1792–1981", year_start: 1249, year_end: 1438, event_type: "kingdom", key_figures: ["พ่อขุนศรีอินทราทิตย์", "พ่อขุนรามคำแหง"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:ayutthaya",
    domain: "history",
    name_th: "อาณาจักรอยุธยา",
    aliases: ["อยุธยา", "กรุงศรีอยุธยา"],
    description: "อาณาจักรไทยที่ยิ่งใหญ่ ก่อตั้ง พ.ศ. 1893 โดยสมเด็จพระรามาธิบดีที่ 1 (พระเจ้าอู่ทอง)",
    attributes: { era: "อยุธยา", period: "พ.ศ. 1893–2310", year_start: 1350, year_end: 1767, event_type: "kingdom", key_figures: ["สมเด็จพระรามาธิบดีที่ 1", "สมเด็จพระนเรศวรมหาราช"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:thonburi",
    domain: "history",
    name_th: "อาณาจักรธนบุรี",
    aliases: ["ธนบุรี", "กรุงธนบุรี"],
    description: "อาณาจักรสั้นหลังเสียกรุงศรีอยุธยา ก่อตั้งโดยสมเด็จพระเจ้าตากสินมหาราช",
    attributes: { era: "ธนบุรี", period: "พ.ศ. 2310–2325", year_start: 1767, year_end: 1782, event_type: "kingdom", key_figures: ["สมเด็จพระเจ้าตากสินมหาราช"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:rattanakosin",
    domain: "history",
    name_th: "กรุงรัตนโกสินทร์",
    aliases: ["รัตนโกสินทร์", "ราชวงศ์จักรี"],
    description: "ยุคปัจจุบัน ก่อตั้งโดยพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช (รัชกาลที่ 1)",
    attributes: { era: "รัตนโกสินทร์", period: "พ.ศ. 2325–ปัจจุบัน", year_start: 1782, event_type: "kingdom", key_figures: ["พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:siamese-revolution-1932",
    domain: "history",
    name_th: "การปฏิวัติสยาม พ.ศ. 2475",
    aliases: ["ปฏิวัติ 2475", "การเปลี่ยนแปลงการปกครอง"],
    description: "การเปลี่ยนแปลงการปกครองจากสมบูรณาญาสิทธิราชย์เป็นระบอบประชาธิปไตย โดยคณะราษฎร",
    attributes: { era: "รัตนโกสินทร์", period: "24 มิถุนายน พ.ศ. 2475", year_start: 1932, year_end: 1932, event_type: "revolution", key_figures: ["พระยาพหลพลพยุหเสนา", "ปรีดี พนมยงค์"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
];

let historyDb: HistoryDbAdapter = new MariaDbHistoryDb();

export function setHistoryDb(adapter: HistoryDbAdapter): void {
  historyDb = adapter;
}

export function getHistoryDb(): HistoryDbAdapter {
  return historyDb;
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

function normalizeDbRowToEntity(row: any): ThaiHistoryEntity {
  const domain = String(row.domain ?? "history") as ThaiKnowledgeDomain;
  const name_th = String(row.name_th ?? "");

  const aliases = safeJsonParse<string[]>(row.aliases, []);
  const attributes = safeJsonParse<any>(row.attributes, {});
  const relations = safeJsonParse<any[]>(row.relations, []);

  const sourceRaw = row.source;
  const sourceObj: ThaiHistorySource =
    typeof sourceRaw === "string" && sourceRaw.trim().startsWith("{")
      ? safeJsonParse<ThaiHistorySource>(sourceRaw, { name: sourceRaw || "unknown" })
      : { name: String(sourceRaw ?? "unknown") };

  return {
    id: String(row.id ?? ""),
    domain,
    name_th,
    aliases,
    description: String(row.description ?? ""),
    attributes: {
      era: String(attributes.era ?? ""),
      period: attributes.period,
      year_start: typeof attributes.year_start === "number" ? attributes.year_start : undefined,
      year_end: typeof attributes.year_end === "number" ? attributes.year_end : undefined,
      event_type: String(attributes.event_type ?? ""),
      key_figures: Array.isArray(attributes.key_figures) ? attributes.key_figures : undefined,
    },
    relations,
    source: sourceObj,
    confidence: typeof row.confidence === "number" ? row.confidence : 1.0,
    version: String(row.version ?? "1.0.0"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function entityToResult(entity: ThaiHistoryEntity): ThaiHistoryResult {
  const attrs = entity.attributes;
  return {
    id: entity.id,
    name_th: entity.name_th,
    aliases: entity.aliases ?? [],
    description: entity.description,
    attributes: {
      era: attrs.era ?? "",
      period: attrs.period,
      year_start: attrs.year_start,
      year_end: attrs.year_end,
      event_type: attrs.event_type ?? "",
      key_figures: attrs.key_figures,
    },
  };
}

function computeConfidence(entities: ThaiHistoryEntity[], queryText: string): number {
  if (entities.length === 0) return 0;

  const first = entities[0];
  const q = queryText.trim().toLowerCase();

  if (first.name_th.toLowerCase() === q) return 0.95;
  if ((first.aliases ?? []).some((a) => a.toLowerCase() === q)) return 0.92;
  if (first.name_th.toLowerCase().includes(q)) return 0.85;
  return 0.75;
}

function matchNote(entity: ThaiHistoryEntity, queryText: string): string | undefined {
  const q = queryText.trim().toLowerCase();

  if (entity.name_th.toLowerCase() === q) return undefined;
  if ((entity.aliases ?? []).some((a) => a.toLowerCase() === q)) return "matched by alias";
  if (entity.attributes.era?.toLowerCase() === q) return "matched by era";
  return "matched by description";
}

const TOOL_NAME = "thai_history_tool";
const TOOL_DESC = `ค้นหาข้อมูลประวัติศาสตร์ไทย (Thai History Lookup)
ใช้เมื่อ: ต้องการข้อมูลยุคสมัย/เหตุการณ์/บุคคลสำคัญ ในประวัติศาสตร์ไทย
Input: query = ชื่อเหตุการณ์/ยุคสมัย/บุคคลสำคัญ เช่น "สุโขทัย", "อยุธยา", "ปฏิวัติ 2475"
Output: JSON พร้อม era, period, year_start/year_end, event_type, key_figures, confidence score`;

export const thaiHistoryTool = {
  name: TOOL_NAME,
  description: TOOL_DESC,
  inputSchema: z.object({
    query: z.string().min(1).describe("คำค้น เช่น ชื่อเหตุการณ์/ยุคสมัย/บุคคลสำคัญ"),
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
      const err: ThaiHistoryToolError = {
        success: false,
        error_code: "INVALID_QUERY",
        message: "query ต้องไม่เป็นค่าว่าง",
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
    }

    const adapter = getHistoryDb();

    try {
      const entities = await adapter.search(searchTerm, 5);

      if (entities.length === 0) {
        const err: ThaiHistoryToolError = {
          success: false,
          error_code: "NOT_FOUND",
          message: `ไม่พบข้อมูลประวัติศาสตร์สำหรับ '${searchTerm}'`,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
      }

      const confidence = computeConfidence(entities, searchTerm);
      if (confidence < confidenceRequired) {
        const err: ThaiHistoryToolError = {
          success: false,
          error_code: "NOT_FOUND",
          message: `ผลลัพธ์มี confidence ${confidence} ต่ำกว่าที่กำหนด ${confidenceRequired}`,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
      }

      const data = entities.map(entityToResult);
      const note = matchNote(entities[0], searchTerm);
      const sources = Array.from(new Set(entities.map((e) => e.source.name).filter(Boolean)));

      const out: ThaiHistoryToolSuccess = {
        success: true,
        domain: "history",
        data,
        confidence,
        source: sources,
        ...(note ? { note } : {}),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        const fallbackEntities = await new InMemoryHistoryDb(THAI_HISTORY_SEED).search(searchTerm, 5);
        if (fallbackEntities.length > 0) {
          const confidence = computeConfidence(fallbackEntities, searchTerm);
          if (confidence < confidenceRequired) {
            const err: ThaiHistoryToolError = {
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

          const out: ThaiHistoryToolSuccess = {
            success: true,
            domain: "history",
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

      const err: ThaiHistoryToolError = {
        success: false,
        error_code: "DB_ERROR",
        message,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
    }
  },
};

export function registerThaiHistoryTool(server: McpServer): void {
  server.registerTool(
    thaiHistoryTool.name,
    {
      title: "Thai History Tool - ค้นหาประวัติศาสตร์ไทย",
      description: thaiHistoryTool.description,
      inputSchema: thaiHistoryTool.inputSchema,
    },
    thaiHistoryTool.execute,
  );
}

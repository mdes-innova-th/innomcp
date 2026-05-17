import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";

import type { ThaiKnowledgeSource } from "./thaiKnowledge.types";
import type { HistoryAttributes, HistoryEntityType } from "../knowledge/types/history";
import { HISTORY_ERAS } from "../knowledge/data/history_eras";
import { HISTORY_KINGS } from "../knowledge/data/history_kings";

type ThaiKnowledgeDomain = "history";

export type ThaiHistoryAttributes = HistoryAttributes;

export interface ThaiHistoryEntity {
  id: string;
  domain: ThaiKnowledgeDomain;
  name_th: string;
  aliases?: string[];
  description: string;
  attributes: ThaiHistoryAttributes;
  relations: Array<{ type: string; target_id: string }>;
  source: ThaiKnowledgeSource;
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
    const attrs = entity.attributes;

    if (entity.name_th.toLowerCase() === q) return 0.95;
    if (aliases.some((a) => a.toLowerCase() === q)) return 0.92;
    if (entity.name_th.toLowerCase().includes(q)) return 0.85;
    if (aliases.some((a) => a.toLowerCase().includes(q))) return 0.82;

    // Type-specific matching (Phase 2 discriminated union)
    if (attrs.entity_type === "era" && attrs.period?.toLowerCase().includes(q)) return 0.8;
    if (attrs.entity_type === "person" && attrs.significance?.toLowerCase().includes(q)) return 0.78;
    if (attrs.entity_type === "event" && attrs.significance?.toLowerCase().includes(q)) return 0.78;

    if (entity.description.toLowerCase().includes(q)) return 0.75;

    return 0;
  }
}

const now = new Date().toISOString();
const RTGG_SOURCE: ThaiKnowledgeSource = { name: "Royal Thai Government Gazette" };

const HISTORY_EVENTS: ThaiHistoryEntity[] = [
  {
    id: "event:fall-ayutthaya-2",
    domain: "history",
    name_th: "เสียกรุงศรีอยุธยาครั้งที่ 2",
    aliases: ["เสียกรุงครั้งที่ 2", "Fall of Ayutthaya 1767"],
    description: "พม่าตีกรุงศรีอยุธยาแตก พ.ศ. 2310 สิ้นสุดอาณาจักรอยุธยา 417 ปี",
    attributes: {
      entity_type: "event",
      era: "history:ayutthaya",
      year: 1767,
      date: "7 เมษายน พ.ศ. 2310",
      event_type: "battle",
      key_figures: ["พระเจ้ามังระ", "สมเด็จพระที่นั่งสุริยาศน์อมรินทร์"],
      outcome: "กรุงศรีอยุธยาแตก",
      significance: "สิ้นสุดอาณาจักรอยุธยา นำไปสู่การสถาปนากรุงธนบุรี",
    },
    relations: [{ type: "ended", target_id: "history:ayutthaya" }],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "event:bowring-treaty-1855",
    domain: "history",
    name_th: "สนธิสัญญาเบาว์ริง",
    aliases: ["สนธิสัญญาเบาว์ริง", "Bowring Treaty"],
    description: "สนธิสัญญาระหว่างสยามกับอังกฤษ พ.ศ. 2398 เปิดการค้าและปรับระบบภาษี",
    attributes: {
      entity_type: "event",
      era: "history:rattanakosin",
      year: 1855,
      event_type: "treaty",
      key_figures: ["เซอร์จอห์น เบาว์ริง", "พระบาทสมเด็จพระจอมเกล้าเจ้าอยู่หัว"],
      significance: "เปลี่ยนโครงสร้างการค้าและความสัมพันธ์กับชาติตะวันตก",
    },
    relations: [{ type: "occurred_during", target_id: "history:rattanakosin" }],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:siamese-revolution-1932",
    domain: "history",
    name_th: "การปฏิวัติสยาม พ.ศ. 2475",
    aliases: ["ปฏิวัติ 2475", "การเปลี่ยนแปลงการปกครอง", "Siamese Revolution 1932"],
    description: "การเปลี่ยนแปลงการปกครองจากสมบูรณาญาสิทธิราชย์เป็นระบอบประชาธิปไตย โดยคณะราษฎร",
    attributes: {
      entity_type: "event",
      era: "history:rattanakosin",
      year: 1932,
      date: "24 มิถุนายน พ.ศ. 2475",
      event_type: "revolution",
      key_figures: ["พระยาพหลพลพยุหเสนา", "ปรีดี พนมยงค์"],
      significance: "เปลี่ยนแปลงระบอบการปกครองสู่รัฐธรรมนูญ",
    },
    relations: [{ type: "occurred_during", target_id: "history:rattanakosin" }],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
];

export const THAI_HISTORY_SEED: ThaiHistoryEntity[] = [
  ...HISTORY_ERAS,
  ...HISTORY_KINGS,
  ...HISTORY_EVENTS,
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
  const rawAttributes = safeJsonParse<any>(row.attributes, {});
  const relations = safeJsonParse<any[]>(row.relations, []);

  const sourceRaw = row.source;
  const sourceObj: ThaiKnowledgeSource =
    typeof sourceRaw === "string" && sourceRaw.trim().startsWith("{")
      ? safeJsonParse<ThaiKnowledgeSource>(sourceRaw, { name: sourceRaw || "unknown" })
      : { name: String(sourceRaw ?? "unknown") };

  const entity_type = String(rawAttributes.entity_type ?? "era") as HistoryEntityType;
  let attributes: HistoryAttributes;

  if (entity_type === "person") {
    attributes = {
      entity_type: "person",
      era: String(rawAttributes.era ?? ""),
      role: String(rawAttributes.role ?? ""),
      reign_period: rawAttributes.reign_period,
      year_birth: typeof rawAttributes.year_birth === "number" ? rawAttributes.year_birth : undefined,
      year_death: typeof rawAttributes.year_death === "number" ? rawAttributes.year_death : undefined,
      significance: String(rawAttributes.significance ?? ""),
      titles: Array.isArray(rawAttributes.titles) ? rawAttributes.titles : undefined,
    };
  } else if (entity_type === "event") {
    attributes = {
      entity_type: "event",
      era: String(rawAttributes.era ?? ""),
      year: typeof rawAttributes.year === "number" ? rawAttributes.year : 0,
      date: rawAttributes.date,
      event_type: String(rawAttributes.event_type ?? ""),
      key_figures: Array.isArray(rawAttributes.key_figures) ? rawAttributes.key_figures : [],
      outcome: rawAttributes.outcome,
      significance: String(rawAttributes.significance ?? ""),
    };
  } else {
    attributes = {
      entity_type: "era",
      capital: rawAttributes.capital,
      year_start: typeof rawAttributes.year_start === "number" ? rawAttributes.year_start : 0,
      year_end: typeof rawAttributes.year_end === "number" ? rawAttributes.year_end : undefined,
      period: String(rawAttributes.period ?? ""),
      key_figures: Array.isArray(rawAttributes.key_figures) ? rawAttributes.key_figures : [],
      successor_era: rawAttributes.successor_era,
      predecessor_era: rawAttributes.predecessor_era,
    };
  }

  return {
    id: String(row.id ?? ""),
    domain,
    name_th,
    aliases,
    description: String(row.description ?? ""),
    attributes,
    relations: Array.isArray(relations) ? relations : [],
    source: sourceObj,
    confidence: typeof row.confidence === "number" ? row.confidence : 1.0,
    version: String(row.version ?? "1.0.0"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function entityToResult(entity: ThaiHistoryEntity): ThaiHistoryResult {
  return {
    id: entity.id,
    name_th: entity.name_th,
    aliases: entity.aliases ?? [],
    description: entity.description,
    attributes: entity.attributes,
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
      inputSchema: thaiHistoryTool.inputSchema as any,
    },
    thaiHistoryTool.execute,
  );
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";

type ThaiKnowledgeDomain = "law";

export interface ThaiLawSource {
  name: string;
  url?: string;
}

export interface ThaiLawAttributes {
  law_type: string;
  status: string;
  effective_date?: string;
  applies_to?: string[];
}

export interface ThaiLawEntity {
  id: string;
  domain: ThaiKnowledgeDomain;
  name_th: string;
  aliases?: string[];
  description: string;
  attributes: ThaiLawAttributes;
  relations: any[];
  source: ThaiLawSource;
  confidence: number;
  version: string;
  updated_at: string;
}

export interface ThaiLawResult {
  id: string;
  name_th: string;
  aliases: string[];
  description: string;
  attributes: ThaiLawAttributes;
}

export type ThaiLawToolErrorCode = "INVALID_QUERY" | "NOT_FOUND" | "DB_ERROR";

export interface ThaiLawToolError {
  success: false;
  error_code: ThaiLawToolErrorCode;
  message: string;
}

export interface ThaiLawToolSuccess {
  success: true;
  domain: "law";
  data: ThaiLawResult[];
  confidence: number;
  source: string[];
  note?: string;
}

export type ThaiLawToolOutput = ThaiLawToolSuccess | ThaiLawToolError;

export interface LawDbAdapter {
  search(query: string, limit?: number): Promise<ThaiLawEntity[]>;
}

export class MariaDbLawDb implements LawDbAdapter {
  async search(rawQuery: string, limit: number = 5): Promise<ThaiLawEntity[]> {
    const q = rawQuery.trim();
    if (!q) return [];

    const like = `%${q}%`;

    const fulltextSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'law' AND MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE) " +
      "LIMIT ?";

    const likeSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'law' AND (name_th LIKE ? OR aliases LIKE ? OR description LIKE ? OR attributes LIKE ?) " +
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

export class InMemoryLawDb implements LawDbAdapter {
  constructor(private readonly entities: ThaiLawEntity[]) {}

  async search(queryText: string, limit: number = 5): Promise<ThaiLawEntity[]> {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];

    const scored = this.entities
      .map((e) => ({ entity: e, score: this.score(e, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => s.entity);
  }

  private score(entity: ThaiLawEntity, q: string): number {
    const aliases = entity.aliases ?? [];

    if (entity.name_th.toLowerCase() === q) return 0.95;
    if (aliases.some((a) => a.toLowerCase() === q)) return 0.92;
    if (entity.name_th.toLowerCase().includes(q)) return 0.85;
    if (aliases.some((a) => a.toLowerCase().includes(q))) return 0.82;

    const attrs = entity.attributes;
    if (attrs.law_type && attrs.law_type.toLowerCase() === q) return 0.8;

    if (entity.description.toLowerCase().includes(q)) return 0.75;

    return 0;
  }
}

const now = new Date().toISOString();
const RTGG_SOURCE: ThaiLawSource = { name: "Royal Thai Government Gazette", url: "https://www.ratchakitcha.soc.go.th" };

export const THAI_LAW_SEED: ThaiLawEntity[] = [
  {
    id: "law:computer-crime-act",
    domain: "law",
    name_th: "พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์",
    aliases: ["พ.ร.บ.คอมพิวเตอร์", "พ.ร.บ.คอมพิวเตอร์ 2560"],
    description: "กฎหมายเกี่ยวกับอาชญากรรมทางคอมพิวเตอร์และการกำกับดูแลข้อมูลออนไลน์",
    attributes: { law_type: "พระราชบัญญัติ", status: "active", effective_date: "2017-05-24", applies_to: ["ประชาชน", "ผู้ให้บริการ"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "law:pdpa",
    domain: "law",
    name_th: "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล",
    aliases: ["PDPA", "พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล"],
    description: "กฎหมายคุ้มครองข้อมูลส่วนบุคคลของประเทศไทย มีผลบังคับใช้เต็มรูปแบบ พ.ศ. 2565",
    attributes: { law_type: "พระราชบัญญัติ", status: "active", effective_date: "2022-06-01", applies_to: ["ประชาชน", "หน่วยงานรัฐ", "เอกชน"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "law:constitution-2560",
    domain: "law",
    name_th: "รัฐธรรมนูญแห่งราชอาณาจักรไทย พ.ศ. 2560",
    aliases: ["รัฐธรรมนูญ 2560", "รัฐธรรมนูญฉบับปัจจุบัน"],
    description: "รัฐธรรมนูญฉบับปัจจุบันของประเทศไทย ประกาศใช้เมื่อ 6 เมษายน 2560",
    attributes: { law_type: "รัฐธรรมนูญ", status: "active", effective_date: "2017-04-06", applies_to: ["ประชาชน", "หน่วยงานรัฐ"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "law:criminal-code",
    domain: "law",
    name_th: "ประมวลกฎหมายอาญา",
    aliases: ["ป.อ.", "กฎหมายอาญา"],
    description: "กฎหมายกำหนดความผิดและบทลงโทษทางอาญา ครอบคลุมฐานความผิดทั่วไป",
    attributes: { law_type: "ประมวลกฎหมาย", status: "active", effective_date: "1956-01-01", applies_to: ["ประชาชน"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "law:civil-commercial-code",
    domain: "law",
    name_th: "ประมวลกฎหมายแพ่งและพาณิชย์",
    aliases: ["ป.พ.พ.", "กฎหมายแพ่ง"],
    description: "กฎหมายหลักว่าด้วยนิติกรรม สัญญา ทรัพย์สิน ครอบครัว และมรดก",
    attributes: { law_type: "ประมวลกฎหมาย", status: "active", effective_date: "1925-01-01", applies_to: ["ประชาชน"] },
    relations: [],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
];

let lawDb: LawDbAdapter = new MariaDbLawDb();

export function setLawDb(adapter: LawDbAdapter): void {
  lawDb = adapter;
}

export function getLawDb(): LawDbAdapter {
  return lawDb;
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

function normalizeDbRowToEntity(row: any): ThaiLawEntity {
  const domain = String(row.domain ?? "law") as ThaiKnowledgeDomain;
  const name_th = String(row.name_th ?? "");

  const aliases = safeJsonParse<string[]>(row.aliases, []);
  const attributes = safeJsonParse<any>(row.attributes, {});
  const relations = safeJsonParse<any[]>(row.relations, []);

  const sourceRaw = row.source;
  const sourceObj: ThaiLawSource =
    typeof sourceRaw === "string" && sourceRaw.trim().startsWith("{")
      ? safeJsonParse<ThaiLawSource>(sourceRaw, { name: sourceRaw || "unknown" })
      : { name: String(sourceRaw ?? "unknown") };

  return {
    id: String(row.id ?? ""),
    domain,
    name_th,
    aliases,
    description: String(row.description ?? ""),
    attributes: {
      law_type: String(attributes.law_type ?? ""),
      status: String(attributes.status ?? ""),
      effective_date: typeof attributes.effective_date === "string" ? attributes.effective_date : undefined,
      applies_to: Array.isArray(attributes.applies_to) ? attributes.applies_to : undefined,
    },
    relations,
    source: sourceObj,
    confidence: typeof row.confidence === "number" ? row.confidence : 1.0,
    version: String(row.version ?? "1.0.0"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function entityToResult(entity: ThaiLawEntity): ThaiLawResult {
  const attrs = entity.attributes;
  return {
    id: entity.id,
    name_th: entity.name_th,
    aliases: entity.aliases ?? [],
    description: entity.description,
    attributes: {
      law_type: attrs.law_type ?? "",
      status: attrs.status ?? "",
      effective_date: attrs.effective_date,
      applies_to: attrs.applies_to,
    },
  };
}

function computeConfidence(entities: ThaiLawEntity[], queryText: string): number {
  if (entities.length === 0) return 0;

  const first = entities[0];
  const q = queryText.trim().toLowerCase();

  if (first.name_th.toLowerCase() === q) return 0.95;
  if ((first.aliases ?? []).some((a) => a.toLowerCase() === q)) return 0.92;
  if (first.name_th.toLowerCase().includes(q)) return 0.85;
  return 0.75;
}

function matchNote(entity: ThaiLawEntity, queryText: string): string | undefined {
  const q = queryText.trim().toLowerCase();

  if (entity.name_th.toLowerCase() === q) return undefined;
  if ((entity.aliases ?? []).some((a) => a.toLowerCase() === q)) return "matched by alias";
  if (entity.attributes.law_type?.toLowerCase() === q) return "matched by law_type";
  return "matched by description";
}

const TOOL_NAME = "thai_law_tool";
const TOOL_DESC = `ค้นหาข้อมูลกฎหมายไทย (Thai Law Lookup)
ใช้เมื่อ: ต้องการข้อมูลกฎหมาย/พระราชบัญญัติ/ประมวลกฎหมาย ของประเทศไทย
Input: query = ชื่อกฎหมาย/คำย่อ/ประเภท เช่น "PDPA", "พ.ร.บ.คอมพิวเตอร์", "รัฐธรรมนูญ"
Output: JSON พร้อม law_type, status, effective_date, applies_to, confidence score`;

export const thaiLawTool = {
  name: TOOL_NAME,
  description: TOOL_DESC,
  inputSchema: z.object({
    query: z.string().min(1).describe("คำค้น เช่น ชื่อกฎหมาย/คำย่อ/ประเภท"),
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
      const err: ThaiLawToolError = {
        success: false,
        error_code: "INVALID_QUERY",
        message: "query ต้องไม่เป็นค่าว่าง",
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
    }

    const adapter = getLawDb();

    try {
      const entities = await adapter.search(searchTerm, 5);

      if (entities.length === 0) {
        const err: ThaiLawToolError = {
          success: false,
          error_code: "NOT_FOUND",
          message: `ไม่พบข้อมูลกฎหมายสำหรับ '${searchTerm}'`,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
      }

      const confidence = computeConfidence(entities, searchTerm);
      if (confidence < confidenceRequired) {
        const err: ThaiLawToolError = {
          success: false,
          error_code: "NOT_FOUND",
          message: `ผลลัพธ์มี confidence ${confidence} ต่ำกว่าที่กำหนด ${confidenceRequired}`,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
      }

      const data = entities.map(entityToResult);
      const note = matchNote(entities[0], searchTerm);
      const sources = Array.from(new Set(entities.map((e) => e.source.name).filter(Boolean)));

      const out: ThaiLawToolSuccess = {
        success: true,
        domain: "law",
        data,
        confidence,
        source: sources,
        ...(note ? { note } : {}),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        const fallbackEntities = await new InMemoryLawDb(THAI_LAW_SEED).search(searchTerm, 5);
        if (fallbackEntities.length > 0) {
          const confidence = computeConfidence(fallbackEntities, searchTerm);
          if (confidence < confidenceRequired) {
            const err: ThaiLawToolError = {
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

          const out: ThaiLawToolSuccess = {
            success: true,
            domain: "law",
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

      const err: ThaiLawToolError = {
        success: false,
        error_code: "DB_ERROR",
        message,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(err) }] };
    }
  },
};

export function registerThaiLawTool(server: McpServer): void {
  server.registerTool(
    thaiLawTool.name,
    {
      title: "Thai Law Tool - ค้นหากฎหมายไทย",
      description: thaiLawTool.description,
      inputSchema: thaiLawTool.inputSchema,
    },
    thaiLawTool.execute,
  );
}

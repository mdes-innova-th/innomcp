import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";
import {
  THAI_KNOWLEDGE_DOMAINS,
  type ThaiKnowledgeDomain,
  type ThaiKnowledgeEntity,
} from "./thaiKnowledge.types";

const THAI_KNOWLEDGE_TOOL_NAME = "thaiKnowledgeTool";
const DEFAULT_CONFIDENCE_REQUIRED = 0.6;

const THAI_KNOWLEDGE_TOOL_DESC = `
หน้าที่: ค้นหาข้อมูลความรู้ไทย (Thai Knowledge) จากฐานข้อมูล
ใช้เมื่อ: ต้องการข้อมูลเฉพาะเจาะจงเกี่ยวกับประเทศไทย เช่น จังหวัด, กฎหมาย, วัด, บุคคลสำคัญ
Input:
- query: คำค้นหา
- context: { domain?: geo|law|history|religion|education, confidence_required?: number }
Output:
- JSON structure พร้อม confidence score
`;

const STUB_ENTITIES: ThaiKnowledgeEntity[] = [
  {
    id: "geo:korat:nakhon-ratchasima",
    domain: "geo",
    name_th: "นครราชสีมา",
    aliases: ["โคราช"],
    description: "จังหวัดนครราชสีมา (โคราช) อยู่ภาคตะวันออกเฉียงเหนือของประเทศไทย",
    attributes: {
      province: "นครราชสีมา",
      region: "อีสาน",
    },
    relations: [],
    source: { name: "stub" },
    confidence: 0.7,
    version: "0.0.0",
    updated_at: new Date().toISOString(),
  },
];

type ToolErrorBody = {
  success: false;
  error_code: "INVALID_QUERY" | "NOT_FOUND" | "LOW_CONFIDENCE" | "DB_ERROR";
  message: string;
  note?: string;
};

type ToolSuccessBody = {
  success: true;
  domain: ThaiKnowledgeDomain;
  data: ThaiKnowledgeEntity[];
  confidence: number;
  source: Array<{ name: string; url?: string }>;
  note: string;
};

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function looksLikeSchemaEntity(row: any): boolean {
  return (
    row &&
    typeof row.id === "string" &&
    typeof row.domain === "string" &&
    typeof row.name_th === "string" &&
    typeof row.description === "string" &&
    typeof row.version === "string" &&
    typeof row.updated_at === "string"
  );
}

function normalizeSource(value: unknown): { name: string; url?: string } {
  const parsed =
    typeof value === "string"
      ? safeJsonParse<unknown>(value, { name: "unknown" })
      : value;

  if (Array.isArray(parsed)) {
    const first = parsed.find(
      (item) => item && typeof item === "object" && typeof (item as any).name === "string",
    ) as { name: string; url?: string } | undefined;
    return first ?? { name: "unknown" };
  }

  if (parsed && typeof parsed === "object" && typeof (parsed as any).name === "string") {
    return { name: String((parsed as any).name), url: (parsed as any).url };
  }

  return { name: "unknown" };
}

function normalizeRowToEntity(row: any): ThaiKnowledgeEntity {
  const aliases =
    typeof row.aliases === "string"
      ? safeJsonParse(row.aliases, [])
      : Array.isArray(row.aliases)
        ? row.aliases
        : undefined;
  const attributes =
    typeof row.attributes === "string"
      ? safeJsonParse(row.attributes, {})
      : row.attributes && typeof row.attributes === "object"
        ? row.attributes
        : {};
  const relations =
    typeof row.relations === "string"
      ? safeJsonParse(row.relations, [])
      : Array.isArray(row.relations)
        ? row.relations
        : [];

  return {
    id: String(row.id),
    domain: row.domain as ThaiKnowledgeDomain,
    name_th: String(row.name_th),
    aliases,
    description: String(row.description ?? ""),
    attributes: attributes ?? {},
    relations: relations ?? [],
    source: normalizeSource(row.source),
    confidence: typeof row.confidence === "number" ? row.confidence : 1.0,
    version: String(row.version ?? "1.0.0"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function dedupeSources(entities: ThaiKnowledgeEntity[]): Array<{ name: string; url?: string }> {
  const map = new Map<string, { name: string; url?: string }>();
  for (const entity of entities) {
    const src = entity.source;
    const key = `${src.name}|${src.url ?? ""}`;
    if (!map.has(key)) {
      map.set(key, src);
    }
  }
  return Array.from(map.values());
}

function errorResult(body: ToolErrorBody): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
  };
}

function successResult(body: ToolSuccessBody): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
  };
}

export const thaiKnowledgeTool = {
  name: THAI_KNOWLEDGE_TOOL_NAME,
  description: THAI_KNOWLEDGE_TOOL_DESC,
  inputSchema: z.object({
    query: z.string().min(1),
    context: z
      .object({
        domain: z.enum(THAI_KNOWLEDGE_DOMAINS).optional(),
        language: z.string().default("th").optional(),
        confidence_required: z.number().min(0).max(1).default(DEFAULT_CONFIDENCE_REQUIRED).optional(),
      })
      .optional(),
  }),
  execute: async (rawArgs: unknown) => {
    const { query: rawQuery, context } = rawArgs as {
      query: string;
      context?: {
        domain?: ThaiKnowledgeDomain;
        confidence_required?: number;
      };
    };

    const searchTerm = String(rawQuery ?? "").trim();
    const domain = context?.domain;
    const confidenceRequired = context?.confidence_required ?? DEFAULT_CONFIDENCE_REQUIRED;

    if (!searchTerm) {
      return errorResult({
        success: false,
        error_code: "INVALID_QUERY",
        message: "query ต้องไม่เป็นค่าว่าง",
      });
    }

    try {
      let sql =
        "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
        "FROM knowledge_entities WHERE MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE)";
      const params: any[] = [searchTerm];

      if (domain) {
        sql += " AND domain = ?";
        params.push(domain);
      }

      sql += " LIMIT 5";

      const results = await query(sql, params);
      const entities: ThaiKnowledgeEntity[] = Array.isArray(results)
        ? results.filter((row) => looksLikeSchemaEntity(row)).map((row) => normalizeRowToEntity(row))
        : [];

      if (entities.length === 0) {
        return errorResult({
          success: false,
          error_code: "NOT_FOUND",
          message: `ไม่พบข้อมูลสำหรับ '${searchTerm}'`,
        });
      }

      const highestConfidence = Math.max(...entities.map((e) => e.confidence));
      if (highestConfidence < confidenceRequired) {
        return errorResult({
          success: false,
          error_code: "LOW_CONFIDENCE",
          message: `ผลลัพธ์มี confidence ${highestConfidence.toFixed(2)} ต่ำกว่าที่กำหนด ${confidenceRequired.toFixed(2)}`,
          note: "ปฏิเสธผลลัพธ์เพื่อป้องกันการเดา",
        });
      }

      return successResult({
        success: true,
        domain: (domain || entities[0].domain) as ThaiKnowledgeDomain,
        data: entities,
        confidence: highestConfidence,
        source: dedupeSources(entities),
        note: "พบข้อมูลความรู้ไทย",
      });
    } catch (error: any) {
      const message = String(error?.message ?? error);
      const code = String(error?.code ?? "");
      const isDbMissing =
        code === "ER_NO_SUCH_TABLE" ||
        code === "ER_BAD_DB_ERROR" ||
        /knowledge_entities/i.test(message) ||
        /no such table/i.test(message) ||
        /unknown database/i.test(message);

      if (isDbMissing) {
        const q = searchTerm.toLowerCase();
        const matched = STUB_ENTITIES.filter((e) => {
          if (domain && e.domain !== domain) return false;
          const inName = e.name_th.toLowerCase().includes(q);
          const inAliases = (e.aliases ?? []).some((a) => a.toLowerCase().includes(q));
          const inDesc = e.description.toLowerCase().includes(q);
          return inName || inAliases || inDesc;
        }).slice(0, 5);

        if (matched.length === 0) {
          return errorResult({
            success: false,
            error_code: "NOT_FOUND",
            message: `ไม่พบข้อมูลสำหรับ '${searchTerm}'`,
          });
        }

        const highestConfidence = Math.max(...matched.map((e) => e.confidence));
        if (highestConfidence < confidenceRequired) {
          return errorResult({
            success: false,
            error_code: "LOW_CONFIDENCE",
            message: `ผลลัพธ์มี confidence ${highestConfidence.toFixed(2)} ต่ำกว่าที่กำหนด ${confidenceRequired.toFixed(2)}`,
            note: "ปฏิเสธผลลัพธ์เพื่อป้องกันการเดา",
          });
        }

        return successResult({
          success: true,
          domain: (domain || matched[0].domain) as ThaiKnowledgeDomain,
          data: matched,
          confidence: highestConfidence,
          source: dedupeSources(matched),
          note: "Thai Knowledge DB not ready; using stub data",
        });
      }

      return errorResult({
        success: false,
        error_code: "DB_ERROR",
        message,
      });
    }
  },
};

export function registerThaiKnowledgeTool(server: McpServer) {
  (server.registerTool as any)(
    thaiKnowledgeTool.name,
    {
      title: "Thai Knowledge Tool",
      description: thaiKnowledgeTool.description,
      inputSchema: thaiKnowledgeTool.inputSchema,
    },
    thaiKnowledgeTool.execute,
  );
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";
import {
  THAI_KNOWLEDGE_DOMAINS,
  type ThaiKnowledgeDomain,
  type ThaiKnowledgeEntity,
  type ThaiKnowledgeLookupResponse,
} from "./thaiKnowledge.types";

const THAI_KNOWLEDGE_TOOL_NAME = "thaiKnowledgeTool";
const THAI_KNOWLEDGE_TOOL_DESC = `
หน้าที่: ค้นหาข้อมูลความรู้ไทย (Thai Knowledge) จากฐานข้อมูล
ใช้เมื่อ: ต้องการข้อมูลเฉพาะเจาะจงเกี่ยวกับประเทศไทย เช่น จังหวัด, กฎหมาย, วัด, บุคคลสำคัญ
Input:
- query: คำค้นหา
- domain: (optional) ขอบเขต เช่น geo, law, religion, history, education
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
  const source =
    typeof row.source === "string"
      ? safeJsonParse(row.source, { name: "unknown" })
      : row.source && typeof row.source === "object"
        ? row.source
        : { name: "unknown" };

  return {
    id: String(row.id),
    domain: row.domain as ThaiKnowledgeDomain,
    name_th: String(row.name_th),
    aliases,
    description: String(row.description ?? ""),
    attributes: attributes ?? {},
    relations: relations ?? [],
    source,
    confidence: typeof row.confidence === "number" ? row.confidence : 1.0,
    version: String(row.version ?? "1.0.0"),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const thaiKnowledgeTool = {
  name: THAI_KNOWLEDGE_TOOL_NAME,
  description: THAI_KNOWLEDGE_TOOL_DESC,
  inputSchema: z.object({
    query: z.string().describe("Search term"),
    domain: z.enum(THAI_KNOWLEDGE_DOMAINS).optional(),
  }),
  execute: async (args: any) => {
    const { query: searchTerm, domain } = args as {
      query: string;
      domain?: ThaiKnowledgeDomain;
    };

    try {
      let sql =
        "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
        "FROM knowledge_entities WHERE MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE)";
      const params: any[] = [searchTerm];

      if (domain) {
        sql += ` AND domain = ?`;
        params.push(domain);
      }

      sql += ` LIMIT 5`;

      const results = await query(sql, params);

      const entities: ThaiKnowledgeEntity[] = Array.isArray(results)
        ? results
          .filter((row) => looksLikeSchemaEntity(row))
          .map((row) => normalizeRowToEntity(row))
        : [];

      if (!entities || entities.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message: "Not found",
                data: {
                  query: searchTerm,
                  matched: [],
                  meta: { mode: "db", limit: 5 },
                } satisfies ThaiKnowledgeLookupResponse,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              data: {
                query: searchTerm,
                matched: entities,
                meta: { mode: "db", limit: 5 },
              } satisfies ThaiKnowledgeLookupResponse,
            }),
          },
        ],
      };
    } catch (error: any) {
      // Fallback to stub data if DB/schema not ready.
      const message = String(error?.message ?? error);
      const code = String(error?.code ?? "");
      const isDbMissing =
        code === "ER_NO_SUCH_TABLE" ||
        /knowledge_entities/i.test(message) ||
        /no such table/i.test(message) ||
        /unknown database/i.test(message);

      if (isDbMissing) {
        const q = String(searchTerm ?? "").trim();
        const qLower = q.toLowerCase();
        const matched = STUB_ENTITIES.filter((e) => {
          if (domain && e.domain !== domain) return false;
          if (!q) return false;
          const inName = e.name_th.toLowerCase().includes(qLower);
          const inAliases = (e.aliases ?? []).some((a) => a.toLowerCase().includes(qLower));
          const inDesc = e.description.toLowerCase().includes(qLower);
          return inName || inAliases || inDesc;
        }).slice(0, 5);

        const response: ThaiKnowledgeLookupResponse = {
          query: q,
          matched,
          meta: { mode: "stub", limit: 5 },
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: matched.length > 0,
                warning: "Thai Knowledge DB not ready; using stub data",
                error: message,
                data: response,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: error.message }),
          },
        ],
      };
    }
  },
};

export function registerThaiKnowledgeTool(server: McpServer) {
  server.registerTool(
    thaiKnowledgeTool.name,
    {
      title: "Thai Knowledge Tool",
      description: thaiKnowledgeTool.description,
      inputSchema: thaiKnowledgeTool.inputSchema,
    },
    thaiKnowledgeTool.execute,
  );
}

import { executeQuery } from "../utils/db/connector";

export interface ThaiKnowledgeQueryInput {
  query: string;
  filter_region?: string;
  limit?: number;
}

export interface ThaiKnowledgeRecord {
  id: string;
  name_th: string;
  aliases: string[];
  attributes: Record<string, any>;
  confidence: number;
}

export interface ThaiKnowledgeToolOutput {
  success: boolean;
  domain: "geo";
  data: ThaiKnowledgeRecord[];
  confidence: number;
  source: string;
  note: string;
}

function safeJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function safeJsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeThaiRegion(region?: string): string | undefined {
  const value = String(region || "").trim();
  if (!value) return undefined;
  if (value.startsWith("ภาค")) return value;
  return `ภาค${value}`;
}

function buildMatchTerm(query: string): string {
  return String(query || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `+${token}*`)
    .join(" ");
}

export async function thaiKnowledgeTool(input: ThaiKnowledgeQueryInput): Promise<ThaiKnowledgeToolOutput> {
  const query = String(input?.query || "").trim();
  const limit = Math.max(1, Math.min(Number(input?.limit || 8), 20));
  const region = normalizeThaiRegion(input?.filter_region);

  if (!query) {
    return {
      success: false,
      domain: "geo",
      data: [],
      confidence: 0,
      source: "knowledge_entities",
      note: "empty-query",
    };
  }

  const matchTerm = buildMatchTerm(query);
  const aliasLike = `%${query.toLowerCase()}%`;

  let sql =
    "SELECT id, name_th, aliases, attributes, confidence, " +
    "(MATCH(name_th) AGAINST (? IN BOOLEAN MODE) + IF(LOWER(CAST(aliases AS CHAR)) LIKE ?, 0.5, 0)) AS rel " +
    "FROM knowledge_entities " +
    "WHERE domain='geo' AND (MATCH(name_th) AGAINST (? IN BOOLEAN MODE) OR LOWER(CAST(aliases AS CHAR)) LIKE ?)";

  const params: any[] = [matchTerm, aliasLike, matchTerm, aliasLike];

  if (region) {
    sql += " AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.region'))) LIKE ?";
    params.push(`%${region.toLowerCase()}%`);
  }

  sql += " ORDER BY rel DESC, confidence DESC LIMIT ?";
  params.push(limit);

  try {
    const rows = (await executeQuery(sql, params)) as any[];
    const data: ThaiKnowledgeRecord[] = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: String(row.id || ""),
      name_th: String(row.name_th || ""),
      aliases: safeJsonArray(row.aliases),
      attributes: safeJsonObject(row.attributes),
      confidence: Number(row.confidence ?? 0.7),
    }));

    const topConfidence = data.length > 0 ? Math.max(...data.map((row) => Number(row.confidence || 0))) : 0;
    return {
      success: data.length > 0,
      domain: "geo",
      data,
      confidence: Number(topConfidence.toFixed(2)),
      source: "knowledge_entities",
      note: region ? `region-filter:${region}` : "ok",
    };
  } catch (error: any) {
    return {
      success: false,
      domain: "geo",
      data: [],
      confidence: 0,
      source: "knowledge_entities",
      note: `db-error:${String(error?.code || error?.message || "unknown")}`,
    };
  }
}

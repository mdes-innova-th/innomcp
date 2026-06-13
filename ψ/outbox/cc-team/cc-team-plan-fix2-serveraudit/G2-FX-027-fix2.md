<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-027 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3707,"completion_tokens":6949,"total_tokens":10656,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4981,"image_tokens":0},"cache_creation_input_tokens":0} | 64s
 generated: 2026-06-13T12:03:43.389Z -->
FILE: innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts
<<<<<<< SEARCH
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
=======
export class MariaDbHistoryDb implements HistoryDbAdapter {
  async search(rawQuery: string, limit: number = 5): Promise<ThaiHistoryEntity[]> {
    const q = rawQuery.trim();
    if (!q) return [];

    const safeLimit = (Number.isFinite(limit) && limit >= 1) ? Math.floor(limit) : 5;

    const like = `%${q}%`;

    const fulltextSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'history' AND MATCH(name_th, description) AGAINST(? IN NATURAL LANGUAGE MODE) " +
      "LIMIT ?";

    const likeSql =
      "SELECT id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at " +
      "FROM knowledge_entities WHERE domain = 'history' AND (name_th LIKE ? OR aliases LIKE ? OR description LIKE ? OR attributes LIKE ?) " +
      "LIMIT ?";

    const executeLikeQuery = async (): Promise<ThaiHistoryEntity[]> => {
      const likeRows = await query<any[]>(likeSql, [like, like, like, like, safeLimit]);
      return Array.isArray(likeRows) ? likeRows.map((r) => normalizeDbRowToEntity(r)) : [];
    };

    // Attempt fulltext search
    try {
      const rows = await query<any[]>(fulltextSql, [q, safeLimit]);
      const normalized = Array.isArray(rows) ? rows.map((r) => normalizeDbRowToEntity(r)) : [];
      if (normalized.length > 0) return normalized;

      // Fulltext succeeded but yielded no results; try LIKE query
      try {
        return await executeLikeQuery();
      } catch (likeError) {
        console.error("LIKE query failed after empty fulltext result:", likeError);
        throw new Error(`History search failed: ${(likeError as Error).message}`);
      }
    } catch (fulltextError) {
      console.error("Fulltext query failed, falling back to LIKE:", fulltextError);
      try {
        return await executeLikeQuery();
      } catch (likeError) {
        console.error("LIKE fallback query also failed:", likeError);
        throw new Error(
          `History search error: fulltext failed (${(fulltextError as Error).message}), LIKE fallback also failed (${(likeError as Error).message})`
        );
      }
    }
  }
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts
<<<<<<< SEARCH
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
=======
export class InMemoryHistoryDb implements HistoryDbAdapter {
  private readonly entities: ThaiHistoryEntity[];

  constructor(entities: ThaiHistoryEntity[]) {
    this.entities = JSON.parse(JSON.stringify(entities));
  }

  async search(queryText: string, limit: number = 5): Promise<ThaiHistoryEntity[]> {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];

    const scored = this.entities
      .map((e) => ({ entity: e, score: this.score(e, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => JSON.parse(JSON.stringify(s.entity)));
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
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts
<<<<<<< SEARCH
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
=======
function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return JSON.parse(JSON.stringify(value)) as T;
  if (typeof value !== "string") return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
>>>>>>> REPLACE

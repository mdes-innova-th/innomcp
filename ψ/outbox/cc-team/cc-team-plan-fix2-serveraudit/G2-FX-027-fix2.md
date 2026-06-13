<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-027 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3707,"completion_tokens":6963,"total_tokens":10670,"prompt_tokens_details":{"cached_tokens":3584,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5967,"image_tokens":0},"cache_creation_input_tokens":0} | 65s
 generated: 2026-06-13T12:07:26.245Z -->
FILE: innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts
<<<<<<< SEARCH
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
=======
  async search(rawQuery: string, limit: number = 5): Promise<ThaiHistoryEntity[]> {
    const q = rawQuery.trim();
    if (!q) return [];

    if (!Number.isInteger(limit) || limit < 1) {
      limit = 5;
    }

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
    } catch (fulltextErr) {
      console.error("Fulltext search failed, falling back to LIKE query", fulltextErr);
    }

    try {
      const likeRows = await query<any[]>(likeSql, [like, like, like, like, limit]);
      return Array.isArray(likeRows) ? likeRows.map((r) => normalizeDbRowToEntity(r)) : [];
    } catch (likeErr) {
      console.error("Fallback LIKE query failed", likeErr);
      throw new Error(`Database query failed for search "${q}"`, { cause: likeErr });
    }
  }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts
<<<<<<< SEARCH
  if (typeof value === "object") return value as T;
=======
  if (typeof value === "object") return structuredClone(value) as T;
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts
<<<<<<< SEARCH
  constructor(private readonly entities: ThaiHistoryEntity[]) {}
=======
  private readonly entities: ThaiHistoryEntity[];
  constructor(entities: ThaiHistoryEntity[]) {
    this.entities = structuredClone(entities);
  }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts
<<<<<<< SEARCH
    return scored.map((s) => s.entity);
=======
    return scored.map((s) => structuredClone(s.entity));
>>>>>>> REPLACE

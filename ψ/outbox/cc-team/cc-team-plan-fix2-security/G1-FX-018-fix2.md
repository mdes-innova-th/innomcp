<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-018 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2828,"completion_tokens":8000,"total_tokens":10828,"prompt_tokens_details":{"cached_tokens":2816,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5340,"image_tokens":0},"cache_creation_input_tokens":0} | 72s
 generated: 2026-06-13T11:47:27.992Z -->
FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
const MAX_SLOTS = 20;
const MAX_ENTITIES = 50;
=======
const MAX_SLOTS = 20;
const MAX_ENTITIES = 50;
const MAX_QUERY_LENGTH = 10240;  // 10 KB
const MAX_ENTITY_NAME_LENGTH = 1024;  // 1 KB
const MAX_ENTITY_VALUE_LENGTH = 1024; // 1 KB
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
function computeFreshness(timestampStr: string): "live" | "recent" | "stale" {
  const age = Date.now() - new Date(timestampStr).getTime();
  if (age < FRESHNESS_LIVE_MS) return "live";
  if (age < FRESHNESS_RECENT_MS) return "recent";
  return "stale";
}
=======
function computeFreshness(timestampStr: string): "live" | "recent" | "stale" {
  const age = Date.now() - new Date(timestampStr).getTime();
  if (age < FRESHNESS_LIVE_MS) return "live";
  if (age < FRESHNESS_RECENT_MS) return "recent";
  return "stale";
}

function sanitizeForPrompt(value: string): string {
  // Strip common instruction delimiters and escape special tokens
  return value
    .replace(/<\|.*?\|>/g, "")
    .replace(/system:/gi, "")
    .replace(/assistant:/gi, "")
    .replace(/user:/gi, "")
    .replace(/function:/gi, "")
    .trim();
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
  private sessions: Map<string, { slots: MemorySlot[]; turnCount: number }> = new Map();
  private readonly MAX_SESSIONS = 500;
  private readonly SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
=======
  private sessions: Map<string, { slots: MemorySlot[]; turnCount: number }> = new Map();
  private sessionOwners: Map<string, string> = new Map();
  private readonly MAX_SESSIONS = 500;
  private readonly SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
  private readonly SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

  /**
   * Record a turn's context into session memory.
   */
  recordTurn(
=======
  private readonly SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

  private assertOwner(sessionId: string, owner: string): void {
    const expected = this.sessionOwners.get(sessionId);
    if (expected !== undefined && expected !== owner) {
      throw new Error(`Authorization failed for session ${sessionId}`);
    }
  }

  /**
   * Record a turn's context into session memory.
   */
  recordTurn(
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
  recordTurn(
    sessionId: string,
    query: string,
    domain: MemoryDomain,
    entities: Omit<MemoryEntity, "sourceTurn" | "sourceQuery" | "timestamp" | "freshness">[],
    meta?: { route?: string; toolsUsed?: string[]; timeScope?: string }
  ): void {
    let session = this.sessions.get(sessionId);
    if (!session) {
      this.evictOldSessions();
      session = { slots: [], turnCount: 0 };
      this.sessions.set(sessionId, session);
    }

    session.turnCount++;
    const now = new Date().toISOString();

    const memEntities: MemoryEntity[] = entities.map((e) => ({
      ...e,
      sourceTurn: session!.turnCount,
      sourceQuery: query,
      timestamp: now,
      freshness: "live" as const,
    }));

    const slot: MemorySlot = {
      domain,
      entities: memEntities,
      timeScope: meta?.timeScope,
      turnNumber: session.turnCount,
      query,
      route: meta?.route,
      toolsUsed: meta?.toolsUsed,
      timestamp: now,
    };

    session.slots.push(slot);
    if (session.slots.length > MAX_SLOTS) {
      session.slots = session.slots.slice(-MAX_SLOTS);
    }
  }
=======
  recordTurn(
    sessionId: string,
    owner: string,
    query: string,
    domain: MemoryDomain,
    entities: Omit<MemoryEntity, "sourceTurn" | "sourceQuery" | "timestamp" | "freshness">[],
    meta?: { route?: string; toolsUsed?: string[]; timeScope?: string }
  ): void {
    let session = this.sessions.get(sessionId);
    if (!session) {
      this.evictOldSessions();
      session = { slots: [], turnCount: 0 };
      this.sessions.set(sessionId, session);
      this.sessionOwners.set(sessionId, owner);
    } else {
      const existingOwner = this.sessionOwners.get(sessionId);
      if (existingOwner !== undefined && existingOwner !== owner) {
        throw new Error(`Authorization failed for session ${sessionId}`);
      }
      if (existingOwner === undefined) {
        this.sessionOwners.set(sessionId, owner);
      }
    }

    // Input size validation
    if (query.length > MAX_QUERY_LENGTH) {
      throw new Error(`Query exceeds maximum length of ${MAX_QUERY_LENGTH}`);
    }
    for (const e of entities) {
      if (e.name.length > MAX_ENTITY_NAME_LENGTH) throw new Error(`Entity name exceeds maximum length of ${MAX_ENTITY_NAME_LENGTH}`);
      if (e.value.length > MAX_ENTITY_VALUE_LENGTH) throw new Error(`Entity value exceeds maximum length of ${MAX_ENTITY_VALUE_LENGTH}`);
    }

    session.turnCount++;
    const now = new Date().toISOString();
    const sanitizedQuery = sanitizeForPrompt(query);

    const memEntities: MemoryEntity[] = entities.map((e) => ({
      ...e,
      name: sanitizeForPrompt(e.name),
      value: sanitizeForPrompt(e.value),
      sourceTurn: session!.turnCount,
      sourceQuery: sanitizedQuery,
      timestamp: now,
      freshness: "live" as const,
    }));

    const slot: MemorySlot = {
      domain,
      entities: memEntities,
      timeScope: meta?.timeScope,
      turnNumber: session.turnCount,
      query: sanitizedQuery,
      route: meta?.route,
      toolsUsed: meta?.toolsUsed,
      timestamp: now,
    };

    session.slots.push(slot);
    if (session.slots.length > MAX_SLOTS) {
      session.slots = session.slots.slice(-MAX_SLOTS);
    }
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
  getSnapshot(sessionId: string): SessionMemorySnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        turnCount: 0,
        activeDomain: null,
        recentDomains: [],
        entities: [],
        slots: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Refresh freshness for all entities
    const allEntities: MemoryEntity[] = [];
    for (const slot of session.slots) {
      for (const ent of slot.entities) {
        ent.freshness = computeFreshness(ent.timestamp);
        allEntities.push(ent);
      }
    }

    // Deduplicate entities by name+type, keep latest
    const entityMap = new Map<string, MemoryEntity>();
    for (const ent of allEntities) {
      const key = `${ent.type}:${ent.name}`;
      const existing = entityMap.get(key);
      if (!existing || ent.sourceTurn > existing.sourceTurn) {
        entityMap.set(key, ent);
      }
    }
    const uniqueEntities = [...entityMap.values()].slice(-MAX_ENTITIES);

    const lastSlot = session.slots[session.slots.length - 1];
    const recentDomains = session.slots
      .slice(-5)
      .map((s) => s.domain)
      .filter((d, i, arr) => arr.indexOf(d) === i);

    return {
      sessionId,
      turnCount: session.turnCount,
      activeDomain: lastSlot?.domain ?? null,
      recentDomains,
      entities: uniqueEntities,
      slots: session.slots.slice(-10),
      lastUpdated: lastSlot?.timestamp ?? new Date().toISOString(),
    };
  }
=======
  getSnapshot(sessionId: string, owner: string): SessionMemorySnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        turnCount: 0,
        activeDomain: null,
        recentDomains: [],
        entities: [],
        slots: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    this.assertOwner(sessionId, owner);

    // Refresh freshness for all entities
    const allEntities: MemoryEntity[] = [];
    for (const slot of session.slots) {
      for (const ent of slot.entities) {
        ent.freshness = computeFreshness(ent.timestamp);
        allEntities.push(ent);
      }
    }

    // Deduplicate entities by name+type, keep latest
    const entityMap = new Map<string, MemoryEntity>();
    for (const ent of allEntities) {
      const key = `${ent.type}:${ent.name}`;
      const existing = entityMap.get(key);
      if (!existing || ent.sourceTurn > existing.sourceTurn) {
        entityMap.set(key, ent);
      }
    }
    const uniqueEntities = [...entityMap.values()].slice(-MAX_ENTITIES);

    const lastSlot = session.slots[session.slots.length - 1];
    const recentDomains = session.slots
      .slice(-5)
      .map((s) => s.domain)
      .filter((d, i, arr) => arr.indexOf(d) === i);

    return {
      sessionId,
      turnCount: session.turnCount,
      activeDomain: lastSlot?.domain ?? null,
      recentDomains,
      entities: uniqueEntities,
      slots: session.slots.slice(-10),
      lastUpdated: lastSlot?.timestamp ?? new Date().toISOString(),
    };
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
  getEntitiesByDomain(sessionId: string, domain: MemoryDomain): MemoryEntity[] {
    return this.getSnapshot(sessionId).entities.filter((e) => e.domain === domain);
  }
=======
  getEntitiesByDomain(sessionId: string, domain: MemoryDomain, owner: string): MemoryEntity[] {
    return this.getSnapshot(sessionId, owner).entities.filter((e) => e.domain === domain);
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionMemory.ts
<<<<<<< SEARCH
  getLastEntity(sessionId: string, type: MemoryEntity["type"]): MemoryEntity | null {
    const entities = this.getSnapshot(sessionId).entities.filter((e) => e.type === type);
    return entities.length > 0 ? entities[entities.length - 1] : null;
  }
=======
  getLastEntity(sessionId: string, type: MemoryEntity["type"], owner: string): MemoryEntity | null {
    const entities = this.getSnapshot(sessionId, owner).entities.filter((e) => e.type === type);
    return entities.length

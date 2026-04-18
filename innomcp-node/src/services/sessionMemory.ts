/**
 * Session Memory Service — grounded conversational memory
 * Tracks entities, domains, and context per session for carry-forward resolution.
 * Memory is session-scoped (in-memory Map), no long-term persistence.
 */

export interface MemoryEntity {
  name: string;
  type: "province" | "region" | "isp" | "url" | "concept" | "timeScope" | "person" | "org";
  value: string;
  domain: MemoryDomain;
  sourceTurn: number;
  sourceQuery: string;
  timestamp: string;
  freshness: "live" | "recent" | "stale";
  confidence: number;
}

export type MemoryDomain = "weather" | "evidence" | "geo" | "knowledge" | "calculator" | "datetime" | "general" | "mixed";

export interface MemorySlot {
  domain: MemoryDomain;
  entities: MemoryEntity[];
  timeScope?: string;
  turnNumber: number;
  query: string;
  route?: string;
  toolsUsed?: string[];
  timestamp: string;
}

export interface SessionMemorySnapshot {
  sessionId: string;
  turnCount: number;
  activeDomain: MemoryDomain | null;
  recentDomains: MemoryDomain[];
  entities: MemoryEntity[];
  slots: MemorySlot[];
  lastUpdated: string;
}

const FRESHNESS_LIVE_MS = 5 * 60 * 1000;    // 5 min
const FRESHNESS_RECENT_MS = 30 * 60 * 1000; // 30 min
const MAX_SLOTS = 20;
const MAX_ENTITIES = 50;

function computeFreshness(timestampStr: string): "live" | "recent" | "stale" {
  const age = Date.now() - new Date(timestampStr).getTime();
  if (age < FRESHNESS_LIVE_MS) return "live";
  if (age < FRESHNESS_RECENT_MS) return "recent";
  return "stale";
}

export class SessionMemoryStore {
  private sessions: Map<string, { slots: MemorySlot[]; turnCount: number }> = new Map();
  private readonly MAX_SESSIONS = 500;
  private readonly SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

  /**
   * Record a turn's context into session memory.
   */
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

  /**
   * Get a snapshot of session memory for inspection / debug.
   */
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

  /**
   * Get entities by domain from session memory.
   */
  getEntitiesByDomain(sessionId: string, domain: MemoryDomain): MemoryEntity[] {
    return this.getSnapshot(sessionId).entities.filter((e) => e.domain === domain);
  }

  /**
   * Get the most recent entity of a given type.
   */
  getLastEntity(sessionId: string, type: MemoryEntity["type"]): MemoryEntity | null {
    const entities = this.getSnapshot(sessionId).entities.filter((e) => e.type === type);
    return entities.length > 0 ? entities[entities.length - 1] : null;
  }

  /**
   * Get the active domain from the last turn.
   */
  getActiveDomain(sessionId: string): MemoryDomain | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.slots.length === 0) return null;
    return session.slots[session.slots.length - 1].domain;
  }

  /**
   * Check if session has any memory.
   */
  hasMemory(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return !!session && session.slots.length > 0;
  }

  /**
   * Clear session memory.
   */
  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private evictOldSessions(): void {
    if (this.sessions.size < this.MAX_SESSIONS) return;
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      const lastSlot = session.slots[session.slots.length - 1];
      if (!lastSlot || now - new Date(lastSlot.timestamp).getTime() > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
    // If still over limit, evict oldest
    if (this.sessions.size >= this.MAX_SESSIONS) {
      const first = this.sessions.keys().next().value;
      if (first) this.sessions.delete(first);
    }
  }
}

// Singleton instance
export const sessionMemory = new SessionMemoryStore();

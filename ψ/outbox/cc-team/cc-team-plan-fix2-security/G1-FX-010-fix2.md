<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-010 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3392,"completion_tokens":6775,"total_tokens":10167,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5470,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:36:27.037Z -->
FILE: innomcp-node/src/services/memoryRagHook.ts
<<<<<<< SEARCH
export function recordTurnAndGetMeta(
  sessionId: string,
  query: string,
  route: string,
  toolsUsed: string[],
  toolResult?: any
): MemoryRagMeta {
  // Guard: empty sessionId would create a degenerate shared key "" in the memory
  // store, potentially polluting session context across unrelated requests.
  if (!sessionId.trim()) {
    return {
      memoryUsed: false, memoryEntities: [], retrievalMode: "none",
      retrievalReason: "no-session-id", coldDocHits: 0, coldContext: "",
      hotFactCount: 0, sessionTurnCount: 0, activeDomain: null,
    };
  }
  const domain = routeToDomain(route);
  const entities = extractEntities(query, route, toolResult);

  // 1. Record in session memory
  sessionMemory.recordTurn(sessionId, query, domain, entities, {
    route,
    toolsUsed,
  });

  // 2. Check memory state
  const snapshot = sessionMemory.getSnapshot(sessionId);
  const memoryEntities = snapshot.entities.map((e) => `${e.type}:${e.name}`);

  // 3. Plan retrieval (doesn't execute — just decides)
  const plan = planRetrieval(query, route, snapshot);

  // 4. If cold retrieval needed and ready, execute
  let coldDocHits = 0;
  let coldContext = "";
  if (plan.decision === "cold" || plan.decision === "hot+cold") {
    const coldResults = executeColdRetrieval(plan);
    coldDocHits = coldResults.length;
    if (coldResults.length > 0) {
      coldContext = coldResults
        .map((r) => `[${r.document.title}] ${r.chunk.content}`)
        .join("\n\n---\n\n");
    }
  }

  return {
    memoryUsed: snapshot.entities.length > 0,
    memoryEntities,
    retrievalMode: plan.decision === "hot+cold" ? "both" : plan.decision === "none" ? "none" : plan.decision as RetrievalMode,
    retrievalReason: plan.reason,
    coldDocHits,
    coldContext,
    hotFactCount: toolsUsed.length > 0 ? 1 : 0,
    sessionTurnCount: snapshot.turnCount,
    activeDomain: snapshot.activeDomain,
  };
}
=======
export function recordTurnAndGetMeta(
  sessionId: string,
  query: string,
  route: string,
  toolsUsed: string[],
  toolResult?: any,
  ownerUserId?: string
): MemoryRagMeta {
  // Guard: empty sessionId would create a degenerate shared key "" in the memory
  // store, potentially polluting session context across unrelated requests.
  if (!sessionId.trim()) {
    return {
      memoryUsed: false, memoryEntities: [], retrievalMode: "none",
      retrievalReason: "no-session-id", coldDocHits: 0, coldContext: "",
      hotFactCount: 0, sessionTurnCount: 0, activeDomain: null,
    };
  }

  // Authorization: verify that sessionId belongs to the caller if ownerUserId provided.
  if (ownerUserId != null) {
    const snapshot = sessionMemory.getSnapshot(sessionId);
    // If snapshot already has an ownerUserId that differs, reject the request.
    if ((snapshot as any).ownerUserId && (snapshot as any).ownerUserId !== ownerUserId) {
      console.warn(`[MemoryRag] Unauthorized access to session ${sessionId} for user ${ownerUserId} (owned by ${(snapshot as any).ownerUserId})`);
      return {
        memoryUsed: false, memoryEntities: [], retrievalMode: "none",
        retrievalReason: "unauthorized-session", coldDocHits: 0, coldContext: "",
        hotFactCount: 0, sessionTurnCount: 0, activeDomain: null,
      };
    }
    // If no ownerUserId stored yet, this is the first access – ownership will be established below.
  }

  const domain = routeToDomain(route);
  const entities = extractEntities(query, route, toolResult);

  // 1. Record in session memory, attaching ownerUserId when available.
  sessionMemory.recordTurn(sessionId, query, domain, entities, {
    route,
    toolsUsed,
    ...(ownerUserId ? { ownerUserId } : {}),
  });

  // 2. Check memory state
  const snapshot = sessionMemory.getSnapshot(sessionId);
  const memoryEntities = snapshot.entities.map((e) => `${e.type}:${e.name}`);

  // 3. Plan retrieval (doesn't execute — just decides)
  const plan = planRetrieval(query, route, snapshot);

  // 4. If cold retrieval needed and ready, execute
  let coldDocHits = 0;
  let coldContext = "";
  if (plan.decision === "cold" || plan.decision === "hot+cold") {
    const coldResults = executeColdRetrieval(plan);
    coldDocHits = coldResults.length;
    if (coldResults.length > 0) {
      coldContext = coldResults
        .map((r) => `[${r.document.title}] ${r.chunk.content}`)
        .join("\n\n---\n\n");
    }
  }

  return {
    memoryUsed: snapshot.entities.length > 0,
    memoryEntities,
    retrievalMode: plan.decision === "hot+cold" ? "both" : plan.decision === "none" ? "none" : plan.decision as RetrievalMode,
    retrievalReason: plan.reason,
    coldDocHits,
    coldContext,
    hotFactCount: toolsUsed.length > 0 ? 1 : 0,
    sessionTurnCount: snapshot.turnCount,
    activeDomain: snapshot.activeDomain,
  };
}
>>>>>>> REPLACE

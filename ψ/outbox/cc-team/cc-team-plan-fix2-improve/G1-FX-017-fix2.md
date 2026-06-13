<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-017 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1673,"completion_tokens":5553,"total_tokens":7226,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4778,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T11:37:59.615Z -->
FILE: innomcp-node/src/services/answerContract.ts
<<<<<<< SEARCH
  // Compute aggregate freshness
  let freshness: AnswerContract["freshness"] = "stale";
  if (params.sources.length > 0) {
    const freshnessValues = params.sources.map((s) => s.freshness);
    const hasLive = freshnessValues.includes("live");
    const hasStale = freshnessValues.includes("stale");
    if (hasLive && hasStale) freshness = "mixed";
    else if (hasLive) freshness = "live";
    else if (freshnessValues.includes("recent")) freshness = "recent";
  } else if (params.answerMode === "deterministic") {
    freshness = "live";
  }
=======
  // Compute aggregate freshness
  let freshness: AnswerContract["freshness"] = "stale";
  if (params.sources.length > 0) {
    const uniqueFreshness = new Set(params.sources.map((s) => s.freshness));
    if (uniqueFreshness.size > 1) {
      freshness = "mixed";
    } else if (uniqueFreshness.has("live")) {
      freshness = "live";
    } else if (uniqueFreshness.has("recent")) {
      freshness = "recent";
    } else {
      freshness = "stale";
    }
  } else if (params.answerMode === "deterministic") {
    freshness = "live";
  }
>>>>>>> REPLACE
FILE: innomcp-node/src/services/answerContract.ts
<<<<<<< SEARCH
  return {
    route: params.route,
    toolsUsed: params.toolsUsed,
    sourceIds: params.sources.map((s) => s.id),
    sources: params.sources,
    grounded: params.grounded,
    answerMode: params.answerMode,
    fallbackReason: params.fallbackReason,
    freshness,
    confidence: params.confidence,
    memoryUsed: params.memoryUsed,
    memoryEntities: params.memoryEntities,
    retrievalUsed: params.retrievalUsed,
    hotSources: hotSources.length > 0 ? hotSources : undefined,
    coldSources: coldSources.length > 0 ? coldSources : undefined,
    timestamp: now,
    latencyMs: params.latencyMs,
    degraded: params.degraded ?? false,
    degradedReasons: params.degradedReasons,
  };
=======
  return {
    route: params.route,
    toolsUsed: [...params.toolsUsed],
    sourceIds: params.sources.map((s) => s.id),
    sources: [...params.sources],
    grounded: params.grounded,
    answerMode: params.answerMode,
    fallbackReason: params.fallbackReason,
    freshness,
    confidence: params.confidence,
    memoryUsed: params.memoryUsed,
    memoryEntities: params.memoryEntities ? [...params.memoryEntities] : undefined,
    retrievalUsed: params.retrievalUsed,
    hotSources: hotSources.length > 0 ? hotSources : undefined,
    coldSources: coldSources.length > 0 ? coldSources : undefined,
    timestamp: now,
    latencyMs: params.latencyMs,
    degraded: params.degraded ?? false,
    degradedReasons: params.degradedReasons ? [...params.degradedReasons] : undefined,
  };
>>>>>>> REPLACE
FILE: innomcp-node/src/services/answerContract.ts
<<<<<<< SEARCH
    confidence: params.confidence,
=======
    confidence: Math.max(0, Math.min(1, params.confidence)),
>>>>>>> REPLACE

/**
 * Answer Contract — structured metadata for every grounded answer.
 * Extends the existing __groundedContract with memory/retrieval fields.
 */

export type AnswerMode = "deterministic" | "llm-rewrite" | "hybrid" | "llm-only";
export type RetrievalMode = "hot" | "cold" | "both" | "none";

export interface RetrievalSource {
  id: string;
  type: "tool" | "document" | "database" | "api";
  name: string;
  path?: string;
  freshness: "live" | "recent" | "stale";
  timestamp: string;
  confidence: number;
}

export interface AnswerContract {
  // Route info
  route: string;
  toolsUsed: string[];
  
  // Source tracking
  sourceIds: string[];
  sources: RetrievalSource[];
  grounded: boolean;
  
  // Answer classification
  answerMode: AnswerMode;
  fallbackReason?: string;
  
  // Freshness
  freshness: "live" | "recent" | "stale" | "mixed";
  confidence: number;
  
  // Memory integration
  memoryUsed: boolean;
  memoryEntities?: string[];
  
  // Retrieval
  retrievalUsed: RetrievalMode;
  hotSources?: RetrievalSource[];
  coldSources?: RetrievalSource[];
  
  // Timing
  timestamp: string;
  latencyMs?: number;
  
  // Degraded state
  degraded: boolean;
  degradedReasons?: string[];
}

/**
 * Build an answer contract from the routing result.
 */
export function buildAnswerContract(params: {
  route: string;
  toolsUsed: string[];
  sources: RetrievalSource[];
  answerMode: AnswerMode;
  retrievalUsed: RetrievalMode;
  memoryUsed: boolean;
  memoryEntities?: string[];
  confidence: number;
  grounded: boolean;
  fallbackReason?: string;
  degraded?: boolean;
  degradedReasons?: string[];
  latencyMs?: number;
}): AnswerContract {
  const now = new Date().toISOString();
  
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

  const hotSources = params.sources.filter((s) => s.type === "tool" || s.type === "api" || s.type === "database");
  const coldSources = params.sources.filter((s) => s.type === "document");

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
}

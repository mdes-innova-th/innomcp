<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-017 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3126,"completion_tokens":5957,"total_tokens":9083,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5626,"image_tokens":0},"cache_creation_input_tokens":0} | 68s
 generated: 2026-06-13T11:43:39.435Z -->
FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
  const q = query.trim();
=======
  const q = query.trim().slice(0, 500);
>>>>>>> REPLACE

FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
export function executeColdRetrieval(plan: RetrievalPlan): ColdRetrievalResult[] {
  if (!plan.coldQuery || (plan.decision !== "cold" && plan.decision !== "hot+cold")) {
    return [];
  }

  if (!coldRetriever.isReady()) {
    return [];
  }

  return coldRetriever.search(plan.coldQuery, { maxResults: 3 });
}
=======
function sanitizeColdQuery(query: string): string {
  return query.replace(/[^\p{L}\p{N}\s.,?!:;()\-_]/gu, ' ').trim();
}

export function executeColdRetrieval(plan: RetrievalPlan): ColdRetrievalResult[] {
  if (!plan.coldQuery || (plan.decision !== "cold" && plan.decision !== "hot+cold")) {
    return [];
  }

  if (!coldRetriever.isReady()) {
    return [];
  }

  const sanitized = sanitizeColdQuery(plan.coldQuery);
  if (!sanitized) return [];
  return coldRetriever.search(sanitized, { maxResults: 3 });
}
>>>>>>> REPLACE

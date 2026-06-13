<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-025 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1918,"completion_tokens":578,"total_tokens":2496,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":298,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T12:00:26.014Z -->
**Module**: `hotRetriever.ts`  
**Single Responsibility**: Normalizes real-time tool results (weather, evidence, calculators) into structured `RetrievalFact` objects for live-data retrieval (“Hot RAG”).  

**Key Exported API**:  
- `RetrievalFact` interface  
- `normalizeWeatherFacts`, `normalizeEvidenceFacts`, `normalizeDeterministicFact`  
- `mergeRetrievalFacts`, `composeFactSummary`  

**Upstream Callers**: Tool-execution pipelines (e.g., weather, evidence, calculator tools) that return raw results.  
**Downstream Deps**: `answerContract` (imports `RetrievalSource`); answer composition layer that calls `composeFactSummary` to format facts for LLM prompting.  

**Role in Pipeline**: Post-tool execution, facts are normalized and merged, then summarized into a context block for agent answer generation.  

**Surprising Coupling**:  
- Hardcoded Thai province/ISP regex patterns in helpers (`extractWeatherEntities`, `extractISP`), tying a generic “hot retriever” to a specific locale.  
- Static confidence values baked per normalizer.  
- Mutable module-level counter for fact IDs — not isolated across invocations, making testing/multi-tenant reuse fragile.

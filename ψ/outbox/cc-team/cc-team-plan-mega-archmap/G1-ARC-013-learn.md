<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-013 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1122,"completion_tokens":653,"total_tokens":1775,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":318,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T11:59:19.013Z -->
**Single Responsibility:** Defines the canonical structure (`AnswerContract`) and builder for structured metadata attached to every grounded answer—aggregating route, sources, freshness, memory, retrieval mode, confidence, degraded state, and timing.

**Key Exported API:**  
- Types: `AnswerContract`, `AnswerMode`, `RetrievalMode`, `RetrievalSource`.  
- Function: `buildAnswerContract(params)` – constructs a contract from routing results, computes aggregate freshness, separates hot/cold sources, and normalizes confidence.

**Upstream Callers:** Answer orchestration/pipeline stages that produce a final answer (router, LLM handler, fallback) and need to stamp it with provenance and quality metadata before returning to the client or logging.

**Downstream Dependencies:** Pure TypeScript; depends only on standard `Date` and array methods. No service imports.

**Pipeline Role:** Post‑processing metadata envelope. It standardizes observability data—capturing which tools/memory were used, source freshness, and degradation—enabling downstream audit, debugging, and analytics without scattering logic across the pipeline.

**Surprising Coupling:** The hard‑coded hot/cold classification (`type === "tool"|"api"|"database"` → hot, `"document"` → cold) ties the builder to specific source type strings. Adding a new source type (e.g., `"vector-index"`) silently classifies it as cold or omitted from hot/cold arrays, which may cause subtle mismatches in freshness/reporting. Deterministic answers are unconditionally marked `"live"` even with zero sources.

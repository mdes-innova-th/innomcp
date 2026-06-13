<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D021 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2469,"completion_tokens":1418,"total_tokens":3887,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":477,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T11:22:22.314Z -->
- **`RetrievalDecision`** – Union type representing the four possible retrieval paths: `"hot"`, `"cold"`, `"hot+cold"`, or `"none"`.
  No `@param` or `@returns` (type alias).

---

- **`RetrievalPlan`** – Interface describing the orchestration plan: which retrieval mode to use, which hot domains to query, an optional cold query string, and a human-readable reason for the decision.
  No `@param` or `@returns`.

---

- **`RetrievalResult`** – Interface representing the complete output of a retrieval run: the plan that was executed, hot and cold results, a composed textual `factSummary`, a deduplicated list of `sources`, and the meta‑information in the `contract`.
  No `@param` or `@returns`.

---

- **`planRetrieval(query, route?, memory?)`** – Decides which retrieval mode to use based on the query text and optional route/memory context.  
  - `@param query` – The user’s input string (trimmed internally).  
  - `@param route` – Optional route hint (e.g. `"calculator"`, `"weather"`) that can short‑circuit or guide the decision.  
  - `@param memory` – Optional `SessionMemorySnapshot` used for domain continuation when the active domain is operational (e.g. `"weather"`).  
  - `@returns` – A `RetrievalPlan` object with the chosen decision and reasoning.  
  - **Caveats**: Deterministic routes (`"calculator"`, `"datetime"`) immediately yield `"none"`. Pattern matching is applied in order: mixed patterns, cold‑only, hot‑only, then memory fallback. The cold retriever must be `isReady()` for a cold‑only decision; otherwise it degrades to `"none"`. Recent memory domain can override the default `"none"` path.

---

- **`executeColdRetrieval(plan)`** – Executes cold (document‑based) retrieval according to the plan, if applicable.  
  - `@param plan` – A `RetrievalPlan` that must have a `coldQuery` and a decision of `"cold"` or `"hot+cold"`.  
  - `@returns` – An array of `ColdRetrievalResult` (up to 3 results). Returns `[]` if the cold retriever is not ready or if the plan doesn’t require cold retrieval.  
  - **Caveats**: Silently returns empty if `coldRetriever.isReady()` is false. The query used is `plan.coldQuery` (trimmed/extracted by `planRetrieval`).

---

- **`buildRetrievalResult(plan, hotFacts, coldResults, meta)`** – Assembles a full `RetrievalResult` from the plan, hot facts, cold results, and metadata.  
  - `@param plan` – The `RetrievalPlan` that was executed.  
  - `@param hotFacts` – Array of `RetrievalFact` from hot retrieval (may be empty).  
  - `@param coldResults` – Array of `ColdRetrievalResult` from cold retrieval (may be empty).  
  - `@param meta` – Object containing route, tools used, answer mode, memory usage, confidence, latency, degradation flags, etc.  
  - `@returns` – A `RetrievalResult` with `retrievalUsed` determined by the presence of facts (`"none"`, `"hot"`, `"cold"`, or `"both"`). The `factSummary` is composed by concatenating hot and cold summaries separated by `"\n\n---\n\n"`. The `contract` is built via `buildAnswerContract` with all provided metadata.  
  - **Caveats**: The `retrievalUsed` mode is derived from the lengths of `hotFacts` and `coldResults` arrays, not from the plan’s `decision`. If both arrays are non‑empty it becomes `"both"`, otherwise whichever is non‑empty, or `"none"`. The hot summary is produced by `composeFactSummary` (imported) and cold summary by string‑interpolating document title and chunk content.

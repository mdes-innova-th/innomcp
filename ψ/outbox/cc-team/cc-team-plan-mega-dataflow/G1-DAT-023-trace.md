<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-023 role=trace model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":2232,"completion_tokens":4858,"total_tokens":7090,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3082,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T12:03:46.462Z -->
**Trace through `retrievalOrchestrator.ts`**  
*Ordered by the typical caller pipeline: `planRetrieval` → `executeColdRetrieval` → `buildRetrievalResult`*

---

**1. Entry into `planRetrieval`**  
- **What enters:**  
  - `query: string` (raw user text, e.g., `"อากาศวันนี้และอธิบายว่าฝนตกหมายถึงอะไร"`)  
  - `route?: string` (e.g., `"weather"`, `"calculator"`, `undefined`)  
  - `memory?: SessionMemorySnapshot | null` (e.g., `{ activeDomain: "weather", ... }`)  
- **Source:** Upstream intent router / session manager.

**2. Query normalization**  
- `query` is trimmed and sliced to the first 500 chars → local `q`.  
- **Shape:** `string` (bounded).  
- **Side-effects:** None.

**3. Deterministic route short-circuit**  
- If `route` is `"calculator"` or `"datetime"`, function returns immediately.  
- **What exits:** `RetrievalPlan`  
  ```ts
  { decision: "none", hotDomains: [], reason: "deterministic_route" }
  ```

**4. Mixed-pattern detection**  
- `q` is tested against 4 `MIXED_PATTERNS` regexes (e.g., `/.*และ.*อธิบาย/...`).  
- **If match:** calls pure helpers `inferHotDomains(q, route)` → `string[]`, and `extractColdQuery(q)` → `string`.  
- **What exits:**  
  ```ts
  { decision: "hot+cold", hotDomains: ["weather"], coldQuery: "อธิบายว่าฝนตกหมายถึงอะไร", reason: "mixed_hot_cold_query" }
  ```

**5. Cold-only / Hot-only flag extraction**  
- `q` tested against 6 `COLD_ONLY_PATTERNS` (e.g., `/คืออะไร/`, `/นโยบาย/`) → `hasColdPattern: boolean`.  
- `q` tested against 6 `HOT_ONLY_PATTERNS` (e.g., `/อากาศ.*วันนี้/`, `/ตอนนี้/`) → `hasHotPattern: boolean`.

**6. Branch: Both patterns detected**  
- If `hasColdPattern && hasHotPattern`: same helper calls as step 4.  
- **What exits:** `RetrievalPlan` with `decision: "hot+cold"`, `reason: "both_patterns_detected"`.

**7. Branch: Cold-only with readiness check**  
- If `hasColdPattern && !hasHotPattern`:  
  - **Side-effect (state read):** `coldRetriever.isReady()` is queried.  
  - If `true`: exits with `decision: "cold"`, `coldQuery: q`, `reason: "documentation_policy_query"`.  
  - If `false`: **falls through** to step 8 (does not return here).

**8. Branch: Operational / live query or routed hot domain**  
- If `hasHotPattern` OR `route` ∈ `["weather", "evidence", "geo", "seismic"]`:  
  - Calls `inferHotDomains(q, route)` → domains list.  
- **What exits:** `RetrievalPlan` with `decision: "hot"`, `reason: "operational_live_query"`.

**9. Branch: Memory domain continuation**  
- If `memory?.activeDomain` exists and is `"weather" | "evidence" | "geo"`:  
- **What exits:** `RetrievalPlan` with `decision: "hot"`, `hotDomains: [domain]`, `reason: "memory_domain_continuation"`.

**10. Default: No retrieval**  
- If none of the above branches trigger.  
- **What exits:**  
  ```ts
  { decision: "none", hotDomains: [], reason: "no_retrieval_pattern" }
  ```

---

**11. Entry into `executeColdRetrieval`**  
- **What enters:** `RetrievalPlan` object produced in steps 3–10.  
- **Source:** Caller (orchestrator / dispatcher).

**12. Guard: Decision & query presence**  
- Checks `plan.coldQuery` is truthy AND `plan.decision` is `"cold"` or `"hot+cold"`.  
- **If false:** exits with `[]` (empty `ColdRetrievalResult[]`).

**13. Guard: Cold retriever readiness**  
- **Side-effect (state read):** `coldRetriever.isReady()` queried again.  
- **If false:** exits with `[]`.

**14. External search execution**  
- Calls `coldRetriever.search(plan.coldQuery, { maxResults: 3 })`.  
- **Side-effect (network / disk / vector DB I/O):** Performs the actual cold retrieval against the document index.  
- **What exits:** `ColdRetrievalResult[]` (0–3 items).  
- **Destination:** Returned to caller; typically fed into `buildRetrievalResult` next.

---

**15. Entry into `buildRetrievalResult`**  
- **What enters:**  
  - `plan: RetrievalPlan` (from step 10)  
  - `hotFacts: RetrievalFact[]` (from upstream hot retriever, not from this module)  
  - `coldResults: ColdRetrievalResult[]` (from step 14)  
  - `meta: { route, toolsUsed, answerMode, memoryUsed, memoryEntities?, grounded, confidence, latencyMs?, degraded?, degradedReasons? }`  
- **Source:** Orchestrator assembling the final context.

**16. Source extraction & mode classification**  
- Maps `hotFacts.map(f => f.source)` → `hotSources: RetrievalSource[]`.  
- Maps `coldResults.map(r => r.source)` → `coldSources: RetrievalSource[]`.  
- Concatenates: `allSources = [...hotSources, ...coldSources]`.  
- Derives `retrievalUsed`:  
  - `"both"` if both arrays non-empty  
  - `"hot"` | `"cold"` | `"none"` otherwise.

**17. Fact summary composition**  
- Calls `composeFactSummary(hotFacts)` → `hotSummary: string`.  
- Transforms cold results:  
  ```ts
  coldResults.map(r => `[doc:${r.document.title}] ${r.chunk.content}`).join("\n\n")
  ```  
  → `coldSummary: string`.  
- Joins: `factSummary = [hotSummary, coldSummary].filter(Boolean).join("\n\n---\n\n")`.

**18. Answer contract construction**  
- Calls `buildAnswerContract({ ...meta, sources: allSources, retrievalUsed })` → `contract: AnswerContract`.  
- Pure transformation; no side-effects.

**19. Final assembly & exit**  
- **What exits:** `RetrievalResult` object:  
  ```ts
  {
    plan,           // original plan
    hotFacts,       // passthrough
    coldResults,    // passthrough
    factSummary,    // composed string
    sources,        // unified RetrievalSource[]
    contract,       // AnswerContract
  }
  ```  
- **Destination:** Returned to caller (answer synthesizer / LLM prompt builder).

---

**20. Side-effects inventory (module-level)**  
- **State reads:** `coldRetriever.isReady()` — checked in `planRetrieval` (step 7) and `executeColdRetrieval` (step 13). Reads external module readiness state.  
- **External I/O:** `coldRetriever.search(...)` — vector/index lookup (step 14). Potential network or disk latency.  
- **No DB writes, no event emissions, no global/module mutable state updates, no logging.**

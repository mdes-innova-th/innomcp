<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-013 role=trace model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1918,"completion_tokens":2537,"total_tokens":4455,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1531,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T12:01:26.607Z -->
```step
1. **Entry: Function call**  
   External caller (e.g., Hot RAG orchestrator) invokes a normalization function with a raw tool result and the user query.  
   - `normalizeWeatherFacts(toolResult, query)`  
   - `normalizeEvidenceFacts(toolResult, query)`  
   - `normalizeDeterministicFact(domain, toolName, result, query)`

2. **Input shapes**  
   - `toolResult` → `any` (API/DB response – could be an object with `.result`/`.data`, or a plain value)  
   - `query` → `string` (the original user query, used for extracting entities)  
   - `domain`/`toolName`/`result` → specific scalar/string values for deterministic tools  
   Example (`normalizeWeatherFacts`):  
   `toolResult = { result: [{ province: "กรุงเทพ", temp: 35 }] }`  
   `query = "สภาพอากาศวันนี้ที่กรุงเทพ"`

3. **Guard: Falsy input**  
   If `toolResult` is falsy, return an empty `RetrievalFact[]` – immediate exit, no side-effects.

4. **Extract raw data**  
   Determine the core data payload: `toolResult.result` → `toolResult.data` → `toolResult` itself.

5. **Extract structured information** (weather/evidence)  
   - Weather (array branch): iterate items, extract location from `item.province`/`item.location` (default `"unknown"`).  
   - Weather (object branch): use `extractWeatherEntities(query)` (regex over Thai province/region names) to build an entity list.  
   - Evidence: use `extractISP(query)` (regex over ISP names) to extract an ISP string, default `"all"`.

6. **ID generation (side-effect)**  
   For each new fact, `nextFactId(domain)` reads and increments the module-level `factCounter` variable (mutable state).  
   Produces a string like `"hot:weather:3"`.  
   *Side-effect:* global `factCounter` increases by 1 per call.

7. **Construct `RetrievalFact` object**  
   For each data item:  
   - `id` ← generated ID  
   - `source` ← object with `type` ("api"|"database"|"tool"), `name`, `freshness: "live"`, `timestamp: now`, `confidence` (0.9/0.95/1.0)  
   - `domain` ← `"weather"` / `"evidence"` / `domain` argument  
   - `content` ← stringified representation (truncated later in summary)  
   - `entities` ← array (locations, ISP, or empty)  
   - `timestamp` ← current ISO string  
   - `confidence` ← fixed value  
   - `raw` ← original data item  

   Result: an array (`RetrievalFact[]`) for weather/evidence; a single fact for deterministic.

8. **Exit: Return array**  
   `normalizeWeatherFacts` / `normalizeEvidenceFacts` return the fact array to caller.  
   `normalizeDeterministicFact` returns a single `RetrievalFact`.

9. **Optional: Merge multiple fact sets**  
   Caller invokes `mergeRetrievalFacts(factSets: RetrievalFact[][])`  
   - Iterates all inner facts, deduplicates by `fact.id` using a `Set<string>`.  
   - Returns a flat, deduplicated `RetrievalFact[]`.  
   No side-effects.

10. **Optional: Compose a fact summary**  
    Caller invokes `composeFactSummary(facts: RetrievalFact[])`  
    - Iterates over facts.  
    - For each fact, builds a line `"[source.name] content"`, truncating content > 500 chars.  
    - Joins lines with double newline.  
    - Returns a human-readable `string`.  
    Destination: used by downstream answer-composition logic.  
    No side-effects.

11. **Overall module behaviour**  
    - Inputs: raw tool results + user query →  
    - Transformations: entity extraction, ID generation, object mapping →  
    - Outputs: `RetrievalFact[]` or a single `RetrievalFact` → optional merge → optional summary `string`.  
    - Side-effects: module-level `factCounter` mutation (global state); no database, network, or event emissions inside this module.
```

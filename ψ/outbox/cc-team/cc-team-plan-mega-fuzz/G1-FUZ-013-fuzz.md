<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-013 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":1927,"completion_tokens":5001,"total_tokens":6928,"prompt_tokens_details":{"cached_tokens":1920,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3926,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T12:03:47.922Z -->
- **Property:** normalizeWeatherFacts returns empty array for falsy toolResult  
  **Input:** `toolResult = null`, `query = "any"`  
  **Expected invariant:** `normalizeWeatherFacts(null, "any")` → `[]`

- **Property:** normalizeWeatherFacts returns empty array for truthy primitive string result  
  **Input:** `toolResult = "live data"`, `query = ""`  
  **Expected invariant:** result `[]` because no object/array unwrapping yields a fact

- **Property:** normalizeWeatherFacts returns empty array for numeric toolResult (0)  
  **Input:** `toolResult = 0`, `query = ""`  
  **Expected invariant:** `[]`

- **Property:** normalizeWeatherFacts creates one fact per array item from toolResult.result  
  **Input:** `toolResult = { result: [{ province: "เชียงใหม่" }, { location: "ภูเก็ต" }] }`, `query = ""`  
  **Expected invariant:** length 2; each fact has `domain: "weather"`, entity equals province or location; source.id includes the province

- **Property:** normalizeWeatherFacts handles array item with missing province/location by using "unknown"  
  **Input:** `toolResult = { result: [{ temp: 30 }] }`, any query  
  **Expected invariant:** fact has entity `["unknown"]` and does not throw

- **Property:** normalizeWeatherFacts gracefully handles null items inside the result array  
  **Input:** `toolResult = { result: [null, null] }`, `query = ""`  
  **Expected invariant:** No TypeError; each null item yields a fact with province `"unknown"` and content `"null"` (JSON.stringify of null)

- **Property:** normalizeWeatherFacts with a non-array object result creates exactly one fact using query-based entities  
  **Input:** `toolResult = { temp: 35 }`, `query = "กรุงเทพอากาศวันนี้"`  
  **Expected invariant:** single fact; `entities` contains `["กรุงเทพ"]`; `source.id` is `"tool:weatherPipeline"` (no province suffix)

- **Property:** normalizeWeatherFacts does not crash when query is null/undefined  
  **Input:** `toolResult = { result: { temp: 35 } }`, `query = null`  
  **Expected invariant:** No TypeError from `extractWeatherEntities`; returns a fact with `entities = []` (or safely handles null)

- **Property:** normalizeEvidenceFacts returns empty array for null/undefined toolResult  
  **Input:** `toolResult = null`  
  **Expected invariant:** `[]`

- **Property:** normalizeEvidenceFacts creates a fact with ISP "all" when query contains no ISP keyword  
  **Input:** `toolResult = { data: "evidence text" }`, `query = "no isp"`  
  **Expected invariant:** fact.entities is `["all"]`, confidence 0.95

- **Property:** normalizeEvidenceFacts extracts ISP from query case-insensitively and uppercases  
  **Input:** `toolResult = { data: "..." }`, `query = "ais fiber outage"`  
  **Expected invariant:** fact.source.id ends with `:AIS`, entities `["AIS"]`

- **Property:** normalizeEvidenceFacts does not crash when query is null  
  **Input:** `toolResult = { data: "..." }`, `query = null`  
  **Expected invariant:** No TypeError from `extractISP`; fact.entities is `["all"]`

- **Property:** normalizeDeterministicFact stringifies non-string results via String()  
  **Input:** `domain = "calc"`, `toolName = "calculator"`, `result = 42`, `query = ""`  
  **Expected invariant:** fact.content is `"42"`, confidence 1.0, entities `[]`

- **Property:** normalizeDeterministicFact does not throw for Symbol result  
  **Input:** `result = Symbol("test")`  
  **Expected invariant:** No TypeError from `String(result)`; content should be `"Symbol(test)"` (or handled gracefully, as String(symbol) throws in current code)

- **Property:** mergeRetrievalFacts deduplicates by fact.id, preserving first occurrence  
  **Input:** `factSets = [[{id:"1"}, {id:"2"}], [{id:"2"}, {id:"3"}]]` (minimal shapes)  
  **Expected invariant:** output IDs are `["1","2","3"]`, length 3, order follows first-seen

- **Property:** mergeRetrievalFacts handles empty sub-arrays and all-empty input  
  **Input:** `factSets = [[], []]` → `[]`  
  **Expected invariant:** `[]`

- **Property:** mergeRetrievalFacts guards against non-array set members (null/undefined

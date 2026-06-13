<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D011 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1940,"completion_tokens":1540,"total_tokens":3480,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":671,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T11:20:46.430Z -->
- **`RetrievalFact`** (interface)  
  Represents a normalized fact from live operational data, including source metadata, content, confidence, and optional raw payload.  
  - **Fields**: `id` (auto-generated), `source` (`RetrievalSource`), `domain`, `content`, `entities`, `timestamp`, `confidence`, `raw?` (any).  
  - **Caveat**: `id` is generated via an internal counter (module‑scoped `factCounter`), not persisted across module reloads.

- **`normalizeWeatherFacts(toolResult: any, query: string): RetrievalFact[]`**  
  Normalizes a weather pipeline API/DB result into an array of `RetrievalFact` objects. Handles both single objects and arrays.  
  - **`@param toolResult`** – Raw output from the weather tool (any shape).  
  - **`@param query`** – Original user query, used to extract location/entity strings.  
  - **`@returns`** – Array of `RetrievalFact` with confidence 0.9.  
  - **Caveat**: If `toolResult.result` or `toolResult.data` exists, those are used preferentially; otherwise falls back to `toolResult` itself. For non‑array results, entities are extracted from `query` via `extractWeatherEntities()`.

- **`normalizeEvidenceFacts(toolResult: any, query: string): RetrievalFact[]`**  
  Normalizes an evidence tool result into a single `RetrievalFact` (always one element).  
  - **`@param toolResult`** – Raw output from the evidence tool.  
  - **`@param query`** – Original user query, used to extract an ISP name via `extractISP()`.  
  - **`@returns`** – Array containing exactly one `RetrievalFact` with confidence 0.95.  
  - **Caveat**: ISP extraction is based on a fixed list of Thai providers. If no match, falls back to `"all"`.

- **`normalizeDeterministicFact(domain: string, toolName: string, result: any, query: string): RetrievalFact`**  
  Normalizes a deterministic tool (e.g. calculator, datetime) result into a single `RetrievalFact`.  
  - **`@param domain`** – Domain label (e.g. `"calculator"`).  
  - **`@param toolName`** – Tool identifier used as part of the source `id`.  
  - **`@param result`** – Raw output from the tool.  
  - **`@param query`** – Original query (unused in implementation).  
  - **`@returns`** – A single `RetrievalFact` with confidence 1.0 and empty `entities` array.

- **`mergeRetrievalFacts(factSets: RetrievalFact[][]): RetrievalFact[]`**  
  Merges multiple `RetrievalFact` arrays into one, deduplicating by `fact.id`.  
  - **`@param factSets`** – Array of fact arrays to merge.  
  - **`@returns`** – A flat array containing only the first occurrence of each `id`.  
  - **Caveat**: Deduplication order is the order of the input arrays; later duplicates are silently dropped.

- **`composeFactSummary(facts: RetrievalFact[]): string`**  
  Creates a human‑readable summary string from an array of `RetrievalFact`, suitable for answer composition.  
  - **`@param facts`** – Array of facts to summarise.  
  - **`@returns`** – A string where each fact is prefixed with its source name in brackets, separated by double newlines. Returns empty string if input is empty.  
  - **Caveat**: Each fact’s `content` is truncated at 500 characters (appending `"..."`) if longer.

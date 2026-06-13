<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D036 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1057,"completion_tokens":1784,"total_tokens":2841,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1507,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T11:25:23.849Z -->
- **`GeoGuard`** – Resilience wrapper for async tool calls: applies a configurable timeout, a single retry on failure, and a degraded fallback packet if both attempts fail. Constructor parameter `timeoutMs` (default `10_000 ms`) sets per-attempt timeout.  
  `@param` `timeoutMs` – Maximum milliseconds to wait for each attempt.  

  - `executeWithGuard(toolFn, toolName)` – Executes the tool promise and always returns a `WeatherPacket` (never throws).  
    `@param` `toolFn` – Async function that returns `unknown`.  
    `@param` `toolName` – Identifier used in logs and packet metadata.  
    `@returns` `WeatherPacket` – Contains success data or error/fallback info.  
    **Non‑obvious:**  
    - If the first attempt fails but the retry succeeds, the returned packet has `fallback_used: true`.  
    - If both attempts fail, the fallback packet sets `summary` to a Thai‑language error message and `fallback_used: true`.  
    - The `evidence.confidence` is `1.0` on success, `0` on error.  
    - The `error` field is only present when the attempt failed.

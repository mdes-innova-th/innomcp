<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-009 role=perf model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1529,"completion_tokens":2333,"total_tokens":3862,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1918,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T12:00:14.768Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| High | `ContextManager.sessions` (Map) | **Memory retention/leak:** sessions Map grows indefinitely with no eviction or TTL. Old sessions are never removed, leading to unbounded memory growth. | Implement a session TTL or maximum size with LRU eviction. Provide a background cleanup or explicit `pruneSessions()` method. |
| High | `addMessage()` | **Unbounded allocations:** `maxMessagesPerSession` (100) and `maxContentLength` (10000) are defined but never enforced, allowing per‑session arrays and individual message strings to grow without limit. | Add checks: if `current.length >= this.maxMessagesPerSession` shift oldest non‑system message; if `message.content.length > this.maxContentLength` truncate or reject. |
| High | `trim()` while‑loop with `otherMessages.shift()` | **Unbounded loop / O(n²) complexity:** `Array.shift()` is called inside a `while` loop, causing O(n²) time for large message lists. This can block the event loop when trimming many messages. | Replace `shift()` with an index pointer (`startIdx`) that increments, and use `otherMessages.slice(startIdx)` when returning. Avoid mutating the array during the loop. |
| Medium | `getContext()` | **Missing caching:** Every call to `getContext` recalculates token counts and reruns the entire trim operation, even if the underlying messages haven't changed. | Cache the trimmed message array per session and invalidate it on `addMessage()` or `clear()`. |
| Medium | `addMessage()` | **Large payload handling ignored:** `maxContentLength` is defined but never applied, allowing extremely large strings to be stored, wasting memory and increasing token‑counting cost. | Enforce `maxContentLength` before storing: slice content if it exceeds the limit. |

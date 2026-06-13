<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-007 role=perf model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1306,"completion_tokens":3616,"total_tokens":4922,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3172,"image_tokens":0},"cache_creation_input_tokens":0} | 73s
 generated: 2026-06-13T12:00:10.717Z -->
| severity | location | issue | fix |
|---|---|---|---|
| High | `size()`, `stats()` | `size()` invokes `cleanupExpired()`, causing a full synchronous iteration over all cache entries. Frequent calls block the event loop. | Remove `this.cleanupExpired()` from `size()`. Return `this.entries.size` directly. Rely on lazy expiration during access and the background timer. |
| High | `cleanupExpired()` | Synchronously iterates the entire cache to find expired nodes. Blocks the event loop proportionally to cache size every 60 seconds. | Yield to the event loop by processing expirations in chunks via `setImmediate`/`setTimeout`, or remove the timer and rely strictly on lazy expiration and LRU eviction. |
| Medium | `set()` | Unbounded payload size. The cache restricts entry count (`maxSize`) but not memory footprint. Caching large objects/buffers can trigger OOM crashes. | Implement a maximum byte-size limit per entry or track total cache weight. Reject oversized payloads or use a byte-sized LRU strategy. |
| Medium | `configure()` | Synchronous eviction loop. Reducing `maxSize` significantly forces synchronous deletion of potentially thousands of nodes, blocking the event loop. | Chunk the eviction loop using `setImmediate` or `queueMicrotask` when the number of items to evict is large, or make `configure()` async. |
| Low | `cleanupExpired()` | Mutating a `Map` while iterating over it with `for...of`. While spec-compliant, it incurs performance overhead in some JS engines and is an anti-pattern. | Accumulate expired keys in a temporary array during iteration, then delete them in a subsequent pass. |
| Low | `constructor` | `cleanupTimer` is never explicitly cleared. `unref()` prevents process hang, but the timer leaks in testing, serverless, or if the singleton is reset. | Add a `destroy()` method that calls `clearInterval(this.cleanupTimer)`, clears the map, and resets `CacheManager.instance`. |

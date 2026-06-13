<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-018 role=perf model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2054,"completion_tokens":5000,"total_tokens":7054,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5202,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T12:02:32.816Z -->
| severity | location | issue | fix |
|---|---|---|---|
| Critical | module-level `store` / `recordProviderCall` | Unbounded memory retention: `store` Map accumulates provider entries forever with no eviction, TTL, or size cap; leaks memory if providerIds are dynamic or high-cardinality. | Implement LRU eviction (e.g., max 500 entries) or periodic TTL sweep; persist evicted entries to DB before deletion. |
| Critical | `recordProviderCall` (DB callback) | N+1 DB writes: every single provider call triggers an independent `INSERT ... ON DUPLICATE KEY UPDATE`; under parallel fan-out this floods the connection pool and serializes on DB locks. | Accumulate deltas in a pending-write buffer; flush batched multi-row `INSERT ... ON DUPLICATE KEY UPDATE` on interval or size threshold. |
| High | `getProviderStats` | Blocking synchronous computation: rebuilds entire snapshot on every read, cloning+sorting latency arrays (p95) and intent objects per provider; event-loop blocking scales linearly with provider count. | Maintain a cached `ProviderStats` snapshot

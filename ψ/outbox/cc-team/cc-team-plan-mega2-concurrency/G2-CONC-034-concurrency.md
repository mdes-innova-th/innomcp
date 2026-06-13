<!-- cc-team deliverable
 group: G2 (concurrency division)
 member: CONC-034 role=concurrency model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1721,"completion_tokens":4045,"total_tokens":5766,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3334,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T12:16:55.805Z -->
# Concurrency/Async-Safety Audit: `providerManager.ts`

| severity | location | race/issue | fix |
|----------|----------|------------|-----|
| **High** | `checkHealth` — provider reference obtained before `await fetch` | **Stale reference / lost update**: `const provider = this.providers.get(id)` captures a reference, then `await fetch` yields. A concurrent `register(id, newConfig)` replaces the map entry with a new object. On resume, `checkHealth` mutates the *orphaned* old object (`provider.healthStatus = …`). The new object in the map never receives the health update — data is silently lost. | After `await fetch`, re-fetch the current provider from the map before mutating: `const current = this.providers.get(id); if (!current) return …; this.providers.set(id, { …current, healthStatus, latencyMs, lastChecked })`. This also makes the update atomic (replace whole object). |
| **Medium** | `checkHealth` — three separate property assignments after `await` | **Non-atomic multi-property update**: `healthStatus`, `latencyMs`, and `lastChecked` are set as three separate statements. A synchronous reader (e.g., `getBest` called from another async frame between assignments) can observe a partially-updated provider (new `healthStatus` but stale `latencyMs`). | Replace the entire map entry atomically: `this.providers.set(id, { …this.providers.get(id)!, healthStatus, latencyMs, lastChecked })`. Combines with the fix above. |
| **Medium** | `checkAllHealth` | **Cache stampede**: Concurrent calls to `checkAllHealth` fire overlapping health checks for the same providers. No deduplication of in-flight requests, wasting network resources and skewing latency measurements. | Maintain a `Map<string, Promise<…>>` of in-flight health checks. On entry, return existing promise if one exists; otherwise store and await the new one, then clean up. |
| **Medium** | `checkAllHealth` — `Promise.allSettled` results ignored | **Silent error swallowing**: `allSettled` captures rejections but the returned `results` array is never inspected. If a provider is `unregister`-ed between the `ids` snapshot and `checkHealth(id)`, the "Provider not found" error is silently discarded. Caller has no way to know which checks failed. | Inspect `results`: `for (const r of results) if (r.status === 'rejected') log/warn(r.reason)`. Alternatively, snapshot providers immutably before iteration and skip deleted entries. |
| **Medium** | `checkAllHealth` — `ids` snapshot vs. concurrent mutation | **Stale iteration set**: `Array.from(this.providers.keys())` captures IDs, but providers can be added/removed during the `await Promise.allSettled(…)`. Newly added providers are missed; removed providers cause spurious "not found" errors. | Snapshot full configs instead of just IDs, or accept the trade-off and document it. Consider a generation counter to detect concurrent modifications and retry. |
| **Low** | `getAll`, `getMDESPrimary` — shallow copy only | **Shared nested reference**: `{ …p }` shallow-copies the `ProviderConfig`, but the `capabilities` array is shared. External code mutating `returnedConfig.capabilities.push(…)` corrupts the internal map entry. | Deep-clone returned configs: `structuredClone(p)` or `JSON.parse(JSON.stringify(p))`. |
| **Low** | `register` — `async` with no `await` | **Unawaited promise footgun**: `register` is declared `async` but performs no async work. Callers who forget `await` silently drop validation errors. | Make `register` synchronous (remove `async`/`Promise<void>`), or add an explicit `await Promise.resolve()` to signal intent, and document that it must be awaited. |
| **Low** | `checkHealth` — `AbortController` / timeout | **Timeout resource leak on unexpected throw**: If `fetch` throws synchronously before the `try` block's `clearTimeout` is reached (extremely unlikely in practice but theoretically possible with a buggy fetch polyfill), the timer leaks. | Move `clearTimeout` into a `finally` block instead of duplicating it in both `try` and `catch`. |

### Summary of the critical path

The most impactful issue is the **stale reference in `checkHealth`**. The sequence:

```
1. const provider = this.providers.get(id)   // reference to Object-A
2. await fetch(...)                           // ← yields; register(id, newCfg) replaces
                                               //    map entry with Object-B
3. provider.healthStatus = 'healthy'          // mutates orphaned Object-A
4. // Object-B in the map is never updated    // ← silent data loss
```

This is the classic **read-then-act-after-yield** race. The fix is to re-read and atomically replace the map entry after every `await`, which simultaneously resolves the non-atomic multi-property update issue.

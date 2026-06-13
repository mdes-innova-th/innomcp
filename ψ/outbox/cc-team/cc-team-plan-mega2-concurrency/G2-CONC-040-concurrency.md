<!-- cc-team deliverable
 group: G2 (concurrency division)
 member: CONC-040 role=concurrency model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":411,"completion_tokens":751,"total_tokens":1162,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T12:17:41.076Z -->
# Concurrency/Async-Safety Audit

| Severity | Location | Race/Issue | Fix |
|----------|----------|-----------|-----|
| Low | `serviceStatusAggregator.ts:8` | **Promise.allSettled is correct here** — no error-swallowing issue, fulfilled/rejected status is properly inspected. ✅ | No fix needed. Note: downstreams only get a boolean, not error context — if callers need to know *why* a service failed, return the reason too. |
| Low | `serviceStatusAggregator.ts:7` | **Check-then-act not applicable** — purely read-only aggregation, no shared mutable state mutated. ✅ | None. |
| Low | `serviceStatusAggregator.ts:8-15` | **Ordering assumption** — `results[i]` is indexed positionally. If the array is ever reordered (e.g., a key per service is added/removed), the mapping silently mislabels which service is up. | Use an object keyed by service name, e.g. `{ analytics, mdesModels, thaiNlp }` returned directly from `Object.fromEntries` over a `[name, promise]` tuple array. Compile-time check via a `satisfies` clause. |
| Info | `serviceStatusAggregator.ts:7-11` | **No timeout / no cache stampede guard** — every call re-fans out to all three services concurrently. If `checkAllServices` is invoked on every health-probe request (e.g., from a load balancer), this is an N×fan-out stampede against upstream services. | (1) Add a per-service TTL cache (e.g., 5–30s) so concurrent probes coalesce into one in-flight call (single-flight). (2) Apply a per-call `Promise.race([call, timeout])` with an AbortController so a hung service can't pin the aggregator. |
| Info | `serviceStatusAggregator.ts:7` | **Unhandled inner promise on partial sync throws** — `Promise.resolve(x)` only wraps; if `analyticsService.getStats()` throws synchronously during construction (not async), the rejection is still captured by `allSettled`. ✅ Verified safe, but worth a comment so future maintainers don't "simplify" by removing the wrapper. | Add a one-line comment: `// Promise.resolve() defensively wraps in case the callee is later changed to throw synchronously.` |
| Info | Module-level | **No event-listener / timer leaks** — function-scoped, no subscriptions registered. ✅ | None. |
| Info | Module-level | **No shared mutable state** — `analyticsService`, `mdesModelCache`, `thaiNLPService` are imported singletons, but this function only *reads*. Thread-safety of those modules must be audited separately. | Out of scope; flag for follow-up audit of `mdesModelCache` (cache layer) and `analyticsService.getStats()` (likely touches shared counters). |
| Info | `serviceStatusAggregator.ts` overall | **No unawaited promises in this file** ✅ | None. |

## Summary
The file is **largely safe**. The most actionable concerns are external to this module: (1) add a single-flight TTL cache to prevent cache-stampede against upstream services when this is called frequently, and (2) replace positional `results[i]` indexing with name-keyed results to remove the implicit ordering coupling. The "no error-swallowing" verdict holds — `Promise.allSettled` is the correct primitive here, but it does throw away the *reason*, so consider whether callers (alerting, dashboards) need it.

<!-- cc-team deliverable
 group: G1 (concurrency division)
 member: CONC-020 role=concurrency model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1847,"completion_tokens":1835,"total_tokens":3682,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T12:12:17.950Z -->
# Concurrency / Async-Safety Audit

`MDESModelCache` is a single-instance, long-lived, shared object (`mdesModelCache` exported) read/written from arbitrary async contexts. JavaScript is single-threaded, but the interleaving of `await` points creates real check-then-act hazards. Below are the findings.

| # | Severity | Location | Race / Issue | Fix |
|---|----------|----------|--------------|-----|
| 1 | **High** | `getModels()` lines 30–52 | **Cache stampede (thundering herd).** N concurrent callers all see `lastFetch` stale and each issue their own `fetch()` to MDES. Up to N identical upstream requests per TTL window. | Coalesce in-flight requests with a single `pendingFetch: Promise<MDESModel[]>` field. First caller creates it; subsequent callers `await` it; clear it on settle. On `forceRefresh`/error, optionally invalidate. |
| 2 | **High** | `getModels()` lines 30–47 (check-then-act across `await`) | **TOCTOU between cache check and write.** Caller A checks `lastFetch`, finds it stale, awaits network. Before A resolves, caller B sees the same stale state, also awaits. Both then write `this.cache` and `this.lastFetch`. The second write is benign here, but combined with #1 wastes work and exposes intermediate state. | After the network resolves, re-check `now - this.lastFetch < TTL_MS && !forceRefresh` before overwriting; or rely on the coalesced promise from #1 so only one writer exists per cycle. |
| 3 | **High** | `getModels()` catch block (lines 53–60) | **Stale-cache read with no in-flight guard.** While caller A's failed `fetch` is in flight, callers B/C happily receive the old `this.cache` and proceed with decisions based on data that may be days stale — and A's eventual failure (or success) silently mutates `this.lastFetch`/cache out from under them. | Track an `inFlight` state; if a refresh is currently in progress, either (a) await it on success, or (b) explicitly return a clearly-marked "stale" snapshot with a flag so callers can decide. At minimum, do not let `lastFetch` advance on a failed refresh (currently it does not — verify and document). |
| 4 | **Medium** | `getModel()`, `isModelAvailable()`, `getBestModelForTask()` | **Ordering assumption — snapshot inconsistency.** Each of these re-enters `getModels()` independently. Two back-to-back calls in the same logical operation can see two different model lists (e.g., a refresh errored between them), causing "model existed, now it doesn't" flakiness. | Pass a `models` snapshot through, or expose a synchronous `getCachedModels()` for callers that already triggered a refresh, and document the freshness contract. |
| 5 | **Medium** | `getModelFamilies()` (sync) | **Race with concurrent `getModels()` writer.** Because JS is single-threaded, a read of `this.cache` is atomic, but readers can see a half-applied reference if `this.cache = models` is assigned a reference that mutates post-assignment. Here `models` is freshly parsed JSON, so safe — but **no memory barrier / no `Object.freeze`**, and the returned array/objects are shared mutable references. A caller doing `cache.find(...).details.param = ...` would corrupt the next reader. | Return a shallow copy (`this.cache.slice()`) and/or freeze model objects before storing: `this.cache = Object.freeze(models.map(m => Object.freeze(m)))`. |
| 6 | **Medium** | `getModels()` catch (lines 53–60) | **Error swallowing / inconsistent contract.** On network failure, the *success* path returns `MDESModel[]` silently using stale data, while the *no-cache* path throws. Callers cannot distinguish "freshly fetched" from "stale fallback" without a timestamp. `console.warn` is the only signal. | Return a result object `{ models, source: "fresh" \| "stale" \| "empty", fetchedAt }`, or add `getStats()`-style metadata. Reserve `console.warn` for unexpected failures; consider a `lastFetchStatus` field. |
| 7 | **Low** | `getBestModelForTask()` line ~135 (`sizeValue` default) | **No race, but logic bug amplified by race #4.** `sizeValue(undefined) === Infinity` means models with no `parameter_size` always sort "largest" in the generic fallback (line ~175) and "smallest" is impossible in `case "fast"`. Combined with the snapshot-staleness race, selection becomes non-deterministic across calls. | Default to `0` (or `NaN`) when size is unknown; document the heuristic. Push this fix to a follow-up — it's a logic defect exposed by, but not caused by, the concurrency model. |
| 8 | **Low** | `warmUp()` (line ~200) | **Unawaited promise at startup.** `await this.getModels(true)` is fine *if* the caller awaits `warmUp()`. The JSDoc says "should be called on server start" — easy to forget. If the server starts handling requests before warm-up completes, the first burst hits the cold path → cache stampede (#1) with N = traffic spike. | Either (a) add an `initialized: Promise<void>` exported alongside `mdesModelCache` and have middleware await it, or (b) make `getModels` a single-flight so the warm-up itself is the only in-flight request. |
| 9 | **Low** | `MDESModelCache` class / module | **No max cache size / no abort.** `fetch` is not wrapped in `AbortController` with a timeout. A hung MDES endpoint leaves an in-flight promise that pins a microtask; under load, memory grows with the number of pending consumers. | Add `AbortSignal.timeout(5_000)` to `fetch`; reject on timeout (treated like other errors → stale fallback). |
| 10 | **Info** | `getStats()` | **Reading `lastFetch` and `cache.length` is not atomic across `await`.** Trivial because the method is sync, but if it ever becomes async, wrap in a snapshot. Document as sync-only. | Add a JSDoc note: "Synchronous; safe because all mutations happen in microtask continuations that don't preempt synchronous code." |

---

## Recommended fix sketch for the top issues (1 + 3 + 5)

```typescript
export class MDESModelCache {
  private cache: MDESModel[] = Object.freeze([]) as MDESModel[];
  private lastFetch = 0;
  private pending: Promise<MDESModel[]> | null = null;
  private readonly TTL_MS = 5 * 60 * 1000;
  private readonly FETCH_TIMEOUT_MS = 5_000;

  async getModels(forceRefresh = false): Promise<MDESModel[]> {
    const now = Date.now();
    const fresh = this.cache.length > 0 && now - this.lastFetch < this.TTL_MS;
    if (!forceRefresh && fresh) return this.cache;

    // Coalesce: only one network request in flight at a time
    if (this.pending) return this.pending;

    this.pending = (async () => {
      try {
        const res = await fetch(`${MDES_OLLAMA_URL}/api/tags`, {
          signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`MDES status ${res.status}`);
        const data: OllamaTagsResponse = await res.json();
        const models = (data.models ?? []).map(Object.freeze);
        this.cache = Object.freeze(models);
        this.lastFetch = Date.now();
        return this.cache;
      } catch (err) {
        if (this.cache.length > 0) {
          console.warn("MDES refresh failed, serving stale cache:", err);
          return this.cache; // explicit stale path
        }
        throw new Error("Failed to fetch models and no cache available");
      } finally {
        this.pending = null;
      }
    })();

    return this.pending;
  }
  // ... rest unchanged
}
```

**Net effect:** one upstream request per TTL window regardless of caller count, no half-applied state, immutable snapshots, bounded fetch latency, and explicit stale-vs-fresh semantics.

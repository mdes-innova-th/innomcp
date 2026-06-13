<!-- cc-team deliverable
 group: G1 (concurrency division)
 member: CONC-014 role=concurrency model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2042,"completion_tokens":4110,"total_tokens":6152,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3302,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T12:10:23.572Z -->
# Concurrency/Async-Safety Audit: `healthAggregator.ts`

| severity | location | race/issue | fix |
|----------|----------|------------|-----|
| **High** | `check()` — cache guard | **Cache stampede / thundering herd**: When the cache expires, every concurrent caller bypasses the `if (this.cache …)` check, each kicks off a full parallel run of all checkers. Under load this can cause resource exhaustion (e.g. N simultaneous DB health probes). | Use a **single-flight / deduplication** pattern: store the in-flight `Promise<AggregatedHealth>` on `this` and return the same promise to all concurrent callers. Clear it on settlement. |
| **Medium** | `runCheckerWithTimeout` — `setTimeout` | **Timer leak**: When the checker resolves before the timeout, the `setTimeout` is never cleared. The callback fires into an already-settled promise (harmless but wasteful), and the timer object lives for up to `timeoutMs` (default 5 s) per checker per invocation. With 3 built-in + N custom checkers called every few seconds, leaked timers accumulate. | Capture the timeout ID (`const timer = setTimeout(…)`), then in the `.race` winner, call `clearTimeout(timer)`. Wrap in a helper that cancels the timer on resolution. |
| **Medium** | `check()` ↔ `registerChecker()` | **Stale cache overwrite**: `registerChecker` sets `this.cache = null` to invalidate, but if `check()` is already past the cache guard and awaiting `Promise.all`, the in-flight check still uses the *old* checker set. When it finishes, it writes a cache entry that omits the newly registered checker, and that stale entry persists for up to `CACHE_TTL_MS`. | Add a `generation` counter incremented by `registerChecker`. Capture the generation at cache-miss start; before writing the cache, verify the generation hasn't changed. Alternatively, snapshot `this.checkers.entries()` into a local array at the start and only write cache if generation matches. |
| **Medium** | `check()` — `Promise.all` | **Error-swallowing / total result loss**: Although `runCheckerWithTimeout` catches its own errors, if it were to unexpectedly throw (e.g., a bug in the catch block itself, or `process.hrtime` failing), `Promise.all` would reject and **discard every other checker's result**. | Replace `Promise.all` with `Promise.allSettled`. Map fulfilled values and treat rejected promises as individual unhealthy entries, preserving all other results. |
| **Low** | `check()` — `const now = Date.now()` | **Cache TTL inaccuracy**: `now` is captured at the *start* of `check()`, but written as the cache timestamp after the `await`. If checkers take 3 s, the cache is stamped 3 s in the past, shortening the effective TTL by that duration. | Capture `Date.now()` at the point of cache write (`this.cache = { result: aggregated, timestamp: Date.now() }`), not at function entry. |
| **Low** | `getInstance()` | **Check-then-act on singleton**: Classic TOCTOU — two calls could observe `!instance` and both construct. Harmless in single-threaded Node.js, but unsafe if the module is ever used in a worker-thread or non-Node runtime. | Eagerly initialize: `private static instance: HealthAggregator = new HealthAggregator()`, or use a lazy-init lock / `!` assertion pattern. |

---

### Key fix: single-flight deduplication (addresses the High-severity stampede)

```typescript
private inflight: Promise<AggregatedHealth> | null = null;

public async check(): Promise<AggregatedHealth> {
  const now = Date.now();
  if (this.cache && now - this.cache.timestamp < CACHE_TTL_MS) {
    return this.cache.result;
  }

  // Dedup: reuse in-flight promise for concurrent callers
  if (this.inflight) return this.inflight;

  this.inflight = (async () => {
    try {
      // … existing checker logic …
      this.cache = { result: aggregated, timestamp: Date.now() };
      return aggregated;
    } finally {
      this.inflight = null;
    }
  })();

  return this.inflight;
}
```

### Key fix: timer cleanup in `runCheckerWithTimeout`

```typescript
private async runCheckerWithTimeout(
  name: string, checker: HealthChecker, timeoutMs: number,
): Promise<{ name: string; result: HealthStatus & { durationMs: number } }> {
  const start = process.hrtime.bigint();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      checker(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`หมดเวลา (${timeoutMs}ms)`)), timeoutMs);
      }),
    ]);
    clearTimeout(timer);  // ← cancel the orphaned timer
    // … build success result …
  } catch (error) {
    clearTimeout(timer);  // ← already fired, but harmless to clear
    // … build error result …
  }
}
```

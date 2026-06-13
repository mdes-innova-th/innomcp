<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-023 role=perf model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1934,"completion_tokens":5000,"total_tokens":6934,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 55s
 generated: 2026-06-13T12:03:45.487Z -->
The user wants a performance audit of the provided TypeScript code (`modelLoadBalancer.ts`). I need to find:

1. Blocking sync I/O
2. Unbounded loops/allocations
3. N+1 calls
4. Missing caching
5. Redundant awaits
6. Memory retention/leaks
7. Large payload handling

And output a table with columns: severity | location | issue | fix

Let me analyze the code carefully.

First, let's look at the code structure:
- Singleton pattern with `ModelLoadBalancer`
- `models` is a Map<string, ModelState>
- `selectModel` method with different strategies
- `recordLatency`, `recordError`
- `getStats`
- `startHealthProbes` with `setInterval`
- `runHealthProbes` which is async but called from `setInterval`

Issues I can identify:

1. **Memory Leak / Unbounded growth in `latencyWindow`**: 
   - In `recordLatency`, `state.latencyWindow.push(latencyMs)` and then `if (state.latencyWindow.length > 20) { state.latencyWindow.shift(); }`
   - Wait, this is bounded to 20. So not unbounded. But `shift()` on an array is O(n) operation. For a window of 20 it's negligible, but still a minor issue. However, the prompt asks for unbounded loops/allocations. This is bounded, so maybe not. But the `shift()` operation causes memory churn. I'll note it if relevant but maybe not as unbounded.

2. **Memory Leak in singleton / EventEmitter**:
   - The class extends nothing but imports EventEmitter. Wait, it imports `EventEmitter` but never uses it. That's dead code but not a performance issue per se.
   - Actually, looking at the import: `import { EventEmitter } from 'events';` - unused import. Not performance.

3. **Blocking sync I/O**:
   - No obvious sync I/O like `fs.readFileSync`. But `selectModel` does `Array.from(this.models.values()).filter(...)` which creates arrays. For large numbers of models this is O(n) but not blocking I/O.
   - `getStats` also creates arrays and reduces.
   - `least-latency` strategy does `reduce` with inner `reduce` on `latencyWindow` (max 20 items). That's O(n * 20) = O(n). Fine.
   - Actually, `selectModel` with `least-latency` recalculates averages every time. If `latencyWindow` is large (but it's capped at 20), it's fine. But if there are many models, it's O(m * w). Still not blocking I/O.

4. **Unbounded loops/allocations**:
   - `latencyWindow` is bounded to 20, so not unbounded.
   - `this.models` Map can grow unboundedly if `addModel` is called repeatedly without `removeModel`. That's an unbounded allocation. If models are added dynamically, memory grows forever.
   - `roundRobinIndex` in `selectModel`: `this.roundRobinIndex` is a class property that increments modulo eligible.length. But if models are removed, the index might point to wrong positions? Actually, it uses modulo over eligible list length each time. But the index is global, not per-model. If eligible list changes (models removed/added), the round-robin might skip or repeat. Not exactly unbounded, but buggy.

5. **N+1 calls**:
   - `getStats`: iterates over all models and for each does `reduce` on latencyWindow. That's N * 20 operations. Not exactly N+1 queries, but N+1 computation pattern. However, the prompt likely means N+1 database/API calls. There are no DB/API calls here except in `probeModel` which is truncated.
   - Wait, `runHealthProbes` iterates over models and calls `probeModel` for each disabled one. If many models are disabled, it launches many concurrent probes. That's not N+1, that's just N concurrent calls.

6. **Missing caching**:
   - `least-latency` strategy recalculates the average latency for every eligible model on every call to `selectModel`. Since `latencyWindow` is small (20), this is cheap. But for many models, it could be optimized by caching the average. However, given the small window, it's minor.
   - `getStats` recalculates averages every call. Again, minor.
   - The `eligible` array is recomputed every `selectModel` call. This is necessary since state changes.
   - No memoization of `eligible` list or pre-computed stats.

7. **Redundant awaits**:
   - `runHealthProbes` is declared `async` but is called from `setInterval(() => this.runHealthProbes(), 30_000)`. The `setInterval` callback doesn't await it, so unhandled promise rejections might occur? Actually `runHealthProbes` catches via `Promise.allSettled`, so it won't reject. But the `async` is unnecessary if the caller doesn't await, but it's fine. However, `startHealthProbes` calls `setInterval` with an async function indirectly. The return value is ignored. This is a common pattern. Not necessarily redundant.
   - Wait, `runHealthProbes` is async. `setInterval(() => this.runHealthProbes(), ...)` - the arrow function is sync, it fires and forgets. If `runHealthProbes` throws synchronously (it doesn't), that would be bad. But the `async` keyword means it always returns a promise. The interval doesn't care. This is fine.

8. **Memory retention/leaks**:
   - `healthProbeTimer` is set but never cleared if the instance is "destroyed". Since it's a singleton, it lives forever. But if the process exits, Node.js keeps the event loop alive because of the interval. This is a memory/process leak. The interval keeps the process alive indefinitely.
   - The singleton instance is never cleaned up. The `models` Map retains all `ModelState` objects forever.
   - In `recordError` and `recordLatency`, `activeRequests` is decremented. But what if `recordLatency` or `recordError` is never called? Then `activeRequests` increments in `selectModel` but never decrements. This leads to permanent retention of the count, and eventually the model appears overloaded. This is a logic bug but also a resource leak (the model becomes unusable). The state object retains the high count.
   - `disabledUntil` is set but never cleared except by health probes. If health probes fail to re-enable, it stays disabled.

9. **Large payload handling**:
   - `selectModel` returns `{ ...selected.config }`. If `config` had large payload (like `tags` array), this is a shallow copy. Not a huge issue.
   - `getStats` returns an array of stats. If there are many models, this is a large payload. But it's just metadata.
   - No streaming or pagination for `getStats`.

10. **Blocking in `least-latency`**:
    - `eligible.reduce(...)` where inside the reduce, there's another `reduce` on `latencyWindow`. For 20 items, it's fine. But if `latencyWindow` were unbounded, it would be bad. It's bounded.

11. **Unbounded growth in `models` Map**:
    - `addModel` adds to Map. If called repeatedly with new IDs, the Map grows unboundedly. This is a memory leak.

12. **Missing caching / redundant computation**:
    - `selectModel` for `least-latency` computes averages repeatedly. Could cache.
    - `getStats` computes everything from scratch.

13. **N+1 pattern in `getStats`**:
    - Actually, `getStats` maps over N models and for each does a reduce over latencyWindow. This is N*20 operations. Not N+1 network calls, but computational N+1. The prompt says "N+1 calls" which usually means database queries. There are no DB calls here.

14. **Redundant awaits**:
    - Look at `runHealthProbes`: it's async. But `startHealthProbes` doesn't await it. The `setInterval` callback is `() => this.runHealthProbes()`. Since `runHealthProbes` is async, this returns a promise that is ignored. If `probeModel` throws, `Promise.allSettled` should catch it. But what if `probeModel` is not in the truncated code? The code shown has `runHealthProbes` as async and uses `await Promise.allSettled`. The `async` on `runHealthProbes` is fine. But is there a redundant await? No await shown in the truncated code. Wait, the code is truncated at the end. Maybe `probeModel` is below. But based on what I see, no redundant awaits.

15. **Blocking sync I/O**:
    - `Math.random()` in `weighted` and `random` strategies is sync but not blocking I/O. It's CPU sync but trivial.
    - No actual sync I/O.

16. **Memory leak from `setInterval`**:
    - `startHealthProbes` starts a timer that runs every 30s forever. This prevents Node.js process from exiting naturally. Also, if `ModelLoadBalancer` is somehow reinstantiated (though singleton prevents it), old timer leaks. But singleton prevents multiple instances. Still, the timer is a global resource leak.

17. **Unbounded `activeRequests` if mismatched calls**:
    - `selectModel` increments `activeRequests`. `recordLatency` and `recordError` decrement it. If a caller calls `selectModel` but never calls `recordLatency`/`recordError` (e.g., request times out or caller crashes), `activeRequests` leaks upward. With `maxConcurrent`, this permanently disables the model. This is a resource leak / memory retention issue.

18. **Latency window `shift()` O(n)**:
    - `state.latencyWindow.push(latencyMs); if (state.latencyWindow.length > 20) { state.latencyWindow.shift(); }`
    - `shift()` re-indexes the entire array. For 20 items, negligible. But it's a minor inefficiency. Could use a circular buffer. I'll mention it as low severity.

19. **Missing caching of computed stats**:
    - `avgLatency` and `errorRate` are recalculated on every `getStats()` and `selectModel()` (least-latency). Since these are called frequently, redundant computation. But data is small.

20. **Large payload handling**:
    - `getStats` returns all stats at once. If there are thousands of models, this could be a large JSON payload. No pagination or streaming.

21. **N+1 in health probes**:
    - `runHealthProbes` iterates and creates a probe promise for each disabled model. If all N models are disabled, it makes N concurrent calls. This is not N+1, it's just N. But if `probeModel` internally makes a call that depends on something else, we can't see. Based on visible code, it's just N concurrent.

22. **Redundant `Array.from`**:
    - `Array.from(this.models.values())` is used in `selectModel` and `getStats`. This allocates a new array every time. Necessary for iteration, but could be optimized. Not a huge issue.

Let me structure the findings into the requested table format.

Severity levels: Critical, High, Medium, Low.

Potential issues:

1. **Critical/High**: Unbounded `models` Map growth (memory leak). If `addModel` is called with dynamic IDs, memory grows forever. Location: `addModel` method. Fix: Implement LRU eviction or maximum model limit, or ensure cleanup.

2. **High**: `activeRequests` leak on missing `recordLatency`/`recordError`. If a request is dropped, the counter never decrements, eventually hitting `maxConcurrent` and permanently disabling the model. Location: `selectModel` / `recordLatency`/`recordError`. Fix: Use a request wrapper/finally block or WeakMap/Auto-decay timer.

3. **High/Medium**: `setInterval` health probes prevent process exit and leak timer resource. Location: `startHealthProbes`. Fix: Store timer, provide `stop()` method, use `unref()`.

4. **Medium**: `latencyWindow.shift()` causes O(n) memory churn on every insert after window is full. Location: `recordLatency`. Fix: Use a circular buffer (ring buffer) or pre-allocated array with index.

5. **Medium**: `least-latency` strategy recalculates rolling average via nested `reduce` for every eligible model on every selection. Location: `selectModel` (least-latency case). Fix: Cache computed average in `ModelState` and update incrementally.

6. **Medium**: `getStats` recalculates all averages from scratch on every call (N * 20 operations). Location: `getStats`. Fix: Maintain running sums in `ModelState`.

7. **Medium**: Missing upper bound on `models` Map size allows unbounded memory retention. (Same as #1 but framed as retention). I'll combine or list separately.

8. **Low**: `Array.from(this.models.values())` allocates intermediate arrays in `selectModel` and `getStats`. Location: both. Fix: Iterate Map directly with `for...of` to avoid allocation.

9. **Low/Medium**: No cleanup of `EventEmitter` import (dead code). Not performance.

10. **Medium**: `runHealthProbes` is async but fire-and-forget from `setInterval`. Unhandled rejections if `probeModel` throws? But `Promise.allSettled` handles it. However, if `probeModel` itself is not shown and does sync I/O? We can't know. I'll skip since it's truncated.

11. **Medium**: `selectModel` returns a shallow copy `{ ...selected.config }`. If `tags` array is large, it's copied by reference? Actually spread copies enumerable own properties, so `tags` array reference is copied. Not a deep copy. But not a performance issue.

12. **Medium**: Large payload handling in `getStats`. If many models, large array returned. Fix: Add pagination or streaming.

13. **Low**: `roundRobinIndex` is global and not per-tag or per-group. If eligible list changes between calls, distribution becomes uneven. Not performance.

14. **Medium**: Missing caching of `eligible` list or stats. The `disabledUntil` and `activeRequests` change, so eligible list changes. But could be optimized. I'll mention redundant recomputation.

Wait, the user specifically asked for:
- blocking sync I/O
- unbounded loops/allocations
- N+1 calls
- missing caching
- redundant awaits
- memory retention/leaks
- large payload handling

I need to make sure I cover these categories.

**Blocking sync I/O**: I don't see explicit sync I/O. But `getStats` and `selectModel` do synchronous array reductions that could block the event loop if `models` is huge. Is that "blocking sync I/O"? Not I/O, but blocking sync computation. The prompt says "blocking sync I/O". Maybe there is none. But I should note that `getStats` and `selectModel` perform sync computations that scale linearly with model count and could block if the map is large. I'll frame it as "Synchronous blocking iteration" or note that no explicit sync I/O exists but computational blocking is present. Actually, the prompt asks to "find" these things. If none exist, I should say so? But better to find the closest match: `reduce` operations in `getStats` and `least-latency` are sync CPU work that blocks the event loop if models scale. I'll list it.

**Unbounded loops/allocations**: The `models` Map is unbounded. `addModel` can be called indefinitely. Also `latencyWindow` is bounded but uses `shift()` which is O(n). I'll list the Map growth.

**N+1 calls**: The `getStats` method iterates N models and for each runs a `reduce` over latencyWindow (20). This is an N+1 computation pattern. But more importantly, `runHealthProbes` makes N concurrent calls (one per disabled model). If `probeModel` is a network call, making them all concurrently without a concurrency limit could be an issue, but not N+1. N+1 usually means "for each item, make an extra call". I don't see a clear N+1 query pattern here. Maybe I should note that `getStats` has N+1 reduction pattern (outer loop + inner loop). Or perhaps the health probes could be N+1 if `probeModel` internally calls a central service per model? Not visible. I'll mention the computational N+1 in `getStats` and `least-latency`.

**Missing caching**: The rolling average latency is recalculated from scratch in both `selectModel` (least-latency) and `getStats`. The `eligible` array is rebuilt on every `selectModel`. I'll list missing incremental caching.

**Redundant awaits**: I don't see any redundant `await` keywords in the shown code. `runHealthProbes` is async but called without await in `setInterval`. That's not redundant, it's missing. Wait, maybe the user considers `async` on `runHealthProbes` redundant since it's fire-and-forget? No, it needs to await `Promise.allSettled`. So the `async` is necessary. I'll state "None identified in visible code" or look harder. Actually, is there any `await` in the shown code? No, the code is truncated before `probeModel`. There is no `await` visible. So I can't find redundant awaits. I'll omit or say none found. But the prompt asks to find them. Maybe I should say "No redundant awaits visible" but that's not helpful. Let's skip if none.

**Memory retention/leaks**: 
- Singleton `models` Map retains all states forever (unbounded).
- `activeRequests` counter leaks if `recordLatency`/`recordError` not called.
- `healthProbeTimer` keeps event loop alive (resource leak).
- `latencyWindow` array is retained forever even if model is removed? No, if model removed, Map entry gone. But if not removed, retained.

**Large payload handling**: `getStats` returns all model statistics in a single array. If the Map is large, this is a large payload. No pagination. Also `selectModel` builds a full `eligible` array. 

Let me draft the table rows:

| severity | location | issue | fix |
|---|---|---|---|
| Critical | `addModel` | Unbounded Map growth: `models` Map accumulates entries indefinitely without eviction or size limit, causing unbounded memory allocation and eventual OOM. | Add a max model limit or LRU eviction policy; validate and prune stale models. |
| High | `selectModel` / `recordLatency` / `recordError` | Active request counter leak: `activeRequests` is incremented in `selectModel` but only decremented in `recordLatency`/`recordError`. Abandoned or crashed requests never decrement, permanently disabling models under `maxConcurrent`. | Wrap request lifecycle in a `try/finally` or use a timeout-based decay/cleanup to guarantee decrement. |
| High | `startHealthProbes` | Event loop retention: `setInterval` timer is started in constructor and never stopped or unref'd, preventing process exit and leaking timer resources for the process lifetime. | Store timer reference; expose `stop()` / `destroy()` method; call `timer.unref()` if process exit should be allowed. |
| Medium | `recordLatency` | Inefficient rolling window: `Array.shift()` on `latencyWindow` causes O(n) memory re-indexing on every insertion after the 20-item cap. | Replace with a circular buffer (ring buffer) or pre-allocated array with write index to achieve O(1). |
| Medium | `selectModel` (least-latency) | Missing cached averages: recomputes rolling average via nested `reduce` over every eligible model on each call, causing redundant O(n×w) CPU work. | Maintain an incremental `avgLatency` field in `ModelState` updated during `recordLatency`. |
| Medium | `getStats` | Missing cached stats / large payload: recalculates averages and error rates from scratch for all N models; returns entire unbounded dataset as a single array. | Maintain running `sumLatency` and `errorRate` incrementally; add pagination or streaming for large model sets. |
| Medium | `selectModel`, `getStats` | Synchronous blocking iteration: `Array.from(...).filter(...)` and nested `reduce` block the event loop if `models` scales to thousands of entries. | Use lazy iteration or pre-computed eligible lists; offload heavy selection to a Worker or shard models. |
| Low | `selectModel` (round-robin) | Stale index state: global `roundRobinIndex` is not reset when model list mutates, causing uneven distribution and potential index desync after deletions. | Reset or bound index against `models.size` instead of derived `eligible.length`, or use an iterator. |

Wait, the user asked specifically for: blocking sync I/O, unbounded loops/allocations, N+1 calls, missing caching, redundant awaits, memory retention/leaks, large payload handling.

I should map my findings to these terms explicitly.

- **Unbounded loops/allocations**: The `models` Map is unbounded. Also `latencyWindow` is bounded but allocation churn from `shift`. I'll focus on the Map.
- **N+1 calls**: `getStats` does N models * inner reduce. That's N+1 pattern (computational). Also, if `probeModel` makes network calls, `runHealthProbes` does N concurrent calls. But N+1 is different from N. I'll frame `getStats` as "Computational N+1: outer loop over N models with inner loop over latency window".
- **Missing caching**: Rolling averages not cached. `eligible` list not cached.
- **Redundant awaits**: I genuinely don't see any. I will omit or state "None identified". But the prompt says "find". Maybe I should look at `runHealthProbes`: it's async, but `setInterval(() => this.runHealthProbes(), ...)` doesn't await. That's not redundant, it's missing. But maybe the `async` keyword is redundant if nothing awaits it? No, because inside it uses `await Promise.allSettled`. So it's needed. I'll skip redundant awaits unless I find one. Actually, is `await Promise.allSettled(probes)` redundant if `probes` is always an array of void promises? No, it's necessary to wait for them. I'll just not include a row for redundant awaits, or include "None found" but the user said "Output table". I'll include only findings.
- **Memory retention/leaks**: `models` Map, `activeRequests` leak, timer leak.
- **Large payload handling**: `getStats` returns everything.

Let me refine the table to be concise and match the requested categories.

Row 1: Unbounded allocation
Row 2: Memory leak (activeRequests)
Row 3: Memory leak (timer)
Row 4: Missing caching (least-latency avg)
Row 5: N+1 computation (getStats / least-l

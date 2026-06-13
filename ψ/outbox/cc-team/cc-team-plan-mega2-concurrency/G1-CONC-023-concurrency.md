<!-- cc-team deliverable
 group: G1 (concurrency division)
 member: CONC-023 role=concurrency model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1938,"completion_tokens":5000,"total_tokens":6938,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T12:13:44.702Z -->
The user wants a concurrency/async-safety audit of the provided TypeScript module `modelLoadBalancer.ts`. I need to identify issues related to:
1. Shared mutable state without locks
2. Check-then-act races
3. Unawaited promises
4. Promise.all error-swallowing (though they use allSettled, need to check if errors are swallowed)
5. Event-listener leaks
6. Cache stampedes
7. Ordering assumptions

I need to output a table with columns: severity | location | race/issue | fix

Let me analyze the code carefully.

**Shared mutable state without locks:**
- `models` is a Map, shared mutable state.
- `roundRobinIndex` is a number, shared mutable state.
- `currentStrategy` is shared mutable state.
- `healthProbeTimer` is shared mutable state.
- All methods mutate these without any synchronization primitives (locks, mutexes, atomics).
- In a Node.js environment with concurrent async operations (e.g., multiple requests being handled), this is problematic because:
  - `selectModel` reads and writes `roundRobinIndex` (read, check, write). This is a classic race condition.
  - `selectModel` increments `activeRequests` on a model state object.
  - `recordLatency` and `recordError` decrement `activeRequests` and mutate `latencyWindow`, `consecutiveErrors`, etc.
  - `addModel`, `removeModel` mutate the Map.
  - `runHealthProbes` iterates over `this.models` while other methods might be adding/removing models or mutating state.

**Check-then-act races:**
- `selectModel` with `roundRobinIndex`: checks `if (this.roundRobinIndex >= eligible.length)`, then sets to 0, then uses it, then increments. If two concurrent calls happen, they can both read the same index, or one resets after the other reads but before it writes, etc. Classic TOCTOU.
- `selectModel` checking `st.activeRequests >= st.config.maxConcurrent` and then later incrementing `selected.activeRequests`. Between the check and the increment, another request could also select the same model, exceeding maxConcurrent.
- `recordLatency` / `recordError`: `state.activeRequests = Math.max(0, state.activeRequests - 1);` This is a read-modify-write race. Two concurrent calls could read the same value, both decrement, and lose one decrement (or rather, if both read 2, both write 1, but should be 0). Actually, if both read 2, both compute max(0, 2-1)=1, both write 1. If one happened after the other properly, it should be 0. So yes, race.
- `addModel`: `if (this.models.has(config.id))` then get and update. If called concurrently, could result in inconsistent state or overwriting.
- `startHealthProbes`: `if (this.healthProbeTimer) return;` then sets it. Race if called concurrently (though private, could be called from constructor and potentially externally if not careful, but it's private. However, constructor is called from getInstance which has its own race).

**Unawaited promises:**
- `startHealthProbes` is called in constructor. It sets up `setInterval` which calls `runHealthProbes` every 30s. `runHealthProbes` is async and returns a Promise. `setInterval` does not await promises. If `probeModel` (not shown, but implied) throws or hangs, `runHealthProbes` promise might be unhandled. But they use `Promise.allSettled(probes)` inside, so errors within are swallowed (but the interval callback itself doesn't catch if `runHealthProbes` throws synchronously? No, `runHealthProbes` is async, so it returns a promise. `setInterval` ignores the return value. If `runHealthProbes` itself throws synchronously before creating the promise, that would be an unhandled exception. But more importantly, the interval fires every 30s regardless of whether the previous probe cycle finished. If probes take >30s, they pile up. This is an "unawaited promise" issue in the sense of overlapping executions (interval drift/stamping).
- Actually, `startHealthProbes` uses `setInterval(() => this.runHealthProbes(), 30_000)`. Since `runHealthProbes` is async, the interval doesn't wait for it. This can lead to overlapping probe executions if `probeModel` is slow. Should use a loop with delay or track in-flight status.

**Promise.all error-swallowing:**
- They use `Promise.allSettled(probes)`. This swallows errors from individual probes. If `probeModel` rejects, it's silently ignored. The health probe errors are not logged or handled. This is error-swallowing.

**Event-listener leaks:**
- The code imports `EventEmitter` but never uses it. Wait, looking at the code... `import { EventEmitter } from 'events';` is at the top but unused. This is dead code, not a leak per se, but worth noting? The prompt asks for event-listener leaks. Since EventEmitter isn't used, there are no leaks from it. However, if the class is instantiated multiple times (despite singleton pattern having race), the `setInterval` in constructor creates a timer. If `getInstance` race creates two instances, two timers leak. Also, there's no `stop` method to clear the interval, so if the module is reloaded or instance replaced, the timer leaks. But the main issue is the singleton race creating multiple instances.

**Cache stampedes:**
- Not exactly a cache, but the health probes: when a model is disabled and its `disabledUntil` expires, all concurrent requests or the periodic probe might try to probe it simultaneously. But more relevant: when a model becomes eligible again after being disabled, many concurrent `selectModel` calls might rush to it before probes complete? Actually, `selectModel` only checks `disabledUntil`. If `disabledUntil` passes, it becomes eligible immediately. But `runHealthProbes` is the one that checks `disabledUntil <= now` and then probes. Wait, `selectModel` checks `if (st.disabledUntil && st.disabledUntil > now) return false;`. So once time passes, it becomes eligible automatically without needing a probe. The probe just seems to be there to... actually, looking at `runHealthProbes`, it probes models where `disabledUntil <= now`. But `selectModel` already re-enables them implicitly by time comparison. So the probe is somewhat redundant for enabling, but maybe `probeModel` resets `disabledUntil` or `consecutiveErrors`? Since `probeModel` is truncated, we can't see. But the pattern of probing after expiry is fine, though overlapping intervals are the issue.
- More like a "thundering herd" or "stampede" when a disabled model comes back online: many requests select it simultaneously. But that's not exactly cache stampede. However, the `activeRequests` check in `selectModel` is meant to prevent overload, but due to the race condition in incrementing `activeRequests`, it can still be overwhelmed.

**Ordering assumptions:**
- `getInstance` singleton pattern: `if (!ModelLoadBalancer.instance)` check-then-act. Race condition where two threads (in async context) could both pass the check and create two instances. In Node.js, this is less about true parallelism and more about async interleaving, but if `getInstance` is called from async contexts, an await point inside constructor (there is none currently, but if added later) could cause issues. Even without await, if the event loop yields (which it doesn't in the constructor as written), but strictly speaking, the singleton pattern here is not thread-safe. However, in Node.js main thread, synchronous code in constructor won't yield, so two synchronous calls to getInstance are safe, but if the constructor were to become async or yield, it would race. But the current code: the constructor is sync. So the race in `getInstance` is minor in current Node.js single-threaded event loop for synchronous code, but still a code smell. Actually, if two async functions call `getInstance()` at the same time, they both evaluate `if (!ModelLoadBalancer.instance)` before either assigns, because the constructor is synchronous and runs to completion before either assignment? No: `ModelLoadBalancer.instance = new ModelLoadBalancer();` The `new` operator runs the constructor synchronously. So if call A enters, sees null, creates instance, assigns. Call B enters after A finishes (since A is sync), sees non-null, returns. They can't interleave because there's no await in the constructor. So the singleton race is not an issue *unless* the constructor becomes async or has async side effects that yield. But the constructor calls `startHealthProbes` which calls `setInterval`, which is sync. So actually `getInstance` is safe in Node.js. I should still mention it as a potential issue if refactored, but maybe not a current severe race. However, the prompt asks for check-then-act races, and `getInstance` is a classic example, even if in JS sync code it's safe. I'll include it with low severity or note it.

Wait, the user specifically asked for: "shared mutable state without locks, check-then-act races, unawaited promises, Promise.all error-swallowing, event-listener leaks, cache stampedes, ordering assumptions."

Let me map findings:

1. **Shared mutable state without locks / Check-then-act: `roundRobinIndex`**
   - Location: `selectModel`, round-robin branch
   - Issue: `this.roundRobinIndex` is read, checked against `eligible.length`, used to index, then incremented. Concurrent interleaving of async handlers can cause double-picking same index, index out of bounds (if not for the check, but the check itself is racy), or skipped models.
   - Fix: Use atomic/locked update, or better, store index per-strategy in a way that's atomic, or use a counter with modulo without conditional reset: `const idx = this.roundRobinIndex++ % eligible.length;` This removes the check-then-act. But still `++` is not atomic in JS? In single-threaded JS, synchronous `++` is atomic, but if `selectModel` is async (it isn't, it's sync), but if called from async contexts, the function itself runs atomically to completion because there's no await inside. Wait, `selectModel` is synchronous. So in Node.js, the entire function body runs without interruption. Therefore, `this.roundRobinIndex` read-check-write is actually atomic relative to other JS code because it's all synchronous. Is that right? Yes, JavaScript is single-threaded. Unless `selectModel` has an `await` inside it, it cannot be interrupted by another event loop task. Looking at `selectModel`, it is entirely synchronous. So the `roundRobinIndex` manipulation is actually safe from races in the current code because there's no await point. However, if someone adds an await later, it becomes unsafe. But the prompt is about current code. Should I flag it? The prompt says "Concurrency/async-safety audit". The code uses synchronous methods to mutate shared state that is accessed by multiple concurrent requests. In Node.js, since it's single-threaded, synchronous methods are atomic. But the issue is that `activeRequests` is decremented in `recordLatency`/`recordError`, which are also synchronous. So read-modify-write on `activeRequests` is safe *if* all accesses are synchronous. But what about the health probe timer? That's a separate timer. And `addModel`/`removeModel` could be called from async contexts. Since the methods are sync, they run to completion. So actually, many of these "race conditions" might not be true races in the strict JS sense because there's no preemption of synchronous code. However, there are still issues:
   - `Promise.allSettled` overlapping with mutations? No, `runHealthProbes` is async and uses `await Promise.allSettled`. While awaiting, the event loop can run other tasks that call `selectModel`, `recordLatency`, etc. So mutations to `this.models` (e.g., `removeModel`) can happen while `runHealthProbes` is iterating. The `for...of` loop over `this.models.values()` gets an iterator. If `removeModel` is called during the `await Promise.allSettled`, the Map is modified. But the iterator was already created. In JS, modifying a Map during iteration can cause issues, but if the iteration is already done (the array of promises is built synchronously before the await), then the await happens after. Let's look: `runHealthProbes` builds `probes` array synchronously in the `for` loop, then awaits. During the synchronous loop, it reads `state.disabledUntil`. Then it pushes `this.probeModel(state)`. If `probeModel` is async and accesses `state`, and during its execution `removeModel` deletes the model from the map, `probeModel` still holds the `state` reference. That's fine. But if `addModel`/`removeModel` are called *during* the `for...of` loop (synchronously), that could affect iteration. However, since `runHealthProbes` is called from `setInterval`, and the loop is synchronous, it won't be interrupted by other JS code during the loop. So that's safe too.
   - The real issue: `setInterval` calling an async function means overlapping executions. If one `runHealthProbes` takes longer than 30s, another starts. That's an unawaited promise / overlapping timer issue.

Let me reconsider the severity of "shared mutable state without locks" in Node.js. It's a common audit item. Even though JS is single-threaded, shared mutable state across async boundaries (e.g., one async function reads, yields, another async function writes) is problematic. But here, the reads/writes happen in synchronous chunks. However, the `activeRequests` increment in `selectModel` and decrement in `recordLatency`/`recordError` happen in different synchronous calls. Between the increment and decrement, other calls can interleave. That's intended behavior (it's a counter). But the decrement itself: `state.activeRequests = Math.max(0, state.activeRequests - 1);` If two `recordError` calls happen for the same model concurrently (e.g., two requests failed at the same time and both call this), they are queued on the event loop. Since each runs synchronously, they execute one after another. The first reads `activeRequests` (say 2), computes 1, writes 1. The second reads 1 (if second runs after first), computes 0, writes 0. So it's actually safe because each operation is atomic and they are serialized by the event loop. Wait, but what if `activeRequests` was incremented by `selectModel` in between? No, because `selectModel` is also synchronous. So the counter is actually safe in Node.js.

So what are the *real* concurrency issues here?

1. **Promise.allSettled error swallowing**: Definitely real. `runHealthProbes` uses `allSettled` and doesn't log or handle rejections. If probes fail, they are silently ignored. This is error-swallowing.

2. **Unawaited promises / Interval overlap**: `setInterval(() => this.runHealthProbes(), 30_000)` fires every 30s regardless of completion. If probes are slow, multiple cycles overlap. This is a resource leak and can cause stampede. Fix: use `setTimeout` loop or track `isProbing`.

3. **Event listener / Timer leak**: No `stopHealthProbes` or cleanup. The timer keeps the process alive. If the module is hot-reloaded or instance discarded, the old timer leaks. Also, singleton pattern with private constructor means no external cleanup. The `EventEmitter` import is unused, but that's not a leak. However, the `setInterval` timer is a leak if not cleaned up. Also, if `getInstance` somehow created two instances (e.g., via reflection or if the check was bypassed), two timers would exist. But more importantly, no cleanup method.

4. **Cache/Probe Stampede**: When a model's `disabledUntil` expires, `runHealthProbes` might probe it. But if multiple probe cycles overlap (due to interval issue), or if the system has many instances (though singleton), multiple probes could hit the same failing model simultaneously. Also, when a model is re-enabled, there's no gradual ramp-up. But the main stampede is the health probe interval overlap causing multiple concurrent probe sets.

5. **Ordering assumptions / Check-then-act**: Let's look closer at `selectModel` and `maxConcurrent`.
   - `selectModel` filters eligible models based on `activeRequests >= maxConcurrent`.
   - Then later increments `selected.activeRequests`.
   - Because the entire function is synchronous, the check and act are in the same synchronous block. So no other JS code can run between them. This is actually safe in Node.js. BUT, if this code were ever used in a Worker Thread or if methods become async, it breaks. Should I flag it as an ordering assumption? The prompt asks for "ordering assumptions". The code assumes that synchronous execution protects it, but it doesn't use any explicit synchronization. In a strict audit, we flag these as logical races even if JS serialization saves them, because they are fragile. Also, if `selectModel` is called from multiple request handlers, the handlers themselves are interleaved at await points. But since `selectModel` has no await, each call runs atomically. So the maxConcurrent check is actually correct in current Node.js. However, the `roundRobinIndex` check: `if (this.roundRobinIndex >= eligible.length) this.roundRobinIndex = 0;` followed by `selected = eligible[this.roundRobinIndex];` and then `this.roundRobinIndex = (this.roundRobinIndex + 1) % eligible.length;`. This is all synchronous, so it's atomic. No race.

Wait, but what about `recordLatency` and `recordError`? They both mutate `latencyWindow` with `push` and `shift`. These are synchronous array operations. If two calls interleave (which they do on the event loop), each push/shift is atomic. But what if one does `push` and then before `shift`, another `recordLatency` runs? Let's trace: state.latencyWindow has length 20. Call A pushes (length 21). Then Call A shifts (length 20). If Call B runs between push and shift, it sees length 21, pushes (length 22), then shifts (length 21). Then Call A shifts (length 20). The window ends up with 20 items, but the oldest item might be from before Call A, and Call B's item is included. This is actually fine; it's just a slightly larger window transiently. Not a serious bug.

What about `addModel` updating existing: `if (this.models.has(config.id))` then `const state = this.models.get(config.id)!; state.config = { ...config };`. This is synchronous and safe.

What about `getInstance`? As discussed, safe in sync JS.

So the real issues are more about async lifecycle and error handling than low-level data races (because JS is single-threaded). But the user explicitly asked for "shared mutable state without locks" etc. I need to interpret these in the context of Node.js concurrency (async interleaving).

Let me think about "shared mutable state without locks" in a broader sense: the `models` Map and state objects are shared across all async operations. Even though individual operations are atomic, the composition is not. For example, `selectModel` increments `activeRequests`, but if the caller never calls `recordLatency` or `recordError` (e.g., request crashes), `activeRequests` leaks. This is a logical concurrency bug (counter leak), not a data race per se, but related to async safety. The prompt mentions "unawaited promises" and "ordering assumptions". The leak of `activeRequests` due to missing decrement is an ordering assumption: the code assumes `recordLatency`/`recordError` always follows `selectModel`. If not, the counter is wrong. This is a real issue.

Also, `removeModel` deletes from the Map. If a model is removed while `activeRequests` > 0, and then `recordLatency` is called with that modelId, it returns early (`if (!state) return;`). So the active request counter is lost (leaked). This is another issue.

Let's compile a solid list:

**Issue 1: Active request counter leak (ordering assumption)**
- Severity: High
- Location: `selectModel` / `recordLatency` / `recordError`
- Issue: `activeRequests` is incremented in `selectModel` but decremented only if caller explicitly calls `recordLatency` or `recordError`. If an exception occurs between selection and recording, or if the process crashes, the counter never decrements, permanently disabling the model under `maxConcurrent`. This is an ordering assumption that caller always reports back.
- Fix: Use a try/finally pattern or wrapper/closure to ensure decrement, or return a lease/token that auto-decrements on cleanup.

**Issue 2: Overlapping health probe executions (unawaited promises / interval drift)**
- Severity: High
- Location: `startHealthProbes` / `runHealthProbes`
- Issue: `setInterval` schedules `runHealthProbes` every 30s regardless of whether the previous async probe cycle finished. Slow probes cause overlapping executions, resource exhaustion, and thundering herd against disabled models.
- Fix: Replace `setInterval` with a `setTimeout` loop that waits for completion, or guard with an `isProbing` flag.

**Issue 3: Promise.allSettled error swallowing**
- Severity: Medium
- Location: `runHealthProbes`
- Issue: `await Promise.allSettled(probes)` silently discards all probe failures. Circuit-broken models could be permanently disabled because probe errors are never logged or acted upon.
- Fix: Inspect `results` and log/handle errors; use `allSettled` but iterate over outcomes, or use `Promise.all` with explicit try/catch per probe.

**Issue 4: Timer / Event leak (event-listener leak analog)**
- Severity: Medium
- Location: `startHealthProbes` / constructor
- Issue: `setInterval` timer is stored but never cleared. No `stop()` or `dispose()` method exists. If the instance is recreated or module reloaded, the old timer keeps firing and prevents process exit. Also, the `EventEmitter` import is unused (minor).
- Fix: Provide a `dispose()` method that `clearInterval(this.healthProbeTimer)`, and clear in constructor if already set.

**Issue 5: Singleton instance leak / double initialization (check-then-act)**
- Severity: Medium
- Location: `getInstance` / constructor
- Issue: `getInstance` has a classic check-then-act race. While currently safe because the constructor is synchronous, if it ever yields (e.g., async initialization), two instances could be created. More immediately, there is no guard against multiple `new` calls if access control is bypassed (e.g., testing, reflection). The constructor is private but TypeScript `private` is compile-time only.
- Fix: Use a static initialization block or `static instance = new ModelLoadBalancer()` for eager safe singleton, or guard with a flag/symbol.

**Issue 6: Health probe

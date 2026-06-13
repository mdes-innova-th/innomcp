<!-- cc-team deliverable
 group: G1 (concurrency division)
 member: CONC-018 role=concurrency model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2058,"completion_tokens":5000,"total_tokens":7058,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 78s
 generated: 2026-06-13T12:12:11.352Z -->
The user wants a concurrency/async-safety audit of the provided TypeScript module `leaderboardMetrics.ts`. I need to identify issues related to:

1. Shared mutable state without locks
2. Check-then-act races
3. Unawaited promises
4. Promise.all error-swallowing (though Promise.all isn't explicitly used here, there might be similar patterns)
5. Event-listener leaks (not obvious here, but maybe related to setImmediate or other patterns?)
6. Cache stampedes
7. Ordering assumptions

Let me analyze the code carefully.

**Shared mutable state without locks:**
- `const store = new Map<string, RawStats>();` is a global mutable Map.
- `recordProviderCall` and `recordProviderWin` both read from and write to this Map.
- In Node.js, operations on a single Map are synchronous, but if this module is used across multiple async contexts (which it will be, since it's recording provider calls from a fan-out), there can be interleaving.
- The comment says "Thread-safe for single-process Node.js (synchronous Map operations)" but this is misleading. While individual Map operations are atomic, the sequences of operations are not. For example, in `recordProviderCall`:
  ```typescript
  const existing = store.get(providerId);
  if (existing) {
    existing.requests += 1; // read-modify-write on the object
    ...
  } else {
    store.set(providerId, {...});
  }
  ```
  This is a classic check-then-act race. Two concurrent calls for the same new providerId could both get `undefined` from `store.get`, then both do `store.set`, and one overwrites the other.

- Also, even if `existing` is found, mutating the object properties like `existing.requests += 1` is not atomic across async boundaries. If two async calls interleave, you can lose increments.
- Same issue in `recordProviderWin`.

**Check-then-act races:**
- As noted above, `store.get` followed by mutation or `store.set` is a race.
- In `recordProviderCall`: `if (existing)` then mutate properties. If two calls happen concurrently for the same provider, they both get the same object reference and mutate it. Since these are just CPU operations, in Node.js single-threaded event loop they won't interleave mid-instruction, but the entire sequence isn't atomic. Actually, in Node.js, since it's single-threaded, individual property increments won't have race conditions unless there's an await between read and write. But wait - are there any awaits in the critical section? No, the mutation is synchronous. However, the `store.get` and `store.set` in the `else` branch is a race if two calls for the same new provider happen in different ticks? Actually, since it's all synchronous code until `persistLeaderboardStats` (which uses setImmediate), the entire function body runs to completion before yielding. So within a single event loop tick, multiple calls to `recordProviderCall` would be sequential, not interleaved. But if this is called from async functions that are running in parallel (e.g., Promise.all), the calls to `recordProviderCall` might be scheduled in different ticks? No, Promise.all doesn't create threads, but the callbacks might interleave if there are awaits inside. Since `recordProviderCall` is entirely synchronous (no await), it will run atomically with respect to the event loop. However, if called from worker threads or if the process is clustered, then it's unsafe. The comment claims thread-safety for single-process Node.js, which is technically true for the event loop, but the check-then-act with `store.set` in the else branch is still problematic if the same provider is recorded in the same microtask? Actually no, in a single-threaded event loop, synchronous code blocks don't interleave. So `store.get` and `store.set` in the same synchronous block are safe from that perspective. But wait - what if `recordProviderCall` is called from different promises that resolved in the same microtask queue? They still execute sequentially. So the check-then-act on the Map itself might actually be safe in Node.js single-threaded context.

But the mutations on the `existing` object: if two calls happen, they both get the same object reference. The mutations are synchronous, so they execute one after another. No race in the traditional sense for single-threaded JS. However, if the map operations themselves are considered, there's still a logical issue.

Actually, the bigger issue is that `persistLeaderboardStats` uses `setImmediate`, which defers execution. But the in-memory update happens immediately.

Wait, I should reconsider. The user is asking for a concurrency/async-safety audit. Even if Node.js is single-threaded, there are still async safety issues here:

1. **Unawaited promises / Fire-and-forget**: `persistLeaderboardStats` wraps DB operations in `setImmediate` and swallows errors. The DB operations are not awaited and errors are silently caught. This means:
   - The caller never knows if persistence failed.
   - If the process crashes before the setImmediate fires, data is lost.
   - Multiple concurrent DB writes could happen out of order (though the SQL uses `requests = requests + 1` so it's somewhat safe, but the initial insert might race).

2. **Promise.all error-swallowing**: Not directly present, but the `.catch(() => {})` pattern inside `persistLeaderboardStats` and inside the `withDbConnection` callback is error swallowing.

3. **Ordering assumptions**: The code assumes that in-memory state is always authoritative and DB writes can happen asynchronously without coordination. But if there are multiple DB writes for the same provider, they could execute out of order (e.g., if connection pooling causes earlier requests to finish later). The SQL uses atomic increments (`requests = requests + 1`), so the DB side is safe, but the `last_seen = NOW()` could be overwritten by an older request that finishes later. Actually, `last_seen = NOW()` is idempotent in the sense that it's just set to current time, but if an older request finishes later, it would still set `last_seen` to its own current time (which is later than the older request's time, but the request itself was older). Wait, no - if request A starts at T1, request B starts at T2, A writes to DB at T3, B writes at T4. Both set `last_seen = NOW()` to their respective write times. That's probably fine. But if the SQL didn't use atomic increments, there would be lost updates.

4. **Cache stampedes**: Not exactly cache, but the `store.get` / `store.set` pattern with missing key could lead to creating multiple entries if accessed concurrently in a multi-process or worker_thread environment. In cluster mode with multiple Node.js processes, each has its own `store` Map, so they diverge. But within a single process, it's okay.

5. **Event-listener leaks**: Not obvious, but `setImmediate` itself isn't a leak. However, if `persistLeaderboardStats` is called many times rapidly, it schedules many `setImmediate` callbacks. Under extreme load, this could overwhelm the event loop. Not exactly a leak, but unbounded queue growth.

6. **Shared mutable state without locks**: The `store` Map is global. While Node.js is single-threaded, if this code were ever used in a Worker or if the runtime changes, it's unsafe. More importantly, the `getProviderStats` returns a new Map, but the values inside are new objects. However, `getSparklineData` returns `raw.latencySamples.slice(-n)` which returns a new array, so that's safe. But `getIntentWinsSnapshot` returns nested Maps with primitive values, so that's safe.

Wait, let me look more carefully at `recordProviderCall` and `recordProviderWin` for check-then-act.

In `recordProviderCall`:
```typescript
const existing = store.get(providerId);
if (existing) {
    existing.requests += 1;
    ...
} else {
    store.set(providerId, {...});
}
```

In single-threaded Node.js, this is actually safe from interleaving because there's no `await` in the function. However, if called from a `Promise.all` where multiple promises have resolved and their microtasks are queued, each call to `recordProviderCall` runs entirely before the next one because it's synchronous. So no race.

BUT - if the code is ever run in an environment with actual parallelism (Worker threads, or if Map operations become async somehow), it's unsafe. The prompt asks to check for these issues, so I should flag them as potential risks, especially since the comment incorrectly asserts thread safety.

Actually, there is a more subtle issue: `recordProviderWin` and `recordProviderCall` can both be called for the same provider concurrently from different async contexts. Since both are synchronous, they won't interleave mid-function. But what if `recordProviderCall` is called, and then before it completes, `recordProviderWin` is called? They are both synchronous, so they execute atomically on the event loop. So no interleaving.

However, there is a real issue: **The DB persistence is fire-and-forget and unawaited**. The `persistLeaderboardStats` function uses `setImmediate` to defer DB writes. If the process crashes or restarts, in-memory stats are lost. Also, under high load, many `setImmediate` callbacks accumulate.

Another issue: In `recordProviderCall`, the DB persistence callback captures `providerId`, `success`, `latencyMs` by closure. But if multiple calls happen rapidly, each gets its own closure. That's fine.

Wait, there's a bug in the SQL: `successes = successes + VALUES(successes)` - this looks correct. But `VALUES(successes)` refers to the inserted value. The insert uses `success ? 1 : 0`. So if success is true, it adds 1. That's fine.

But look at the `recordProviderWin` persistence (truncated in the code, but we can infer):
```typescript
persistLeaderboardStats(() => {
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO provider_stats (provider_id, wins)
         VALUES (?, 1)
         ON DUPLICATE KEY UPDATE wins = wins + 1`,
        [providerId]
      );
    }).catch(() => {
      // DB unavailable — in-memory stays authoritative
    });
  });
```

Issues here:
1. **Unawaited promises**: `persistLeaderboardStats` doesn't return the promise, so callers can't await. The function signature is `void`.
2. **Error swallowing**: `.catch(() => {})` hides DB errors, making it impossible to detect persistent DB failures.
3. **Ordering assumptions**: The DB writes are unordered. If `recordProviderCall` and `recordProviderWin` fire for the same provider, they might execute in any order. Since they update different columns, this might be okay, but if they both try to insert a new row, one might fail with duplicate key and retry? Actually `ON DUPLICATE KEY UPDATE` handles it.
4. **Cache stampede**: Not exactly, but if `getProviderStats` is called frequently while mutations happen, it reads from the Map while it's being modified. Since Map iteration in V8 is safe against insertion/deletion (per ES spec, though not all operations are safe during iteration), but mutations during iteration of the exact same Map could be problematic. However, `getProviderStats` iterates `store.entries()` while other functions might modify `store`. In V8, modifying a Map during iteration is generally okay for set/delete, but here we're mutating values inside the map, not the map structure itself (except for new providers). So iteration should be stable.

Wait, there is a potential issue with `getProviderStats`: it computes `avgLatency` as `Math.round(raw.totalLatency / raw.requests)`. If `raw.requests` is 0, this would be NaN or Infinity, but the code only sets `requests: 0` in `recordProviderWin` when creating a new entry without requests. Then `avgLatency` would be `Math.round(0 / 0)` which is `NaN`. But the `ProviderStats` interface says `avgLatency: number`. This is a divide-by-zero bug, not necessarily concurrency.

Let me focus strictly on concurrency/async-safety as requested.

Key issues to report:

1. **Shared mutable state without locks / Check-then-act race**: The global `store` Map is mutated synchronously, but the check-then-act pattern (`store.get` then mutate or `store.set`) is unsafe if this code is ever used across multiple Worker threads or if async boundaries are introduced later. Even in single-threaded Node.js, the comment's claim of thread-safety is misleading. More importantly, `recordProviderCall` and `recordProviderWin` have read-modify-write cycles on the `RawStats` objects that are not atomic across async boundaries if the code is refactored to include awaits. But currently, since they're fully synchronous, the race is only on the Map structure for new providers if called from the same microtask? No, still safe in single-threaded JS. However, I should flag it as a logical race / check-then-act because it's a classic pattern that breaks under any concurrency (e.g., if moved to workers or if the event loop yields). Actually, I can frame it as: "Check-then-act on global Map; if multiple async callers race to initialize a new provider, the second `store.set` can clobber the first's in-flight mutations." But in single-threaded JS, this can't happen because the first call completes entirely before the second starts. Unless... the calls are made from different contexts that are interleaved? No, synchronous functions don't interleave.

Hmm, maybe I should be more careful. In Node.js, if `recordProviderCall` is called within a Promise.all fan-out, and the fan-out callbacks are synchronous, they will execute sequentially in the microtask queue. So no interleaving. The race condition is not currently exploitable in standard single-threaded Node.js. But it IS a latent bug: if anyone adds an `await` inside these functions later, it becomes a race. And the comment explicitly claims thread-safety, which is a red flag.

Actually, there is a real concurrency issue: **The DB persistence is not coordinated with the in-memory state**. If the process restarts, in-memory state is lost. But that's more of a durability issue.

Another real issue: **`getProviderStats` iterates over `store` while `recordProviderCall` may mutate existing entries and add new ones.** In V8/JS, mutating values inside a Map during iteration is generally safe, but adding/removing keys during iteration can cause some entries to be skipped or visited twice (depending on implementation). However, `recordProviderCall` only adds new keys via `store.set` when `existing` is falsy. If `getProviderStats` is running (iterating) and `recordProviderCall` adds a new key, the new entry may or may not appear in the iteration. This is a concurrency/ordering issue.

Wait, Map iteration in JS is specified such that if entries are added after iteration starts, they may not be visited. But if the Map is modified during iteration, it's actually implementation-defined in some cases? According to ECMAScript spec, Map.prototype.entries returns a live iterator. If the map is modified (keys added/removed), the iterator reflects the current state, but there's no guarantee about newly added elements. However, for a single-threaded event loop, since `getProviderStats` is synchronous, no other code can modify the map during its execution unless it's called reentrantly (which it isn't). So this is safe.

Let me reconsider the prompt. It asks for: "shared mutable state without locks, check-then-act races, unawaited promises, Promise.all error-swallowing, event-listener leaks, cache stampedes, ordering assumptions."

I need to map these to actual findings in the code:

1. **Shared mutable state without locks**: The global `store` Map. Even though Node.js is single-threaded, concurrent async access patterns (e.g., multiple requests in a fan-out) can lead to logical races if the functions were ever made async or used in workers. But more importantly, the `store` is shared mutable state accessed by all provider calls without any synchronization mechanism. I should flag this as Medium/High severity because it's a central stats store that could be corrupted under load or if the execution model changes.

2. **Check-then-act races**: `store.get(providerId)` followed by conditional mutation or `store.set`. This is a textbook check-then-act. Even in Node.js, if two calls for the same provider arrive in the same tick (e.g., from a Promise.all where both are synchronous callbacks), the second one might overwrite the first? No, as established, they run sequentially. But I can flag it as a latent race / anti-pattern. Actually, there is a scenario: if `recordProviderCall` is called, it does `store.get`. If the provider doesn't exist, it creates one. Then `recordProviderWin` is called for the same provider. Since both are synchronous, they run atomically. But if the code is ever refactored to include async operations (e.g., fetching existing stats from DB), it becomes a race. The current code is synchronous, so maybe severity is lower.

Actually, I think there is a genuine issue: `recordProviderWin` can create a new entry with `requests: 0`. If `recordProviderCall` and `recordProviderWin` are called concurrently (e.g., from a Promise.all fan-out where one records the call and another records the win), and if the provider is new, the following can happen:
- Call 1 (recordProviderCall): `existing = undefined`, so it does `store.set(id, {requests: 1, ...})`.
- Call 2 (recordProviderWin): `existing = undefined`, so it does `store.set(id, {requests: 0, wins: 1, ...})`.
Since both are synchronous, the order depends on which call is scheduled first in the microtask queue. If Call 2 runs after Call 1, it overwrites the entry with `requests: 0`, losing the request count! This is a real race condition even in single-threaded Node.js when called from a Promise.all or similar parallel fan-out. Because the fan-out callbacks may resolve and queue microtasks, and the order of those microtasks is deterministic based on the Promise resolution order, but if both resolve at essentially the same time, the microtasks are queued in order. However, if `recordProviderCall` is called from one promise and `recordProviderWin` from another, and both are synchronous, they execute in the order their promises resolved. But the key point is: they are separate tasks on the event loop (or microtasks), and between them, the shared state is modified. So yes, this is a check-then-act race! The first one checks `store.get`, sees nothing, and sets. The second one, running in a subsequent microtask, checks `store.get`, sees nothing (if it runs before the first's set? No, the first runs entirely in its microtask, so the set happens before the second microtask starts). Wait, microtasks are processed in FIFO order. If Promise A resolves and queues microtask MA, and Promise B resolves and queues microtask MB, MA runs completely, then MB runs completely. So by the time MB runs, MA has already done `store.set`. Thus `store.get` in MB would see the entry. So no race.

But what if `recordProviderCall` is called from the same Promise.all for two different responses, and both call it for the *same* provider? Then:
- Promise A resolves, queues MA: `recordProviderCall('p1')` -> sees undefined, sets entry with requests=1.
- Promise B resolves, queues MB: `recordProviderCall('p1')` -> sees entry (set by MA), increments to 2.
This is safe.

What if `recordProviderWin` is called from a promise that resolves *before* the `recordProviderCall` promise for the same provider? Then:
- MW runs: sees undefined, sets entry with wins=1, requests=0.
- MC runs: sees entry (from MW), increments requests to 1.
This is safe, though the initial state is created by `recordProviderWin`.

So actually, the check-then-act on the Map itself is safe in single-threaded Node.js because the operations are synchronous and microtasks don't interleave.

However, there is still a **logical ordering issue**: if `recordProviderWin` runs before `recordProviderCall` for a new provider, the entry is created with `requests: 0`. Then `getProviderStats` computes `avgLatency = 0/0` -> NaN. This is a bug, but is it a concurrency issue? It's an ordering assumption issue: the code assumes `recordProviderCall` always happens before `recordProviderWin`, but in a fan-out, the win might be recorded before or independently of the call.

Wait, looking at the code: `recordProviderWin` creates a new entry if none exists, with `requests: 0`. Then `getProviderStats` does `Math.round(raw.totalLatency / raw.requests)` which is `0/0` = NaN. This is a genuine bug that manifests if a provider wins before any call is recorded (or if only wins are recorded). This could happen in async flow where the win is recorded but the call record hasn't happened yet, or if the win is recorded for a provider that wasn't part of the call tracking (e.g., a fallback provider). This is an ordering assumption.

Let me identify all the issues clearly:

**Issue 1: Unawaited promises / Fire-and-forget DB writes**
- Location: `persistLeaderboardStats` and its callers (`recordProviderCall`, `recordProviderWin`).
- Race/Issue: DB persistence is fire-and-forget via `setImmediate`. Errors are swallowed (`.catch(() => {})`). If the process crashes or shuts down, pending DB writes are lost. No backpressure or limit on queued DB writes.
- Fix: Return the promise from `persistLeaderboardStats` (or use a bounded queue with `await`/drain on shutdown). At minimum, log errors instead of swallowing.

**Issue 2: Error swallowing / Promise.all error-swallowing pattern**
- Location: `persistLeaderboardStats` inner catch, and `withDbConnection(...).catch(...)` inside `recordProviderCall`.
- Race/Issue: Silent failure of DB operations masks outages and makes debugging impossible. The `.catch(() => {})` is equivalent to Promise.all error swallowing.
- Fix: Log errors with a logger; consider circuit breaker for DB writes.

**Issue 3: Check-then-act race on Map initialization**
- Location: `recordProviderCall` and `recordProviderWin` - `store.get` then `store.set`.
- Race/Issue: While single-threaded, if the module is ever used with Worker Threads or clustered processes, multiple threads can interleave between get and set, causing lost updates. Even in single-threaded, the pattern is brittle.
- Fix: Use `Map.prototype.has` + `set` atomically, or better, use a single atomic update function. Or use `store.computeIfAbsent` pattern (not native in JS Map, but can be simulated). Actually, since the object mutation is in-place for existing keys, the only race is on initial insertion. A simple fix is to always `store.set` a new object if absent, but merge if present? No, that's still

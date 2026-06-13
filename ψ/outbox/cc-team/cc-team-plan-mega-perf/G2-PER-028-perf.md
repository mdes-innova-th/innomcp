<!-- cc-team deliverable
 group: G2 (perf division)
 member: PER-028 role=perf model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":896,"completion_tokens":5000,"total_tokens":5896,"prompt_tokens_details":{"cached_tokens":63,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-13T12:04:27.923Z -->
The user wants a performance audit of the provided TypeScript code (`notificationService.ts`). I need to find specific issues: blocking sync I/O, unbounded loops/allocations, N+1 calls, missing caching, redundant awaits, memory retention/leaks, large payload handling.

Then output a table with columns: severity | location | issue | fix.

No praise. Just the issues.

Let's analyze the code carefully.

**Code structure:**
- `NotificationService` class with a singleton export.
- `listeners`: Map<string, callback> - stores one callback per sessionId.
- `history`: Notification[] - stores all notifications.
- `MAX_HISTORY = 1000`.
- `subscribe(sessionId, callback)`: sets listener. Returns unsubscribe.
- `notify(notification)`: creates full notification, adds to history, gets callback by sessionId, calls it.
- `broadcast(notification)`: creates full notification, adds to history, iterates all listeners, calls them with try/catch.
- `getRecentNotifications(sessionId, limit)`: filters history by sessionId, sorts by timestamp desc, slices.
- `addToHistory(notification)`: pushes to history, if > MAX_HISTORY, reassigns history to last 1000 elements.

**Potential Issues:**

1. **Memory retention / leak in `subscribe`**: The `listeners` Map only stores one callback per `sessionId`. If a session subscribes multiple times, the previous callback is overwritten without being cleaned up? Actually, `set` overwrites the previous value. The old callback might be referenced elsewhere, but the Map itself doesn't leak. However, if a session is never unsubscribed, the listener remains forever. But that's expected behavior for a subscription service unless sessions are ephemeral. More importantly, `history` retains all notifications (up to 1000). But `getRecentNotifications` filters and sorts on every call.

2. **Unbounded allocations / O(N) in `getRecentNotifications`**: Every call to `getRecentNotifications` does:
   - `.filter(n => n.sessionId === sessionId)`: O(N) where N = history length (up to 1000). Not huge, but called frequently could be an issue.
   - `.sort((a, b) => b.timestamp - a.timestamp)`: O(M log M) where M is filtered results. But history is already roughly chronological because `addToHistory` pushes to the end. However, since `broadcast` notifications don't have a sessionId, they are in history too. Wait, `broadcast` sets `broadcast: true` but does not set `sessionId`. So `getRecentNotifications` filters by `sessionId`. If `broadcast` notifications have no `sessionId`, they won't appear in session-specific history. But the history array is chronological. If we only want recent notifications for a session, we could search backwards and stop at `limit`. The current implementation filters the entire history (1000 items) and sorts them. Since `history` is append-only and mostly ordered by timestamp (assuming `Date.now()` is monotonic), the sort is mostly redundant but still executed. This is wasteful.

3. **Memory retention in `history` / large payload handling**: `history` stores up to 1000 notifications. Each notification has `data?: unknown` which could be a large object. If `data` contains large payloads (e.g., file contents, base64 strings), retaining 1000 of them could consume significant memory. No size limits on `data` or notification payload. This is a memory retention / large payload handling issue.

4. **N+1 calls / missing caching**: Not exactly N+1 in the database sense, but `getRecentNotifications` is called per session without caching. If multiple requests come for the same session, it recomputes the filter+sort each time. Could cache per session. But more importantly, `notify` and `broadcast` call `addToHistory` which does `this.history = this.history.slice(-NotificationService.MAX_HISTORY)`. This creates a new array copy every time the history exceeds 1000. If under heavy load (e.g., thousands of notifications per second), this causes frequent large array allocations. The slice creates a shallow copy of up to 1000 elements. This is an unbounded allocation issue during high throughput.

5. **Blocking sync I/O**: No obvious sync I/O like `fs.readFileSync`. `crypto.randomUUID()` is generally fast but might be synchronous/blocking in a tight loop? It's a crypto operation. In Node.js, `crypto.randomUUID()` is synchronous and uses a CSPRNG. For very high throughput, this could be a bottleneck, but it's not "blocking I/O" per se. However, `Date.now()` is fine. `console.error` in `broadcast` is synchronous I/O (blocking) to stdout/stderr. That's a classic issue: `console.error` inside a hot loop (`for...of this.listeners`) is synchronous blocking I/O.

6. **Redundant awaits**: There are no async functions or awaits in the code. So no redundant awaits.

7. **Unbounded loops**: `broadcast` iterates over all listeners. If there are many listeners (e.g., thousands of sessions), this is a loop. But it's bounded by the Map size. However, if a callback is synchronous and throws, it's caught. If a callback is asynchronous (returns a promise) but is called without await, the error won't be caught by the try/catch if it's an async throw. But the signature is `(n: Notification) => void`, so it's expected to be sync. Not exactly unbounded.

8. **Memory leak in `addToHistory`**: `this.history = this.history.slice(-NotificationService.MAX_HISTORY)` creates a new array and drops the old one. The old array becomes garbage collectible, but the elements are retained in the new array. However, if notifications have `data` that references large objects, those are retained. This is the large payload / memory retention issue.

9. **Missing caching**: `getRecentNotifications` could maintain a per-session index or cache to avoid scanning all history. Also, `history` is never trimmed by age, only by count. 1000 notifications could span a long time.

10. **Unbounded growth of `listeners`**: If `subscribe` is called many times with unique sessionIds without unsubscribing, the Map grows unbounded. This is a memory leak. The code only allows one callback per sessionId, but if sessionIds are dynamic (e.g., UUIDs per connection), and connections drop without unsubscribing, the Map leaks. The unsubscribe function exists but callers might not invoke it. This is a classic leak.

11. **Inefficient history trimming**: `addToHistory` checks length after every push. If history is at max, it slices. This is O(MAX_HISTORY) every time after max is reached. A circular buffer or `shift()` would be O(1) (though `shift()` is O(N) in V8 for large arrays, actually). Wait: `shift()` on a large array in JS is O(N) because it re-indexes all elements. `slice` creates a new array and copies elements, which is O(N). A better approach is to use a circular buffer or just keep the array and not trim so aggressively, or use a linked list. But with N=1000, it's small. However, if `MAX_HISTORY` were larger or if this pattern is used elsewhere, it's worth noting. Actually, `this.history.push(notification)` followed by `if (this.history.length > MAX_HISTORY) this.history.shift()` would be O(N) due to reindexing. The current `slice(-MAX_HISTORY)` is also O(N) but creates a new array. Since N is capped at 1001, it's bounded. But it's still an allocation on every insert after cap. This is an unbounded allocation issue under sustained load.

12. **Lack of backpressure / error handling in broadcast**: If a listener throws, it's caught and logged to `console.error` (sync I/O). But if a listener is slow/blocking, it blocks the entire broadcast loop. Since callbacks are synchronous by signature, a blocking listener stalls all other listeners. This is a blocking issue within a loop.

13. **notify() uses `notification.sessionId!`**: Non-null assertion. If `sessionId` is missing, `listeners.get(undefined)` returns undefined, so no callback. But `getRecentNotifications` filters by sessionId. If a notification is added without sessionId (e.g., broadcast notifications don't have sessionId? Wait, broadcast sets `broadcast: true` but doesn't set `sessionId`. The `Notification` interface says `sessionId?: string`. In `notify`, it uses `notification.sessionId!`. If called with a notification lacking sessionId, it gets `undefined`. The `listeners.get(undefined)` might return a random listener if someone subscribed with `undefined`? Unlikely. But `addToHistory` stores it. Then `getRecentNotifications` filters by sessionId. Broadcast notifications don't have sessionId, so they won't show up in any session's recent notifications. Is that intended? Maybe. But the `broadcast` method omits `sessionId` from the type. So broadcast notifications are in history but not retrievable by `getRecentNotifications`. This seems like a functional bug, but is it a performance issue? Not directly, but it means history contains items that are never retrievable via that method, wasting memory and scan time.

14. **Large payload handling**: The `data?: unknown` field can hold anything. No serialization limits, no depth checking. If large objects are passed, they are retained in history and copied by reference (shallow). But when notifications are broadcast, the same object reference is sent to all listeners. If a listener mutates it, others see it. Not a perf issue per se, but memory retention.

15. **Missing caching / N+1**: `getRecentNotifications` is O(N) per call. If called in a loop for many sessions (e.g., an API endpoint that polls for each session), it's N+1 relative to history size. But more importantly, it's a repeated scan.

Let's structure the table.

**Severity levels**: Critical, High, Medium, Low. Use appropriate ones.

**Issues to include:**

1. **Sync blocking I/O in hot loop**: `console.error` inside `broadcast` listener loop. Location: `broadcast` method, inside `for...of` loop. Issue: `console.error` is synchronous blocking I/O to stderr; under load with many listeners or frequent errors, it stalls the event loop. Fix: Replace with an async logger or remove; buffer errors; log asynchronously.

2. **Memory leak / unbounded growth of listeners**: `listeners` Map grows if `subscribe` is called with new sessionIds without unsubscribing. Location: `subscribe` / `listeners` Map. Issue: No eviction or cleanup of stale session listeners; unbounded memory growth if clients disconnect without calling unsubscribe. Fix: Use WeakRef or add TTL/cleanup; enforce max listeners; track active sessions.

3. **Unbounded allocation in history trimming**: `addToHistory` allocates a new array via `slice(-MAX_HISTORY)` on every insertion after cap. Location: `addToHistory`. Issue: Repeated O(N) array allocation and copy under sustained load causes GC pressure. Fix: Use a circular buffer or pre-allocated ring buffer; or use `shift()` if N is small (but shift is also O(N)). Actually, for N=1000, slice is fine, but it's still an allocation. Better fix: maintain a circular buffer. I'll list it as Medium.

4. **Inefficient history query (unbounded scan + redundant sort)**: `getRecentNotifications` filters entire history and sorts, even though history is roughly chronological. Location: `getRecentNotifications`. Issue: O(N log N) scan on every call; redundant sort; no indexing by sessionId. Fix: Search backwards from end and collect until limit reached; maintain per-session deques or indexes.

5. **Large payload retention in history**: `data?: unknown` can hold large objects; 1000 notifications retained with unbounded payload size. Location: `Notification.data` / `history`. Issue: No payload size limits causes unbounded memory retention (leak-like). Fix: Enforce max payload size; clone/serialize with limits; evict large data fields.

6. **Blocking listener callbacks stall broadcast**: `broadcast` loop invokes callbacks synchronously without yielding. Location: `broadcast` method. Issue: A slow/blocking listener stalls delivery to all other listeners and the event loop. Fix: Offload callbacks to `setImmediate` or a worker queue; make listeners async and await with timeout.

7. **Missing caching for recent notifications**: `getRecentNotifications` recomputes from scratch on every call. Location: `getRecentNotifications`. Issue: No per-session cache or materialized view; repeated identical queries cause redundant CPU work. Fix: Cache results per session with invalidation on new relevant notification.

8. **History stores undeliverable broadcast entries**: `broadcast` notifications lack `sessionId`, yet they occupy `history` and are scanned by `getRecentNotifications` filter but never match. Location: `broadcast` / `history`. Issue: Wasted memory and CPU scanning entries that are never retrievable by session queries. Fix: Store broadcast history separately or tag them to skip in session scans.

9. **No limit on listener count**: `broadcast` iterates all listeners. If many sessions, loop is large. Location: `broadcast`. Issue: Unbounded loop duration proportional to listener count; no max limit. Fix: Cap max listeners or shard broadcasts.

10. **Redundant non-null assertion**: `notification.sessionId!` in `notify`. Not really performance. Skip.

11. **Crypto.randomUUID() in hot path**: For every notification, sync crypto call. If thousands/sec, could be CPU intensive. But it's not blocking I/O. It's sync CPU. Could be listed as "sync CPU bottleneck". But the prompt asks for blocking sync I/O, unbounded loops/allocations, N+1, missing caching, redundant awaits, memory retention/leaks, large payload handling. So crypto is not in the requested categories unless considered blocking sync I/O (it's not I/O). I'll skip unless I frame it as sync blocking operation. But the prompt specifically says "blocking sync I/O". `console.error` qualifies as sync I/O. `crypto.randomUUID()` is sync but not I/O. I'll focus on `console.error`.

Let's refine the list to match the requested categories exactly.

Requested categories:
- blocking sync I/O
- unbounded loops/allocations
- N+1 calls
- missing caching
- redundant awaits
- memory retention/leaks
- large payload handling

I need to map my findings to these.

**Blocking sync I/O**: `console.error` in `broadcast` loop. That's sync I/O.

**Unbounded loops/allocations**:
- `broadcast` loop over all listeners: unbounded loop duration (scales with listener count).
- `addToHistory` `slice` allocation: unbounded allocation under sustained load (creates new array every time after cap).
- `getRecentNotifications` filter+sort: unbounded CPU per call relative to history size.

**N+1 calls**: Not exactly database N+1, but `getRecentNotifications` called for multiple sessions results in N+1 scans of history. Or more precisely, each call scans the entire history (N=history size) to get 1 session's results. If you call it for M sessions, it's M*N. This fits N+1 pattern (scanning entire collection per item). I'll frame it as "N+1 scan pattern in getRecentNotifications".

**Missing caching**: `getRecentNotifications` has no per-session cache. Also `history` is not indexed by sessionId.

**Redundant awaits**: None found. I should mention there are no async/awaits, so redundant awaits are absent, but maybe the code *should* use async for I/O? No, the prompt asks to find redundant awaits. If none, I can omit or state none. Better to omit if none.

**Memory retention/leaks**:
- `listeners` Map never evicts stale sessionIds (memory leak if unsubscribe not called).
- `history` retains up to 1000 notifications indefinitely; combined with large `data`, this is memory retention.

**Large payload handling**: `data?: unknown` has no size limits or cloning; large payloads retained in history and passed by reference to all listeners.

Let's draft the table rows.

Row 1:
- severity: High
- location: `broadcast` method, `for...of` loop body
- issue: Synchronous blocking I/O (`console.error`) inside hot broadcast loop stalls event loop when listeners throw.
- fix: Replace `console.error` with async logger or error aggregator; move logging outside the loop.

Row 2:
- severity: High
- location: `listeners` Map (`subscribe` / instance field)
- issue: Unbounded memory retention; stale session callbacks accumulate if unsubscribe is not called, leaking memory.
- fix: Enforce a max listener cap; add TTL-based eviction or use a WeakMap/WeakRef keyed by session object instead of string.

Row 3:
- severity: Medium
- location: `addToHistory` method
- issue: Unbounded allocation; creates a new array via `slice(-MAX_HISTORY)` on every insertion after the cap is reached, causing GC pressure under sustained load.
- fix: Use a circular buffer (ring buffer) or pre-allocated array with head/tail indices to avoid repeated O(N) copies.

Row 4:
- severity: Medium
- location: `getRecentNotifications` method
- issue: N+1 scan pattern; filters and sorts the entire global history O(N log N) for every session query instead of using an index.
- fix: Maintain a per-session `Notification[]` ring buffer or Map<sessionId, Notification[]> to serve queries in O(limit).

Row 5:
- severity: Medium
- location: `getRecentNotifications` method
- issue: Missing caching; repeated queries for the same session recompute filter+sort from scratch.
- fix: Cache the last result per sessionId with a monotonic version or timestamp; invalidate on new notification.

Row 6:
- severity: High
- location: `Notification.data` / `history` array
- issue: Large payload handling missing; `data: unknown` can reference massive objects, causing unbounded memory retention across 1000 history slots.
- fix: Enforce a max payload size (e.g., 100KB); deep-clone and strip large fields before storing; store references to external store instead.

Row 7:
- severity: Medium
- location: `broadcast` method
- issue: Unbounded loop; delivery time grows linearly with listener count and a single slow synchronous callback blocks all subsequent listeners.
- fix: Dispatch callbacks via `setImmediate` / microtask queue or use a concurrent queue with timeouts.

Row 8:
- severity: Low
- location: `broadcast` / `history`
- issue: Memory retention; broadcast notifications lack `sessionId` and are never retrievable by `getRecentNotifications`, yet consume history slots and scan CPU.
- fix: Store broadcast notifications in a separate history buffer or exclude them from the session-scanned array.

Row 9:
- severity: Medium
- location: `notify` / `broadcast` methods
- issue: No redundant awaits (code is fully synchronous), but async errors from listeners will be unhandled if callbacks return promises (fire-and-forget without await).
- fix: Make delivery async and `await` callbacks with `Promise.allSettled` or wrap in async queue. Wait, the prompt asks to *find* redundant awaits. If there are none, I don't need to report it. But if I want to be thorough, I can note that there are no redundant awaits. However, the instruction says "Output table | severity | location | issue | fix |". It doesn't say I must find every category. I'll skip redundant awaits if none exist, or mention that none were found. But the user might expect entries only for found issues. I'll stick to found issues.

Let's reconsider the "N+1 calls" phrasing. In backend performance, N+1 usually means making N database queries for 1 parent query. Here, `getRecentNotifications` scans the entire `history` array (N) to return results for 1 session. If you call it for many sessions, you get many scans. This is analogous. I'll label it as "N+1 history scan".

Let's reconsider `crypto.randomUUID()`. In Node.js, `crypto.randomUUID()` is synchronous and uses libuv's threadpool for randomness? Actually, `randomUUID` in Node.js is implemented in C++ and is generally fast, but it might involve some entropy gathering. For very high throughput, it could be a bottleneck. However, it's not I/O. I'll leave it out unless I can't find enough issues. I have plenty.

Let's reconsider `Date.now()`. Fine.

Let's reconsider `notify` and `broadcast` adding to history. `addToHistory` is called for every notification. If `history` is shared, it's a global lock (single thread in JS, so no lock, but still).

Let's think about `listeners` Map: only one callback per sessionId. If a session subscribes twice, the first callback is lost but remains referenced only if the unsubscribe function for the first one is still held. The Map entry is overwritten. So no leak there. But if many unique sessionIds subscribe and never unsubscribe, the Map grows. This is the main leak.

Let's think about `getRecentNotifications` sorting. Since `history` is append-only and timestamps are monotonic (mostly), the history is already sorted by timestamp ascending. `getRecentNotifications` wants descending. It could just iterate backwards. The `.sort()` is redundant and expensive. This is a good point: redundant sort. But the prompt asks for redundant *awaits*, not redundant sorts. I can mention the redundant sort under the unbounded allocations/CPU issue.

Let's refine the table to be concise and accurate.

| severity | location | issue | fix |
|---|---|---|---|
| High | `broadcast` loop (`console.error`) | Blocking sync I/O: `console.error` inside hot callback loop stalls event loop on every listener error. | Use an async logger or deferred error buffer; remove logging from the dispatch loop. |
| High | `listeners` Map (`subscribe`) | Memory leak: stale session callbacks accumulate indefinitely if unsubscribe is never called. | Add a max listener limit and TTL eviction; use WeakRef if session objects are available. |
| High | `Notification.data` / `history` | Memory retention / large payload handling: `data: unknown` retains unbounded-size objects in a 1000-slot history buffer. | Enforce payload size limits; store large payloads externally; deep-clone with size guards. |
| Medium | `addToHistory` | Unbounded allocation: `slice(-MAX_HISTORY)` allocates a new array copy on every insert once the cap is reached. | Replace with a circular buffer (ring buffer) to avoid repeated O(N) copies. |
| Medium | `getRecentNotifications` | N+1 scan: filters and sorts the entire global history O(N log N) per session query. | Maintain per-session ring buffers or a Map<sessionId, Notification[]> index. |
| Medium | `getRecentNotifications` | Missing caching: repeated queries for the same session recompute filter+sort from scratch. | Cache recent results per sessionId with a generation counter; invalidate on new notification. |
| Medium | `broadcast` dispatch loop | Unbounded loop: delivery latency grows linearly with listener count; slow callbacks block others. | Shard listeners or dispatch via `setImmediate`/async queue with per-c

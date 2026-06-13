<!-- cc-team deliverable
 group: G2 (concurrency division)
 member: CONC-028 role=concurrency model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":900,"completion_tokens":5000,"total_tokens":5900,"prompt_tokens_details":{"cached_tokens":67,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T12:15:21.270Z -->
The user wants a concurrency/async-safety audit of the provided TypeScript code (`notificationService.ts`). I need to analyze the code for specific issues:

1. Shared mutable state without locks
2. Check-then-act races
3. Unawaited promises
4. Promise.all error-swallowing
5. Event-listener leaks
6. Cache stampedes
7. Ordering assumptions

Then output a table with columns: severity | location | race/issue | fix

Let me analyze the code carefully.

**Code structure:**
- `NotificationService` class with:
  - `listeners`: Map<string, callback> - shared mutable state
  - `history`: Notification[] - shared mutable state
  - Methods: subscribe, notify, broadcast, getRecentNotifications, addToHistory
  - Exported singleton: `notificationService`

**Issues found:**

1. **Shared mutable state without locks / Concurrent modification**
   - `listeners` Map and `history` array are mutated and read from potentially concurrent async operations. Node.js is single-threaded, but callbacks can be reentrant and async boundaries exist. However, the main issue is that `subscribe` and `unsubscribe` (returned function) can race with `notify`/`broadcast`.
   - Specifically: `unsubscribe` does `if (this.listeners.get(sessionId) === callback) { this.listeners.delete(sessionId); }` - this is check-then-act.
   - Also `notify` does `const callback = this.listeners.get(notification.sessionId!); if (callback) { callback(fullNotification); }` - if callback throws synchronously, it affects broadcast loop (though broadcast has try-catch, notify does not).

2. **Check-then-act race**
   - In `subscribe` return value (unsubscribe): `if (this.listeners.get(sessionId) === callback) { this.listeners.delete(sessionId); }`. Between get and delete, another `subscribe` could have replaced the callback for same sessionId. So you might delete a newer callback incorrectly.
   - Actually, looking closer: `subscribe` uses `this.listeners.set(sessionId, callback)`. If called twice for same sessionId, it overwrites. The unsubscribe closure captures the original callback. If a second subscribe happens for same sessionId with a different callback, then the first unsubscribe checks `=== callback`, sees false, and doesn't delete. That's actually safe-ish, but if the first unsubscribe runs after a second subscribe with the SAME callback object (unlikely but possible), it deletes. More importantly, the check-then-act is between get and delete, but since it's a single-threaded event loop, the race is reentrancy-based. However, if `subscribe` is called and the returned unsubscribe is called asynchronously, and in between another `subscribe` for same sessionId happens... actually in Node.js event loop, unless the unsubscribe is called from within a callback that yields, it's atomic. But if the callback itself triggers an unsubscribe (e.g., notification handler calls unsubscribe), then during iteration in `broadcast`, the Map is modified. Wait, `broadcast` iterates with `for (const [, callback] of this.listeners)`. If during iteration a listener is removed (via the unsubscribe function), the Map iterator behavior in JS is defined (it's safe for insertion/deletion during iteration? Actually for Map, entries added after iterator starts may be visited, deleted entries that haven't been visited yet are skipped. But if currently iterating and delete happens, it's generally safe but can be tricky).

3. **Unawaited promises / Synchronous callback invocation**
   - The callbacks are invoked synchronously: `callback(fullNotification)`. If the callback is async (returns a Promise), the Promise is unhandled. No `await`, no `.catch()`. In `notify`, an async callback throwing would result in an unhandled promise rejection. In `broadcast`, there's try-catch but only for synchronous errors; async callbacks that reject are not caught because the try-catch won't catch a Promise rejection.
   - Actually, `broadcast` has `try { callback(fullNotification); } catch (err) { ... }`. If `callback` is async, it returns a Promise. The `try-catch` won't catch async rejections, and the Promise is unawaited, leading to unhandled promise rejection.

4. **Promise.all error-swallowing**
   - Not present in this code. No Promise.all used.

5. **Event-listener leaks**
   - `subscribe` allows only ONE callback per `sessionId` because it's a Map with string key. If you call subscribe twice for same sessionId, the first callback is overwritten and lost, but the first unsubscribe function still exists and might incorrectly delete the second callback if it uses identity check and the same callback reference was used. Wait, the first unsubscribe checks `this.listeners.get(sessionId) === callback`. If second subscribe used a different callback, the first unsubscribe won't delete it. But the first callback is lost (overwritten) and can never be unsubscribed. This is a leak if the caller expects to manage multiple subscriptions per sessionId. Actually, it's not a leak in the traditional sense, but it's a constraint: one listener per sessionId. If a session subscribes twice, the first is clobbered. However, the returned unsubscribe for the first callback is still held by the caller, but it won't do anything (or might do the wrong thing). This is a form of leak if the first callback closes over large memory.
   - More importantly: no cleanup of `history`. It grows unbounded up to MAX_HISTORY, then slices. That's bounded, so not a leak per se, but it's a global singleton so history lives forever.

6. **Cache stampedes**
   - `getRecentNotifications` does `filter().sort().slice()` on every call. If called rapidly, this is O(N log N) each time. Not exactly a cache stampede, but recomputation. However, `history` is unbounded up to 1000, so not huge. But if this were a larger cache, it would be a stampede. With 1000 items, it's minor. But the method is called `getRecentNotifications` and filters/sorts every time. If many concurrent calls happen, they all do the same work. This is more "thundering herd" on computation. But given the small size, severity might be low.
   - Actually, `history` is shared mutable state accessed by `addToHistory` (push) and `getRecentNotifications` (filter/sort). Since `addToHistory` mutates the array (push, then reassign slice), and `getRecentNotifications` reads it, there's a potential for inconsistent reads if an async interruption happens between push and slice? In Node.js single thread, not really a concurrency issue, but if `history` is reassigned (`this.history = this.history.slice(...)`), a concurrent call to `getRecentNotifications` might see the old or new array. But again, single-threaded event loop makes this atomic per tick.

7. **Ordering assumptions**
   - `getRecentNotifications` sorts by timestamp descending. But timestamps are `Date.now()`, which can have collisions. If two notifications have same timestamp, sort order is unstable (depends on original array order, but `Array.prototype.sort` is not guaranteed stable in all JS engines? Actually since ES2019 it's stable, but relying on timestamp for ordering when collisions possible is risky). Also, `Date.now()` can go backwards if system clock changes (though unlikely in containerized environments, but possible).
   - `addToHistory` pushes then slices. The slice keeps the last MAX_HISTORY. But `getRecentNotifications` filters then sorts descending. If history is full and new items push old ones out, the sort is done on the fly. The ordering assumption is that timestamp is unique and monotonic, which isn't guaranteed.

8. **Missing async handling in notify**
   - `notify` calls `callback(fullNotification)` without try-catch. If callback throws, it propagates to caller of `notify`. This breaks encapsulation.

9. **Broadcast iteration over mutable collection**
   - `broadcast` iterates `this.listeners`. If a callback triggers `subscribe` or `unsubscribe`, the Map is modified during iteration. As noted, Map iteration is resilient but can be confusing. If `subscribe` adds a new entry, it might or might not be visited depending on insertion order. If `unsubscribe` deletes an entry not yet visited, it won't be visited. If it deletes the current entry? Map iteration is based on a snapshot of keys? Actually, the spec says iteration is resilient to deletion of entries that haven't been visited yet, but behavior for entries added during iteration is engine-specific? No, Map iteration visits entries in insertion order. If you delete an entry ahead of the iterator, it's skipped. If you delete behind, no issue. If you add, it's added at the end and may be visited if iteration continues. This is generally okay but an ordering assumption.

10. **Singleton exported instance**
    - `notificationService` is a global singleton. All modules share it. This is shared mutable state by design, but the issue is that any module can call `subscribe` or `notify` without coordination.

11. **Type safety issue with `sessionId!`**
    - `notify` uses `notification.sessionId!` with non-null assertion. If `sessionId` is undefined, `listeners.get(undefined)` returns undefined, so no callback. But then `getRecentNotifications` filters by `sessionId`. Not a race, but unsafe.

12. **History truncation is not atomic / check-then-act on length**
    - `addToHistory`: `this.history.push(notification); if (this.history.length > MAX_HISTORY) { this.history = this.history.slice(-MAX_HISTORY); }`. Between push and slice, another call to `addToHistory` could run? No, single-threaded. But if `getRecentNotifications` runs between push and slice, it sees the oversized array. That's a transient state. Not a huge issue but technically observable.

13. **Memory leak in callbacks**
    - If a session subscribes but never unsubscribes, the listener stays forever. The service doesn't have a cleanup mechanism for stale sessions. This is an event-listener leak.

14. **No deduplication of broadcast vs notify**
    - `broadcast` sets `broadcast: true` but doesn't set `sessionId`. `getRecentNotifications` filters by `sessionId`. So broadcast notifications won't appear in session-specific history because they lack `sessionId`. Is this intentional? The interface says `broadcast` omits `sessionId`. Then `getRecentNotifications` filters `n.sessionId === sessionId`, so broadcasts are excluded from per-session history. But `addToHistory` adds them. This seems like a design issue, not necessarily concurrency.

Let me structure the table. I need to be careful to only report actual concurrency/async-safety issues as requested.

**Key issues to report:**

| severity | location | race/issue | fix |

1. **High**: `notify` line `callback(fullNotification)` - Unhandled async callback rejections. If callback is async, returned Promise is unawaited and unhandled rejections may crash the process. Also sync throws propagate to caller.
   - Fix: Wrap in try-catch for sync errors, and if async, track promises or use `Promise.resolve(callback(...)).catch(...)`.

2. **High**: `broadcast` line `callback(fullNotification)` inside try-catch - Async callbacks that reject are not caught by try-catch, causing unhandled promise rejections.
   - Fix: Use `Promise.resolve(callback(n)).catch(err => console.error(...))` or await them properly.

3. **Medium**: Unsubscribe closure in `subscribe` - Check-then-act race. `if (this.listeners.get(sessionId) === callback) { this.listeners.delete(sessionId); }` can race if another `subscribe` for same sessionId interleaves (e.g., during await in an async context). The first unsubscribe might delete a newer listener if callbacks happen to be identical references, or fail to delete when it should. More importantly, `subscribe` overwrites existing listener without cleanup, leaking the old callback if it held references.
   - Fix: Use a Set of callbacks per sessionId, or use an AbortController/Disposable pattern. Or at least make unsubscribe unconditional: `this.listeners.delete(sessionId)` if you only want one listener per session. But if you want multiple, use `Set`.

4. **Medium**: `broadcast` iteration over `this.listeners` while callbacks may mutate the Map (reentrancy). If a listener calls `subscribe` or `unsubscribe`, the Map is modified during iteration. While Map iteration is defined in spec, it's risky and can cause skipped/double-called listeners depending on engine.
   - Fix: Snapshot listeners before iterating: `const snapshot = [...this.listeners.values()];` then iterate snapshot.

5. **Medium**: `addToHistory` transient oversized array. Between `push` and reassignment `slice`, concurrent readers (though single-threaded, reentrant calls) see `length > MAX_HISTORY`. If `getRecentNotifications` is called reentrantly from within a notification callback, it sees the un-truncated array.
   - Fix: Use a circular buffer or immutable update: `this.history = [...this.history.slice(1), notification]` or ensure truncation happens before any callback invocation.

6. **Low/Medium**: `getRecentNotifications` sorts on every call. If called concurrently/rapidly (thundering herd), repeated O(N log N) work. With 1000 items it's minor but still unnecessary.
   - Fix: Maintain a sorted index or cache per-session recent views, or use a more efficient data structure.

7. **Low**: `history` ordering relies on `Date.now()` which can collide or go backwards. If two notifications sent in same tick have same timestamp, sort is unstable (though ES2019 sort is stable, the order might not reflect causality). Also system clock changes can break ordering.
   - Fix: Use a monotonic counter (e.g., `++this.sequence`) alongside timestamp, or use insertion order (keep history sorted by insertion).

8. **Medium**: Event listener leak - no automatic cleanup for stale sessions. If clients disconnect without calling unsubscribe, the Map entry persists forever.
   - Fix: Add TTL/weak references, or expose a cleanup method, or use WeakMap keyed by external object (but sessionId is string, so can't use WeakMap). Use a heartbeat or explicit session management.

9. **Low**: `Promise.all` error swallowing - Not applicable, but I should mention if there were any. There isn't. So skip.

10. **Medium**: `subscribe` overwrites previous callback for same `sessionId` without warning. This is a form of leak because the previous callback is dropped but if it was a closure holding memory, and the returned unsubscribe function is retained, it could prevent GC? Actually the callback is dropped from the Map, so it can be GC'd unless the returned unsubscribe closure holds a reference to it (which it does: `=== callback`). So the unsubscribe closure holds the callback, preventing GC until the unsubscribe function itself is GC'd. This is a leak path.
    - Fix: Allow multiple listeners per session via Set, or don't capture callback in closure for identity check (use a token/id instead).

Let me refine these into a clean table. The user asked specifically for: shared mutable state without locks, check-then-act races, unawaited promises, Promise.all error-swallowing, event-listener leaks, cache stampedes, ordering assumptions.

I should map my findings to these categories.

- **Shared mutable state without locks**: `listeners` and `history` are mutated and read across all methods without any synchronization mechanism. While JS is single-threaded, reentrancy during broadcast can cause issues. I'll report this as a general issue.
- **Check-then-act races**: The unsubscribe closure. Also `notify` getting callback then invoking it (though less severe). Also `addToHistory` push then slice.
- **Unawaited promises**: `notify` and `broadcast` invoking callbacks that may be async. The returned promises are ignored.
- **Promise.all error-swallowing**: None found. I can state "None" or omit, but the prompt asks to check for it. I can include a row saying "N/A" or just not include it. Better to include a note that no Promise.all was found, but the table format might not suit it. I'll omit if none, or add a row with severity "Info" saying no Promise.all usage found. Actually, the user wants an audit, so if it's not present, I don't need to report it as an issue. I'll focus on what's there.
- **Event-listener leaks**: Stale session listeners persist forever if unsubscribe not called. Also overwriting listener per sessionId leaks the old callback via closure in the returned unsubscribe function.
- **Cache stampedes**: `getRecentNotifications` recomputes filter+sort on every call. If many concurrent requests hit it, they all do the work. This is a thundering herd on computation.
- **Ordering assumptions**: `Date.now()` for ordering; unstable sort if timestamps collide; broadcasts lack sessionId so missing from per-session history (maybe not ordering).

Let me draft the table rows:

| severity | location | race/issue | fix |
|---|---|---|---|
| Critical | `notify` / `broadcast` callback invocation | Unawaited async callbacks: if subscriber passes an async function, the returned Promise is dropped; rejections become unhandled and `broadcast`'s `try-catch` only catches sync throws. | Always wrap invocation: `Promise.resolve(callback(n)).catch(...)` or await all callbacks in `broadcast` via `Promise.allSettled`. |
| High | `subscribe` unsubscribe closure | Check-then-act race: `get(sessionId)` then `delete(sessionId)` assumes the map hasn't changed; if another `subscribe` interleaves, the wrong listener may be removed or a stale closure retained. | Use a subscription ID/token (e.g., `Symbol`) or store listeners in a `Set` per session; unsubscribe by ID. |
| High | `broadcast` `for...of this.listeners` | Concurrent mutation during iteration: if a listener unsubscribes or subscribes synchronously from within the loop, the Map iterator may skip or re-visit entries (reentrancy). | Snapshot before iterating: `const targets = [...this.listeners.values()];` then loop over `targets`. |
| Medium | `addToHistory` | Shared mutable `history` array mutated (push + conditional reassign) without isolation; reentrant readers (e.g., `getRecentNotifications` called from within a listener) can observe transient state where `length > MAX_HISTORY`. | Truncate atomically before exposing notification to listeners: `this.history.push(n); if (tooBig) this.history.shift();` or use an immutable ring buffer. |
| Medium | `getRecentNotifications` | Cache stampede / thundering herd: every call filters and sorts the full history O(N log N); concurrent callers duplicate work. | Maintain a pre-sorted index or memoize per-session results with a short TTL / dirty flag. |
| Medium | `subscribe` Map overwrite | Event-listener leak: only one callback per `sessionId` is kept; subsequent `subscribe` overwrites the previous callback without cleanup. The old unsubscribe closure still references the old callback, preventing GC. | Store callbacks in a `Set` per sessionId to allow multiple subscriptions and clean individual unsubs. |
| Medium | `notificationService` singleton | Event-listener leak: stale session listeners accumulate forever if clients disconnect without calling unsubscribe (no TTL/weak refs). | Add session heartbeat / TTL sweep, or require explicit session teardown. |
| Low | `getRecentNotifications` sort | Ordering assumption: relies on `Date.now()` which can produce identical timestamps (unstable ordering) or shift backwards with system clock changes. | Append a monotonic sequence number to each notification and sort by `(seq, timestamp)`. |

Wait, is the `addToHistory` issue really about shared mutable state without locks? It's more about reentrancy. In Node.js, since it's single-threaded, the push and slice happen in the same tick unless a callback yields. But if a callback is synchronous and calls `getRecentNotifications`, it sees the oversized array. That's a real issue.

Also, the `notify` method: `const callback = this.listeners.get(...); if (callback) callback(...);` - if callback throws, it propagates up to the caller of `notify`. That's a sync throw issue. I should mention that.

Let me add:
| High | `notify` callback call | Missing error isolation: synchronous throw in a session listener bubbles up to the caller of `notify`, breaking encapsulation and risking crash. | Wrap in `try-catch` (or Promise.catch for async) to isolate listener errors.

Actually, `broadcast` already has try-catch. `notify` does not. So that's a valid point.

Also, regarding "shared mutable state without locks": The `listeners` Map is accessed by all methods. Since it's a singleton, multiple modules can race. In Node.js event loop, true thread races don't happen, but async interleaving does. The user asked for "shared mutable state without locks". I should frame it as: the service is a singleton with mutable Maps/Arrays accessed from any async context without concurrency control (e.g., no queue, no mutex, no atomic ops). While JS is single-threaded, the lack of isolation means reentrant mutations during broadcast are possible.

Let me reconsider the "locks" aspect. In async JS, a "lock" could be a mutex/semaphore to prevent overlapping operations if methods were async. But these methods are sync. So locks aren't typically needed for simple data structures. However, the reentrancy issue is real. I'll phrase it as "Reentrant mutation of shared Map/Array without isolation during broadcast".

Let me check if there are any other issues.

- `crypto.randomUUID()` is available in Node.js 14.17+ / 19+? It's fine.
- `Omit<Notification, 'id' | 'timestamp'>` in `notify` means `sessionId` is optional in the type, but then `notification.sessionId!` is used. If undefined, `listeners.get(undefined)` returns undefined. No crash, but type safety issue. Not concurrency.

I think I have enough for a solid table. I need to make sure the "fix" column is actionable and concise.

Let me refine the rows for clarity and accuracy.

Row 1: Unawaited promises / error isolation.
- Severity: Critical (because unhandled promise rejections can crash Node.js in newer versions or at least be fatal).
- Location: `notify` and `broadcast` callback invocations.
- Issue: Unawaited promises / missing async error handling. Subscribers may pass async callbacks. `notify` doesn't catch sync or async errors. `broadcast` catches sync but not async rejections from returned Promises.
- Fix: Wrap each invocation in `Promise.resolve(callback(n)).catch(err => logError)` or collect promises in broadcast and use `Promise.allSettled`.

Row 2: Check-then-act race in unsubscribe.
- Severity: High.
- Location: `subscribe` returned closure.
- Issue: Check-then-act race: reads `this.listeners.get(sessionId)` and compares identity before `delete`. If another concurrent subscribe/unsubscribe mutates the map, the wrong listener may be deleted or the stale one retained.
- Fix: Replace identity check with a subscription token/ID, or use a `Set` of listeners per session and delete by token.

Row 3: Concurrent mutation during broadcast iteration.
- Severity: High.
- Location: `broadcast` loop.
- Issue: Reentrant mutation of shared Map: listeners may call `subscribe`/`unsubscribe` synchronously, mutating `this.listeners` while it is being iterated.
- Fix: Snapshot

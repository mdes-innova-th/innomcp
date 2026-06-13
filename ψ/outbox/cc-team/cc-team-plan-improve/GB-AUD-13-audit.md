<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-13 role=audit model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1831,"completion_tokens":5000,"total_tokens":6831,"prompt_tokens_details":{"cached_tokens":6,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T11:14:06.634Z -->
The user wants me to audit a TypeScript module for real defects. I need to be meticulous and report only concrete issues. The output format should be a markdown table with columns: severity, location, issue, proposed fix. Then a 1-line overall risk verdict. No praise, no restating what the code does, no filler.

Let me analyze the code carefully.

1. **Race condition in `register`**: The `register` method is async but doesn't do any async work. However, more importantly, it reads and writes to `this.providers` without any locking. If multiple concurrent registrations happen, or if `checkHealth` is running concurrently with `register`, there could be race conditions. But since it's single-threaded JavaScript, the actual Map operations are atomic. However, the `checkHealth` method mutates the provider object directly (`provider.healthStatus = ...`), and if `register` is called concurrently (or rather, interleaved due to async), it could replace the provider object in the map while `checkHealth` is mutating the old object. Wait, `register` is async but has no await, so it runs synchronously. But `checkHealth` is async and mutates the provider object. If `register` replaces the provider object while `checkHealth` is running, `checkHealth` will continue mutating the old object, and the new one won't get the health update. Also, `getBest` returns a shallow copy, but `checkHealth` gets the reference from the map and mutates it.

Actually, looking at `register`: it's declared `async` but has no `await`. It will still return a Promise. Since it's synchronous in execution, it won't yield. But `checkHealth` yields at `fetch`. If `register` is called during that yield, it could replace the provider. Then when `checkHealth` resumes, it mutates the old provider object which is no longer in the map (or rather, the map has a new object). This is a real issue.

2. **`checkHealth` timeout leak on success**: In `checkHealth`, `clearTimeout(timeout)` is called after `await fetch(...)` resolves, but if `fetch` throws (e.g., network error), the catch block also calls `clearTimeout(timeout)`. However, if the fetch succeeds but the response is not ok and status >= 500, it throws `new Error(...)`. The catch block clears the timeout. That seems fine. But wait: what if `fetch` resolves after the timeout? The AbortController aborts the fetch, which causes `fetch` to throw an `AbortError`. The catch block handles it. But there's a subtle issue: `clearTimeout(timeout)` is called in both try and catch. However, if the function returns early or throws an uncaught exception before clearing? No, the only throw is in the try block for non-OK status, which is caught by the catch. But what about the case where `provider` is not found? That throws before the timeout is set, so no leak.

Wait, actually there's a potential issue: if `fetch` succeeds (response.ok or status < 500), `clearTimeout(timeout)` is called. But what if the code throws after `clearTimeout`? No, it returns. So the timeout is cleared.

But there's another issue: `response.ok || response.status < 500`. This means any status < 500 is considered healthy, including 404, 401, 403, etc. That seems wrong for a health check. A 404 might mean the health endpoint doesn't exist, but the code treats it as healthy. This is a logic bug. `response.ok` is status 200-299. `response.status < 500` includes 400-499. So 404 Not Found is treated as healthy. That's definitely a bug.

3. **`checkHealth` mutates provider object directly**: The provider object is stored in the Map. `getAll()` returns shallow copies, but `checkHealth` gets the reference and mutates it. If `register` is called with a new config for the same id while `checkHealth` is in flight, the old object is replaced. The health update goes to the old object. This is related to the race condition above.

4. **`checkAllHealth` uses `Promise.allSettled` but doesn't check results**: It just calls `getAll()` afterwards. But more importantly, `checkHealth` mutates the provider objects. If multiple health checks run concurrently on the same provider? No, `checkAllHealth` maps over ids, so each id is checked once. But if called concurrently with another `checkAllHealth` or `checkHealth`, there could be overlapping fetches for the same provider. The `AbortController` is local to each call, so that's fine, but the mutation of `latencyMs` and `lastChecked` could be overwritten by whichever finishes last. That's acceptable perhaps, but the overlapping fetches themselves might be an issue. Not necessarily a defect.

5. **`getBest` sort mutates the array**: `candidates.sort(...)` sorts the array in place. The `candidates` array is derived from `Array.from(this.providers.values())`, so it's a new array. Sorting it in place is fine, but it's worth noting that if `enabled` was a reference to the original array, it would be bad. But it's a new array. However, `getBest` is async but doesn't do any async work. Not a bug per se, but unnecessary async.

6. **`selectForTask` capabilityMap type**: `const capabilityMap: Record<typeof task, string>` - wait, `typeof task` is `'thai' | 'code' | 'reasoning' | 'fast' | 'general'`. So the Record type is correct. But `task` is a parameter, so `typeof task` evaluates to the union type. That's fine.

7. **`register` default values**: In the `else` branch: `capabilities: config.capabilities ?? []`. But `ProviderConfig` type requires `capabilities: string[]`. If `config.capabilities` is undefined, it defaults to `[]`. But the type says it's required. However, at runtime, it could be missing. The code handles it. Not a defect.

8. **`register` merge logic**: In the merge branch (existing provider), it does `...existing, ...config`. Then overrides `healthStatus`, `latencyMs`, `lastChecked`. But if `config` has `capabilities: undefined` (though type says required), the spread `...config` would overwrite `existing.capabilities` with undefined. Then the code doesn't default it. But the type requires it. However, the else branch defaults `capabilities`. The merge branch doesn't. If someone passes a partial config (which the type doesn't allow, but could happen via cast or JS call), capabilities could be lost. But since TypeScript would enforce the type, this is a minor edge case. Not a concrete bug.

9. **`unregister` is async**: No await, synchronous. Not a bug.

10. **`getAll` is async**: No await, synchronous. Not a bug.

11. **`getBest` is async**: No await, synchronous. Not a bug.

12. **`checkHealth` URL construction**: `new URL('/health', provider.baseUrl)`. If `provider.baseUrl` doesn't have a trailing slash, e.g., `http://localhost:11434`, then `new URL('/health', 'http://localhost:11434')` becomes `http://localhost:11434/health`. That's correct. If it has a path, e.g., `http://localhost:11434/api`, then `new URL('/health', ...)` replaces the path, giving `http://localhost:11434/health`. Is that intended? The baseUrl might include a path prefix for some providers. Using `/health` as the first argument to URL constructor with a base will resolve against the base, but since it starts with `/`, it replaces the pathname of the base. If the provider requires a path prefix (e.g., `http://localhost:11434/v1`), the health endpoint might be `http://localhost:11434/v1/health`, but this code produces `http://localhost:11434/health`. This is a potential bug if baseUrl includes a path. However, the code comment says "Generic health endpoint (commonly /health or /v1/models)", suggesting it assumes baseUrl is just the origin. But it's not robust. I'll note this as a potential edge case.

13. **`checkHealth` error handling**: The catch block catches everything and marks the provider as degraded. But it catches the abort error from the timeout too. That's fine, it should be marked degraded. However, it also catches errors from `new URL(...)`. If `provider.baseUrl` is malformed, `new URL('/health', provider.baseUrl)` throws. Then the catch block marks it as degraded. That's acceptable behavior, though the latency might be meaningless (Date.now() - start). But the real issue is that `clearTimeout(timeout)` is called in the catch block even though the timeout was never set? No, the timeout is set before the try block. Wait, looking at the code:

```typescript
    const timeoutMs = 10_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const start = Date.now();
    try {
      const url = new URL('/health', provider.baseUrl).toString();
      // ...
      clearTimeout(timeout);
      // ...
    } catch (err: any) {
      clearTimeout(timeout);
      // ...
    }
```

If `new URL(...)` throws, the timeout is still cleared in catch. That's fine. But if `provider.baseUrl` is malformed, the fetch is never attempted. The provider is marked degraded. That's okay.

14. **`providerManager` singleton**: Exported singleton. If imported in multiple places, it's the same instance. Not a bug.

15. **`getBest` returns shallow copy**: `return { ...candidates[0] }`. That's good.

16. **`getMDESPrimary` returns shallow copy**: `return { ...primary }`. Good.

17. **`checkHealth` updates provider directly**: The provider object is mutated. Since `getAll` returns shallow copies, the mutation is visible only through the map. But if someone holds a reference from a previous `getAll`, they won't see updates. That's by design.

18. **Missing `await` in `registerDefaultMDESPrimary`**: The constructor calls `registerDefaultMDESPrimary` which is synchronous. Fine.

19. **`checkAllHealth` doesn't propagate errors**: It uses `Promise.allSettled`, so individual check failures are swallowed. But it returns `getAll()` which includes the updated health statuses. That's the intended behavior. Not a bug.

20. **`checkHealth` latency calculation**: `const latency = Date.now() - start;` in both success and error cases. In error case, if the error is immediate (e.g., URL malformed), latency is small. If it's a timeout, latency is ~10s. That's fine.

21. **`checkHealth` response.ok || response.status < 500**: This is the biggest logic bug. It treats 4xx as healthy. A 404 means the endpoint doesn't exist, but it's considered healthy. A 401/403 means auth failed, but considered healthy. This is clearly wrong.

22. **Race condition between `checkHealth` and `register`**: Since `checkHealth` mutates the provider object by reference, and `register` can replace the object in the map, concurrent calls (interleaved async) can cause the health check result to be written to a stale object. For example:
    - Call `checkHealth(id)` -> gets provider ref A
    - `await fetch(...)` yields
    - Call `register({id, ...newConfig})` -> replaces map entry with provider ref B
    - `checkHealth` resumes -> writes health to ref A (stale, not in map)
    - Now the map has ref B with old health data.
    This is a concrete race condition.

23. **`checkHealth` does not handle fetch network errors distinctly**: It catches all errors and marks degraded. That's fine.

24. **`getBest` sort stability**: Not relevant.

25. **`selectForTask` fallback**: If no provider has the capability, it falls back to `getBest()` without capability. That's fine.

26. **`register` async without await**: Not a bug, but unnecessary. Not worth reporting unless it's a pattern that causes issues.

27. **`unregister` async without await**: Same.

28. **`getAll` async without await**: Same.

29. **`getBest` async without await**: Same.

30. **`checkAllHealth` missing error details**: Not a bug, by design.

Let me think about other edge cases.

31. **`provider.baseUrl` with trailing slash**: `new URL('/health', 'http://localhost:11434/')` -> `http://localhost:11434/health`. Fine.

32. **`provider.baseUrl` with path**: As mentioned, `new URL('/health', 'http://localhost:11434/v1/')` -> `http://localhost:11434/health`. The path is lost. This is a bug if baseUrl includes a subpath. The fix would be to use `new URL('health', provider.baseUrl)` (without leading slash) or ensure baseUrl has no path. But the code explicitly uses `/health`. Given the context of provider base URLs, many APIs use `http://host:port/v1` as base. The health endpoint might be at `/v1/health` or `/health`. The code assumes `/health` at root. This is a concrete edge case / bug.

33. **`checkHealth` AbortController timeout**: If fetch throws for some reason before the timeout, the timeout is cleared. Good. But if the fetch hangs, the abort controller triggers after 10s. The fetch throws AbortError, caught, timeout cleared. Good.

34. **`checkHealth` headers undefined vs empty object**: `headers: provider.apiKey ? { Authorization: ... } : undefined`. Fetch accepts undefined. Fine.

35. **`getBest` capability filter**: `candidates.filter(p => p.capabilities.includes(capability))`. If `capability` is empty string, it filters for providers with empty string in capabilities. Probably not a bug.

36. **`register` does not validate URL**: `baseUrl` could be any string. Not necessarily a bug.

37. **`register` allows duplicate IDs**: It merges. That's intended.

38. **`registerDefaultMDESPrimary` uses process.env directly**: Fine.

39. **`checkHealth` updates `lastChecked` even on error**: Yes, that's intended.

40. **`checkHealth` catch block marks degraded for abort**: Yes, timeout means degraded. Fine.

41. **`getBest` healthOrder object**: Defined inside sort comparator. This is recreated on every sort comparison. Inefficient but not a bug. However, if `healthStatus` is somehow not one of the keys, it returns `undefined - number` which is `NaN`, causing sort to be unstable. The type restricts it to the three values, but at runtime a malformed object could have a different string. This would cause `getBest` to return unpredictable results. This is an edge case. The type is `healthStatus: 'healthy' | 'degraded' | 'unknown'`, but if someone bypasses TS or the object is mutated externally, it could happen. Not a high priority.

42. **`checkHealth` non-OK status**: `if (response.ok || response.status < 500)`. This is definitely a bug. It should probably be just `response.ok`, or at least not include 4xx.

43. **`checkHealth` does not close response body**: The fetch response body is not consumed. In Node.js 18+, this might leave the connection in a hanging state or cause memory leaks? Actually, undici (which Node 18 fetch is based on) will consume the body or cancel it when the response goes out of scope? No, undici has a known issue where not consuming the body can leave connections busy. However, for a simple GET to /health, if the body is small, it might be okay, but it's better to cancel or consume it. But is this a concrete bug? In Node.js, if you don't consume the body, the connection might not be released back to the pool, causing a resource leak under high load. This is a known issue with fetch/undici. So `await response.body?.cancel()` or `await response.text()` should be called. This is a resource leak.

44. **`checkAllHealth` concurrent health checks**: If there are many providers, `Promise.allSettled` launches all at once. Could cause connection pool exhaustion. But not necessarily a bug.

45. **`providerManager` singleton export**: The module exports a singleton instance. If this is used in tests, state leaks between tests. But that's a test design issue, not a code bug.

46. **`register` merge logic overwrites nested properties**: Since it spreads, nested objects are shallow merged. But ProviderConfig has no nested objects except `capabilities` which is replaced. The merge logic explicitly preserves health data. But it doesn't preserve `capabilities` from existing if not provided in new config. Actually, `...existing, ...config` means config overwrites everything. Then healthStatus, latencyMs, lastChecked are restored. But `capabilities` is not restored. So if you call `register({id: 'x', capabilities: undefined})` (if TS allowed), you'd lose capabilities. But TS doesn't allow it. However, if you call with a partial object cast as ProviderConfig, you could lose capabilities. Not a concrete runtime bug given TS.

47. **`getBest` sort comparator inconsistency**: The comparator returns `healthOrder[a.healthStatus] - healthOrder[b.healthStatus]`. If both are undefined or unknown, it's 0. Then latency. Fine.

48. **`checkHealth` `err` type**: `catch (err: any)` - in TS, this is fine.

49. **`selectForTask` task parameter**: The capabilityMap uses `typeof task` which is the literal union. Fine.

50. **`register` missing validation for `type`**: Not required.

Let me prioritize the concrete issues:

1. **HIGH**: `checkHealth` treats 4xx HTTP status codes as healthy (`response.ok || response.status < 500`). This is a logic bug. A 404/401 should not be healthy.
   - Location: `checkHealth`, inside try block after fetch.
   - Fix: Use only `response.ok` or explicitly handle 4xx as unhealthy.

2. **HIGH**: Race condition between `checkHealth` and `register`. `checkHealth` holds a reference to the provider object and mutates it after an await. If `register` replaces the object in the Map during the await, the mutation is lost (writes to stale object).
   - Location: `checkHealth` and `register`.
   - Fix: Re-fetch the provider from the Map before mutating, or use immutable updates in `register` and apply health updates atomically.

3. **MED**: Resource leak in `checkHealth`. Fetch response body is never consumed or cancelled, which can leave underlying connections busy in Node.js/undici.
   - Location: `checkHealth` after fetch.
   - Fix: Add `await response.body?.cancel()` or `await response.text()` before returning.

4. **MED**: `checkHealth` constructs health URL with absolute path `/health`, ignoring any path component in `provider.baseUrl`. If baseUrl is `http://host/api`, the health endpoint becomes `http://host/health` instead of `http://host/api/health`.
   - Location: `checkHealth`, URL construction.
   - Fix: Use `new URL('health', provider.baseUrl)` (relative path) or properly join the base URL path.

5. **MED**: `getBest` sort comparator can produce `NaN` if `healthStatus` is an unexpected value at runtime, causing unstable/indeterminate sort order.
   - Location: `getBest`, sort comparator.
   - Fix: Add fallback values for unknown health statuses in the comparator.

6. **LOW**: `checkHealth` clears timeout in both try and catch, but if an exception is thrown after `clearTimeout` in the try block (none currently), it wouldn't be caught. Not an issue now.

7. **LOW**: Several methods (`register`, `unregister`, `getAll`, `getBest`) are declared `async` but contain no `await`, making them unnecessarily return Promises and potentially confusing the caller about asynchronicity. This isn't a bug per se, but it can mask the fact that they are synchronous and don't yield. However, the prompt asks for concrete issues like bugs, race conditions, etc. Unnecessary async is not a concrete defect, but it can lead to subtle issues if callers assume they are truly async. I'll skip this unless it's a real problem.

8. **LOW**: `checkAllHealth` uses `Promise.allSettled` but doesn't return the results, only the current state via `getAll()`. If a health check is in flight and modifies the provider, `getAll()` captures the state at the end. Since `checkHealth` mutations are synchronous after the await, and `getAll` is called after all settled, it should be fine.

9. **LOW**: `register` merge branch does not default `capabilities` if missing from `config`, unlike the new registration branch. But TypeScript prevents missing capabilities. Not a runtime bug.

10. **LOW**: `getBest` returns `undefined` when no candidates. That's handled.

Let me reconsider the race condition. Is it really a race condition? In JavaScript, there's no preemption. The `await fetch(...)` yields the microtask/event loop. If `register` is called from another event during that yield, it will run to completion (since `register` has no await and is synchronous). So when `checkHealth` resumes, the provider in the map might be a different object. `checkHealth` then mutates the old object. So yes, this is a real stale-reference bug.

Actually, `register` is async. Even though it has no await, calling `await providerManager.register(...)` from elsewhere will schedule it. But if called without await, it runs synchronously until the first await. Since `register` has no await, the entire function body executes synchronously in the current tick. So if another event calls `register` during the `fetch` await, it will run and replace the map entry. Then `checkHealth` resumes and mutates the old object. This is a concrete bug.

How to fix? In `checkHealth`, after the fetch, instead of mutating the captured `provider` reference, do:
```typescript
const current = this.providers.get(id);
if (current) {
  current.healthStatus = ...;
  // etc
}
```
But wait, if `register` replaced the provider, should we update the new one or the old one? The health check was for the config at that id. It makes sense to update whichever is currently in the map. So re-fetching from the map before mutating is the fix. Or, in `register`, instead of replacing the object, mutate the existing object in place. But `register` spreads `...config`, which replaces properties. It could mutate the existing object instead: `Object.assign(existing, config, { healthStatus: ... })`. That would solve the stale reference issue because `checkHealth` holds the same reference. But `register` currently creates a new object for the new config case. For the existing case, it also creates a new object. If we change it to mutate in

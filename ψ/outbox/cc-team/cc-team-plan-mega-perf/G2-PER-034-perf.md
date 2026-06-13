<!-- cc-team deliverable
 group: G2 (perf division)
 member: PER-034 role=perf model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1715,"completion_tokens":2487,"total_tokens":4202,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2210,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T12:05:33.222Z -->
| severity | location | issue | fix |
|---|---|---|---|
| High | `checkHealth` | Memory leak / socket retention: `fetch` Response body stream is never consumed or destroyed. In Node, unconsumed streams prevent socket reuse and leak memory. | Drain the body unconditionally via `await response.text()` or call `response.body?.cancel()` after checking `response.ok`. |
| Medium | `checkAllHealth` | Unbounded concurrency: `Promise.allSettled` fires network requests for all providers simultaneously. Large provider counts will cause event loop starvation and memory spikes. | Implement concurrency limits (e.g., process in chunks or use `p-limit`) to bound simultaneous network requests. |
| Low | `register`, `unregister`, `getAll`, `getBest` | Redundant async: Methods perform only synchronous Map/Array operations but return Promises, adding microtask overhead and forcing unnecessary `await`s at call sites. | Remove `async` keywords and return values synchronously. |
| Low | `getBest` | Missing caching: Filters and sorts the entire provider array on every invocation, causing redundant CPU work if called frequently (e.g., per incoming request). | Cache the sorted/filtered result and invalidate the cache only when providers mutate (register, unregister, or health update). |
| Low | `checkHealth` | Unnecessary timer allocation: Manual `setTimeout` + `clearTimeout` allocates resources and risks leaks if `clearTimeout` is missed. Node 18+ supports native fetch timeouts. | Replace `AbortController` + `setTimeout` with `AbortSignal.timeout(timeoutMs)` to eliminate manual timer management. |
| Low | `getAll`, `getBest`, `getMDESPrimary` | Unbounded allocation: Spreads `{ ...p }` to create shallow copies on every call. Frequent invocations create excessive garbage collection pressure. | Return read-only references or freeze objects instead of spreading on every access, or cache the array copies until state changes. |

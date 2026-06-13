<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-012 role=perf model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2340,"completion_tokens":2940,"total_tokens":5280,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2494,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T12:01:18.005Z -->
| severity | location | issue | fix |
|---|---|---|---|
| High | `tryReadExtraFromFile` | Blocking sync I/O: `fs.existsSync` and `fs.readFileSync` block the Node.js event loop, destroying low-latency guarantees. | Use `fs.promises.readFile` and catch `ENOENT` errors instead of checking existence synchronously. |
| High | `tryReadExtraFromUrl` | Timer leak: `clearTimeout(t)` is bypassed if `fetch` or `resp.json()` throws, leaking the timer and retaining closures in memory. | Move `clearTimeout(t)` into a `finally` block to ensure it always executes. |
| Medium | `getExtraPhrases` | Sequential I/O: File and URL reads are awaited sequentially, unnecessarily increasing cache refresh latency. | Execute both promises concurrently using `Promise.allSettled`. |
| Medium | `getExtraPhrases` | Thundering herd (Missing request coalescing): Concurrent requests during cache expiration trigger duplicate I/O operations. | Implement a singleflight pattern by caching the in-flight `Promise` itself until it resolves. |
| Medium | `handleFastPathMessage` | Unused latency guard: `opts.maxWorkMs` is defined but never enforced; slow operations (like `checkRateLimit`) can block the pipeline indefinitely. | Wrap blocking calls in `Promise.race` with a timeout based on `maxWorkMs`, or use `AbortSignal.timeout()`. |
| Medium | `tryReadExtraFromUrl`, `tryReadExtraFromFile` | Unbounded payload parsing: `resp.json()` and `JSON.parse()` process arbitrarily large payloads, risking CPU and memory spikes. | Check `Content-Length` header or `fs.stat` size before reading, and abort/reject if it exceeds a safe limit (e.g., 1MB). |
| Low | `mergeExtra` | Excessive allocations: Spreads arrays and creates `Set` objects for every key during cache merges. | Use a plain object or `Map` for deduplication and convert to arrays once, avoiding intermediate spread operations. |

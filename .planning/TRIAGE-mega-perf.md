_35 findings consolidated, 0 missing._

# TRIAGE — mega-perf

> perf lens (provider=0): Performance audit: find blocking sync I/O, unbounded loops/allocations, N+1 call

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## PER-001 — perf — `innomcp-node/src/services/agentLoop.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| **High** | `for (const toolCall of assistantMessage.tool_calls)` loop (lines 96–137) | Tool calls from a single LLM response are executed **sequentially** (N+1 latency anti‑pattern). Total wait time equals sum of all tool durations instead of the maximum. | Execute independent tool calls **concurrently** with `Promise.all`. |
| **High** | catch block after `tools.execute` (lines 122–133) | **Abort is not fully respected**: when a tool execution fails because of an abort (or any error), the loop `continue`s to the next tool call instead of stopping the entire step. This wastes resources and violates the abort contract. | Check `signal?.aborted` in the catch block and immediately `break` or `return` from the generator. |
| **Medium** | `if (llmResponse.toolCalls … length > 0)` + subsequent `for` loop (lines 90–141) | No **maximum limit** on the number of tool calls the LLM may return in one turn. A buggy or malicious model can cause an arbitrarily long sequence of tool executions, consuming excessive CPU/memory. | Cap the number of tool calls per step (e.g., `array.slice(0, MAX_TOOLS_PER_STEP)`) and yield a warning. |
| **Medium** | `messages.push({… content: JSON.stringify(output) })` (line 140) and similar for arguments (line 108) | **Large payloads** from tool results (and arguments) are stored verbatim in the conversation history. This may lead to memory bloat, surpass the LLM’s context window, and cause expensive serialisation of huge objects. | Truncate `output` / `input` to a safe byte‑size limit (e.g., 10 KiB) before storing, or replace with an opaque reference. Reject tool executions that return oversized results. |
| **Low** | `assistantMessage.tool_calls` construction (line 95) and `JSON.parse(toolCall.arguments)` (line 103) | **Redundant JSON serialisation**: tool call inputs are stringified when building the assistant message and later parsed back, doubling memory allocation and CPU work. | Pass the original `tc.input` object directly in a parallel metadata structure, avoiding `JSON.stringify`/`JSON.parse` entirely. |
| **Low** | Generator-local `messages` array (line 44) | **Potential memory retention** if the consumer stops iterating before the generator completes (e.g., cancellation). The array and all its retained payloads stay referenced by the suspended generator. | Use an `AbortSignal`‑triggered cleanup path to drop the reference, or provide a dedicated `dispose()` mechanism. |

---

## PER-002 — perf — `innomcp-node/src/services/analyticsService.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `activeSessions` | **Memory Leak**: The `Map` grows indefinitely if `endSession` is not reliably called (e.g., abrupt client disconnects), causing unbounded memory retention. | Implement a TTL/timeout cleanup mechanism (e.g., a periodic sweep to purge stale sessions) or replace the `Map` with an LRU cache with a strict maximum size. |
| Medium | `modelCounts`, `toolCounts` | **Unbounded Allocation**: These `Record` objects grow without limit. If `model` or `toolName` values are highly dynamic or user-controlled, this causes memory bloat and degrades serialization performance. | Enforce a strict whitelist of expected models/tools, cap the number of tracked keys, or bucket unrecognized/dynamic values into a generic `"other"` key. |
| Medium | `loadSnapshot`, `saveSnapshot` | **Large Payload / Event Loop Blocking**: `fs.readFile`/`writeFile` combined with `JSON.parse`/`stringify` buffer the entire file in memory and block the event loop during parsing/serialization of large snapshots. | Use `fs.createReadStream`/`createWriteStream` paired with a streaming JSON parser/stringifier (e.g., `stream-json`), or offload the parsing/serialization to a Worker Thread. |
| Low | `getStats` | **Missing Caching / Redundant Allocation**: Recalculates aggregates and creates shallow copies of records (`{ ... }`) on every invocation. If polled frequently, this creates unnecessary garbage collection pressure. | Cache the computed stats object and invalidate it only when `track()` mutates the state, or return direct references to the records if the caller guarantees read-only access. |
| Low | `saveSnapshot` | **Redundant Allocation**: `Array.from(this.metrics.activeSessions.entries())` allocates a full intermediate array in memory just to serialize the `Map`. | Iterate over the `Map` and write entries directly to a stream, or use a custom JSON replacer to serialize the `Map` without creating an intermediate array. |

---

## PER-003 — perf — `innomcp-node/src/services/answerContract.ts` [moonshotai/Kimi-K2.6]
| severity | location | issue | fix |
|---|---|---|---|
| medium | `buildAnswerContract`, lines 97–104 | Unbounded intermediate allocations: four linear passes over `sources` (`map`×2, `filter`×2, `includes`×2) create new arrays proportional to input size, increasing GC pressure. | Iterate `params.sources` once in a single `for…of` loop to compute `sourceIds`, freshness flags, `hotSources`, and `coldSources` in one pass. |
| low | `buildAnswerContract` return object | Large payload memory retention: the returned contract retains the entire `sources` array verbatim plus derived subset arrays (`hotSources`, `coldSources`), doubling array overhead without size limits or truncation. | Enforce a max `sources` length upstream; remove derived arrays and let consumers filter `sources.type` directly, or return iterators instead of materialized subsets. |
| low | `buildAnswerContract`, line 95 | `new Date().toISOString()` allocates on every call, preventing memoization and injecting non-determinism. | Accept an optional `timestamp` parameter defaulting to `new Date().toISOString()` so callers can pass a pre-computed value. |

---

## PER-004 — perf — `innomcp-node/src/services/artifactService.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| High | `getArtifact` (`Buffer.from`) | Sync `Buffer.from` on potentially large `artifact.content` blocks the event loop and spikes memory (string + buffer retained simultaneously). | Stream the payload or fetch as Buffer directly from the data source; avoid string intermediate. |
| Medium | `getArtifact`, `listArtifacts` | Missing caching causes redundant async I/O and buffer allocations for repeated identical requests. | Add an LRU cache for artifact lists and buffers. |
| Low | `listArtifacts` | Unnecessary `async` wrapper adds microtask overhead if `artifacts.listArtifacts` is synchronous or already returns a Promise. | Remove `async` and return the promise directly, or remove `async` if the underlying call is sync. |

---

## PER-005 — perf — `innomcp-node/src/services/auditLogger.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| High | `log()`, `ensureLogDir()`, `rotateIfNeeded()` | All I/O calls (`existsSync`, `mkdirSync`, `statSync`, `renameSync`, `appendFileSync`) are synchronous, blocking the event loop on every audit write. Under load this degrades throughput and increases latency. | Replace with `fs.promises` or callback‑based async equivalents. Ensure the log directory once at startup. Perform rotation checks asynchronously. Use async `appendFile` or a buffered write stream. |
| High | `getEntries()` | Loads *all* log files entirely into memory via `readFileSync`, parses every line, and builds an unbounded in‑memory array before applying a `limit`. O(total log size) memory and event‑loop blockage on each call. | Stream files line‑by‑line with `readline` and `fs.createReadStream`. Stop processing once the requested `limit` is reached. Return results incrementally or paginate via an async generator. |
| High | `exportCSV()`, `exportJSON()` | Calls `getEntries()` without a limit, loads the complete audit history into memory, then constructs one giant string. Risks OOM crashes for large datasets and blocks the process. | Enforce a maximum export size or implement streaming serialisation (e.g., `Transform` stream that emits CSV/NDJSON rows). Never accumulate the full dataset. |
| Medium | `clear()` | Reads whole files synchronously, filters lines in memory, and rewrites them with `writeFileSync`. Both memory pressure and blocking I/O during the cleanup window. | Process files asynchronously in chunks. Use a temporary file and atomic rename to avoid data loss on errors. |
| Medium | `readLines()` | Reads the entire file content via `readFileSync` and splits into an array, duplicating the data in memory (raw string + line array). | Use a streaming line reader (`fs.createReadStream` + `readline` interface) to yield lines one at a time. |
| Low | `rotateIfNeeded()` | `renameSync` discards any error (e.g., destination already exists on Windows) when rotating, silently losing old audit logs. | Use a collision‑resistant name (append time or UUID). Switch to async `rename` with proper error handling. |

---

## PER-006 — perf — `innomcp-node/src/services/backpressureHandler.ts` [deepseek/deepseek-v4-flash]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `drain()` method (line ~94) | Memory leak: `drainResolvers` array grows unbounded when `drain()` is called repeatedly while tasks are still pending (i.e., the queue never fully empties). Each call pushes a new resolver that is only removed when `checkDrain()` fires, so repeated `drain()` calls without a complete drain will accumulate promises indefinitely. | Replace the array with a single internal promise that is replaced on each `drain()` call, or use an event-emitter pattern with a limited number of listeners. For example, store a single `drainPromise` and its `resolve` function; if a new `drain()` is called while the queue is non‑empty, reject the old promise and create a new one. |
| Low | `insertSorted()` and `queue.shift()` | Inefficient O(n) operations due to use of Array `splice` (insertion) and `shift` (dequeue). Although `MAX_QUEUE_SIZE` is only 100, repeated enqueue/dequeue cycles cause unnecessary array reindexing overhead, which can become significant under high throughput. | Replace the array-based queue with a proper priority queue (e.g., a binary heap) for O(log n) insertion and O(1) removal, or use a linked list with a head pointer to avoid `shift` reindexing. |

---

## PER-007 — perf — `innomcp-node/src/services/cacheManager.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `size()`, `stats()` | `size()` invokes `cleanupExpired()`, causing a full synchronous iteration over all cache entries. Frequent calls block the event loop. | Remove `this.cleanupExpired()` from `size()`. Return `this.entries.size` directly. Rely on lazy expiration during access and the background timer. |
| High | `cleanupExpired()` | Synchronously iterates the entire cache to find expired nodes. Blocks the event loop proportionally to cache size every 60 seconds. | Yield to the event loop by processing expirations in chunks via `setImmediate`/`setTimeout`, or remove the timer and rely strictly on lazy expiration and LRU eviction. |
| Medium | `set()` | Unbounded payload size. The cache restricts entry count (`maxSize`) but not memory footprint. Caching large objects/buffers can trigger OOM crashes. | Implement a maximum byte-size limit per entry or track total cache weight. Reject oversized payloads or use a byte-sized LRU strategy. |
| Medium | `configure()` | Synchronous eviction loop. Reducing `maxSize` significantly forces synchronous deletion of potentially thousands of nodes, blocking the event loop. | Chunk the eviction loop using `setImmediate` or `queueMicrotask` when the number of items to evict is large, or make `configure()` async. |
| Low | `cleanupExpired()` | Mutating a `Map` while iterating over it with `for...of`. While spec-compliant, it incurs performance overhead in some JS engines and is an anti-pattern. | Accumulate expired keys in a temporary array during iteration, then delete them in a subsequent pass. |
| Low | `constructor` | `cleanupTimer` is never explicitly cleared. `unref()` prevents process hang, but the timer leaks in testing, serverless, or if the singleton is reset. | Add a `destroy()` method that calls `clearInterval(this.cleanupTimer)`, clears the map, and resets `CacheManager.instance`. |

---

## PER-008 — perf — `innomcp-node/src/services/coldRetriever.ts` [moonshotai/Kimi-K2.6]
| severity | location | issue | fix |
|---|---|---|---|
| Critical | `loadCorpus` | Blocking sync I/O: `fs.existsSync`, `fs.readFileSync`, and `fs.statSync` halt the event loop while indexing | Replace with `fs.promises` equivalents (`access`, `readFile`, `stat`) and limit concurrency |
| High | `loadCorpus` file loop | N+1 sync I/O: serial per

---

## PER-009 — perf — `innomcp-node/src/services/contextManager.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| High | `ContextManager.sessions` (Map) | **Memory retention/leak:** sessions Map grows indefinitely with no eviction or TTL. Old sessions are never removed, leading to unbounded memory growth. | Implement a session TTL or maximum size with LRU eviction. Provide a background cleanup or explicit `pruneSessions()` method. |
| High | `addMessage()` | **Unbounded allocations:** `maxMessagesPerSession` (100) and `maxContentLength` (10000) are defined but never enforced, allowing per‑session arrays and individual message strings to grow without limit. | Add checks: if `current.length >= this.maxMessagesPerSession` shift oldest non‑system message; if `message.content.length > this.maxContentLength` truncate or reject. |
| High | `trim()` while‑loop with `otherMessages.shift()` | **Unbounded loop / O(n²) complexity:** `Array.shift()` is called inside a `while` loop, causing O(n²) time for large message lists. This can block the event loop when trimming many messages. | Replace `shift()` with an index pointer (`startIdx`) that increments, and use `otherMessages.slice(startIdx)` when returning. Avoid mutating the array during the loop. |
| Medium | `getContext()` | **Missing caching:** Every call to `getContext` recalculates token counts and reruns the entire trim operation, even if the underlying messages haven't changed. | Cache the trimmed message array per session and invalidate it on `addMessage()` or `clear()`. |
| Medium | `addMessage()` | **Large payload handling ignored:** `maxContentLength` is defined but never applied, allowing extremely large strings to be stored, wasting memory and increasing token‑counting cost. | Enforce `maxContentLength` before storing: slice content if it exceeds the limit. |

---

## PER-010 — perf — `innomcp-node/src/services/dataAnalysisTool.ts` [MiniMaxAI/MiniMax-M3]
| Severity | Location | Issue | Fix |
|---|---|---|---|
| Critical | `analyzeData` (string branch) | Entire file loaded as a single UTF-8 string before parsing — unbounded memory for large CSVs; OOM on multi-GB inputs. | Stream-parse with `fs.createReadStream` piped to a line/CSV parser (`csv-parse`, `papaparse`); cap byte size via `fs.stat` first. |
| Critical | `analyzeData` (file branch) | `fs.readFile(safePath, "utf-8")` is a buffered async read of the whole file; equivalent to blocking I/O at the allocation level. | Replace with streaming reader; never materialize the full document. |
| High | `analyzeData` column loop | N+1-style full scans of `limitedRows` for **every** column (`limitedRows.map(...).filter(...)` and `cellVals.map(Number).filter(...)` repeated per column). Complexity ~ O(rows × cols) with reallocated arrays each pass. | Single pass building columnar arrays (group values by column index in one loop), or pre-transpose once. |
| High | `analyzeData` numeric branch | `cellVals.map(Number).filter(...)` runs on every column even for clearly non-numeric ones; allocates intermediate arrays. | Probe with a small sample (e.g. first 100 cells) to detect numeric columns before full conversion. |
| High | `numStats` | `[...vals].sort(...)` clones the entire array; three separate `vals.reduce` passes for sum, variance — O(n) extra allocations and traversals. | Single-pass Welford's algorithm for mean/variance; copy once (or sort in place if safe). For median on large `vals`, use quickselect instead of full sort. |
| High | `analyzeData` chart aggregation | `limitedRows.forEach(...)` walks all rows again to group by category after columns were already processed — second full pass. | Reuse the per-column arrays built in the first pass. |
| Medium | `analyzeData` | `headers.indexOf(cat.name)` / `headers.indexOf(num.name)` is O(n) per call inside the chart block. | Track column indices during the initial `headers.map` (the `ci` is already available). |
| Medium | `analyzeData` summary | `numCols.map(...).join(...)` and `catCols.map(...).join(...)` iterate the same arrays just built; minor but contributes to repeated allocation under large column counts. | Build summary strings inline while columns are processed. |
| Medium | `parseCSV` | `text.split(/\r?\n/)` materializes the whole file as a line array; per-character state machine then re-iterates every char. | Stream the file line-by-line; let the parser consume chunks incrementally. |
| Medium | `parseCSV` | CSV parser is naïve: no escaped-quote handling (`""`), no embedded commas/newlines, no BOM strip — will silently corrupt data, causing downstream O(n²) retries or wrong numeric detection on real CSVs. | Use a RFC 4180 parser; strip BOM via `.replace(/^\uFEFF/, '')`. |
| Medium | `analyzeData` numeric detection | `isNumeric` threshold of 0.7 misclassifies columns with mixed numeric strings (e.g. IDs `"001"` and prices) and forces a wasted `Number` pass on them. | Configurable per-column type hint, or explicit type column in input. |
| Medium | `analyzeData` path validation | `safePath.startsWith(input.workspaceRoot)` is vulnerable to prefix-confusion (e.g. `/work` matches `/workspace`). | Use `path.relative(input.workspaceRoot, safePath)` and reject if it starts with `..` or is absolute. |
| Low | `analyzeData` | `opts.maxRows ?? 10_000` silently truncates without warning; user gets misleading `rowCount: limitedRows.length` in result. | Return `{ rowCount: rows.length, analyzedRows: limitedRows.length }` and a truncation flag. |
| Low | `analyzeData` artifact write | `Date.now()` for filename — collisions on fast repeated calls; no uniqueness guarantee. | Append random suffix (`crypto.randomUUID()`). |
| Low | `analyzeData` artifact write | `await fs.mkdir` then `await fs.writeFile` — two sequential awaits that could overlap with chart generation. | `Promise.all` after `chartSvg` is ready; or use `fs.promises.writeFile` with `{ recursive: true }` via `fs.promises.ope

---

## PER-011 — perf — `innomcp-node/src/services/eventBus.ts` [deepseek/deepseek-v4-flash]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium   | `innomcp-node/src/services/eventBus.ts` | **Memory retention/leaks**: Listeners added via `on()` or `once()` persist indefinitely unless explicitly removed. If callers forget to unsubscribe (e.g., in component lifecycles or long‑running processes), handler references prevent garbage collection, causing memory growth over time. The `once` wrapper also remains in the set if the event never fires. | • Return a cleanup function from `on()` (already done) and document its mandatory use. <br>• For `once`, consider removing the wrapper after a timeout or using `Set` with weak references (e.g., `WeakRef`) to allow GC when the handler is otherwise unreachable. <br>• Add a configurable max listener warning (like Node’s `EventEmitter.setMaxListeners`) to detect accidental leaks early. |

---

## PER-012 — perf — `innomcp-node/src/services/fastPathHandler.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `tryReadExtraFromFile` | Blocking sync I/O: `fs.existsSync` and `fs.readFileSync` block the Node.js event loop, destroying low-latency guarantees. | Use `fs.promises.readFile` and catch `ENOENT` errors instead of checking existence synchronously. |
| High | `tryReadExtraFromUrl` | Timer leak: `clearTimeout(t)` is bypassed if `fetch` or `resp.json()` throws, leaking the timer and retaining closures in memory. | Move `clearTimeout(t)` into a `finally` block to ensure it always executes. |
| Medium | `getExtraPhrases` | Sequential I/O: File and URL reads are awaited sequentially, unnecessarily increasing cache refresh latency. | Execute both promises concurrently using `Promise.allSettled`. |
| Medium | `getExtraPhrases` | Thundering herd (Missing request coalescing): Concurrent requests during cache expiration trigger duplicate I/O operations. | Implement a singleflight pattern by caching the in-flight `Promise` itself until it resolves. |
| Medium | `handleFastPathMessage` | Unused latency guard: `opts.maxWorkMs` is defined but never enforced; slow operations (like `checkRateLimit`) can block the pipeline indefinitely. | Wrap blocking calls in `Promise.race` with a timeout based on `maxWorkMs`, or use `AbortSignal.timeout()`. |
| Medium | `tryReadExtraFromUrl`, `tryReadExtraFromFile` | Unbounded payload parsing: `resp.json()` and `JSON.parse()` process arbitrarily large payloads, risking CPU and memory spikes. | Check `Content-Length` header or `fs.stat` size before reading, and abort/reject if it exceeds a safe limit (e.g., 1MB). |
| Low | `mergeExtra` | Excessive allocations: Spreads arrays and creates `Set` objects for every key during cache merges. | Use a plain object or `Map` for deduplication and convert to arrays once, avoiding intermediate spread operations. |

---

## PER-013 — perf — `innomcp-node/src/services/generalGate.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Low | `renderThaiNumberText` — inner function `renderChunk` (≈ line 22) | A new closure is created every call, causing unnecessary function‑object allocations and minor GC pressure. | Hoist `renderChunk` to module scope or define it outside the function to reuse a single instance. |

---

## PER-014 — perf — `innomcp-node/src/services/healthAggregator.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| High | `runCheckerWithTimeout` | Memory retention / leak: `setTimeout` is never cleared if `checker()` resolves/rejects before the timeout. The timer and its closure remain in memory until `timeoutMs` elapses. | Store the timer ID (`const timer = setTimeout(...)`), and call `clearTimeout(timer)` immediately after `checker()` settles (in a `.finally()` block or after `await`). |
| Medium | `check` | Cache stampede: Concurrent calls when the cache is expired bypass the stale check and execute all health checkers simultaneously, causing duplicate redundant I/O and CPU spikes. | Deduplicate in-flight requests by storing the Promise (e.g., `this.inFlightPromise`). If a check is already running, return the existing Promise instead of spawning new checks. |
| Medium | `HealthStatus.details` | Large payload handling: The `details` property is `Record<string, unknown>` with no size limits. A custom checker can attach massive objects (e.g., large arrays, DB dumps) that are retained in `this.cache` for 10 seconds, causing memory spikes and slow JSON serialization. | Enforce a maximum byte/size limit on the `details` payload before caching, or deeply clone and truncate/stringify large properties. |
| Low | `checkers` Map | Unbounded allocation: `registerChecker` allows indefinite additions to the `Map` without a `removeChecker` method. If checkers are registered dynamically (e.g., per route), this grows indefinitely. | Add a `removeChecker(name: string)` method to delete entries from the `Map` and clear the cache. |
| Low | `memoryCheck`, `uptimeCheck` | Redundant async: Synchronous operations (`process.memoryUsage()`, `process.uptime()`) are marked `async`, creating unnecessary microtasks and Promise allocations. | Remove the `async` keyword and return `Promise.resolve(result)`, or update the `HealthChecker` type to `() => Promise<HealthStatus> \| HealthStatus` to allow synchronous returns. |

---

## PER-015 — perf — `innomcp-node/src/services/hotRetriever.ts` [MiniMaxAI/MiniMax-M3]
# Performance Audit: `hotRetriever.ts`

| Severity | Location | Issue | Fix |
|---|---|---|---|
| Critical | `let factCounter = 0` (module-level, line ~14) | **Unbounded monotonic counter — memory/id retention risk across long-running processes.** `nextFactId` increments forever; combined with `seen` Set in `mergeRetrievalFacts`, IDs grow unboundedly in deduplication caches. | Use `crypto.randomUUID()` or scoped `WeakRef`/namespaced counters reset per request; if monotonic needed, cap via `MAX_SAFE_INTEGER` rollover and re-anchor at zero. |
| Critical | `mergeRetrievalFacts` (line ~119) | **Unbounded `Set<string>` + array allocation in dedup path.** `seen` Set retains every fact ID across the lifetime of any caller that holds the returned array reference. For long-lived RAG pipelines this leaks. | Stream-merge into a pre-sized array; use `WeakSet` keyed on fact objects (not IDs) so GC can reclaim when consumer drops references. Avoid retaining `seen` past the function return. |
| High | `normalizeWeatherFacts` array branch (line ~33) | **Unbounded loop over `toolResult.result`/`data` with no size cap.** A malformed/oversized upstream payload (e.g. 100k items) causes OOM in one call. | Cap with `const MAX_FACTS = 1000;` and slice; emit a truncated-result fact for the remainder. |
| High | `composeFactSummary` (line ~132) | **Unbounded string allocation from `JSON.stringify` of `raw` + `content`.** Each fact's content is held in memory; with 1k facts × full raw payloads the summary can balloon to MB. The 500-char slice happens per-fact but the `lines` array is fully materialized. | Stream-join with a single `StringBuilder`/array-buffer; cap total output (e.g. 16KB) and short-circuit. Avoid keeping references to `fact.raw` in the output path. |
| High | `normalizeWeatherFacts` / `normalizeEvidenceFacts` | **`raw: item` / `raw: data` retains full upstream payload on every fact.** Caller holding these facts retains entire tool result indefinitely. | Store only a `rawRef` (symbol/id) or a serialized slice; offer a `keepRaw: false` option for hot-path consumers. |
| Medium | `extractWeatherEntities` (line ~150) | **Two separate regex compilations + two `String.match` passes per call** — redundant work; compiled regex literal is cached by engine but the dual scan is unnecessary. | Single combined regex with named groups; one pass. Cache by query hash if called repeatedly. |
| Medium | `extractWeatherEntities` / `extractISP` | **No memoization on `query`.** Same query normalized repeatedly across re-rank/composition stages re-runs regex. | Add `Map<string, string[]>`/`Map<string, string\|null>` cache, or hoist entity extraction to a pre-normalization step called once per request. |
| Medium | `composeFactSummary` (line ~127) | **`facts.length === 0` early return is fine, but `lines.push` inside loop + final `lines.join("\n\n")` is O(n) + O(total length) without capacity hint.** | Pre-size: `const lines = new Array(facts.length);` and use indexed assignment; or build into a single string with a precomputed buffer. |
| Medium | `normalizeDeterministicFact` (line ~96) | **`String(result)` on arbitrary `result` can throw on objects with throwing `toString`; also `entities: []` allocated every call** even though it's a constant empty array. | Hoist `const EMPTY_ENTITIES: readonly string[] = Object.freeze([]);` and reuse. Wrap `String(result)` in try/catch or use `safeStringify`. |
| Low | All `normalize*` functions | **Repeated `new Date().toISOString()` and source-object literal construction** inside loops/forks. In `normalizeWeatherFacts` loop, `now` is captured once (good) but the source object literal is reallocated per iteration with identical fields. | Build source template once, clone per fact; or pass `now` and freeze the constant parts. |
| Low | `extractISP` (line ~164) | **Regex case-insensitive flag combined with `.toUpperCase()` on capture** — captures mixed-case then uppercases; if a downstream consumer cares about original ca

---

## PER-016 — perf — `innomcp-node/src/services/imageGenService.ts` [deepseek/deepseek-v4-flash]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `callImageGen` (entire function) | No caching of generated images; repeated identical prompts cause redundant generation calls | Implement a caching layer (e.g., in-memory Map with TTL) keyed by `providerPrompt` or `originalPrompt`; invalidate on TTL or when provider fails |
| Medium | `callGateway` (lines consuming `res.arrayBuffer()` and converting to base64) | Large image payload (PNG up to 1024×1024) is fully buffered in memory; the `base64` field duplicates the data URI content, increasing memory footprint | Stream response directly to persistent storage (e.g., S3 bucket) and return a URL; or omit the `base64` field when `url` is already a data URI; use streaming to avoid holding entire buffer |
| Low | `callPollinations` (the `HEAD` fetch) | Redundant HEAD request to validate Pollinations URL – adds unnecessary latency (~5s timeout) and network round-trip for every fallback request | Remove the HEAD request; rely on client-side error handling if the URL fails to load; optionally cache successful validity per prompt |

---

## PER-017 — perf — `innomcp-node/src/services/intentClassifier.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| medium | `evidenceMatch` (inside the `if (["machine",...])` block) | Inline regexes `/machine learning|url encoding|url คืออะไร/` and `/หลักฐาน|คดี|.../i` are re-compiled on every call. | Hoist both patterns to module‑level `const` variables (`NON_OFFICER_SIGNAL_RE`, `OFFICER_SIGNAL_RE`) and reuse them. |
| medium | `evidenceMatch` – officer‑signal test | The guard `hasOfficerSignal` uses a duplicated inline regex identical to the module‑level `OFFICER_SIGNAL_RE`. | Replace the inline regex with a reference to the already defined `OFFICER_SIGNAL_RE` constant to avoid re‑compilation and keep intent in sync. |
| low | `classifyIntent` → multiple `containsAny` calls | The raw `message` string is lowercased once per `containsAny` (and again inside `evidenceMatch`), leading to repeated O(n) allocations. | Lowercase the message once at the top of `classifyIntent` and pass the lowercased version to all helpers. |
| low | `containsAny` iteration | Every keyword is lowercased inside the loop (`k.toLowerCase()`), repeating the same work for a static list. | Store all keyword arrays already lowercased (e.g., `const LOWERCASE_KEYWORDS = [...]`) to avoid per‑call lowercasing overhead. |
| low | `classifyIntent` – scattered keyword lookups | Multiple sequential `containsAny` calls scan the entire message for each intent, causing redundant full‑text passes. | Optionally tokenise the lowercased message once and use a single pass over tokens with a map of keyword→intent to reduce repeated `includes` scans. (Only relevant if message length or request rate is high.) |

---

## PER-018 — perf — `innomcp-node/src/services/leaderboardMetrics.ts` [moonshotai/Kimi-K2.6]
| severity | location | issue | fix |
|---|---|---|---|
| Critical | module-level `store` / `recordProviderCall` | Unbounded memory retention: `store` Map accumulates provider entries forever with no eviction, TTL, or size cap; leaks memory if providerIds are dynamic or high-cardinality. | Implement LRU eviction (e.g., max 500 entries) or periodic TTL sweep; persist evicted entries to DB before deletion. |
| Critical | `recordProviderCall` (DB callback) | N+1 DB writes: every single provider call triggers an independent `INSERT ... ON DUPLICATE KEY UPDATE`; under parallel fan-out this floods the connection pool and serializes on DB locks. | Accumulate deltas in a pending-write buffer; flush batched multi-row `INSERT ... ON DUPLICATE KEY UPDATE` on interval or size threshold. |
| High | `getProviderStats` | Blocking synchronous computation: rebuilds entire snapshot on every read, cloning+sorting latency arrays (p95) and intent objects per provider; event-loop blocking scales linearly with provider count. | Maintain a cached `ProviderStats` snapshot

---

## PER-019 — perf — `innomcp-node/src/services/mcpClient.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| High | `callBatch` | Unbounded concurrency — `Promise.all` on an unrestricted array fires every request simultaneously; a large batch exhausts sockets/memory | Cap batch size; use a concurrency limiter (e.g. `p-limit`) so at most N requests are in-flight at once |
| High | `requestOnce` → `resp.json()` | No response size limit — a multi-MB payload is fully buffered and parsed into a single JS object, risking OOM | Check `Content-Length` before reading; stream-parse with a byte cap; reject oversized responses |
| Medium | `safeReadText` | Reads entire error body into memory (`await resp.text()`) then slices to 500 — allocates the full body just to discard most of it | Read via streaming `ReadableStream` with a byte budget (e.g. 512 B), or at minimum check `Content-Length` and skip large bodies |
| Medium | `callTool` | No deduplication of identical concurrent calls — N callers invoking the same tool+params produce N independent HTTP requests | Maintain an in-flight `Map<string, Promise>` keyed by `toolName+serialized(params)`; coalesce concurrent calls onto one request |
| Medium | `requestOnce` → `JSON.stringify(params)` | No bound on request payload size — a caller passing a massive `params` object serialises it entirely into memory | Validate `params` size (e.g. `Buffer.byteLength(JSON.stringify(params))`) against a configurable max before sending |
| Low | `callTool` retry loop | Linear backoff (`RETRY_BACKOFF_MS × (attempt+1)`) without jitter — under sustained failures, all clients retry in lockstep (thundering herd) | Switch to exponential backoff with random jitter: `2^attempt * base ± random` |
| Low | `getDefaultMcpClient` | Module-level `defaultClient` singleton is never evicted and captures `baseUrl`/`fetchImpl` for process lifetime | Acceptable for long-running Node processes; add an explicit `resetDefaultMcpClient()` for test isolation and document that the singleton is immortal |
| Low | `requestOnce` error path | Error message concatenates `status`, `statusText`, and up to 500 chars of body into a retained `Error` object — if many errors accumulate, string memory adds up | Truncate earlier; store status separately and keep body excerpt ≤ 200 chars; avoid retaining full error objects in long-lived collections |

---

## PER-020 — perf — `innomcp-node/src/services/mdesModelCache.ts` [MiniMaxAI/MiniMax-M3]
| severity | location | issue | fix |
|---------|----------|-------|-----|
| High | `getModels()` (line ~28) | **Thundering herd / cache stampede**: when TTL expires, every concurrent caller awaits a fresh `fetch()` simultaneously because no in-flight request is tracked. Under load this can fire N parallel network calls against the Ollama endpoint. | Track an in-flight `Promise<MDESModel[]>`; on cache miss, start the fetch once and have all callers `await` the same promise; clear it on settle. |
| High | `getModel()`, `isModelAvailable()`, `getBestModelForTask()` (lines ~52, ~64, ~73) | **Redundant awaits / repeated cache hits**: each method independently awaits `getModels()` and re-walks the array; `isModelAvailable` and `getModel` essentially reimplement a lookup. The selector paths also re-allocate + re-sort even when called back-to-back. | Add an in-memory `Map<string, MDESModel>` (name → model) rebuilt on cache update; `getModel`/`isModelAvailable` become O(1) hash lookups; `getBestModelForTask` should precompute sorted/derived indexes once per refresh and reuse them. |
| High | `getBestModelForTask()` "reasoning"/"fast" branches (lines ~100, ~115) | **Quadratic / repeated work per call**: O(N) scans over `models` (and a full `Array.prototype.sort` copy in the fallback) executed on every task lookup, even though model set only changes every 5 min. Also allocates `[...models]` each call. | On cache refresh, precompute `byFamily`, `bySizeDesc`, `bySizeAsc`, and Thai/code boolean indexes; selectors become O(1)/O(matches). Avoid the defensive `[...models]` copy by sorting indexes instead of model objects. |
| Medium | `getModels()` (line ~30) | **Stale-while-error returns the same mutable array reference** to all callers; any downstream consumer mutating it will corrupt the cache for everyone (memory retention + correctness). | Return `Object.freeze([...this.cache])` (or a read-only view) on both fresh and stale paths. |
| Medium | `getModels()` (line ~27) | **Cache invalidation race**: `lastFetch` is set after `await response.json()` succeeds. Two concurrent refreshes can both pass the `forceRefresh=true` gate (e.g., `warmUp` + caller) and overwrite each other; an earlier-arriving slow response can also clobber a newer fresh one. | Guard with an `inFlight` promise (see above) and a monotonic `fetchEpoch` counter — only commit if `epoch === this.epoch`. |
| Medium | `getBestModelForTask()` (line ~82) | **`name` may be undefined** for some Ollama responses; `m.name.toLowerCase()` will throw. The "thai"/"code" selectors also run even when caller passed an unknown task string and then fall through to the generic branch — wasted scan. | Guard with `if (m.name) …`; validate `task` once at top and return/throw early for unknown values, or add a `default:` branch. |
| Medium | `getBestModelForTask()` "fast" branch (line ~122) | **`parseInt(quantization_level, 10)` on a string like "Q4_K_M"** yields `4`, not a quality score — the "higher = faster" heuristic is semantically wrong (Q4_K_M is a quality level, not a speed metric). This is a logic bug masquerading as a perf decision. | Either map known quant levels to a numeric score via a lookup table (`{ "Q4_0": 4, "Q4_K_M": 4.5, ... }`) or drop the quantization factor and sort by size only, with a deterministic tiebreak. |
| Low | `getBestModelForTask()` (line ~134) | **Generic fallback returns `sorted[0].name` without null check** — if `models` somehow contains entries with no parseable `parameter_size`, `sizeValue` returns `Infinity` for all and sort order is stable but `sorted[0]` may still be `undefined` if the array is empty (already guarded above, but defense-in-depth is missing). | Return `sorted[0]?.name ?? models[0]?.name` and throw a typed error if both absent. |
| Low | `getModels()` catch block (line ~44) | **Silent stale-cache return on persistent failures**: a long-broken upstream keeps callers happy with 5-min-stale data indefinitely; no observability on failure rate. | 

---

## PER-021 — perf — `innomcp-node/src/services/memoryRagHook.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|-----------|-----------|--------|------|
| HIGH | `recordTurnAndGetMeta` / `sessionMemory` | No mechanism to expire or clean up old sessions. `sessionMemory.recordTurn` accumulates data indefinitely, leading to unbounded memory growth (memory leak). | Implement TTL or periodic cleanup in `sessionMemory` (e.g., auto‑evict sessions after inactivity). Alternatively, add an explicit `sessionMemory.purge(sessionId)` that consumers call when a session ends. |
| HIGH | `recordTurnAndGetMeta` return value (`MemoryRagMeta.coldContext`) | `coldContext` contains the full concatenated text of all retrieved chunks, which can be very large. If this metadata is later sent to the client (or stored in diagnostics), it causes large response payloads and memory pressure. | Truncate `coldContext` to a safe maximum (e.g., 4000 characters) or replace it with a flag (`coldContextInjected`) and store the full context only where needed (e.g., in a separate cache). |
| MEDIUM | `queryColdRag` (exported function) | No caching of cold‑RAG search results. Identical queries inside the same session re‑execute the full retrieval pipeline, wasting CPU and possibly I/O. | Add a short‑lived LRU cache keyed by `(query, domain)` so repeated calls return the same result immediately. |
| MEDIUM | `recordTurnAndGetMeta` → `executeColdRetrieval` | `executeColdRetrieval(plan)` may return an unbounded number of results. The subsequent `map`/`join` creates a potentially huge `coldContext` string without any limit. | Enforce a maximum result count (e.g., `maxResults: 3`) inside `executeColdRetrieval` or limit the array before building the string. Additionally, cap the final string length. |
| LOW | `extractEntities` | Regex patterns (`provincePattern`, `regionPattern`, etc.) are defined inside the function body and re‑compiled on every call, which creates minor GC pressure. | Move all regex definitions to module‑scope constants so they are compiled once. |

---

## PER-022 — perf — `innomcp-node/src/services/metricsCollector.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `Metric.labelMap` | **Memory Leak / Unbounded Growth**: `labelMap` grows indefinitely with high-cardinality labels (e.g., user IDs, request IDs), leading to eventual OOM. | Implement a max cardinality limit (e.g., LRU eviction) or reject/warn on label combinations exceeding a safe threshold. |
| High | `Counter.inc`, `Gauge.inc` | **Redundant Computation**: `this.key(labels)` is computed twice per update (once inside `getOrCreate`, once explicitly), wasting CPU on hot paths. | Refactor to compute the key once, or modify `getOrCreate` to return a mutable reference/update the value directly without re-hashing. |
| Medium | `exportLines` (all classes) | **Unbounded Allocations**: String concatenation (`out += ...`) inside loops creates excessive intermediate string allocations and GC pressure. | Push lines to an array and use `Array.join('\n')` at the end, or use a `StringBuilder` equivalent. |
| Medium | `Metric.key`, `exportLines` | **Inefficient Serialization**: Using `JSON.stringify` for map keys and `JSON.parse` for reconstruction is slow and allocates heavily. | Use a delimiter-based string join (e.g., `sorted.join('\x00')`) and `split` for reconstruction, or store label objects directly in a Trie/nested Map. |
| Medium | `Histogram.exportLines` | **Excessive Object Allocation**: `{ ...labelObj, le: ... }` creates a new object and re-runs `formatLabels` for every bucket on every export. | Pre-format the base label string and manually append `,le="..."` (handling empty base labels) to avoid object spread and redundant formatting. |
| Medium | `MetricsCollector.export` | **Large Payload Memory Spike**: Building the entire export payload as a single string/array in memory can cause OOM or event loop blocking for large metric sets. | Implement a streaming approach (e.g., returning an `Iterable`/`Generator` of strings) or chunked processing to flatten memory usage. |
| Low | `Histogram.observe` | **Suboptimal Search**: `findIndex` performs a linear O(N) search over buckets to find the correct index. | Use a binary search algorithm for O(log N) lookup, especially if custom bucket arrays are large. |
| Low | `Metric.key` | **Inefficient Validation**: `this.labelNames.includes(k)` performs an O(N) array search inside a loop for every metric update. | Convert `labelNames` to a `Set` during construction for O(1) lookups, or rely on strict key count and sorted comparison. |
| Low | `inc`, `set`, `observe`, `get` | **Default Parameter Allocation**: `labels: LabelValues = {}` allocates a new empty object on every call when labels are omitted. | Define a module-level frozen empty object (e.g., `const EMPTY_LABELS = Object.freeze({})`) and use it as the default parameter. |

---

## PER-023 — perf — `innomcp-node/src/services/modelLoadBalancer.ts` [moonshotai/Kimi-K2.6]
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

7. **Redu

---

## PER-024 — perf — `innomcp-node/src/services/motherExportService.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| High | `exportToJSON` | `JSON.stringify` with pretty-print (`null, 2`) is synchronous and blocks the event loop for large payloads | Use streaming JSON serializer; make async; default to compact output |
| High | `exportToJSON` / `exportToCSV` | No default limit — `motherHistory.get(undefined)` returns unbounded data, risking OOM | Enforce a sensible default limit (e.g., `Math.min(options.limit ?? 1000, MAX_EXPORT)`) |
| High | `exportToCSV` | `flatMap` + `map` materializes the entire denormalized row set in memory before string assembly — peak memory ≈ 2× payload | Stream rows via generator/async iterator; write to a `Writable` stream instead of accumulating |
| Medium | `exportToCSV` | CSV escaping is incomplete — only escapes `"` but not newlines, carriage returns, or commas inside unquoted fields | Quote any field containing commas, newlines, or CRs; escape per RFC 4180 |
| Medium | `exportToJSON` / `exportToCSV` | Full input array and full output string held simultaneously — peak memory ≈ 2× payload | Process and flush in chunks; release input references incrementally |
| Medium | `exportToJSON` | No caching — identical export requests re-serialize the entire dataset every time | Memoize result keyed by `(limit, historyVersion)` with invalidation on history mutation |
| Low | `exportToCSV` | `rows.map(row => row.join(","))` allocates an intermediate string array before final `join("\n")` | Build CSV in a single pass using a string builder or direct stream write |
| Low | `exportToJSON` | Pretty-print inflates payload ~2× vs compact JSON | Default to compact; make pretty-print opt-in via `ExportOptions` |

---

## PER-025 — perf — `innomcp-node/src/services/motherHistory.ts` [deepseek/deepseek-v4-pro]
| severity | location                                | issue                                                                                                                          | fix                                                                                                                                                  |
|----------|-----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| Medium   | `MotherRun` interface / `pushRun()`     | No limit on number of `providers` stored per run in the history buffer. A single `MotherRun` can hold an arbitrarily large array, leading to unbounded memory consumption and potential memory bloat. | Enforce a maximum number of providers per run (e.g., store only the first N or top by latency). Trim or reject oversized `providers` arrays before pushing to `HISTORY`. |

---

## PER-026 — perf — `innomcp-node/src/services/motherProviderToggle.ts` [deepseek/deepseek-v4-flash]
| severity | location | issue | fix |
|----------|----------|-------|------|
| none     | -        | No performance issues identified within the scope of the audit (blocking sync I/O, unbounded loops/allocations, N+1 calls, missing caching, redundant awaits, memory retention/leaks, large payload handling). | N/A |

---

## PER-027 — perf — `innomcp-node/src/services/naturalnessGuard.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
| :--- | :--- | :--- | :--- |
| Medium | `checkNaturalness` (Line 53) | `candidate.trim()` allocates a full copy of the string. For large LLM payloads (e.g., 100KB+), this causes unnecessary memory allocation and GC pressure. | Remove `trim()`. Update regexes to tolerate leading/trailing whitespace (e.g., use `^\s*` and `\s*$`), or apply non-allocating checks directly on `candidate`. |
| Low | Rule 6 (Lines 88-89) | Two separate regexes (`hasFollowup`, `hasPlanFrame`) scan the entire potentially large string sequentially. The logic `!hasFollowup && !hasPlanFrame` is logically equivalent to checking if neither exists. | Combine into a single regex to scan the string only once: `const hasRequiredElements = /(?:\?|มี(?:คำถาม|ข้อเสนอ)|รบกวน(?:ขอ|ระบุ)|จะให้|แนวทาง|first-pass|เกณฑ์|ขั้นตอน|วิธี|ปัจจัย)/.test(candidate);` |
| Low | `startsWithEnglish` (Line 25) | Calls `s.trim()` internally, allocating a new string. When called from `checkNaturalness`, it is passed an already trimmed string, making the internal `trim()` redundant and wasteful. | Remove `.trim()` and rely on the regex to ignore leading whitespace: `return /^\s*[A-Za-z]/.test(s);` |
| Low | Rule 2 (Line 68) | `trimmed.slice(0, 50)` allocates a new string for the substring check. While small, it is an unnecessary allocation in a hot path. | Use `String.prototype.search()` to find the index without allocation: `const thaiIdx = candidate.search(/[฀-๿]/); const hasEarlyThai = thaiIdx !== -1 && thaiIdx < 50;` |

---

## PER-028 — perf — `innomcp-node/src/services/notificationService.ts` [moonshotai/Kimi-K2.6]
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

4. **N+1 calls / missing caching**: Not exactly N+1 in the database sense, but `getRecentNotifications` is called per session without caching. If multiple requests come for the same session, it recomputes the filter+sort each time. Could cache per session. But more importantly, `notify` and `broadcast` call `addToHistory` which does `this.history = this.history.slice(-NotificationService.MAX_HISTORY)`. This creates a new array copy every time the history exceeds 1000. If under heavy load (e.g., thousands of notifications per second), this causes frequent large array allocations. The slice creates a shallow copy of up to 1000 elemen

---

## PER-029 — perf — `innomcp-node/src/services/presenceService.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `reapStaleEntries()` scheduled interval (line ~100–112) | O(N) linear scan across all projects and all user entries every 30 s, which can cause CPU spikes if the active user/project count grows large. | Replace in-memory linear scan with a priority queue keyed on expiration timestamp, or maintain a separate sorted list of entries by `lastPingAt` to prune only expired ones. |
| Low | `join()` function, refresh branch (line ~60) | Creates a new object `{ ...existing, displayName, lastPingAt: now }` on every presence refresh, generating unnecessary allocations under frequent pings. | Mutate the existing entry directly: `existing.displayName = displayName; existing.lastPingAt = now;` |
| Low | `broadcast()` function (line ~87) | No size guard on the input `message` before `JSON.stringify`. A very large object can produce an enormous string, causing long synchronous serialization time and large memory allocation that blocks the event loop. | Enforce a configurable payload size limit (e.g., 64 KB) and reject or truncate if exceeded; if streaming is needed, chunk the send or offload serialization. |
| Low | `join()` function, timestamp creation (line ~58) | `new Date().toISOString()` creates a new string on every join/ping. Under very high call frequency this generates GC pressure. | Store a numeric `lastPingAtTimestamp` (e.g., `Date.now()`) and only format to ISO‑8601 string inside `getPresence()` when responding to API clients. |

---

## PER-030 — perf — `innomcp-node/src/services/promptAdapter.ts` [MiniMaxAI/MiniMax-M3]
I'll acknowledge the truncated file and perform a performance audit on what's visible. Note: I cannot see the LLM fallback path or callers, so findings are limited to the visible code.

| Severity | Location | Issue | Fix |
|---|---|---|---|
| Medium | `GLOSSARY` array (~70 entries) + `applyGlossary` (inferred) | Linear scan of the full glossary on every call. O(n×m) per prompt with no cache; identical inputs re-scan. | Memoize: `Map<string, AdaptedImagePromptResult>` keyed by `rawPrompt`; or pre-build a single regex alternation sorted by length, executed once per call. |
| Medium | `GLOSSARY` entries like `{ th: "หมา", en: "dog" }` after `{ th: "สุนัข", en: "dog" }`; `{ th: "ป่า", en: "forest" }` after `{ th: "ป่าไม้", en: "forest" }` | Duplicates produce redundant/competing translations and inflate scan cost. Also, short tokens like `หมา`, `ป่า`, `เมือง`, `รถ`, `เรือ`, `เด็ก`, `นก`, `ม้า`, `วัด`, `ถนน` are single words that will false-match inside larger Thai words. | Dedupe by `en`; require word-boundary anchoring (`/(?:^|\s)หมา(?=\s|$)/`) or pre-segment Thai via `Intl.Segmenter` before matching. |
| Medium | `stripImageCommand` — `IMAGE_FILLER_RE` loop (max 2) | Hard-coded `2` iterations is a magic number; filler list is closed, so an explicit alternation is faster and clearer. | Replace loop with single regex `^(?:ของ|เกี่ยวกับ|ที่|ให้|หน่อย|ที|ที่เป็น|แบบ|เป็น|of|about|featuring)(?:\s+(?:ของ|…))+` or two explicit `.replace` calls. |
| Medium | `stripImageCommand` — 3 sequential `.replace` passes on the same string | Each pass re-scans the whole string; for long inputs this is wasted work. | Combine into one alternation regex, or run all three anchored patterns in a single pass. |
| Low | `normalizeThaiQuery` import | Unknown whether `thaiQueryNormalizer` itself allocates per call (caches, maps). If it does, repeated identical inputs in a request burst will re-allocate. | Wrap both `adaptImagePrompt` and `normalizePlannerQuery` with an LRU keyed by `rawPrompt`/`rawQuery`; size ~256. |
| Low | `latencyMs` populated on every call | `Date.now()` × 2 per call; negligible but called in hot paths. | Use `performance.now()` (monotonic) and only compute when an observer is attached, or accept the cost. |
| Low | `reasons: string[]` returned in result | Strings are interned-ish but the array is retained by callers; in long-lived sessions this is GC pressure if results are stashed in logs/traces. | Return `readonly string[]`; document that results are short-lived; avoid pushing into persistent traces. |
| Low | `confidence: number` in result | If callers persist these, you retain references to `originalPrompt` and the result object — equivalent to retaining the user's raw input. | Document short-TTL retention; consider returning a `Symbol`-keyed weak handle if callers cache. |
| Low | `GLOSSARY` defined at module scope | Module load parses ~70 literals — fine, but if the file is reloaded (HMR/test) each load allocates a new array. | None in prod; in tests, freeze the module via Jest reset or extract to a JSON asset loaded once. |
| Low | Regexes `IMAGE_COMMAND_PREFIX_RE`, `IMAGE_COMMAND_REVERSE_RE`, `IMAGE_FILLER_RE` | Not anchored with `i` flag implications; `IMAGE_FILLER_RE` uses `^` only, correct, but case-insensitive Thai isn't meaningful and the `i` flag is wasted work. | Drop `i` from `IMAGE_FILLER_RE` (Thai-only tokens); keep `i` only on the Latin-bearing patterns. |
| Low | `adaptImagePrompt` / `normalizePlannerQuery` are `async`-implied by callers | If these return `Promise` and the body is fully sync, every call site pays a microtask hop. | Return synchronous `T` and let callers `await` only the LLM-fallback branch. |
| Info | `confidence` computation not visible | Likely a heuristic over `reasons.length`; if it iterates the glossary it's O(n) extra. | Compute in the same pass that fills `reasons` to avoid a second scan. |
| Info | LLM fallback path not visible | Cannot audit timeout enforcement, `AbortController` usage, 

---

## PER-031 — perf — `innomcp-node/src/services/providerAdapter.ts` [deepseek/deepseek-v4-flash]
| severity | location | issue | fix |
| --- | --- | --- | --- |
| Medium | `streamOpenAI` / `streamAnthropic` (streaming loops) | String concatenation (`buffer += decoder.decode(...)`) per chunk causes O(n²) time and memory for long responses. | Accumulate decoded strings in an array and join only when processing lines, or use a `TextDecoder` with `stream: true` and keep a single partial-last-line buffer without repeated concatenation across chunks. |
| Medium | `callOpenAI` / `callAnthropic` (non‑streaming) | Full JSON response parsed into memory; large token responses (e.g., 100k+) can cause high memory usage. | If supported by the API, prefer streaming for large outputs; otherwise consider streaming JSON parsing or pagination. |
| Low | `streamOpenAI` (line processing) | The `break` inside the `for` loop only exits the inner loop, not the outer `while`. After `[DONE]` the stream is closed, but an extra `reader.read()` may still be performed. | Replace `break` with a dedicated flag or immediate `return` after sending `{ type: "done" }` to avoid unnecessary I/O after stream completion. |
| Low | `streamAnthropic` (truncated) | Similar concatenation and break issues as `streamOpenAI` are expected if the pattern is identical (code truncated). | Apply the same fixes as for `streamOpenAI`. |

---

## PER-032 — perf — `innomcp-node/src/services/providerFailover.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `checkProvider` | **Cooldown bypass**: When a provider is unhealthy but the cooldown hasn't elapsed, `!shouldAttemptCheck && status.healthy` evaluates to `false`, causing the method to fall through and execute the health check anyway. This defeats the circuit breaker cooldown, leading to unbounded/excessive network calls. | Simplify logic: `if (status.healthy) return true; if (now - status.lastCheck < this.cooldownMs) return false;` before attempting the active check. |
| High | `selectProvider`, `getStats` | **Hardcoded constants over instance state**: Methods use module-level `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS` instead of the instance's configured IDs. If custom IDs are passed to the constructor, `this.statuses.get()` returns `undefined`, causing a `TypeError` crash on the hot path. | Store `primaryId` and `backupIds` as private instance properties during construction and reference them instead of the global constants. |
| Medium | `markFailed`, `markHealthy`, `selectProvider` | **Redundant `async`/`await`**: These methods are marked `async` but perform no asynchronous operations. This forces the JS engine to wrap return values in Promises and schedule microtasks, adding unnecessary overhead on every request success/failure. | Remove the `async` keyword, change return types to synchronous (`void` or `string`), and remove `await` at call sites (e.g., inside `checkProvider`). |
| Low | `getStats` | **Unnecessary object allocation**: Creates shallow copies of all status objects (`{ ...s }`) and allocates new arrays on every invocation. If polled frequently for metrics/monitoring, this creates avoidable GC pressure. | Return direct references to the internal state if external mutation isn't a risk, or maintain a cached stats object that is only updated when provider statuses change. |

---

## PER-033 — perf — `innomcp-node/src/services/providerHealthProbe.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| low | `buildProbeTargets` (module scope) | No caching of the probe target array; every call re‑reads environment variables and rebuilds the full list of 20 targets, allocating temporary arrays (e.g. `OPENAI_FALLBACK_MODELS` split) and objects. | Store the result in a module‑level `const` (lazy initialisation with a null check) so it is computed once at first use. |
| low | `buildProbeTargets`, line containing `commandCodeUsesOpenAiProxyShape` | Regular expression literal `/(^https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal):4322\b/` is compiled on every invocation. | Define the regex as a `const` at module scope to avoid repeated compilation overhead. |

---

## PER-034 — perf — `innomcp-node/src/services/providerManager.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| High | `checkHealth` | Memory leak / socket retention: `fetch` Response body stream is never consumed or destroyed. In Node, unconsumed streams prevent socket reuse and leak memory. | Drain the body unconditionally via `await response.text()` or call `response.body?.cancel()` after checking `response.ok`. |
| Medium | `checkAllHealth` | Unbounded concurrency: `Promise.allSettled` fires network requests for all providers simultaneously. Large provider counts will cause event loop starvation and memory spikes. | Implement concurrency limits (e.g., process in chunks or use `p-limit`) to bound simultaneous network requests. |
| Low | `register`, `unregister`, `getAll`, `getBest` | Redundant async: Methods perform only synchronous Map/Array operations but return Promises, adding microtask overhead and forcing unnecessary `await`s at call sites. | Remove `async` keywords and return values synchronously. |
| Low | `getBest` | Missing caching: Filters and sorts the entire provider array on every invocation, causing redundant CPU work if called frequently (e.g., per incoming request). | Cache the sorted/filtered result and invalidate the cache only when providers mutate (register, unregister, or health update). |
| Low | `checkHealth` | Unnecessary timer allocation: Manual `setTimeout` + `clearTimeout` allocates resources and risks leaks if `clearTimeout` is missed. Node 18+ supports native fetch timeouts. | Replace `AbortController` + `setTimeout` with `AbortSignal.timeout(timeoutMs)` to eliminate manual timer management. |
| Low | `getAll`, `getBest`, `getMDESPrimary` | Unbounded allocation: Spreads `{ ...p }` to create shallow copies on every call. Frequent invocations create excessive garbage collection pressure. | Return read-only references or freeze objects instead of spreading on every access, or cache the array copies until state changes. |

---

## PER-035 — perf — `innomcp-node/src/services/responseComposer.ts` [MiniMaxAI/MiniMax-M3]
| severity | location | issue | fix |
|---|---|---|---|
| LOW | `composeThaiAnswer` L38 | `facts.map(...).filter(...)` allocates a new object per fact (spread) even for facts that survive both stages; on large `facts` arrays this is O(n) unnecessary allocations. | Use two passes: first `filter` on summary length, then `map` to wrap only survivors; or filter into a reused accumulator to avoid per-fact object cloning. |
| LOW | `composeThaiAnswer` L57–L58 | `for (const f of rendered)` builds `lines` via `Array.push` with repeated `String` concatenation in template literals; the intermediate `sourceLabel`/`conf` strings are always allocated even when empty, and `f.source` is read twice in the template. | Compute `conf`/`sourceLabel` only when non-empty (conditional), hoist the bullet string, and use a single template expression. Minor GC win on long fact lists. |
| LOW | `composeThaiAnswer` L45 | `usable.length === 0` early-return path is fine, but the `Date.now()` bracketing is still done; for a hot passthrough this is acceptable — no change required, noting for completeness. | n/a |
| INFO | `composeThaiAnswerWithLLM` L106 | Currently a passthrough stub, but the JSDoc promises a future LLM call guarded by `<= 1500ms` timeout. If implemented naively with `await fetch(...)` without `AbortController`, it becomes blocking I/O with no upper bound — risk of hanging the request. | When implementing, wrap the LLM call in `AbortController` + `setTimeout` (or `Promise.race` with a timeout promise), and ensure errors degrade to `composeThaiAnswer` (deterministic) rather than throwing. |
| INFO | `composeThaiAnswerWithLLM` L106 | `async` function that only delegates to a sync function returns a resolved Promise — every call site that `await`s it pays a microtask hop and the function name implies LLM usage that doesn't happen (misleading). | Either remove `async` and return `Promise.resolve(composeThaiAnswer(input))`, or clearly mark the stub `@deprecated` until wired up so callers don't assume LLM semantics. |
| LOW | `trimFact` L31 | `String(s || "")` coerces `null`/`undefined` to `""` but also coerces objects/arrays to their `toString()` — if `f.summary` is accidentally an object, it silently stringifies rather than rejecting, hiding upstream bugs. | If contract is `string`, assert `typeof s === "string"` and drop/return `""` for non-strings; document the invariant. |
| INFO | `composeThaiAnswer` L37 | `input.facts` is trusted; no upper bound on `facts.length`. A caller passing 10k+ facts allocates a large `lines` array and produces an oversized response (large payload downstream). | Add a guard (e.g. `facts.slice(0, MAX_FACTS)` with a reason tag like `truncated-facts:N`) and document the cap. Pair with a response-size cap on the joined string. |
| INFO | `composeThaiAnswer` output | `metadata` on `ToolFact` is explicitly "not currently rendered" but is still retained on the spread object and held in the closure-reachable `rendered` array for the lifetime of the call. Not a leak per call, but if callers retain the returned `ResponseComposerOutput` (e.g. in logs/tracing), `metadata` survives. | Strip `metadata` after `trimFact` (`const { metadata, ...rest } = f`) so the output object doesn't transitively retain large payloads; or document that `metadata` is not retained past composition. |
| LOW | `composeThaiAnswer` L38, L45 | No caching/memoization. Pure deterministic function over `(route, facts-content, header, footer)` — if the same fact set is composed repeatedly (e.g. per-request recomposition in a chat loop), work is redone. | Add a small LRU keyed by a hash of `facts + header + footer` (e.g. `crypto.createHash` or content fingerprint) with TTL; invalidate on input change. Keep TTL short to avoid stale Thai headers. |
| INFO | `composeThaiAnswer` L33, L84 | `Date.now()` is used for latency; for high-throughput callers this is fine, but the function is sync and called inline — any I/O on the LLM fallback path would block the event 
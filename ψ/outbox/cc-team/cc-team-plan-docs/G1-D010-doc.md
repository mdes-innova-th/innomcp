<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D010 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2049,"completion_tokens":463,"total_tokens":2512,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T11:20:39.106Z -->
- **`HealthStatusValue`** (type) — String literal union representing the three possible health states: `'healthy' | 'degraded' | 'unhealthy'`.

- **`HealthStatus`** (interface) — Result returned by a single health checker; includes a `status`, optional `message`, `details` object, and `latencyMs` of the check.

- **`HealthChecker`** (type) — Async function signature `() => Promise<HealthStatus>` used when registering a custom health check.

- **`AggregatedHealth`** (interface) — Combined health report from all checkers, including overall `status`, ISO `timestamp`, process `uptime`, per-check results (each augmented with `durationMs`), and a `summary` count by status.

- **`HealthAggregator`** (default export, class) — Singleton aggregator that runs all registered health checkers in parallel and returns a unified `AggregatedHealth` response. Built-in checkers for memory, event loop, and uptime are pre-registered on first construction. Obtain the instance via `HealthAggregator.getInstance()`.

  - **`getInstance()`** *(static)* — Returns the singleton `HealthAggregator`, lazily constructing it on first call. @returns the shared instance.

  - **`registerChecker(name, checker, timeoutMs?)`** — Registers an async `HealthChecker` under a unique `name` with an optional per-check `timeoutMs` (default 5000). Caveat: registers overwrite any existing checker with the same name and immediately invalidate the result cache.

  - **`check()`** — Executes every registered checker concurrently (each bounded by its own `timeoutMs`) and returns a freshly aggregated `AggregatedHealth`. Results are cached for 10 seconds (`CACHE_TTL_MS`); repeated calls within that window return the cached payload. Overall status is `unhealthy` if any check is unhealthy, else `degraded` if any are degraded, else `healthy`. @returns a promise resolving to the aggregated health report.

Note: the file's internal helpers (`runCheckerWithTimeout`, `memoryCheck`, etc.) and the second half of the source (truncated in the provided snippet, including the event-loop and uptime checkers) are not exported and therefore not part of the public API.

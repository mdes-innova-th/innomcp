_30 findings consolidated, 0 missing._

# TRIAGE — mega-errlog

> errlog lens (provider=0): Error-handling & logging audit: unhandled promise rejections, swallowed errors (

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## ERR-001 — errlog — `innomcp-node/src/services/agentLoop.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| High | `const toolSpecs: ToolSpec[] = tools.getToolSpecs();` (around line 80) | Unhandled promise rejection – if `getToolSpecs()` throws, the async generator throws on first iteration, resulting in an unhandled promise rejection that can crash the process. | Wrap the call in a try‑catch; on error, `yield { type: 'error', error: 'Failed to retrieve tool specs' }` and `return`. |
| High | Entire `while (step < maxSteps)` loop and surrounding body | No overall error boundary – any unexpected exception (e.g. from message construction, type mismatches) propagates as an unhandled rejection without yielding an error event. | Enclose the core logic inside `runAgentLoop` in a try‑catch that catches all exceptions, yields an `'error'` agent event with a sanitised message, and exits gracefully. |
| Medium | `catch (err)` blocks for the LLM call, `JSON.parse`, and tool execution (lines ~95, ~120, ~138) | Missing error context – the original error object is discarded after sanitising the user‑facing message; no diagnostic information is logged, making debugging extremely difficult. | Log the original error (after redacting any potential secrets) to a structured logger before yielding the sanitised event. Example: `logger.error({ err, message: 'LLM call failed' })`. |
| Medium | `await llm(messages, toolSpecs)` and `await tools.execute(name, input, { signal })` | Missing timeouts – neither call has a timeout; a hung LLM or tool will stall the agent loop indefinitely (unless cancelled by `signal`). | Wrap each call in a timeout race, e.g. `Promise.race([call, timeoutPromise])`, or create a per‑step `AbortSignal` with a timeout. On timeout, yield `{ type: 'error', error: 'LLM call timed out' }` (or tool timeout) and abort. |
| Medium | `yield { type: 'tool_call', ... }` and `yield { type: 'tool_result', ... }` (inside the tool‑call loop) | Potential PII/secrets exposure – tool inputs and outputs are yielded without sanitisation; if downstream consumers log or persist these events, secrets or PII may leak. | Apply a filtering/redaction layer to the yielded `input` and `output` fields (e.g. blacklist known secret keys) or clearly document that consumers must sanitise the data themselves. |

---

## ERR-002 — errlog — `innomcp-node/src/services/analyticsService.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `loadSnapshot` (`catch` block) | **Swallowed error & Missing error context**: The empty `catch {}` block silently ignores all exceptions. This masks critical issues like `JSON.parse` syntax errors (data corruption) or file permission errors, treating them identically to an expected missing file (`ENOENT`). | Differentiate error types. Log a `debug`/`info` message for `ENOENT` (expected on first run), and log an `error` with `filePath` and `error` context for `SyntaxError` or permission issues. |
| Medium | `saveSnapshot` | **Unhandled promise rejection & Missing error context**: `fs.mkdir` and `fs.writeFile` can fail (e.g., disk full, read-only filesystem). Without a `try/catch`, these throw raw system errors that may cause unhandled promise rejections if the caller doesn't catch them, lacking business context. | Wrap I/O operations in a `try/catch`. Log the failure with `filePath` and error details, then throw a custom, contextual error (e.g., `AnalyticsSnapshotSaveError`) to inform the caller. |
| Medium | `saveSnapshot` (`state` serialization) | **Secrets/PII in storage**: `activeSessions` stores raw `sessionId` strings which are written to disk in plaintext JSON. If session IDs contain or map to PII/sensitive user identifiers, persisting them in plaintext is a privacy risk. | Hash, mask, or anonymize `sessionId` values before persisting, or exclude `activeSessions` from the disk snapshot entirely if they are only required for in-memory runtime metrics. |
| Low | `saveSnapshot` & `loadSnapshot` | **Missing timeouts**: Node.js `fs.promises` operations can hang indefinitely in edge cases (e.g., stalled network drives, NFS mounts), which could block the promise chain and delay application shutdown or startup. | Wrap the `fs` promises with a timeout mechanism (e.g., `Promise.race` with a `setTimeout`, or `AbortSignal.timeout()` in Node 18+) to fail fast if I/O exceeds a safe threshold (e.g., 5000ms). |
| Low | Entire Module | **Inconsistent/Missing log levels**: The service handles critical metrics, state persistence, and error boundaries but lacks any logging framework integration. This results in zero operational observability for analytics tracking and snapshot lifecycle. | Inject a structured logger. Use `debug` for high-volume `track()` events, `info` for successful snapshot persistence, and `warn`/`error` for I/O failures and parsed data anomalies. |

---

## ERR-003 — errlog — `innomcp-node/src/services/answerContract.ts` [moonshotai/Kimi-K2.6]
The user wants an error-handling & logging audit of the provided TypeScript module `innomcp-node/src/services/answerContract.ts`.

 I need to analyze the code for:
 1. Unhandled promise rejections
 2. Swallowed errors (empty catch blocks)
 3. Missing error context
 4. Inconsistent log levels
 5. Secrets/PII in logs
 6. Missing timeouts

 Looking at the code:
 - It's a pure TypeScript module defining types and a pure function `buildAnswerContract`.
 - There are no async operations.
 - There are no try/catch blocks.
 - There are no logging statements (no console.log, no logger calls).
 - There are no network calls, database calls, or external I/O that would need timeouts.
 - There are no promise-based operations.

 However, I should still audit for potential issues:
 1. **Unhandled promise rejections**: None present, but if this code were used in an async context, errors thrown here (e.g., if params is null) could become unhandled if not caught by caller. But the code itself doesn't create promises.
 2. **Swallowed errors**: No catch blocks at all.
 3. **Missing error context**: No error handling/logging to add context.
 4. **Inconsistent log levels**: No logs exist.
 5. **Secrets/PII in logs**: No logs exist, but the `RetrievalSource` interface has `path` which could contain PII/secrets. If logged elsewhere, it's a risk. The `buildAnswerContract` function copies `sources` into the returned object, which includes `path`. If this contract is later logged, PII/secrets could leak.
 6. **Missing timeouts**: No async operations.

 Wait, I need to be careful. The audit is specifically about this file. Let me look closely:

 - `params.sources.map((s) => s.id)` - if `params.sources` is undefined, this throws. No validation.
 - `params.toolsUsed` - assumed to exist.
 - `params.route` - assumed to exist.
 - `Math.max(0, Math.min(1, params.confidence))` - if confidence is undefined, this becomes NaN (since Math.min(1, undefined) is NaN, Math.max(0, NaN) is NaN). This is a data integrity issue but not directly an error-handling/logging issue unless logged.

 Actually, looking at the prompt, they want a table with columns: severity | location | issue | fix.

 Since this file has no logging, no async code, no catch blocks, and no timeouts, the audit might come up mostly clean, but I should identify structural risks:

 1. **Missing input validation / silent data corruption**: `params.confidence` could be undefined leading to `NaN`. If this contract is passed to a logger later, `NaN` might be logged but more importantly, the function doesn't throw or log, it silently produces invalid state. However, the prompt specifically asks about: unhandled promise rejections, swallowed errors, missing error context, inconsistent log levels, secrets/PII in logs, missing timeouts.

 Let me reconsider if there are any implicit issues:
 - **Unhandled promise rejections**: Not applicable directly, but if callers use this in async chains and throw, they need to handle it. But that's not in this file.
 - **Swallowed errors**: None.
 - **Missing error context**: No errors are caught, so no context is added. But there are no errors being caught.
 - **Inconsistent log levels**: No logging.
 - **Secrets/PII in logs**: The `RetrievalSource.path` field could contain sensitive data. The `buildAnswerContract` function propagates `sources` (including `path`) and `memoryEntities` (could be PII) into the returned object. If the returned `AnswerContract` is logged downstream, this is a PII/secrets leak risk. This is a valid audit finding: "Potential PII/Secrets propagation - `path` and `memoryEntities` fields may contain sensitive data and are passed through without sanitization; if the contract is logged downstream, sensitive data may be exposed."
 - **Missing timeouts**: No async operations.

 Also, `new Date().toISOString()` relies on system clock. Not really a timeout issue.

 What about `params.sources.length` if `params.sources` is undefined? That would throw `TypeErro

---

## ERR-004 — errlog — `innomcp-node/src/services/artifactService.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| Medium | `listArtifacts` | **Unhandled rejection / Missing error context**: If `artifacts.listArtifacts` fails, the rejection bubbles up with no context, making it hard to determine which `taskId` failed. | Wrap in `try/catch`, log the error, and rethrow a custom error or append context: `catch (err) { throw new Error(\`Failed to list artifacts for task \${taskId}: \${err.message}\`, { cause: err }); }` |
| Medium | `getArtifact` | **Unhandled rejection / Missing error context**: Same as above. Additionally, if `artifact.content` is unexpectedly `undefined`, `Buffer.from` will throw a generic `TypeError` with no context about which artifact failed. | Wrap in `try/catch`. Validate `artifact.content` before passing to `Buffer.from`. Rethrow with context: `throw new Error(\`Failed to retrieve artifact '\${name}' for task '\${taskId}'\`, { cause: err });` |
| Medium | `listArtifacts`, `getArtifact` | **Missing timeouts**: No timeouts are applied to the underlying `artifacts` calls. If the utility hangs, this service will hang indefinitely, potentially stalling the event loop or worker. | Implement a timeout using `Promise.race` (e.g., `Promise.race([artifacts.getArtifact(...), timeout(5000)])`) or ensure the underlying `artifacts` utility enforces strict internal timeouts. |
| High | `getArtifact` | **Potential PII/Secrets in logs (Future Risk)**: `artifact.content` is converted to a buffer. If error handling is added later and the error or artifact is logged carelessly, sensitive data (PII, secrets, file contents) could leak into log streams. | Ensure any added logging strictly redacts or omits `artifact.content` and `buffer`. Only log identifiers like `taskId` and `name`. |
| Low | `getArtifact` | **Missing return type**: The function lacks an explicit return type, relying on inference. This can lead to accidental breaking changes in the router contract. | Add explicit return type: `Promise<{ name: string; mimeType: string; buffer: Buffer }>` |
| Low | `artifactService` | **Missing logging / Inconsistent log levels**: There are no log statements. Successful operations, failures, and latency metrics are completely invisible for observability. | Add structured logging (e.g., `logger.debug("Fetching artifact", { taskId, name })`) at the entry point and `logger.error(...)` in catch blocks before rethrowing. |

---

## ERR-005 — errlog — `innomcp-node/src/services/auditLogger.ts` [deepseek/deepseek-v4-pro]
| Severity | Location                                    | Issue                                                                                                                                                              | Fix                                                                                                                                                                                                                     |
|----------|---------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| High     | `private rotateIfNeeded()` – both catch blocks | Errors during file stat, rename, or rotation logic are silently swallowed (empty catch). Rotation may fail silently, leaving stale audit file or corrupted state.   | Log the error with context (e.g., operation and file paths) using `console.error` or a logger.                                                                                                                            |
| High     | `getEntries()` – inner catch for JSON.parse  | Malformed JSON lines are silently skipped without any warning. Data corruption remains hidden, causing loss of audit entries without alerting operators.            | Log a warning containing the file path and the offending line (or truncated) to facilitate investigation and repair.                                                                                                     |
| High     | `clear()` – catch blocks for `unlinkSync` and `writeFileSync` | File deletion or rewrite errors are completely ignored. The method may return an incorrect count and leave inconsistent state without any notification.            | Log each error with the file path and operation that failed; consider surfacing the error to the caller (e.g., throw or return a partial success indicator).                                                             |
| High     | `private getAllAuditFiles()` – catch block    | If reading the log directory fails (e.g., permissions), it silently returns an empty array. All subsequent operations (getEntries, clear, export) will act on no files, effectively losing all audit data. | Log the error and either rethrow or return a rejected promise/sentinel value; at minimum, log the error so the system can alert.                                                                                        |
| High     | `private readLines()` – catch block           | File read errors are silently treated as empty content. This can cause data loss during filtering or clearing operations when a file becomes inaccessible.         | Log the error with the file path, and decide on a safe fallback (e.g., skip the file with a warning) rather than pretending it's empty.                                                                                  |
| High     | `log()` – `details` field                     | The `details` property accepts arbitrary data and is written directly to the audit log without any sanitization. Secrets (tokens, passwords) or PII (emails, IPs) can end up in plaintext logs, violating security and privacy policies. | Implement a sanitization layer (e.g., redact known sensitive keys, mask patterns) before writing. Consider a configurable filter or allow callers to mark sensitive fields.                                                |
| Medium   | `log()` – error catch block                   | The error log lacks critical context (entry ID, action, user). When a write fails, it's hard to correlate the failure with a specific request.                    | Augment the `console.error` call with structured data: `{ entryId: auditEntry.id, action: e

---

## ERR-006 — errlog — `innomcp-node/src/services/backpressureHandler.ts` [deepseek/deepseek-v4-flash]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| **High** | `enqueue()` (line ~38) | **Missing timeout for task execution** – A hung task (e.g., never resolves/rejects) will occupy a concurrency slot forever, preventing new tasks and eventually stalling the queue. | Wrap `item.execute()` with a timeout promise (e.g., `Promise.race([execute(), timeoutPromise])`) and reject the deferred if the timeout fires. Expose configurable timeout. |
| **High** | `processNext()` (line ~78) | **Potential unhandled synchronous exception** – If `item.execute()` throws synchronously before returning a Promise, the `.then()` call itself will throw and crash the process. | Wrap the `item.execute()` call in a `try-catch` or use `Promise.resolve().then(() => item.execute())` to convert any synchronous throw into an async rejection. |
| **High** | Entire file | **No logging whatsoever** – Absence of logs makes it impossible to monitor backpressure events (overflow, task errors, queue occupancy) in production, hindering debugging and observability. | Add structured logging at key points: `enqueue` overflow (warn), task start/end (debug), task failure (error), drain/clear (info). Use a configurable logger (e.g., `pino`/`winston`). |
| **Medium** | `clear()` (line ~119) | **Drain promise may never resolve** – After `clear()`, if `running === 0` but the queue is emptied manually, `checkDrain()` is not called, leaving any pending `drain()` promises unresolved. | Call `this.checkDrain()` at the end of `clear()` to resolve any waiting drain promises. |
| **Medium** | `processNext()` (line ~89) | **Missing error context** – When rejecting a deferred task, only the raw error from `execute()` is passed; the task���s `id`, `sessionId`, and priority are lost. | Enrich the rejected error with task metadata (e.g., `new Error(`Task ${id} failed: ${originalError.message}`)`) or log the context before rejecting. |
| **Medium** | `enqueue()` (line ~35) | **Overflow rejection not logged** – The queue overflow is silently rejected; operators have no visibility into dropped requests. | Log a warning with queue size, max size, and rejected count before rejecting the promise. |
| **Low** | `setMaxConcurrent()` (line ~131) | **No validation of large values** – Setting `MAX_CONCURRENT` to an extremely high number could cause resource exhaustion. | Add a configurable upper bound and log a warning if the new value exceeds it. |
| **Low** | `drain()` (line ~109) | **No timeout for drain** – A drain promise could hang forever if tasks never complete, causing memory leaks or stuck shutdowns. | Implement a configurable timeout for the drain promise, rejecting with a `DrainTimeoutError` after the deadline. |

---

## ERR-007 — errlog — `innomcp-node/src/services/cacheManager.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `constructor` (`setInterval`) | **Unhandled Exception in Timer**: The `setInterval` callback executes `cleanupExpired()`. If an unexpected runtime error occurs during map iteration or node deletion, it will result in an unhandled exception that could crash the Node.js process or silently kill the timer. | Wrap the `this.cleanupExpired()` call inside the `setInterval` callback in a `try...catch` block. Log the caught error with context (e.g., `logger.error('Cache cleanup failed', { error })`). |
| Medium | Class-wide | **Missing Observability & PII/Secrets Risk**: There is no logging for cache lifecycle events (evictions, config changes, cleanup runs), making production debugging difficult. If logging is added naively, cache `value`s might be logged, leaking PII/secrets. | Inject a structured logger. Add `debug`/`info` logs for `configure()` and eviction events. **Crucial**: Only log cache `key`s and metadata; explicitly exclude `value`s from logs to prevent PII/secret leakage. |
| Medium | `size()`, `stats()` | **Event Loop Blocking (Timeout Risk)**: `size()` synchronously calls `cleanupExpired()`, which iterates over the entire map. `stats()` calls `size()`. On large caches, this blocks the event loop, potentially causing HTTP/RPC timeouts in the broader application. | Decouple `size()` from `cleanupExpired()`. Simply return `this.entries.size`. Rely on the background interval for expiration, or maintain a separate counter for active/expired items to avoid O(N) blocking. |
| Low | `set()` | **Missing Input Validation & Error Context**: `ttlMs` is not validated. Passing `NaN`, `Infinity`, or negative numbers causes silent failures (e.g., immediate expiration) without throwing an error or providing debugging context. | Add validation: `if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error(\`Invalid TTL: \${ttlMs}\`)`. This provides immediate error context for misconfigured cache calls. |

---

## ERR-008 — errlog — `innomcp-node/src/services/coldRetriever.ts` [moonshotai/Kimi-K2.6]
| severity | location | issue | fix |
|---|---|---|---|
| **High** | `loadCorpus` — `const files = this.listFiles(corpusDir)` | **Unhandled promise rejection:** `listFiles` is not awaited inside an async function. If it returns a Promise, the loop iterates over Promise properties and any rejection becomes unhandled. | `await this.listFiles(corpusDir)`; ensure the method is async and wrap in try/catch. |
| **High** | `loadCorpus` — `fs.existsSync(corpusDir)` | **Unhandled promise rejection:** `corpusDir` may be `null`/`undefined`, causing a synchronous `TypeError` *before* the loop’s try/catch, rejecting the async method promise without context. | Validate `corpusDir` at method entry (`if (!corpusDir) throw new DomainError(...)`); wrap initial checks in the same try/catch block. |
| **Medium** | `loadCorpus` — `catch (err) { ... }` | **Swallowed error:** per-file read failures are logged but not propagated; caller receives success metrics unaware of partial failure. | Aggregate failures into the return value (`errors: Array<{file, reason}>`) or throw an aggregated error after the loop finishes. |
| **Medium** | `loadCorpus` — `catch` block (`console.warn(..., err)`) | **Missing error context:** raw `Error` object is passed to `console.warn` without structured fields, correlation ID, or guaranteed serialization for log aggregators. | Use a structured logger with fields `{ component: 'ColdRetriever', file, error: err.message, stack: err.stack, correlationId }`. |
| **Medium** | `loadCorpus` — `fs.readFileSync` / `fs.statSync` | **Missing timeouts:** synchronous file I/O can block the event loop indefinitely on FIFO pipes, large files, or slow network drives. | Replace with `fs.promises.readFile` + `AbortSignal` / `Promise.race(timeout)`; enforce a max-file-size guard. |
| **Low** | `loadCorpus` — multiple `console.*` calls | **Inconsistent log levels:** ad-hoc `console.warn` and `console.log` with no level filtering, no logger abstraction, and no sampling. | Inject a typed logger interface (e.g., `ILogger`) and use `logger.warn` / `logger.info` consistently across the service. |
| **Low** | `loadCorpus` — `catch` block | **Secrets / PII disclosure:** raw error objects may leak absolute file paths or internal stack traces; logged paths may reveal sensitive directory structures. | Sanitize logs: emit only relative paths and log `err.message` (string) instead of the raw `err` object. |
| **Medium** | `search` — method body | **

---

## ERR-009 — errlog — `innomcp-node/src/services/contextManager.ts` [deepseek/deepseek-v4-pro]
```text
| severity | location                                      | issue                                                                                                      | fix                                                                                               |
|----------|-----------------------------------------------|------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| Low      | Entire module (all public methods)            | No error handling or logging implemented; runtime errors (e.g. from invalid input like `undefined` content) would lack context and propagate uncaught. | Add try‑catch with structured logging (include sessionId, message summary) in core methods. Validate inputs before processing. |
```

---

## ERR-010 — errlog — `innomcp-node/src/services/dataAnalysisTool.ts` [MiniMaxAI/MiniMax-M3]
# Error-Handling & Logging Audit: `dataAnalysisTool.ts`

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| 🔴 High | `analyzeData` (file-read branch) — `await fs.readFile(safePath, "utf-8")` | **Unhandled rejection / no logging.** `ENOENT`, `EACCES`, or `EISDIR` bubbles up as an opaque rejection. No log line, no context (path, workspace root) attached, making root-cause analysis in production impossible. | Wrap with `try/catch`, log structured error at `error` level with `safePath`, `input.path`, and `err.code`, then rethrow an `Error` with augmented message (e.g., `Failed to read dataset at ${safePath}: ${err.message}`). |
| 🔴 High | `analyzeData` — `await fs.mkdir(dir, { recursive: true })` and `await fs.writeFile(artifactPath, ...)` | **Unhandled rejection on artifact write.** Disk-full / permission errors crash the caller. Chart result (`chartSvg`) is silently lost if write fails partway. No log emitted. | Wrap in `try/catch`, log at `error` with `artifactPath` + `err.code`, and either (a) return `chartSvg` in the result with `artifactPath: undefined`, or (b) rethrow a typed `ArtifactWriteError`. |
| 🔴 High | `parseCSV` | **No error handling for malformed CSV.** Mismatched column counts, unterminated quotes, or non-UTF-8 BOM produce silently corrupted `rows` (e.g., last cell absorbs remainder). No logging, no validation. Caller cannot distinguish "empty dataset" from "parser failure". | Validate row length against `headers`; on mismatch, log a `warn` with row index and either (a) pad/truncate or (b) throw a `CsvParseError` listing the offending line number. Strip BOM (`text.replace(/^\uFEFF/, '')`) and detect unterminated quotes. |
| 🟠 Medium | `analyzeData` — file read path | **Missing timeout / size guard.** `fs.readFile` on a hostile/large CSV can OOM the process. No upper bound enforced. | Add `opts.maxBytes` (e.g., 50 MB), check `text.length` after read, or stream-parse with a size cap. Wrap read in `Promise.race` with a timeout (`AbortController`) and log `warn` on timeout. |
| 🟠 Medium | `analyzeData` — `input.path` handling | **Path-traversal check is weak** (`startsWith` is case-sensitive and vulnerable on Windows; also doesn't normalize). Throws plain `Error("Path outside workspace")` with no logging → caller has no audit trail of traversal attempts. | Use `path.relative(input.workspaceRoot, safePath)` and check it doesn't start with `..` or be absolute; also `path.resolve` is fine but compare `safePath === path.resolve(workspaceRoot, rel)`. Log a `warn` (or `error` — security signal) with sanitized path on rejection. |
| 🟠 Medium | `analyzeData` — numeric column detection | **Silent NaN/precision loss.** `cellVals.map(Number).filter(n => !isNaN(n))` drops non-numeric cells without logging. On a mixed-type column, the `>0.7` heuristic may misclassify with no diagnostic. | Log at `debug` level when cells are excluded; if misclassification is detected later (e.g., `stdDev` is `NaN` due to empty `numVals`), downgrade to `string` type and log `warn` with the column name. |
| 🟠 Medium | `numStats` — `vals.length === 0` | **Returns empty object silently.** Caller proceeds with `unique: 0` and no min/max; downstream `summary` builder stringifies `undefined` as "undefined" → `min=undefined, max=undefined`. | Either return a sentinel like `{ min: NaN, max: NaN, ... }` with a clear contract, or log `warn("numeric column had no values", { column })` and let the caller decide. |
| 🟠 Medium | `analyzeData` — `summary` builder | **Stringifies `undefined`/`NaN` into user-visible output.** `min=${c.min}` produces `min=undefined` when stats are missing. No log flagging malformed output. | Use a formatter helper: `fmt(c.min) ?? "n/a"`. Log `warn` when any numeric column lacks stats so the issue is traceable. |
| 🟡 Low | Whole module | **No logging instrumentation at all.** There is no `logger` import, no structured-log calls, and no log-level convention. All errors above lack severity context. |

---

## ERR-011 — errlog — `innomcp-node/src/services/eventBus.ts` [deepseek/deepseek-v4-flash]
Here is the error-handling & logging audit for the `EventBus` module, presented in the requested table format.

| Severity | Location (lines) | Issue | Fix |
|----------|----------------|-------|-----|
| **High** | `emit()` (line ~27-33) | **Unhandled promise rejections** – if a handler is `async` and rejects, the `try/catch` only catches synchronous errors; the rejected promise is never awaited or handled, causing an unhandled promise rejection. | Wrap `handler(data)` in `Promise.resolve().then(() => handler(data)).catch(...)` or await the handler if synchronous assumptions cannot be guaranteed. For example: `handlers.forEach((handler) => { Promise.resolve(handler(data)).catch((error) => { console.error(...); }); });` |
| **High** | `once()` (line ~43-48) | **Handler not removed on error** – if the provided `handler` throws synchronously, the `onceWrapper` exits before calling `this.off()`, leaving the handler permanently registered. For async handlers, the same unhandled rejection issue applies, plus the wrapper never removes itself. | Inside `onceWrapper`, wrap the handler call in a `try/catch` and ensure `this.off()` is called even on error (e.g., `try { handler(data); } finally { this.off(event, onceWrapper); }`). Also handle async rejections with `.catch()`. |
| **Medium** | `emit()` (line ~32) | **Missing error context** – logged errors do not include the event name, the failing handler, or the event data (e.g., sessionId). This makes debugging difficult in production. | Include context in the log: `console.error(`[EventBus] Error in handler for "${String(event)}"`, { handler: handler.name || 'anonymous', data, error })`. |
| **Low** | Entire file | **Inconsistent log levels** – uses bare `console.error` instead of a centralized logger (e.g., `winston`, `pino`). If the rest of the application uses structured logging, this breaks consistency and makes log aggregation harder. | Inject a logger instance (e.g., via constructor or dependency injection) and use `this.logger.error(...)` with structured fields. Default to `console.error` only as fallback. |
| **Low** | `once()` (line ~43-47) | **Potential memory leak from unremoved handlers** – as described above, failing to remove the wrapper on error retains the handler, which can accumulate over time. | Fix the error handling in `onceWrapper` (as above) to always remove itself. |

**Additional note:**  
While not explicitly listed, the `emit` method does not log the event data, which could be a **PII risk** if the data (e.g., `text` in `'message:sent'`) is highly sensitive. However, the current code does *not* log the data, so this is not a violation—but it is a best practice to ensure no accidental leakage in future modifications.

---

## ERR-012 — errlog — `innomcp-node/src/services/fastPathHandler.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| **High** | `tryReadExtraFromUrl`<br>(`catch` block) | **Swallowed error (empty catch):** Network, timeout, and JSON parsing errors are silently ignored. This makes debugging external phrase fetching impossible. | Log the error with context: `catch (e) { logger.warn(\`[FastPath] URL fetch failed for \${url}: \${e.message}\`); return {}; }` |
| **High** | `handleFastPathMessage`<br>(`logger.debug`) | **Secrets/PII in logs:** Raw user input (`text.slice(0, 50)`) is logged. User prompts may contain sensitive PII, passwords, or secrets. | Remove raw text from logs. Log only the `intent.reason` or a sanitized/hashed identifier instead of the raw payload. |
| **Medium** | `handleFastPathMessage`<br>(`checkRateLimit`) | **Unhandled promise rejection & missing timeout:** `await checkRateLimit` can throw (e.g., Redis down) or hang, crashing the flow or violating the <1s latency SLA. | Wrap in `try/catch` to fail-open (allow request) on errors, and enforce a strict timeout (e.g., 50ms via `Promise.race`) to prevent blocking. |
| **Medium** | `tryReadExtraFromFile`<br>(`fs.readFileSync`) | **Event loop blocking:** Synchronous file I/O (`readFileSync`) blocks the Node.js event loop, causing latency spikes for all concurrent requests and violating `maxWorkMs`. | Replace with asynchronous `await fs.promises.readFile(filePath, "utf-8")` to prevent blocking the event loop. |
| **Medium** | `tryReadExtraFromUrl`<br>(`setTimeout`) | **Inconsistent timeout / SLA violation:** The fetch timeout is 1,500ms, which vastly exceeds the strict `maxWorkMs` (default 15ms) latency guard, defeating the fast path purpose. | Reduce the `setTimeout` value to align with `maxWorkMs` (e.g., 50ms) or pass `opts.maxWorkMs` to enforce the fast path SLA. |
| **Medium** | `getExtraPhrases`<br>(`await` calls) | **Missing overall timeout:** Sequentially awaits file and URL reads without an overall timeout, potentially exceeding `maxWorkMs` despite the "do not block" comment. | Use `Promise.all` for parallel execution and wrap in a timeout utility bounded by `opts.maxWorkMs` to guarantee fast-path exit. |
| **Low** | `getExtraPhrases`<br>(`logger.debug`) | **Inconsistent log levels:** Logs an SLA violation (duration > 20ms exceeds 15ms `maxWorkMs`) as `debug`, hiding performance degradation in production. | Change `logger.debug` to `logger.warn` when `dur > (opts.maxWorkMs ?? DEFAULT_OPTS.maxWorkMs)` to properly alert on SLA breaches. |
| **Low** | `tryReadExtraFromFile`<br>(`catch` block) | **Missing error context:** The warning log omits the `filePath` that failed to parse, hindering troubleshooting when multiple files are configured. | Include the file path in the log message: `logger.warn(\`[FastPath] extraPhrasesFile parse failed for \${filePath}: ...\`)` |

---

## ERR-013 — errlog — `innomcp-node/src/services/generalGate.ts` [deepseek/deepseek-v4-pro]
```markdown
| severity | location | issue | fix |
|----------|----------|-------|-----|
| NONE | innomcp-node/src/services/generalGate.ts | No unhandled promise rejections, swallowed errors, missing error context, inconsistent log levels, secrets/PII in logs, or missing timeouts found. The module contains only pure synchronous functions with no I/O, no logging calls, and no risk of leaking secrets. | No change required. |
```

---

## ERR-014 — errlog — `innomcp-node/src/services/healthAggregator.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| **High** | `runCheckerWithTimeout` | **Unhandled promise rejection**: If `checker()` resolves before the timeout, the timeout promise rejects later with no handler, crashing the process in Node.js ≥ 15. | Store the timeout ID and call `clearTimeout()` immediately after `Promise.race` settles. |
| **High** | `runChecker

---

## ERR-015 — errlog — `innomcp-node/src/services/hotRetriever.ts` [MiniMaxAI/MiniMax-M3]
```markdown
| severity | location | issue | fix |
|---------|----------|-------|-----|
| MEDIUM | `normalizeWeatherFacts` (lines 14–68) | No try/catch — a malformed `toolResult` (e.g., circular refs in `raw`, `JSON.stringify` throws on circular structures) crashes the caller with no logging or recovery. | Wrap body in `try { ... } catch (err) { logger.warn({ err, query }, "weather normalization failed"); return []; }`. Avoid `JSON.stringify` on `raw`; store a shallow clone instead, or wrap stringify in its own try/catch. |
| MEDIUM | `normalizeEvidenceFacts` (lines 73–105) | Same crash risk: no error handling around `JSON.stringify(data)` or unexpected `toolResult` shapes. | Add `try/catch`, log with `logger.warn({ err, isp, query }, "evidence normalization failed")`, return `[]`. |
| MEDIUM | `normalizeDeterministicFact` (lines 110–134) | `String(result)` can throw for objects with throwing `toString()`; `nextFactId` is called even on failure path. | Add `try/catch`, log context `{ domain, toolName, query }`, return a fallback fact with `confidence: 0` and `content: ""` so downstream still gets a fact slot. |
| MEDIUM | All `JSON.stringify` call sites (lines 47, 62, 96) | `JSON.stringify` silently fails on circular references and `BigInt`, producing `undefined` and a fact with empty `content` — no log, no detection. | Replace `JSON.stringify(x)` with a `safeStringify(x)` helper that catches `TypeError`, logs at `debug` level, and returns `'[unserializable]'`. |
| LOW | `normalizeWeatherFacts` — empty/short `query` | When `query` is empty, `extractWeatherEntities` returns `[]` silently; downstream consumers may treat empty entities as a valid match. | Log at `debug` level when extraction yields zero entities for a non-empty weather result. |
| LOW | `extractISP` (line 184) | Returns `null` silently on no match; callers (e.g., `normalizeEvidenceFacts`) fall back to `"all"`, masking query-parsing bugs. | Add `logger.debug({ query }, "no ISP matched in query")` before returning `null` (use a configurable logger to keep hot-path overhead low). |
| LOW | `composeFactSummary` (lines 165–177) | Truncation at 500 chars is silent — no indication that content was cut, and the `...` suffix is indistinguishable from literal content in the data. | Append a structured marker (e.g., `[truncated:${originalLength}]`) and optionally `logger.debug` the truncation event with the fact id. |
| LOW | `mergeRetrievalFacts` (lines 139–154) | Silent dedup by `id` — if two distinct facts share an `id` (e.g., `factCounter` collision after process restart, or shared `nextFactId` domain), the second is dropped without trace. | On duplicate, `logger.debug({ droppedId, domain }, "duplicate fact id, skipping")`. Consider switching to `(domain, content-hash)` ids to make collisions unlikely. |
| LOW | Module-level `factCounter` (line 19) | Non-atomic, non-persistent counter; counter resets on process restart, and concurrent async calls can produce identical ids in the same tick. | Use `crypto.randomUUID()` for `id` generation, or at minimum `globalThis.crypto.randomUUID()`. Drop the mutable counter. |
| LOW | `extractWeatherEntities` regex (line 178) | Regex literal compiled on every call; no `i`/`g` flag issues, but case-folding of Thai strings is unreliable (Thai has no case). | Precompile patterns to module-level `const` to avoid per-call recompilation and document the no-case-fold assumption. |
| INFO | Whole file | Zero logging — no `logger` import, no observability hooks. Makes production incidents un-diagnosable. | Add a `logger` parameter or import a shared `pino`/`winston` instance; log normalize-entry at `debug`, errors at `warn`/`error`, with `{ domain, toolName, factCount }` context. Never log the `raw` field directly (may contain PII / secrets). |
| INFO | `raw: item` / `raw: results` / `raw: data` / `raw: result` (lines 44, 65, 100, 131) | `raw` payloads from external tools may contain PII (user IDs, IPs in evidence) or secrets (API keys in error

---

## ERR-016 — errlog — `innomcp-node/src/services/imageGenService.ts` [deepseek/deepseek-v4-flash]
| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| **Medium** | `callPollinations()` (lines 86–90) | Empty `catch` block swallows HEAD request errors entirely – no logging, no rethrow. | Log a warning with the error message before proceeding: <br>`logBoth("warn", `[ImageGen] Pollinations HEAD failed: ${err?.message}`);` (or `debug` level). |
| **Low** | `callImageGen()` gateway catch (line ~137) | Error context is limited to `err?.message`; no stack trace or additional details (e.g. prompt, elapsed time). | Log the full error object: <br>`logBoth("warn", `[ImageGen] Gateway failed: ${err}`);` <br>or include more structured context (e.g. `originalPrompt` truncated). |
| **Low** | `callImageGen()` pollinations catch (line ~146) | Same as above – only `err?.message` logged. | As above, log the full error or add relevant context (e.g. provider prompt). |
| **Info** | `buildPollinationsUrl()` (line 45) | No missing timeouts; HEAD request uses `AbortSignal.timeout(5000)`. | No action needed. |
| **Info** | `callGateway()` (line 50–80) | Gateway URL redacted in log (`replace(/\/\/[^/]*/, "//***")`) – good practice. Token never logged. | No action needed. |
| **Low** | `callPollinations()` (line 86–90) | Swallowing 404/network errors may cause the caller to receive a broken image URL silently. | Log the error (as above) and consider returning a placeholder or propagating the error if the HEAD check consistently fails. |

**Key observations:**  
- No unhandled promise rejections – all async paths are caught.  
- The only **swallowed error** is the empty `catch` in `callPollinations`; fix by adding a log statement.  
- Error contexts are minimal – logging only `err?.message` loses stack traces and other diagnostics.  
- Log levels are consistent (`info` for success, `warn` for fallback, `error` for total failure).  
- Secrets/PII are not leaked in logs (URL redacted, tokens omitted).  
- Timeouts exist for all network calls (gateway `AbortController` + timer, HEAD `AbortSignal.timeout`).

---

## ERR-017 — errlog — `innomcp-node/src/services/intentClassifier.ts` [deepseek/deepseek-v4-pro]
| severity | location                               | issue                                                                                                                                | fix                                                                                                                                                                                                                              |
|----------|----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| low      | `classifyIntent()` in `intentClassifier.ts` | No logging or observability for intent classification decisions, making it difficult to monitor behavior and debug misclassifications. | Add an injected or module-level logger (e.g., `pino`, `winston`) and emit a `debug`-level log entry after classification, including the final `intent`, `reasons`, and a sanitised message excerpt (no PII). Example: `logger.debug({ intent, reasons, messageSnippet: message.slice(0, 100) }, 'Intent classified')`. |

---

## ERR-018 — errlog — `innomcp-node/src/services/leaderboardMetrics.ts` [moonshotai/Kimi-K2.6]
The user wants an error-handling & logging audit of the provided TypeScript module `leaderboardMetrics.ts`. I need to output a table with columns: severity | location | issue | fix |.

Let me analyze the code for the specific issues mentioned:
1. Unhandled promise rejections
2. Swallowed errors (empty catch)
3. Missing error context
4. Inconsistent log levels
5. Secrets/PII in logs
6. Missing timeouts

Let me go through the code carefully.

**1. `persistLeaderboardStats` function:**
```typescript
function persistLeaderboardStats(operation: () => void | Promise<void>): void {
  if (process.env.NODE_ENV === "test") return;
  setImmediate(() => {
    Promise.resolve(operation()).catch(() => {
      // DB unavailable - in-memory stays authoritative
    });
  });
}
```
- Issue: Empty catch block swallowing errors. No logging at all. Missing error context (what failed?).
- Also: `setImmediate` doesn't have a timeout, but that's not exactly a "missing timeout" in the traditional sense. However, the DB operations inside could hang indefinitely because there's no timeout on the DB connection/query.
- Actually, looking at `withDbConnection` usage - if `withDbConnection` doesn't have internal timeouts, then DB operations could hang forever.

**2. `recordProviderCall` function:**
```typescript
  persistLeaderboardStats(() => {
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO provider_stats (provider_id, requests, successes, total_latency)
         VALUES (?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           requests      = requests + 1,
           successes     = successes + VALUES(successes),
           total_latency = total_latency + VALUES(total_latency),
           last_seen     = NOW()`,
        [providerId, success ? 1 : 0, latencyMs]
      );
    }).catch(() => {
      // DB unavailable — in-memory stays authoritative
    });
  });
```
- Issue: Nested empty catch. The inner `withDbConnection(...).catch(() => {})` swallows errors silently.
- Issue: The outer `persistLeaderboardStats` also has a catch. So errors are swallowed at two levels.
- Issue: `providerId` is inserted into DB. If `providerId` contains sensitive info? Probably not PII but could be identifying. Not necessarily a secret/PII issue unless providerId is sensitive. I'll skip unless obvious.
- Issue: No timeout on DB operations. `withDbConnection` and `conn.query` don't specify query timeouts. If DB hangs, the connection/promise may never resolve, causing resource leaks and unhandled promises (though wrapped in setImmediate, the process might keep running).

**3. `recordProviderWin` function:**
The code is truncated but we can see:
```typescript
  persistLeaderboardStats(() => {
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO provider_stats (provider_id, wins)
         VALUES (?, 1)
         ON DUPLICATE KEY UPDATE wins = wins + 1`,
        [pr
```
- Same issues as above: empty catch (implied by pattern), missing error context, missing timeouts.

**4. Missing error context:**
- All catch blocks are empty or have generic comments. No error object is logged, no stack trace, no providerId in the log context.

**5. Inconsistent log levels:**
- There are no logs at all in this file! So technically there are zero log levels, which is inconsistent with any logging strategy. But the prompt asks for "inconsistent log levels". Since there are no logs, maybe I should note "missing logs" or "no error logging". But the prompt specifically lists "inconsistent log levels" as something to check. If there are no logs, there are no levels to be inconsistent. However, the complete absence of logging for DB failures could be framed as "silent error swallowing" rather than inconsistent levels. I'll focus on the empty catches.

Wait, let me reconsider. The prompt says: "Error-handling & logging audit: unhandled promise rejections, swallowed errors (empty catch), missing error context, inconsistent log levels, secrets/

---

## ERR-019 — errlog — `innomcp-node/src/services/mcpClient.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| **High** | `isAvailable()` | **Swallowed error** — empty `catch` returns `false` with zero diagnostic info; impossible to distinguish timeout, DNS failure, connection refused, or server error | Log the caught error (at `warn`/`debug` level) before returning `false`; optionally return a richer type `{available: boolean, reason: string}` |
| **High** | `callTool()` catch block | **Lost error context** — only `message` and `status` are preserved; `name` is destructured but never used; stack trace is discarded entirely, making production debugging very difficult | Preserve `name` and `stack` in the returned `McpToolResult` (add `errorName?: string` / `errorStack?: string` fields); or at minimum include `e.name` in `lastError` |
| **High** | Entire module | **Zero logging** — retries, final failures, timeouts, and successful calls are all invisible in production; no way to observe retry storms or degradation | Inject an optional logger (`console` by default); emit `warn` on each retry, `error` on final failure, `debug` on success; include attempt count and latency |
| **Medium** | `requestOnce()` error construction | **PII/secrets in error message** — raw response body (up to 500 chars) is embedded verbatim in the `Error` message; server responses may contain tokens, user data, or internal details | Sanitize/redact known sensitive fields before embedding; truncate to a shorter limit (e.g. 200 chars) and append `[truncated]`; consider logging the full body separately at `debug` level only |
| **Medium** | `safeReadText()` | **Swallowed error** — empty `catch` silently discards body-read failures; caller cannot tell if the body was empty vs. unreadable | Log at `debug` level; return a sentinel like `"[body read failed]"` instead of `""` so callers know the read failed |
| **Medium** | `callBatch()` | **No overall batch timeout** — `Promise.all` waits for the slowest individual call, which can be `timeout × (1 + maxRetries)` per item with no ceiling across the batch | Accept an optional `batchTimeoutMs`; wrap `Promise.all` in `Promise.race` with a timeout; reject remaining in-flight calls via `AbortController` |
| **Medium** | `callTool()` catch block | **`e.name` destructured but unused** — dead code suggests incomplete error classification; error type info (e.g. `AbortError`, `TypeError`) is thrown away | Use `e.name` to enrich the returned result (add `errorType` field) or remove the dead destructuring |
| **Low** | `safeReadText()` | **`.slice(0, 500)` can split a multi-byte UTF-8 sequence**, producing mojibake in the error message | Use a character-boundary–safe truncation: `[...str].slice(0, 500).join('')` or `str.substring(0, str.indexOf(' ', 500))` |
| **Low** | `getDefaultMcpClient()` | **Singleton created with no options** — `MCP_SERVER_URL` from env is used raw; if it contains embedded credentials (`http://user:pass@host`) they propagate silently and could leak via error messages | Parse and strip any embedded credentials from the URL before assigning to `baseUrl`; validate URL format |
| **Low** | Entire module | **No request/correlation IDs** — error messages contain no trace ID, making it impossible to correlate a failed MCP call with the upstream request that triggered it | Accept an optional `requestId` / `traceId` in `callTool`/`callBatch`; include it in all error messages and log entries |
| **Low** | `McpToolResult` interface | **No error type/code field** — callers can only branch on the `error` string, not on a machine-readable error category (network vs. timeout vs. 4xx vs. 5xx) | Add `errorCode?: 'TIMEOUT' \| 'NETWORK' \| 'CLIENT_ERROR' \| 'SERVER_ERROR'` to `McpToolResult`; set it in `callTool` based on the caught error's type and status |

---

## ERR-020 — errlog — `innomcp-node/src/services/mdesModelCache.ts` [MiniMaxAI/MiniMax-M3]
# Error-Handling & Logging Audit: `mdesModelCache.ts`

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| **High** | `getModels` — `catch` block, line ~42 | **No request timeout** on `fetch(MDES_OLLAMA_URL/...)`. A hung TCP connection (e.g., MDES endpoint down) will block indefinitely, blocking callers in `warmUp` and any request that hits a stale/empty cache. | Wrap the fetch with `AbortController` + `setTimeout` (e.g., 5–10s). Reject with a descriptive `TimeoutError`. Pattern: `const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000); try { await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(t); }` |
| **High** | `getModels` — `catch` block, line ~42 | **Swallowed error context** when stale cache is returned. `console.warn("Failed to refresh model cache, using stale cache:", error)` logs the raw `Error` object via Node's default util-inspect; stack/cause/response body are lost, making triage difficult. | Log structured fields: `console.warn({ event: "mdes_cache.refresh_failed", url: MDES_OLLAMA_URL, status: error.status, cause: error.message, cacheAgeMs: now - this.lastFetch }, "Falling back to stale cache")`. If using a logger, use a dedicated level (e.g., `logger.warn`) with a stable event code. |
| **High** | `getModels` — `throw` at end of `catch` | **No timeout / no `AbortError` differentiation**. A timeout and a 500 are conflated; the same generic "Failed to fetch" message hides root cause. | Differentiate: `if (error.name === "AbortError") throw new Error("MDES Ollama request timed out")`; otherwise preserve `response.status` from the thrown error and include it in the message. |
| **High** | `getModels` — rethrown error | **Error loses HTTP context.** The original `response.status` (e.g., 401/403/500/503) is dropped; callers cannot distinguish auth vs. outage vs. rate-limit. | Throw a custom error class carrying `status`, `url`, and the response snippet: `throw new MDESFetchError(message, { status: response.status, url })`. Catch this specific type upstream. |
| **High** | `response.json()` (line ~36) | **Unvalidated payload** — `OllamaTagsResponse` is trusted. Malformed JSON or missing `models` could throw a `TypeError` caught generically, masking payload issues. | Validate: `if (!data || !Array.isArray(data.models)) throw new Error("Unexpected MDES /api/tags schema")`. Optionally use a schema validator (zod/ajv). |
| **Medium** | `getModels` — `console.warn` | **Inconsistent log levels & unstructured logging.** Mixes `console.warn` with throwing errors; no level for success, no level for the no-cache-available throw path. | Introduce a module-level logger with explicit levels: `logger.debug("cache hit")`, `logger.warn({...}, "stale cache used")`, `logger.error({...}, "fetch failed and no cache")`. Be consistent across the file. |
| **Medium** | `getBestModelForTask` — `parseInt(m.details.quantization_level, 10)` | **Silent `NaN` swallowed by `\|\| 0`.** If `quantization_level` is e.g. `"Q4_0"`, `parseInt` returns `NaN`, coerced to `0`. The `fast` heuristic then produces a misleading score with no warning. | Use `Number.parseInt(..., 10)` and explicitly check `Number.isFinite(q)`; log a debug message when the value is non-numeric. Consider mapping known strings (`Q4_0`, `Q5_K_M`, …) to bits-per-weight directly. |
| **Medium** | `getBestModelForTask` — `reasoning` fallback at the bottom | **Untracked generic fallback.** When no model is ≥7B, the function silently falls through to "largest overall", which may be a small model if all are sub-7B. No log/visibility for the operator. | Log at `info` level when the fallback path is taken, e.g., `logger.info({ task, available: models.map(m => m.details?.parameter_size) }, "no 7B+ model; using largest overall")`. |
| **Medium** | `getBestModelForTask` — empty models | **Throws plain `Error("No models available")`.** No context about whether this came from a network failure or an empty remote list. | `throw new

---

## ERR-021 — errlog — `innomcp-node/src/services/memoryRagHook.ts` [deepseek/deepseek-v4-pro]
| severity | location                                                          | issue                                                                                                       | fix                                                                                                                                                                                                                                                      |
|----------|-------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| high     | `memoryRagHook.ts:initMemoryRag()`                                | Unhandled promise rejection — `coldRetriever.loadCorpus` may throw, and the caller may not catch it.        | Wrap the `loadCorpus` call in a try‑catch block; log the error with context (corpusDir), ensure `initialized` remains `false`, re‑throw or return a safe fallback (e.g., `{ docCount:0, chunkCount:0 }`).                                                |
| medium   | `memoryRagHook.ts:recordTurnAndGetMeta()`                         | No try‑catch around `sessionMemory.recordTurn()`, `planRetrieval()`, etc. Errors propagate without any logging context (sessionId, query, route). | Add a try‑catch around the entire body, log the error with context (sessionId, query, route, toolsUsed), and return a fallback `MemoryRagMeta` object to prevent a crash.                                                                                |
| medium   | `memoryRagHook.ts:queryColdRag()`                                 | No error handling for `coldRetriever.search(query, …)`. A thrown exception goes unlogged and silently fails. | Wrap the `search` call in a try‑catch; log the error with query and domain, then return an empty `{ context: "", docCount:0, sources:[] }`.                                                                                                              |
| medium   | Entire module (esp. `initMemoryRag`, `queryColdRag`)              | Missing timeouts — long‑running operations like `loadCorpus` or `search` can hang indefinitely.              | Implement a timeout pattern (e.g., `Promise.race` with a `setTimeout`). Log and handle timeouts gracefully, e.g., return a degraded state and `console.warn`.                                                                                            |
| low      | `memoryRagHook.ts:initMemoryRag()` (log)                          | Only `console.log` is used for success; error and warning logs are absent. Log levels are inconsistent.     | Adopt structured logging: use `console.error` for caught errors, `console.warn` for recoverable situations, and keep `console.log` for infrequent diagnostics. Consider a logger abstraction to unify level, format, and optional PII scrubbing.         |
| low      | `memoryRagHook.ts:enrichGroundedContract()` (implicit assumption) | Potential runtime error if `ragMeta.coldContext` is not a string (currently always string, but fragile).    | Add a guard: `typeof ragMeta.coldContext === 'string' ? ragMeta.coldContext.length > 0 : false`. This makes the code defensive against future refactors.                                                                                                 |
| low      | Entire module (potential future risk)                             | No sanitisation or PII check before logging; if a developer later adds `console.log(query)` it could leak PII. | Document a policy in a code comment or linting rule: never log raw user input (query, sessionId). Use a logging utility that redacts sensitive fields.                                                                                

---

## ERR-022 — errlog — `innomcp-node/src/services/metricsCollector.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `Metric.key()` | **Missing error context**: Errors thrown for label mismatches lack the metric name and the exact label values that caused the failure, making debugging difficult in production. | Pass the metric `name` to the base `Metric` class and include it in the error message (e.g., ``Metric '${name}': Expected...``). Also stringify the received `labels` object in the error. |
| Low | `*.exportLines()` | **Missing error context**: `JSON.parse(key)` is used to reconstruct labels. If the internal map key is somehow corrupted, it throws a raw `SyntaxError` without indicating which metric or label set failed. | Replace `JSON.stringify`/`JSON.parse` with a simpler deterministic string join/split for internal keys, or wrap in a `try/catch` that adds metric context to the error. |
| Medium | `formatLabels()` / Label Values | **Secrets/PII in logs/metrics**: Label values are exported as-is without sanitization. If callers accidentally pass PII (e.g., emails, user IDs) or secrets (e.g., API keys) as label values, they will be exposed in the metrics endpoint. | Implement a sanitization/validation step for label values to reject, mask, or hash known PII/secret patterns, and enforce strict allowlists for label keys. |
| Info | Entire Module | **Unhandled promises / Swallowed errors / Log levels / Timeouts**: Not applicable. This module is entirely synchronous, contains no `try/catch` blocks, no logging statements, and performs no network I/O. | No immediate fix required. Ensure that if async operations, logging, or external calls are added in the future, they include proper timeouts, log levels, and error handling. |

---

## ERR-023 — errlog — `innomcp-node/src/services/modelLoadBalancer.ts` [moonshotai/Kimi-K2.6]
| severity | location | issue | fix |
|---|---|---|---|
| **Critical** | `startHealthProbes` (`setInterval`) | `setInterval` fires an async callback (`() => this.runHealthProbes()`) but never `await`s or `.catch()`es the returned Promise. Any synchronous or async error in `runHealthProbes` becomes an **unhandled promise rejection**, and overlapping probe runs occur if execution exceeds 30 s. | Replace `setInterval` with a self-scheduling `setTimeout` inside an async loop: `const loop = async () => { try { await this.runHealthProbes(); } catch (e) { logger.error('Health probe cycle failed', e); } setTimeout(loop, 30_000); };`. This ensures one cycle finishes before the next starts and rejections are caught. |
| **High** | `runHealthProbes` (`Promise.allSettled`) | `Promise.allSettled` is used to launch probes, but the settlement results are **discarded**, so individual probe rejections are **swallowed** without any observability. | Capture and inspect results: `const results = await Promise.allSettled(probes); results.forEach((r, i) => { if (r.status === 'rejected') logger.error('Health probe failed', { modelId: [...this.models.values()][i].config.id, reason: r.reason }); });` |
| **High** | `runHealthProbes` (`probes.push`) | Each `this.probeModel(state)` promise has **no timeout**; if the underlying network call hangs, `Promise.allSettled` waits indefinitely, blocking recovery and stacking probe cycles. | Wrap each probe in a race with a timeout: `probes.push(Promise.race([this.probeModel(state), rejectAfter(5_000, 'Probe timeout')]).catch(err => { logger.error('Probe timed out or failed', { modelId: state.config.id, err }); }));` or use `AbortSignal.timeout` in the fetch/request. |
| **Medium** | `recordLatency` (`if (!state) return`) | Unknown `modelId` is silently ignored. There is **no error context** (log or throw), so stale IDs or race conditions after `removeModel` go unnoticed and metrics are lost. | Add contextual logging before returning: `if (!state) { logger.warn('recordLatency called for unknown model', { modelId, latencyMs }); return; }` |
| **Medium** | `recordError` (`if (!state) return` & circuit-breaker) | Unknown `modelId` is silently ignored, and the circuit-breaker trip (`disabledUntil = now + 60_000`) happens without any log event, leaving **missing error context** for post-mortems. | Log unknown model warnings and circuit-breaker events: `if (!state) { logger.warn('recordError called for unknown model', { modelId }); return; }` and `if (state.consecutiveErrors >= 5) { state.disabledUntil = Date.now() + 60_000; logger.error('Circuit breaker opened', { modelId, consecutiveErrors: state.consecutiveErrors, disabledUntil: state.disabledUntil }); }` |
| **Medium** | `selectModel` (default case) | An `Error` is thrown for an invalid strategy, but no log entry is emitted with the offending value or current balancer state, resulting in **missing error context** in production logs. | Log the invalid strategy before throwing: `logger.error('Unknown load-balancing strategy', { strategy: strat, availableModels: Array.from(this.models.keys()) }); throw new Error(\`Unknown strategy: ${strat}\`);` |

**Summary of non-findings**
- **Secrets/PII in logs**: No logging statements exist in the visible module, so no leaked secrets were found. *Recommendation:* If

---

## ERR-024 — errlog — `innomcp-node/src/services/motherExportService.ts` [zai-org/GLM-5.1]
| severity | location | issue | fix |
|---|---|---|---|
| **High** | `exportToJSON` | Unhandled exception — no try/catch; if `motherHistory.get()` or `JSON.stringify` throws, the rejection propagates with no context or logging. | Wrap body in try/catch; log the error with context; re-throw a domain-specific error or return a safe fallback. |
| **High** | `exportToCSV` | Unhandled exception — same as above; any failure in `motherHistory.get()` or the flatMap pipeline is unhandled. | Wrap body in try/catch; log with context; re-throw a domain-specific error. |
| **High** | `exportToCSV` — `run.query.replace(…)` / `p.preview.replace(…)` | Null/undefined property access — if `query` or `preview` is null/undefined, `.replace()` throws a `TypeError` with no indication of which record caused it. | Guard with null coalescing: `(run.query ?? "").replace(…)` and `(p.preview ?? "").replace(…)`. |
| **Medium** | `exportToJSON`, `exportToCSV` | PII / secrets in exported data — `query` and `preview` fields may contain user prompts, tokens, or credentials exported verbatim with no redaction. | Introduce a `redact(str)` utility (regex-based masking for emails, keys, tokens); apply before serialization; document retention policy. |
| **Medium** | `exportToJSON`, `exportToCSV` | No logging — zero observability; no audit trail of who exported what, when, or whether it succeeded/failed. | Add structured log calls (`logger.info("motherExportService.toJSON", { limit, recordCount })`) at entry and on error. |
| **Medium** | `exportToJSON`, `exportToCSV` | Missing timeout — if `motherHistory.get()` blocks or the dataset is very large, the call hangs indefinitely with no timeout. | Wrap in a `Promise.race` with a configurable timeout (e.g., `withTimeout(exportToJSON(...), 30_000)`); reject on expiry. |
| **Medium** | `exportToCSV` — flatMap | Missing error context — if one row fails, the thrown error gives no clue which `runId` / `providerId` caused it. | Wrap per-row mapping in try/catch; on failure, log `{ runId, providerId, error }` and either skip the row or re-throw with context. |
| **Low** | `exportToJSON`, `exportToCSV` — `options.limit` | No input validation — negative, zero, or non-integer `limit` values are silently accepted, producing unexpected results. | Validate: `if (limit !== undefined && (!Number.isInteger(limit) \|\| limit <= 0)) throw new Error("limit must be a positive integer")`. |
| **Low** | `exportToCSV` — query/preview fields | CSV injection — unsanitized fields starting with `=`, `+`, `-`, `@` are interpreted as formulas by spreadsheet software. | Prefix dangerous cells with a single quote or tab character; or strip leading formula characters before quoting. |
| **Low** | `exportToCSV` — return type | Ambiguous success/error signal — returns the string `"No history available to export."` on empty data, which a consumer could mistake for valid CSV. | Return an empty CSV (headers only) or throw a typed `NoDataError` so callers distinguish "empty" from "error". |

---

## ERR-025 — errlog — `innomcp-node/src/services/motherHistory.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|

---

## ERR-026 — errlog — `innomcp-node/src/services/motherProviderToggle.ts` [deepseek/deepseek-v4-flash]
| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| **Medium** | `disableProvider`, `enableProvider`, `toggleProvider` | No logging of state changes – silent toggling makes debugging and audit trails impossible. | Add structured logging (e.g., `console.info` or a logger) at each operation recoding the provider ID and new enable state. |
| **Low** | All functions receiving `providerId` | No input validation – calling with `undefined`, `null`, or empty string silently succeeds and could cause logical errors (e.g., disabling a non‑existent provider). | Validate that `providerId` is a non‑empty string; optionally throw or log a warning for invalid input. |
| **Low** | `resetAllProviders` | Exposed as public API – intended for testing but could be misused in production, clearing all toggles without any log or safety check. | Mark as `@internal` or only export in test builds; add a log statement and consider a guard (e.g., reject in production). |

---

## ERR-027 — errlog — `innomcp-node/src/services/naturalnessGuard.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | fix |
|---|---|---|---|
| High | `checkNaturalness` | **Missing error context & handling**: The function lacks a `try...catch` block. If `checkVisibleTextSafe` throws an exception, or if internal logic fails, a raw error bubbles up and crashes the caller pipeline without any contextual information. | Wrap the core logic in a `try...catch`. In the `catch` block, log the error with context (e.g., `intent`, `candidate.length`) and return a safe fallback (e.g., `{ ok: false, ruleFired: "internal-guard-error" }`) to prevent unhandled crashes. |
| High | `checkNaturalness` (parameters) | **Missing input validation (Error Context)**: The function immediately accesses `opts.intent` and `opts.userQuery`. If a caller passes `undefined` or omits `opts`, it throws a generic `TypeError: Cannot read properties of undefined` with no context. | Add explicit validation at the top: `if (!opts || !opts.intent || typeof opts.userQuery !== 'string')` and either throw a descriptive `Error("NaturalnessGuard: invalid options")` or return a structured failure result. |
| Medium | `checkNaturalness` (return points) | **Missing observability (Inconsistent/Missing log levels)**: The guard makes critical routing decisions (blocking robotic answers) but emits zero logs. This prevents monitoring false positives/negatives, making it impossible to tune the regex rules in production. | Inject a structured logger. Emit `info` or `warn` logs when a rule fires (`ok: false`), including `ruleFired`, `intent`, and `candidateLength`. Use `debug` for trace-level details. |
| Medium | `checkNaturalness` (logging strategy) | **Secrets/PII in logs risk**: When adding the missing logs mentioned above, there is a high risk of developers logging the raw `candidate` or `opts.userQuery` to debug failures, which will leak user PII (e.g., addresses, names). | Strictly log metadata (e.g., `candidateLength`, `userQueryIsThai`, `ruleFired`). **Never** log raw `candidate` or `userQuery` text. If full text is required for debugging, pipe it through a PII redaction utility first. |
| Low | `PROVINCE_REQUEST_RE`, `RAW_JSON_RE` | **Missing timeouts / ReDoS risk**: While there are no network timeouts, evaluating regex on long, untrusted `candidate` strings without length bounds can cause CPU blocking (ReDoS), effectively stalling the event loop. | Add a maximum length check before running regexes (e.g., `if (trimmed.length > 5000) return { ok: false, ruleFired: "answer-too-long" }`). Ensure regex patterns do not contain nested quantifiers that could cause catastrophic backtracking. |
| Info | `checkVisibleTextSafe` call | **Unhandled promise rejection risk (if async)**: The code calls `checkVisibleTextSafe` synchronously. If this dependency is ever refactored to be `async` (returning a Promise), `guard.ok` will evaluate to `undefined`, silently bypassing the guard or causing unhandled rejections. | Verify `checkVisibleTextSafe` is strictly synchronous. If it ever requires async operations, update this function to be `async`, `await` the result, and wrap it in a `Promise.race` timeout to prevent hanging. |

---

## ERR-028 — errlog — `innomcp-node/src/services/notificationService.ts` [moonshotai/Kimi-K2.6]
| severity | location | issue | fix |
|---|---|---|---|
| Critical | `notify` method, `callback(fullNotification)` | Unhandled synchronous exceptions: listener callbacks are invoked without any `try-catch`, so a single throwing listener crashes the entire caller stack. | Wrap the callback invocation in a `try-catch`; log the failure with notification context and swallow it to isolate listener faults. |
| High | `broadcast` method, `callback(fullNotification)` inside loop | Unhandled promise rejections: the `try-catch` only traps synchronous throws; if a listener returns a rejected Promise, it leaks as an unhandled rejection. | Wrap invocation with `Promise.resolve(callback(...)).catch(err => ...)` to capture async errors, or enforce synchronous listeners in the contract. |
| High | `broadcast` method, `catch (err)` block | Swallowed errors: exceptions are caught and dumped to `console.error` but lack context—no notification `id`, `type`, `sessionId`, or listener identifier is included. | Use a structured logger; include `notification.id`, `notification.type`, and a listener identifier/correlation ID in every error log payload. |
| Medium | `broadcast` method, `console.error(...)` | Secrets / PII in logs: raw `err` object may embed the full notification payload (including `message`, `data`, or stack traces with session/agent details). | Sanitize output: log `err.message` and a correlation ID only; never log the raw `notification.data` field or full error object directly. |
| Medium | `notify` method, `this.listeners.get(notification.sessionId!)` | Silent failure / missing error context: non-null assertion hides undefined `sessionId`; if missing or no listener exists, the notification vanishes without a trace. | Validate `sessionId` before lookup; emit a `warn` log when a notification is sent to a session with no active listener. |
| Medium | `broadcast` and `notify` callback sites | Missing timeouts: no execution timeout for callbacks; one slow/blocking listener stalls the event loop and delays delivery to all remaining listeners. | Document non-blocking requirement; optionally wrap delivery in `setTimeout` deadlines or offload to an async job queue. |
| Low | Module level (all methods) | Inconsistent log levels: ad-hoc `console.error` used in only one spot; no `info`, `warn`, or `debug` logs for subscribe/notify/broadcast lifecycle events. | Inject a structured logger (e.g., Pino/Winston); log `info` on broadcast/notify, `warn` on missing listeners, `debug` on subscribe/unsubscribe. |

---

## ERR-029 — errlog — `innomcp-node/src/services/presenceService.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | fix |
|----------|----------|-------|-----|
| High | `broadcast` function, empty `catch` block (`try { ws.send(payload); } catch { ... }`) | Swallowed error – WebSocket send failures are silently discarded with **zero logging**. This hides disconnections, backpressure issues, or serialisation problems, making production debugging impossible. | Log the error at `warn` or `error` level including the `projectId`, `userId`, and error message. Optionally count consecutive failures to trigger proactive cleanup. |
| Medium | `broadcast` function | Missing error context – when a send fails there is no information about which client/project failed, preventing correlation with user experience. | Add structured logging inside the catch (e.g., `logger.warn({ projectId, userId: entry.userId, err }, 'broadcast send failed')`). |

---

## ERR-030 — errlog — `innomcp-node/src/services/promptAdapter.ts` [MiniMaxAI/MiniMax-M3]
# Error-Handling & Logging Audit: `promptAdapter.ts`

> **Note:** The provided code is truncated mid-statement (ends inside a GLOSSARY entry: `"ยืนกลาง": "standing`). Issues below cover what is visible. The file is also notable for **having no logging, no try/catch, and no timeout handling at all** — this audit is dominated by absences.

| # | Severity | Location | Issue | Fix |
|---|----------|----------|-------|-----|
| 1 | 🔴 **High** | Entire file — no `try/catch` anywhere | `adaptImagePrompt` and `normalizePlannerQuery` perform no error handling. A throw from `normalizeThaiQuery` (e.g., non-string input, internal regex crash, or LLM call failure downstream) will produce an **unhandled promise rejection** at the async boundary. | Wrap the core logic in `try/catch` in both exported functions; on error, return a degraded `passthrough` result `{ mode: "passthrough", confidence: 0, reasons: ["adapter-error: <class>"], latencyMs, … }` and propagate the throw **only** if a caller-flag demands strict mode. Never let it bubble silently. |
| 2 | 🔴 **High** | `adaptImagePrompt` → LLM fallback path (env-gated branch) | Comment promises *"short, JSON-only, with strict timeout"* but the file as shown contains **no `AbortController`, no `setTimeout`/`AbortSignal.timeout`, and no `fetch`/`openai` call wrapping**. If the LLM call is added later without a timeout, requests can hang and exhaust the event loop. | Add `const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), LLM_TIMEOUT_MS);` and pass `signal: ctl.signal` to the fetch; always `clearTimeout(t)` in `finally`. On `AbortError`, fall back to deterministic result. |
| 3 | 🟠 **Medium** | Entire file | **Zero logging.** No `console.*`, no structured logger, no correlation ID. The exported `latencyMs` field is emitted in the return value, but there is no record of (a) which mode was selected, (b) which glossary entries fired, (c) why `llm-fallback` was skipped (env unset? error?), (d) error context for any caught throw. This makes production incidents undebuggable. | Introduce a tiny logger (e.g., `pino` or a project-standard `log`) and emit: `debug` on every glossary hit, `info` on mode selection with `latencyMs` and `originalPrompt.length` (not content — see #5), `warn` on degraded fallbacks, `error` with `{ err, mode, stage }` on caught exceptions. |
| 4 | 🟠 **Medium** | `stripImageCommand` (line ~40) | Swallowed/over-permissive logic: the `for (let i = 0; i < 2; i++)` filler-strip loop silently consumes up to 2 tokens with no observability. A user prompt `"สร้างรูป ของ ที่ ให้ แมว"` (4 fillers) will be partially stripped with no signal. Not a "catch", but the same anti-pattern: silent data loss. | Cap filler-stripping with an explicit reason code: push `"stripped-filler:<token>"` into `reasons[]`; if more than 2 fillers detected, push `"filler-truncated"` so callers know data was discarded. |
| 5 | 🟠 **Medium** | Logging field design (entire file) | When logging is added (per #3), there is a real risk of **logging the raw `originalPrompt` / `rawQuery` verbatim**. Thai user input is highly likely to contain **PII** (real names, phone numbers, addresses in chat) and occasionally **secrets pasted by mistake** (API keys, tokens). The `reasons` array, if it ever echoes matched fragments, would leak them too. | Add a redaction helper (`redactPII(s)` masking emails, phone patterns, and `\b[A-Za-z0-9_-]{20,}\b` key-shape strings). Log only `originalPrompt.length`, `originalPrompt.hash` (sha-256 truncated), and `language: "th"\|"en"`. Never log `adaptedPromptEn` verbatim at `info+` levels — gate behind `debug` with redaction. |
| 6 | 🟡 **Low** | Public API surface (top-of-file docstring) | Doc claims *"strict timeout"* and *"JSON-only"* guarantees but the type signatures do not reflect any failure mode. Callers cannot distinguish a confident deterministic result from a `passthrough` fallback caused by an internal error. | Either (a) add a `degraded: boolean` flag to 
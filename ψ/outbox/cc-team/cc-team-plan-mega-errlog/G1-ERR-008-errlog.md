<!-- cc-team deliverable
 group: G1 (errlog division)
 member: ERR-008 role=errlog model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2115,"completion_tokens":5000,"total_tokens":7115,"prompt_tokens_details":{"cached_tokens":60,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4668,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 60s
 generated: 2026-06-13T12:00:29.858Z -->
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

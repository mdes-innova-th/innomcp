<!-- cc-team deliverable
 group: G1 (errlog division)
 member: ERR-011 role=errlog model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":731,"completion_tokens":1721,"total_tokens":2452,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1063,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T12:00:51.301Z -->
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

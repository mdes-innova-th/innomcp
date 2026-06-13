<!-- cc-team deliverable
 group: G2 (Server-node module audit)
 member: SV043 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":553,"completion_tokens":2695,"total_tokens":3248,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2376,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T11:34:24.090Z -->
| Severity | Location          | Issue                                                                                                          | Proposed Fix                                                                                                      |
|----------|-------------------|----------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| HIGH     | Module (global)   | No pool shutdown or cleanup method; leaked connections and open handles prevent graceful process termination.    | Implement a `closePool()` using `pool.end()` and call it on `SIGTERM`/`SIGINT`, or export a destroy function.     |
| MEDIUM   | `connectWithRetry()` | Function name implies retry logic but contains none—single `getConnection()` call with no retry loop.           | Rename to `connect()` or implement retry with attempts and backoff (e.g., async retry pattern).                   |
| MEDIUM   | `getPool()`       | Environment variables (DB_HOST, DB_PORT, etc.) used without validation; `Number(undefined)` yields `NaN` for port, causing obscure connection failures. | Validate env vars on startup, set safe defaults (host: `'127.0.0.1'`, port: `3306`) or throw a clear error.     |
| LOW      | `query<T>()`      | Type assertion `rows as T` is unchecked; mismatched result shapes cause silent runtime failures.                 | Add runtime validation or accept the inherent risk; consider using schema validation libraries.                   |

**Risk verdict:** Uncontrolled connection leakage and missing environment validation create brittle production behaviour and silent failures; address the high-severity leak and misleading retry immediately.

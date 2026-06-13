<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D028 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1231,"completion_tokens":5000,"total_tokens":6231,"prompt_tokens_details":{"cached_tokens":82,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4926,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 59s
 generated: 2026-06-13T11:24:15.843Z -->
- **`ToolTimeoutError`** — Thrown when a tool handler exceeds its execution deadline. Message and `name` are hardcoded to Thai (`เครื่องมือหมดเวลา กรุณาลองใหม่อีกครั้ง`).

- **`ToolParamError`** — Thrown when provided tool parameters are invalid. Message and `name` are hardcoded to Thai (`พารามิเตอร์ไม่ถูกต้อง`).

- **`ToolDefinition`** — Describes a tool for registration with `ToolExecutor`. `handler` receives parsed `params` and must return a `Promise`; `timeout` optionally overrides the global default for this tool.

- **`ExecOptions`** — Per-execution overrides passed to `ToolExecutor.execute`.
  - **Caveat:** `retries` is clamped to `0–3` internally; `timeoutMs` falls back to the tool’s own `timeout`, then `30_000` ms.

- **`ToolResult`** — Standardized outcome returned by `ToolExecutor.execute`. `retries` indicates the attempt index that succeeded or finally failed, and `durationMs` covers the total elapsed time.

- **`ToolDefinitionPublic`** — Sanitized metadata view of a tool returned by `listTools`, intentionally omitting the `handler`. Contains `name`, `description`, `parameters`, and optional `timeout`.

- **`ToolExecutor`** — Singleton `EventEmitter` that registers tools and runs them with timeout and exponential-backoff retry logic. Adds a no-op `error` listener in the constructor to prevent unhandled

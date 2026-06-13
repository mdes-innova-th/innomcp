<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-11 role=audit model=deepseek/deepseek-v4-flash
 finish_reason: length | tokens: {"prompt_tokens":1704,"completion_tokens":5000,"total_tokens":6704,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4691,"image_tokens":0},"cache_creation_input_tokens":0} | 55s
 generated: 2026-06-13T11:13:55.967Z -->
| severity | location | issue | proposed fix |
|---|---|---|---|---|
| HIGH | `execute` (line ~84, before `try`) | `this.emit('tool:start', ...)` is outside `try` block; if a listener throws, the error propagates as an unhandled rejection, bypassing the catch and retry logic. | Move the emit inside the `try` block or wrap it in a separate `try/catch`. |
| MED | `execute` (line ~92, inside `try`) | `this.emit('tool:end', ...)` inside `try`; if a listener throws, it is caught by the outer `catch` and treated as a handler error, incorrectly reporting a tool failure. | Wrap the emit in its own `try/catch` to isolate listener errors from tool execution errors. |
| MED | `execute` (line ~104, inside `catch`) | `this.emit('tool:error', ...)` inside `catch`; if a listener throws, it propagates out of the catch, causing an unhandled promise rejection. | Wrap the emit in a `try/catch` to prevent listener errors from escaping. |
| LOW | `toErrorMessage` | `ToolParamError` is defined but never instantiated anywhere; potentially missing validation logic that should throw this error. | Either add parameter validation in `register`/`execute` using `ToolParamError`, or remove the unused class. |

**Overall risk

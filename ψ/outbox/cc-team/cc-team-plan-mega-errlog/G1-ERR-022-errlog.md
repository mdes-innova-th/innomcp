<!-- cc-team deliverable
 group: G1 (errlog division)
 member: ERR-022 role=errlog model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2262,"completion_tokens":2522,"total_tokens":4784,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2127,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T12:03:53.551Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `Metric.key()` | **Missing error context**: Errors thrown for label mismatches lack the metric name and the exact label values that caused the failure, making debugging difficult in production. | Pass the metric `name` to the base `Metric` class and include it in the error message (e.g., ``Metric '${name}': Expected...``). Also stringify the received `labels` object in the error. |
| Low | `*.exportLines()` | **Missing error context**: `JSON.parse(key)` is used to reconstruct labels. If the internal map key is somehow corrupted, it throws a raw `SyntaxError` without indicating which metric or label set failed. | Replace `JSON.stringify`/`JSON.parse` with a simpler deterministic string join/split for internal keys, or wrap in a `try/catch` that adds metric context to the error. |
| Medium | `formatLabels()` / Label Values | **Secrets/PII in logs/metrics**: Label values are exported as-is without sanitization. If callers accidentally pass PII (e.g., emails, user IDs) or secrets (e.g., API keys) as label values, they will be exposed in the metrics endpoint. | Implement a sanitization/validation step for label values to reject, mask, or hash known PII/secret patterns, and enforce strict allowlists for label keys. |
| Info | Entire Module | **Unhandled promises / Swallowed errors / Log levels / Timeouts**: Not applicable. This module is entirely synchronous, contains no `try/catch` blocks, no logging statements, and performs no network I/O. | No immediate fix required. Ensure that if async operations, logging, or external calls are added in the future, they include proper timeouts, log levels, and error handling. |

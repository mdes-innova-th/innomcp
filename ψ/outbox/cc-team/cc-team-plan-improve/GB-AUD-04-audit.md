<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-04 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2804,"completion_tokens":3302,"total_tokens":6106,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2874,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T11:11:49.097Z -->
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| MEDIUM   | `getOracleToken` (approx. line after `_oracleToken` variable) | Race condition: concurrent calls may see `_oracleToken` as null/expired and both fetch a new token, causing duplicate auth requests and potential throttling. No synchronisation guard. | Introduce a promise-based deduplication lock (e.g., store a pending promise, reuse it for concurrent callers, reset on resolution/rejection). |
| MEDIUM   | `getOracleToken` + `callInnovaOracle` | Token cached globally with no invalidation on authentication failures (e.g., 401/403). A stale or revoked token will be reused for up to 23 hours, causing repeated call failures. | Clear `_oracleToken` (set to null) inside `callInnovaOracle` when fetch returns 401/403, or check token validity before use. |
| LOW      | `callInnovaOracle` (fetch + .json()) | `.json()` has no guard against non-JSON responses; a malformed body throws a raw SyntaxError, which the caller must handle. If caller does not have a catch for that specific error, it could become an unhandled rejection later. | Wrap `res.json()` in a try/catch that returns a placeholder string and does not break the orchestration. |
| LOW      | `buildProviderConfigs` (kind determination) | Provider `type` fallback sets kind to `"openai"` for any unknown type. If a new provider type is added without updating the mapping, it will be incorrectly classified as OpenAI, potentially leading to wrong API semantics or cost estimates. | Use an exhaustive switch/default with a safe fallback (e.g., `"unknown"`) and log a warning, or explicitly map all known types. |

**Overall risk verdict:** Low risk overall, but token caching has robustness gaps that could temporarily degrade the Oracle provider under concurrency or auth rotation.

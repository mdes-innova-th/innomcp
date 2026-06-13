<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-011 role=contract model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2510,"completion_tokens":1246,"total_tokens":3756,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":486,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T12:10:05.927Z -->
| Severity | Endpoint | Issue | Fix |
|----------|----------|-------|-----|
| High | `POST /api/chat` (implied) | Missing input validation for `message` field – no check for empty, non-string, or excessive length | Add required validation middleware (e.g., express-validator) for `body.message`: must be non-empty string ≤ 4096 chars |
| High | `POST /api/chat` | Inconsistent error response shapes – some errors return `{ error: string }`, others `{ detail: string }`, and some may return plain text | Standardize all error responses to `{ error: string, code: string }` shape; ensure JSON Content-Type |
| Medium | `POST /api/chat` | Status-code correctness: rate limiting may return 429 but no error body; also missing 401/403 for auth failures | Implement uniform error codes: 400 for validation, 401/403 for auth, 429 for rate limit, 500 for internal errors; include descriptive error messages |
| High | `POST /api/chat` | Missing error responses for missing/invalid `sessionId` – may silently fail or fallback incorrectly | Validate `sessionId` exists in sessionManager, return 400 with `{ error: 'INVALID_SESSION', message: 'Session not found or expired' }` |
| Medium | `POST /api/chat` | Undocumented parameters like `mode`, `stream`, `temperature` – not validated or documented in API contract | Document all permitted query/body params, and validate each against allowed enum/range; reject unknown params with 400 |
| High | `GET /api/chat` (WebSocket upgrade) | WebSocket upgrade handler likely misses origin validation and heartbeat – potential CSRF/DoS risk | Add `verifyOrigin` check, require `Sec-WebSocket-Protocol` with a known token, and implement ping/pong interval for idle connections |
| Medium | `POST /api/chat` | Breaking-change risk: `godTierRouter`, `ABTester`, and semantic router are experimental and may be removed or renamed in future versions | Mark these as internal/experimental in API docs, use feature flags, and expose a stable fallback path (e.g., default Ollama) |
| High | `POST /api/chat` | No content-type validation – accepts arbitrary MIME types (e.g., XML) that could cause parser errors | Limit `Content-Type` to `application/json` only; return 415 Unsupported Media Type for others |
| Medium | `POST /api/chat` | Unhandled promise rejections in async handlers may cause crash in production | Wrap all route handler logic in try-catch with `next(error)` and use a global error middleware that logs and returns 500 with generic message |
| Low | `POST /api/chat` | Prompt injection vulnerability via user `message` field – leads to system prompt leakage or unsafe output | Apply output sanitization using `sanitizeForTraceV3` and enforce system prompt templates; consider adding a moderation layer |
| Medium | `POST /api/chat` | `AI_MODE` switching (`syncChatAIModeIfChanged`) not thread-safe – concurrent requests may see inconsistent config | Add mutex or atomic flag to prevent race condition when updating global AI configuration at runtime |
| Low | `POST /api/chat` | Missing logging of request ID/correlation ID in responses – debugging difficult | Include `correlationId` in response headers and error payloads; already extracted via `extractCorrelationIdFromUpgrade` but not propagated |

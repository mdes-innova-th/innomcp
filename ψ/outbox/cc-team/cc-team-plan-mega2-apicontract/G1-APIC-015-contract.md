<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-015 role=contract model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":632,"completion_tokens":1603,"total_tokens":2235,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T12:11:04.312Z -->
# API Contract Audit: `POST /api/debug/selection`

| Severity | Endpoint | Issue | Fix |
|----------|----------|-------|-----|
| 🔴 **High** | `POST /api/debug/selection` | **Stack trace leaked in 500 response** (`res.json({ error: error.message, stack: error.stack })`). Exposes internal file paths, dependency versions, and logic to unauthenticated callers — a serious information-disclosure / reconnaissance vector. | Return a generic `{ error: "Internal debug error", requestId }` payload server-side; log `stack` to your logger only. Never echo `error.stack` to clients. |
| 🔴 **High** | `POST /api/debug/selection` | **Endpoint is unauthenticated and likely mounted in production.** Route is namespaced `debug` but nothing in the file enforces auth, env-gating, or `NODE_ENV !== 'production'`. Bypasses any production hardening. | Wrap mount in an auth/role guard (e.g., `requireRole("admin")`) and short-circuit with `404` when `NODE_ENV === 'production'`. Better: only register the router in dev/test bootstrap. |
| 🔴 **High** | `POST /api/debug/selection` | **No input validation / no schema.** `req.body` is destructured without type checks, length limits, or shape enforcement. `text` could be an object, buffer, or arbitrarily large string → DoS via memory/CPU in `detectEmotion` and the LLM semantic step. | Validate with Zod / Joi / `express-validator`. Enforce: `text` is `string`, `1 ≤ text.length ≤ 4096`; `history` is an array of bounded strings with max length and max items. Reject with `400` and a structured error. |
| 🟠 **Medium** | `POST /api/debug/selection` | **`history` defaults to `[]` but is never validated.** If a client sends `history: "not-an-array"` or a malformed array of objects, downstream code likely throws → bubble as `500` with leaked stack. | Coerce/validate in schema; on failure return `400 { error: "history must be string[]" }`. |
| 🟠 **Medium** | `POST /api/debug/selection` | **No request size limit set.** Relies on global `express.json()` defaults. Debug endpoints commonly accept very large `text` payloads. | Apply `express.json({ limit: "16kb" })` to this route specifically, or set a per-route `bodyParser` with a tight cap. |
| 🟠 **Medium** | `POST /api/debug/selection` | **Inconsistent response shape between success and error.** Success returns `{ input, emotion, router, timestamp }`; errors return `{ error, stack? }`. No `success` flag, no envelope, no `timestamp` on errors. | Adopt a single response envelope, e.g. `{ success: true, data, timestamp }` / `{ success: false, error: { code, message }, timestamp }`. Document it. |
| 🟠 **Medium** | `POST /api/debug/selection` | **Missing error responses for documented failure modes.** No `429` for rate limiting, no `503` if `getGodTierRouter()` returns uninitialized, no `415` for wrong `Content-Type`. | Add explicit handlers: `415` if `!req.is("application/json"))`; `503` if router singleton is not ready; `429` if a rate limiter is added. |
| 🟠 **Medium** | `POST /api/debug/selection` | **Status-code correctness — `text: ""` passes the falsy check as `400`, but `text: " "` (whitespace) passes through.** | Trim before checking: `if (typeof text !== "string" \|\| text.trim() === "")`. |
| 🟡 **Low** | `POST /api/debug/selection` | **Undocumented params.** No OpenAPI / doc comment describes `text`, `history`, or the response schema. Consumers cannot rely on the contract. | Add a JSDoc block, OpenAPI fragment, or README entry covering request body, all response fields, and error codes. |
| 🟡 **Low** | `POST /api/debug/selection` | **Implicit dependency on `getGodTierRouter()` singleton state.** If uninitialized, error message is generic but client cannot tell whether to retry. | Return `{ error: { code: "ROUTER_NOT_READY" } }` with `503`; document that clients should retry with backoff. |
| 🟡 **Low** | `POST /api/debug/selection` | **Breaking-change risk on `router` response object.** `routingResult` is passed through with an ad-hoc extra `latencyMs`. Any field rename in the router (e.g., `keywordScore → keyword_score`) silently changes the API. | Define and version the response via a DTO/interface in a shared types package; pin a `v1` schema; deprecate via `Sunset` header before removal. |
| 🟡 **Low** | `POST /api/debug/selection` | **No `Content-Type` enforcement on success path.** Response is always JSON, but a future contributor could add a non-JSON branch. | Set explicit `res.type("application/json")` and consider ETag/`Cache-Control: no-store` for debug output. |
| 🟡 **Low** | `POST /api/debug/selection` | **No request/response logging of identifiers.** Only `error.message` is logged — no request id, no input hash, making incident triage hard. | Generate a `requestId` (e.g., `crypto.randomUUID()`), attach to logs and to error responses. |
| 🟡 **Low** | `POST /api/debug/selection` | **`history` is forwarded directly to the LLM semantic scorer.** No PII redaction, no truncation; if this endpoint is ever exposed beyond internal, user data leaks into prompts/logs. | Sanitize/truncate `history` (e.g., last N turns, each ≤ N chars), and document retention. |
| ⚪ **Info** | `POST /api/debug/selection` | **No rate limiting.** Acceptable for an internal debug tool, but flag if ever exposed. | Add a per-IP rate limiter (`express-rate-limit`) if exposure scope changes. |
| ⚪ **Info** | `POST /api/debug/selection` | **No `OPTIONS` / CORS handling at route level.** Inherits app-level config. | Verify the parent `app` defines `OPTIONS` and a tight CORS policy for `/api/debug/*`. |

---

### Recommended minimum fix set (priority order)

1. Strip `error.stack` from responses; log it instead.
2. Gate the entire `debug` router behind an env flag (`if (process.env.NODE_ENV === "production") return;`) and an admin auth check.
3. Add a Zod schema validating `text` and `history`, with explicit length/count limits.
4. Normalize the error response envelope and map known failures (`400`, `415`, `429`, `503`) to correct status codes.
5. Document the contract (request, response, error codes) in OpenAPI; tag as `internal` / `debug`.

Severity legend: 🔴 High (security/correctness) · 🟠 Medium (contract/robustness) · 🟡 Low (DX/maintainability) · ⚪ Info.

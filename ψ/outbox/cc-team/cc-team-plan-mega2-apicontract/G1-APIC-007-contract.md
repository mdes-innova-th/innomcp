<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-007 role=contract model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":492,"completion_tokens":1926,"total_tokens":2418,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":821,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T12:08:54.493Z -->
## API Contract Audit — `innomcp-node/src/routes/api/analytics.ts`

| Severity | Endpoint | Issue | Fix |
|---|---|---|---|
| 🔴 Critical | `POST /reset` | **Missing authorization middleware.** Comment says "admin only" but no auth guard is applied — any client can wipe all analytics data. | Add an auth middleware (e.g., `requireRole('admin')`) before the handler. |
| 🔴 Critical | `POST /event` | **No enum validation on `type`.** Only checks `type` is truthy; accepts any string, polluting analytics with invalid categories. | Validate `type` against the allowed set `['message', 'tool', 'error']`; return `400` with a descriptive error if invalid. |
| 🔴 High | `POST /event` | **Unsanitized body forwarded to service.** The entire `req.body` (including arbitrary extra keys) is passed to `analyticsService.track()`, risking injection or storage bloat. | Whitelist/pick only known fields (`type`, `name`, `duration`, etc.) before passing to the service layer. |
| 🟠 Medium | All endpoints | **Inconsistent error response shape.** Success returns `{ success: true, ... }` but errors return `{ error: message }` — missing `success: false` and no error `code`. Clients cannot reliably branch on a single `success` field. | Standardize all responses to `{ success: boolean, data?: any, error?: { code: string, message: string } }`. |
| 🟠 Medium | All endpoints | **Inconsistent success response shapes.** `/stats` → `{ success, data }`, `/event` → `{ success }`, `/reset` → `{ success, message }`. Three different shapes for three endpoints. | Adopt one envelope: `{ success: true, data?: T, message?: string }` and document it in an OpenAPI spec. |
| 🟠 Medium | `POST /event` | **Wrong status code for creation.** Returns `200 OK` when a new event resource is recorded. | Return `201 Created` (or `202 Accepted` if tracking is async/queued). |
| 🟠 Medium | All endpoints | **Internal error messages leaked to client.** `err.message` from the service layer is sent verbatim — may expose stack details, DB errors, or file paths. | Log the full error server-side; return a generic, localized message to the client (e.g., `"Internal server error"`). |
| 🟡 Low | `POST /event` | **No `Content-Type` enforcement.** Handler assumes JSON body but never validates `Content-Type: application/json`; `body` may be `undefined` or a raw string if middleware is misconfigured. | Add a guard: `if (!req.is('json')) return res.status(415).json(...)` or rely on a global `express.json()` with `strict: true`. |
| 🟡 Low | `GET /stats` | **No query-parameter contract.** No support (or rejection) of `?from=`, `?to=`, `?granularity=` etc. Undocumented whether the endpoint accepts filters. | Either document "no params accepted" explicitly, or add/validate query params with a schema (e.g., `zod`). |
| 🟡 Low | `POST /event` & `POST /reset` | **No rate limiting.** Both write endpoints are unbounded — a single client can flood analytics or repeatedly reset data. | Apply a rate-limit middleware (e.g., `express-rate-limit`) scoped per route or per IP/user. |
| 🟡 Low | `POST /reset` | **`200` with body for a destructive action.** A `POST` that resets state could benefit from `204 No Content` or at least an `ETag`/`Last-Modified` to prevent duplicate resets. | Consider `204` on success, or add idempotency-key support to prevent accidental double-resets. |
| ⚪ Info | All endpoints | **No `requestId` / correlation ID.** Errors are hard to trace back to a specific request in logs. | Inject a `X-Request-Id` header (via middleware) and include it in every response and log line. |

### Summary of Breaking-Change Risks

| Risk | Impact if changed later |
|---|---|
| Adding `success: false` to error responses | Clients currently checking `if (res.error)` will still work, but clients checking `if (!res.success)` will break if they assumed `success` is always present. |
| Changing `/event` from `200` → `201` | Clients that hard-check `status === 200` will break. |
| Adding auth to `/reset` | Any existing unauthenticated callers (scripts, cron jobs) will start receiving `401`/`403`. |
| Whitelisting `/event` body fields | Frontend clients sending extra fields will silently lose data if not coordinated. |

<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-010 role=contract model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":523,"completion_tokens":2073,"total_tokens":2596,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T12:09:53.901Z -->
| Severity | Endpoint | Issue | Fix |
|----------|----------|-------|-----|
| **Critical** | `POST /api/chat/report` | `messageText.substring(0, 100)` crashes with `TypeError: Cannot read properties of undefined (or null)` when `messageText` is missing or non-string. Entire request fails with 500 instead of a clean 400. | Validate `messageText` is a non-empty `string` (e.g., `typeof messageText === "string" && messageText.length > 0`) before truncation. Use `messageText?.slice(0, 100) ?? ""` as a defensive fallback. Return `400` with a validation error if invalid. |
| **Critical** | `POST /api/chat/report` | No input validation/schema enforcement. Body is destructured blindly — accepts any type, missing fields, or oversized payloads (no size limit, no rate limit). | Add a schema validator (Zod / Joi / `express-validator` / `class-validator`) requiring `messageIndex: number`, `messageText: string` (max length, e.g., 5000), `reason: string` (enum: spam, abuse, harassment, other), `timestamp: number`. Reject extras with strict mode. Apply `express.json({ limit: "10kb" })` at the router level. |
| **High** | `POST /api/chat/report` | No authentication/authorization check visible. `TODO` indicates `req.user?.userId` is not yet wired, meaning anonymous users can flood reports (DoS, log poisoning, abuse vector). | Require auth middleware (`requireAuth`) before this handler. Persist `userId` from session/JWT. Reject unauthenticated requests with `401 Unauthorized`. |
| **High** | `POST /api/chat/report` | Reports are only logged, never persisted (per `TODO`). No idempotency, no dedup — a single user can re-report the same message infinitely, bloating logs and (once DB is wired) the `user_activity_log` table. | Once DB insert is implemented: add a unique constraint on `(user_id, message_index, action_type)` or a dedup window (e.g., 24h). Return `200` idempotently for duplicates with `{ success: true, duplicate: true }`. |
| **High** | `POST /api/chat/report` | No rate limiting on the endpoint. Combined with the missing auth, this is a trivial abuse/DoS surface. | Apply `express-rate-limit` (e.g., 10 reports / 15 min per `userId` or IP) before the handler. Return `429 Too Many Requests` with `Retry-After`. |
| **High** | `POST /api/chat/report` | Inconsistent / undocumented response shape. Success returns `{ success: true, message: "Report received" }`; error returns `{ success: false, error: "..." }` — no `code`, no `details`, no `requestId`. | Adopt a uniform envelope: `{ ok: boolean, data?: T, error?: { code: string, message: string, details?: unknown } }`. Keep `success` only if it's a documented public contract; otherwise migrate and version the route (`/api/v2/chat/report`). |
| **Medium** | `POST /api/chat/report` | `messageText` is logged and (per `TODO`) will be persisted. PII / user-generated content flowing into logs violates typical data-handling policies and may breach GDPR/CCPA (purpose limitation, retention). | Truncate/hash/redact `messageText` in logs; store the *report metadata* in DB, not the full message body, unless strictly required. Add a retention policy. If full text is needed, document and gate behind consent. |
| **Medium** | `POST /api/chat/report` | `timestamp` is client-supplied and trusted. A client can backdate or future-date reports, corrupting analytics and audit trails. | Ignore client `timestamp`; use `new Date().toISOString()` server-side. If client time is needed, validate it lies within a sane window (e.g., `|now − ts| < 5min`) and store as `client_timestamp` separately. |
| **Medium** | `POST /api/chat/report` | `messageIndex` is not validated for type/range. A negative or `NaN` index is stored, yielding meaningless reports. | Validate `Number.isInteger(messageIndex) && messageIndex >= 0` (or `> 0`, depending on indexing convention — **document and pin this**). |
| **Medium** | `POST /api/chat/report` | No OpenAPI/Swagger documentation. Clients must guess the payload and response contract. | Add `@swagger` JSDoc (or a separate `openapi.yaml`) documenting: method, path, auth requirement, request schema, all response codes (`200`, `400`, `401`, `429`, `500`), and response schemas. |
| **Medium** | `POST /api/chat/report` | Endpoint is unmounted/versioned (`/api/chat/report`). Adding breaking changes later (auth, payload shape, rate-limit headers) will be a silent breaking change for existing clients. | Version the route (`/api/v1/chat/report`) now. Reserve room for additive fields; never remove or rename without a deprecation cycle (`Sunset` header, `Deprecation` header, changelog entry). |
| **Medium** | `POST /api/chat/report` | Status code correctness: success path returns `200 OK` for a resource *creation* (report record). Per REST, this should be `201 Created` with a `Location` header to the new resource. | Return `201 Created` and `Location: /api/chat/reports/:id` once the DB insert is live. For pre-DB logging-only mode, `202 Accepted` is more accurate than `200`. |
| **Low** | `POST /api/chat/report` | Generic `500` for all error paths leaks the literal error string into logs (`logBoth("error", [CHAT REPORT] Error: ${error})`) and the response says only `"Failed to report message"` — no `requestId` for correlation. | Generate a `requestId` (e.g., `crypto.randomUUID()` via `express-request-id` middleware), echo it in the response error body and all log lines. Never log raw `error` objects without sanitization (PII risk). |
| **Low** | `POST /api/chat/report` | `reason` is logged verbatim with no allowlist/canonicalization. Free-form attacker-controlled string in structured logs complicates SIEM parsing and is a log-injection vector (`\n`, ANSI escapes). | Validate `reason` against an enum and log the normalized value; if free text is needed, sanitize (`JSON.stringify` or strip control chars) before logging. |
| **Low** | `POST /api/chat/report` | No `Content-Type` enforcement — clients could send `text/plain` and `req.body` would be `undefined`, again crashing at `messageText.substring`. | Add a content-type check (`if (req.is("application/json") === false) return res.status(415).json(...)`). |
| **Low** | `POST /api/chat/report` | Missing security response headers (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, etc.) on responses — minor for this endpoint, but easy to add via `helmet()`. | Mount `helmet()` app-wide; explicitly set `Cache-Control: no-store` on this route since it handles user content. |
| **Low** | `POST /api/chat/report` | No `OPTIONS`/CORS preflight handler explicitly. Behavior depends on global CORS middleware. | Either rely on a global `cors()` config (and document allowed origins) or add an explicit `router.options("/report", ...)` returning allowed methods/headers. |
| **Info** | `POST /api/chat/report` | `req` is typed as `any` via default Express typings; no `Request<{}, {}, ReportPayload>` generic narrowing. | Type the payload: `router.post<{}, ResponseShape, ReportPayload>("/report", handler)` and import a shared `ReportPayload` interface from a `types/` module. |

### Suggested skeleton after fixes

```ts
import { Router } from "express";
import { z } from "zod";
import { logBoth } from "../../../utils/mcpLogger";
import { requireAuth } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";

const ReportSchema = z.object({
  messageIndex: z.number().int().nonnegative(),
  messageText: z.string().min(1).max(5000),
  reason: z.enum(["spam", "abuse", "harassment", "other"]),
  // timestamp intentionally not accepted
});

router.post(
  "/v1/chat/report",
  requireAuth,
  rateLimit({ windowMs: 15 * 60_000, max: 10 }),
  async (req, res) => {
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: { code: "INVALID_PAYLOAD", message: "Invalid report", details: parsed.error.flatten() },
      });
    }
    const { messageIndex, messageText, reason } = parsed.data;
    const userId = req.user.userId;

    // ... persist + log (truncate messageText, never raw error)
    res.status(201).json({ ok: true, data: { id: reportId } });
  }
);
```

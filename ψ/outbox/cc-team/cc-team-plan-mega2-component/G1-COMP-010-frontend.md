<!-- cc-team deliverable
 group: G1 (component division)
 member: COMP-010 role=frontend model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1614,"completion_tokens":1420,"total_tokens":3034,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T12:08:35.144Z -->
# React/Next.js Component Audit

## Module: `innomcp-next/src/app/api/apikey/route.ts`

**Note:** This file is a Next.js API route (server-side), not a React component. Most of the listed concerns (memo/keys, useEffect, dangerouslySetInnerHTML, hydration, error boundaries) do not apply. Audit is limited to server-side concerns and React-adjacent issues in the route handler.

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| 🔴 High | `GET` handler, `decryptApiKeys.map(...)` | **Sensitive data exposure / privacy**: The endpoint decrypts and returns plaintext API keys to the client. Combined with the `console.log` of the full decrypted payload, plaintext keys may end up in server logs. API keys should be returned only at creation time, never listed decrypted. | Remove the `decryptApiKey` call from the list response. Return a masked key (e.g., first/last 4 chars) for display. Decrypt and return the full value only in the `POST` (create) response. Remove the `console.log` of decrypted keys; if logging is required, log only IDs/names. |
| 🔴 High | `POST` handler, `createApiKey` call | **Missing input validation**: `expire`, `rate_limit`, `allowed_origins`, and `user_id` from `request.json()` are used without type/format checks. A malicious admin client could pass arbitrary `user_id` and create keys on behalf of any user. | Validate the body with a schema (e.g., Zod) before calling `createApiKey`. Coerce types explicitly (`Number(rate_limit)`, `Array.isArray(allowed_origins)`), and authorize the `user_id` against the JWT identity (or reject the field and always use `user.id`). |
| 🔴 High | `POST` & `GET` handlers | **Authz race / IDOR via `user_id`**: Even with role 0, the handler trusts client-supplied `user_id` instead of deriving it from the JWT. | Ignore the request's `user_id` and always use `user.id` from the decoded JWT, or enforce that any provided `user_id` matches the caller. |
| 🟠 Med | `console.log` in `GET` | **PII / secret leakage in logs**: Logging full decrypted keys violates least-logging and may breach compliance (PDPA given the Thai user-facing messages). | Remove or replace with a non-sensitive audit log (`apiKeyId`, `apikey_name`, `count`). |
| 🟠 Med | Top of file | **Redundant import**: `createApiKey` and `decryptApiKey` are both imported from `@/app/lib/apikey`; the import line for `decryptApiKey` is on a separate statement, which is fine, but the duplicate specifier can be merged for clarity and tree-shaking. | `import { createApiKey, listApiKeys, decryptApiKey } from "@/app/lib/apikey";` |
| 🟠 Med | `POST` handler, `expire` parsing | **Unvalidated `new Date(expire)`**: Invalid input produces `Invalid Date`, which is silently forwarded to `createApiKey` and may persist as NaN/null in storage. | After `new Date(expire)`, check `isNaN(expireDate.getTime())` and return `400` if invalid. |
| 🟠 Med | `POST` & `GET` error blocks | **Stack traces not surfaced to logs**: `console.error("Error creating API key:", error)` prints the Error object, but the request context (route, user id, request id) is missing, making incidents hard to triage. | Use a structured logger; include `requestId`, `userId`, and `route`. Consider using `NextResponse.json` with a stable error code and not relying solely on `console.error`. |
| 🟡 Low | `GET` handler, `status` parsing | **Loose typing of `status`**: The `as "active" | "inactive" | "revoke" | undefined` cast bypasses validation; an invalid string is forwarded to `listApiKeys`. | Validate against a literal union (Zod or a `Set` check) and return `400` on invalid value. |
| 🟡 Low | `POST` handler | **Rate-limit input not coerced**: `rate_limit` is passed through as-is. A non-number could break downstream code. | `const limit = rate_limit == null ? undefined : Number(rate_limit); if (Number.isNaN(limit)) return 400;` |
| 🟡 Low | `POST` & `GET` | **No request size / method hardening**: `request.json()` is called without size limits; very large bodies could DoS the route. | Configure `export const config = { api: { bodyParser: { sizeLimit: '32kb' } } }` (App Router equivalent: validate `Content-Length` and cap). |
| 🟡 Low | `POST` & `GET` | **No CORS handling on mutating endpoint**: The route accepts `allowed_origins` for stored keys but the route itself has no explicit CORS, which can mask misconfiguration in browsers. | If the API is browser-consumed, return CORS headers here too; otherwise document that it’s server-to-server only. |
| ⚪ Info | Whole file | **Not a React component**: `useEffect`, memoization, keys, `dangerouslySetInnerHTML`, hydration, and error boundaries do not apply here. | N/A. If you want a component audit, please share the corresponding client components (e.g., the admin UI that calls this route). |
| ⚪ Info | Whole file | **No error boundary needed**: API routes in the App Router are isolated per-request; an `error.tsx` is only relevant for the page tree. | Consider adding an `app/api/apikey/error.ts`-style wrapper or rely on the try/catch already present (which is sufficient). |

### Quick wins (apply in order)
1. Stop returning decrypted keys in `GET`; mask them.
2. Drop the `console.log` of decrypted keys.
3. Add Zod validation for `POST` body and ignore client-supplied `user_id`.
4. Validate `status` and `expire` in `GET` / `POST` respectively.
5. Add a request id to error logs.

If you can also share the page/client components that consume `/api/apikey` (the admin UI for listing/creating keys), I can run the full React-specific audit (memo, keys, effects, hydration, etc.).

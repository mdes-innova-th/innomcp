<!-- cc-team deliverable
 group: G1 (component division)
 member: COMP-015 role=frontend model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1087,"completion_tokens":1500,"total_tokens":2587,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T12:09:18.171Z -->
# Component Audit Report

**Module:** `innomcp-next/src/app/api/chat/report/route.ts`

> Note: This is a Next.js Route Handler (server-side), not a React component. The audit checklist has been adapted to server-route concerns (re-renders, memo/keys, hydration, etc. don't apply). Findings focus on actual issues present.

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| 🔴 High | `POST` handler, body parsing (line ~20) | **No request body size limit.** `req.json()` will accept arbitrarily large payloads, enabling memory exhaustion / DoS. Combined with the unbounded `messageText` flows, an attacker can submit a huge string that is then truncated in memory and written to disk/DB. | Add a size guard before parsing: read `req.headers.get("content-length")` and reject if over a sensible limit (e.g., 10 KB), or use `req.text()` with a manual length check before `JSON.parse`. |
| 🟠 Medium | Body destructuring + `messageText` flow (line ~22, ~37) | **Type-safety bypass via `unknown`.** The cast `await req.json() as {...}` lies to TypeScript — every field must be re-validated at runtime. Current code does some coercion, but `messageText` is taken straight from the JSON without validating it's a string before calling `.substring(0, 200)` (safe only because of the guard, but the `unknown` cast is misleading). | Define a runtime validator (e.g., Zod) with a schema `{ messageIndex?: number, messageText?: string, messageId?: string, sessionId?: string, categories?: string[], timestamp?: number }` and use `schema.parse(await req.json())`. Remove the `as` cast. |
| 🟠 Medium | DB insert block (line ~52) | **Unsafe `INSERT` parameter for `categories`.** Passing a JSON string `JSON.stringify(categoryList)` for a column typed `JSON` is MySQL-specific and fragile; more importantly, if the column were ever changed to a length-limited `VARCHAR`/`TEXT` with an index, the same value would be silently truncated. Also, the `INSERT IGNORE` silently swallows a duplicate-key scenario which is fine here, but combined with the silent `console.error` fallback it makes failures invisible. | Use `JSON_OBJECT` / `JSON_ARRAY` SQL functions or `mysql2`'s native JSON binding. Replace `console.error` with a structured logger and emit a metric on DB failure so ops can alert. Consider returning a non-2xx if the primary path (JSONL) also failed. |
| 🟠 Medium | `jwtMiddleware` usage (line ~23) | **No explicit auth requirement.** If `jwtMiddleware` returns `NextResponse` (auth failure), the code proceeds with `userId = null` and *still* writes the report. Anonymous reporting is probably intentional, but a missing/invalid token should be distinguished from a valid anonymous request. | Decide explicitly: either accept anonymous (and document it) or short-circuit when `jwtResult instanceof NextResponse` with a `401`. Currently the code looks like it forgot to return. |
| 🟡 Low | File-write section (line ~41) | **Path traversal / log injection not applicable here, but `process.cwd()`-relative writes** are fragile under serverless/edge runtimes (Vercel functions have a read-only filesystem except `/tmp`). | On serverless, write to `os.tmpdir()` (`/tmp/reports-...jsonl`) or use an external log sink. Validate that the runtime supports `fs/promises` and consider a `process.env.REPORTS_DIR` override. |
| 🟡 Low | `appendFile` (line ~43) | **No concurrency control.** Many simultaneous reports can interleave bytes across `appendFile` calls; Node's `fs.promises.appendFile` is safe for small writes at the OS level, but large bursts can still produce partial-line JSONL. | Either accept the risk (JSONL is line-oriented, so partial lines are visible and can be skipped) or use a per-day file with a single-writer mutex (e.g., `proper-lockfile`) if the volume is high. |
| 🟡 Low | `new Date(timestamp).toISOString()` (line ~38) | **Client-supplied timestamp is trusted as a `Date`.** A `NaN` from `new Date("invalid")` is guarded by the `typeof timestamp === "number"` check, but a *very large* or *very small* epoch produces a real Date that overrides server time, breaking audit ordering. | If the timestamp is only used for logging, ignore the client value and always use `new Date().toISOString()`. If it must be preserved, clamp it to `Date.now() ± 5min`. |
| 🟡 Low | Truncation at slice/substring calls (line ~36) | **Silent truncation.** `messageId.slice(0, 128)` and `messageText.substring(0, 200)` quietly drop data. For a "report" record the full payload is arguably the most important part. | Document the limits and consider storing the full text in a separate field/file, or hash-and-store for review. At minimum, return a `truncated: true` flag in the response so the client knows. |
| 🟢 Info | Whole file | **No rate limiting.** A logged-in (or anonymous) user can spam reports. | Add per-IP and per-user rate limiting (e.g., Upstash, Vercel middleware, or an in-memory token bucket for single-instance deploys). |
| 🟢 Info | Whole file | **No CSRF / origin check.** Route accepts cross-origin `application/json` POSTs; if cookies are used for auth, this is a CSRF vector. | Verify `req.headers.get("origin")` against an allowlist, or require a same-site auth header instead of cookies. |
| 🟢 Info | `return NextResponse.json({ success: true, ... })` (line ~62) | **No correlation/request ID in response.** Makes incident triage slow. | Return `{ success, reportId, requestId }` and echo `requestId` in error responses and server logs. |
| ⚪ N/A | — | React-specific items (re-renders, `useMemo`, `useEffect` deps, keys, hydration, `dangerouslySetInnerHTML`, error boundaries) | Not applicable — this is a server route handler with no JSX or React tree. |

## Summary
- **Critical/High:** 1 (unbounded body)
- **Medium:** 3 (validation, DB binding/observability, auth ambiguity)
- **Low:** 4 (filesystem assumptions, concurrency, client timestamp, silent truncation)
- **Info:** 3 (rate limiting, CSRF, observability)

The biggest wins: add a body-size cap and replace the `unknown` cast with a Zod schema. Everything else is hardening for a production reporting endpoint.

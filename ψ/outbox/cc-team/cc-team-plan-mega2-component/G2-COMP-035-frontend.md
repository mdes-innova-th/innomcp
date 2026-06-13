<!-- cc-team deliverable
 group: G2 (component division)
 member: COMP-035 role=frontend model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1718,"completion_tokens":1811,"total_tokens":3529,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T12:12:56.837Z -->
# React/Next.js Component Audit

**Module:** `innomcp-next/src/app/api/user/login/form/route.ts`

> **Note:** This module is a Next.js **API Route Handler** (server-side `POST` endpoint), not a React component. The audit categories you listed (re-renders, hooks, memo, dangerouslySetInnerHTML, hydration) do not directly apply. However, several **security, type-safety, and error-handling issues** are present. Findings below.

---

| Severity | Location | Issue | Fix |
|---|---|---|---|
| 🔴 **Critical** | `connection.execute(..., [username, username])` (line ~22) | **SQL injection risk via ambiguous OR clause.** Querying `WHERE username = ? OR user_email = ?` with the same parameter can match unintended accounts if usernames collide with emails. Combined with string-typed MySQL, this is a logic flaw, not classic injection (parameterized), but still unsafe behavior. | Split into two queries (one for `username`, one for `user_email`) and resolve to a single user, or enforce a unique index policy. Reject if the input contains `@` and treat as email only. |
| 🔴 **Critical** | `process.env.JWT_SECRET!` (line ~46) | **Non-null assertion on `JWT_SECRET`.** If the env var is missing, `jwt.sign` will throw a confusing runtime error, or worse, sign with `undefined` in some Node versions. | Validate at startup: `if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");` and use a typed env loader (e.g., zod). |
| 🟠 **High** | `try { ... } catch` around `bcrypt.compare` (line ~36) | **Catching bcrypt errors masks real failures.** `bcrypt.compare` only rejects on malformed hashes; this catch is dead-code most of the time and hides programming bugs. | Remove the inner `try/catch`; let `bcrypt.compare` throw to the outer handler. Use a constant-time comparison guard. |
| 🟠 **High** | `password?.trim()` (line ~15) | **`trim()` on passwords can be misleading/unsafe.** Users with leading/trailing spaces will fail auth, and trimming silently mutates user input — violates principle of least surprise. | Do not trim passwords. For usernames, trim is acceptable; do it once. |
| 🟠 **High** | User lookup returns all columns via `SELECT *` (line ~21) | **Over-fetching sensitive data.** `user.password` (hash) and any PII are loaded even when not needed downstream. Increases blast radius if logging is ever added. | Use `SELECT user_id, username, user_dispname, userrole_id, password_hash FROM user ...` and rename the column to `password_hash` for clarity. |
| 🟠 **High** | Error handler inspects `errorMessage.toLowerCase().includes("connect")` (line ~95) | **String-matching on error messages is fragile.** Real `mysql2` errors carry `code` (e.g., `ECONNREFUSED`, `ETIMEDOUT`, `ER_LOCK_WAIT_TIMEOUT`). Substring matching is locale- and version-fragile. | Inspect `error.code` (mysql2 / Node net errors) via a type guard: `if (error && typeof error === "object" && "code" in error)`. |
| 🟡 **Medium** | Return type of `withDbConnection` callback (line ~19) | **Union return type `T \| { error: ... } \| { token, message }` is a discriminated-union anti-pattern.** Mixing success and error shapes with overlapping string keys (`"error" in result`, `"token" in result`) is brittle and TypeScript-unsafe (no exhaustiveness). | Define a discriminated union: `type Result = { ok: true; token: string; message: string } \| { ok: false; code: "USER_NOT_FOUND" \| "INVALID_PASSWORD" \| ... }` and narrow with `result.ok`. |
| 🟡 **Medium** | `body.username?.trim()` without type validation (line ~13) | **No input validation/sanitization.** `req.json()` returns `any`; a non-string `username` will throw inside `.trim()`. | Validate with a schema (zod / valibot): `const Body = z.object({ username: z.string().min(1).max(255), password: z.string().min(1).max(1024) });` |
| 🟡 **Medium** | `verifyCSRFToken(req)` (line ~11) | **Cannot verify CSRF on a JSON `POST` body without prior cookie read.** If the token is expected in a header, ensure `verifyCSRFToken` validates `Origin`/`Referer` + token parity (double-submit cookie pattern). | Confirm `verifyCSRFToken` enforces: (1) `Origin` matches allow-list, (2) header token equals cookie token. Add an integration test. |
| 🟡 **Medium** | `response.cookies.set(tokenName, result.token, ...)` (line ~79) | **Cookie name from env at request-time.** Toggling `TOKEN_NAME` mid-deploy invalidates all sessions and can leak old tokens. | Pin `TOKEN_NAME` to a build-time constant and document rotation procedure. |
| 🟡 **Medium** | `process.env.NODE_ENV === "production"` repeated twice (line ~80, ~84) | **DRY / readability.** | `const isProd = process.env.NODE_ENV === "production";` once at the top. |
| 🟢 **Low** | `console.error("Login error:", error)` (line ~88) | **Logging full error may include PII or partial secrets** in stack traces attached to request bodies. | Use a structured logger (pino) with a redaction config; never log raw `error` with request body context. |
| 🟢 **Low** | No rate limiting / lockout on this route | **Brute-force friendly.** No mention of rate limiting; bcrypt cost protects CPU, not throughput. | Add an IP+username throttler (e.g., `@upstash/ratelimit`) and exponential backoff after N failures. |
| 🟢 **Low** | `if (!user) return { error: "USER_NOT_FOUND" };` after `rows.length === 0` (line ~27) | **Dead branch.** If `rows.length === 0` you already returned; the `!user` check is unreachable. | Remove the redundant `!user` check. |
| ⚪ **Info (N/A)** | N/A | **No React component issues apply** — this is an API route, not a component. Categories like *unnecessary re-renders*, *missing memo/keys*, *effect dependency bugs*, *state-in-render*, *prop drilling*, *error boundaries*, *unsafe `dangerouslySetInnerHTML`*, *hydration risks* are **not applicable** here. | N/A |
| ⚪ **Info** | `route.ts` | **No HTTP method allow-list export.** The file only exports `POST`; Next.js enforces this, but consider exporting `export const dynamic = "force-dynamic";` and `export const runtime = "nodejs";` explicitly for clarity. | Add `export const runtime = "nodejs"; export const dynamic = "force-dynamic";` at the top. |

---

## Summary

- **Critical (2):** SQL logic flaw, unsafe `JWT_SECRET!` assertion.
- **High (4):** bcrypt error swallowing, password trimming, `SELECT *` over-fetch, fragile error-message matching.
- **Medium (6):** Discriminated-union design, input validation, CSRF contract, env-driven cookie name, repeated prod checks, schema validation.
- **Low (4):** Logging hygiene, rate limiting, dead branch, runtime config.
- **N/A (1 block):** React-specific audit categories — not applicable to a server route handler.

### Recommended Top 3 Fixes

1. **Validate env + inputs at the edge** with zod (`JWT_SECRET`, `Body` schema).
2. **Narrow `withDbConnection` callback** to a proper `Result<T, E>` discriminated union — eliminates the `"error" in result` and `"token" in result` string-key checks.
3. **Replace substring error-matching** with `error.code` inspection, and add a rate limiter for the login route.

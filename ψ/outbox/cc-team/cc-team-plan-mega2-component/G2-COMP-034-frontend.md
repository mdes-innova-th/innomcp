<!-- cc-team deliverable
 group: G2 (component division)
 member: COMP-034 role=frontend model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1988,"completion_tokens":2219,"total_tokens":4207,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1179,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T12:12:38.223Z -->
# Audit Report: `auth-postmessage/route.ts`

> **Note:** This is a server-side API route, so React-specific issues (re-renders, memo, keys, hydration, state-in-render, prop drilling) are **N/A**. The audit focuses on security, logic, and code-quality issues present.

| severity | location | issue | fix |
|---|---|---|---|
| 🔴 High | `POST` handler — auth model | **Weak identity verification**: login is granted based solely on `firstName + lastName + birthDate` — no password, OTP, or token required. Anyone who knows a user's name and DOB can impersonate them. | Require a secondary verification factor (e.g., OTP sent to registered email/phone, or a pre-shared secret). At minimum, add rate-limiting and account-lockout. |
| 🔴 High | `POST` handler — age calculation | **Timezone mismatch bug**: `new Date()` uses server-local time while `new Date(birthDate)` parses `YYYY-MM-DD` as UTC midnight. Users near the age boundary (18/120) may be incorrectly accepted or rejected depending on server TZ. | Use UTC consistently: `const today = new Date(new Date().toISOString().slice(0,10) + 'T00:00:00Z'); const birth = new Date(birthDate + 'T00:00:00Z');` or use a library like `date-fns`. |
| 🟠 Medium | `POST` handler — no rate limiting | **No brute-force protection**: endpoint can be hammered to enumerate users by name+birthdate or create mass accounts. | Add rate limiting middleware (e.g., `next-rate-limit`, `upstash/ratelimit`, or reverse-proxy level). |
| 🟠 Medium | `POST` handler — DB operations | **No transaction wrapping**: user creation involves multiple sequential DB operations (SELECT, then INSERT). A race condition could create duplicate users under concurrent requests. | Wrap the find-or-create logic in a DB transaction with `connection.beginTransaction()` / `commit()` / `rollback()`, and add a UNIQUE constraint on `(user_dispname, user_birthdate)`. |
| 🟠 Medium | `POST` handler — `appid` env check | **Security gate skipped silently**: if `POSTMESSAGE_APPID` env var is not set, the appid validation is entirely bypassed (`else` branch just logs). An attacker can omit the env var in production to skip auth. | Fail closed — if appid/apiKey are provided but no env var is configured, either reject or require the DB-only validation path explicitly. Remove the silent skip. |
| 🟠 Medium | `POST` handler — logging | **Sensitive data logged**: `birthDate` and `age` are logged to console in plaintext, and `logUserActivity` stores activity strings. Birth dates are PII. | Redact or hash PII in logs. Log only a reference ID, not the raw birthDate. |
| 🟡 Low | Line 6 — `import jwt` | **Unused import**: comment says "jwt not required" but it's still imported, increasing bundle size and confusing maintainers. | Remove `import jwt from "jsonwebtoken"`. |
| 🟡 Low | Line 4 — `import ResultSetHeader` | **Unused import**: `ResultSetHeader` is imported but never used in the visible code. | Remove unused import. |
| 🟡 Low | `POST` handler — `request.json()` | **No explicit JSON parse error handling**: if the body is not valid JSON, the outer `catch` returns a generic 500. Client gets no useful feedback. | Add a dedicated try/catch around `request.json()` returning a 400 with `"Invalid JSON body"`. |
| 🟡 Low | `POST` handler — response | **No error boundary pattern**: a single top-level try/catch returns generic 500 for all unhandled errors (DB down, connection timeout, etc.). No differentiation between client errors and server faults. | Separate error classes or status-code mapping. Return 503 for DB failures, 500 for unexpected errors. Consider a global error boundary wrapper for all API routes. |
| 🟡 Low | `POST` handler — request size | **No request body size limit**: `request.json()` will parse arbitrarily large payloads, enabling potential DoS. | Enforce a body size limit via `NextRequest` config or middleware (`export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }`). |
| 🟡 Low | `POST` handler — `displayName` construction | **Display name collision risk**: two different people named "John Smith" with the same birthdate share an account. No uniqueness beyond name+DOB. | Add a system-generated unique identifier (e.g., `uuid`) to the user lookup, or require additional disambiguation fields. |

---

### Summary

| Severity | Count |
|---|---|
| 🔴 High | 2 |
| 🟠 Medium | 4 |
| 🟡 Low | 6 |

**Top priority fixes:**
1. **Strengthen the authentication model** — name+birthdate alone is trivially exploitable for impersonation.
2. **Fix the timezone bug** in age calculation — this is a logic error that can cause regulatory violations (underage access).
3. **Add a DB transaction + UNIQUE constraint** to prevent race-condition duplicate user creation.

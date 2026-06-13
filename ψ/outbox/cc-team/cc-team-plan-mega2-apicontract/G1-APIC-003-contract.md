<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-003 role=contract model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1171,"completion_tokens":5000,"total_tokens":6171,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 51s
 generated: 2026-06-13T12:07:31.132Z -->
The user wants an API contract audit of the provided Express route handler. I need to analyze it for:

1. Missing input validation
2. Inconsistent response shapes
3. Status-code correctness
4. Missing error responses
5. Undocumented params
6. Breaking-change risks

And output as a table with columns: | severity | endpoint | issue | fix |

Let me analyze the code carefully.

**Endpoints:**
- GET /api/admin/sessions
- DELETE /api/admin/sessions/:jti
- DELETE /api/admin/sessions/user/:userId

**Issues found:**

1. **GET / - Missing pagination/query params validation**
   - No pagination support (limit/offset/page). For a potentially large list of sessions, this is a performance/scalability issue. But the prompt asks about input validation, inconsistent response shapes, etc. Actually, there are no query params handled, but if the API accepts them, they should be validated. However, looking at the code, it doesn't even parse query params. But the issue is more about the fact that `listAll()` could return massive data. Not exactly input validation unless query params exist. Let me look closer.
   - Actually, the route doesn't accept any input, so input validation isn't missing for query/body. But wait - is there any possibility of query parameters being used? The code doesn't use req.query. So maybe not an input validation issue here.

2. **GET / - Inconsistent response shape**
   - Uses `{ success: true, count, data }` pattern. But is this consistent with the rest of the API? The prompt mentions "inconsistent response shapes". We should flag if the shape differs from standard REST or other endpoints. But we don't have other files. However, looking at the DELETE endpoints, they use `{ success: true, message, data }`. GET uses `{ success: true, count, data }`. The inconsistency is that GET has `count` at top level while DELETEs have `message`. This is a mild inconsistency but could be flagged.
   - Also, `data` is an array in GET but an object in DELETEs. That's fine, but the envelope structure should be consistent.

3. **DELETE /:jti - Input validation**
   - `jti` is checked for `!jti || typeof jti !== 'string'`. But `req.params.jti` is always a string in Express (unless undefined, which shouldn't happen if the route matched). So `typeof jti !== 'string'` is redundant but harmless. However, there's no format validation (e.g., UUID, length limit). If JTIs have a specific format, it should be validated.
   - Also, `jti` could be empty string if the URL is `/api/admin/sessions/` but that wouldn't match this route. Actually, Express would treat `/api/admin/sessions/` as matching the GET route or failing. Wait, if someone hits `/api/admin/sessions/` with DELETE, it might not match `/:jti` because the trailing slash behavior depends on strict routing. But assuming it matches, empty string is checked by `!jti`.
   - More importantly: `jti` is used directly without sanitization/validation beyond existence. If the registry expects a UUID, this could pass invalid values.

4. **DELETE /:jti - Status code correctness**
   - On success, returns 200 (implicit) with `{ success: true, ... }`. That's fine.
   - On self-revoke attempt, returns 400. Should this be 403 Forbidden? 400 means bad request, but the request syntax is valid; the user just isn't allowed to perform this specific action on this specific resource. 403 is more appropriate. Or 409 Conflict? Actually, 403 Forbidden is better because the server understands the request but refuses to authorize it. The error message even says "Cannot revoke your own session". That's an authorization/business rule, not a malformed request. So 400 → 403.
   - On target not found: 404. That's correct.
   - On invalid jti: 400. That's acceptable, though 404 might also work if empty string, but 400 is fine.

5. **DELETE /:jti - Missing error responses / edge cases**
   - `sessionRegistry.revoke(jti)` returns a boolean `revoked`. If `revoked` is false but target was found... wait, the code checks if target exists first. If target exists, then it revokes. But what if between `listAll()` and `revoke()` the session expires or is revoked by another request? That's a race condition. The code fetches all sessions, finds target, then revokes. If revoke fails (returns false), the code still returns 200 success because it only checks `if (revoked)`. Actually, if `revoked` is false, it doesn't enter the audit log block, but still returns 200 with success: true. That's wrong. If the revocation failed, it should return an error.
   - Also, `listAll()` could be expensive just to check existence. But that's an implementation detail.

6. **DELETE /:jti - Race condition / transactional safety**
   - Between `listAll()` and `revoke()`, the session could be modified. This is a TOCTOU (Time-of-check-time-of-use) issue. Severity: medium/high.

7. **DELETE /user/:userId - Input validation**
   - `parseInt(req.params.userId, 10)` with `isNaN` check. This is basic. But what if userId is negative? Zero? Float? `parseInt("123abc", 10)` returns 123, which passes. Wait, `req.params.userId` in Express is a string. If the URL is `/user/123abc`, `parseInt` returns 123, and `isNaN` is false. So invalid format like `123abc` is silently truncated instead of rejected. That's a validation bug. Should validate that the string is purely numeric (e.g., regex `/^\d+$/`) before parsing.
   - Also, no upper bound check on userId.

8. **DELETE /user/:userId - Status code correctness**
   - Self-lockout returns 400. Again, should be 403 Forbidden.
   - Success returns 200. That's fine.
   - What if user doesn't exist? The code doesn't check if the user exists before revoking. It just revokes all sessions for that userId. If the user doesn't exist, it returns success with count=0. Should it return 404 if the user doesn't exist? Depends on API design, but usually revoking sessions for a non-existent user could be 404. However, idempotency might suggest 200 is fine. But the audit log would show revoking 0 sessions for a non-existent user. This is ambiguous.

9. **DELETE /user/:userId - Missing error responses**
   - If `revokeAllForUser` throws, it's caught. But if it returns 0, no indication that the user might not exist.
   - Also, `count` is returned but not validated against expected.

10. **GET / - Undocumented params**
    - No query params for filtering (by user, by date), pagination, or sorting. If the API spec implies these exist, they're undocumented/unimplemented. But the code shows no evidence. However, the prompt asks for "undocumented params". Maybe there are no params, but if the parent router adds something? Actually, looking at the code, GET doesn't document any query params, but if clients pass them, they are ignored. That's fine. But maybe the issue is that `AuthRequest` might contain user info that affects the response? No, it's admin-only.

11. **Response shape inconsistency across all endpoints**
    - GET: `{ success: true, count: number, data: Session[] }`
    - DELETE /:jti: `{ success: true, message: string, data: { jti, userId, email } }`
    - DELETE /user/:userId: `{ success: true, message: string, data: { userId, sessionsRevoked: count } }`
    - The envelope is inconsistent: GET uses `count`, DELETEs use `message`. Standard REST usually uses a consistent envelope or no envelope. This is a contract issue.

12. **Missing Content-Type/Accept handling**
    - Not really visible in the code.

13. **Breaking-change risks**
    - If `sessionRegistry.listAll()` returns too many sessions, adding pagination later is a breaking change if not done with defaults.
    - The `data` field shape in GET returns raw session objects. If the session object contains sensitive fields (like token fingerprints, internal IDs), exposing them directly is a security issue and a breaking-change risk if fields are later removed.
    - The `email` field in the DELETE /:jti response comes from `target.email`. If the session registry changes and `email` is removed or renamed, this breaks.
    - The route order comment mentions `/user/:userId` must be before `/:jti`. This is a known Express routing issue. If someone refactors and swaps the order, `/user/123` would match `/:jti` with jti="user". This is a breaking-change risk / maintenance hazard. Actually, the comment says it must be declared BEFORE, and in the code it IS declared before. But this is fragile. A fix would be to use a more specific pattern for jti, e.g., `/:jti([0-9a-f-]{36})` or mount on a different path like `/session/:jti`. This is definitely a breaking-change risk because reordering routes breaks the API.

14. **Security: Information disclosure**
    - GET / returns all sessions including emails and potentially sensitive data without filtering.
    - The error messages in 500 cases leak internal state via console.error but not to client (that's fine).

15. **Async error handling**
    - The routes use async handlers but there's no `next(error)` or centralized async error handling. If an async error occurs outside the try-catch (unlikely but possible), it could crash the process. However, the try-catch blocks are present. But in Express, if an async handler throws and isn't caught, it's an unhandled rejection. The try-catch mitigates this, but if `logAdminAction` throws, it's caught. Good.

16. **DELETE /:jti - Audit log failure handling**
    - If `logAdminAction` throws (e.g., DB down), the catch block returns 500, but the session was already revoked. This is a partial success/failure state. The operation is not atomic. The client gets 500 but the session is actually revoked. This is a serious contract issue: the client may retry, but the session is already gone (404 on retry). This is an idempotency/atomicity issue.

17. **DELETE /user/:userId - Same audit log issue**
    - If `revokeAllForUser` succeeds but `logAdminAction` fails, the catch returns 500 even though sessions were revoked. Not atomic.

18. **GET / - No 401/403 documented?**
    - The comment says parent router applies guards. But the handler doesn't explicitly handle cases where `req.user` is missing (though guards should prevent this). However, the code checks `req.user && ...` in DELETE routes. If `req.user` is undefined due to middleware misconfiguration, the self-lockout check is bypassed! That's a security issue. The code should probably assume `req.user` exists (since middleware guarantees it), but the optional chaining/checking suggests it might not. If `req.user` is missing, the self-lockout guard is bypassed entirely. Wait:
    ```typescript
    if (req.user && target.userId === req.user.userId) { ... }
    ```
    If `req.user` is undefined, this condition is false, so the check is skipped. An unauthenticated request (if it somehow got past middleware) could revoke any session. The fix is to assert `req.user` exists (non-null) or return 401 if missing. Since the parent router applies guards, `req.user` should always be present. The code should use `req.user!.userId` or have a hard fail if missing. This is a severity: high issue because middleware bypass or future changes could allow unauthenticated admin actions.

19. **Type safety**
    - `req.user` is typed but checked optionally. Not exactly a contract issue.

20. **DELETE /user/:userId - userId param name**
    - The param is `userId` but it's parsed as int. If the API contract says userId is a UUID string elsewhere, this is inconsistent. But we don't know. However, `parseInt` implies numeric ID. If other modules use UUIDs, this is inconsistent.

Let me structure the table.

Severity levels: Critical, High, Medium, Low, Info.

Issues to include:

1. **Critical / DELETE /:jti & /user/:userId** - Audit log failure after state mutation causes 500 on already-completed action; non-atomic and non-idempotent. Client retry will see 404 or different result. Fix: perform audit logging before state change, or use transactions, or catch audit errors separately and return 202/204 with warning, or make atomic.

2. **High / DELETE /:jti** - Self-revoke guard bypass if `req.user` is undefined. The `if (req.user && ...)` check allows bypass when unauthenticated. Fix: hard-require `req.user` (assert non-null) or return 401/403 if absent.

3. **High / DELETE /:jti** - TOCTOU race condition between `listAll()` + `find` and `revoke()`. Session could be expired/revoked by concurrent request; `revoke()` might fail but endpoint returns 200. Fix: make `revoke()` idempotent and return the session metadata atomically, or use a single atomic "get-and-revoke" operation.

4. **High / All** - Inconsistent response envelope. GET uses `{count, data}`, DELETEs use `{message, data}`. Fix: standardize envelope (e.g., `{success, data, meta?}` or pure REST HTTP codes without success wrapper).

5. **Medium / DELETE /user/:userId** - `parseInt` accepts malformed numeric strings (e.g., `123abc` → 123) without validation. Fix: validate param with regex `/^\d+$/` or schema before parsing.

6. **Medium / DELETE /:jti & /user/:userId** - Wrong HTTP status for business-rule denial (self-revoke). 400 Bad Request should be 403 Forbidden. Fix: return 403 for authorization/business rule violations.

7. **Medium / DELETE /user/:userId** - No check if target user exists; returns 200 with count=0 for non-existent users. Fix: verify user existence first and return 404, or document that 200 with count=0 is valid for idempotent design. (I'll flag this as medium).

8. **Medium / GET /** - No pagination/filtering; `listAll()` may unboundedly return large payloads. Fix: add `limit`/`offset` query params with defaults and max limits.

9. **Medium / All** - Route ordering fragility (`/user/:userId` before `/:jti`). Future refactoring or mounting changes can break routing. Fix: use regex constraint on `:jti` (e.g., UUID pattern) or nest under `/by-jti/:jti`.

10. **Medium / GET /** - Sensitive data exposure: returns raw session objects from registry without field filtering. If internal fields are added later, they leak. Fix: map sessions to a DTO/pick only documented fields.

11. **Low / DELETE /:jti** - `typeof jti !== 'string'` is redundant in Express params; clutters validation. Fix: remove or replace with format validation (UUID/length).

12. **Low / GET /** - Missing empty-state distinction: 200 with empty array vs no sessions. Not really an issue.

13. **Info / All** - `success` boolean field is redundant with HTTP status codes in REST design. Fix: use appropriate HTTP status codes and drop success wrapper to align with REST conventions. (Could be medium, but let's say Info/Low since it's design style).

Wait, the user asked specifically for: missing input validation, inconsistent response shapes, status-code correctness, missing error responses, undocumented params, breaking-change risks.

Let me make sure I cover all these categories.

- Missing input validation: #5 (parseInt), #11 (jti format), #8 (pagination params missing validation, though they aren't used... maybe "undocumented params" is better).
- Inconsistent response shapes: #4.
- Status-code correctness: #6 (400 vs 403), #3 (500 on partial success).
- Missing error responses: #7 (non-existent user), #3 (revoke failure not handled), #16 (audit log failure not handled gracefully).
- Undocumented params: #8 (pagination not supported but might be expected? Actually, if there are no params, maybe not. But the GET endpoint doesn't support pagination, which is a contract gap. I'll frame it as "Missing pagination parameters" under undocumented/missing).
- Breaking-change risks: #9 (route order), #10 (raw session exposure), #4 (inconsistent envelope is a breaking change risk if clients depend on shape).

Let me refine the list to be concrete and actionable.

Table columns: severity | endpoint | issue | fix

Rows:

1. **Critical** | `DELETE /:jti` & `DELETE /user/:userId` | Non-atomic audit logging: if `logAdminAction` fails after session mutation, endpoint returns 500 even though revocation succeeded; retries will see 404/session missing, violating idempotency. | Perform audit logging before destructive operation, or wrap both in a transaction/atomic unit; return 202/204 if audit is best-effort, or fail before mutating state.

2. **High** | `DELETE /:jti` | Self-revoke guard can be bypassed if `req.user` is undefined because of optional chaining (`req.user && ...`). | Assert `req.user` is non-null at handler start (e.g., `const user = req.user!;`) or return 401 if missing; do not allow undefined to bypass security checks.

3. **High** | `DELETE /:jti` | TOCTOU race: `listAll()` + `find` checks existence, then `revoke()` mutates; concurrent revocation or expiry causes `revoke()` to silently fail while endpoint still returns 200. | Use an atomic `getAndRevoke(jti)` that returns the revoked session or null; return 404 if it returns null, 200 only on actual revocation.

4. **High** | `GET /` | Unbounded data exposure: `listAll()` returns every active session with raw registry objects; future field additions leak sensitive data and payload size is unbounded. | Map results to a stable DTO exposing only documented fields; add pagination (`limit`/`offset`) to prevent unbounded responses.

5. **Medium** | `DELETE /user/:userId` | Weak input validation: `parseInt` silently truncates malformed numeric strings (e.g., `123abc` → `123`). | Validate `req.params.userId` against `/^\d+$/` (or schema) before parsing; reject 400 for non-numeric strings.

6. **Medium** | `DELETE /:jti` & `DELETE /user/:userId` | Incorrect status code for business-rule violations: returning 400 for self-revoke attempts instead of 403. | Return 403 Forbidden when an admin attempts to revoke their own session; 400 is reserved for malformed syntax.

7. **Medium** | `DELETE /user/:userId` | Missing error response for non-existent target user: returns 200 with `count=0` even if the user does not exist, making client unable to distinguish "user gone" from "user had no sessions". | Check user existence before revocation and return 404 if the user is not found; alternatively document that 200+count=0 covers both cases.

8. **Medium** | All | Inconsistent response envelope shapes: `GET` returns `{count, data}` while `DELETE` endpoints return `{message, data}`; clients must parse different top-level keys per method. | Standardize on a uniform envelope (e.g., `{success, data, meta:{count?}}`) or migrate to pure REST (HTTP status + resource body) to avoid breaking clients when new fields are added.

9. **Medium** | `DELETE /:jti` | Route ordering fragility: `/user/:userId` must be registered before `/:jti` or "user" is interpreted as a `jti`; future refactoring/mounting changes risk breaking the API contract. | Add a regex constraint to `:jti` (e.g., `/:jti([0-9a-f-]{36})`) or move to a disambiguated path such as `/by-jti/:jti`.

10. **Low** | `DELETE /:jti` | Redundant/insufficient `jti` validation: `typeof jti !== 'string'` is always true for Express params; missing format/length validation. | Replace with format validation (e.g., UUID regex, max length) to prevent injection or invalid registry lookups.

11. **Low** | `GET /` | Missing pagination query parameters are not supported/validated, yet listing all sessions is an unbounded operation. | Add and document `?limit` & `?offset` (or `?page` & `?pageSize`) with max-cap validation; return 400 for invalid query values.

12. **Info** | All | Mixed paradigms: `success` boolean field duplicates HTTP status semantics, complicating client error handling. | Remove `success` field; rely on HTTP status codes (2xx for success, 4xx/5xx for errors) and consistent error body schema `{error, code?, details?}`.

Wait, I should check if there are any other issues.

- In `DELETE /:jti`, the `revoked` boolean is returned by `sessionRegistry.revoke(jti)`. The code does:
  ```typescript
  const revoked = sessionRegistry.revoke(jti);
  if (revoked && req.user) { ... }
  res.json({ success: true, ... });
  ```
  If `revoked` is false, it still returns 200. This is a bug. But I already covered this under TOCTOU / non-atomic. Actually, the TOCTOU covers it. But what if `revoke` returns false for a different reason? The endpoint should check `revoked` and return an error if false. But since it already checked existence, false would mean it didn't exist or was already revoked. So returning 404 might be better. But the current code returns 200 regardless. I'll make sure the TOCTOU row mentions this.

- In `DELETE /user/:userId`, `revokeAllForUser` returns a count. If it throws, caught. But what if it returns 0? The code returns 200. That's fine if idempotent. But if the user doesn't exist, 200 with 0 is misleading. I covered that.

- `sessionRegistry.listAll()` in GET might contain revoked sessions? The comment says "active (non-revoked) sessions". The function name `listAll` is ambiguous but comment says it lists active. I'll assume it's correct.

- The `

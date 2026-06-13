<!-- cc-team deliverable
 group: G1 (sideapi division)
 member: SIDE-003 role=audit model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1238,"completion_tokens":5000,"total_tokens":6238,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T12:07:30.103Z -->
The user wants a bug and security audit of the provided Express.js route module. I need to analyze it for:

1. Input validation
2. Error handling
3. Auth
4. Injection
5. Resource limits

And output a table with columns: severity | location | issue | fix

Let me go through the code carefully.

**Module overview:**
- `courtOrders.ts` - Express router for court order related endpoints
- Uses `query`, `getMode`, `isDetectBridge` from "../db"
- Three routes:
  1. GET `/:orderId/url-count`
  2. GET `/by-order-no/:orderNo/url-count`
  3. GET `/top-by-url-count`

**Analysis per category:**

**1. Input Validation:**

- Route `/:orderId/url-count`: 
  - In detect_bridge mode: `orderId` is used directly in SQL parameter, which is fine (parameterized), but no validation on what `orderId` contains. Could be extremely long string causing DB issues? Actually parameterized queries handle that, but still might be a DoS if the string is massive. No length validation.
  - In non-detect mode: checks `!Number.isFinite(Number(orderId))`. This is weak. `Number("")` is 0, which is finite. `Number(" ")` is 0. `Number(null)` is 0 but it's from params so string. Actually `Number("0")` is 0 and finite. What about `Number("Infinity")`? `Number.isFinite(Number("Infinity"))` is false, so that's caught. But `Number("123abc")` is NaN, and `Number.isFinite(NaN)` is false. So it catches NaN. But what about empty string? `Number("")` is 0, finite, so it passes. Is 0 a valid orderId? Maybe not. Also negative numbers pass. The check should probably be `Number.isInteger(Number(orderId)) && Number(orderId) > 0` or use a regex. Also `Number(orderId)` is used in the query, but if `orderId` is something like `"1 OR 1=1"`, `Number()` gives NaN, so it gets rejected. That's okay. But empty string/whitespace becomes 0 and passes.

- Route `/by-order-no/:orderNo/url-count`:
  - No validation on `orderNo` at all. In detect_bridge mode, used directly in parameterized query. In non-detect mode, used in parameterized query. But no length/type validation. Could be empty string, very long string, etc.

- Route `/top-by-url-count`:
  - `const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 20);`
  - `Number(req.query.limit)` with non-numeric strings gives NaN, so `|| 10` handles it. But what if `req.query.limit` is an array? Express query parsing can make it an array if `?limit=10&limit=20`. `Number([])` is 0, `Number([10])` is 10, `Number([10,20])` is NaN. So it defaults to 10. That's okay.
  - However, `Math.min(Math.max(1, Number(...)), 20)` - if someone passes a huge number, it caps at 20. Good.
  - But what about negative? `Math.max(1, ...)` handles it.
  - What about float? `Number("1.5")` is 1.5, `Math.max(1, 1.5)` is 1.5, `Math.min(1.5, 20)` is 1.5. SQL LIMIT with float? MySQL might accept it and truncate, but it's weird. Should probably be integer.

**2. Error Handling:**

- All routes have try-catch that returns `res.status(500).json({ ok: false, error: e.message })`.
- **Issue**: Exposing raw error messages (`e.message`) to the client is an information disclosure risk. It can leak SQL details, table names, internal paths, etc.
- **Issue**: In `/:orderId/url-count`, if `scaffoldGuard` sends a response, the function returns. That's fine.
- **Issue**: In `/by-order-no/:orderNo/url-count`, if `orderRows` is empty, it returns `res.json(...)`. That's fine.
- **Issue**: No async error handling for unhandled rejections? The try-catch covers the awaited queries.
- **Issue**: If `res` is sent twice (e.g., if `scaffoldGuard` somehow doesn't return properly, but it does return boolean and the route returns if true. That seems okay).

**3. Auth:**

- **Critical**: No authentication or authorization middleware on any of these routes. Anyone with network access can query court order data. This is sensitive legal/government data (court orders). There should be auth checks.
- **Critical**: No rate limiting. The endpoints query database and could be abused.

**4. Injection:**

- The code uses parameterized queries with `?` placeholders. That prevents SQL injection.
- **BUT**: In the `/top-by-url-count` route, the SQL query uses `LIMIT ?` with parameterized value. That's safe.
- **BUT**: In `/:orderId/url-count`, the non-detect mode does `Number(orderId)` and passes that number. That's safe.
- **However**: In detect_bridge mode, `orderId` is passed as string parameter. Safe.
- **Wait**: Is there any string concatenation? No, all use `?` placeholders. So SQL injection is mitigated via parameterization.

**5. Resource Limits / DoS:**

- **No request size limits explicitly in this file** (though Express might have them globally).
- **No query timeout**: Database queries could hang if the DB is slow or the data is huge. The `COUNT(*)` queries might be expensive on large tables without proper indexing. `top-by-url-count` does `GROUP BY` and `ORDER BY` which could be expensive.
- **No rate limiting**: As mentioned under auth.
- **String length**: `orderId` and `orderNo` are not validated for max length. Extremely long strings could cause memory issues or DB errors (though parameterized queries handle large strings, it could still be a DoS vector).
- **Connection pool exhaustion**: If queries are slow and many requests come in, no rate limiting means the DB connection pool could be exhausted.

**Other issues:**

- **Type casting**: `(rows as any[])` is used everywhere. If `query` returns something unexpected, it could crash. But that's more of a type safety issue.
- **Missing `await`?** No, all queries are awaited.
- **HTTP 400 for invalid orderId**: In `/:orderId/url-count`, if validation fails, it returns 400 but doesn't exit the function? Wait, let me check:
  ```typescript
  if (!Number.isFinite(Number(orderId))) return res.status(400).json({ ok: false, error: "Invalid orderId" });
  ```
  Yes, it has `return`, so it exits. Good.

- **In `/by-order-no/:orderNo/url-count`**: 
  ```typescript
  if (!(orderRows as any[]).length) return res.json({ ok: true, ... });
  ```
  This returns 200 OK with a note. That's fine behaviorally, but should it be 404? Not necessarily a bug, but worth noting. The user asked for bugs/security, so I'll include it as low severity if at all.

- **In `/:orderId/url-count`**: The validation `!Number.isFinite(Number(orderId))` allows empty string. `Number("")` is 0, which is finite. So empty string passes validation and queries for case_id = 0. This is a bug.

- **In `/top-by-url-count`**: `limit` could be a float. SQL LIMIT expects integer. Passing float might work in MySQL (it casts), but it's sloppy. Should validate integer.

- **Information Disclosure**: `e.message` in 500 responses leaks internal details.

- **No AuthN/AuthZ**: This is the biggest security issue.

- **No Rate Limiting**: DoS vector.

- **Missing Input Sanitization/Length Checks**: `orderNo` and `orderId` strings could be very long.

- **Database Query Performance**: The `top-by-url-count` endpoint runs unbounded aggregation queries. Even with LIMIT 20, the DB has to sort the entire result set. Without indexes on `court_order`, `case_number`, `case_id`, etc., this could be a full table scan and temporary table sort. This is a resource exhaustion/DoS issue.

- **Scaffold mode leaks configuration**: The scaffoldGuard message says "Set WEBD_DB_HOST/USER/PASSWORD env vars." This leaks internal environment variable names, which is information disclosure (low severity).

Let me structure the table.

| severity | location | issue | fix |

Issues to include:

1. **Critical** - All routes - Missing authentication/authorization. Anyone can access court order data.
   Fix: Add auth middleware (e.g., JWT, session validation) and role checks.

2. **High** - All catch blocks - Information disclosure via raw error messages (`e.message`) sent to client.
   Fix: Log error internally, return generic "Internal server error" to client.

3. **High** - `/:orderId/url-count` (non-detect) - Weak input validation: `Number.isFinite(Number(orderId))` allows empty string, whitespace, and 0. `Number("")` is 0 which passes.
   Fix: Use strict integer validation, e.g., `/^\d+$/` or `Number.isInteger(Number(orderId)) && Number(orderId) > 0`.

4. **High** - `/by-order-no/:orderNo/url-count` - No input validation on `orderNo`. Accepts empty strings, extremely long strings, special characters.
   Fix: Add regex/length validation (e.g., max length 50, alphanumeric).

5. **High** - `/top-by-url-count` - `limit` accepts floats and doesn't validate type strictly. `Number()` on arrays/objects can produce unexpected results.
   Fix: Parse with `parseInt`, validate `Number.isInteger`, reject non-numeric input explicitly.

6. **Medium** - All routes - No rate limiting. Susceptible to DoS and brute force.
   Fix: Add Express rate-limit middleware per route/IP.

7. **Medium** - `top-by-url-count` - Expensive aggregation query (`GROUP BY ... ORDER BY ... LIMIT ?`) can cause full table scans and high CPU/memory if indexes are missing.
   Fix: Ensure DB indexes on `court_order`, `case_number`, `case_id`, `order_no`; add query timeouts.

8. **Medium** - `scaffoldGuard` - Information disclosure: error message reveals internal env var names (`WEBD_DB_HOST/USER/PASSWORD`).
   Fix: Return generic "Service unavailable" message; log detailed reason server-side.

9. **Low/Medium** - `/:orderId/url-count` - In detect_bridge mode, no validation on `orderId` length. Could pass extremely long strings to DB causing performance issues or errors.
   Fix: Enforce max length (e.g., 100 chars) on `orderId`/`orderNo`.

10. **Low** - `/by-order-no/:orderNo/url-count` - Returns 200 OK when order not found instead of 404. Semantic issue, not strictly security, but could be considered a bug. The user asked for "Bug + security audit". I'll include it as low severity bug.
    Fix: Return 404 status when order not found, or keep 200 if that's the intended API contract but document it. Actually, looking at the code, it returns `res.json(...)` without status, so 200. I'll mention it.

11. **Low** - `top-by-url-count` - `LIMIT ?` with potential float value. In MySQL this is tolerated but non-standard.
    Fix: Ensure integer limit.

Wait, I should check if there are any other subtle issues.

- **Type safety**: The `query` function is imported. If it doesn't properly parameterize, there could be injection. But assuming it uses mysql/mysql2 `?` placeholders, it's safe. I should not assume the `query` function is vulnerable unless there's evidence. The code uses `?` placeholders correctly.

- **Race condition / TOCTOU**: `getMode()` and `isDetectBridge()` are checked at request time. If mode switches mid-request? Not really an issue here.

- **HTTP Parameter Pollution**: In `/:orderId/url-count`, `req.params.orderId` is a string from Express, so safe. In `top-by-url-count`, `req.query.limit` could be an array. `Number(["10","20"])` is NaN, so defaults to 10. That's okay.

- **Missing `next()`**: Not applicable, these are final handlers.

- **CORS/Security headers**: Not visible in this file, but out of scope for this module audit unless explicitly part of the router. The user asked to audit this module.

Let me refine the list to be concise and impactful.

Actually, looking at `/:orderId/url-count` again:
```typescript
const orderId = req.params.orderId;
// ...
if (!Number.isFinite(Number(orderId))) return res.status(400).json({ ok: false, error: "Invalid orderId" });
```
If `orderId` is `"0"`, `Number("0")` is 0, finite. Passes.
If `orderId` is `"  "`, `Number("  ")` is 0, finite. Passes.
If `orderId` is `""`, `Number("")` is 0, finite. Passes.
This is definitely a bug.

Also, in detect_bridge mode for the same route, it doesn't do the `Number.isFinite` check at all. It just uses the string. So if you hit the same endpoint in detect_bridge mode with `orderId=""`, it queries `court_order = ''`. That might be valid data, but there's no validation. The validation is inconsistent between modes.

For `/by-order-no/:orderNo/url-count`, there is zero validation in both modes.

For `top-by-url-count`, the limit calculation:
`Number(req.query.limit)` where `req.query.limit` is undefined -> NaN -> `|| 10` -> 10.
If it's `"abc"` -> NaN -> 10.
If it's `"21"` -> 21 -> `Math.min(21, 20)` -> 20.
If it's `"-5"` -> -5 -> `Math.max(1, -5)` -> 1.
If it's `"1.5"` -> 1.5 -> passes through. SQL LIMIT 1.5? MySQL will truncate to 1. Not terrible but imprecise.
If it's an array `["10", "20"]` -> NaN -> 10.
If it's an object (rare in query but possible with JSON parsing middleware elsewhere) -> NaN -> 10.
So the main issue is float and lack of strict integer check.

Also, the `scaffoldGuard` message leak is minor but real.

The auth issue is critical. Even if this is mounted behind another router with auth, the module itself has no auth. In a security audit, defense in depth matters. I should note it as "No authentication/authorization checks within module" with severity depending on context. Since it's court orders (sensitive), Critical.

Let me organize the table. I'll aim for around 8-10 rows covering the most important points.

| severity | location | issue | fix |

1. Critical | All routes | Missing authentication and authorization; sensitive court-order data exposed to any network client | Add auth middleware (e.g., JWT/session) and enforce role-based access control before route handlers.

2. High | All catch blocks (`e.message`) | Information disclosure: raw database/driver error messages leaked to client, exposing schema/table names and internal paths | Log `e` server-side only; return generic `{ ok: false, error: "Internal server error" }` to client.

3. High | `GET /:orderId/url-count` (non-detect branch) | Weak validation: `Number.isFinite(Number(orderId))` accepts empty strings, whitespace, and `0` (`Number("") === 0`) | Validate with strict positive integer regex or `Number.isInteger(x) && x > 0` before querying.

4. High | `GET /by-order-no/:orderNo/url-count` | No input validation on `orderNo`; accepts empty strings, arbitrary length, and special characters | Enforce format/length validation (e.g., max 100 chars, alphanumeric/dash pattern) before DB call.

5. Medium | `GET /top-by-url-count` | `limit` accepts non-integer floats and lacks strict type validation; `LIMIT ?` with float is imprecise | Parse with `parseInt`, verify `Number.isInteger`, and reject malformed input explicitly.

6. Medium | All routes | No rate limiting or query timeouts; susceptible to DoS via expensive `COUNT(*)` / `GROUP BY` queries | Add Express rate-limit middleware and set DB query timeouts; consider caching for `/top-by-url-count`.

7. Medium | `scaffoldGuard` function | Information disclosure: 503 response reveals internal environment variable names (`WEBD_DB_HOST/USER/PASSWORD`) | Return generic "Service unavailable" message; log detailed config hint server-side only.

8. Low/Medium | `GET /:orderId/url-count` & `/by-order-no/...` | Unbounded string length for `orderId`/`orderNo` params can be passed to DB, risking memory/perf issues | Add max-length validation (e.g., 100 chars) to all string path parameters.

9. Low | `GET /by-order-no/:orderNo/url-count` | Returns HTTP 200 when order number is not found, which is semantically incorrect and may confuse API consumers | Return HTTP 404 (or 204) when the order does not exist, while keeping the informative body if desired.

Wait, is there an SQL injection risk I'm missing?
In `isDetectBridge()` mode for `/by-order-no/:orderNo/url-count`:
```typescript
const rows = await query(
  "SELECT COUNT(*) as c FROM nip WHERE court_order = ? OR case_number = ?",
  [orderNo, orderNo]
);
```
This is parameterized. Safe.

In non-detect:
```typescript
const orderRows = await query(
  "SELECT id FROM case_order WHERE order_no = ? LIMIT 1",
  [orderNo]
);
```
Parameterized. Safe.

So no SQL injection from this file, assuming `query` is a proper parameterized query wrapper.

What about the `LIMIT ?` in `top-by-url-count`? Parameterized. Safe.

One more thing: **Integer Overflow**. In `/:orderId/url-count`, `Number(orderId)` is passed. If `orderId` is a massive integer string, `Number()` might lose precision beyond `Number.MAX_SAFE_INTEGER` (9e15). Then it gets passed to SQL. This is unlikely to be exploitable but is a data integrity issue. I'll skip it as too theoretical unless the user wants everything.

Another thing: **Missing `Content-Type` / JSON validation?** Not relevant here.

Another thing: **CORS**: Not in file.

Another thing: **Unhandled Promise Rejection**: The routes use `async` with try-catch, so Express won't crash from unhandled rejections in these handlers (assuming Express 5+ or an async handler wrapper). But if `query` throws, it's caught. Good.

Another thing: **Business logic leak**: The `detect_bridge` vs `db_aces` mode logic is exposed in the response (`domain: "webd"`, `metric: ...`). Not really a security issue.

Let me double check the `scaffoldGuard` logic. It returns boolean. The routes do `if (scaffoldGuard(req, res)) return;`. This is fine.

Actually, looking at `top-by-url-count` in non-detect mode:
```sql
SELECT co.id, co.order_no, COUNT(cl.id) as url_count
FROM case_order co
LEFT JOIN case_listdata cl ON cl.case_id = co.id
GROUP BY co.id, co.order_no
ORDER BY url_count DESC
LIMIT ?
```
This is a `LEFT JOIN` with `GROUP BY`. If `case_listdata` is huge, this is expensive. The `COUNT(cl.id)` requires joining then grouping. Even with LIMIT 20, the DB has to compute the full aggregation and sort. This is a resource exhaustion vector. I'll keep it as Medium.

Also, in detect_bridge mode for `top-by-url-count`:
```sql
SELECT court_order, case_number, COUNT(*) as url_count
FROM nip
WHERE court_order IS NOT NULL AND court_order != ''
GROUP BY court_order, case_number
ORDER BY url_count DESC
LIMIT ?
```
Similarly expensive.

I think my list is solid. I'll present it clearly.

One final check: The user wants "Bug + security audit". So I should include the 200-on-not-found bug and the empty-string validation bug as bugs.

Let me finalize the table rows:

| severity | location | issue | fix |
|---|---|---|---|
| Critical | All routes | No authentication or authorization; sensitive court-order data exposed to any network client | Mount auth middleware (e.g., JWT/session validation) and enforce RBAC on the router. |
| High | All `catch` blocks | Information disclosure: raw exception messages (`e.message`) returned in 500 responses leak DB schema, table names, and internal paths | Log error details server-side; return generic `{ ok: false, error: "Internal server error" }` to clients. |
| High | `GET /:orderId/url-count` (db_aces branch) | Weak validation: `Number.isFinite(Number(orderId))` accepts empty strings, whitespace, and `0` because `Number("") === 0` | Use strict positive-integer validation (e.g., `/^\d+$/` or `Number.isInteger(x) && x > 0`). |
| High | `GET /by-order-no/:orderNo/url-count` | Zero input validation on `orderNo`; accepts empty strings, arbitrary length, and special characters | Add length cap (e.g., 100 chars) and format validation before DB lookup. |
| Medium | `GET /top-by-url-count` | `limit` parsing allows floats and non-integer types; `LIMIT ?` with float is imprecise | Parse with `parseInt`, verify `Number.isInteger`, and reject bad input explicitly. |
| Medium | All routes | No rate limiting or query timeouts; expensive aggregation/COUNT queries can exhaust DB connections/CPU | Apply per-IP rate limiting (e.g., `express-rate-limit`) and configure DB statement timeouts. |
| Medium | `scaffoldGuard` | Information disclosure: 503 body reveals internal env var names (`WEBD_DB_HOST/USER/PASSWORD`) | Return generic "Service unavailable" message; log detailed setup hint server-side. |
| Low | `GET /by-order-no/:orderNo/url-count` | Returns HTTP 200 when order number is not found instead of 404 | Return HTTP 404 (or 204) when the resource does not exist. |

I think that's a good, comprehensive table. I'll add a brief summary before or after if needed, but the user specifically asked for the table output. I'll provide just the table and maybe a

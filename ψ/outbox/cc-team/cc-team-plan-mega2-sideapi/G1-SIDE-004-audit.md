<!-- cc-team deliverable
 group: G1 (sideapi division)
 member: SIDE-004 role=audit model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1376,"completion_tokens":1739,"total_tokens":3115,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":998,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-13T12:07:39.828Z -->
| severity | location | issue | fix |
|---|---|---|---|
| **High** | All 3 endpoints | **No authentication/authorization** — all ISP analytics are publicly accessible to any anonymous caller | Add auth middleware (e.g. `router.use(requireAuth)`) or a role-based gate before these routes |
| **High** | `catch` blocks (lines ~30, ~57, ~80) | **Internal error message leakage** — `e.message` is returned verbatim, exposing DB dialect, table/column names, connection strings, stack fragments | Return a generic `"internal error"` to the client; log `e.message` server-side (`console.error` / structured logger) |
| **Medium** | `/reduction-rate` query | **No result-set limit** — `GROUP BY isp_name` with no `LIMIT` can return unbounded rows, enabling memory exhaustion and slow queries | Add `LIMIT` (e.g. 100 or 500) and/or accept a `limit` query param validated against a ceiling |
| **Medium** | `/month-over-month` query | **No result-set limit** — same unbounded `GROUP BY` as above | Add `LIMIT` + optional validated query param |
| **Medium** | All 3 endpoints | **No rate limiting** — heavy aggregation queries can be replayed at line rate, degrading DB performance for all tenants | Add `express-rate-limit` middleware (e.g. 60 req/min per IP or per API key) |
| **Medium** | All 3 endpoints | **No query timeout** — no `statement_timeout` / `max_execution_time`; a slow query blocks a DB connection indefinitely | Set a query timeout (e.g. 5 s) on the connection or per-statement; catch & handle timeout errors specifically |
| **Medium** | All 3 endpoints | **No input validation framework** — while current queries are static, there are no `express-validator` / `zod` schemas; any future param addition will be unprotected | Add a validation layer now (even if only asserting no unexpected query params) so the pattern exists |
| **Medium** | `scaffoldGuard` | **`getMode()` can throw** — if the mode check fails, the error propagates unhandled and crashes the request with an unstructured 500 | Wrap `getMode()` in try/catch; return 503 on failure |
| **Low** | All 3 endpoints | **`as any` casts everywhere** — bypasses TypeScript's type safety; a schema change silently breaks response shape | Define an interface for row shape (`{ isp_name: string; backlog: string }`) and cast once; or use a query builder that returns typed rows |
| **Low** | All 3 endpoints | **No server-side logging** — errors are only sent to the client, never logged; makes incident investigation impossible | Add `console.error(e)` or structured logger in every catch block before responding |
| **Low** | All 3 endpoints | **No caching** — identical heavy aggregations re-run on every request; unnecessary DB load under traffic | Add short-lived in-memory or Redis cache (e.g. 60 s TTL) for each metric |
| **Low** | All 3 endpoints | **No response-schema validation** — if the DB schema changes, malformed data is silently served | Validate outgoing payload against a defined schema (zod/Joi) in dev/test; strip unknown fields |
| **Low** | Module level | **No security headers** — no Helmet or manual `X-Content-Type-Options`, `Cache-Control` on sensitive data | Add `helmet()` at the app level; set `Cache-Control: no-store` on analytics responses |
| **Info** | `/top-backlog` query | **Hardcoded `LIMIT 10`** — not configurable; consumers who need top-20 or top-50 cannot get it | Accept an optional `limit` query param, validated to `[1..200]`, defaulting to 10 |

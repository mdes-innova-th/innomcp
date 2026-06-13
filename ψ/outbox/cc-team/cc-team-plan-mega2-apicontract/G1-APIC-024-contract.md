<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-024 role=contract model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":895,"completion_tokens":2432,"total_tokens":3327,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1459,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T12:13:08.349Z -->
# API Contract Audit — `GET /api/mother/bus-log`

| severity | endpoint | issue | fix |
|----------|----------|-------|-----|
| 🔴 High | `GET /` | Error response returns HTTP **200** instead of 5xx — the `catch` block sends `{ error: "inbox not accessible" }` with status 200 | `res.status(500).json({ … })` for unexpected errors; `503` if the inbox is temporarily unavailable |
| 🔴 High | `GET /` | `inboxPath` leaks absolute server filesystem path (`C:/Users/USER-NT/Jit/ψ/inbox`) in every response | Remove `inboxPath` from the response payload entirely; if needed for debugging, gate behind an admin/auth flag or return a relative/obfuscated path |
| 🟠 Medium | `GET /` | Inconsistent response shapes across the three code paths — success has `inboxPath` but no `error`; error has `error` but no `inboxPath`; missing-inbox has `inboxPath` but no `error` | Define and return a single envelope: `{ messages, total, timestamp, error?: string }` — always include the same top-level keys |
| 🟠 Medium | `GET /` | `total` is misleading — it returns `messages.length` (the count *returned*), not the total number of files in the inbox | Rename to `count` or `returned`; if "total" is intended, compute it from all `.md` files before the `slice(0, limit)` |
| 🟠 Medium | `GET /` | `limit` query param is undocumented — no type, range, default, or max specified in any contract | Add OpenAPI/JSDoc: `limit` → integer, default 10, min 1, max 50 |
| 🟠 Medium | `GET /` | Invalid `limit` values (e.g. `?limit=abc`, `?limit=-3`) are silently coerced instead of returning **400** | Validate explicitly: if `isNaN(raw)` or `raw < 1`, return `400 { error: "Invalid limit parameter" }` |
| 🟠 Medium | `GET /` | Missing-inbox path returns **200** with empty array — client cannot distinguish "no messages" from "inbox not found" | Return `404` if the inbox directory is expected to exist, or add a `found: boolean` field |
| 🟠 Medium | `GET /` | All `fs` operations are synchronous (`existsSync`, `readdirSync`, `statSync`, `readFileSync`) — blocks the event loop under load | Refactor to `fs.promises.readdir` / `fs.promises.stat` / `fs.promises.readFile` with `async` handler |
| 🟡 Low | `GET /` | Inner `catch` silently skips unreadable files — client has no way to know files were dropped | Add `skipped: number` or `warnings: string[]` to the response |
| 🟡 Low | `GET /` | `_req` parameter name signals "unused", but `req.query.limit` is accessed | Rename `_req` → `req` |
| 🟡 Low | `GET /` | Frontmatter parsing is fragile — `line.startsWith("from:")` matches `fromAddress:`; no handling of quoted values or colons in values | Use regex `/^(from|to|timestamp|subject):\s*(.*)$/` and extract the capture group; handle edge cases |
| 🟡 Low | `GET /` | `BusMessage.from/to/timestamp/subject` are all optional — downstream clients cannot distinguish "field absent in file" from "field present but empty" | Document optionality explicitly; consider emitting `null` instead of `undefined` for missing fields so JSON serializes them |
| 🟡 Low | `GET /` | `preview` truncation length (150) and `modifiedAt` format are undocumented contract details that are breaking-change risks | Document: `preview` max 150 chars, `modifiedAt` is ISO 8601, `timestamp` in frontmatter is passthrough |
| 🟡 Low | `GET /` | No API versioning — any change to response shape, field names, or `preview` length is a silent breaking change | Add `/v1/` prefix or include a `version` field; document stability guarantees |

---

### Summary of the 3 most critical fixes

1. **Use proper status codes** — 400 for bad input, 404 for missing inbox, 500 for unexpected errors. Never return 200 on an error path.
2. **Stop leaking `inboxPath`** — it reveals the server's OS, username, and directory structure. Remove it from the public contract.
3. **Unify the response envelope** — every code path must return the same set of top-level keys. Use `error?: string` as an optional field rather than swapping keys in/out.

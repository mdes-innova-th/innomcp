<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-024 role=perf model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":480,"completion_tokens":1214,"total_tokens":1694,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":876,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T12:03:18.920Z -->
| severity | location | issue | fix |
|---|---|---|---|
| High | `exportToJSON` | `JSON.stringify` with pretty-print (`null, 2`) is synchronous and blocks the event loop for large payloads | Use streaming JSON serializer; make async; default to compact output |
| High | `exportToJSON` / `exportToCSV` | No default limit — `motherHistory.get(undefined)` returns unbounded data, risking OOM | Enforce a sensible default limit (e.g., `Math.min(options.limit ?? 1000, MAX_EXPORT)`) |
| High | `exportToCSV` | `flatMap` + `map` materializes the entire denormalized row set in memory before string assembly — peak memory ≈ 2× payload | Stream rows via generator/async iterator; write to a `Writable` stream instead of accumulating |
| Medium | `exportToCSV` | CSV escaping is incomplete — only escapes `"` but not newlines, carriage returns, or commas inside unquoted fields | Quote any field containing commas, newlines, or CRs; escape per RFC 4180 |
| Medium | `exportToJSON` / `exportToCSV` | Full input array and full output string held simultaneously — peak memory ≈ 2× payload | Process and flush in chunks; release input references incrementally |
| Medium | `exportToJSON` | No caching — identical export requests re-serialize the entire dataset every time | Memoize result keyed by `(limit, historyVersion)` with invalidation on history mutation |
| Low | `exportToCSV` | `rows.map(row => row.join(","))` allocates an intermediate string array before final `join("\n")` | Build CSV in a single pass using a string builder or direct stream write |
| Low | `exportToJSON` | Pretty-print inflates payload ~2× vs compact JSON | Default to compact; make pretty-print opt-in via `ExportOptions` |

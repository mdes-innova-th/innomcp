<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-024 role=typesafe model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":480,"completion_tokens":2370,"total_tokens":2850,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2122,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T12:02:44.901Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `exportToCSV` -> `run.query.replace` | Missing null/undefined guard on `run.query` | `(run.query ?? "").replace(/"/g, '""')` |
| High | `exportToCSV` -> `p.preview.replace` | Missing null/undefined guard on `p.preview` | `(p.preview ?? "").replace(/"/g, '""')` |
| Medium | `exportToJSON` -> `JSON.stringify(history)` | Unhandled exception if `history` contains circular references | Wrap in try/catch, return fallback string or throw typed error |
| Medium | `exportToCSV` -> `run.timestamp` | Implicit type coercion if `timestamp` is a `Date` object | Use `run.timestamp instanceof Date ? run.timestamp.toISOString() : run.timestamp` |
| Low | `exportToJSON` -> `JSON.stringify(history)` | `JSON.stringify` returns `undefined` if input is `undefined`, violating `string` return type | Guard `history` for `undefined` before stringifying |

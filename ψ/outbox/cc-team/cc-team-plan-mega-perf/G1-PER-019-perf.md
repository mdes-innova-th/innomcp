<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-019 role=perf model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1406,"completion_tokens":2095,"total_tokens":3501,"prompt_tokens_details":{"cached_tokens":1376,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1714,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T12:02:50.858Z -->
| severity | location | issue | fix |
|---|---|---|---|
| High | `callBatch` | Unbounded concurrency — `Promise.all` on an unrestricted array fires every request simultaneously; a large batch exhausts sockets/memory | Cap batch size; use a concurrency limiter (e.g. `p-limit`) so at most N requests are in-flight at once |
| High | `requestOnce` → `resp.json()` | No response size limit — a multi-MB payload is fully buffered and parsed into a single JS object, risking OOM | Check `Content-Length` before reading; stream-parse with a byte cap; reject oversized responses |
| Medium | `safeReadText` | Reads entire error body into memory (`await resp.text()`) then slices to 500 — allocates the full body just to discard most of it | Read via streaming `ReadableStream` with a byte budget (e.g. 512 B), or at minimum check `Content-Length` and skip large bodies |
| Medium | `callTool` | No deduplication of identical concurrent calls — N callers invoking the same tool+params produce N independent HTTP requests | Maintain an in-flight `Map<string, Promise>` keyed by `toolName+serialized(params)`; coalesce concurrent calls onto one request |
| Medium | `requestOnce` → `JSON.stringify(params)` | No bound on request payload size — a caller passing a massive `params` object serialises it entirely into memory | Validate `params` size (e.g. `Buffer.byteLength(JSON.stringify(params))`) against a configurable max before sending |
| Low | `callTool` retry loop | Linear backoff (`RETRY_BACKOFF_MS × (attempt+1)`) without jitter — under sustained failures, all clients retry in lockstep (thundering herd) | Switch to exponential backoff with random jitter: `2^attempt * base ± random` |
| Low | `getDefaultMcpClient` | Module-level `defaultClient` singleton is never evicted and captures `baseUrl`/`fetchImpl` for process lifetime | Acceptable for long-running Node processes; add an explicit `resetDefaultMcpClient()` for test isolation and document that the singleton is immortal |
| Low | `requestOnce` error path | Error message concatenates `status`, `statusText`, and up to 500 chars of body into a retained `Error` object — if many errors accumulate, string memory adds up | Truncate earlier; store status separately and keep body excerpt ≤ 200 chars; avoid retaining full error objects in long-lived collections |

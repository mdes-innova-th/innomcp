<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV009 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2205,"completion_tokens":2645,"total_tokens":4850,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2344,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T11:21:14.708Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `searchArchive` – lines 82, 93, 107 (logBoth calls) | `logBoth` is called without `await`; if it returns a Promise that rejects, the unhandled rejection may crash the Node.js process. | `await logBoth(...)` each call or add `.catch(() => {})` to safely swallow errors. |
| MEDIUM | `searchArchive` – `fetch(url.toString(), …)` | No timeout is set, allowing the fetch to hang indefinitely (e.g., network stall). This can block the MCP tool forever and leak resources. | Use `AbortSignal.timeout(10_000)` (or `AbortController` + `setTimeout`) to abort after a sensible timeout. |
| LOW | `searchArchive` – result mapping, `format: doc.format` | The code assumes `doc.format` is always an array; the API may return a scalar string. When it’s a string, `Array.isArray` is false and format data is silently omitted. | Normalize `doc.format` into an array (`Array.isArray(doc.format) ? doc.format : [doc.format]`) before assignment. |

**Risk Verdict:** Unhandled promise rejections from unawaited `logBoth` can crash the server; missing fetch timeout may cause indefinite hangs.

<!-- cc-team deliverable
 group: G2 (Server-node module audit)
 member: SV034 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2958,"completion_tokens":4351,"total_tokens":7309,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4064,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T11:32:59.965Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| MEDIUM | `withTmdAuthParams` | Throws `TypeError` for non-absolute or malformed `urlBase` (e.g., relative path) without a catch, crashing the tool call. | Validate `urlBase` with a try-catch and rethrow a descriptive error, or ensure callers never pass non-absolute URLs. |
| MEDIUM | `withTmdAuthParams` | Appends uid/ukey without removing any existing credentials leading to duplicate auth parameters, which may cause unpredictable API behavior or ambiguous credential use. | Check and delete `uid`/`ukey` from existing search params before adding new ones, to enforce a single source of truth. |
| MEDIUM | `fetchWithTimeout` | Relies on global `fetch` without a polyfill check; if the Node runtime does not provide it (pre‑v18 or without `--experimental-fetch`), the module silently fails at runtime. | Add a guard that verifies `typeof fetch === 'function'` at import time and throws a clear “fetch unavailable” error, or document the required Node version. |

**Risk Verdict:** Tools break on malformed URLs and duplicate auth, with a potential runtime crash on fetch‑unaware Node – overall robustness is compromised.

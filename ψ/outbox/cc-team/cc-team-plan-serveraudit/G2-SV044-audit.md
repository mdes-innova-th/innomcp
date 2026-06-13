<!-- cc-team deliverable
 group: G2 (Server-node module audit)
 member: SV044 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":922,"completion_tokens":3392,"total_tokens":4314,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3216,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T11:35:07.217Z -->
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| HIGH | `getPoolDetect` function (line ~38) | Race condition: unprotected lazy init of `poolDetect` can create multiple `mysql.Pool` instances when called concurrently, leaking connections and resources. | Use a promise-based single-instance pattern. For example: declare `let poolDetectPromise: Promise<mysql.Pool> | null = null;` and modify `getPoolDetect` to return `await (poolDetectPromise = poolDetectPromise ?? (async () => { const cfg = resolveDetectDbConfig(); return mysql.createPool(cfg); })());`. Update callers to `await getPoolDetect()`. |

**Risk verdict:** Concurrent startup queries can exhaust connection limits due to leaked duplicate pools.

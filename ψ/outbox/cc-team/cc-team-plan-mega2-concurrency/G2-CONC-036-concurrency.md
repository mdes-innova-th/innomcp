<!-- cc-team deliverable
 group: G2 (concurrency division)
 member: CONC-036 role=concurrency model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2176,"completion_tokens":2135,"total_tokens":4311,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1832,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T12:17:11.655Z -->
| Severity | Location | Race/Issue | Fix |
|----------|----------|------------|-----|
| **High** | `formatStream` method (lines 33–49) | **Shared mutable state without locks:** The instance variable `streamBuffer` is used to accumulate chunks across multiple calls. If two independent streams call `formatStream` concurrently (e.g., from different HTTP requests), their data will interleave, causing corruption. The buffer is not scoped to a specific stream. | Replace the singleton with per-stream buffers. For example, maintain a `Map<string, { buffer: string }>` keyed by a stream identifier, or create a new `ResponseFormatter` instance per stream. Ensure buffer operations are isolated. |
| **Medium** | `formatStream` lines 34-47 | **Check‑then‑act race:** The code checks `this.streamBuffer.includes('```')` (line 34) and later resets the buffer (line 46–47). Between the check and the reset, another call could modify the buffer, leading to lost data or incorrect fencing. Although JavaScript is single‑threaded, this pattern is fragile when the function is reused in async contexts or if refactored to include `await`. | Atomically capture a snapshot of the buffer for analysis, then reset it immediately after the snapshot. Example: `const snapshot = this.streamBuffer; this.streamBuffer = '';` then perform checks on `snapshot`. |

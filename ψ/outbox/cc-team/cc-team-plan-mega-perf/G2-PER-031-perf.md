<!-- cc-team deliverable
 group: G2 (perf division)
 member: PER-031 role=perf model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2476,"completion_tokens":2983,"total_tokens":5459,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2659,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T12:05:06.539Z -->
| severity | location | issue | fix |
| --- | --- | --- | --- |
| Medium | `streamOpenAI` / `streamAnthropic` (streaming loops) | String concatenation (`buffer += decoder.decode(...)`) per chunk causes O(n²) time and memory for long responses. | Accumulate decoded strings in an array and join only when processing lines, or use a `TextDecoder` with `stream: true` and keep a single partial-last-line buffer without repeated concatenation across chunks. |
| Medium | `callOpenAI` / `callAnthropic` (non‑streaming) | Full JSON response parsed into memory; large token responses (e.g., 100k+) can cause high memory usage. | If supported by the API, prefer streaming for large outputs; otherwise consider streaming JSON parsing or pagination. |
| Low | `streamOpenAI` (line processing) | The `break` inside the `for` loop only exits the inner loop, not the outer `while`. After `[DONE]` the stream is closed, but an extra `reader.read()` may still be performed. | Replace `break` with a dedicated flag or immediate `return` after sending `{ type: "done" }` to avoid unnecessary I/O after stream completion. |
| Low | `streamAnthropic` (truncated) | Similar concatenation and break issues as `streamOpenAI` are expected if the pattern is identical (code truncated). | Apply the same fixes as for `streamOpenAI`. |

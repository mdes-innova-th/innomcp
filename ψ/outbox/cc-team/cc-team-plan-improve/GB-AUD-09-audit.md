<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-09 role=audit model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1746,"completion_tokens":4810,"total_tokens":6556,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4056,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T11:13:17.229Z -->
| severity | location | issue | proposed fix |
|---|---|---|---|
| HIGH | `sanitize` | XSS bypass: regex `\son\w+="[^"]*"` misses unquoted event handlers (e.g., `onerror=alert(1)`); `\sjavascript:` misses `href="javascript:..."`; `<\/script>` misses `<\/script >` (space before `>`). | Replace regex-based sanitization with a battle-tested library like DOMPurify. |
| HIGH | `formatStream` / `streamBuffer` | Race condition/state corruption: `streamBuffer` is instance state on a Singleton. Concurrent requests will interleave chunks in the same buffer, corrupting streams. | Remove `streamBuffer` from the Singleton; pass a dedicated state object per stream, or instantiate `ResponseFormatter` per request. |
| MED | `formatStream` | Resource leak: If a stream ends with an unclosed code block (odd number of fences), `streamBuffer` retains the data indefinitely, leaking memory across the Singleton's lifetime. | Add a `flush()` or `endStream()` method to force-clear the buffer and return remaining data, resetting state. |
| MED | `renderMarkdown` | Incorrect formatting: Inline replacements (e.g., `**...**` to `<strong>`) are applied globally after code block extraction, corrupting content inside `<pre><code>` tags. | Extract code blocks into temporary placeholders, apply inline formatting to the remaining text, then restore the code blocks. |
| LOW | `truncate` | Contract violation: If `maxLength < ellipsis.length` (e.g., `maxLength=1`, `ellipsis='...'`), the returned string length exceeds `maxLength`. | Add an early return: `if (maxLength <= ellipsis.length) return text.slice(0, maxLength);` |
| LOW | `estimateReadingTime` | Silent logic error: `Math.max(1, ...)` forces a minimum of 1 word, causing empty strings to return a reading time of 1 second instead of 0. | Change to `Math.max(0, ...)` and return `0` if word count is `0`. |

Overall risk verdict: High risk due to critical XSS bypasses and concurrent state corruption in the singleton stream buffer.

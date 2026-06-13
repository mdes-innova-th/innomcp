<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV022 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2722,"completion_tokens":3040,"total_tokens":5762,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2612,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T11:27:21.028Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `fetchAPOD` function (line ~80) | `fetch()` has no timeout/AbortController; request can hang indefinitely, causing resource leak and tool unresponsiveness. | Add `AbortSignal.timeout(10_000)` to `fetch(url.toString(), { signal: AbortSignal.timeout(10000) })` (or configurable) to reject after a deadline. |
| MEDIUM | `fetchAPOD` → "today"/"now"/"วันนี้" handling (line ~90) | Uses `new Date().toISOString().split('T')[0]` which returns UTC date. NASA APOD may use a different day boundary (e.g., EST), leading to a mismatch when user's local date differs from UTC date. | Compute date in a fixed timezone (e.g., America/New_York) using `Intl.DateTimeFormat` or document that "today" is UTC-based. |
| LOW | Input validation in `fetchAPOD` (line ~100) | Regex `/^\d{4}-\d{2}-\d{2}$/` does not validate actual calendar date (e.g., "2024-02-30" passes). Invalid date sent to NASA API will return error, but silently fails with generic error after full fetch attempt. | Add date validation (e.g., `new Date(dateStr).toISOString().startsWith(dateStr)` and check `!isNaN(...)`) before calling API to give early clear error. |
| LOW | `formatSingleAPOD` (line ~180) | If `media_type` is neither "image" nor "video", the "🔗 Image URL:" line prints no following content, producing a misleading placeholder. | Add an `else` branch to log unknown type or handle gracefully. |

**Risk verdict:** HIGH – Missing fetch timeout can cause indefinite hanging and resource leak; UTC "today" logic may silently return wrong APOD.

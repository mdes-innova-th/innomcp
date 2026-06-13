<!-- cc-team deliverable
 group: G2 (errlog division)
 member: ERR-029 role=errlog model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1568,"completion_tokens":1249,"total_tokens":2817,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1058,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-13T12:04:29.420Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| High | `broadcast` function, empty `catch` block (`try { ws.send(payload); } catch { ... }`) | Swallowed error – WebSocket send failures are silently discarded with **zero logging**. This hides disconnections, backpressure issues, or serialisation problems, making production debugging impossible. | Log the error at `warn` or `error` level including the `projectId`, `userId`, and error message. Optionally count consecutive failures to trigger proactive cleanup. |
| Medium | `broadcast` function | Missing error context – when a send fails there is no information about which client/project failed, preventing correlation with user experience. | Add structured logging inside the catch (e.g., `logger.warn({ projectId, userId: entry.userId, err }, 'broadcast send failed')`). |

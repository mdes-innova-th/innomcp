<!-- cc-team deliverable
 group: G1 (errlog division)
 member: ERR-014 role=errlog model=zai-org/GLM-5.1
 finish_reason: length | tokens: {"prompt_tokens":2033,"completion_tokens":5000,"total_tokens":7033,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5313,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-13T12:01:49.422Z -->
| severity | location | issue | fix |
|---|---|---|---|
| **High** | `runCheckerWithTimeout` | **Unhandled promise rejection**: If `checker()` resolves before the timeout, the timeout promise rejects later with no handler, crashing the process in Node.js ≥ 15. | Store the timeout ID and call `clearTimeout()` immediately after `Promise.race` settles. |
| **High** | `runChecker

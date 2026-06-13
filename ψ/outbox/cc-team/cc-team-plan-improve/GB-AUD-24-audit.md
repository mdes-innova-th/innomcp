<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-24 role=audit model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":899,"completion_tokens":2831,"total_tokens":3730,"prompt_tokens_details":{"cached_tokens":128,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2423,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T11:16:37.252Z -->
| severity | location | issue | proposed fix |
|----------|----------|-------|--------------|
| HIGH | `handleRequest` (primary execution) | If `this.guard.executeWithGuard` or `this.dispatch` throws an exception instead of returning an object with an `.error` property, the entire method rejects immediately, completely bypassing the fallback logic. | Wrap the primary and fallback `await this.guard.executeWithGuard(...)` calls in a `try/catch` block, treating caught exceptions as failed attempts so fallbacks can execute. |
| MED | `handleRequest` (fallback loop) | If `plan.fallbacks` is `undefined` or `null` (e.g., router returns a plan with no fallbacks), `for (const fb of plan.fallbacks)` throws a `TypeError`, crashing the request after the primary tool fails. | Default to an empty array: `for (const fb of plan.fallbacks ?? [])` |
| MED | `handleRequest` (final return) | Returning `rawPacket` directly on total failure bypasses `this.aggregator.format()`, risking an inconsistent response shape that violates the `WeatherPacket` interface contract. | Return a standardized error `WeatherPacket` or format `rawPacket` via `this.aggregator.format(rawPacket)` before returning. |
| MED | `handleRequest` (intent check) | If `this.intent.analyze(userMessage)` returns `null` or `undefined`, accessing `intentResult.domain` throws a `TypeError`. | Add a null check: `if (!intentResult \|\| intentResult.domain !== "weather" \|\| ...)` |
| LOW | `handleRequest` (packet checks) | If `executeWithGuard` returns `null`/`undefined`, `!rawPacket.error` or `!fbPacket.error` throws a `TypeError`. | Use optional chaining or explicit null checks: `if (rawPacket && !rawPacket.error)` |

Overall risk verdict: Unhandled exceptions in tool dispatch will silently bypass fallback mechanisms, causing unexpected request failures and missing fallback coverage.

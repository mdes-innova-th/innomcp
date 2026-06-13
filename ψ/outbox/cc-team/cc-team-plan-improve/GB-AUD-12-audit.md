<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-12 role=audit model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2167,"completion_tokens":2833,"total_tokens":5000,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2433,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T11:14:03.752Z -->
| severity | location | issue | proposed fix |
| :--- | :--- | :--- | :--- |
| HIGH | `selectProvider`, `getStats`, `resetAll` | Constructor accepts custom `primaryId`/`backupIds`, but these methods hardcode `DEFAULT_PRIMARY_ID`/`DEFAULT_BACKUP_IDS`. Passing custom IDs causes `this.statuses.get(...)` to return `undefined`, triggering a `TypeError` on property access due to the `!` non-null assertion. | Store `primaryId` and `backupIds` as private instance properties in the constructor and reference them instead of the global constants. |
| HIGH | `checkProvider` | Cooldown bypass: `if (!shouldAttemptCheck && status.healthy)` only skips the check if the provider is healthy. If unhealthy but the cooldown hasn't elapsed, it falls through and executes the health check anyway, completely defeating the circuit breaker cooldown. | Change the condition to `if (!shouldAttemptCheck) { return status.healthy; }`. |
| MED | `checkProvider` | Thundering herd: `status.lastCheck` is only updated *after* the async `healthChecker` resolves (inside `markFailed`/`markHealthy`). Concurrent calls right after cooldown expiry will all pass the `shouldAttemptCheck` gate and fire duplicate network checks. | Update `status.lastCheck = Date.now()` synchronously *before* `await this.healthChecker(...)`, or implement a per-provider in-flight promise lock. |
| LOW | `markFailed`, `markHealthy` | Unnecessary `async`: Methods are marked `async` but contain no `await` operations, adding unwarranted microtask queue overhead for simple synchronous state mutations. | Remove the `async` keyword and change the return type to `void`. |

HIGH RISK: Guaranteed runtime crashes when using custom provider configurations and a fundamentally broken circuit breaker cooldown mechanism.

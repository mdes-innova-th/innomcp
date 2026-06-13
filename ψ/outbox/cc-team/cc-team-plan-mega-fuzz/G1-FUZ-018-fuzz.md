<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-018 role=fuzz model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1878,"completion_tokens":5000,"total_tokens":6878,"prompt_tokens_details":{"cached_tokens":68,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T12:03:41.817Z -->
The user wants property-based / fuzz test cases for the provided TypeScript module `providerFailover.ts`.

 I need to:
 1. Enumerate input invariants and properties that must always hold.
 2. Identify adversarial/malformed/boundary inputs that could break them.
 3. Output a markdown list in the format: property → fuzz input → expected invariant.
 4. Be concrete, no filler.

 Let's analyze the code carefully.

 **Module Analysis:**

 `ProviderFailover` class:
 - Constructor: takes `primaryId`, `backupIds`, `failThreshold`, `cooldownMs`.
   - Defaults: `DEFAULT_PRIMARY_ID = 'mdes-ollama'`, `DEFAULT_BACKUP_IDS = ['ollama-local', 'openai-compatible']`, `DEFAULT_FAIL_THRESHOLD = 3`, `DEFAULT_COOLDOWN_MS = 60000`.
   - Initializes `statuses` Map with all providers (primary + backups).
   - Sets `activeProviderId` to `primaryId`.
   - **BUG/INVARIANT**: `selectProvider` always uses `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS`, ignoring constructor arguments `primaryId` and `backupIds`. This is a critical bug. The constructor stores them in the map keys, but `selectProvider`, `getStats`, `resetAll` use the constants. Wait, `resetAll` iterates over `this.statuses.values()`, so it resets whatever is in the map. But `selectProvider` and `getStats` hardcode `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS`.
   - **INVARIANT**: If user passes custom `primaryId`/`backupIds`, `selectProvider` should respect them. But it doesn't. This is a property to test.

 - `setHealthChecker(fn)`: sets `this.healthChecker`.
   - Fuzz input: `null`, `undefined`, function throwing, function returning non-Promise, function returning malformed objects.

 - `selectProvider(_task?: string)`: async, returns string.
   - Hardcodes `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS`.
   - Checks `primaryStatus.healthy`. If true, returns primary.
   - Else iterates `DEFAULT_BACKUP_IDS`. Returns first healthy.
   - Else returns primary and logs warning.
   - **INVARIANT**: Return value must always be a provider ID present in `this.statuses`.
   - **INVARIANT**: If primary is healthy, must return primary (if we ignore the constructor bug, but with the bug it returns DEFAULT_PRIMARY_ID even if a different primary was passed).
   - **INVARIANT**: `this.activeProviderId` must equal returned ID.
   - **INVARIANT**: If no providers healthy, still returns a string (primary ID).
   - Fuzz input: `_task` can be any string, empty, undefined, null (though TS might prevent null at compile time, runtime fuzz can pass it). Since it's unused, shouldn't matter, but we should test it doesn't crash.

 - `markFailed(providerId: string)`: async, void.
   - Looks up provider. If unknown, logs and returns.
   - Increments `failCount`, updates `lastCheck`.
   - If `failCount >= failThreshold`, sets `healthy = false`.
   - **INVARIANT**: `failCount` only increments for known providers.
   - **INVARIANT**: `healthy` must be false if `failCount >= failThreshold`.
   - **INVARIANT**: `healthy` must remain true if `failCount < failThreshold`.
   - **INVARIANT**: `lastCheck` must be updated to a timestamp >= previous `lastCheck`.
   - Fuzz input: unknown providerId, empty string, null, undefined, special chars, very long string. `failThreshold` boundary: exactly at threshold, one below, one above. `failThreshold` could be 0, 1, negative? Constructor accepts any number. If `failThreshold` is 0, first failure makes it unhealthy immediately because `0 >= 0`. If negative, `failCount` (starts at 0) will never be >= negative? Actually 0 >= -1 is true, so it would immediately mark unhealthy on first call? Wait, `failCount` starts at 0. If `failThreshold` is -1, then `0 >= -1` is true, so it becomes unhealthy immediately on first `markFailed` (which makes `failCount` 1). But what if `failThreshold` is 0? `1 >= 0` true. So yes, first failure marks unhealthy. What if `failThreshold` is `NaN`? `1 >= NaN` is false, so never unhealthy. `Infinity`? Never unhealthy unless failCount reaches Infinity.

 - `markHealthy(providerId: string, latencyMs: number)`: async, void.
   - Looks up provider. If unknown, logs and returns.
   - Sets `healthy = true`, `failCount = 0`, `latencyMs = latencyMs`, `lastCheck = Date.now()`.
   - **INVARIANT**: `failCount` resets to 0.
   - **INVARIANT**: `healthy` becomes true.
   - **INVARIANT**: `latencyMs` stored exactly as provided (even if negative, NaN, Infinity?).
   - Fuzz input: unknown providerId, `latencyMs` = NaN, Infinity, -Infinity, -1, 2^53, 2.5 (float), very large number.

 - `checkProvider(providerId: string)`: async, returns boolean.
   - Unknown provider → false.
   - No healthChecker → return `status.healthy`.
   - `shouldAttemptCheck` = `!status.healthy && (now - status.lastCheck >= this.cooldownMs)`.
   - If `status.healthy` and no need to check → return true.
   - If `shouldAttemptCheck` is false and status is unhealthy? Wait, the logic:
     ```typescript
     if (!shouldAttemptCheck && status.healthy) {
       return true;
     }
     ```
     If `status.healthy` is false and `shouldAttemptCheck` is false (cooldown not elapsed), it falls through to... actually it falls through to the health check? No, let's trace:
     - If `!status.healthy` and cooldown elapsed: `shouldAttemptCheck` is true. Then `!shouldAttemptCheck` is false, so the `if` condition is false. It proceeds to health check.
     - If `!status.healthy` and cooldown NOT elapsed: `shouldAttemptCheck` is false. Then `!shouldAttemptCheck` is true, but `status.healthy` is false, so `true && false` = false. It proceeds to health check! Wait, this means if unhealthy and cooldown not elapsed, it STILL performs the health check? That seems like a bug. It should probably return false or skip. But the code falls through to the try/catch health check regardless. Actually, the condition is `if (!shouldAttemptCheck && status.healthy)`. This only short-circuits when healthy AND no need to check. If unhealthy, it always proceeds to health check, ignoring cooldown. Is that intended? The comment says "If unhealthy but cooldown has passed, the check is attempted." But the code attempts check even if cooldown hasn't passed? Let's re-read:
     ```typescript
     const shouldAttemptCheck =
       !status.healthy && (now - status.lastCheck >= this.cooldownMs);
     if (!shouldAttemptCheck && status.healthy) {
       return true;
     }
     ```
     If `status.healthy` is false:
     - If cooldown elapsed: `shouldAttemptCheck` = true. `!shouldAttemptCheck` = false. Condition false. Proceed to check.
     - If cooldown NOT elapsed: `shouldAttemptCheck` = false. `!shouldAttemptCheck` = true. `status.healthy` is false. Condition false. Proceed to check.
     So yes, it always checks if unhealthy. The cooldown only matters if we wanted to prevent checking, but the code doesn't. Actually, maybe the intention was `if (!shouldAttemptCheck) return status.healthy;` but they added `&& status.healthy` to only short-circuit healthy ones? This is a logic bug: cooldown is effectively ignored for unhealthy providers; it always re-checks them.
   - **INVARIANT**: If no healthChecker, returns current `healthy` state for known providers.
   - **INVARIANT**: If healthChecker throws, returns false and calls `markFailed`.
   - **INVARIANT**: If healthChecker returns `{healthy: false}`, returns false and calls `markFailed`.
   - **INVARIANT**: If healthChecker returns `{healthy: true}`, returns true and calls `markHealthy`.
   - **INVARIANT**: `lastCheck` is updated after check.
   - Fuzz input: `providerId` unknown. `healthChecker` throws, returns null, returns `{}`, returns `{healthy: 'true'}`, returns `{latencyMs: 'fast'}`. `cooldownMs` = 0, -1, NaN, Infinity. `Date.now()` manipulation (time travel).

 - `getStats()`:
   - Uses `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS` (bug if custom providers passed).
   - Returns copies of status objects (spreads).
   - **INVARIANT**: Returned `activeProvider` equals `this.activeProviderId`.
   - **INVARIANT**: Returned objects are copies, not references (mutating return shouldn't affect internal state).
   - **INVARIANT**: `backups` array length equals number of default backup IDs that exist in map.

 - `resetAll()`:
   - Resets all entries in `this.statuses`.
   - Sets `activeProviderId` to `DEFAULT_PRIMARY_ID` (bug if custom primary used).
   - **INVARIANT**: After reset, all known providers have `healthy=true`, `failCount=0`, `latencyMs=0`.
   - **INVARIANT**: `activeProviderId` becomes primary ID.

 **Key Bugs to Fuzz:**
 1. Constructor arguments `primaryId` and `backupIds` are ignored by `selectProvider`, `getStats`, `resetAll` (partially). `selectProvider` and `getStats` and `resetAll` use hardcoded defaults. Wait, `resetAll` uses `DEFAULT_PRIMARY_ID` for active, but iterates `this.statuses.values()` which includes custom ones. So custom providers are in the map and get reset, but active is set to default. `selectProvider` only looks at defaults. So if you construct with custom IDs, the class is broken.
 2. `checkProvider` cooldown logic doesn't prevent checks during cooldown for unhealthy providers; it always checks.
 3. `markFailed` and `markHealthy` accept `latencyMs` and `failThreshold` without validation (e.g., negative latency, NaN threshold).
 4. `selectProvider` doesn't verify that the returned provider ID is actually in the map if all unhealthy (it returns hardcoded default, which might not be in map if constructor used custom primary? Actually default is always in map because constructor always adds default IDs too? Wait, constructor: `const providerIds = [primaryId, ...backupIds];` then adds them. If `primaryId` is custom, e.g., 'custom-primary', then `DEFAULT_PRIMARY_ID` ('mdes-ollama') is NOT added unless it was in `backupIds`. So `selectProvider` could return 'mdes-ollama' which is not in the map! Then subsequent calls to `markFailed` etc with that ID would log "Unknown provider". This is a major bug.

 **Properties to enumerate:**

 Let's structure by method/behavior.

 **General / Constructor:**
 - P1: `activeProviderId` must be initialized to the configured primary ID.
 - P2: All providers passed to constructor must exist in `statuses` map with initial healthy=true, failCount=0.
 - P3: `selectProvider` must only return provider IDs that exist in `statuses`.
 - P4: `selectProvider` must return the configured primary when healthy (BUG: it returns hardcoded default).

 **selectProvider:**
 - P5: If primary healthy, return primary and set active.
 - P6: If primary unhealthy, return first healthy backup in order.
 - P7: If none healthy, return primary (fallback) and set active to primary.
 - P8: `activeProviderId` must always equal returned ID.
 - P9: Must not crash on any `_task` input (undefined, null, object, etc).

 **markFailed:**
 - P10: Unknown providerId must not modify state.
 - P11: `failCount` increments monotonically for known provider.
 - P12: Provider becomes unhealthy exactly when `failCount >= failThreshold`.
 - P13: `lastCheck` must be non-decreasing.
 - P14: `failThreshold` boundary: at threshold-1 healthy, at threshold unhealthy.

 **markHealthy:**
 - P15: Unknown providerId must not modify state.
 - P16: Sets `healthy=true`, `failCount=0`, updates `latencyMs` and `lastCheck`.
 - P17: `latencyMs` is stored as-is even if negative/NaN/Infinity.

 **checkProvider:**
 - P18: Unknown providerId returns false.
 - P19: No healthChecker returns current `healthy` state without side effects.
 - P20: HealthChecker throwing error → returns false, calls markFailed.
 - P21: HealthChecker returning unhealthy → returns false, calls markFailed.
 - P22: HealthChecker returning healthy → returns true, calls markHealthy with latency.
 - P23: Cooldown should gate re-checks for unhealthy providers (BUG: it doesn't).
 - P24: HealthChecker returning malformed object (missing fields) → likely crash or undefined behavior. Since it destructures `result.healthy`, if result is null/undefined, it will throw. If `result.latencyMs` missing, `markHealthy` gets undefined.

 **getStats:**
 - P25: Returned stats must be deep copies (mutation doesn't affect internal).
 - P26: `activeProvider` matches internal `activeProviderId`.
 - P27: Backups array corresponds to configured/default backups.

 **resetAll:**
 - P28: All statuses reset to healthy=0, failCount=0, latencyMs=0.
 - P29: `activeProviderId` reset to primary.

 **Fuzz Inputs:**
 - Provider IDs: `''`, `'mdes-ollama'`, `'OLLAMA-LOCAL'`, `null`, `undefined`, `'   '`, `'\x00'`, very long string (65536 chars), emoji, object with toString.
 - `backupIds`: empty array, array with duplicates, array containing primary, array with null/undefined elements (runtime), very large array.
 - `failThreshold`: `0`, `1`, `2`, `3`, `-1`, `NaN`, `Infinity`, `-Infinity`, `1.5`, `Number.MAX_SAFE_INTEGER`.
 - `cooldownMs`: `0`, `-1`, `NaN`, `Infinity`, `Number.MAX_SAFE_INTEGER`.
 - `latencyMs`: `NaN`, `Infinity`, `-Infinity`, `-1`, `0`, `1.5`, `Number.MAX_SAFE_INTEGER`.
 - `task`: `undefined`, `null`, `{}`, `[]`, `() => {}`, `Symbol('x')`, very long string.
 - `healthChecker`: returns `Promise.resolve({healthy: true, latencyMs: 0})`, `Promise.resolve({healthy: false})`, `Promise.resolve({})`, `Promise.resolve(null)`, `Promise.reject(new Error('boom'))`, `Promise.reject('string')`, `Promise.reject(undefined)`, non-promise return `{healthy: true}`, throws synchronously.
 - Time: `Date.now()` returning values causing overflow in `now - lastCheck` (e.g., `lastCheck` from future).

 **Formatting:**
 The user wants: `property → fuzz input → expected invariant`.
 Concrete, no filler. Markdown list.

 Let's draft the list items.

 1. Constructor identity preservation → `primaryId='custom-primary', backupIds=['custom-backup']` → `selectProvider()` must return `'custom-primary'` when healthy. (This will fail due to bug, but that's the expected invariant).
    Actually, the user wants properties that must always hold. If I know there's a bug, I should state the invariant that *should* hold, or maybe the invariant that the code actually holds? The prompt says "properties that must always hold". Usually in PBT, you state the desired property. If the code violates it, the test fails. So I should state the desired invariant.

 2. Constructor map population → `backupIds` containing `null` or `undefined` at runtime → `statuses` map must not contain invalid keys, or constructor must not crash. (Currently `for (const id of providerIds)` would iterate and call `this.statuses.set(id, ...)` with null/undefined as key. Map allows any key. So it would create entries with null/undefined keys. This is a potential issue.)

 3. `selectProvider` return value validity → `_task` is any value (null, object, etc.) → return value is always a string present in `this.statuses.keys()`. (BUG: if custom primary used, it returns default which may not be in keys).

 4. `selectProvider` active sync → regardless of `_task` → `this.activeProviderId` equals returned ID after call.

 5. `markFailed` idempotence on unknown → `providerId` not in map (e.g., `'nonexistent'`, `''`, `null`) → `statuses` map unchanged, no exception thrown.

 6. `markFailed` threshold boundary → `failThreshold=3`, call `markFailed` exactly 3 times → provider `healthy` becomes `false` on the 3rd call, `failCount` equals 3.

 7. `markFailed` threshold with zero → `failThreshold=0`, call `markFailed` once → provider immediately becomes unhealthy (`failCount=1 >= 0`).

 8. `markFailed` threshold with negative → `failThreshold=-1`, initial state `failCount=0` → provider is immediately unhealthy? Wait, initial `failCount` is 0. `markFailed` increments to 1. `1 >= -1` is true, so becomes unhealthy. But what about *before* any markFailed? Initial state is healthy=true. So the invariant is: after first `markFailed`, healthy becomes false. But the property could be: with negative threshold, any failure (even initial 0) should maybe be unhealthy? No, the check is inside `markFailed`. So initial state is healthy. This is fine.

 9. `markHealthy` resets failure state → `providerId` known, any `latencyMs` (e.g., `-5`, `NaN`, `Infinity`) → `failCount` becomes 0, `healthy` becomes true, `latencyMs` stored exactly.

 10. `markHealthy` unknown provider no-op → `providerId` is `undefined` or object → internal map unchanged.

 11. `checkProvider` unknown returns false → `providerId` = `Symbol('x')` or object (if TS compiled loosely) or random string → returns `false`, no error.

 12. `checkProvider` without injected checker → `healthChecker` is `null` → returns current `status.healthy` without mutation.

 13. `checkProvider` cooldown enforcement → `cooldownMs=5000`, provider unhealthy, `lastCheck` updated to now, call `checkProvider` again immediately → should return `false` without invoking `healthChecker` (or should gate it). Expected invariant: `healthChecker` is not called before cooldown expires. (BUG: code violates this, but it's the expected invariant).

 14. `checkProvider` healthChecker throws → `healthChecker` throws `new Error('network')` or rejects with string → returns `false`, provider `failCount` increments.

 15. `checkProvider` healthChecker returns malformed → `healthChecker` returns `{}` or `{healthy: 'yes'}` or `null` → should not crash, should treat as unhealthy or handle gracefully. Expected invariant: no uncaught exception; if it crashes, that's the bug. Actually, accessing `result.healthy` on null will throw. So the expected invariant is: must not throw; returns false and marks failed. But the code will throw. So stating the desired invariant is fine for PBT.

 16. `checkProvider` latency passthrough → `healthChecker` returns `{healthy:true, latencyMs: 123}` → `status.latencyMs` becomes `123`.

 17. `getStats` immutability → caller mutates returned `primary.healthy = false` → internal `statuses` primary remains unchanged.

 18. `getStats` backup ordering → backups array order matches `DEFAULT_BACKUP_IDS` order (or configured order).

 19. `resetAll` full clearance → call `markFailed` to make unhealthy, then `resetAll()` → all providers `healthy=true`, `failCount=0`, `latencyMs=0`, `activeProviderId` is primary.

 20. `selectProvider` fallback when all unhealthy → mark all providers unhealthy → returns primary ID and sets active to primary.

 21. `selectProvider` backup ordering → mark primary unhealthy, backupIds order `['b1','b2']`, `b1` unhealthy, `b2` healthy → returns `'b2'`.

 22. `markFailed` timestamp monotonicity → `Date.now()` mocked to increasing values → `lastCheck` is non-decreasing.

 23. `markFailed` concurrent stress → rapid interleaved `markFailed` and `markHealthy` on same provider → `healthy` reflects final state deterministically based on last call. Since it's single-threaded JS, this is mostly about async/await not being needed (methods are sync but declared async). Actually, these methods are `async` but have no `await`. They run synchronously. So interleaving is about microtasks. But the state changes are immediate. So `failCount` should be exact count of calls.

 24. Constructor with empty backups → `backupIds=[]` → `selectProvider` falls back to primary if primary unhealthy. Backups array in stats is empty.

 25. `checkProvider` time overflow/underflow → `lastCheck=Number.MAX_SAFE_INTEGER`, `Date.now()` mocked to small value → `now - lastCheck` underflows to negative? Actually in JS, number subtraction is float64, so `small - huge` is negative. `negative >= cooldownMs` is false. So `shouldAttemptCheck` is false. If unhealthy, it falls through to check anyway due to bug. But if we consider the intended logic, negative diff should not trigger check. The invariant: no uncaught exception, time diff handled safely.

 Let's refine and select the strongest, most concrete ones. The user wants a markdown list. I'll make each item crisp.

 Format:
 `- **Property**: [description] → **Fuzz Input**: [concrete values] → **Expected Invariant**: [what must hold]`

 Let's ensure I cover:
 - Constructor boundary (custom vs default IDs)
 - selectProvider logic (primary, backup, fallback, active sync)
 - markFailed (threshold, unknown IDs, timestamp)
 - markHealthy (reset, unknown IDs, latency storage)
 - checkProvider (healthChecker injection, exceptions, malformed returns, cooldown/time)
 - getStats (immutability, active sync)
 - resetAll (state clearance)

 Let's write them out.

 1. Constructor argument propagation → `

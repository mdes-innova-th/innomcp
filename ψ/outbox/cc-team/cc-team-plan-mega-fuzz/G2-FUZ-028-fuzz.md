<!-- cc-team deliverable
 group: G2 (fuzz division)
 member: FUZ-028 role=fuzz model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1218,"completion_tokens":5000,"total_tokens":6218,"prompt_tokens_details":{"cached_tokens":69,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T12:06:51.485Z -->
The user wants property-based / fuzz test cases for the provided TypeScript module `ToolExecutor`. I need to:

1. Enumerate input invariants and properties that must always hold.
2. Identify adversarial/malformed/boundary inputs that could break them.
3. Output a markdown list in the format: property → fuzz input → expected invariant.
4. Be concrete, no filler.

Let me analyze the module carefully.

**Module Analysis:**

- `ToolExecutor` is a singleton extending `EventEmitter`.
- It maintains a private Map `tools` of `ToolDefinition`.
- Methods: `register`, `unregister`, `hasTool`, `listTools`, `execute`.
- `execute` takes `name`, `params`, `options`.
- Key behaviors:
  - If tool not found: return `{success: false, error: NOT_FOUND_MESSAGE, durationMs: 0, retries: 0}`.
  - `effectiveTimeout`: `options.timeoutMs ?? tool.timeout ?? DEFAULT_TIMEOUT_MS` (30_000).
  - `maxRetries`: `Math.min(Math.max(options.retries ?? 0, 0), MAX_RETRIES)` (3). So clamped to [0, 3].
  - Loop: `for (let attempt = 0; attempt <= maxRetries; attempt++)` → total attempts = maxRetries + 1.
  - Emits `tool:start`, `tool:end`, `tool:error`.
  - `raceWithTimeout`: rejects with `ToolTimeoutError` if timeout.
  - `toErrorMessage`: if `ToolTimeoutError` or `ToolParamError`, returns `error.message`; else returns `EXEC_ERROR_MESSAGE`.
  - Delay between retries: `RETRY_BASE_DELAY_MS * Math.pow(2, attempt)` (1000 * 2^attempt).
  - If final attempt fails, returns `{success: false, error: errorMessage, durationMs: Date.now() - startTime, retries: attempt}`.
  - The final return after loop (should be unreachable if logic is correct, but exists): `{success: false, error: EXEC_ERROR_MESSAGE, durationMs: Date.now() - startTime, retries: maxRetries}`.

**Invariants to test:**

1. **Singleton**: `getInstance()` always returns the same instance.
2. **Register/Unregister/Has/List**: 
   - After register, `hasTool` is true.
   - After unregister, `hasTool` is false.
   - `listTools` doesn't expose `handler`.
   - Registering same name overwrites.
   - Register with empty string name? Should work based on code, but might be edge case.
3. **Execute - Not Found**:
   - Any name not in map → `success: false`, `error: NOT_FOUND_MESSAGE`, `durationMs: 0`, `retries: 0`.
   - `tool:start`/`tool:end`/`tool:error` should NOT be emitted for not found? Looking at code: it returns early before the loop, so no emits. Invariant: no events emitted for missing tools.
4. **Execute - Timeout**:
   - `effectiveTimeout` boundary: negative, 0, Infinity, NaN, very large.
   - `raceWithTimeout` behavior: if timeoutMs is 0 or negative, the timeout fires immediately? `setTimeout` with negative/0 fires ASAP (next tick), but promise might resolve first if already resolved. Actually if timeoutMs=0, setTimeout 0 means next event loop tick. If promise is already resolved (synchronous), it might win? No, `new Promise` executor runs synchronously, so `setTimeout` is scheduled. If `promise` is already resolved (e.g., `Promise.resolve(5)`), the `.then` microtask is queued before the timer macrotask? Actually in JS, microtasks (promise callbacks) run before macrotasks (setTimeout). So if promise is already resolved, `clearTimeout` and `resolve` happen in microtask, which runs before the timer macrotask. So it should succeed even with timeout 0. But if promise is pending, timeout 0 will reject next tick.
   - If timeoutMs is `NaN`, `setTimeout` treats it as 0 or minimum? In Node/JS, `setTimeout(fn, NaN)` is treated as 0 (or 1ms). Actually per spec, it's converted to 0. But `Infinity` might be treated as 0 too? No, `setTimeout` with Infinity might be treated as 0 in some environments? Actually `setTimeout` converts to signed long, Infinity becomes 0? Need to check. In Node.js, `setTimeout(..., Infinity)` results in a very long wait? No, the delay is converted to an integer. `Infinity` becomes 0? Actually `setTimeout` calls `ToNumber`, then `ToInt32` or similar. `Infinity` might become 0 or 1. This is a fuzz target.
   - `ToolTimeoutError` message must be exact Thai string.
5. **Execute - Retries**:
   - `maxRetries` clamped: `Math.min(Math.max(options.retries ?? 0, 0), MAX_RETRIES)`.
   - So if `options.retries` is -5 → 0. If 100 → 3. If `NaN` → `Math.max(NaN, 0)` is NaN, `Math.min(NaN, 3)` is NaN. Then `attempt <= maxRetries` is always false (NaN comparisons are false), so loop doesn't run? Wait: `for (let attempt = 0; attempt <= maxRetries; attempt += 1)`. If `maxRetries` is NaN, `0 <= NaN` is false. So loop body never executes. It falls through to the final return: `{success: false, error: EXEC_ERROR_MESSAGE, durationMs: Date.now() - startTime, retries: maxRetries}`. So `retries: NaN` in result? That's a bug/invariant to test.
   - If `options.retries` is `undefined` → 0.
   - Total attempts = maxRetries + 1. So if maxRetries=3, attempts 0,1,2,3 = 4 attempts.
   - `retries` field in success result equals attempt number (which is the successful attempt index). So if success on first try, `retries: 0`. If success on 3rd retry (attempt 3), `retries: 3`.
   - On final failure, `retries` equals `maxRetries` (the last attempt index).
6. **Execute - Delay**:
   - Between retries, delay is `1000 * 2^attempt`. So attempt 0→1: 1000ms, 1→2: 2000ms, 2→3: 4000ms.
   - Total minimum duration for N failures = sum of delays + execution times.
7. **Execute - Params**:
   - `params` is `unknown`, passed directly to `tool.handler`. No validation. Any value should be passed through.
8. **Execute - Context**:
   - `options.context` is included in `tool:start` emit. If missing, it's `undefined`. If provided, should be reference-equal? It's just passed through.
9. **Execute - Error handling**:
   - `toErrorMessage`: only `ToolTimeoutError` and `ToolParamError` preserve message. All others become `EXEC_ERROR_MESSAGE`.
   - If handler throws `ToolParamError`, message is preserved.
   - If handler throws `Error("foo")`, message becomes `EXEC_ERROR_MESSAGE`.
   - If handler throws non-Error object (e.g., string, null), `toErrorMessage` checks `instanceof` which throws if `null`? No, `null instanceof Error` is false. But if error is a string, `error instanceof ToolTimeoutError` is false. So returns `EXEC_ERROR_MESSAGE`. Wait, what if error is `undefined`? Same.
   - What if error is an object with `message` property? Still returns `EXEC_ERROR_MESSAGE` unless it's instance of those two classes.
   - What if `error` is a Symbol? `instanceof` throws TypeError? No, `Symbol() instanceof Error` is false. But `toErrorMessage` is called in catch block. If `error` is something that causes `instanceof` to throw? `instanceof` only throws if right-hand side is not callable. Here right side is class, so safe.
10. **Execute - Events**:
    - `tool:start` emitted before each attempt.
    - `tool:end` emitted only on success.
    - `tool:error` emitted on each failure.
    - On success after retries, there should be N `tool:error` events and 1 `tool:end` event.
    - On total failure, there should be maxRetries+1 `tool:error` events and 0 `tool:end`.
    - Event payload structure: must contain `toolName`, `attempt`, etc.
11. **Execute - Duration**:
    - `durationMs` must be >= 0.
    - On not found, exactly 0.
    - On success/failure, `Date.now() - startTime`. Since `Date.now()` can go backwards (system clock adjustment), `durationMs` could theoretically be negative! This is a property: durationMs should be non-negative under monotonic clock, but `Date.now()` is not monotonic. Fuzz with system clock skew? Hard to fuzz directly, but we can note it.
    - `attemptDurationMs` in events similarly.
12. **Register - ToolDefinition**:
    - `register` clones tool via `{ ...tool }`. So shallow copy. If `parameters` is mutated after register, the stored copy's `parameters` reference is same as original (shallow). But `handler` is copied by reference.
    - `timeout` can be negative, 0, Infinity, NaN.
13. **listTools**:
    - Returns array. Order? Map insertion order.
    - Does not include `handler`.
    - If `tools` is empty, returns `[]`.
14. **EventEmitter 'error'**:
    - Constructor sets `this.on('error', () => {})` to prevent crash on unhandled error events? Actually EventEmitter crashes if 'error' event has no listeners. This prevents that.
    - But if user removes all 'error' listeners and emits error, it might crash? The built-in listener is added in constructor. If someone calls `removeAllListeners('error')`, it could remove it. But that's internal.

**Concrete Fuzz Inputs:**

I need to generate specific adversarial/malformed/boundary inputs.

Let's structure the markdown list as requested: `property → fuzz input → expected invariant`.

Wait, the user said: "enumerate input invariants and properties that must always hold, then adversarial/malformed/boundary inputs that could break them. Output a markdown list: property → fuzz input → expected invariant."

So the format should be something like:
- **Property**: [description] → **Fuzz Input**: [concrete values] → **Expected Invariant**: [what must hold]

Let me make sure it's concrete and no filler.

**List of properties and fuzz cases:**

1. **Singleton identity**: `getInstance()` must return identical reference.
   - Fuzz: multiple calls, interleaved with register/unregister.
   - Invariant: `ToolExecutor.getInstance() === ToolExecutor.getInstance()`.

2. **Register overwrites**: Registering a tool with an existing name must replace the old definition.
   - Fuzz: `register({name: "t", description: "a", parameters: {}, handler: async () => 1, timeout: 100})` then `register({name: "t", description: "b", parameters: {x:1}, handler: async () => 2})`.
   - Invariant: `listTools()` shows the second definition; `execute("t")` uses second handler.

3. **Empty tool name**: Tool name can be empty string.
   - Fuzz: `register({name: "", ...})`.
   - Invariant: `hasTool("")` is true; `execute("")` invokes that handler.

4. **Not found error shape**: Calling `execute` with unregistered name must return exact error shape.
   - Fuzz: `execute("__NONEXISTENT__", Symbol.for('x'), {timeoutMs: -1, retries: 100, context: null})`.
   - Invariant: Result is exactly `{success: false, error: 'ไม่พบเครื่องมือที่ต้องการ', durationMs: 0, retries: 0}` and zero events emitted.

5. **Retries clamping upper bound**: `options.retries` above MAX_RETRIES must be clamped to 3.
   - Fuzz: Handler always throws; `execute("fail", null, {retries: 1e9})`.
   - Invariant: Exactly 4 attempts (attempts 0..3), final result `retries: 3`.

6. **Retries clamping lower bound**: Negative retries must be clamped to 0.
   - Fuzz: Handler always throws; `execute("fail", null, {retries: -5})`.
   - Invariant: Exactly 1 attempt (attempt 0), result `retries: 0`.

7. **Retries NaN poisoning**: `options.retries: NaN` propagates NaN through clamping because `Math.max(NaN, 0)` is NaN.
   - Fuzz: `execute("any", null, {retries: NaN})`.
   - Invariant: Loop body never executes; result `retries: NaN`, `success: false`, `error: EXEC_ERROR_MESSAGE`, `durationMs` >= 0. (This is a bug but it's the behavior).

8. **Timeout precedence**: `options.timeoutMs` overrides `tool.timeout` which overrides `DEFAULT_TIMEOUT_MS`.
   - Fuzz: Tool timeout=5000; `execute("t", null, {timeoutMs: 1})` with handler `delay(100)`.
   - Invariant: Must reject with `ToolTimeoutError` (1ms timeout wins).

9. **Timeout NaN/Infinity behavior**: `timeoutMs: NaN` or `Infinity` in `raceWithTimeout`.
   - Fuzz: `execute("t", null, {timeoutMs: NaN})` with handler `Promise.resolve(1)`.
   - Invariant: `setTimeout(NaN)` treats as 0 or minimum; if handler is async but resolves immediately (microtask), it should win over timer macrotask, so success. If handler never resolves, timeout eventually fires. Actually with NaN, setTimeout might fire immediately next tick. So a never-resolving handler should get ToolTimeoutError. Let's split:
     - Fuzz A: `timeoutMs: NaN`, handler `Promise.resolve(1)`. Invariant: success (microtask beats macrotask).
     - Fuzz B: `timeoutMs: Infinity`, handler never resolves. Invariant: In Node.js, `setTimeout(..., Infinity)` may be treated as 0 or max delay? Actually Node.js converts to 0? Let me think. In V8, `setTimeout` delay is `ToNumber` then clamped. `Infinity` becomes 0? No, `ToNumber(Infinity)` is Infinity, then it's clamped to max signed 32-bit? Actually HTML spec says clamp to max (2^31-1). Node.js follows similar. So `Infinity` becomes ~24.8 days. So it won't timeout soon. Invariant: hangs (or very long wait). This is a valid fuzz finding.

10. **Zero timeout with synchronous-ish promise**: Timeout 0 with immediately resolving promise.
    - Fuzz: `execute("t", null, {timeoutMs: 0})`, handler returns `Promise.resolve(42)`.
    - Invariant: success, data 42. Because promise microtask clears timeout before macrotask fires.

11. **Zero timeout with pending promise**: Timeout 0 with never-resolving promise.
    - Fuzz: `execute("t", null, {timeoutMs: 0})`, handler returns `new Promise(() => {})`.
    - Invariant: Rejects with `ToolTimeoutError` on next tick.

12. **Negative timeout**: `timeoutMs: -1`.
    - Fuzz: `execute("t", null, {timeoutMs: -1})`, handler `new Promise(() => {})`.
    - Invariant: `setTimeout(..., -1)` treated as 0 or 1; timeout fires ASAP, so `ToolTimeoutError`.

13. **Error message preservation for custom errors**: Only `ToolTimeoutError` and `ToolParamError` preserve messages.
    - Fuzz: Handler throws `new Error("secret")`; `execute("t", null)`.
    - Invariant: `result.error === 'เกิดข้อผิดพลาดในการเรียกใช้เครื่องมือ'`.

14. **Error message preservation for ToolParamError**:
    - Fuzz: Handler throws `new ToolParamError()`.
    - Invariant: `result.error === 'พารามิเตอร์ไม่ถูกต้อง'`.

15. **Error message for non-Error throws**: Throwing primitives.
    - Fuzz: Handler throws `null`, `undefined`, `"string"`, `123`, `{}`.
    - Invariant: All result in `result.error === EXEC_ERROR_MESSAGE` (since none are instances of the two classes).

16. **Event emission count on total failure**:
    - Fuzz: Handler always throws generic Error; `execute("fail", null, {retries: 2})`.
    - Invariant: Exactly 3 `tool:start` events, 3 `tool:error` events, 0 `tool:end` events. Final `retries: 2`.

17. **Event emission count on eventual success**:
    - Fuzz: Handler fails on attempts 0,1 then succeeds on 2; `execute("flake", null, {retries: 3})`.
    - Invariant: 3 `tool:start`, 2 `tool:error`, 1 `tool:end`. Result `success: true`, `retries: 2`.

18. **Event payload structure**: Emitted events must contain required fields.
    - Fuzz: Any execution.
    - Invariant: `tool:start` payload has `{toolName: string, attempt: number, params, context}`. `tool:error` has `{toolName, attempt, error: string, attemptDurationMs: number, originalError}`. `tool:end` has `{toolName, attempt, result, attemptDurationMs, totalDurationMs}`.

19. **Duration monotonicity (best effort)**: `durationMs` and `attemptDurationMs` should be >= 0 under normal clock.
    - Fuzz: `execute` with very fast handler.
    - Invariant: `durationMs >= 0` and `attemptDurationMs >= 0`.

20. **Delay between retries**: Exponential backoff timing.
    - Fuzz: Handler fails; `execute("f", null, {retries: 2})`. Measure time between `tool:error` events.
    - Invariant: Gap between attempt 0 error and attempt 1 start >= 1000ms; gap between attempt 1 error and attempt 2 start >= 2000ms.

21. **listTools isolation**: `listTools` must not return the `handler` function.
    - Fuzz: Register tool with handler; call `listTools()`.
    - Invariant: Returned objects have keys `name`, `description`, `parameters`, `timeout` only. No `handler`.

22. **listTools empty**: When no tools registered.
    - Fuzz: Fresh instance (but singleton... need to test on the singleton by unregistering all or testing before any register). Since it's singleton, tricky. But we can unregister all known tools.
    - Invariant: `listTools()` returns `[]`.

23. **Params pass-through**: `params` is passed to handler unmodified.
    - Fuzz: `execute("echo", {a: [1,2], b: Symbol('s'), c: undefined, d: new Date(0)})`.
    - Invariant: Handler receives exactly the same reference/values.

24. **Context pass-through in event**: `options.context` appears in `tool:start` event.
    - Fuzz: `execute("t", null, {context: {key: Object.freeze({})}})`.
    - Invariant: `tool:start` event payload `context` is reference-equal to provided context.

25. **Unregister idempotency**: Unregistering non-existent tool is silent.
    - Fuzz: `unregister("never-registered")`.
    - Invariant: No throw; `hasTool("never-registered")` is false.

26. **Handler mutation after register**: Since `register` shallow copies, mutating the original tool object's `handler` after register does not affect stored tool? Wait, `{ ...tool }` shallow copies. The `handler` property is copied by reference. So mutating `tool.handler = newFn` on the original object does NOT affect the stored copy because the property is overwritten on the original, not the stored. Actually yes, spread creates a new object with own enumerable properties. So the stored object is separate. Mutating original `tool.handler` doesn't change stored. But mutating `tool.parameters` (object) would affect both since shallow copy. Let's test:
    - Fuzz: Register tool, then mutate `original.parameters.foo = "bar"`.
    - Invariant: `listTools()` still shows original parameters? Actually it will show the mutated object because shallow copy shares reference. So `listTools()[0].parameters.foo === "bar"`. This is a behavior to document.

27. **Concurrent execution isolation**: Two concurrent executions of same/different tools should not interfere.
    - Fuzz: Start `execute("slow", null, {timeoutMs: 5000})` and immediately `execute("fast", null)` concurrently.
    - Invariant: Both return independently; events are emitted for each with correct `toolName`.

28. **Tool timeout default**: If no `options.timeoutMs` and no `tool.timeout`, uses 30_000.
    - Fuzz: Register tool without `timeout`; `execute("t", null)` with never-resolving handler.
    - Invariant: `ToolTimeoutError` emitted after ~30s. (Too slow for fuzz, but property holds).

29. **Execute with `options.context` missing**: `tool:start` event should have `context: undefined`.
    - Fuzz: `execute("t", null)` without options.
    - Invariant: `tool:start` payload `context === undefined`.

30. **Max retries boundary MAX_RETRIES=3**: Exactly 3.
    - Fuzz: `options.retries: 3`, handler always throws.
    - Invariant: 4 attempts, final `retries: 3`.

31. **Date.now() backward skew**: If system clock jumps backward during execution, `durationMs` could be negative.
    - Fuzz: Mock `Date.now` to return decreasing values.
    - Invariant: `durationMs` may be negative (this is a bug/vulnerability to note). Or if we consider expected behavior under fuzz, it reveals a fragility.

Let me refine these to be

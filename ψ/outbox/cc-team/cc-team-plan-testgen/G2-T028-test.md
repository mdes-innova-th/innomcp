<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T028 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1478,"completion_tokens":8000,"total_tokens":9478,"prompt_tokens_details":{"cached_tokens":70,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 87s
 generated: 2026-06-13T10:57:26.027Z -->
The user wants a Jest unit test for the `ToolExecutor` class from `innomcp-node/src/services/toolExecutor.ts`.

Key requirements:
1. Import EXACTLY as: `import ... from '../src/services/toolExecutor';`
2. Only test PUBLIC exported API. The public API includes:
   - `ToolTimeoutError` (class)
   - `ToolParamError` (class)
   - `ToolDefinition` (interface, not testable directly but used in types)
   - `ExecOptions` (interface)
   - `ToolResult` (interface)
   - `ToolDefinitionPublic` (interface)
   - `ToolExecutor` (class)
     - `static getInstance(): ToolExecutor`
     - `register(tool: ToolDefinition): void`
     - `unregister(name: string): void`
     - `hasTool(name: string): boolean`
     - `listTools(): ToolDefinitionPublic[]`
     - `execute(name, params, options): Promise<ToolResult>`
   - `ToolExecutor` is an EventEmitter, so events might be testable but the prompt says "Only test the PUBLIC exported API actually present in the source". Events are part of EventEmitter public API and the source emits specific events. I should probably test the events too since they are observable behavior.
   - Default export `ToolExecutor`.
3. Mock external dependencies. The source imports `EventEmitter` from `events` (built-in Node.js). No other external dependencies (db, network, fs) are imported. So no `jest.mock` needed for external modules, but I should mock tool handlers since they are external functions passed in. The handlers are provided by the caller in `register`, so I can just use jest.fn() for them.
4. Use fake timers for time/interval logic. The `execute` method uses `Date.now()` and `setTimeout` via `delay` and `raceWithTimeout`. I need `jest.useFakeTimers()` and should advance timers to test timeouts and retries.
5. Must compile under strict TypeScript and pass without live server/DB.
6. Output: ONE fenced typescript code block, COMPLETE test file, NOTHING else.

Let's analyze the source carefully:

- `ToolExecutor` is a singleton via `getInstance()`.
- `register`, `unregister`, `hasTool`, `listTools` are straightforward.
- `execute`:
  - Returns `{ success: false, error: NOT_FOUND_MESSAGE, durationMs: 0, retries: 0 }` if tool not found.
  - `effectiveTimeout`: `options.timeoutMs ?? tool.timeout ?? DEFAULT_TIMEOUT_MS` (30_000).
  - `maxRetries`: `Math.min(Math.max(options.retries ?? 0, 0), MAX_RETRIES)` (MAX_RETRIES=3).
  - Loop `attempt` from 0 to `maxRetries` inclusive.
  - Emits `tool:start`, `tool:end`, `tool:error`.
  - `raceWithTimeout`: rejects with `ToolTimeoutError` if timeout.
  - `toErrorMessage`: returns `error.message` if `ToolTimeoutError` or `ToolParamError`, else `EXEC_ERROR_MESSAGE`.
  - On error, if not last attempt, delays `RETRY_BASE_DELAY_MS * Math.pow(2, attempt)` (1_000 * 2^attempt).
  - Returns success result with `durationMs: Date.now() - startTime` and `retries: attempt`.
  - On final failure, returns error result with `durationMs: Date.now() - startTime` and `retries: attempt`.
  - If loop somehow exits (shouldn't happen), returns generic error with `retries: maxRetries`.

Important: `Date.now()` is used. With `jest.useFakeTimers()`, modern fake timers mock `Date.now()` by default in recent Jest versions, but I should be careful. Actually, `jest.useFakeTimers({ legacyFakeTimers: false })` (default in modern Jest) mocks `Date.now()`. However, to be safe and deterministic, I should advance timers and check durations. Since `Date.now()` is mocked with fake timers, `Date.now()` returns the fake timer time. But `performance.now()` isn't used. Let's verify: with `jest.useFakeTimers()`, `Date.now()` is controlled by `jest.setSystemTime()` or `jest.advanceTimersByTime()`. Actually, by default, `Date.now()` starts at 0 (or real time?) in modern fake timers. Wait, in Jest 29+, `jest.useFakeTimers()` uses modern fake timers where `Date.now()` is faked starting from the real system time? No, it starts from 0 if `doNotFake` is not set? Let me recall: modern fake timers fake `setTimeout`, `clearTimeout`, `Date`, etc. The initial time is the real time when `jest.useFakeTimers()` was called, unless `jest.setSystemTime()` is used. To make tests deterministic, I should use `jest.setSystemTime(0)` or similar in `beforeEach`, or just not assert exact `durationMs` values but rather ranges or specific values after advancing time by known amounts.

Actually, looking at the style exemplar:
```typescript
beforeEach(() => { jest.useFakeTimers(); cache = new CacheManager({ ttl: 1000, maxSize: 5 }); });
afterEach(() => { jest.useRealTimers(); });
```
It doesn't set system time. But the exemplar doesn't use `Date.now()`.

For `ToolExecutor`, `durationMs` depends on `Date.now()`. If I use fake timers and `jest.advanceTimersByTime(ms)`, `Date.now()` should advance by `ms` in modern fake timers. Let's verify behavior:
- `jest.useFakeTimers()`
- `const start = Date.now();`
- `jest.advanceTimersByTime(100);`
- `const end = Date.now();`
- `end - start` should be `100`.

Yes, this is true for modern fake timers. So I can assert exact `durationMs`.

However, `execute` uses `await this.delay(...)`. `delay` uses `setTimeout`. So if I advance timers, the delay resolves.
Also `raceWithTimeout` uses `setTimeout`. If the handler promise never resolves, advancing timers past the timeout should trigger the `ToolTimeoutError`.

But there's a catch: `raceWithTimeout` creates a `new Promise` and inside it uses `setTimeout`. If the main promise resolves, `clearTimeout` is called. With fake timers, this should work fine.

Let's plan the tests:

1. **Singleton**: `getInstance()` returns same instance.
2. **Register/Has/List**: register a tool, `hasTool` true, `listTools` returns public def (without handler).
3. **Unregister**: unregister removes tool.
4. **Execute not found**: execute unknown tool returns failure with 0 duration, 0 retries, specific error message.
5. **Execute success**: register a tool with resolved handler. Execute returns success, correct data, duration, retries=0. Also check events emitted (`tool:start`, `tool:end`).
6. **Execute with timeout**: register a tool with handler that never resolves (or resolves after long time). Set `timeoutMs` low (e.g., 100). Execute should fail with `ToolTimeoutError` message. Need to advance timers by timeout. Since it's a race, the handler promise is pending. We advance timers by 100. The timeout should fire. But the handler promise is still pending - does that cause an unhandled rejection? In `raceWithTimeout`, the original promise is not cancelled. If it later resolves, `clearTimeout` was already called (or timeout already fired). Actually, if timeout fires first, `reject(new ToolTimeoutError())` is called. The original promise `.then` still exists. If it later resolves, `clearTimeout` is called (but timeout already fired), then `resolve(value)` is called. But the Promise is already settled (rejected). Wait, no: once a Promise is settled, further calls to `resolve`/`reject` are ignored. So no unhandled rejection from the original promise if it resolves after timeout? Actually, if the original promise resolves after the timeout, the `.then` callback runs, calls `clearTimeout` (noop), calls `resolve(value)`. Since the outer promise is already rejected, this `resolve` is ignored. No unhandled rejection. Good.
   However, if the original promise *rejects* after timeout, the `.catch` callback runs, calls `clearTimeout`, calls `reject(error)`. Again, ignored. Good.
   But if we use `jest.fn()` that returns a never-resolving promise, we need to make sure Jest doesn't complain. We can just return `new Promise(() => {})`.
7. **Execute with retry success**: register a tool that fails once then succeeds. Set `retries: 2`. First attempt fails. Check `tool:error` event. Then delay is `RETRY_BASE_DELAY_MS * 2^0 = 1000`. Advance timers by 1000. Second attempt succeeds. Result should have `retries: 1`, `success: true`. Duration should be ~1000 (plus maybe some execution time, but execution is synchronous in the mock handler, so `Date.now()` doesn't advance during handler execution unless we use `await Promise.resolve()`? Actually, the handler is `async`, but if it returns immediately resolved promise, the event loop tick might not advance timers. `Date.now()` only advances via `jest.advanceTimersByTime`. So duration should be 1000.
8. **Execute with max retries exceeded**: fails all attempts. `retries: 1`. Attempt 0 fails. Delay 1000. Attempt 1 fails. No more retries. Result `success: false`, `retries: 1`. Error message should be `EXEC_ERROR_MESSAGE` (since generic error).
9. **Execute with ToolParamError**: handler throws `ToolParamError`. Error message should be `พารามิเตอร์ไม่ถูกต้อง`. No retry? Actually, it retries unless maxRetries reached. The error message is preserved.
10. **Execute with custom timeout from tool definition**: register tool with `timeout: 500`. Execute without `timeoutMs`. Should use 500. Use fake timers to trigger at 500.
11. **Execute with options override**: options.timeoutMs overrides tool.timeout.
12. **Execute with context**: check that `tool:start` event includes context.
13. **Retries clamping**: `retries: 5` should be clamped to `MAX_RETRIES` (3). So 4 attempts total (0,1,2,3). Result retries should be 3 on failure.

Wait, the loop is `for (let attempt = 0; attempt <= maxRetries; attempt += 1)`. So if `maxRetries = 3`, attempts are 0, 1, 2, 3. That's 4 attempts. The returned `retries` field is the attempt number. So on final failure, `retries` is 3. That matches `MAX_RETRIES`.

Let's think about the delay calculation:
- Attempt 0 fails -> delay before attempt 1: `RETRY_BASE_DELAY_MS * Math.pow(2, 0)` = 1000.
- Attempt 1 fails -> delay before attempt 2: `1000 * 2^1` = 2000.
- Attempt 2 fails -> delay before attempt 3: `1000 * 2^2` = 4000.

So total delay for maxRetries=3 failure: 1000 + 2000 + 4000 = 7000ms.

Need to be careful with `Date.now()` and `jest.advanceTimersByTime()`.
In modern fake timers, `Date.now()` is advanced by `advanceTimersByTime`. So if I do:
- `jest.useFakeTimers();`
- `jest.setSystemTime(0);` (optional but good for determinism)
- `execute(...)` -> starts, `Date.now()` is 0.
- handler fails immediately (synchronous throw or rejected promise).
- `await` the `execute`? But `execute` has `await this.delay(...)`. So it will pause at `await this.delay(...)`. We need to use a pattern like:
  ```typescript
  const executePromise = executor.execute('tool', {}, { retries: 1 });
  // handle first attempt failure, now waiting in delay(1000)
  jest.advanceTimersByTime(1000);
  // now second attempt...
  // if it succeeds, executePromise resolves.
  const result = await executePromise;
  ```
  But we also need to handle the event loop. `advanceTimersByTime` runs timers synchronously, but promises resolved by timers might need an extra `await Promise.resolve()` or `flushPromises`. Actually, in Jest with modern fake timers, `jest.advanceTimersByTime` runs macro-tasks, but micro-tasks (promise resolutions) might not be fully flushed until you `await` something. Let's think.

  When `execute` calls `tool.handler(params)`, if handler returns a rejected promise, that's a microtask. The `try/catch` with `await` will catch it. Then it hits `await this.delay(...)`. `delay` returns a promise resolved by `setTimeout`. `advanceTimersByTime(1000)` will run the timer callback, which calls `resolve()`. But the promise resolution is a microtask. So after `advanceTimersByTime`, the `delay` promise is not yet resolved in the synchronous code. We need to do `await Promise.resolve();` to let microtasks run? Actually, `jest.advanceTimersByTime` might not flush microtasks. In modern Jest, there's `jest.runAllTicks()` or we can just `await Promise.resolve();` a couple times. But a cleaner way is:
  ```typescript
  const promise = executor.execute(...);
  jest.advanceTimersByTime(1000);
  const result = await promise;
  ```
  Does this work? Let's trace:
  1. `execute` is called. It starts the loop. `tool.handler` is called. If it rejects immediately (synchronously), the `await` in `try` sees a rejected promise. The `catch` block runs. It emits. Then it hits `await this.delay(1000)`. The function returns a promise to `execute`'s caller. The `execute` function is now suspended at `await delay`.
  2. `jest.advanceTimersByTime(1000)` runs the timer callback inside `delay`, which calls `resolve()`. However, the resolution of the `delay` promise is queued as a microtask.
  3. Then `await promise` (the outer `execute` promise) yields control. The microtask queue is processed. The `delay` promise resolves. The `execute` function resumes for the next iteration.
  4. But wait, if the next iteration also involves async/await, does `await promise` wait for the entire `execute` to finish? Yes, because `await promise` waits until the `execute` promise settles. After the microtask queue processes the `delay` resolution, `execute` continues. If the next attempt succeeds (handler returns resolved promise), that resolution is also a microtask. `await handler(...)` suspends `execute` again. Then the microtask resolves it. Then `execute` returns the result. So `await promise` should get the final result.

  However, there's a subtlety: if the handler is `jest.fn().mockRejectedValue(new Error('fail'))`, the rejection is a microtask. The `await` inside `execute` catches it. Then `delay` is set up. `advanceTimersByTime` runs the timer. Then `await promise` should work.

  But what about `raceWithTimeout`? If we want to test timeout:
  - Handler returns `new Promise(() => {})` (never resolves).
  - `raceWithTimeout` sets up a timeout timer for `timeoutMs`.
  - `execute` is suspended at `await raceWithTimeout(...)`.
  - We `advanceTimersByTime(timeoutMs)`. The timer callback runs and rejects the race promise with `ToolTimeoutError`. This rejection is a microtask? No, the `reject` callback is called synchronously inside the timer callback. The outer promise (from `raceWithTimeout`) is rejected. But the rejection handler is attached via `.catch()` inside `raceWithTimeout`. Wait, `raceWithTimeout` returns a new Promise. The rejection is internal to that new Promise. When the timer fires, it calls `reject(new ToolTimeoutError())`. This rejects the outer promise. The `execute` function is awaiting the outer promise. So the `await` throws. This throw is handled synchronously inside the timer callback? No, the `reject` call marks the promise as rejected. The `await` in `execute` will see the rejection when control returns to the event loop. After `advanceTimersByTime`, we might need to `await Promise.resolve()` to let the microtask (promise rejection) propagate? Actually, `reject` is called synchronously. The promise state changes. But the `await` in `execute` needs to be resumed. That resumption is a microtask. So `await promise` on the outer `execute` should still work because `execute` will eventually finish.

  Let's verify with a concrete pattern used in Jest fake timers:
  ```typescript
  jest.useFakeTimers();
  const p = executor.execute('slow', {});
  jest.advanceTimersByTime(100);
  await expect(p).rejects.toBeInstanceOf(ToolTimeoutError); // Wait, execute catches the error and returns a result object, it doesn't reject.
  ```
  Actually, `execute` catches all errors internally and returns a `ToolResult`. So `p` resolves to `{ success: false, error: 'เครื่องมือหมดเวลา...' }`.

  So:
  ```typescript
  const p = executor.execute('slow', {}, { timeoutMs: 100 });
  jest.advanceTimersByTime(100);
  const result = await p;
  expect(result.success).toBe(false);
  ```

  This should work.

  One more thing: `EventEmitter`. The source does `this.on('error', () => {});` in constructor. This prevents unhandled 'error' events from crashing? Actually, EventEmitter throws if error event has no listeners. This line adds a no-op listener. But we might want to test events. We can add our own listeners.

  Also, since it's a singleton, we need to be careful about state leaking between tests. We should probably reset the instance. But the source doesn't expose a way to reset the singleton. We can work around it by accessing `ToolExecutor['instance']` or by using `jest.isolateModules`? Or we can just unregister tools between tests. Since the tests only care about the tools map, we can `executor.unregister('toolName')` in `afterEach`. But if we want to test `getInstance` returning the same instance, that's fine.

  Wait, the singleton pattern: `private static instance: ToolExecutor;`. In TS, private static can be accessed via `(ToolExecutor as any).instance` or `ToolExecutor['instance']`. But the prompt says "Only test the PUBLIC exported API". So we should not touch private static `instance`. We can just use `getInstance()` and clean up by unregistering all tools. Or we can create a new instance? No, constructor is private. So we must use `getInstance()`. To avoid state leak, we can do `executor.unregister(...)` for each tool registered in a test.

  Let's structure the test file:

  ```typescript
  import ToolExecutor, { ToolExecutor as ToolExecutorClass, ToolDefinition, ToolResult, ToolTimeoutError, ToolParamError } from '../src/services/toolExecutor';
  ```

  Wait, the default export is `ToolExecutor`, and named export is `ToolExecutor` class. Actually, the source has `export class ToolExecutor ...` and `export default ToolExecutor;`. So we can import the class as named export. The exemplar imports default: `import CacheManager from '../src/services/cacheManager';`. I can import default or named. The prompt says "Import the module under test EXACTLY as: import ... from '../src/services/toolExecutor';". So the path must be exact. The import can be:
  `import ToolExecutor, { ToolTimeoutError, ToolParamError, ToolDefinition, ToolResult, ExecOptions, ToolDefinitionPublic } from '../src/services/toolExecutor';`
  But I only need what's used in tests.

  Let's define the tests:

  ```typescript
  import ToolExecutor, { ToolTimeoutError, ToolParamError, ToolDefinition, ToolResult } from '../src/services/toolExecutor';

  describe('ToolExecutor', () => {
    let executor: ToolExecutor;

    beforeEach(() => {
      jest.useFakeTimers();
      executor = ToolExecutor.getInstance();
      // Clean up registered tools from previous tests if any
      executor.listTools().forEach(t => executor.unregister(t.name));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('getInstance returns same singleton', () => {
      const a = ToolExecutor.getInstance();
      const b = ToolExecutor.getInstance();
      expect(a).toBe(b);
    });

    test('register, hasTool, listTools', () => {
      const tool: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: { foo: { type: 'string' } },
        handler: jest.fn().mockResolvedValue('ok'),
        timeout: 5000,
      };

      executor.register(tool);
      expect(executor.hasTool('test-tool')).toBe(true);
      expect(executor.listTools()).toEqual([
        {
          name: 'test-tool',
          description: 'A test tool',
          parameters: { foo: { type: 'string' } },
          timeout: 5000,
        },
      ]);
    });

    test('unregister removes tool', () => {
      const tool: ToolDefinition = {
        name: 'remove-me',
        description: 'desc',
        parameters: {},
        handler: jest.fn().mockResolvedValue(1),
      };
      executor.register(tool);
      expect(executor.hasTool('remove-me')).toBe(true);
      executor.unregister('remove-me');
      expect(executor.hasTool('remove-me')).toBe(false);
      expect(executor.listTools()).toHaveLength(0);
    });

    test('execute returns not-found error for unknown tool', async () => {
      const result = await executor.execute('unknown', {});
      expect(result).toEqual<ToolResult>({
        success: false,
        error: 'ไม่พบเครื่องมือที่ต้องการ',
        durationMs: 0,
        retries: 0,
      });
    });

    test('execute successful tool call', async () => {
      const handler = jest.fn().mockResolvedValue({ value: 42 });
      const tool: ToolDefinition = {
        name: 'add',
        description: 'adds things',
        parameters: {},
        handler,
      };
      executor.register(tool);

      const resultPromise = executor.execute('add', { a: 1 });
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 42 });
      expect(result.retries).toBe(0);
      expect(result.durationMs).toBe(0);
      expect(handler).toHaveBeenCalledWith({ a: 1 });
    });

    test('execute emits tool:start and tool:end on success', async () => {
      const startListener = jest.fn();
      const endListener = jest.fn();
      executor.on('tool:start', startListener);
      executor.on('tool:end', endListener);

      const tool: ToolDefinition = {
        name: 'emit-test',
        description: 'desc',
        parameters: {},
        handler: jest.fn().mockResolvedValue('done'),
      };
      executor.register(tool);

      await executor.execute('emit-test', { x: 1 }, { context: { user: 'u1' } });

      expect(startListener).toHaveBeenCalledTimes(1);
      expect(startListener).toHaveBeenCalledWith({
        toolName: 'emit-test',
        attempt: 0,
        params: { x: 1 },
        context: { user: 'u1' },
      });

      expect(endListener).toHaveBeenCalledTimes(1);
      expect(endListener).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'emit-test',
          attempt: 0,
          result: 'done',
        })
      );
      expect(endListener.mock.calls[0][0].attemptDurationMs).toBe(0);
      expect(endListener.mock.calls[0][0].totalDurationMs).toBe(0);
    });

    test('execute times out and returns ToolTimeoutError message', async () => {
      const tool: ToolDefinition = {
        name: 'slow',
        description: 'never resolves',
        parameters: {},
        handler: () => new Promise(() => {}), // hangs
      };
      executor.register(tool);

      const promise = executor.execute('slow', {}, { timeoutMs: 100 });
      jest.advanceTimersByTime(100);
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('เครื่องมือหมดเวลา กรุณาลองใหม่อีกครั้ง');
      expect(result.retries).toBe(0);
    });

    test('execute retries on failure then succeeds', async () => {
      const handler = jest.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockResolvedValueOnce('success');
      const tool: ToolDefinition = {
        name: 'flaky',
        description: 'sometimes fails',
        parameters: {},
        handler,
      };
      executor.register(tool);

      const promise = executor.execute('flaky', {}, { retries: 2 });
      // First attempt fails immediately (rejected promise is microtask, but await inside execute catches it and hits delay)
      // We need to flush the microtask for the first rejection to be processed before advancing timers?
      // Actually, the rejection is a microtask. `await handler(...)` will process it. But `execute` is async. When we call `executor.execute(...)`, it runs synchronously until the first `await`.
      // The `await` on `handler` will queue the catch block as a microtask? No, `await` on a rejected promise will throw, and the `catch` block is part of the async function body. The async function returns a promise immediately. The body runs until the first `await`, then returns. The microtask to resume after `await` is queued.
      // So after calling `execute`, the first `await handler(...)` is queued. We need to let that microtask run so that it enters the `catch` block and sets up the `delay` timer.
      // To do this, we can do `await Promise.resolve();` before advancing timers.
      await Promise.resolve(); // flush microtask for first await rejection
      // Now it should be in the delay(1000) phase.
      jest.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.retries).toBe(1);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    // Hmm, the `await Promise.resolve()` might be needed in other tests too if there are async handlers.
    // But in the timeout test, the handler never resolves, so `execute` is suspended at `await raceWithTimeout(...)` which is suspended at `await promise` (the hanging one). The `raceWithTimeout` sets up a timer. So `advanceTimersByTime` works without `await Promise.resolve()`.
    // For the success test, the handler resolves immediately (mockResolvedValue). `await handler(...)` resolves in a microtask. If we just `await executor.execute(...)`, it will wait for all microtasks. So no need for `advanceTimersByTime`.
    // For retry test, the first rejection needs to be processed. Let's think carefully.

    Actually, `jest.fn().mockRejectedValueOnce(new Error('fail1'))` creates a promise that is rejected immediately. When `execute` calls `tool.handler(params)`, it gets a rejected promise. The `await` in `try` will throw. In an async function, when you `await` a rejected promise, the function's promise is rejected? No, the `try/catch` around it catches it. The execution of the async function proceeds to the `catch` block. But this happens via the microtask queue. So after calling `execute()`, the async function body runs until `await raceWithTimeout(...)`. Inside `raceWithTimeout`, it calls `promise.then(...).catch(...)`. The `tool.handler` returned a rejected promise, so `.catch(...)` is invoked synchronously? No, `promise.then().catch()` registers handlers. The rejection is already known. The `.catch` callback is queued as a microtask. So `raceWithTimeout` returns a new Promise. The `execute` function awaits that new Promise. So `execute` returns control. Then the microtask queue processes the `.catch` of `raceWithTimeout`, which rejects the outer promise of `raceWithTimeout`. Then another microtask processes the `await` in `execute`, which sees the rejection and enters the `catch` block. Inside the `catch` block, it emits and then hits `await this.delay(...)`. So yes, we need to flush microtasks to get to the delay.

    How many `await Promise.resolve()` calls? One might be enough if Jest processes all microtasks recursively? No, `await Promise.resolve()` yields once, allowing the currently queued microtasks to run. But those microtasks might queue more microtasks. So one `await Promise.resolve()` might not be enough if there are chained microtasks. However, in this case:
    - Microtask 1: `raceWithTimeout`'s `.catch` handler runs -> rejects outer promise.
    - Microtask 2: `execute`'s `await` resumes, enters `catch`, calls `delay`.
    - `delay` sets up a timer. So after Microtask 2, we are at the timer. So one `await Promise.resolve()` should be enough to get to the timer setup.

    But to be safe, we can use `await Promise.resolve();` before `advanceTimersByTime`. Or we can use a helper `const flush = () => new Promise(r => setTimeout(r, 0));` but that uses timers which are faked. Better to just do `await Promise.resolve();` and maybe a second one if needed.

    Actually, there's a known pattern: `await jest.advanceTimersByTimeAsync(ms)` in Jest 27+? No, that's not a thing. There's `jest.runOnlyPendingTimers()` which advances to the next timer, but it also runs microtasks? No, `runOnlyPendingTimers` runs timers but not necessarily all microtasks. In modern fake timers, `jest.advanceTimersByTime` does not flush microtasks automatically. But `await`ing the promise after advancing timers should work because the timer callback resolves the delay promise, and then `await` on the outer promise waits for the microtask.

    Let's reconsider the retry test flow:
    1. `const promise = executor.execute('flaky', {}, { retries: 2 });`
       - `execute` body runs. `tool` found. `startTime = Date.now()`.
       - attempt=0. `emit('tool:start')`.
       - `raceWithTimeout(tool.handler(params), effectiveTimeout)`.
         - `tool.handler` returns rejected promise.
         - `raceWithTimeout` sets up timeout timer.
         - attaches `.then` and `.catch` to handler promise.
         - returns outer promise.
       - `execute` awaits outer promise. Returns control to test.
    2. `await Promise.resolve();`
       - Microtask: handler promise is rejected, `.catch` in raceWithTimeout runs -> rejects outer promise with `Error('fail1')`.
       - Another microtask: `execute` resumes from `await`, enters `catch`.
       - `errorMessage = toErrorMessage(error)` -> `EXEC_ERROR_MESSAGE`.
       - `emit('tool:error')`.
       - `attempt === maxRetries`? No (0 < 2).
       - `await this.delay(1000)`. Returns control.
    3. `jest.advanceTimersByTime(1000);`
       - Timer callback for delay runs -> resolves delay promise.
    4. `const result = await promise;`
       - Microtask: delay promise resolves, `execute` resumes after delay.
       - attempt=1. `emit('tool:start')`.
       - `raceWithTimeout(tool.handler(params), effectiveTimeout)`.
         - `tool.handler` returns resolved promise ('success').
         - `raceWithTimeout` attaches `.then`. Since promise is resolved, `.then` callback is queued as microtask.
         - returns outer promise.
       - `execute` awaits outer promise. Returns control.
    5. `await promise` (the outer `const result = await promise`) yields control.
       - Microtask: `.then` in raceWithTimeout runs -> resolves outer promise with 'success'.
       - Microtask: `execute` resumes. `emit('tool:end')`. Returns result object.
       - `result` is assigned.

    So `await Promise.resolve()` is needed before `advanceTimersByTime` to let the first failure propagate to the delay setup. Otherwise, if we call `advanceTimersByTime` immediately, the delay timer hasn't been set up yet because the microtask to enter the catch block hasn't run.

    Wait, is `tool.handler` returning a rejected promise from `mockRejectedValueOnce` synchronous? Yes, `jest.fn().mockRejectedValueOnce(value)` means the mock returns `Promise.reject(value)` immediately when called. So the promise is already rejected when `raceWithTimeout` receives it. The `.catch` handler attachment happens after rejection. In native Promises, attaching a handler to an already-rejected promise queues the handler as a microtask. So yes, we need to flush.

    For the success case with `mockResolvedValue`, similarly, attaching `.then` to an already-resolved promise queues it as a microtask. But in the success test, we just do `await executor.execute(...)` which yields control, allowing microtasks to run, so it resolves fine without manual flushing.

    For the retry test, we need the intermediate step. So `await Promise.resolve()` is necessary.

    What about the timeout test? The handler returns `new Promise(() => {})`. This promise is pending forever. `raceWithTimeout` attaches `.then`/`.catch`. Then `execute` awaits the outer promise. We call `advanceTimersByTime(100)`. The timeout timer fires, calling `reject(new ToolTimeoutError())`. This is synchronous inside the timer callback. The outer promise is rejected. Then `await promise` yields control, microtask runs to resume `execute` in its `catch` block. So no `await Promise.resolve()` needed before `advanceTimersByTime` because the timer is already set up during the synchronous part of `raceWithTimeout`.

    What about testing multiple retries? Let's say maxRetries=3 and all fail. We need to flush and advance multiple times.
    ```typescript
    const promise = executor.execute('fail', {}, { retries: 3 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await Promise.resolve(); // flush failure to delay
      jest.advanceTimersByTime(1000 * Math.pow(2, attempt));
    }
    // Now attempt 3 fails. No more delay.
    const result = await promise;
    ```
    Wait, after advancing the last delay, attempt 3 runs. It fails. `execute` enters catch. Since `attempt === maxRetries`, it returns the error result directly (no more delay). So `await promise` should get it. But does attempt 3's failure require a microtask flush before `await promise` resolves? Let's trace:
    - After advancing delay for attempt 2->3, `execute` resumes attempt 3.
    - `raceWithTimeout` with handler that rejects.
    - `execute` awaits outer promise. Returns control.
    - We do `const result = await promise;` which yields.
    - Microtask: raceWithTimeout's `.catch` runs -> rejects outer promise.
    - Microtask: `execute` catch block runs. `attempt === maxRetries`. Returns result object.
    - `result` is assigned.
    So yes, `await promise` handles it.

    But what about the loop? After attempt 3 fails, `execute` returns the error result from inside the catch block. Does it return a promise that resolves to the result? Yes, async functions always return a promise. The `return` statement in the catch block resolves the outer promise of `execute`.

    So the pattern for multi-retry failure:
    ```typescript
    const promise = executor.execute('fail', {}, { retries: 3 });
    await Promise.resolve(); // attempt 0 fails -> delay 1000
    jest.advanceTimersByTime(1000);
    await Promise.resolve(); // attempt 1 fails -> delay 2000
    jest.advanceTimersByTime(2000);
    await Promise.resolve(); // attempt 2 fails -> delay 4000
    jest.advanceTimersByTime(4000);
    // attempt 3 fails, returns directly
    const result = await promise

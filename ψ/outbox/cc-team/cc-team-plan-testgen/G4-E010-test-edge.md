<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E010 role=test-edge model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1745,"completion_tokens":2807,"total_tokens":4552,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T11:12:49.050Z -->
```typescript
import ToolExecutor, {
  ToolTimeoutError,
  ToolParamError,
  ToolDefinition,
} from '../src/services/toolExecutor';

describe('ToolExecutor - edge cases and error paths', () => {
  let executor: ToolExecutor;

  const baseTool: ToolDefinition = {
    name: 'noop',
    description: 'no-op tool',
    parameters: {},
    handler: jest.fn(async () => 'ok'),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    executor = ToolExecutor.getInstance();
    // Reset internal registry between tests
    executor.listTools().forEach((t) => executor.unregister(t.name));
    (baseTool.handler as jest.Mock).mockClear();
    (baseTool.handler as jest.Mock).mockResolvedValue('ok');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('getInstance returns the same singleton', () => {
    const a = ToolExecutor.getInstance();
    const b = ToolExecutor.getInstance();
    expect(a).toBe(b);
  });

  test('execute() returns not-found result for unknown tool without throwing', async () => {
    const result = await executor.execute('does-not-exist', { foo: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('ไม่พบเครื่องมือที่ต้องการ');
    expect(result.durationMs).toBe(0);
    expect(result.retries).toBe(0);
    expect(result.data).toBeUndefined();
  });

  test('register() overwrites a tool with the same name', () => {
    const original: ToolDefinition = { ...baseTool, handler: jest.fn(async () => 'a') };
    const replacement: ToolDefinition = { ...baseTool, handler: jest.fn(async () => 'b') };
    executor.register(original);
    executor.register(replacement);
    expect(executor.hasTool('noop')).toBe(true);
  });

  test('unregister() on unknown name is a no-op (no throw)', () => {
    expect(() => executor.unregister('nope')).not.toThrow();
    expect(executor.hasTool('nope')).toBe(false);
  });

  test('listTools() returns an empty array when nothing registered', () => {
    expect(executor.listTools()).toEqual([]);
  });

  test('listTools() does NOT expose the handler function (public surface only)', () => {
    executor.register(baseTool);
    const list = executor.listTools();
    expect(list).toHaveLength(1);
    const entry = list[0];
    expect(entry.name).toBe('noop');
    expect(entry.description).toBe(baseTool.description);
    expect(entry.parameters).toEqual(baseTool.parameters);
    expect((entry as unknown as { handler?: unknown }).handler).toBeUndefined();
  });

  test('execute() with no retries and failing handler returns generic error message', async () => {
    const failing: ToolDefinition = {
      ...baseTool,
      name: 'failing',
      handler: jest.fn(async () => {
        throw new Error('boom');
      }),
    };
    executor.register(failing);

    const result = await executor.execute('failing', null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('เกิดข้อผิดพลาดในการเรียกใช้เครื่องมือ');
    expect(result.data).toBeUndefined();
    expect(result.retries).toBe(0);
    expect(failing.handler).toHaveBeenCalledTimes(1);
  });

  test('execute() clamps negative retries to 0 and huge retries to MAX_RETRIES (3)', async () => {
    const failing: ToolDefinition = {
      ...baseTool,
      name: 'failing',
      handler: jest.fn(async () => {
        throw new Error('boom');
      }),
    };
    executor.register(failing);

    // Negative retries -> should not call the handler multiple extra times
    const r1 = await executor.execute('failing', null, { retries: -10 });
    expect(r1.success).toBe(false);
    expect(failing.handler).toHaveBeenCalledTimes(1);

    failing.handler.mockClear();

    // Large retries -> at most 1 + MAX_RETRIES = 4 total attempts
    const r2 = await executor.execute('failing', null, { retries: 999 });
    expect(r2.success).toBe(false);
    expect(failing.handler).toHaveBeenCalledTimes(4);
    expect(r2.retries).toBe(3);
  });

  test('execute() retries on transient failure and eventually succeeds', async () => {
    let calls = 0;
    const flaky: ToolDefinition = {
      ...baseTool,
      name: 'flaky',
      handler: jest.fn(async () => {
        calls += 1;
        if (calls < 2) {
          throw new Error('transient');
        }
        return 'finally';
      }),
    };
    executor.register(flaky);

    const promise = executor.execute('flaky', null, { retries: 3 });
    // Advance through the exponential backoff between attempts
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1_000);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.data).toBe('finally');
    expect(result.retries).toBe(1);
    expect(flaky.handler).toHaveBeenCalledTimes(2);
  });

  test('execute() surfaces ToolParamError message verbatim (not the generic wrapper)', async () => {
    const paramErrTool: ToolDefinition = {
      ...baseTool,
      name: 'param-err',
      handler: jest.fn(async () => {
        throw new ToolParamError();
      }),
    };
    executor.register(paramErrTool);

    const result = await executor.execute('param-err', null, { retries: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('พารามิเตอร์ไม่ถูกต้อง');
  });

  test('execute() surfaces ToolTimeoutError message verbatim when handler exceeds timeout', async () => {
    const slow: ToolDefinition = {
      ...baseTool,
      name: 'slow',
      timeout: 50,
      handler: jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('late'), 5_000)),
      ),
    };
    executor.register(slow);

    const promise = executor.execute('slow', null, { retries: 0 });
    // Attach the catch early so the unhandled rejection doesn't leak
    const guarded = promise.catch((e) => e);
    await jest.advanceTimersByTimeAsync(60);
    const result = await guarded;

    expect(result.success).toBe(false);
    expect(result.error).toBe('เครื่องมือหมดเวลา กรุณาลองใหม่อีกครั้ง');
    expect(result.retries).toBe(0);
  });

  test('execute() uses options.timeoutMs over tool.timeout and default', async () => {
    const slow: ToolDefinition = {
      ...baseTool,
      name: 'slow2',
      timeout: 10_000,
      handler: jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('late'), 5_000)),
      ),
    };
    executor.register(slow);

    const promise = executor.execute('slow2', null, { retries: 0, timeoutMs: 25 });
    const guarded = promise.catch((e) => e);
    await jest.advanceTimersByTimeAsync(30);
    const result = await guarded;

    expect(result.success).toBe(false);
    expect(result.error).toBe('เครื่องมือหมดเวลา กรุณาลองใหม่อีกครั้ง');
  });

  test('execute() returns generic error after all retries are exhausted', async () => {
    const failing: ToolDefinition = {
      ...baseTool,
      name: 'always-fail',
      handler: jest.fn(async () => {
        throw new Error('nope');
      }),
    };
    executor.register(failing);

    const promise = executor.execute('always-fail', null, { retries: 2 });
    // Backoff delays: 1000ms, 2000ms
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1_000);
    await jest.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBe('เกิดข้อผิดพลาดในการเรียกใช้เครื่องมือ');
    expect(failing.handler).toHaveBeenCalledTimes(3);
    expect(result.retries).toBe(2);
  });

  test('execute() handles handler rejecting with non-Error values (e.g. string)', async () => {
    const weird: ToolDefinition = {
      ...baseTool,
      name: 'weird',
      handler: jest.fn(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'just a string';
      }),
    };
    executor.register(weird);

    const result = await executor.execute('weird', null, { retries: 0 });
    expect(result.success).toBe(false);
    // Non-ToolTimeoutError / non-ToolParamError -> generic message
    expect(result.error).toBe('เกิดข้อผิดพลาดในการเรียกใช้เครื่องมือ');
  });

  test('execute() does not leak a Timer when the handler resolves quickly', async () => {
    const fast: ToolDefinition = {
      ...baseTool,
      name: 'fast',
      timeout: 1_000,
      handler: jest.fn(async () => 42),
    };
    executor.register(fast);

    const result = await executor.execute('fast', null);
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
    // Allow the (unused) timeout callback to fire without crashing
    await jest.advanceTimersByTimeAsync(2_000);
  });

  test('execute() emits tool:start and tool:end events for successful execution', async () => {
    executor.register({ ...baseTool, name: 'evt' });
    const startSpy = jest.fn();
    const endSpy = jest.fn();
    executor.on('tool:start', startSpy);
    executor.on('tool:end', endSpy);

    const result = await executor.execute('evt', { x: 1 });
    expect(result.success).toBe(true);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(startSpy.mock.calls[0][0]).toMatchObject({ toolName: 'evt', attempt: 0 });
    expect(endSpy.mock.calls[0][0]).toMatchObject({ toolName: 'evt', attempt: 0, result: 'ok' });
  });

  test('execute() emits tool:error events for failed attempts', async () => {
    const failing: ToolDefinition = {
      ...baseTool,
      name: 'evt-err',
      handler: jest.fn(async () => {
        throw new Error('boom');
      }),
    };
    executor.register(failing);
    const errSpy = jest.fn();
    executor.on('tool:error', errSpy);

    const result = await executor.execute('evt-err', null, { retries: 0 });
    expect(result.success).toBe(false);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toMatchObject({ toolName: 'evt-err', attempt: 0 });
    expect(errSpy.mock.calls[0][0].originalError).toBeInstanceOf(Error);
  });

  test('constructor swallows internal "error" events (no unhandled crash)', () => {
    expect(() => executor.emit('error', new Error('ignored'))).not.toThrow();
  });

  test('ToolTimeoutError and ToolParamError expose correct name and message', () => {
    const t = new ToolTimeoutError();
    const p = new ToolParamError();
    expect(t).toBeInstanceOf(Error);
    expect(p).toBeInstanceOf(Error);
    expect(t.name).toBe('ToolTimeoutError');
    expect(p.name).toBe('ToolParamError');
    expect(typeof t.message).toBe('string');
    expect(typeof p.message).toBe('string');
    expect(t.message.length).toBeGreaterThan(0);
    expect(p.message.length).toBeGreaterThan(0);
  });
});
```

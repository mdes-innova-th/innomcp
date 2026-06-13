<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T010 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2297,"completion_tokens":2578,"total_tokens":4875,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 34s
 generated: 2026-06-13T10:52:17.402Z -->
```typescript
import HealthAggregator from '../src/services/healthAggregator';
import type {
  HealthChecker,
  HealthStatus,
  AggregatedHealth,
} from '../src/services/healthAggregator';

describe('HealthAggregator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    // Reset the singleton between tests by clearing the registered checkers
    // and cache via a fresh instance through reflection.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance = HealthAggregator.getInstance() as any;
    if (instance && instance.checkers) {
      instance.checkers.clear();
      instance.cache = null;
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('getInstance() returns a singleton', () => {
    const a = HealthAggregator.getInstance();
    const b = HealthAggregator.getInstance();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(HealthAggregator);
  });

  test('check() aggregates custom registered checkers and summarizes correctly', async () => {
    const agg = HealthAggregator.getInstance();
    const healthyChecker: HealthChecker = async () => ({
      status: 'healthy',
      message: 'ok',
    });
    const degradedChecker: HealthChecker = async () => ({
      status: 'degraded',
      message: 'slow',
    });
    const unhealthyChecker: HealthChecker = async () => ({
      status: 'unhealthy',
      message: 'down',
    });

    agg.registerChecker('healthy-one', healthyChecker);
    agg.registerChecker('degraded-one', degradedChecker);
    agg.registerChecker('unhealthy-one', unhealthyChecker);

    const result = await agg.check();

    expect(result.status).toBe<'healthy' | 'degraded' | 'unhealthy'>(
      'unhealthy',
    );
    expect(result.summary).toEqual({
      total: 3,
      healthy: 1,
      degraded: 1,
      unhealthy: 1,
    });
    expect(Object.keys(result.checks).sort()).toEqual(
      ['degraded-one', 'healthy-one', 'unhealthy-one'].sort(),
    );
    expect(result.checks['healthy-one'].status).toBe('healthy');
    expect(result.checks['degraded-one'].status).toBe('degraded');
    expect(result.checks['unhealthy-one'].status).toBe('unhealthy');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
  });

  test('check() returns degraded when no unhealthy checkers exist', async () => {
    const agg = HealthAggregator.getInstance();
    agg.registerChecker('a', async () => ({ status: 'healthy' }));
    agg.registerChecker('b', async () => ({ status: 'degraded' }));

    const result = await agg.check();
    expect(result.status).toBe('degraded');
    expect(result.summary).toEqual({
      total: 2,
      healthy: 1,
      degraded: 1,
      unhealthy: 0,
    });
  });

  test('check() returns healthy when all checkers are healthy', async () => {
    const agg = HealthAggregator.getInstance();
    agg.registerChecker('a', async () => ({ status: 'healthy' }));
    agg.registerChecker('b', async () => ({ status: 'healthy' }));

    const result = await agg.check();
    expect(result.status).toBe('healthy');
    expect(result.summary).toEqual({
      total: 2,
      healthy: 2,
      degraded: 0,
      unhealthy: 0,
    });
  });

  test('check() marks a throwing checker as unhealthy and includes an error message', async () => {
    const agg = HealthAggregator.getInstance();
    agg.registerChecker('boom', async () => {
      throw new Error('kaboom');
    });

    const result = await agg.check();
    expect(result.checks['boom'].status).toBe('unhealthy');
    expect(result.checks['boom'].message).toContain('การตรวจสอบล้มเหลว');
    expect(result.checks['boom'].message).toContain('kaboom');
    expect(typeof result.checks['boom'].durationMs).toBe('number');
  });

  test('check() times out slow checkers and reports unhealthy with Thai message', async () => {
    const agg = HealthAggregator.getInstance();
    // A checker that never resolves, with a short custom timeout.
    const slowChecker: HealthChecker = () => new Promise<HealthStatus>(() => {});
    agg.registerChecker('slow', slowChecker, 1000);

    // The setTimeout in runCheckerWithTimeout is scheduled with fake timers.
    const pending = agg.check();

    // Fast-forward past the 1000ms timeout.
    jest.advanceTimersByTime(1500);
    // Allow queued microtasks (Promise.race resolution) to settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const result = await pending;
    expect(result.checks['slow'].status).toBe('unhealthy');
    expect(result.checks['slow'].message).toContain('หมดเวลา');
    expect(result.checks['slow'].message).toContain('1000ms');
  });

  test('check() uses a 10-second cache to return identical results within the TTL', async () => {
    const agg = HealthAggregator.getInstance();
    let calls = 0;
    const counting: HealthChecker = async () => {
      calls += 1;
      return { status: 'healthy' };
    };
    agg.registerChecker('counting', counting);

    const first = await agg.check();
    const second = await agg.check();
    const third = await agg.check();

    expect(calls).toBe(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  test('check() refreshes the cache after the 10-second TTL elapses', async () => {
    const agg = HealthAggregator.getInstance();
    let calls = 0;
    const counting: HealthChecker = async () => {
      calls += 1;
      return { status: 'healthy' };
    };
    agg.registerChecker('counting', counting);

    const first = await agg.check();
    expect(calls).toBe(1);

    // Advance just under the TTL — still cached.
    jest.advanceTimersByTime(9999);
    const stillCached = await agg.check();
    expect(calls).toBe(1);
    expect(stillCached).toBe(first);

    // Cross the TTL boundary — should re-run checkers.
    jest.advanceTimersByTime(2);
    const refreshed = await agg.check();
    expect(calls).toBe(2);
    expect(refreshed.checks['counting'].status).toBe('healthy');
  });

  test('registerChecker() invalidates the cache so subsequent check() reruns', async () => {
    const agg = HealthAggregator.getInstance();
    let aCalls = 0;
    let bCalls = 0;

    agg.registerChecker('a', async () => {
      aCalls += 1;
      return { status: 'healthy' };
    });

    const first = await agg.check();
    expect(aCalls).toBe(1);

    // Registering a new checker should clear the cache.
    agg.registerChecker('b', async () => {
      bCalls += 1;
      return { status: 'healthy' };
    });

    const second = await agg.check();
    expect(aCalls).toBe(2);
    expect(bCalls).toBe(1);
    expect(second).not.toBe(first);
    expect(Object.keys(second.checks).sort()).toEqual(['a', 'b']);
  });

  test('check() captures durationMs for each checker', async () => {
    const agg = HealthAggregator.getInstance();
    agg.registerChecker('a', async () => ({ status: 'healthy' }));
    const result = await agg.check();
    for (const name of Object.keys(result.checks)) {
      expect(typeof result.checks[name].durationMs).toBe('number');
      expect(Number.isFinite(result.checks[name].durationMs)).toBe(true);
    }
  });

  test('check() runs all checkers in parallel (no sequential blocking)', async () => {
    const agg = HealthAggregator.getInstance();
    const order: string[] = [];

    const makeDelayed = (label: string, ms: number): HealthChecker =>
      async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            order.push(`resolved:${label}`);
            resolve();
          }, ms);
        });
        order.push(`done:${label}`);
        return { status: 'healthy' };
      };

    agg.registerChecker('first', makeDelayed('first', 200));
    agg.registerChecker('second', makeDelayed('second', 200));
    agg.registerChecker('third', makeDelayed('third', 200));

    const pending = agg.check();
    // Advance time enough for all three timeouts to fire concurrently.
    jest.advanceTimersByTime(250);
    // Flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const result = await pending;

    // If run in parallel, the three "resolved:" entries should appear
    // before any "done:" entry, and the set of checkers should be present.
    expect(result.summary.total).toBe(3);
    expect(result.status).toBe('healthy');
    const resolvedIdx = order
      .filter((e) => e.startsWith('resolved:'))
      .map((e) => order.indexOf(e));
    const doneIdx = order
      .filter((e) => e.startsWith('done:'))
      .map((e) => order.indexOf(e));
    expect(resolvedIdx.length).toBe(3);
    expect(doneIdx.length).toBe(3);
    // Each "done" should come after its corresponding "resolved".
    for (let i = 0; i < 3; i++) {
      expect(doneIdx[i]).toBeGreaterThan(resolvedIdx[i]);
    }
  });

  test('check() propagates custom message and details from a checker', async () => {
    const agg = HealthAggregator.getInstance();
    const richDetails: Record<string, unknown> = {
      activeConnections: 3,
      region: 'us-east-1',
    };
    agg.registerChecker('rich', async () => ({
      status: 'healthy',
      message: 'all good',
      details: richDetails,
    }));

    const result = await agg.check();
    expect(result.checks['rich'].message).toBe('all good');
    expect(result.checks['rich'].details).toEqual(richDetails);
  });

  test('check() with zero registered checkers yields an empty, healthy result', async () => {
    const agg = HealthAggregator.getInstance();
    // No checkers registered (built-ins were cleared in beforeEach).
    const result: AggregatedHealth = await agg.check();
    expect(result.summary).toEqual({
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
    });
    expect(result.status).toBe('healthy');
    expect(result.checks).toEqual({});
  });

  test('check() handles a checker that resolves with a non-Error rejection value gracefully', async () => {
    const agg = HealthAggregator.getInstance();
    // Force a rejection with a non-Error value.
    const bad: HealthChecker = () =>
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      Promise.reject('plain string failure') as unknown as Promise<HealthStatus>;
    agg.registerChecker('bad', bad);

    const result = await agg.check();
    expect(result.checks['bad'].status).toBe('unhealthy');
    expect(result.checks['bad'].message).toContain('การตรวจสอบล้มเหลว');
  });
});
```

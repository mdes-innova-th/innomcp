<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T036 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1323,"completion_tokens":4389,"total_tokens":5712,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3598,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T10:59:26.214Z -->
```typescript
import { GeoGuard } from '../src/geo/geo-guard';

describe('GeoGuard', () => {
  let guard: GeoGuard;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('successful first attempt returns packet without error', async () => {
    const toolFn = jest.fn().mockResolvedValue({ data: 'test' });
    guard = new GeoGuard();
    const result = await guard.executeWithGuard(toolFn, 'weather-api');

    expect(result.error).toBeUndefined();
    expect(result.evidence.tool).toBe('weather-api');
    expect(result.evidence.confidence).toBe(1);
    expect(result.fallback_used).toBeUndefined();
    expect(toolFn).toHaveBeenCalledTimes(1);
  });

  test('first attempt fails, retry succeeds, fallback_used is true', async () => {
    const toolFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: 'ok' });

    guard = new GeoGuard();
    const result = await guard.executeWithGuard(toolFn, 'weather-api');

    expect(result.error).toBeUndefined();
    expect(result.fallback_used).toBe(true);
    expect(toolFn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Retrying weather-api'),
    );
  });

  test('both attempts fail returns degraded packet', async () => {
    const toolFn = jest.fn().mockRejectedValue(new Error('Always fail'));

    guard = new GeoGuard();
    const result = await guard.executeWithGuard(toolFn, 'fail-api');

    expect(result.error).toBe('Always fail');
    expect(result.fallback_used).toBe(true);
    expect(result.summary).toContain('ขออภัย');
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('fail-api failed after retry'),
    );
    expect(toolFn).toHaveBeenCalledTimes(2);
  });

  test('timeout after both attempts returns degraded packet', async () => {
    // toolFn returns a promise that never resolves
    const toolFn = jest.fn().mockReturnValue(new Promise(() => {}));

    guard = new GeoGuard(100); // short timeout
    const resultPromise = guard.executeWithGuard(toolFn, 'timeout-tool');

    // Advance timers enough for two timeouts (100ms each) plus margin
    jest.advanceTimersByTime(250);
    const result = await resultPromise;

    expect(result.error).toContain('Timeout');
    expect(result.fallback_used).toBe(true);
    expect(toolFn).toHaveBeenCalledTimes(2);
  });

  test('latency_ms is recorded in evidence', async () => {
    const toolFn = jest.fn().mockResolvedValue('data');

    guard = new GeoGuard();
    const result = await guard.executeWithGuard(toolFn, 'latency-test');

    expect(typeof result.evidence.latency_ms).toBe('number');
    expect(result.evidence.latency_ms).toBeGreaterThanOrEqual(0);
  });
});
```

<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T005 role=test model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":1725,"completion_tokens":8000,"total_tokens":9725,"prompt_tokens_details":{"cached_tokens":1664,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6948,"image_tokens":0},"cache_creation_input_tokens":0} | 84s
 generated: 2026-06-13T10:51:53.287Z -->
```typescript
import { backpressureHandler } from '../src/services/backpressureHandler';

describe('backpressureHandler', () => {
  let handler: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    handler = backpressureHandler as any;
    handler.MAX_CONCURRENT = 10;
    handler.MAX_QUEUE_SIZE = 100;
    handler.running = 0;
    handler.queue = [];
    handler.processed = 0;
    handler.rejected = 0;
    handler.totalWaitTime = 0;
    handler.waitCount = 0;
    handler.drainResolvers = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should execute task immediately when under concurrency limit', async () => {
    const execute = jest.fn().mockResolvedValue('result');
    const promise = backpressureHandler.enqueue({
      id: '1',
      sessionId: 's1',
      execute,
      priority: 0,
    });
    expect(backpressureHandler.getStats()).toMatchObject({
      running: 1,
      queued: 0,
      processed: 0,
    });
    await expect(promise).resolves.toBe('result');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(backpressureHandler.getStats()).toMatchObject({
      running: 0,
      processed: 1,
      queued: 0,
    });
  });

  test('should execute tasks in priority order when queued', async () => {
    backpressureHandler.setMaxConcurrent(1);
    const order: string[] = [];
    let resolveA: any, resolveB: any, resolveC: any;
    const executeA = () =>
      new Promise((r) => {
        resolveA = r;
        order.push('startA');
      });
    const executeB = () =>
      new Promise((r) => {
        resolveB = r;
        order.push('startB');
      });
    const executeC = () =>
      new Promise((r) => {
        resolveC = r;
        order.push('startC');
      });

    const pA = backpressureHandler.enqueue({
      id: 'A',
      sessionId: 's',
      execute: executeA,
      priority: 1,
    });
    const pB = backpressureHandler.enqueue({
      id: 'B',
      sessionId: 's',
      execute: executeB,
      priority: 10,
    });
    const pC = backpressureHandler.enqueue({
      id: 'C',
      sessionId: 's',
      execute: executeC,
      priority: 5,
    });

    expect(order).toEqual(['startA']);
    expect(backpressureHandler.getStats().queued).toBe(2);

    resolveA();
    await Promise.resolve();
    expect(order).toEqual(['startA', 'startB']);
    expect(backpressureHandler.getStats().queued).toBe(1);

    resolveB();
    await Promise.resolve();
    expect(order).toEqual(['startA', 'startB', 'startC']);
    expect(backpressureHandler.getStats().queued).toBe(0);

    resolveC();
    await Promise.all([pA, pB, pC]);
    expect(backpressureHandler.getStats().processed).toBe(3);
  });

  test('should reject when queue overflows', async () => {
    handler.MAX_QUEUE_SIZE = 2;
    backpressureHandler.setMaxConcurrent(0);
    const execute = jest.fn().mockResolvedValue('ok');
    const p1 = backpressureHandler.enqueue({
      id: '1',
      sessionId: 's',
      execute,
      priority: 0,
    });
    const p2 = backpressureHandler.enqueue({
      id: '2',
      sessionId: 's',
      execute,
      priority: 0,
    });
    expect(backpressureHandler.getStats().queued).toBe(2);
    await expect(
      backpressureHandler.enqueue({
        id: '3',
        sessionId: 's',
        execute,
        priority: 0,
      })
    ).rejects.toThrow('Queue overflow');
    expect(backpressureHandler.getStats().rejected).toBe(1);
    backpressureHandler.clear();
    await expect(p1).rejects.toThrow('Queue cleared');
    await expect(p2).rejects.toThrow('Queue cleared');
  });

  test('should compute average wait time correctly', async () => {
    backpressureHandler.setMaxConcurrent(1);
    let resolveA: any, resolveB: any;
    const executeA = () => new Promise((r) => (resolveA = r));
    const executeB = () => new Promise((r) => (resolveB = r));

    backpressureHandler.enqueue({
      id: 'A',
      sessionId: 's',
      execute: executeA

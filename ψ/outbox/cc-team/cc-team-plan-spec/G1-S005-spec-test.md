<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S005 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":352,"completion_tokens":1697,"total_tokens":2049,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:20:35.288Z -->
```typescript
import { backpressureHandler, QueueItem } from '../src/services/backpressureHandler';

type EnqueueResult = { accepted: boolean; retryAfterMs?: number };

const makeItem = (id: string, priority: number = 0): QueueItem => ({
  id,
  priority,
  payload: { id },
  enqueuedAt: new Date(),
});

describe('backpressureHandler — contract', () => {
  beforeEach(() => {
    // Reset internal state between tests by re-initializing via a fresh instance
    (backpressureHandler as any).reset?.();
    (backpressureHandler as any).clear?.();
  });

  describe('enqueue()', () => {
    it('returns an accepted=true result for a single valid item', () => {
      const result = backpressureHandler.enqueue(makeItem('a')) as EnqueueResult;
      expect(result).toBeDefined();
      expect(result.accepted).toBe(true);
    });

    it('increments the internal queue size for each accepted item', () => {
      backpressureHandler.enqueue(makeItem('a'));
      backpressureHandler.enqueue(makeItem('b'));
      backpressureHandler.enqueue(makeItem('c'));

      const size = (backpressureHandler as any).size?.() ?? backpressureHandler.getQueueSize?.();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(3);
    });

    it('throws or rejects when given an item missing required fields', () => {
      const invalid = { foo: 'bar' } as unknown as QueueItem;
      expect(() => backpressureHandler.enqueue(invalid)).toThrow();
    });

    it('throws when given a non-object value (null, undefined, primitives)', () => {
      expect(() => backpressureHandler.enqueue(null as unknown as QueueItem)).toThrow();
      expect(() => backpressureHandler.enqueue(undefined as unknown as QueueItem)).toThrow();
      expect(() => backpressureHandler.enqueue(42 as unknown as QueueItem)).toThrow();
      expect(() => backpressureHandler.enqueue('item' as unknown as QueueItem)).toThrow();
    });

    it('enforces a high-water mark: once exceeded, returns accepted=false with a retryAfterMs hint', () => {
      const highWater = (backpressureHandler as any).config?.highWaterMark ?? 100;
      // Fill past high-water mark
      for (let i = 0; i < highWater + 5; i++) {
        backpressureHandler.enqueue(makeItem(`x-${i}`));
      }
      const result = backpressureHandler.enqueue(makeItem('overflow')) as EnqueueResult;
      expect(result).toBeDefined();
      expect(result.accepted).toBe(false);
      expect(typeof result.retryAfterMs).toBe('number');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('respects priority ordering on dequeue (higher priority first)', () => {
      backpressureHandler.enqueue(makeItem('low', 1));
      backpressureHandler.enqueue(makeItem('high', 10));
      backpressureHandler.enqueue(makeItem('mid', 5));

      const next = backpressureHandler.dequeue?.() ?? backpressureHandler.next?.();
      expect(next).toBeDefined();
      expect(next?.id).toBe('high');
    });
  });

  describe('dequeue() / next()', () => {
    it('returns undefined or null when the queue is empty', () => {
      const result = backpressureHandler.dequeue?.() ?? backpressureHandler.next?.();
      expect(result == null).toBe(true);
    });

    it('decrements the queue size when an item is removed', () => {
      backpressureHandler.enqueue(makeItem('a'));
      backpressureHandler.enqueue(makeItem('b'));

      const sizeBefore = (backpressureHandler as any).size?.() ?? backpressureHandler.getQueueSize?.();
      backpressureHandler.dequeue?.() ?? backpressureHandler.next?.();
      const sizeAfter = (backpressureHandler as any).size?.() ?? backpressureHandler.getQueueSize?.();

      expect(sizeAfter).toBeLessThan(sizeBefore);
    });
  });

  describe('drain / process semantics', () => {
    it('drains the queue completely when invoked', () => {
      for (let i = 0; i < 10; i++) {
        backpressureHandler.enqueue(makeItem(`d-${i}`));
      }

      const drainFn =
        (backpressureHandler as any).drain ??
        (backpressureHandler as any).processAll ??
        (backpressureHandler as any).flush;

      if (typeof drainFn === 'function') {
        const processed: QueueItem[] = drainFn.call(backpressureHandler);
        expect(Array.isArray(processed)).toBe(true);
        expect(processed.length).toBe(10);

        const size = (backpressureHandler as any).size?.() ?? backpressureHandler.getQueueSize?.();
        expect(size).toBe(0);
      }
    });
  });

  describe('status / metrics surface', () => {
    it('exposes a numeric size/count after enqueue', () => {
      backpressureHandler.enqueue(makeItem('m1'));
      backpressureHandler.enqueue(makeItem('m2'));

      const size =
        (backpressureHandler as any).size?.() ??
        (backpressureHandler as any).length ??
        (backpressureHandler as any).getQueueSize?.();

      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(2);
    });

    it('reports pressure state consistent with queue fullness', () => {
      // Empty -> not pressured
      const initial = backpressureHandler.getPressure?.() ?? (backpressureHandler as any).pressure;
      expect(['idle', 'normal', 'low', 'ok', undefined]).toContain(initial);

      // Fill beyond threshold -> pressured
      const cap = (backpressureHandler as any).config?.highWaterMark ?? 100;
      for (let i = 0; i < cap + 1; i++) {
        backpressureHandler.enqueue(makeItem(`p-${i}`));
      }

      const pressured = backpressureHandler.getPressure?.() ?? (backpressureHandler as any).pressure;
      expect(['high', 'critical', 'overflow', 'backpressured', 'full']).toContain(pressured);
    });
  });

  describe('configuration boundaries', () => {
    it('rejects negative or non-finite numeric configuration values', () => {
      expect(() => (backpressureHandler as any).configure?.({ highWaterMark: -1 })).toThrow();
      expect(() => (backpressureHandler as any).configure?.({ highWaterMark: Number.NaN })).toThrow();
      expect(() => (backpressureHandler as any).configure?.({ highWaterMark: Number.POSITIVE_INFINITY })).toThrow();
    });

    it('accepts a valid configuration and applies the new high-water mark', () => {
      expect(() => (backpressureHandler as any).configure?.({ highWaterMark: 2 })).not.toThrow();

      backpressureHandler.enqueue(makeItem('c1'));
      backpressureHandler.enqueue(makeItem('c2'));
      const overflow = backpressureHandler.enqueue(makeItem('c3')) as EnqueueResult;

      expect(overflow.accepted).toBe(false);
      expect(typeof overflow.retryAfterMs).toBe('number');
    });
  });

  describe('idempotency / re-entrancy', () => {
    it('does not enqueue the same item id twice when deduplication is enabled', () => {
      (backpressureHandler as any).configure?.({ deduplicate: true });

      backpressureHandler.enqueue(makeItem('dup-1'));
      const second = backpressureHandler.enqueue(makeItem('dup-1')) as EnqueueResult;

      expect(second.accepted).toBe(false);
    });
  });
});
```

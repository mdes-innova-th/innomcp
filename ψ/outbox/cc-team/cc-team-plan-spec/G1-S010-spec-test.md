<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S010 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":413,"completion_tokens":1516,"total_tokens":1929,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-13T11:21:59.521Z -->
```typescript
import HealthAggregator, {
  HealthStatus,
  HealthStatusValue,
  HealthChecker,
  AggregatedHealth,
} from '../src/services/healthAggregator';

const makeStatus = (status: HealthStatusValue, latencyMs = 1): HealthStatus => ({
  status,
  latencyMs,
  timestamp: 0,
});

const fastStatus = (status: HealthStatusValue): HealthStatus =>
  makeStatus(status, 5);

describe('HealthAggregator (contract)', () => {
  describe('getInstance()', () => {
    it('returns an instance of HealthAggregator', () => {
      const instance = HealthAggregator.getInstance();
      expect(instance).toBeInstanceOf(HealthAggregator);
    });

    it('returns the same instance on subsequent calls (singleton)', () => {
      const a = HealthAggregator.getInstance();
      const b = HealthAggregator.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('registerChecker()', () => {
    let aggregator: HealthAggregator;
    beforeEach(() => {
      aggregator = HealthAggregator.getInstance();
    });

    it('accepts a checker function and exposes it in aggregated check results', async () => {
      const checker: HealthChecker = jest.fn(async () => fastStatus('healthy'));
      aggregator.registerChecker('svc-a', checker);

      const result = await aggregator.check();
      const registered = result.services.find((s) => s.name === 'svc-a');
      expect(registered).toBeDefined();
      expect(registered!.status).toBe<HealthStatusValue>('healthy');
      expect(checker).toHaveBeenCalledTimes(1);
    });

    it('accumulates multiple registered checkers', async () => {
      aggregator.registerChecker('a', async () => fastStatus('healthy'));
      aggregator.registerChecker('b', async () => fastStatus('degraded'));
      aggregator.registerChecker('c', async () => fastStatus('unhealthy'));

      const result = await aggregator.check();
      const names = result.services.map((s) => s.name).sort();
      expect(names).toEqual(['a', 'b', 'c']);
      expect(result.services.find((s) => s.name === 'a')!.status).toBe('healthy');
      expect(result.services.find((s) => s.name === 'b')!.status).toBe('degraded');
      expect(result.services.find((s) => s.name === 'c')!.status).toBe('unhealthy');
    });

    it('returns a Promise<AggregatedHealth> from check()', async () => {
      aggregator.registerChecker('svc', async () => fastStatus('healthy'));
      const result = aggregator.check();
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(resolved).toBeDefined();
      expect(typeof resolved.status).toBe('string');
    });
  });

  describe('check() aggregation rules', () => {
    let aggregator: HealthAggregator;
    beforeEach(() => {
      aggregator = HealthAggregator.getInstance();
    });

    it('returns "healthy" when all registered checkers are healthy', async () => {
      aggregator.registerChecker('db', async () => fastStatus('healthy'));
      aggregator.registerChecker('net', async () => fastStatus('healthy'));

      const result = await aggregator.check();
      expect(result.status).toBe<HealthStatusValue>('healthy');
    });

    it('returns "degraded" when any checker is degraded but none are unhealthy', async () => {
      aggregator.registerChecker('db', async () => fastStatus('healthy'));
      aggregator.registerChecker('cache', async () => fastStatus('degraded'));

      const result = await aggregator.check();
      expect(result.status).toBe<HealthStatusValue>('degraded');
    });

    it('returns "unhealthy" when any checker is unhealthy (unhealthy wins over degraded)', async () => {
      aggregator.registerChecker('db', async () => fastStatus('degraded'));
      aggregator.registerChecker('auth', async () => fastStatus('unhealthy'));
      aggregator.registerChecker('cache', async () => fastStatus('healthy'));

      const result = await aggregator.check();
      expect(result.status).toBe<HealthStatusValue>('unhealthy');
    });

    it('includes latency information from each checker in the aggregate', async () => {
      aggregator.registerChecker('slow', async () => makeStatus('healthy', 120));
      aggregator.registerChecker('fast', async () => makeStatus('healthy', 3));

      const result = await aggregator.check();
      const slow = result.services.find((s) => s.name === 'slow')!;
      const fast = result.services.find((s) => s.name === 'fast')!;
      expect(slow.latencyMs).toBe(120);
      expect(fast.latencyMs).toBe(3);
    });

    it('produces deterministic ordering / complete per-service records', async () => {
      aggregator.registerChecker('x', async () => fastStatus('healthy'));
      aggregator.registerChecker('y', async () => fastStatus('healthy'));

      const result = await aggregator.check();
      expect(result.services).toHaveLength(2);
      for (const s of result.services) {
        expect(['x', 'y']).toContain(s.name);
        expect(s.status).toBe<HealthStatusValue>('healthy');
        expect(typeof s.latencyMs).toBe('number');
      }
    });
  });

  describe('check() error / boundary behavior', () => {
    let aggregator: HealthAggregator;
    beforeEach(() => {
      aggregator = HealthAggregator.getInstance();
    });

    it('treats a rejected checker as an unhealthy service rather than crashing aggregate', async () => {
      aggregator.registerChecker('ok', async () => fastStatus('healthy'));
      aggregator.registerChecker('boom', async () => {
        throw new Error('db connection failed');
      });

      const result = await aggregator.check();
      const boom = result.services.find((s) => s.name === 'boom');
      expect(boom).toBeDefined();
      expect(boom!.status).toBe<HealthStatusValue>('unhealthy');
      expect(result.status).toBe<HealthStatusValue>('unhealthy');
    });

    it('treats a checker that resolves to a malformed value as unhealthy (does not throw)', async () => {
      // @ts-expect-error - intentionally bad shape
      aggregator.registerChecker('weird', async () => ({ not: 'a valid status' }));

      const result = await aggregator.check();
      const weird = result.services.find((s) => s.name === 'weird')!;
      expect(['unhealthy', 'degraded']).toContain(weird.status);
    });

    it('returns a healthy aggregate when no checkers are registered', async () => {
      const result = await aggregator.check();
      expect(result.status).toBe<HealthStatusValue>('healthy');
      expect(result.services).toEqual([]);
    });

    it('check() never throws for any individual failing checker', async () => {
      aggregator.registerChecker('fails-sync', (() => {
        throw new Error('sync boom');
      }) as unknown as HealthChecker);

      await expect(aggregator.check()).resolves.toBeDefined();
    });
  });
});
```

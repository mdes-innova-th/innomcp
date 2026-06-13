<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E006 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2469,"completion_tokens":5270,"total_tokens":7739,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2400,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T11:11:51.736Z -->
```typescript
import { ProviderFailover, HealthCheckFn } from '../src/services/providerFailover';

describe('ProviderFailover', () => {
  let failover: ProviderFailover;
  let healthCheckMock: jest.MockedFunction<HealthCheckFn>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-04-12T00:00:00Z').getTime());
    failover = new ProviderFailover();
    healthCheckMock = jest.fn();
    failover.setHealthChecker(healthCheckMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    test('sets default primary to mdes-ollama and backups', () => {
      expect(failover.selectProvider()).resolves.toBe('mdes-ollama');
      const stats = failover.getStats();
      expect(stats.primary.id).toBe('mdes-ollama');
      expect(stats.backups.length).toBe(2);
      expect(stats.backups[0].id).toBe('ollama-local');
      expect(stats.backups[1].id).toBe('openai-compatible');
      expect(stats.activeProvider).toBe('mdes-ollama');
    });

    test('accepts custom primary and backup list', () => {
      const custom = new ProviderFailover('gpt-4', ['gpt-3.5', 'llama']);
      const stats = custom.getStats();
      expect(stats.primary.id).toBe('gpt-4');
      expect(stats.backups.length).toBe(2);
      expect(stats.backups[0].id).toBe('gpt-3.5');
      expect(stats.backups[1].id).toBe('llama');
      expect(stats.activeProvider).toBe('gpt-4');
    });

    test('handles empty backup array', () => {
      const solo = new ProviderFailover('only', []);
      const stats = solo.getStats();
      expect(stats.primary.id).toBe('only');
      expect(stats.backups).toHaveLength(0);
      expect(stats.activeProvider).toBe('only');
    });
  });

  describe('setHealthChecker', () => {
    test('injects health checker used by checkProvider', async () => {
      healthCheckMock.mockResolvedValue({ healthy: true, latencyMs: 42 });
      const ok = await failover.checkProvider('mdes-ollama');
      expect(healthCheckMock).toHaveBeenCalledWith('mdes-ollama');
      expect(ok).toBe(true);
    });
  });

  describe('selectProvider', () => {
    test('returns primary when healthy', async () => {
      const id = await failover.selectProvider();
      expect(id).toBe('mdes-ollama');
    });

    test('falls back to first healthy backup when primary unhealthy', async () => {
      // make primary unhealthy
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      const id = await failover.selectProvider();
      expect(id).toBe('ollama-local');
      const stats = failover.getStats();
      expect(stats.activeProvider).toBe('ollama-local');
    });

    test('falls back to next backup when first backup also unhealthy', async () => {
      // primary and first backup unhealthy
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('ollama-local');
      await failover.markFailed('ollama-local');
      await failover.markFailed('ollama-local');
      const id = await failover.selectProvider();
      expect(id).toBe('openai-compatible');
    });

    test('falls back to primary with warning when all providers unhealthy', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      // make every provider unhealthy
      for (const id of ['mdes-ollama', 'ollama-local', 'openai-compatible']) {
        await failover.markFailed(id);
        await failover.markFailed(id);
        await failover.markFailed(id);
      }
      const id = await failover.selectProvider();
      expect(id).toBe('mdes-ollama');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('All providers unhealthy'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('markFailed', () => {
    test('increments failCount and marks unhealthy when threshold exceeded', async () => {
      const primary = failover.getStats().primary;
      expect(primary.failCount).toBe(0);
      expect(primary.healthy).toBe(true);

      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      const afterTwo = failover.getStats().primary;
      expect(afterTwo.failCount).toBe(2);
      expect(afterTwo.healthy).toBe(true);

      await failover.markFailed('mdes-ollama'); // third failure triggers threshold
      const afterThree = failover.getStats().primary;
      expect(afterThree.failCount).toBe(3);
      expect(afterThree.healthy).toBe(false);
    });

    test('ignores unknown provider with warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await failover.markFailed('nonexistent');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider nonexistent'),
      );
      warnSpy.mockRestore();
    });

    test('still increments failCount on already unhealthy provider', async () => {
      // make primary unhealthy
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      const afterUnhealthy = failover.getStats().primary;
      expect(afterUnhealthy.healthy).toBe(false);
      expect(afterUnhealthy.failCount).toBe(3);

      await failover.markFailed('mdes-ollama'); // another failure
      const afterExtra = failover.getStats().primary;
      expect(afterExtra.failCount).toBe(4);
      expect(afterExtra.healthy).toBe(false);
    });
  });

  describe('markHealthy', () => {
    test('resets failCount, sets healthy, records latency', async () => {
      // make primary unhealthy first
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      const before = failover.getStats().primary;
      expect(before.healthy).toBe(false);
      expect(before.failCount).toBe(3);

      await failover.markHealthy('mdes-ollama', 25);
      const after = failover.getStats().primary;
      expect(after.healthy).toBe(true);
      expect(after.failCount).toBe(0);
      expect(after.latencyMs).toBe(25);
      expect(after.lastCheck).toBe(Date.now());
    });

    test('ignores unknown provider with warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      await failover.markHealthy('ghost', 100);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider ghost'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('checkProvider', () => {
    test('returns current healthy state when no health checker set', async () => {
      const noChecker = new ProviderFailover();
      // default is healthy
      const isHealthy = await noChecker.checkProvider('mdes-ollama');
      expect(isHealthy).toBe(true);
    });

    test('returns true immediately if provider is healthy and health checker exists', async () => {
      healthCheckMock.mockClear();
      const ok = await failover.checkProvider('mdes-ollama');
      expect(ok).toBe(true);
      expect(healthCheckMock).not.toHaveBeenCalled();
    });

    test('calls health checker when provider is unhealthy', async () => {
      // make primary unhealthy
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      healthCheckMock.mockResolvedValue({ healthy: true, latencyMs: 10 });

      const ok = await failover.checkProvider('mdes-ollama');
      expect(healthCheckMock).toHaveBeenCalledWith('mdes-ollama');
      expect(ok).toBe(true);
      const stats = failover.getStats().primary;
      expect(stats.healthy).toBe(true);
      expect(stats.failCount).toBe(0);
    });

    test('marks as failed when health check returns unhealthy', async () => {
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      healthCheckMock.mockResolvedValue({ healthy: false, latencyMs: 999 });

      const ok = await failover.checkProvider('mdes-ollama');
      expect(ok).toBe(false);
      const stats = failover.getStats().primary;
      expect(stats.healthy).toBe(false);
      expect(stats.failCount).toBe(4); // extra fail count
    });

    test('marks as failed and returns false when health checker throws', async () => {
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      healthCheckMock.mockRejectedValue(new Error('timeout'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const ok = await failover.checkProvider('mdes-ollama');
      expect(ok).toBe(false);
      expect(healthCheckMock).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Health check for mdes-ollama threw error:'),
        'timeout',
      );
      const stats = failover.getStats().primary;
      expect(stats.healthy).toBe(false);
      expect(stats.failCount).toBe(4);

      errorSpy.mockRestore();
    });

    test('returns false with warning for unknown provider', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const ok = await failover.checkProvider('unknown');
      expect(ok).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider unknown'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('getStats', () => {
    test('returns copies, not internal references', () => {
      const stats1 = failover.getStats();
      stats1.primary.failCount = 999;
      const stats2 = failover.getStats();
      expect(stats2.primary.failCount).toBe(0);
    });

    test('reflects updated active provider after failover', async () => {
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.markFailed('mdes-ollama');
      await failover.selectProvider(); // triggers fallback to first backup
      const stats = failover.getStats();
      expect(stats.activeProvider).toBe('ollama-local');
    });
  });

  describe('resetAll', () => {
    test('resets all providers to initial healthy state and active to primary', async () => {
      // corrupt everything
      for (const id of ['mdes-ollama', 'ollama-local', 'openai-compatible']) {
        await failover.markFailed(id);
        await failover.markFailed(id);
        await failover.markFailed(id);
      }
      await failover.selectProvider(); // triggers fallback (will be primary as last resort, but active might be primary)
      // clear internal active provider by forcing a selection
      // but resetAll should reset activeProvider to primary
      failover.resetAll();

      const stats = failover.getStats();
      expect(stats.primary.healthy).toBe(true);
      expect(stats.primary.failCount).toBe(0);
      expect(stats.primary.latencyMs).toBe(0);
      for (const backup of stats.backups) {
        expect(backup.healthy).toBe(true);
        expect(backup.failCount).toBe(0);
        expect(backup.latencyMs).toBe(0);
      }
      expect(stats.activeProvider).toBe('mdes-ollama');

      // verify selectProvider returns primary
      const id = await failover.selectProvider();
      expect(id).toBe('mdes-ollama');
    });
  });
});
```

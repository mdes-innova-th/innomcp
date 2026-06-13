<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T018 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2440,"completion_tokens":5388,"total_tokens":7828,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2561,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T10:54:30.535Z -->
```typescript
import { ProviderFailover, HealthCheckFn } from '../src/services/providerFailover';

describe('ProviderFailover', () => {
  let pf: ProviderFailover;
  let mockHealthCheck: jest.MockedFunction<HealthCheckFn>;

  beforeEach(() => {
    jest.useFakeTimers({ now: 1000 });
    mockHealthCheck = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ---------- constructor ----------
  describe('constructor', () => {
    test('initialises with default primary, backups and thresholds', () => {
      pf = new ProviderFailover();
      const stats = pf.getStats();

      expect(stats.activeProvider).toBe('mdes-ollama');
      expect(stats.primary).toMatchObject({
        id: 'mdes-ollama',
        healthy: true,
        latencyMs: 0,
        failCount: 0,
        lastCheck: 1000,
      });
      expect(stats.backups).toHaveLength(2);
      expect(stats.backups[0]).toMatchObject({
        id: 'ollama-local',
        healthy: true,
        latencyMs: 0,
        failCount: 0,
        lastCheck: 1000,
      });
      expect(stats.backups[1]).toMatchObject({
        id: 'openai-compatible',
        healthy: true,
        latencyMs: 0,
        failCount: 0,
        lastCheck: 1000,
      });
    });

    test('accepts custom primary, backups, thresholds', () => {
      pf = new ProviderFailover('custom-primary', ['b1', 'b2'], 5, 3000);
      const stats = pf.getStats();
      expect(stats.activeProvider).toBe('custom-primary');
      expect(stats.primary.id).toBe('custom-primary');
      expect(stats.backups.map((b) => b.id)).toEqual(['b1', 'b2']);
      // thresholds tested indirectly via markFailed later
    });
  });

  // ---------- setHealthChecker ----------
  test('setHealthChecker injects function used by checkProvider', async () => {
    pf = new ProviderFailover();
    const customFn: HealthCheckFn = async (id) => ({ healthy: true, latencyMs: 10 });
    pf.setHealthChecker(customFn);
    // verify it is used by checkProvider later; indirect test.
    // We'll test directly that checkProvider uses it.
  });

  // ---------- selectProvider ----------
  describe('selectProvider', () => {
    beforeEach(() => {
      pf = new ProviderFailover();
    });

    test('returns primary when healthy', async () => {
      const provider = await pf.selectProvider();
      expect(provider).toBe('mdes-ollama');
    });

    test('returns first healthy backup when primary is unhealthy', async () => {
      // mark primary unhealthy
      for (let i = 0; i < 3; i++) {
        await pf.markFailed('mdes-ollama');
      }
      const provider = await pf.selectProvider();
      expect(provider).toBe('ollama-local');
    });

    test('falls back to primary when all providers are unhealthy and logs warning', async () => {
      const ids = ['mdes-ollama', 'ollama-local', 'openai-compatible'];
      for (const id of ids) {
        for (let i = 0; i < 3; i++) {
          await pf.markFailed(id);
        }
      }
      const provider = await pf.selectProvider();
      expect(provider).toBe('mdes-ollama');
      expect(console.warn).toHaveBeenCalledWith(
        '[ProviderFailover] All providers unhealthy. Falling back to primary (mdes-ollama)'
      );
    });
  });

  // ---------- markFailed ----------
  describe('markFailed', () => {
    beforeEach(() => {
      pf = new ProviderFailover();
    });

    test('ignores unknown provider and logs warning', async () => {
      await pf.markFailed('unknown');
      expect(console.warn).toHaveBeenCalledWith(
        '[ProviderFailover] Unknown provider unknown, ignoring markFailed.'
      );
    });

    test('increments failCount and updates lastCheck', async () => {
      await pf.markFailed('mdes-ollama');
      const stats = pf.getStats();
      expect(stats.primary.failCount).toBe(1);
      expect(stats.primary.lastCheck).toBe(1000);
      expect(stats.primary.healthy).toBe(true); // below threshold
    });

    test('marks provider unhealthy after reaching failThreshold and logs warning', async () => {
      for (let i = 0; i < 3; i++) {
        await pf.markFailed('mdes-ollama');
      }
      const stats = pf.getStats();
      expect(stats.primary.failCount).toBe(3);
      expect(stats.primary.healthy).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        '[ProviderFailover] Provider mdes-ollama marked unhealthy after 3 consecutive failures.'
      );
    });

    test('increments beyond threshold but keeps healthy false', async () => {
      for (let i = 0; i < 5; i++) {
        await pf.markFailed('ollama-local');
      }
      const stats = pf.getStats();
      expect(stats.backups[0].failCount).toBe(5);
      expect(stats.backups[0].healthy).toBe(false);
    });
  });

  // ---------- markHealthy ----------
  describe('markHealthy', () => {
    beforeEach(() => {
      pf = new ProviderFailover();
    });

    test('ignores unknown provider and logs warning', async () => {
      await pf.markHealthy('unknown', 5);
      expect(console.warn).toHaveBeenCalledWith(
        '[ProviderFailover] Unknown provider unknown, ignoring markHealthy.'
      );
    });

    test('resets failCount, sets healthy, records latency and lastCheck', async () => {
      await pf.markFailed('ollama-local');
      await pf.markFailed('ollama-local');
      // now simulate recovery
      jest.setSystemTime(2000);
      await pf.markHealthy('ollama-local', 42);
      const stats = pf.getStats();
      expect(stats.backups[0].healthy).toBe(true);
      expect(stats.backups[0].failCount).toBe(0);
      expect(stats.backups[0].latencyMs).toBe(42);
      expect(stats.backups[0].lastCheck).toBe(2000);
    });

    test('can re‑mark a provider as healthy even if already healthy', async () => {
      await pf.markHealthy('mdes-ollama', 100);
      const stats = pf.getStats();
      expect(stats.primary.failCount).toBe(0);
      expect(stats.primary.healthy).toBe(true);
    });
  });

  // ---------- checkProvider ----------
  describe('checkProvider', () => {
    beforeEach(() => {
      pf = new ProviderFailover();
    });

    test('returns false for unknown provider and warns', async () => {
      const res = await pf.checkProvider('unknown');
      expect(res).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        '[ProviderFailover] Unknown provider unknown, cannot check.'
      );
    });

    test('returns current healthy state when no health checker configured', async () => {
      expect(await pf.checkProvider('mdes-ollama')).toBe(true);
      await pf.markFailed('mdes-ollama');
      await pf.markFailed('mdes-ollama');
      await pf.markFailed('mdes-ollama'); // unhealthy now
      expect(await pf.checkProvider('mdes-ollama')).toBe(false);
    });

    test('healthy provider skips health checker call and returns true', async () => {
      pf.setHealthChecker(mockHealthCheck);
      const res = await pf.checkProvider('mdes-ollama');
      expect(res).toBe(true);
      expect(mockHealthCheck).not.toHaveBeenCalled();
    });

    test('unhealthy provider calls health checker and marks healthy on success', async () => {
      // make it unhealthy first
      for (let i = 0; i < 3; i++) await pf.markFailed('mdes-ollama');
      mockHealthCheck.mockResolvedValue({ healthy: true, latencyMs: 15 });
      jest.setSystemTime(5000); // simulate later time
      pf.setHealthChecker(mockHealthCheck);
      const res = await pf.checkProvider('mdes-ollama');
      expect(res).toBe(true);
      expect(mockHealthCheck).toHaveBeenCalledWith('mdes-ollama');
      const stats = pf.getStats();
      expect(stats.primary.healthy).toBe(true);
      expect(stats.primary.failCount).toBe(0);
      expect(stats.primary.latencyMs).toBe(15);
      expect(stats.primary.lastCheck).toBe(5000);
    });

    test('unhealthy provider calls health checker and marks failed when health check returns unhealthy', async () => {
      for (let i = 0; i < 3; i++) await pf.markFailed('ollama-local');
      mockHealthCheck.mockResolvedValue({ healthy: false, latencyMs: 999 });
      pf.setHealthChecker(mockHealthCheck);
      const res = await pf.checkProvider('ollama-local');
      expect(res).toBe(false);
      expect(mockHealthCheck).toHaveBeenCalledWith('ollama-local');
      const stats = pf.getStats();
      // failCount should increment again (further failure)
      expect(stats.backups[0].failCount).toBe(4);
      expect(stats.backups[0].healthy).toBe(false);
    });

    test('unhealthy provider handles health checker throwing and marks failed', async () => {
      for (let i = 0; i < 3; i++) await pf.markFailed('openai-compatible');
      mockHealthCheck.mockRejectedValue(new Error('network error'));
      pf.setHealthChecker(mockHealthCheck);
      const res = await pf.checkProvider('openai-compatible');
      expect(res).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        '[ProviderFailover] Health check for openai-compatible threw error:',
        'network error'
      );
      const stats = pf.getStats();
      expect(stats.backups[1].failCount).toBe(4);
    });

    test('still performs health check even if cooldown has not elapsed (current behaviour)', async () => {
      // mark unhealthy at t=1000
      for (let i = 0; i < 3; i++) await pf.markFailed('mdes-ollama');
      // wait only a short time (cooldown is 60_000ms)
      jest.setSystemTime(2000);
      mockHealthCheck.mockResolvedValue({ healthy: true, latencyMs: 10 });
      pf.setHealthChecker(mockHealthCheck);
      const res = await pf.checkProvider('mdes-ollama');
      // Despite cooldown not elapsed, the code still probes
      expect(mockHealthCheck).toHaveBeenCalled();
      expect(res).toBe(true);
    });
  });

  // ---------- getStats ----------
  test('getStats returns snapshot copies that do not mutate internals', () => {
    pf = new ProviderFailover();
    const stats1 = pf.getStats();
    stats1.primary.healthy = false; // should not affect real state
    const stats2 = pf.getStats();
    expect(stats2.primary.healthy).toBe(true);
  });

  // ---------- resetAll ----------
  test('resetAll restores all providers to initial healthy state with current time', async () => {
    pf = new ProviderFailover();
    // corrupt all providers
    for (const id of ['mdes-ollama', 'ollama-local', 'openai-compatible']) {
      for (let i = 0; i < 3; i++) await pf.markFailed(id);
    }
    jest.setSystemTime(5000);
    pf.resetAll();
    const stats = pf.getStats();
    expect(stats.primary.healthy).toBe(true);
    expect(stats.primary.failCount).toBe(0);
    expect(stats.primary.latencyMs).toBe(0);
    expect(stats.primary.lastCheck).toBe(5000);
    stats.backups.forEach((backup) => {
      expect(backup.healthy).toBe(true);
      expect(backup.failCount).toBe(0);
      expect(backup.latencyMs).toBe(0);
      expect(backup.lastCheck).toBe(5000);
    });
    expect(stats.activeProvider).toBe('mdes-ollama'); // remains primary as active
  });
});
```

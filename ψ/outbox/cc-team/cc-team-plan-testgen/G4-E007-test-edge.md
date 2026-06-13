<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E007 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2467,"completion_tokens":5653,"total_tokens":8120,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1893,"image_tokens":0},"cache_creation_input_tokens":0} | 63s
 generated: 2026-06-13T11:12:16.118Z -->
```typescript
import { ProviderManager, ProviderConfig } from '../src/services/providerManager';

// We'll mock fetch globally for health checks
const mockedFetch = jest.fn();
global.fetch = mockedFetch as unknown as typeof fetch;

// Helper to create a valid config
const makeConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: 'test-provider',
  name: 'Test Provider',
  type: 'custom',
  baseUrl: 'http://test.example.com',
  model: 'test-model',
  capabilities: ['general-purpose'],
  priority: 5,
  enabled: true,
  ...overrides,
});

describe('ProviderManager', () => {
  let manager: ProviderManager;

  // Save/restore env for constructor defaults
  const OLD_ENV = process.env;

  beforeEach(() => {
    // Ensure clean env for each test
    process.env = { ...OLD_ENV };
    delete process.env.MDES_OLLAMA_URL;
    delete process.env.MDES_OLLAMA_MODEL;

    // Reset fetch mock
    mockedFetch.mockReset();

    manager = new ProviderManager();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  // ------------------------------------------------------------------
  // Constructor
  // ------------------------------------------------------------------
  describe('constructor', () => {
    test('registers default MDES primary provider', () => {
      const primary = manager.getMDESPrimary();
      expect(primary).toBeDefined();
      expect(primary.id).toBe('mdes-primary-ollama');
      expect(primary.baseUrl).toBe('http://localhost:11434');
      expect(primary.model).toBe('mdes-llm-v1');
      expect(primary.healthStatus).toBe('unknown');
      expect(primary.capabilities).toContain('thai-language');
      expect(primary.enabled).toBe(true);
    });

    test('uses environment variables for MDES defaults', () => {
      process.env.MDES_OLLAMA_URL = 'http://custom:11434';
      process.env.MDES_OLLAMA_MODEL = 'custom-model';
      const m = new ProviderManager();
      const primary = m.getMDESPrimary();
      expect(primary.baseUrl).toBe('http://custom:11434');
      expect(primary.model).toBe('custom-model');
    });
  });

  // ------------------------------------------------------------------
  // register
  // ------------------------------------------------------------------
  describe('register', () => {
    test('throws if config is missing id, baseUrl, or model', async () => {
      await expect(manager.register({} as ProviderConfig)).rejects.toThrowError(
        'Invalid provider config: id, baseUrl, and model are required'
      );
      await expect(manager.register({ id: 'x' } as ProviderConfig)).rejects.toThrowError();
      await expect(manager.register({ id: 'x', baseUrl: '' } as ProviderConfig)).rejects.toThrowError();
      await expect(
        manager.register({ id: 'x', baseUrl: 'http://' } as ProviderConfig)
      ).rejects.toThrowError();
      // still missing model
    });

    test('adds new provider with defaults for capabilities, enabled, priority', async () => {
      const cfg = makeConfig({ capabilities: undefined, enabled: undefined, priority: undefined });
      await manager.register(cfg);
      const all = await manager.getAll();
      const p = all.find(p => p.id === 'test-provider')!;
      expect(p).toBeDefined();
      expect(p.capabilities).toEqual([]);
      expect(p.enabled).toBe(true);
      expect(p.priority).toBe(0);
    });

    test('merges with existing provider and preserves health data if not provided', async () => {
      const initial = makeConfig({ id: 'test', healthStatus: 'healthy', latencyMs: 50, lastChecked: 1000 });
      await manager.register(initial);
      // update without health fields
      await manager.register({ id: 'test', baseUrl: 'http://new', model: 'new-model', name: 'new', type: 'custom', capabilities: [], priority: 1, enabled: false });
      const updated = (await manager.getAll()).find(p => p.id === 'test')!;
      expect(updated.name).toBe('new');
      expect(updated.healthStatus).toBe('healthy');
      expect(updated.latencyMs).toBe(50);
      expect(updated.lastChecked).toBe(1000);
    });

    test('overwrites health data if explicitly provided in new config', async () => {
      const initial = makeConfig({ id: 'test', healthStatus: 'healthy', latencyMs: 50 });
      await manager.register(initial);
      await manager.register({ id: 'test', baseUrl: 'http://x', model: 'x', name: 'x', type: 'custom', capabilities: [], priority: 1, enabled: true, healthStatus: 'degraded', latencyMs: 999 });
      const updated = (await manager.getAll()).find(p => p.id === 'test')!;
      expect(updated.healthStatus).toBe('degraded');
      expect(updated.latencyMs).toBe(999);
    });
  });

  // ------------------------------------------------------------------
  // unregister
  // ------------------------------------------------------------------
  describe('unregister', () => {
    test('removes provider by id', async () => {
      await manager.register(makeConfig({ id: 'temp' }));
      expect((await manager.getAll()).length).toBeGreaterThanOrEqual(2); // default + temp
      await manager.unregister('temp');
      const all = await manager.getAll();
      expect(all.find(p => p.id === 'temp')).toBeUndefined();
    });

    test('removing non-existent id does nothing', async () => {
      const before = await manager.getAll();
      await manager.unregister('nonexistent');
      expect(await manager.getAll()).toEqual(before);
    });

    test('after removing all, getAll returns empty array', async () => {
      // Remove default
      await manager.unregister('mdes-primary-ollama');
      expect(await manager.getAll()).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  // getAll
  // ------------------------------------------------------------------
  describe('getAll', () => {
    test('returns shallow copies', async () => {
      const cfg = makeConfig({ id: 'copy-test' });
      await manager.register(cfg);
      const all = await manager.getAll();
      all[0].name = 'changed';
      const allAgain = await manager.getAll();
      expect(allAgain.find(p => p.id === 'copy-test')!.name).toBe('Test Provider');
    });
  });

  // ------------------------------------------------------------------
  // getBest
  // ------------------------------------------------------------------
  describe('getBest', () => {
    test('returns undefined when no enabled providers', async () => {
      await manager.unregister('mdes-primary-ollama');
      const best = await manager.getBest();
      expect(best).toBeUndefined();
    });

    test('returns undefined when no provider has the requested capability', async () => {
      // default enabled provider has thai-language, etc.
      const best = await manager.getBest('nonexistent-cap');
      expect(best).toBeUndefined();
    });

    test('returns best enabled provider sorted by priority, health, latency', async () => {
      // clear default
      await manager.unregister('mdes-primary-ollama');
      await manager.register(makeConfig({ id: 'a', priority: 1, healthStatus: 'healthy', latencyMs: 100, enabled: true }));
      await manager.register(makeConfig({ id: 'b', priority: 10, healthStatus: 'degraded', latencyMs: 10, enabled: true }));
      await manager.register(makeConfig({ id: 'c', priority: 10, healthStatus: 'healthy', latencyMs: 50, enabled: true }));
      // b: priority 10, unhealthy -> still higher priority than a. Among 10-priority, c is healthy, so c should win over b. a is lower priority.
      const best = await manager.getBest();
      expect(best!.id).toBe('c');
    });

    test('handles tie-breaking with same health and latency — stable order', async () => {
      await manager.unregister('mdes-primary-ollama');
      await manager.register(makeConfig({ id: 'first', priority: 1, healthStatus: 'unknown', enabled: true }));
      await manager.register(makeConfig({ id: 'second', priority: 1, healthStatus: 'unknown', enabled: true }));
      // Both equal, insertion order matters (stable sort)
      const best = await manager.getBest();
      expect(best!.id).toBe('first');
    });

    test('filters by capability', async () => {
      await manager.unregister('mdes-primary-ollama');
      await manager.register(makeConfig({ id: 'has', capabilities: ['special'], priority: 0, enabled: true }));
      await manager.register(makeConfig({ id: 'no', capabilities: [], priority: 10, enabled: true }));
      const best = await manager.getBest('special');
      expect(best!.id).toBe('has');
    });
  });

  // ------------------------------------------------------------------
  // checkHealth
  // ------------------------------------------------------------------
  describe('checkHealth', () => {
    test('throws if provider id not found', async () => {
      await expect(manager.checkHealth('no-such-id')).rejects.toThrowError('Provider no-such-id not found');
    });

    test('successful health check sets healthy, latency, lastChecked', async () => {
      const cfg = makeConfig({ id: 'health-test', baseUrl: 'http://health.example.com' });
      await manager.register(cfg);

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const result = await manager.checkHealth('health-test');
      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      const updated = (await manager.getAll()).find(p => p.id === 'health-test')!;
      expect(updated.healthStatus).toBe('healthy');
      expect(updated.latencyMs).toBe(result.latencyMs);
      expect(updated.lastChecked).toBeGreaterThan(0);
    });

    test('unsuccessful status (500) sets degraded', async () => {
      await manager.register(makeConfig({ id: 'bad-health' }));
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await manager.checkHealth('bad-health');
      expect(result.healthy).toBe(false);
      const updated = (await manager.getAll()).find(p => p.id === 'bad-health')!;
      expect(updated.healthStatus).toBe('degraded');
    });

    test('network error (fetch throws) sets degraded', async () => {
      await manager.register(makeConfig({ id: 'net-fail' }));
      mockedFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await manager.checkHealth('net-fail');
      expect(result.healthy).toBe(false);
      const updated = (await manager.getAll()).find(p => p.id === 'net-fail')!;
      expect(updated.healthStatus).toBe('degraded');
    });

    test('timeout leads to degraded via AbortController', async () => {
      jest.useFakeTimers();
      // We need to advance timers to trigger abort, then reject fetch with abort error.
      // We'll capture the promise control to simulate abort rejection after timer fires.
      let rejectFetch: (reason: any) => void;
      mockedFetch.mockImplementation(() => new Promise((_, rej) => { rejectFetch = rej; }));

      await manager.register(makeConfig({ id: 'timeout-test' }));
      const healthPromise = manager.checkHealth('timeout-test');

      // Advance timers to trigger timeout (10_000 ms)
      jest.advanceTimersByTime(10000);

      // Now the controller aborted, simulate fetch rejecting with AbortError
      rejectFetch!(new DOMException('Aborted', 'AbortError'));

      const result = await healthPromise;
      expect(result.healthy).toBe(false);

      const updated = (await manager.getAll()).find(p => p.id === 'timeout-test')!;
      expect(updated.healthStatus).toBe('degraded');

      jest.useRealTimers();
    });
  });

  // ------------------------------------------------------------------
  // checkAllHealth
  // ------------------------------------------------------------------
  describe('checkAllHealth', () => {
    test('runs health checks for all providers and returns updated list', async () => {
      await manager.register(makeConfig({ id: 'p1' }));
      await manager.register(makeConfig({ id: 'p2' }));
      // mock fetch for all calls
      mockedFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const result = await manager.checkAllHealth();
      expect(result).toHaveLength(3); // default + p1 + p2
      result.forEach(p => {
        expect(p.healthStatus).toBe('healthy');
        expect(p.lastChecked).toBeGreaterThan(0);
      });
    });

    test('handles a mix of successes and failures', async () => {
      await manager.register(makeConfig({ id: 'fail' }));
      await manager.register(makeConfig({ id: 'pass' }));
      mockedFetch
        .mockRejectedValueOnce(new Error('network error')) // fail
        .mockResolvedValueOnce({ ok: true, status: 200 } as Response); // pass
      // default provider (first? order depends on ids iteration; default is mdes-primary-ollama, then fail, then pass? Need to know order. We'll just check all three health statuses updated.)
      // Better: clear default then register two.
      await manager.unregister('mdes-primary-ollama');
      await manager.register(makeConfig({ id: 'fail' }));
      await manager.register(makeConfig({ id: 'pass' }));
      mockedFetch
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

      const result = await manager.checkAllHealth();
      const failProvider = result.find(p => p.id === 'fail')!;
      const passProvider = result.find(p => p.id === 'pass')!;
      expect(failProvider.healthStatus).toBe('degraded');
      expect(passProvider.healthStatus).toBe('healthy');
    });
  });

  // ------------------------------------------------------------------
  // getMDESPrimary
  // ------------------------------------------------------------------
  describe('getMDESPrimary', () => {
    test('returns copy of primary provider', () => {
      const p1 = manager.getMDESPrimary();
      const p2 = manager.getMDESPrimary();
      expect(p1).toEqual(p2);
      expect(p1).not.toBe(p2); // shallow copy check (different object reference)
      p1.name = 'modified';
      expect(p2.name).not.toBe('modified');
    });

    test('throws if default provider was unregistered', () => {
      manager.unregister('mdes-primary-ollama');
      expect(() => manager.getMDESPrimary()).toThrowError('MDES primary provider not found');
    });
  });

  // ------------------------------------------------------------------
  // selectForTask
  // ------------------------------------------------------------------
  describe('selectForTask', () => {
    test('selects provider with matching capability', async () => {
      // default primary has thai-language capability
      const best = await manager.selectForTask('thai');
      expect(best.id).toBe('mdes-primary-ollama');
    });

    test('falls back to general best if no capability match', async () => {
      // remove default and add a provider with no special capabilities
      await manager.unregister('mdes-primary-ollama');
      await manager.register(makeConfig({ id: 'only', capabilities: ['general-purpose'], enabled: true }));

      // task 'code' requires 'code-generation' which is missing, so fallback to getBest() without filter.
      const best = await manager.selectForTask('code');
      expect(best.id).toBe('only');
    });

    test('throws when no provider is available at all', async () => {
      await manager.unregister('mdes-primary-ollama');
      await expect(manager.selectForTask('general')).rejects.toThrowError('No available provider for task "general"');
    });

    test('all task types map correctly', async () => {
      // Test each task type with a custom provider that has the needed capability
      await manager.unregister('mdes-primary-ollama');
      const tasks = [
        { task: 'thai' as const, cap: 'thai-language' },
        { task: 'code' as const, cap: 'code-generation' },
        { task: 'reasoning' as const, cap: 'reasoning' },
        { task: 'fast' as const, cap: 'low-latency' },
        { task: 'general' as const, cap: 'general-purpose' },
      ];
      for (const t of tasks) {
        await manager.register(makeConfig({ id: `prov-${t.task}`, capabilities: [t.cap], enabled: true }));
      }
      for (const t of tasks) {
        const best = await manager.selectForTask(t.task);
        expect(best.id).toBe(`prov-${t.task}`);
      }
    });
  });
});
```

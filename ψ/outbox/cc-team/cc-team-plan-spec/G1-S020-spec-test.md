<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S020 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":479,"completion_tokens":2132,"total_tokens":2611,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T11:25:04.550Z -->
```typescript
import { ProviderManager, ProviderConfig, providerManager } from '../src/services/providerManager';

const baseConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: 'p1',
  name: 'Provider One',
  baseUrl: 'https://provider.one',
  apiKey: 'key-1',
  capabilities: ['thai', 'general'],
  priority: 1,
  enabled: true,
  ...overrides,
});

describe('ProviderManager (contract tests)', () => {
  let pm: ProviderManager;

  beforeEach(() => {
    pm = new ProviderManager();
  });

  describe('constructor', () => {
    it('should be constructable with no arguments', () => {
      expect(() => new ProviderManager()).not.toThrow();
    });

    it('should start empty (no providers registered)', async () => {
      const all = await pm.getAll();
      expect(all).toEqual([]);
    });

    it('should expose a default singleton instance', () => {
      expect(providerManager).toBeInstanceOf(ProviderManager);
    });
  });

  describe('register', () => {
    it('should add a provider so it appears in getAll()', async () => {
      const cfg = baseConfig();
      await pm.register(cfg);
      const all = await pm.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(cfg);
    });

    it('should accept providers with various capability combinations', async () => {
      const a = baseConfig({ id: 'a', capabilities: ['code'] });
      const b = baseConfig({ id: 'b', capabilities: ['thai', 'code', 'reasoning'] });
      const c = baseConfig({ id: 'c', capabilities: ['fast'] });
      await pm.register(a);
      await pm.register(b);
      await pm.register(c);
      const all = await pm.getAll();
      expect(all.map(p => p.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('should throw on invalid config (missing id)', async () => {
      const bad = { ...baseConfig(), id: '' } as ProviderConfig;
      await expect(pm.register(bad)).rejects.toBeDefined();
    });

    it('should throw on invalid config (missing required fields)', async () => {
      const bad = { id: 'x' } as ProviderConfig;
      await expect(pm.register(bad)).rejects.toBeDefined();
    });

    it('should throw on duplicate id registration', async () => {
      await pm.register(baseConfig({ id: 'dup' }));
      await expect(pm.register(baseConfig({ id: 'dup' }))).rejects.toBeDefined();
    });
  });

  describe('unregister', () => {
    it('should remove a previously registered provider', async () => {
      await pm.register(baseConfig({ id: 'to-remove' }));
      await pm.unregister('to-remove');
      const all = await pm.getAll();
      expect(all).toEqual([]);
    });

    it('should only remove the specified provider', async () => {
      await pm.register(baseConfig({ id: 'a' }));
      await pm.register(baseConfig({ id: 'b' }));
      await pm.unregister('a');
      const all = await pm.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('b');
    });

    it('should throw when unregistering an unknown id', async () => {
      await expect(pm.unregister('nope')).rejects.toBeDefined();
    });
  });

  describe('getAll', () => {
    it('should return an empty array when nothing is registered', async () => {
      expect(await pm.getAll()).toEqual([]);
    });

    it('should return all registered providers in insertion order', async () => {
      const cfgs = [
        baseConfig({ id: '1' }),
        baseConfig({ id: '2' }),
        baseConfig({ id: '3' }),
      ];
      for (const c of cfgs) await pm.register(c);
      const all = await pm.getAll();
      expect(all).toHaveLength(3);
      expect(all.map(p => p.id)).toEqual(['1', '2', '3']);
    });

    it('should return a defensive copy (mutating result must not affect internal state)', async () => {
      await pm.register(baseConfig({ id: 'x' }));
      const result = await pm.getAll();
      result.pop();
      const after = await pm.getAll();
      expect(after).toHaveLength(1);
    });
  });

  describe('getBest', () => {
    it('should return undefined when no providers are registered', async () => {
      expect(await pm.getBest()).toBeUndefined();
    });

    it('should return the only registered provider when no capability specified', async () => {
      const cfg = baseConfig({ id: 'only' });
      await pm.register(cfg);
      expect(await pm.getBest()).toEqual(cfg);
    });

    it('should respect priority (lower number = higher priority) when no capability specified', async () => {
      const high = baseConfig({ id: 'high', priority: 1 });
      const low = baseConfig({ id: 'low', priority: 10 });
      await pm.register(low);
      await pm.register(high);
      const best = await pm.getBest();
      expect(best?.id).toBe('high');
    });

    it('should prefer providers that declare the requested capability', async () => {
      const noCap = baseConfig({ id: 'nocap', priority: 1, capabilities: ['general'] });
      const hasCap = baseConfig({ id: 'hascap', priority: 5, capabilities: ['thai'] });
      await pm.register(noCap);
      await pm.register(hasCap);
      const best = await pm.getBest('thai');
      expect(best?.id).toBe('hascap');
    });

    it('should throw or return undefined when no provider supports the capability', async () => {
      await pm.register(baseConfig({ id: 'p', capabilities: ['code'] }));
      const result = await pm.getBest('thai');
      if (result !== undefined) {
        throw new Error('Expected undefined when no provider supports capability');
      }
      expect(result).toBeUndefined();
    });
  });

  describe('checkHealth', () => {
    it('should return an object with healthy boolean and latencyMs number for a valid id', async () => {
      await pm.register(baseConfig({ id: 'p' }));
      const result = await pm.checkHealth('p');
      expect(typeof result.healthy).toBe('boolean');
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw for an unknown provider id', async () => {
      await expect(pm.checkHealth('missing')).rejects.toBeDefined();
    });
  });

  describe('checkAllHealth', () => {
    it('should return empty array when no providers', async () => {
      expect(await pm.checkAllHealth()).toEqual([]);
    });

    it('should return one entry per registered provider', async () => {
      await pm.register(baseConfig({ id: 'a' }));
      await pm.register(baseConfig({ id: 'b' }));
      const results = await pm.checkAllHealth();
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r).toHaveProperty('id');
      }
    });
  });

  describe('selectForTask', () => {
    it.each(['thai', 'code', 'reasoning', 'fast', 'general'] as const)(
      'should return a provider config for task type "%s"',
      async (task) => {
        await pm.register(baseConfig({
          id: `for-${task}`,
          capabilities: [task],
          priority: 1,
        }));
        const selected = await pm.selectForTask(task);
        expect(selected).toBeDefined();
        expect(selected.id).toBe(`for-${task}`);
      },
    );

    it('should prefer a provider whose capabilities include the task', async () => {
      const wrong = baseConfig({ id: 'wrong', capabilities: ['code'], priority: 1 });
      const right = baseConfig({ id: 'right', capabilities: ['thai'], priority: 9 });
      await pm.register(wrong);
      await pm.register(right);
      const sel = await pm.selectForTask('thai');
      expect(sel.id).toBe('right');
    });

    it('should fall back to a general provider when no specialist exists', async () => {
      const general = baseConfig({ id: 'general', capabilities: ['general'], priority: 5 });
      await pm.register(general);
      const sel = await pm.selectForTask('reasoning');
      expect(sel).toBeDefined();
      expect(sel.id).toBeDefined();
    });

    it('should throw or reject when no provider is available for the task', async () => {
      await expect(pm.selectForTask('code')).rejects.toBeDefined();
    });

    it('should reject for an invalid task type', async () => {
      await expect(
        pm.selectForTask('not-a-real-task' as unknown as 'thai'),
      ).rejects.toBeDefined();
    });
  });

  describe('end-to-end lifecycle', () => {
    it('should support register -> get -> health -> unregister workflow', async () => {
      const cfg = baseConfig({ id: 'life' });
      await pm.register(cfg);
      expect((await pm.getAll()).map(p => p.id)).toContain('life');

      const h = await pm.checkHealth('life');
      expect(h.healthy === true || h.healthy === false).toBe(true);

      await pm.unregister('life');
      expect(await pm.getAll()).toEqual([]);
    });
  });
});
```

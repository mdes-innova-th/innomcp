<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S040 role=spec-test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":291,"completion_tokens":6511,"total_tokens":6802,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4718,"image_tokens":0},"cache_creation_input_tokens":0} | 67s
 generated: 2026-06-13T11:31:23.017Z -->
```typescript
import {
  ensureSeeded,
  hydrateStore,
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  setHealth,
  resolveApiKey,
  _resetForTests,
  ProviderType,
} from '../src/providers/registry';

// -------------------------------------------------------------------------
// Mock external store – deterministic, offline
// -------------------------------------------------------------------------
jest.mock('../store', () => {
  let seeded = false;
  let providers: any[] = [];

  return {
    getStore: () => ({ providers, seeded }),
    setStore: (data: { providers?: any[]; seeded?: boolean }) => {
      providers = data.providers ?? [];
      seeded = data.seeded ?? false;
    },
    __resetMock: () => {
      seeded = false;
      providers = [];
    },
  };
});

// -------------------------------------------------------------------------
// Types (contract‑level assumptions, NOT implementation‑coupled)
// -------------------------------------------------------------------------
type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

interface ProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  apiKey?: string;
  health?: HealthStatus;
}

interface ProviderUpsertInput {
  name: string;
  type: ProviderType;
  apiKey?: string;
  health?: HealthStatus;
}

// -------------------------------------------------------------------------
// Contract / behaviour tests
// -------------------------------------------------------------------------
describe('Registry contract', () => {
  beforeEach(() => {
    _resetForTests();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storeMock = require('../store');
    storeMock.__resetMock();
  });

  // -- ensureSeeded ---------------------------------------------------------
  describe('ensureSeeded', () => {
    it('seeds at least one provider when store is unseeded', () => {
      expect(listProviders()).toEqual([]);
      ensureSeeded();
      const providers = listProviders();
      expect(providers.length).toBeGreaterThan(0);
      expect(providers[0]).toHaveProperty('id');
      expect(providers[0]).toHaveProperty('type');
    });

    it('is idempotent – calling again does not add extra providers', () => {
      ensureSeeded();
      const count = listProviders().length;
      ensureSeeded();
      expect(listProviders().length).toBe(count);
    });
  });

  // -- hydrateStore ---------------------------------------------------------
  describe('hydrateStore', () => {
    it('loads providers from the persistent store into memory', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const storeMock = require('../store');
      storeMock.setStore({
        seeded: true,
        providers: [
          { id: 'p1', name: 'Hydrated', type: 'OPENAI', apiKey: 'k1' },
        ],
      });

      expect(listProviders()).toEqual([]);
      hydrateStore();
      const mem = listProviders();
      expect(mem.length).toBe(1);
      expect(mem[0].id).toBe('p1');
      expect(mem[0].name).toBe('Hydrated');
    });
  });

  // -- listProviders --------------------------------------------------------
  describe('listProviders', () => {
    it('returns all providers after seeding', () => {
      ensureSeeded();
      const all = listProviders();
      expect(Array.isArray(all)).toBe(true);
      all.forEach(p => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('type');
      });
    });

    it('returns empty array when nothing is seeded', () => {
      expect(listProviders()).toEqual([]);
    });
  });

  // -- getProvider ----------------------------------------------------------
  describe('getProvider', () => {
    it('returns the correct provider by id', () => {
      ensureSeeded();
      const providers = listProviders();
      const id = providers[0].id;
      const found = getProvider(id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(id);
    });

    it('returns undefined for a non‑existent id', () => {
      expect(getProvider('unknown-id')).toBeUndefined();
    });
  });

  // -- createProvider -------------------------------------------------------
  describe('createProvider', () => {
    it('creates and returns a new provider with an id', () => {
      const input: ProviderUpsertInput = {
        name: 'NewOne',
        type: 'ANTHROPIC' as ProviderType,
        apiKey: 'sk-abc',
      };
      const created = createProvider(input);
      expect(created).toHaveProperty('id');
      expect(created.name).toBe('NewOne');
      expect(created.type).toBe('ANTHROPIC');
      expect(created.apiKey).toBe('sk-abc');
      expect(listProviders().some(p => p.id === created.id)).toBe(true);
    });

    it('throws when required fields are missing', () => {
      const invalidInput = { name: 'MissingType' } as any;
      expect(() => createProvider(invalidInput)).toThrow();
    });
  });

  // -- updateProvider (signature assumed: updateProvider(id, input)) ---------
  describe('updateProvider', () => {
    it('updates an existing provider and returns the updated record', () => {
      ensureSeeded();
      const id = listProviders()[0].id;
      const updates: ProviderUpsertInput = {
        name: 'UpdatedName',
        type: listProviders()[0].type,
        apiKey: 'new-key',
      };
      const updated = updateProvider(id, updates);
      expect(updated.id).toBe(id);
      expect(updated.name).toBe('UpdatedName');
      expect(updated.apiKey).toBe('new-key');
      expect(getProvider(id)?.name).toBe('UpdatedName');
    });

    it('throws when the provider does not exist', () => {
      const updates: ProviderUpsertInput = {
        name: 'Ghost',
        type: 'OPENAI' as ProviderType,
      };
      expect(() => updateProvider('missing', updates)).toThrow();
    });
  });

  // -- deleteProvider -------------------------------------------------------
  describe('deleteProvider', () => {
    it('deletes an existing provider and returns true', () => {
      ensureSeeded();
      const id = listProviders()[0].id;
      const result = deleteProvider(id);
      expect(result).toBe(true);
      expect(getProvider(id)).toBeUndefined();
      expect(listProviders().some(p => p.id === id)).toBe(false);
    });

    it('returns false for a non‑existent provider', () => {
      expect(deleteProvider('ghost')).toBe(false);
    });
  });

  // -- setHealth (signature assumed: setHealth(id, health)) ------------------
  describe('setHealth', () => {
    it('sets the health status of an existing provider', () => {
      ensureSeeded();
      const id = listProviders()[0].id;
      setHealth(id, 'unhealthy');
      expect(getProvider(id)?.health).toBe('unhealthy');
    });

    it('throws when the provider does not exist', () => {
      expect(() => setHealth('no-id', 'healthy')).toThrow();
    });
  });

  // -- resolveApiKey --------------------------------------------------------
  describe('resolveApiKey', () => {
    it('returns the apiKey when present', () => {
      const created = createProvider({
        name: 'WithKey',
        type: 'OPENAI' as ProviderType,
        apiKey: 'secret',
      });
      expect(resolveApiKey(created.id)).toBe('secret');
    });

    it('returns undefined when no apiKey is set', () => {
      const created = createProvider({
        name: 'NoKey',
        type: 'OPENAI' as ProviderType,
      });
      expect(resolveApiKey(created.id)).toBeUndefined();
    });

    it('returns undefined for a non‑existent id', () => {
      expect(resolveApiKey('nope')).toBeUndefined();
    });
  });

  // -- _resetForTests -------------------------------------------------------
  describe('_resetForTests', () => {
    it('clears all in‑memory providers', () => {
      ensureSeeded();
      expect(listProviders().length).toBeGreaterThan(0);
      _resetForTests();
      expect(listProviders()).toEqual([]);
    });
  });
});
```

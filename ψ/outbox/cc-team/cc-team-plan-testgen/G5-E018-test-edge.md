<!-- cc-team deliverable
 group: G5 (Generate jest unit tests for untested innomcp-node modules (batch 5))
 member: E018 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2809,"completion_tokens":5485,"total_tokens":8294,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2792,"image_tokens":0},"cache_creation_input_tokens":0} | 76s
 generated: 2026-06-13T11:15:16.476Z -->
```typescript
import type { ProviderRecord, ProviderUpsertInput, ProviderType } from '../src/providers/types';
import { validateUpsertInput } from '../src/providers/types';

jest.mock('../src/providers/types', () => {
  const actual = jest.requireActual('../src/providers/types');
  return {
    ...actual,
    validateUpsertInput: jest.fn(),
  };
});

jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn(() => 'mock-uuid-1'),
}));

interface RegistryExports {
  getAllProviders: () => ProviderRecord[];
  getProviderById: (id: string) => ProviderRecord | undefined;
  upsertProvider: (input: ProviderUpsertInput) => { provider: ProviderRecord; created: boolean };
  removeProvider: (id: string) => boolean;
  getEnabledProviders: () => ProviderRecord[];
  getProvidersByType: (type: ProviderType) => ProviderRecord[];
  updateProviderHealth: (id: string, status: string, message?: string) => void;
}

describe('ProviderRegistry', () => {
  let registry: RegistryExports;
  let mockValidate: jest.Mock;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.resetModules();
    // Clear environment variables to ensure deterministic seed
    delete process.env.OLLAMA_LOCAL_BASE_URL;
    delete process.env.OLLAMA_REMOTE_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GITHUB_COPILOT_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GEMINI_API_KEY;
    // Some seeds rely on default values -- set them explicitly
    process.env.OLLAMA_LOCAL_DEFAULT_MODEL = 'minimax-m2.5:cloud';
    process.env.INNOVA_BOT_BASE_URL = 'http://innova:11434';
    process.env.INNOVA_BOT_MODEL = 'qwen2.5:0.5b';

    mockValidate = validateUpsertInput as jest.Mock;
    mockValidate.mockImplementation((input: any) => input);

    registry = require('../src/providers/registry');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('seed hydration', () => {
    test('default seeds with no optional env vars', () => {
      const providers = registry.getAllProviders();
      const ids = providers.map((p) => p.id);
      expect(ids).toContain('seed-local-ollama');
      expect(ids).toContain('innova-bot');
      expect(ids).not.toContain('seed-mdes-ollama');
      expect(ids).not.toContain('seed-gpt-4o-mini');
      expect(ids).not.toContain('seed-github-copilot');
      expect(ids).not.toContain('seed-claude-haiku');
      expect(ids).not.toContain('seed-deepseek-r1');
      // local ollama baseUrl uses default
      const local = providers.find((p) => p.id === 'seed-local-ollama');
      expect(local!.baseUrl).toBe('http://localhost:11434');
    });

    test('MDES seed added when OLLAMA_REMOTE_BASE_URL is set', () => {
      process.env.OLLAMA_REMOTE_BASE_URL = 'https://remote.example.com/';
      jest.resetModules();
      registry = require('../src/providers/registry');
      const providers = registry.getAllProviders();
      expect(providers.map((p) => p.id)).toContain('seed-mdes-ollama');
      const mdes = providers.find((p) => p.id === 'seed-mdes-ollama')!;
      expect(mdes.baseUrl).toBe('https://remote.example.com'); // trailing slash stripped
    });

    test('OpenAI seeds added when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-fake';
      jest.resetModules();
      registry = require('../src/providers/registry');
      const ids = registry.getAllProviders().map((p) => p.id);
      expect(ids).toContain('seed-gpt-4o-mini');
      expect(ids).toContain('seed-gpt-4o-full');
    });
  });

  describe('upsertProvider', () => {
    test('throws error when validateUpsertInput throws', () => {
      mockValidate.mockImplementation(() => {
        throw new Error('INVALID_INPUT: displayName is required');
      });
      const input: any = { displayName: '' };
      expect(() => registry.upsertProvider(input)).toThrow('INVALID_INPUT');
    });

    test('creates new provider when id is not provided (generates UUID)', () => {
      const input: ProviderUpsertInput = {
        displayName: 'Dynamic Provider',
        type: 'ollama-local',
        baseUrl: 'http://localhost:9999',
        model: 'mock-model',
      };
      const result = registry.upsertProvider(input);
      expect(result.created).toBe(true);
      expect(result.provider.id).toBe('mock-uuid-1');
      expect(result.provider.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    test('creates new provider with explicit id and returns created true', () => {
      const input: ProviderUpsertInput = {
        id: 'custom-id',
        displayName: 'Custom',
        type: 'ollama-local',
        baseUrl: 'http://localhost:1000',
        model: 'm',
      };
      const result = registry.upsertProvider(input);
      expect(result.created).toBe(true);
      expect(result.provider.id).toBe('custom-id');
    });

    test('updates existing provider and returns created false', () => {
      const input: ProviderUpsertInput = {
        id: 'seed-local-ollama',
        displayName: 'Updated Local',
        type: 'ollama-local',
        baseUrl: 'http://updated.local',
        model: 'updated-model',
        priority: 50,
      };
      const result = registry.upsertProvider(input);
      expect(result.created).toBe(false);
      expect(result.provider.displayName).toBe('Updated Local');
      expect(result.provider.priority).toBe(50);
      // unchanged fields should not be overwritten if not provided? The implementation may replace entire object.
      // We'll check that baseUrl is updated.
      expect(result.provider.baseUrl).toBe('http://updated.local');
    });

    test('update preserves capabilities when not provided', () => {
      const original = registry.getProviderById('seed-local-ollama')!;
      const capsBefore = [...original.capabilities];
      const result = registry.upsertProvider({
        id: 'seed-local-ollama',
        displayName: 'X',
        type: 'ollama-local',
        baseUrl: 'http://x',
        model: 'x',
      });
      expect(result.provider.capabilities).toEqual(capsBefore);
    });

    test('sensible defaults for optional fields', () => {
      const result = registry.upsertProvider({
        displayName: 'Minimal',
        type: 'openai-compatible',
        baseUrl: 'http://test',
        model: 'test',
      });
      expect(result.provider.enabled).toBe(true);
      expect(result.provider.priority).toBe(0); // likely default
      expect(result.provider.healthStatus).toBe('unknown');
    });
  });

  describe('removeProvider', () => {
    test('returns true and removes existing provider', () => {
      expect(registry.removeProvider('seed-local-ollama')).toBe(true);
      expect(registry.getProviderById('seed-local-ollama')).toBeUndefined();
    });

    test('returns false for non-existent id', () => {
      expect(registry.removeProvider('does-not-exist')).toBe(false);
    });

    test('removing the same id twice returns false second time', () => {
      registry.removeProvider('innova-bot');
      expect(registry.removeProvider('innova-bot')).toBe(false);
    });
  });

  describe('getEnabledProviders', () => {
    test('excludes disabled providers', () => {
      registry.upsertProvider({
        id: 'temp',
        displayName: 'T',
        type: 'ollama-local',
        baseUrl: 'http://t',
        model: 't',
        enabled: false,
      });
      const enabled = registry.getEnabledProviders();
      expect(enabled.find((p) => p.id === 'temp')).toBeUndefined();
    });

    test('returns only enabled providers', () => {
      const all = registry.getAllProviders();
      const enabled = registry.getEnabledProviders();
      expect(enabled.length).toBeLessThanOrEqual(all.length);
      enabled.forEach((p) => expect(p.enabled).toBe(true));
    });

    test('returns empty array when no enabled providers', () => {
      // disable all existing
      for (const p of registry.getAllProviders()) {
        registry.upsertProvider({ ...p, enabled: false });
      }
      expect(registry.getEnabledProviders()).toEqual([]);
    });
  });

  describe('getProvidersByType', () => {
    test('returns correct subset for a given type', () => {
      const local = registry.getProvidersByType('ollama-local');
      expect(local.every((p) => p.type === 'ollama-local')).toBe(true);
      expect(local.map((p) => p.id)).toEqual(
        expect.arrayContaining(['seed-local-ollama', 'innova-bot'])
      );
    });

    test('returns empty array for unrecognized type', () => {
      expect(registry.getProvidersByType('nonexistent-type' as any)).toEqual([]);
    });
  });

  describe('updateProviderHealth', () => {
    test('updates healthStatus and lastChecked on existing provider', () => {
      registry.upsertProvider({
        id: 'health-test',
        displayName: 'H',
        type: 'ollama-local',
        baseUrl: 'http://h',
        model: 'h',
      });
      registry.updateProviderHealth('health-test', 'healthy', 'All good');
      const updated = registry.getProviderById('health-test')!;
      expect(updated.healthStatus).toBe('healthy');
      expect(updated.healthMessage).toBe('All good');
      expect(updated.lastChecked).toBe('2024-01-01T00:00:00.000Z');
    });

    test('does not throw for non-existent provider (logs warning)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => {
        registry.updateProviderHealth('ghost', 'dead');
      }).not.toThrow();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('edge cases and error paths', () => {
    test('getProviderById with empty string returns undefined', () => {
      expect(registry.getProviderById('')).toBeUndefined();
    });

    test('getProviderById with whitespace string behaves as any non-existent', () => {
      expect(registry.getProviderById('   ')).toBeUndefined();
    });

    test('upsert with null baseUrl throws validation error via mocked validate', () => {
      mockValidate.mockImplementation(() => {
        throw new Error('INVALID_INPUT: baseUrl is required');
      });
      expect(() => registry.upsertProvider({ displayName: 'X', type: 'ollama-local', baseUrl: null as any, model: 'x' }))
        .toThrow('INVALID_INPUT');
    });

    test('upsert with extremely long displayName is allowed if validation passes', () => {
      const longName = 'A'.repeat(500);
      const result = registry.upsertProvider({ displayName: longName, type: 'ollama-local', baseUrl: 'http://x', model: 'x' });
      expect(result.provider.displayName).toBe(longName);
    });
  });
});
```

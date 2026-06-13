<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S041 role=spec-test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":256,"completion_tokens":6344,"total_tokens":6600,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5019,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T11:31:31.778Z -->
```typescript
import {
  selectProvider,
  getAvailableProviders,
  resolveProviderEndpoint,
  previewSelection,
  ChatMode,
  SelectOptions,
  SelectionResult,
} from '../src/providers/router';

// Mock the provider manager that the router depends on internally
jest.mock('../src/providers/providerManager', () => ({
  getAllProviders: () => ['ollama', 'openai', 'lmstudio', 'gemini'],
  getProviderEndpoint: (name: string) => {
    const endpoints: Record<string, string> = {
      ollama: 'http://localhost:11434',
      openai: 'https://api.openai.com/v1',
      lmstudio: 'http://localhost:1234/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta',
    };
    if (!endpoints[name]) throw new Error(`Provider ${name} not found`);
    return endpoints[name];
  },
  getProvidersByMode: (mode: string): string[] => {
    const pools: Record<string, string[]> = {
      local: ['ollama'],
      remote: ['openai', 'gemini'],
      hybrid: ['lmstudio'],
    };
    return pools[mode] || [];
  },
  defaultMode: 'local',
}));

describe('Router – contract tests', () => {
  describe('getAvailableProviders', () => {
    test('returns an array of all configured provider names', () => {
      const providers = getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toEqual(['ollama', 'openai', 'lmstudio', 'gemini']);
    });
  });

  describe('selectProvider', () => {
    test('returns a local provider when mode is "local"', () => {
      const result: SelectionResult = selectProvider({ mode: 'local' });
      expect(result.mode).toBe('local');
      expect(result.provider).toBe('ollama');
      expect(result.endpoint).toBe('http://localhost:11434');
    });

    test('returns a remote provider when mode is "remote"', () => {
      const result = selectProvider({ mode: 'remote' });
      expect(result.mode).toBe('remote');
      expect(result.provider).toBe('openai');
      expect(result.endpoint).toBe('https://api.openai.com/v1');
    });

    test('returns a hybrid provider when mode is "hybrid"', () => {
      const result = selectProvider({ mode: 'hybrid' });
      expect(result.mode).toBe('hybrid');
      expect(result.provider).toBe('lmstudio');
      expect(result.endpoint).toBe('http://localhost:1234/v1');
    });

    test('throws when an invalid ChatMode is provided', () => {
      expect(() =>
        selectProvider({ mode: 'invalid' as ChatMode })
      ).toThrowError();
    });

    test('throws when no provider matches the requested mode', () => {
      // Force empty pool: no local providers if we deliberately override the mode to an empty category
      // Though we can't alter the mock here, we can request a mode that has no providers in our fixture.
      // Our mock already has no providers for 'remote-only'? We can use a mode like 'local' with filter.
      // Simulate a filter that excludes all matching providers:
      expect(() =>
        selectProvider({ mode: 'local', providers: ['openai', 'gemini'] } as SelectOptions)
      ).toThrowError('No provider available for mode local');
    });

    test('respects the optional providers filter', () => {
      // Ask for remote mode but only one preferred provider that exists
      const result = selectProvider({
        mode: 'remote',
        providers: ['gemini'],
      } as SelectOptions);
      expect(result.provider).toBe('gemini');
      expect(result.endpoint).toBe(
        'https://generativelanguage.googleapis.com/v1beta'
      );
    });

    test('throws when providers filter eliminates all matching candidates', () => {
      expect(() =>
        selectProvider({
          mode: 'remote',
          providers: ['ollama'], // ollama is local, not remote
        } as SelectOptions)
      ).toThrowError('No provider available for mode remote');
    });

    test('returns identical results when called repeatedly with same options', () => {
      const a = selectProvider({ mode: 'local' });
      const b = selectProvider({ mode: 'local' });
      expect(a).toEqual(b);
    });
  });

  describe('resolveProviderEndpoint', () => {
    test('returns the endpoint string for a known provider', () => {
      const endpoint = resolveProviderEndpoint('openai');
      expect(endpoint).toBe('https://api.openai.com/v1');
    });

    test('throws when provider is unknown', () => {
      expect(() => resolveProviderEndpoint('unknown')).toThrowError(
        'Provider unknown not found'
      );
    });

    test('accepts optional SelectOptions without altering result (if supported)', () => {
      // Contract: passing additional options should still resolve the correct endpoint
      const endpoint = resolveProviderEndpoint('lmstudio', { mode: 'hybrid' } as SelectOptions);
      expect(endpoint).toBe('http://localhost:1234/v1');
    });
  });

  describe('previewSelection', () => {
    test('returns a candidate result for a valid mode', () => {
      const preview = previewSelection({ mode: 'local' });
      expect(preview).toBeDefined();
      expect(preview.provider).toBe('ollama');
      expect(preview.endpoint).toBe('http://localhost:11434');
      expect(preview.mode).toBe('local');
    });

    test('preview result matches the actual selection for the same options', () => {
      const opts: SelectOptions = { mode: 'remote' };
      const preview = previewSelection(opts);
      const actual = selectProvider(opts);
      expect(preview).toEqual(actual);
    });

    test('throws for an invalid mode', () => {
      expect(() =>
        previewSelection({ mode: 'bogus' as ChatMode })
      ).toThrowError();
    });
  });
});
```

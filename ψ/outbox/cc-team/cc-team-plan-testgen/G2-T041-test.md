<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T041 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2183,"completion_tokens":4584,"total_tokens":6767,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1822,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T11:00:09.070Z -->
```typescript
import {
  selectProvider,
  getAvailableProviders,
  resolveProviderEndpoint,
  previewSelection,
  ChatMode,
} from '../src/providers/router';
import type { Capability, PrivacyLevel, ProviderRecord } from '../src/providers/types';
import { listProviders, getProvider, resolveApiKey } from '../src/providers/registry';

jest.mock('../src/providers/registry', () => ({
  listProviders: jest.fn(),
  getProvider: jest.fn(),
  resolveApiKey: jest.fn(),
}));

const mockListProviders = listProviders as jest.Mock;
const mockGetProvider = getProvider as jest.Mock;
const mockResolveApiKey = resolveApiKey as jest.Mock;

function makeProvider(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'p1',
    displayName: 'Provider One',
    type: 'ollama-remote',
    enabled: true,
    healthStatus: 'up',
    priority: 10,
    capabilities: [],
    privacyLevel: 'public' as PrivacyLevel,
    model: 'model-1',
    baseUrl: 'http://localhost:11434',
    ...overrides,
  };
}

describe('router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListProviders.mockReturnValue([]);
    mockGetProvider.mockReturnValue(undefined);
    mockResolveApiKey.mockReturnValue('');
  });

  describe('selectProvider', () => {
    const capabilities: Capability[] = ['code', 'chat'];

    it('returns null when no providers are registered', () => {
      mockListProviders.mockReturnValue([]);
      const result = selectProvider({ mode: 'remote', capabilities });
      expect(result.provider).toBeNull();
      expect(result.alternates).toEqual([]);
      expect(result.reason).toBe('ไม่พบผู้ให้บริการที่เข้าเงื่อนไขการเลือก');
    });

    it('returns null when no enabled provider matches the mode', () => {
      const providers = [makeProvider({ type: 'ollama-local' })];
      mockListProviders.mockReturnValue(providers);
      const result = selectProvider({ mode: 'remote', capabilities: [] });
      expect(result.provider).toBeNull();
    });

    it('filters by privacy level – public allows public providers', () => {
      const providers = [
        makeProvider({ id: 'pub', privacyLevel: 'public' as PrivacyLevel }),
        makeProvider({ id: 'conf', privacyLevel: 'confidential' as PrivacyLevel }),
      ];
      mockListProviders.mockReturnValue(providers);
      const result = selectProvider({ mode: 'hybrid', capabilities: [], privacyLevel: 'public' });
      expect(result.provider!.id).toBe('pub');
    });

    it('filters by privacy level – internal excludes public providers', () => {
      const providers = [
        makeProvider({ id: 'pub', privacyLevel: 'public' as PrivacyLevel }),
        makeProvider({ id: 'int', privacyLevel: 'internal' as PrivacyLevel }),
      ];
      mockListProviders.mockReturnValue(providers);
      const result = selectProvider({ mode: 'hybrid', capabilities: [], privacyLevel: 'internal' });
      expect(result.provider!.id).toBe('int');
    });

    it('excludes down providers by default', () => {
      const providers = [
        makeProvider({ id: 'down', healthStatus: 'down' }),
        makeProvider({ id: 'up', healthStatus: 'up' }),
      ];
      mockListProviders.mockReturnValue(providers);
      const result = selectProvider({ mode: 'hybrid', capabilities: [] });
      expect(result.provider!.id).toBe('up');
    });

    it('includes down providers when excludeDown is false', () => {
      const providers = [
        makeProvider({ id: 'down', healthStatus: 'down', priority: 100 }),
        makeProvider({ id: 'up', healthStatus: 'up', priority: 1 }),
      ];
      mockListProviders.mockReturnValue(providers);
      const result = selectProvider({ mode: 'hybrid', capabilities: [], excludeDown: false });
      expect(result.provider!.id).toBe('down');
    });

    it('ranks by capability score × 100 + priority', () => {
      const p1 = makeProvider({ id: 'p1', capabilities: ['code'], priority: 50 });
      const p2 = makeProvider({ id: 'p2', capabilities: ['code', 'chat'], priority: 20 });
      mockListProviders.mockReturnValue([p1, p2]);
      const result = selectProvider({ mode: 'hybrid', capabilities: ['code', 'chat'] });
      // p1 score = 0.5 * 100 + 50 = 100, p2 score = 1 * 100 + 20 = 120 => p2 should be top
      expect(result.provider!.id).toBe('p2');
      expect(result.alternates[0].id).toBe('p1');
    });

    it('preferred provider is selected if it matches at least one capability', () => {
      const preferred = makeProvider({ id: 'pref', capabilities: ['code'], displayName: 'Pref' });
      const others = [makeProvider({ id: 'other', capabilities: ['code', 'chat'], priority: 100 })];
      mockListProviders.mockReturnValue([preferred, ...others]);
      const result = selectProvider({ mode: 'hybrid', capabilities: ['code'], preferredProviderId: 'pref' });
      expect(result.provider!.id).toBe('pref');
      expect(result.reason).toContain('Pref');
      expect(result.reason).toContain('code');
      expect(result.alternates.length).toBe(1);
    });

    it('falls back to ranking when preferred provider does not match capability', () => {
      const preferred = makeProvider({ id: 'pref', capabilities: ['chat'], displayName: 'Pref' });
      const other = makeProvider({ id: 'other', capabilities: ['code'], priority: 50 });
      mockListProviders.mockReturnValue([preferred, other]);
      const result = selectProvider({ mode: 'hybrid', capabilities: ['code'], preferredProviderId: 'pref' });
      expect(result.provider!.id).toBe('other');
    });

    it('generates reason in Thai with matched capabilities', () => {
      const provider = makeProvider({ id: 'p', displayName: 'TestP', capabilities: ['code'], priority: 10 });
      mockListProviders.mockReturnValue([provider]);
      const result = selectProvider({ mode: 'hybrid', capabilities: ['code'] });
      expect(result.reason).toContain('TestP');
      expect(result.reason).toContain('code');
    });

    it('includes non-matching alternates when capability filtering reduces candidates to zero', () => {
      const p = makeProvider({ id: 'p', capabilities: [], priority: 5 });
      mockListProviders.mockReturnValue([p]);
      const result = selectProvider({ mode: 'hybrid', capabilities: ['code'] });
      // eligible = candidates because capabilityCandidates empty -> eligible = candidates [p]
      expect(result.provider!.id).toBe('p');
      expect(result.reason).toContain('p');
      expect(result.reason).not.toContain('code');
    });
  });

  describe('getAvailableProviders', () => {
    const envBackup = { ...process.env };

    afterEach(() => {
      process.env = { ...envBackup };
    });

    it('always includes mdes-ollama', () => {
      process.env = {};
      expect(getAvailableProviders()).toContain('mdes-ollama');
    });

    it('returns only mdes-ollama when no relevant env vars are set', () => {
      process.env = {};
      expect(getAvailableProviders()).toEqual(['mdes-ollama']);
    });

    it('includes gpt when OPENAI_API_KEY is set', () => {
      process.env = { OPENAI_API_KEY: 'abc' };
      expect(getAvailableProviders()).toContain('gpt');
    });

    it('includes gpt when GPT_API_KEY is set', () => {
      process.env = { GPT_API_KEY: 'abc' };
      expect(getAvailableProviders()).toContain('gpt');
    });

    it('includes github-copilot when GITHUB_COPILOT_TOKEN is set', () => {
      process.env = { GITHUB_COPILOT_TOKEN: 'ghp_xxx' };
      expect(getAvailableProviders()).toContain('github-copilot');
    });

    it('includes github-copilot when COPILOT_API_KEY is set', () => {
      process.env = { COPILOT_API_KEY: 'copilot-key' };
      expect(getAvailableProviders()).toContain('github-copilot');
    });

    it('includes thai-llm when THAI_LLM_MODEL is set', () => {
      process.env = { THAI_LLM_MODEL: 'model-x' };
      expect(getAvailableProviders()).toContain('thai-llm');
    });

    it('includes ollama-local when LOCAL_OLLAMA_BASE_URL is set', () => {
      process.env = { LOCAL_OLLAMA_BASE_URL: 'http://localhost:11434' };
      expect(getAvailableProviders()).toContain('ollama-local');
    });

    it('includes ollama-local when OLLAMA_BASE_URL is set', () => {
      process.env = { OLLAMA_BASE_URL: 'http://ollama:11434' };
      expect(getAvailableProviders()).toContain('ollama-local');
    });

    it('returns multiple providers when several env vars are set', () => {
      process.env = {
        OPENAI_API_KEY: 'abc',
        GITHUB_COPILOT_TOKEN: 'xyz',
        THAI_LLM_MODEL: 'gpt4th',
        LOCAL_OLLAMA_BASE_URL: 'http://localhost:11434',
      };
      const result = getAvailableProviders();
      expect(result).toEqual(
        expect.arrayContaining(['mdes-ollama', 'gpt', 'github-copilot', 'thai-llm', 'ollama-local']),
      );
      expect(result.length).toBe(5);
    });
  });

  describe('resolveProviderEndpoint', () => {
    it('returns null when provider is not in registry', () => {
      mockGetProvider.mockReturnValue(undefined);
      expect(resolveProviderEndpoint('nonexistent')).toBeNull();
    });

    it('returns endpoint config with key from resolveApiKey', () => {
      const provider = makeProvider({
        id: 'gpt',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
      });
      mockGetProvider.mockReturnValue(provider);
      mockResolveApiKey.mockReturnValue('sk-test');
      const result = resolveProviderEndpoint('gpt');
      expect(result).toEqual({
        url: 'https://api.openai.com/v1',
        key: 'sk-test',
        model: 'gpt-4',
      });
    });

    it('returns empty key when resolveApiKey returns empty', () => {
      mockGetProvider.mockReturnValue(makeProvider({ baseUrl: 'http://x', model: 'm' }));
      mockResolveApiKey.mockReturnValue(undefined);
      expect(resolveProviderEndpoint('p')?.key).toBe('');
    });
  });

  describe('previewSelection', () => {
    it('returns mapped selection and fallback chain from selectProvider', () => {
      const p1 = makeProvider({ id: 'main', displayName: 'Main', model: 'main-model', capabilities: ['code'] });
      const p2 = makeProvider({ id: 'fallback', displayName: 'Fallback', model: 'fb-model' });
      mockListProviders.mockReturnValue([p1, p2]);

      const preview = previewSelection({ mode: 'hybrid', capabilities: ['code'] });
      expect(preview.selected).toEqual({
        id: 'main',
        displayName: 'Main',
        model: 'main-model',
      });
      expect(preview.fallbackChain).toHaveLength(1);
      expect(preview.fallbackChain[0]).toEqual({
        id: 'fallback',
        displayName: 'Fallback',
        model: 'fb-model',
      });
      expect(typeof preview.reason).toBe('string');
    });

    it('selected is null when no provider matches', () => {
      mockListProviders.mockReturnValue([]);
      const preview = previewSelection({ mode: 'local', capabilities: [] });
      expect(preview.selected).toBeNull();
      expect(preview.fallbackChain).toEqual([]);
    });
  });
});
```

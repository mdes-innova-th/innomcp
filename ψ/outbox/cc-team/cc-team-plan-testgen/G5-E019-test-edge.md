<!-- cc-team deliverable
 group: G5 (Generate jest unit tests for untested innomcp-node modules (batch 5))
 member: E019 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2212,"completion_tokens":5423,"total_tokens":7635,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1538,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T11:15:10.193Z -->
```typescript
import {
  selectProvider,
  getAvailableProviders,
  resolveProviderEndpoint,
  previewSelection,
} from '../src/providers/router';
import { listProviders, getProvider, resolveApiKey } from '../src/providers/registry';
import type { ProviderRecord, Capability, PrivacyLevel } from '../src/providers/types';

jest.mock('../src/providers/registry');

const mockListProviders = listProviders as jest.MockedFunction<typeof listProviders>;
const mockGetProvider = getProvider as jest.MockedFunction<typeof getProvider>;
const mockResolveApiKey = resolveApiKey as jest.MockedFunction<typeof resolveApiKey>;

function makeProvider(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'test-provider',
    displayName: 'Test Provider',
    type: 'ollama-remote',
    enabled: true,
    priority: 10,
    capabilities: ['chat', 'vision'] as Capability[],
    privacyLevel: 'internal' as PrivacyLevel,
    healthStatus: 'up',
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
    ...overrides,
  };
}

describe('router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default empty registry
    mockListProviders.mockReturnValue([]);
    mockGetProvider.mockReturnValue(null);
    mockResolveApiKey.mockReturnValue('');
  });

  describe('selectProvider', () => {
    it('returns null provider when no providers are registered', () => {
      const result = selectProvider({
        mode: 'remote',
        capabilities: [],
      });
      expect(result.provider).toBeNull();
      expect(result.alternates).toEqual([]);
      expect(result.reason).toBe('ไม่พบผู้ให้บริการที่เข้าเงื่อนไขการเลือก');
    });

    it('returns null provider when all providers are disabled', () => {
      const p = makeProvider({ enabled: false });
      mockListProviders.mockReturnValue([p]);
      const result = selectProvider({ mode: 'remote', capabilities: [] });
      expect(result.provider).toBeNull();
    });

    it('excludes down providers by default', () => {
      const up = makeProvider({ id: 'up', healthStatus: 'up' });
      const down = makeProvider({ id: 'down', healthStatus: 'down' });
      mockListProviders.mockReturnValue([down, up]);
      const result = selectProvider({ mode: 'hybrid', capabilities: [] });
      expect(result.provider).not.toBeNull();
      expect(result.provider!.id).toBe('up');
      expect(result.alternates).toHaveLength(0);
    });

    it('includes down providers when excludeDown is false', () => {
      const down = makeProvider({ id: 'down', healthStatus: 'down', priority: 100 });
      const up = makeProvider({ id: 'up', priority: 1 });
      mockListProviders.mockReturnValue([up, down]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: [],
        excludeDown: false,
      });
      // highest priority chooses first
      expect(result.provider!.id).toBe('down');
    });

    it('filters by mode local – rejects non-ollama-local', () => {
      const local = makeProvider({ id: 'local1', type: 'ollama-local' });
      const remote = makeProvider({ id: 'remote1', type: 'ollama-remote' });
      mockListProviders.mockReturnValue([remote, local]);
      const result = selectProvider({ mode: 'local', capabilities: [] });
      expect(result.provider!.id).toBe('local1');
    });

    it('filters by mode remote – only remote-capable types', () => {
      const remoteOk = makeProvider({ id: 'r1', type: 'openai-compatible' });
      const local = makeProvider({ id: 'l1', type: 'ollama-local' });
      const custom = makeProvider({ id: 'c1', type: 'custom' });
      mockListProviders.mockReturnValue([local, remoteOk, custom]);
      const result = selectProvider({ mode: 'remote', capabilities: [] });
      const ids = [result.provider!.id, ...result.alternates.map(p => p.id)].sort();
      expect(ids).toEqual(['c1', 'r1']);
    });

    it('hybrid mode accepts any provider type', () => {
      const local = makeProvider({ id: 'l1', type: 'ollama-local' });
      const anyType = makeProvider({ id: 'x1', type: 'unknown' as any });
      mockListProviders.mockReturnValue([local, anyType]);
      const result = selectProvider({ mode: 'hybrid', capabilities: [] });
      expect(result.provider).not.toBeNull();
      expect(result.alternates).toHaveLength(1);
    });

    it('respects privacyLevel: confidential only matches confidential or internal', () => {
      const conf = makeProvider({ id: 'conf', privacyLevel: 'confidential' });
      const intern = makeProvider({ id: 'intern', privacyLevel: 'internal' });
      const pub = makeProvider({ id: 'pub', privacyLevel: 'public' });
      mockListProviders.mockReturnValue([pub, intern, conf]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: [],
        privacyLevel: 'confidential',
      });
      const ids = [result.provider!.id, ...result.alternates.map(p => p.id)];
      expect(ids).not.toContain('pub');
    });

    it('privacyLevel internal excludes public only', () => {
      const pub = makeProvider({ id: 'pub', privacyLevel: 'public' });
      const intern = makeProvider({ id: 'intern', privacyLevel: 'internal' });
      mockListProviders.mockReturnValue([pub, intern]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: [],
        privacyLevel: 'internal',
      });
      expect(result.provider!.id).toBe('intern');
    });

    it('empty capabilities treats all as eligible and ranks by priority', () => {
      const low = makeProvider({ id: 'low', priority: 5, capabilities: ['chat'] as Capability[] });
      const high = makeProvider({ id: 'high', priority: 100, capabilities: [] });
      mockListProviders.mockReturnValue([low, high]);
      const result = selectProvider({ mode: 'hybrid', capabilities: [] });
      // With empty wanted, capabilityScore = 1 for all, rank = 1*100 + priority => high goes first
      expect(result.provider!.id).toBe('high');
    });

    it('when no provider matches any capability, falls back to all candidates (by priority)', () => {
      const a = makeProvider({ id: 'a', priority: 10, capabilities: ['chat'] as Capability[] });
      const b = makeProvider({ id: 'b', priority: 20, capabilities: ['vision'] as Capability[] });
      mockListProviders.mockReturnValue([a, b]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: ['audio'] as Capability[], // nobody has
      });
      // Both become eligible because capabilityCandidates empty => eligible = candidates
      expect(result.provider).not.toBeNull();
      // highest priority (20) should win
      expect(result.provider!.id).toBe('b');
    });

    it('preferredProviderId with matching capabilities is selected', () => {
      const main = makeProvider({ id: 'pref', priority: 1, capabilities: ['chat'] as Capability[] });
      const other = makeProvider({ id: 'other', priority: 100, capabilities: ['chat', 'vision'] as Capability[] });
      mockListProviders.mockReturnValue([other, main]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: ['chat'],
        preferredProviderId: 'pref',
      });
      expect(result.provider!.id).toBe('pref');
      expect(result.alternates.map(p => p.id)).toContain('other');
    });

    it('preferredProviderId is ignored when its capability score is zero', () => {
      const pref = makeProvider({ id: 'pref', priority: 999, capabilities: [] });
      const alt = makeProvider({ id: 'alt', priority: 1, capabilities: ['audio'] as Capability[] });
      mockListProviders.mockReturnValue([pref, alt]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: ['audio'],
        preferredProviderId: 'pref',
      });
      // pref has score 0, so not selected; falls to ranking where alt (score>0) wins
      expect(result.provider!.id).toBe('alt');
    });

    it('preferredProviderId not in eligible list is ignored', () => {
      const other = makeProvider({ id: 'other', priority: 1 });
      mockListProviders.mockReturnValue([other]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: [],
        preferredProviderId: 'nonexistent',
      });
      expect(result.provider!.id).toBe('other');
    });

    it('reason includes matched capabilities for top provider', () => {
      const p = makeProvider({ id: 'cap', capabilities: ['chat', 'vision'] as Capability[] });
      mockListProviders.mockReturnValue([p]);
      const result = selectProvider({
        mode: 'hybrid',
        capabilities: ['vision'],
      });
      expect(result.reason).toContain('ตรงความสามารถ vision');
    });

    it('handles undefined privacyLevel as match-all', () => {
      const pub = makeProvider({ id: 'pub', privacyLevel: 'public' });
      const conf = makeProvider({ id: 'conf', privacyLevel: 'confidential' });
      mockListProviders.mockReturnValue([pub, conf]);
      const result = selectProvider({ mode: 'hybrid', capabilities: [] });
      // both should be eligible, top by priority (default 10)
      expect([result.provider!.id, ...result.alternates.map(p => p.id)]).toEqual(
        expect.arrayContaining(['pub', 'conf'])
      );
    });

    it('empty candidates from filtering returns null', () => {
      // only local provider, but mode remote
      const local = makeProvider({ id: 'l', type: 'ollama-local' });
      mockListProviders.mockReturnValue([local]);
      const result = selectProvider({ mode: 'remote', capabilities: [] });
      expect(result.provider).toBeNull();
    });
  });

  describe('getAvailableProviders', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      jest.resetModules(); // required to clear module-level env references? Not needed because we just read process.env
      process.env = { ...OLD_ENV }; // clone
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('returns default mdes-ollama when no env vars set', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.GPT_API_KEY;
      delete process.env.GITHUB_COPILOT_TOKEN;
      delete process.env.COPILOT_API_KEY;
      delete process.env.THAI_LLM_MODEL;
      delete process.env.LOCAL_OLLAMA_BASE_URL;
      delete process.env.OLLAMA_BASE_URL;
      const result = getAvailableProviders();
      expect(result).toEqual(['mdes-ollama']);
    });

    it('includes gpt when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-abc';
      const result = getAvailableProviders();
      expect(result).toContain('gpt');
    });

    it('includes gpt when GPT_API_KEY is set', () => {
      process.env.GPT_API_KEY = 'key';
      const result = getAvailableProviders();
      expect(result).toContain('gpt');
    });

    it('includes github-copilot via GITHUB_COPILOT_TOKEN', () => {
      process.env.GITHUB_COPILOT_TOKEN = 'token';
      const result = getAvailableProviders();
      expect(result).toContain('github-copilot');
    });

    it('includes github-copilot via COPILOT_API_KEY', () => {
      process.env.COPILOT_API_KEY = 'key';
      const result = getAvailableProviders();
      expect(result).toContain('github-copilot');
    });

    it('includes thai-llm when THAI_LLM_MODEL is set', () => {
      process.env.THAI_LLM_MODEL = 'some-model';
      const result = getAvailableProviders();
      expect(result).toContain('thai-llm');
    });

    it('includes ollama-local when LOCAL_OLLAMA_BASE_URL or OLLAMA_BASE_URL is set', () => {
      process.env.LOCAL_OLLAMA_BASE_URL = 'http://localhost:4000';
      const result = getAvailableProviders();
      expect(result).toContain('ollama-local');
    });

    it('includes ollama-local via OLLAMA_BASE_URL', () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      const result = getAvailableProviders();
      expect(result).toContain('ollama-local');
    });

    it('includes all configured providers', () => {
      process.env.OPENAI_API_KEY = 'sk-abc';
      process.env.GITHUB_COPILOT_TOKEN = 'cop123';
      process.env.THAI_LLM_MODEL = 'thai';
      process.env.LOCAL_OLLAMA_BASE_URL = 'http://localhost:5555';
      const result = getAvailableProviders();
      expect(result).toEqual(
        expect.arrayContaining(['mdes-ollama', 'gpt', 'github-copilot', 'thai-llm', 'ollama-local'])
      );
      expect(result).toHaveLength(5);
    });

    it('does not duplicate providers if multiple env keys match', () => {
      process.env.OPENAI_API_KEY = 'x';
      process.env.GPT_API_KEY = 'y';
      const result = getAvailableProviders();
      const gptEntries = result.filter(id => id === 'gpt');
      expect(gptEntries).toHaveLength(1);
    });
  });

  describe('resolveProviderEndpoint', () => {
    it('returns null when provider is not found', () => {
      mockGetProvider.mockReturnValue(null);
      const result = resolveProviderEndpoint('unknown');
      expect(result).toBeNull();
    });

    it('returns endpoint config when provider exists, even with empty key', () => {
      const prov = makeProvider({ baseUrl: 'http://api', model: 'gpt-4' });
      mockGetProvider.mockReturnValue(prov);
      mockResolveApiKey.mockReturnValue(''); // empty key
      const result = resolveProviderEndpoint('test');
      expect(result).not.toBeNull();
      expect(result!.url).toBe('http://api');
      expect(result!.key).toBe('');
      expect(result!.model).toBe('gpt-4');
    });

    it('returns external key if resolveApiKey provides one', () => {
      const prov = makeProvider({ baseUrl: 'https://external' });
      mockGetProvider.mockReturnValue(prov);
      mockResolveApiKey.mockReturnValue('secret-key');
      const result = resolveProviderEndpoint('ext');
      expect(result!.key).toBe('secret-key');
    });

    it('coerces undefined key to empty string', () => {
      const prov = makeProvider({ baseUrl: 'url' });
      mockGetProvider.mockReturnValue(prov);
      mockResolveApiKey.mockReturnValue(undefined as unknown as string);
      const result = resolveProviderEndpoint('x');
      expect(result!.key).toBe('');
    });
  });

  describe('previewSelection', () => {
    it('returns selected null and empty fallback chain when no provider', () => {
      mockListProviders.mockReturnValue([]);
      const result = previewSelection({ mode: 'remote', capabilities: [] });
      expect(result.selected).toBeNull();
      expect(result.fallbackChain).toEqual([]);
      expect(result.reason).toBeDefined();
    });

    it('maps selected provider fields correctly', () => {
      const prov = makeProvider({
        id: 'main',
        displayName: 'Main',
        model: 'm1',
        priority: 100,
      });
      mockListProviders.mockReturnValue([prov]);
      const result = previewSelection({ mode: 'hybrid', capabilities: [] });
      expect(result.selected).toEqual({
        id: 'main',
        displayName: 'Main',
        model: 'm1',
      });
      expect(result.fallbackChain).toEqual([]);
    });

    it('includes alternates as fallback chain', () => {
      const p1 = makeProvider({ id: 'one', priority: 200 });
      const p2 = makeProvider({ id: 'two', priority: 100 });
      const p3 = makeProvider({ id: 'three', priority: 50 });
      mockListProviders.mockReturnValue([p2, p1, p3]);
      const result = previewSelection({
        mode: 'hybrid',
        capabilities: [],
      });
      expect(result.selected!.id).toBe('one');
      expect(result.fallbackChain.map(f => f.id)).toEqual(['two', 'three']);
    });

    it('preserves reason from selectProvider', () => {
      const prov = makeProvider({ id: 'p', displayName: 'P' });
      mockListProviders.mockReturnValue([prov]);
      const result = previewSelection({ mode: 'hybrid', capabilities: [] });
      expect(result.reason).toContain('เลือก P');
    });
  });
});
```

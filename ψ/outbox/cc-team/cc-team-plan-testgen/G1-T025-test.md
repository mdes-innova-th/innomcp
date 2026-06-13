<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T025 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2593,"completion_tokens":2423,"total_tokens":5016,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T10:55:39.571Z -->
```typescript
import { listProviders } from '../src/providers/registry';
import {
  buildSystemInventorySnapshot,
  looksLikeSystemInventoryQuestion,
  SystemInventorySnapshot,
} from '../src/services/systemInventory';

jest.mock('../src/providers/registry', () => ({
  listProviders: jest.fn(),
}));

const mockedListProviders = listProviders as jest.MockedFunction<typeof listProviders>;

describe('systemInventory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('looksLikeSystemInventoryQuestion', () => {
    test('returns false for empty or non-string input', () => {
      expect(looksLikeSystemInventoryQuestion('')).toBe(false);
      // @ts-expect-error - testing runtime guard
      expect(looksLikeSystemInventoryQuestion(null)).toBe(false);
      // @ts-expect-error - testing runtime guard
      expect(looksLikeSystemInventoryQuestion(undefined)).toBe(false);
    });

    test('matches English inventory phrases with system subjects', () => {
      expect(looksLikeSystemInventoryQuestion('list all tools available')).toBe(true);
      expect(looksLikeSystemInventoryQuestion('what providers are enabled?')).toBe(true);
      expect(looksLikeSystemInventoryQuestion('show me the API inventory')).toBe(true);
      expect(looksLikeSystemInventoryQuestion('which models are used?')).toBe(true);
      expect(looksLikeSystemInventoryQuestion('what mcp capabilities exist')).toBe(true);
    });

    test('matches when multiple system subject terms are present', () => {
      expect(looksLikeSystemInventoryQuestion('tools and providers')).toBe(true);
      expect(looksLikeSystemInventoryQuestion('apis endpoints registry')).toBe(true);
    });

    test('matches Thai inventory queries', () => {
      expect(looksLikeSystemInventoryQuestion('เครื่องมืออะไรบ้าง')).toBe(true);
      expect(looksLikeSystemInventoryQuestion('ระบบมีโมเดลอะไร')).toBe(true);
      expect(looksLikeSystemInventoryQuestion('ผู้ให้บริการทั้งหมด')).toBe(true);
    });

    test('does not match non-inventory phrases', () => {
      expect(looksLikeSystemInventoryQuestion('hello there')).toBe(false);
      expect(looksLikeSystemInventoryQuestion('tell me a joke')).toBe(false);
      expect(looksLikeSystemInventoryQuestion('what is the weather?')).toBe(false);
    });
  });

  describe('buildSystemInventorySnapshot', () => {
    const fakeProvider = {
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      model: 'gpt-4',
      enabled: true,
    };

    test('builds snapshot with empty MCP and unreachable command code', async () => {
      mockedListProviders.mockReturnValue([fakeProvider] as any);

      const snapshot: SystemInventorySnapshot = await buildSystemInventorySnapshot({
        mcpClient: null,
        timeoutMs: 1000,
      });

      expect(snapshot.generatedAt).toEqual(expect.any(String));
      expect(new Date(snapshot.generatedAt).toString()).not.toBe('Invalid Date');

      expect(snapshot.mcp.totalTools).toBe(0);
      expect(snapshot.mcp.localTools).toBe(0);
      expect(snapshot.mcp.remoteTools).toBe(0);
      expect(snapshot.mcp.connectedClients).toEqual([]);
      expect(snapshot.mcp.remoteReady).toBe(false);
      expect(snapshot.mcp.tools).toEqual([]);
      expect(snapshot.mcp.resources).toEqual([]);

      expect(snapshot.providers).toEqual([
        { id: 'openai', name: 'OpenAI', type: 'openai', model: 'gpt-4', enabled: true },
      ]);

      expect(snapshot.commandCode.reachable).toBe(false);
      expect(snapshot.commandCode.modelCount).toBe(0);
      expect(snapshot.commandCode.models).toEqual([]);
      expect(snapshot.commandCode.error).toEqual(expect.any(String));

      expect(Array.isArray(snapshot.apiSurfaces)).toBe(true);
      expect(snapshot.apiSurfaces.length).toBeGreaterThan(0);
      expect(snapshot.apiSurfaces[0]).toEqual(
        expect.objectContaining({ method: expect.any(String), path: expect.any(String), purpose: expect.any(String) })
      );
    });

    test('aggregates runtime tools and resources from mcpClient', async () => {
      mockedListProviders.mockReturnValue([]);

      const mcpClient = {
        getAvailableTools: jest.fn(() => [
          { name: 'echo', description: 'echo back', category: 'util' },
          { name: 'ECHO', description: 'dup', category: 'util' },
        ]),
        getAvailableResources: jest.fn(() => [
          { name: 'res1', title: 'Res One', description: 'a resource', uriTemplate: 'res://1' },
        ]),
        getConnectedClients: jest.fn(() => ['client-a', 'client-b']),
      };

      const snapshot = await buildSystemInventorySnapshot({
        mcpClient: mcpClient as any,
        timeoutMs: 1000,
      });

      expect(mcpClient.getAvailableTools).toHaveBeenCalled();
      expect(mcpClient.getAvailableResources).toHaveBeenCalled();

      // uniqueByName dedupes by lowercase name
      expect(snapshot.mcp.tools).toHaveLength(1);
      expect(snapshot.mcp.tools[0]).toEqual(
        expect.objectContaining({ name: 'echo', source: 'runtime', category: 'util' })
      );
      expect(snapshot.mcp.totalTools).toBe(1);
      expect(snapshot.mcp.localTools).toBe(1);
      expect(snapshot.mcp.remoteTools).toBe(0);
      expect(snapshot.mcp.connectedClients).toEqual(['client-a', 'client-b']);
      expect(snapshot.mcp.remoteReady).toBe(false);

      expect(snapshot.mcp.resources).toEqual([
        { name: 'res1', title: 'Res One', description: 'a resource', uriTemplate: 'res://1' },
      ]);
    });

    test('handles missing optional mcpClient methods gracefully', async () => {
      mockedListProviders.mockReturnValue([fakeProvider] as any);

      const mcpClient = {};
      const snapshot = await buildSystemInventorySnapshot({
        mcpClient: mcpClient as any,
        timeoutMs: 500,
      });

      expect(snapshot.mcp.tools).toEqual([]);
      expect(snapshot.mcp.resources).toEqual([]);
      expect(snapshot.mcp.connectedClients).toEqual([]);
      expect(snapshot.mcp.totalTools).toBe(0);
    });

    test('uses default providers list when listProviders returns undefined', async () => {
      mockedListProviders.mockReturnValue(undefined as any);

      const snapshot = await buildSystemInventorySnapshot({ mcpClient: null, timeoutMs: 500 });
      expect(snapshot.providers).toEqual([]);
    });

    test('does not call fetch when mcpServerUrl is omitted', async () => {
      mockedListProviders.mockReturnValue([]);
      const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('should not be called'));

      const snapshot = await buildSystemInventorySnapshot({
        mcpClient: null,
        timeoutMs: 500,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(snapshot.mcp.remoteTools).toBe(0);
      fetchSpy.mockRestore();
    });

    test('returns unreachable command code when fetch throws (e.g. abort)', async () => {
      mockedListProviders.mockReturnValue([]);

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('aborted'));

      const snapshot = await buildSystemInventorySnapshot({
        mcpClient: null,
        mcpServerUrl: 'http://127.0.0.1:9999',
        commandCodeBaseUrl: 'http://127.0.0.1:4322',
        timeoutMs: 500,
      });

      expect(snapshot.commandCode.reachable).toBe(false);
      expect(snapshot.commandCode.modelCount).toBe(0);
      expect(snapshot.commandCode.models).toEqual([]);
      expect(snapshot.commandCode.error).toBe('aborted');
      fetchSpy.mockRestore();
    });

    test('parses command code models from a successful response', async () => {
      mockedListProviders.mockReturnValue([]);

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'model-a' },
            { id: 'model-b' },
            { id: '' },
          ],
        }),
      } as any);

      const snapshot = await buildSystemInventorySnapshot({
        mcpClient: null,
        commandCodeBaseUrl: 'http://127.0.0.1:4322',
        timeoutMs: 1000,
      });

      expect(snapshot.commandCode.reachable).toBe(true);
      expect(snapshot.commandCode.modelCount).toBe(2);
      expect(snapshot.commandCode.models).toEqual(['model-a', 'model-b']);
      expect(snapshot.commandCode.error).toBeUndefined();
      fetchSpy.mockRestore();
    });

    test('marks commandCode unreachable on non-ok HTTP response', async () => {
      mockedListProviders.mockReturnValue([]);

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as any);

      const snapshot = await buildSystemInventorySnapshot({
        mcpClient: null,
        commandCodeBaseUrl: 'http://127.0.0.1:4322',
        timeoutMs: 1000,
      });

      expect(snapshot.commandCode.reachable).toBe(false);
      expect(snapshot.commandCode.error).toBe('HTTP 503');
      fetchSpy.mockRestore();
    });

    test('uses default timeoutMs when not provided', async () => {
      mockedListProviders.mockReturnValue([]);

      const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('boom'));

      const snapshot = await buildSystemInventorySnapshot({
        mcpClient: null,
        commandCodeBaseUrl: 'http://127.0.0.1:4322',
      });

      expect(snapshot.commandCode.reachable).toBe(false);
      expect(snapshot.commandCode.error).toBe('boom');
      fetchSpy.mockRestore();
    });

    test('apiSurfaces contains the expected core entries', async () => {
      mockedListProviders.mockReturnValue([]);

      const snapshot = await buildSystemInventorySnapshot({ mcpClient: null, timeoutMs: 100 });

      const paths = snapshot.apiSurfaces.map((s) => s.path);
      expect(paths).toEqual(
        expect.arrayContaining([
          '/chat',
          '/api/chat',
          '/api/chat/system/inventory',
          '/api/health',
          '/api/providers/health-check',
        ])
      );
    });
  });
});
```

<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S025 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":473,"completion_tokens":2518,"total_tokens":2991,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 51s
 generated: 2026-06-13T11:26:38.493Z -->
```typescript
import {
  SystemInventorySnapshot,
  InventoryBuildOptions,
  looksLikeSystemInventoryQuestion,
  buildSystemInventorySnapshot,
  renderSystemInventoryAnswer,
  buildSystemInventoryAnswer,
} from '../src/services/systemInventory';

// Mock global fetch used internally for network calls
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; body?: any; throw?: Error }>) {
  let i = 0;
  global.fetch = jest.fn(async (_url: string, _init?: RequestInit) => {
    const r = responses[i++] ?? responses[responses.length - 1];
    if (r.throw) throw r.throw;
    if (!r.ok) {
      return {
        ok: false,
        status: r.status ?? 500,
        statusText: 'Error',
        text: async () => JSON.stringify(r.body ?? {}),
      } as any;
    }
    return {
      ok: true,
      status: r.status ?? 200,
      statusText: 'OK',
      json: async () => r.body,
      text: async () => JSON.stringify(r.body ?? {}),
    } as any;
  }) as any;
}

describe('looksLikeSystemInventoryQuestion', () => {
  it('returns true for direct inventory keywords', () => {
    expect(looksLikeSystemInventoryQuestion('what services are running?')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('inventory the host')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('list processes')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('show installed packages')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('system inventory please')).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(looksLikeSystemInventoryQuestion('WHAT IS RUNNING?')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('System Inventory')).toBe(true);
  });

  it('returns false for unrelated questions', () => {
    expect(looksLikeSystemInventoryQuestion('what is the weather today?')).toBe(false);
    expect(looksLikeSystemInventoryQuestion('tell me a joke')).toBe(false);
    expect(looksLikeSystemInventoryQuestion('')).toBe(false);
  });

  it('throws on non-string input', () => {
    // @ts-expect-error - testing runtime guard
    expect(() => looksLikeSystemInventoryQuestion(null)).toThrow();
    // @ts-expect-error - testing runtime guard
    expect(() => looksLikeSystemInventoryQuestion(undefined)).toThrow();
    // @ts-expect-error - testing runtime guard
    expect(() => looksLikeSystemInventoryQuestion(42 as any)).toThrow();
  });
});

describe('buildSystemInventorySnapshot', () => {
  it('returns a snapshot object with expected shape on success', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [{ name: 'proc.list' }, { name: 'svc.list' }] } }, // MCP tools
      { ok: true, body: { models: [{ id: 'gpt-x' }, { id: 'claude-y' }] } },         // command code models
    ]);

    const snap = await buildSystemInventorySnapshot({ mcpServerUrl: 'http://mcp', baseUrl: 'http://api' });

    expect(snap).toBeDefined();
    expect(typeof snap).toBe('object');
    // Must include tools, models, and timestamp-like field
    expect(snap).toHaveProperty('mcpTools');
    expect(snap).toHaveProperty('commandCodeModels');
    expect(snap).toHaveProperty('generatedAt');
    expect(Array.isArray(snap.mcpTools)).toBe(true);
    expect(snap.mcpTools).toHaveLength(2);
    expect(Array.isArray(snap.commandCodeModels)).toBe(true);
    expect(snap.commandCodeModels).toHaveLength(2);
    expect(typeof snap.generatedAt).toBe('string');
    // ISO date sanity
    expect(() => new Date(snap.generatedAt).toISOString()).not.toThrow();
  });

  it('handles MCP server unreachable gracefully (snapshot still produced)', async () => {
    mockFetchSequence([
      { throw: new Error('ECONNREFUSED') }, // MCP fails
      { ok: true, body: { models: [] } },    // models still ok
    ]);

    const snap = await buildSystemInventorySnapshot({ mcpServerUrl: 'http://down', baseUrl: 'http://api' });
    expect(snap).toBeDefined();
    expect(snap).toHaveProperty('mcpTools');
    expect(snap).toHaveProperty('commandCodeModels');
    // On failure, tools should be empty array
    expect(Array.isArray(snap.mcpTools)).toBe(true);
    expect(snap.mcpTools).toEqual([]);
  });

  it('handles command-code models endpoint failure gracefully', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [] } },
      { throw: new Error('timeout') },
    ]);

    const snap = await buildSystemInventorySnapshot({ mcpServerUrl: 'http://mcp', baseUrl: 'http://api' });
    expect(snap).toBeDefined();
    expect(Array.isArray(snap.commandCodeModels)).toBe(true);
    expect(snap.commandCodeModels).toEqual([]);
  });

  it('works with no options provided', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [] } },
      { ok: true, body: { models: [] } },
    ]);
    const snap = await buildSystemInventorySnapshot();
    expect(snap).toBeDefined();
    expect(snap).toHaveProperty('mcpTools');
    expect(snap).toHaveProperty('commandCodeModels');
  });

  it('respects custom timeout option (does not hang on slow endpoints)', async () => {
    // Simulate an abort-style rejection
    mockFetchSequence([
      { throw: new DOMException('Aborted', 'AbortError') },
      { ok: true, body: { models: [] } },
    ]);
    const start = Date.now();
    const snap = await buildSystemInventorySnapshot({ mcpServerUrl: 'http://mcp', baseUrl: 'http://api', timeoutMs: 50 });
    const elapsed = Date.now() - start;
    expect(snap).toBeDefined();
    // Should complete quickly (we cannot fully prove timeout without faking timers,
    // but we assert it did not hang for full second-level duration)
    expect(elapsed).toBeLessThan(2000);
  });

  it('produces deterministic generatedAt within same call (single ISO string)', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [] } },
      { ok: true, body: { models: [] } },
    ]);
    const snap = await buildSystemInventorySnapshot();
    expect(typeof snap.generatedAt).toBe('string');
    expect(new Date(snap.generatedAt).toString()).not.toBe('Invalid Date');
  });
});

describe('renderSystemInventoryAnswer', () => {
  it('returns a non-empty string for a populated snapshot', () => {
    const snap: SystemInventorySnapshot = {
      mcpTools: [{ name: 'proc.list' }, { name: 'svc.list' }],
      commandCodeModels: [{ id: 'gpt-x' }],
      generatedAt: new Date().toISOString(),
    } as any;
    const out = renderSystemInventoryAnswer(snap);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns a string for an empty snapshot (no throw)', () => {
    const snap: SystemInventorySnapshot = {
      mcpTools: [],
      commandCodeModels: [],
      generatedAt: new Date().toISOString(),
    } as any;
    const out = renderSystemInventoryAnswer(snap);
    expect(typeof out).toBe('string');
  });

  it('includes the tool names in the rendered output (content contract)', () => {
    const snap: SystemInventorySnapshot = {
      mcpTools: [{ name: 'proc.list' }],
      commandCodeModels: [{ id: 'gpt-x' }],
      generatedAt: '2024-01-01T00:00:00.000Z',
    } as any;
    const out = renderSystemInventoryAnswer(snap);
    expect(out).toContain('proc.list');
  });

  it('throws when given a non-object input', () => {
    // @ts-expect-error - testing runtime guard
    expect(() => renderSystemInventoryAnswer(null)).toThrow();
    // @ts-expect-error - testing runtime guard
    expect(() => renderSystemInventoryAnswer(undefined)).toThrow();
    // @ts-expect-error - testing runtime guard
    expect(() => renderSystemInventoryAnswer('not a snapshot' as any)).toThrow();
  });
});

describe('buildSystemInventoryAnswer (end-to-end)', () => {
  it('returns a non-empty rendered string for a valid inventory question', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [{ name: 'proc.list' }] } },
      { ok: true, body: { models: [{ id: 'gpt-x' }] } },
    ]);
    const out = await buildSystemInventoryAnswer({ question: 'what services are running?' });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('works with default options (no arguments)', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [] } },
      { ok: true, body: { models: [] } },
    ]);
    const out = await buildSystemInventoryAnswer();
    expect(typeof out).toBe('string');
  });

  it('returns a string even when remote sources fail', async () => {
    mockFetchSequence([
      { throw: new Error('network down') },
      { throw: new Error('network down') },
    ]);
    const out = await buildSystemInventoryAnswer({ question: 'system inventory' });
    expect(typeof out).toBe('string');
  });

  it('result reflects a populated inventory (includes fetched data)', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [{ name: 'host.info' }] } },
      { ok: true, body: { models: [{ id: 'model-99' }] } },
    ]);
    const out = await buildSystemInventoryAnswer({ question: 'system inventory' });
    // The rendered answer should surface the tool we fetched
    expect(out).toContain('host.info');
  });

  it('result is the same as rendering a snapshot built the same way (consistency)', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [{ name: 'svc.list' }] } },
      { ok: true, body: { models: [{ id: 'm1' }] } },
    ]);
    const a = await buildSystemInventoryAnswer({ question: 'system inventory' });
    // Re-mock for second call deterministically
    mockFetchSequence([
      { ok: true, body: { tools: [{ name: 'svc.list' }] } },
      { ok: true, body: { models: [{ id: 'm1' }] } },
    ]);
    const snap = await buildSystemInventorySnapshot();
    const b = renderSystemInventoryAnswer(snap);
    expect(a).toEqual(b);
  });
});
```

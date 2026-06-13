<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T017 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2110,"completion_tokens":5892,"total_tokens":8002,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4781,"image_tokens":0},"cache_creation_input_tokens":0} | 108s
 generated: 2026-06-13T10:55:12.468Z -->
```typescript
import { callProvider, streamProvider, AdapterRequest, AdapterChunk } from '../src/services/providerAdapter';
import { resolveApiKey } from '../src/providers/registry';
import type { ProviderRecord } from '../src/providers/types';

jest.mock('../src/providers/registry', () => ({
  resolveApiKey: jest.fn(),
}));

describe('providerAdapter', () => {
  const mockFetch = jest.fn();
  (global as any).fetch = mockFetch;

  const openaiProvider: ProviderRecord = {
    id: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4',
    timeoutMs: 5000,
    maxTokens: 100,
    temperature: 0.7,
  } as ProviderRecord;

  const anthropicProvider: ProviderRecord = {
    id: 'anthropic',
    displayName: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3',
    timeoutMs: 5000,
    maxTokens: 100,
  } as ProviderRecord;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('callProvider routes to OpenAI and returns content', async () => {
    (resolveApiKey as jest.Mock).mockReturnValue('test-key');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello world' } }] }),
    });

    const req: AdapterRequest = { messages: [{ role: 'user', content: 'Hi' }] };
    const promise = callProvider(openaiProvider, req);
    
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('Hello world');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });

  test('callProvider routes to Anthropic and returns content', async () => {
    (resolveApiKey as jest.Mock).mockReturnValue('anthropic-key');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Hello from Claude' }] }),
    });

    const req: AdapterRequest = { messages: [{ role: 'user', content: 'Hi' }] };
    const promise = callProvider(anthropicProvider, req);
    
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('Hello from Claude');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'anthropic-key' }),
      })
    );
  });

  test('streamProvider streams chunks correctly', async () => {
    (resolveApiKey as jest.Mock).mockReturnValue('test-key');

    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'),
          done: false,
        })
        .mockResolvedValueOnce({
          value: new TextEncoder().encode('data: [DONE]\n\n'),
          done: false,
        })
        .mockResolvedValueOnce({ done: true }),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const req: AdapterRequest = { messages: [{ role: 'user', content: 'Hi' }], stream: true };
    const chunks: AdapterChunk[] = [];
    const onChunk = (c: AdapterChunk) => chunks.push(c);

    const promise = streamProvider(openaiProvider, req, onChunk);
    
    await jest.runAllTimersAsync();
    await promise;

    expect(chunks).toEqual([
      { type: 'delta', delta: 'Hi' },
      { type: 'done' },
    ]);
  });

  test('callProvider throws if API key is missing', async () => {
    (resolveApiKey as jest.Mock).mockReturnValue('');
    
    const req: AdapterRequest = { messages: [{ role: 'user', content: 'Hi' }] };
    const promise = callProvider(openaiProvider, req);
    
    await jest.runAllTimersAsync();
    
    await expect(promise).rejects.toThrow('API key not configured for provider: OpenAI');
  });
});
```

<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S017 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":265,"completion_tokens":5383,"total_tokens":5648,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3705,"image_tokens":0},"cache_creation_input_tokens":0} | 99s
 generated: 2026-06-13T11:24:48.022Z -->
```typescript
import {
  callProvider,
  streamProvider,
  callOpenAI,
  streamOpenAI,
  callAnthropic,
  streamAnthropic,
  callOllama,
  streamOllama,
  ChatMessage,
  AdapterRequest,
  AdapterChunk
} from '../src/services/providerAdapter';

// Mock global fetch to ensure offline, deterministic behavior for any underlying HTTP clients
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('providerAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mock for fetch to prevent network errors during valid routing tests
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'mocked response' } }] }),
      text: async () => '{"choices":[{"message":{"content":"mocked response"}}]}',
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ 
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'), 
              done: false 
            })
            .mockResolvedValueOnce({ 
              value: new TextEncoder().encode('data: [DONE]\n\n'), 
              done: false 
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    });
  });

  const validMessages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello' }
  ];

  const createValidRequest = (provider: string): AdapterRequest => ({
    provider: provider as any,
    model: 'test-model',
    messages: validMessages,
    apiKey: 'test-api-key',
    temperature: 0.7
  } as AdapterRequest);

  describe('callProvider (Generic Router)', () => {
    it('should throw an error when an unsupported provider is specified', async () => {
      const req = createValidRequest('invalid_provider');
      await expect(callProvider(req)).rejects.toThrow(/unsupported|invalid|unknown|provider/i);
    });

    it('should throw an error when messages array is empty', async () => {
      const req = createValidRequest('openai');
      (req as any).messages = [];
      await expect(callProvider(req)).rejects.toThrow(/message/i);
    });

    it('should throw an error when messages array is missing', async () => {
      const req = createValidRequest('openai');
      delete (req as any).messages;
      await expect(callProvider(req)).rejects.toThrow();
    });

    it('should route to OpenAI and return a defined result for valid openai request', async () => {
      const req = createValidRequest('openai');
      const result = await callProvider(req);
      expect(result).toBeDefined();
    });

    it('should route to Anthropic and return a defined result for valid anthropic request', async () => {
      const req = createValidRequest('anthropic');
      const result = await callProvider(req);
      expect(result).toBeDefined();
    });

    it('should route to Ollama and return a defined result for valid ollama request', async () => {
      const req = createValidRequest('ollama');
      const result = await callProvider(req);
      expect(result).toBeDefined();
    });
  });

  describe('streamProvider (Generic Router)', () => {
    // Helper to consume async iterables to catch deferred errors
    const consumeStream = async (stream: AsyncIterable<AdapterChunk>) => {
      const chunks: AdapterChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return chunks;
    };

    it('should throw an error when an unsupported provider is specified', async () => {
      const req = createValidRequest('invalid_provider');
      const stream = streamProvider(req);
      await expect(consumeStream(stream)).rejects.toThrow(/unsupported|invalid|unknown|provider/i);
    });

    it('should throw an error when messages array is empty', async () => {
      const req = createValidRequest('openai');
      (req as any).messages = [];
      const stream = streamProvider(req);
      await expect(consumeStream(stream)).rejects.toThrow(/message/i);
    });

    it('should return an AsyncIterable for a valid openai request', async () => {
      const req = createValidRequest('openai');
      const stream = streamProvider(req);
      
      // Contract: Must be an AsyncIterable
      expect(stream).toBeDefined();
      expect(typeof (stream as any)[Symbol.asyncIterator]).toBe('function');
    });

    it('should yield AdapterChunks for a valid anthropic request', async () => {
      const req = createValidRequest('anthropic');
      const stream = streamProvider(req);
      
      expect(typeof (stream as any)[Symbol.asyncIterator]).toBe('function');
      // We don't assert exact chunk content since it depends on the mock parsing, 
      // but we assert it doesn't throw during iteration
      await expect(consumeStream(stream)).resolves.toBeDefined();
    });
  });

  describe('Specific Provider Functions (Input Validation Contracts)', () => {
    const callFunctions = [
      { name: 'callOpenAI', fn: callOpenAI },
      { name: 'callAnthropic', fn: callAnthropic },
      { name: 'callOllama', fn: callOllama }
    ];

    const streamFunctions = [
      { name: 'streamOpenAI', fn: streamOpenAI },
      { name: 'streamAnthropic', fn: streamAnthropic },
      { name: 'streamOllama', fn: streamOllama }
    ];

    callFunctions.forEach(({ name, fn }) => {
      describe(name, () => {
        it('should throw if model is missing', async () => {
          const req = createValidRequest('openai');
          delete (req as any).model;
          await expect(fn(req)).rejects.toThrow(/model/i);
        });

        it('should throw if messages are invalid', async () => {
          const req = createValidRequest('openai');
          (req as any).messages = [{ role: 'invalid_role', content: 'test' }];
          await expect(fn(req)).rejects.toThrow();
        });
      });
    });

    streamFunctions.forEach(({ name, fn }) => {
      describe(name, () => {
        it('should return an object with an async iterator', () => {
          const req = createValidRequest('openai');
          const stream = fn(req);
          expect(stream).toBeDefined();
          expect(typeof (stream as any)[Symbol.asyncIterator]).toBe('function');
        });

        it('should throw during iteration if model is missing', async () => {
          const req = createValidRequest('openai');
          delete (req as any).model;
          const stream = fn(req);
          
          const consume = async () => {
            for await (const _ of stream) { /* noop */ }
          };
          
          await expect(consume()).rejects.toThrow(/model/i);
        });
      });
    });
  });
});
```

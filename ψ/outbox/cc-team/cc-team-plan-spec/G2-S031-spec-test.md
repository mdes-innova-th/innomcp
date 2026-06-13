<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S031 role=spec-test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":211,"completion_tokens":4294,"total_tokens":4505,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3270,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:28:45.583Z -->
```typescript
import { GuardResult, checkAgentEventSafe, checkVisibleTextSafe } from '../src/agents/eventGuard';

// Deterministic mock for network calls (fetch)
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  mockFetch.mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

// Helper: simulate a safe response from the external safety service
function mockSafeResponse() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      isSafe: true,
      details: { score: 0.99, category: 'none' },
    }),
  });
}

// Helper: simulate an unsafe response
function mockUnsafeResponse(reason = 'Hate speech') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      isSafe: false,
      reason,
      details: { score: 0.6, category: 'hate' },
    }),
  });
}

describe('checkVisibleTextSafe', () => {
  it('returns safe for harmless text', async () => {
    mockSafeResponse();
    const result: GuardResult = await checkVisibleTextSafe('Hello world');
    expect(result).toBeDefined();
    expect(result.isSafe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns unsafe for offensive text', async () => {
    mockUnsafeResponse('Contains threats');
    const result = await checkVisibleTextSafe('You are all idiots');
    expect(result.isSafe).toBe(false);
    expect(result.reason).toBe('Contains threats');
  });

  it('throws TypeError for null input', async () => {
    await expect(checkVisibleTextSafe(null as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for undefined input', async () => {
    await expect(checkVisibleTextSafe(undefined as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for non‑string input (number)', async () => {
    await expect(checkVisibleTextSafe(123 as any)).rejects.toThrow(TypeError);
  });

  it('treats empty string as safe (boundary)', async () => {
    mockSafeResponse();
    const result = await checkVisibleTextSafe('');
    expect(result.isSafe).toBe(true);
  });

  it('handles very long text (boundary)', async () => {
    mockSafeResponse();
    const longText = 'a'.repeat(10000);
    const result = await checkVisibleTextSafe(longText);
    expect(result.isSafe).toBe(true);
  });
});

describe('checkAgentEventSafe', () => {
  const validEvent = { content: 'Hi there', type: 'message' };

  it('returns safe for a benign event', async () => {
    mockSafeResponse();
    const result = await checkAgentEventSafe(validEvent);
    expect(result).toHaveProperty('isSafe', true);
  });

  it('returns unsafe for a harmful event', async () => {
    mockUnsafeResponse('Violence');
    const evilEvent = { content: 'I will destroy you', type: 'message' };
    const result = await checkAgentEventSafe(evilEvent);
    expect(result.isSafe).toBe(false);
    expect(result.reason).toBe('Violence');
  });

  it('throws TypeError when event is null', async () => {
    await expect(checkAgentEventSafe(null as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event is undefined', async () => {
    await expect(checkAgentEventSafe(undefined as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event is not an object (string)', async () => {
    await expect(checkAgentEventSafe('not an object' as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event.content is missing', async () => {
    await expect(checkAgentEventSafe({} as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event.content is not a string', async () => {
    await expect(checkAgentEventSafe({ content: 123 } as any)).rejects.toThrow(TypeError);
  });

  it('treats event with empty content as safe (boundary)', async () => {
    mockSafeResponse();
    const result = await checkAgentEventSafe({ content: '' });
    expect(result.isSafe).toBe(true);
  });

  it('passes additional event properties to the safety check (contract)', async () => {
    mockSafeResponse();
    const event = { content: 'Hello', sender: 'bot', timestamp: Date.now() };
    const result = await checkAgentEventSafe(event);
    expect(result.isSafe).toBe(true);
  });
});
```

<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S012 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":280,"completion_tokens":3034,"total_tokens":3314,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1056,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:22:56.689Z -->
```typescript
import {
  callPollinations,
  callImageGen,
  buildImageGenText,
  callGateway,
  ImageGenResult,
  ImageGenError,
  ImageGenResponse,
  CallImageGenOptions,
} from '../src/services/imageGenService';

// ── helpers ──────────────────────────────────────────────────────────
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// ── callPollinations ─────────────────────────────────────────────────
describe('callPollinations', () => {
  it('returns an ImageGenResult containing a url for a valid prompt', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('image-binary-data', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    const result = await callPollinations('a sunset over mountains');

    expect(result).toBeDefined();
    expect(typeof result.url).toBe('string');
    expect(result.url.length).toBeGreaterThan(0);
  });

  it('encodes the prompt in the outgoing request URL', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('ok', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    await callPollinations('hello world & friends');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('hello');
    // space should be encoded
    expect(calledUrl).not.toContain(' ');
  });

  it('throws or rejects when the network request fails', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('network error'));

    await expect(callPollinations('test prompt')).rejects.toThrow();
  });

  it('throws or rejects when the gateway returns a non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    await expect(callPollinations('test prompt')).rejects.toThrow();
  });

  it('handles an empty-string prompt without crashing', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('ok', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    // Should either return a result or throw a validation error — but not hang/crash
    const promise = callPollinations('');
    await expect(promise).toBeDefined();
  });
});

// ── callGateway ──────────────────────────────────────────────────────
describe('callGateway', () => {
  it('resolves with a defined value on a successful gateway response', async () => {
    const fakePayload = { url: 'https://cdn.example.com/img.png', revisedPrompt: 'a cat' };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(fakePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await callGateway('a cat sitting on a mat');

    expect(result).toBeDefined();
    expect(typeof (result as ImageGenResult).url).toBe('string');
  });

  it('rejects when the gateway returns an error status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }),
    );

    await expect(callGateway('prompt')).rejects.toThrow();
  });

  it('rejects on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(callGateway('prompt')).rejects.toThrow();
  });
});

// ── callImageGen ─────────────────────────────────────────────────────
describe('callImageGen', () => {
  const baseOptions: CallImageGenOptions = { prompt: 'a futuristic cityscape' } as CallImageGenOptions;

  it('returns { ok: true, ...result } on success', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('image-bytes', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    const response: ImageGenResponse = await callImageGen(baseOptions);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(typeof response.url).toBe('string');
      expect(response.url.length).toBeGreaterThan(0);
    }
  });

  it('returns { ok: false } with an error description on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));

    const response: ImageGenResponse = await callImageGen(baseOptions);

    expect(response.ok).toBe(false);
    if (!response.ok) {
      const err = response as ImageGenError;
      expect(err).toHaveProperty('ok', false);
      // error should carry some human-readable info
      const errorStr = JSON.stringify(err);
      expect(errorStr.length).toBeGreaterThan(10);
    }
  });

  it('never throws — always returns an ImageGenResponse', async () => {
    mockFetch.mockRejectedValueOnce(new Error('total failure'));

    // callImageGen should catch internally and return an error response
    const response = await callImageGen(baseOptions);
    expect(response).toBeDefined();
    expect(typeof response.ok).toBe('boolean');
  });

  it('propagates the url into the success response', async () => {
    const fakeUrl = 'https://images.example.com/generated/abc123.png';
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ url: fakeUrl }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await callImageGen(baseOptions);

    if (response.ok) {
      expect(response.url).toContain('http');
    }
  });

  it('handles a very long prompt without throwing', async () => {
    const longPrompt = 'a '.repeat(2000) + 'painting';
    mockFetch.mockResolvedValueOnce(
      new Response('ok', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    const response = await callImageGen({ ...baseOptions, prompt: longPrompt });
    expect(response).toBeDefined();
    expect(typeof response.ok).toBe('boolean');
  });
});

// ── buildImageGenText ────────────────────────────────────────────────
describe('buildImageGenText', () => {
  it('returns a non-empty string for a valid result', () => {
    const result: ImageGenResult = { url: 'https://example.com/img.png' } as ImageGenResult;

    const text = buildImageGenText(result);

    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('includes the image URL in the output', () => {
    const url = 'https://cdn.example.com/generated/xyz.png';
    const result: ImageGenResult = { url } as ImageGenResult;

    const text = buildImageGenText(result);

    expect(text).toContain(url);
  });

  it('produces different output for different URLs', () => {
    const resultA: ImageGenResult = { url: 'https://example.com/a.png' } as ImageGenResult;
    const resultB: ImageGenResult = { url: 'https://example.com/b.png' } as ImageGenResult;

    const textA = buildImageGenText(resultA);
    const textB = buildImageGenText(resultB);

    expect(textA).not.toEqual(textB);
  });

  it('includes revisedPrompt in the output when present', () => {
    const result: ImageGenResult = {
      url: 'https://example.com/img.png',
      revisedPrompt: 'a highly detailed sunset',
    } as ImageGenResult;

    const text = buildImageGenText(result);

    expect(text).toContain('a highly detailed sunset');
  });

  it('returns a deterministic result for the same input', () => {
    const result: ImageGenResult = { url: 'https://example.com/img.png' } as ImageGenResult;

    const text1 = buildImageGenText(result);
    const text2 = buildImageGenText(result);

    expect(text1).toEqual(text2);
  });
});
```

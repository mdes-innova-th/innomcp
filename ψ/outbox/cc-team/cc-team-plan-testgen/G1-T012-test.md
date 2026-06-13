<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T012 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2293,"completion_tokens":6317,"total_tokens":8610,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4866,"image_tokens":0},"cache_creation_input_tokens":0} | 117s
 generated: 2026-06-13T10:54:13.973Z -->
```typescript
import { callImageGen, ImageGenResponse } from '../src/services/imageGenService';

jest.mock('../src/utils/mcpLogger', () => ({
  logBoth: jest.fn(),
}));

describe('imageGenService', () => {
  const originalEnv = process.env;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...originalEnv };
    process.env.IMAGE_GEN_GATEWAY_URL = 'http://gateway.test/api';
    process.env.IMAGE_GEN_GATEWAY_TOKEN = 'secret-token';
    process.env.IMAGE_GEN_TIMEOUT_MS = '1000';

    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  const createMockResponse = (options: {
    ok?: boolean;
    status?: number;
    contentType?: string;
    jsonBody?: any;
    arrayBufferBody?: ArrayBuffer;
    textBody?: string;
  }) => {
    const {
      ok = true,
      status = 200,
      contentType = 'application/json',
      jsonBody,
      arrayBufferBody,
      textBody = '',
    } = options;
    return {
      ok,
      status,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? contentType : null,
      },
      json: jest.fn().mockResolvedValue(jsonBody),
      arrayBuffer: jest.fn().mockResolvedValue(arrayBufferBody || new ArrayBuffer(0)),
      text: jest.fn().mockResolvedValue(textBody),
    };
  };

  test('calls gateway and returns JSON URL', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        contentType: 'application/json',
        jsonBody: { url: 'http://img.test/1.png', model: 'sd-xl' },
      })
    );

    const res = await callImageGen('generate image of a cat');

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe('gateway');
      expect(res.url).toBe('http://img.test/1.png');
      expect(res.model).toBe('sd-xl');
      expect(res.provider).toBe('MDES Gateway');
      expect(res.prompt).toBe('of a cat');
      expect(res.originalPrompt).toBe('generate image of a cat');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('calls gateway and returns raw image bytes as base64', async () => {
    const buffer = new Uint8Array([137, 80, 78, 71]).buffer;
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        contentType: 'image/png',
        arrayBufferBody: buffer,
      })
    );

    const res = await callImageGen('generate image of a dog');

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe('gateway');
      expect(res.base64).toBe(Buffer.from(buffer).toString('base64'));
      expect(res.url).toContain('data:image/png;base64,');
      expect(res.prompt).toBe('of a dog');
    }
  });

  test('falls back to Pollinations when gateway fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, status: 200 }));

    const res = await callImageGen('สร้างรูป แมว');

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe('pollinations');
      expect(res.provider).toBe('Pollinations.ai');
      expect(res.model).toBe('flux');
      expect(res.prompt).toBe('แมว');
      expect(res.originalPrompt).toBe('สร้างรูป แมว');
      expect(res.url).toContain('image.pollinations.ai');
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('uses Pollinations directly when no gateway URL is set', async () => {
    delete process.env.IMAGE_GEN_GATEWAY_URL;
    mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, status: 200 }));

    const res = await callImageGen('a beautiful sunset', {
      adaptedPromptEn: 'sunset, beautiful, 4k',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe('pollinations');
      expect(res.prompt).toBe('sunset, beautiful, 4k');
      expect(res.originalPrompt).toBe('a beautiful sunset');
    }
    
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent('sunset, beautiful, 4k'));
  });

  test('falls back to Pollinations when gateway returns HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 500,
        textBody: 'Internal Server Error',
      })
    );
    mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, status: 200 }));

    const res = await callImageGen('create picture of a car');

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe('pollinations');
      expect(res.prompt).toBe('of a car');
    }
  });

  test('handles gateway JSON response with nested data array', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        contentType: 'application/json',
        jsonBody: { data: [{ url: 'http://img.test/nested.png', b64_json: 'abc123' }] },
      })
    );

    const res = await callImageGen('generate image of a bird');

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe('gateway');
      expect(res.url).toBe('http://img.test/nested.png');
      expect(res.base64).toBe('abc123');
    }
  });
});
```

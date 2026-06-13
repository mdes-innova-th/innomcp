<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T074 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":829,"completion_tokens":7283,"total_tokens":8112,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6592,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T11:07:31.861Z -->
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/providerTest';
import { getProvider } from '../src/providers/registry';
import { callProvider } from '../src/services/providerAdapter';

jest.mock('../src/providers/registry');
jest.mock('../src/services/providerAdapter');

const mockGetProvider = getProvider as jest.MockedFunction<typeof getProvider>;
const mockCallProvider = callProvider as jest.MockedFunction<typeof callProvider>;

describe('POST /api/providers/test-call', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/providers/test-call', router);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));
    mockGetProvider.mockReset();
    mockCallProvider.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns 400 if providerId is missing', async () => {
    const res = await request(app).post('/api/providers/test-call').send({ message: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'providerId is required (string)' });
  });

  test('returns 400 if providerId is empty string', async () => {
    const res = await request(app).post('/api/providers/test-call').send({ providerId: '  ', message: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'providerId is required (string)' });
  });

  test('returns 400 if message is missing', async () => {
    const res = await request(app).post('/api/providers/test-call').send({ providerId: 'test' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'message is required (string)' });
  });

  test('returns 400 if message is empty string', async () => {
    const res = await request(app).post('/api/providers/test-call').send({ providerId: 'test', message: '  ' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'message is required (string)' });
  });

  test('returns 404 if provider is not found', async () => {
    mockGetProvider.mockReturnValue(undefined);
    const res = await request(app).post('/api/providers/test-call').send({ providerId: 'unknown', message: 'hello' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'provider not found: unknown' });
  });

  test('returns 400 if provider is disabled', async () => {
    mockGetProvider.mockReturnValue({ id: 'test', enabled: false, displayName: 'Test Provider' });
    const res = await request(app).post('/api/providers/test-call').send({ providerId: 'test', message: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'provider is disabled: Test Provider' });
  });

  test('returns 200 and response on success', async () => {
    const provider = { id: 'test', enabled: true, displayName: 'Test Provider' };
    mockGetProvider.mockReturnValue(provider);
    mockCallProvider.mockImplementation(async () => {
      jest.advanceTimersByTime(250);
      return 'Hello!';
    });

    const res = await request(app).post('/api/providers/test-call').send({ providerId: ' test ', message: '  hi  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ response: 'Hello!', durationMs: 250 });
    expect(mockCallProvider).toHaveBeenCalledWith(provider, {
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  test('returns 502 and error message on callProvider failure (Error)', async () => {
    const provider = { id: 'test', enabled: true, displayName: 'Test Provider' };
    mockGetProvider.mockReturnValue(provider);
    mockCallProvider.mockImplementation(async () => {
      jest.advanceTimersByTime(100);
      throw new Error('Network error');
    });

    const res = await request(app).post('/api/providers/test-call').send({ providerId: 'test', message: 'hello' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Network error', durationMs: 100 });
  });

  test('returns 502 and stringified error on callProvider failure (non-Error)', async () => {
    const provider = { id: 'test', enabled: true, displayName: 'Test Provider' };
    mockGetProvider.mockReturnValue(provider);
    mockCallProvider.mockImplementation(async () => {
      jest.advanceTimersByTime(50);
      throw 'string error'; // eslint-disable-line no-throw-literal
    });

    const res = await request(app).post('/api/providers/test-call').send({ providerId: 'test', message: 'hello' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'string error', durationMs: 50 });
  });
});
```

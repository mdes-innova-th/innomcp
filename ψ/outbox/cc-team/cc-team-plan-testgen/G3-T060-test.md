<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T060 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1567,"completion_tokens":2299,"total_tokens":3866,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T11:03:33.615Z -->
```typescript
import express from 'express';
import router from '../src/routes/api/modelSettings';

describe('modelSettings router', () => {
  let app: express.Express;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    app = express();
    app.use(express.json());
    app.use('/api/model-settings', router);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    fetchMock.mockRestore();
  });

  describe('GET /api/model-settings/providers', () => {
    test('returns preset provider list', async () => {
      const res = await request(app).get('/api/model-settings/providers');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.providers)).toBe(true);
      expect(res.body.providers).toHaveLength(6);

      const ids = res.body.providers.map((p: { id: string }) => p.id);
      expect(ids).toEqual(['mdes', 'ollama', 'lmstudio', 'vllm', 'openai', 'custom']);

      const ollama = res.body.providers.find((p: { id: string }) => p.id === 'ollama');
      expect(ollama).toMatchObject({
        id: 'ollama',
        label: 'Ollama (Local)',
        defaultUrl: 'http://localhost:11434/v1',
        needsKey: false,
        defaultModel: 'llama3.2:latest',
      });

      const openai = res.body.providers.find((p: { id: string }) => p.id === 'openai');
      expect(openai).toMatchObject({
        needsKey: true,
        defaultUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
      });
    });
  });

  describe('POST /api/model-settings/test', () => {
    test('returns 400 when baseUrl is missing', async () => {
      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ modelName: 'foo' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'baseUrl and modelName are required' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('returns 400 when modelName is missing', async () => {
      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'https://api.example.com/v1' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'baseUrl and modelName are required' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('returns 400 when both baseUrl and modelName are missing', async () => {
      const res = await request(app)
        .post('/api/model-settings/test')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'baseUrl and modelName are required' });
    });

    test('posts to /chat/completions and returns success on 2xx', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Hello there, friend!' } }],
        }),
        text: async () => '',
      } as unknown as Response);

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'sk-test',
          modelName: 'gpt-4o-mini',
          provider: 'openai',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.model).toBe('gpt-4o-mini');
      expect(res.body.sample).toBe('Hello there, friend!');
      expect(typeof res.body.latencyMs).toBe('number');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/v1/chat/completions');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('Bearer sk-test');
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      });
    });

    test('omits Authorization header when apiKey is not provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        text: async () => '',
      } as unknown as Response);

      await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'http://localhost:11434/v1', modelName: 'llama3.2' });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');
    });

    test('strips trailing slash from baseUrl before composing endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'hi' } }] }),
        text: async () => '',
      } as unknown as Response);

      await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'https://api.example.com/v1/', modelName: 'm' });

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/v1/chat/completions');
    });

    test('truncates sample content to 60 chars', async () => {
      const longContent = 'x'.repeat(200);
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: longContent } }] }),
        text: async () => '',
      } as unknown as Response);

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'https://api.example.com/v1', modelName: 'm' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sample).toHaveLength(60);
    });

    test('returns success with empty sample when choices missing', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '',
      } as unknown as Response);

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'https://api.example.com/v1', modelName: 'm' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sample).toBe('');
    });

    test('returns failure result on non-2xx response with body excerpt', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => 'unauthorized',
      } as unknown as Response);

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'bad',
          modelName: 'm',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('HTTP 401: unauthorized');
      expect(typeof res.body.latencyMs).toBe('number');
    });

    test('truncates long error body to 120 chars on non-2xx', async () => {
      const longBody = 'e'.repeat(500);
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => longBody,
      } as unknown as Response);

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'https://api.example.com/v1', modelName: 'm' });

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe(`HTTP 500: ${'e'.repeat(120)}`);
    });

    test('returns failure when fetch throws (network error)', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'http://localhost:11434/v1', modelName: 'm' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ECONNREFUSED');
      expect(typeof res.body.latencyMs).toBe('number');
    });

    test('returns failure when fetch throws a non-Error value', async () => {
      fetchMock.mockRejectedValue('string-error');

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'http://localhost:11434/v1', modelName: 'm' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('string-error');
    });

    test('truncates long error message to 120 chars', async () => {
      fetchMock.mockRejectedValue(new Error('a'.repeat(500)));

      const res = await request(app)
        .post('/api/model-settings/test')
        .send({ baseUrl: 'http://localhost:11434/v1', modelName: 'm' });

      expect(res.body.success).toBe(false);
      expect(res.body.error).toHaveLength(120);
    });
  });
});
```

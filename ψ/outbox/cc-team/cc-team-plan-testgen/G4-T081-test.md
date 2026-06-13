<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: T081 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":826,"completion_tokens":1445,"total_tokens":2271,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":547,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T11:08:25.011Z -->
```typescript
import webFetchRouter from '../src/routes/api/webFetch';
import { webFetch } from '../src/services/webFetchTool';
import express from 'express';
import request from 'supertest';

jest.mock('../src/services/webFetchTool', () => ({
  webFetch: jest.fn(),
}));

const mockedWebFetch = webFetch as jest.MockedFunction<typeof webFetch>;

describe('webFetch router', () => {
  let app: express.Express;

  beforeAll(() => {
    // Set a deterministic workspace root for tests
    process.env.WORKSPACE_ROOT = '/tmp/test-workspace';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/fetch', webFetchRouter);
  });

  afterAll(() => {
    delete process.env.WORKSPACE_ROOT;
  });

  test('POST /api/fetch returns 400 if url is missing', async () => {
    const res = await request(app)
      .post('/api/fetch')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'url required' });
  });

  test('POST /api/fetch returns 400 if url is not a string', async () => {
    const res = await request(app)
      .post('/api/fetch')
      .send({ url: 123 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'url required' });
  });

  test('POST /api/fetch returns 400 for malformed URL', async () => {
    const res = await request(app)
      .post('/api/fetch')
      .send({ url: 'not-a-valid-url' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid URL' });
  });

  test('POST /api/fetch calls webFetch with correct defaults and returns result', async () => {
    const mockResult = {
      url: 'https://example.com',
      title: 'Example',
      markdown: '# Example',
      wordCount: 10,
      fetchedAt: '2023-01-01T00:00:00.000Z',
      cached: false,
    };
    mockedWebFetch.mockResolvedValue(mockResult);

    const res = await request(app)
      .post('/api/fetch')
      .send({ url: 'https://example.com' });

    expect(mockedWebFetch).toHaveBeenCalledWith('https://example.com', {
      workspaceRoot: '/tmp/test-workspace',
      saveArtifact: true,
      timeoutMs: undefined,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
  });

  test('POST /api/fetch passes saveArtifact and timeoutMs when provided', async () => {
    const mockResult = {
      url: 'https://example.com',
      title: 'Test',
      markdown: 'test',
      wordCount: 1,
      fetchedAt: '2023-06-01T00:00:00.000Z',
      cached: true,
    };
    mockedWebFetch.mockResolvedValue(mockResult);

    const res = await request(app)
      .post('/api/fetch')
      .send({ url: 'https://example.com', saveArtifact: false, timeoutMs: 5000 });

    expect(mockedWebFetch).toHaveBeenCalledWith('https://example.com', {
      workspaceRoot: '/tmp/test-workspace',
      saveArtifact: false,
      timeoutMs: 5000,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
  });

  test('POST /api/fetch returns 400 when webFetch returns an error', async () => {
    mockedWebFetch.mockResolvedValue({ error: 'SSRF blocked' });

    const res = await request(app)
      .post('/api/fetch')
      .send({ url: 'http://internal.local' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'SSRF blocked' });
  });
});
```

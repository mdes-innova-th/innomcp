<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S054 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":180,"completion_tokens":4612,"total_tokens":4792,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4157,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 89s
 generated: 2026-06-13T11:36:42.930Z -->
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/debug';

// Deterministic mocks for system-level dependencies typically used by debug endpoints
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => JSON.stringify({ version: '1.0.0-test' })),
  existsSync: jest.fn(() => true),
}));

jest.mock('os', () => ({
  uptime: jest.fn(() => 99999),
  totalmem: jest.fn(() => 16384),
  freemem: jest.fn(() => 8192),
  cpus: jest.fn(() => []),
  loadavg: jest.fn(() => [1.0, 1.0, 1.0]),
  hostname: jest.fn(() => 'test-host'),
  type: jest.fn(() => 'TestOS'),
}));

describe('Debug API Router Contract', () => {
  const app = express();
  app.use(express.json());
  app.use('/debug', router);

  let originalUptime: () => number;

  beforeAll(() => {
    // Mock process.uptime deterministically as it's a common source of non-determinism
    originalUptime = process.uptime;
    process.uptime = jest.fn(() => 99999) as unknown as () => number;
  });

  afterAll(() => {
    process.uptime = originalUptime;
    jest.restoreAllMocks();
  });

  describe('GET /debug', () => {
    let response: request.Response;

    beforeAll(async () => {
      response = await request(app).get('/debug');
    });

    it('should respond with HTTP status 200', () => {
      expect(response.status).toBe(200);
    });

    it('should respond with Content-Type application/json', () => {
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should contain a status property indicating success', () => {
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should contain deterministic uptime information', () => {
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBe(99999);
    });

    it('should contain deterministic version information', () => {
      expect(response.body).toHaveProperty('version');
      expect(response.body.version).toBe('1.0.0-test');
    });

    it('should contain deterministic memory information', () => {
      expect(response.body).toHaveProperty('memory');
      expect(response.body.memory).toMatchObject({
        total: 16384,
        free: 8192,
      });
    });
  });

  describe('Unsupported HTTP methods', () => {
    it('should reject POST requests with 404 Not Found', async () => {
      const res = await request(app).post('/debug');
      expect(res.status).toBe(404);
    });

    it('should reject PUT requests with 404 Not Found', async () => {
      const res = await request(app).put('/debug');
      expect(res.status).toBe(404);
    });

    it('should reject DELETE requests with 404 Not Found', async () => {
      const res = await request(app).delete('/debug');
      expect(res.status).toBe(404);
    });
  });
});
```

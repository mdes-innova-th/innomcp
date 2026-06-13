<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S072 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":227,"completion_tokens":2272,"total_tokens":2499,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":719,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T11:44:04.756Z -->
```typescript
import request from 'supertest';
import express from 'express';
import axios from 'axios';
import {
  probeProvider,
  HealthResult,
  HealthStatus,
} from '../src/routes/api/providerHealth';
import router from '../src/routes/api/providerHealth';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('providerHealth module contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('probeProvider', () => {
    it('returns "healthy" status when provider responds with 2xx within acceptable time', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' },
      });

      const result: HealthResult = await probeProvider('https://api.example.com/health');

      expect(result).toEqual(
        expect.objectContaining({
          status: 'healthy',
          provider: 'https://api.example.com/health',
        })
      );
      expect(['healthy', 'degraded', 'down', 'unknown']).toContain(result.status);
      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('returns "down" status when provider responds with 5xx', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 503,
        data: null,
      });

      const result = await probeProvider('https://api.example.com/health');

      expect(result.status).toBe('down');
      expect(result.provider).toBe('https://api.example.com/health');
    });

    it('returns "down" status when provider request throws a network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await probeProvider('https://unreachable.example.com/health');

      expect(result.status).toBe('down');
      expect(result.provider).toBe('https://unreachable.example.com/health');
    });

    it('returns "down" status when provider request times out', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })
      );

      const result = await probeProvider('https://slow.example.com/health');

      expect(result.status).toBe('down');
    });

    it('returns "degraded" status when provider responds slowly but successfully', async () => {
      mockedAxios.get.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ status: 200, data: { status: 'ok' } }),
              2500
            )
          )
      );

      const result = await probeProvider('https://slow-but-alive.example.com/health');

      expect(['degraded', 'healthy']).toContain(result.status);
      expect(result.responseTime).toBeGreaterThanOrEqual(2000);
    });

    it('throws or returns "unknown" for an empty provider URL', async () => {
      const result = await probeProvider('');

      expect(['down', 'unknown']).toContain(result.status);
    });

    it('throws or returns "unknown" for a malformed provider URL', async () => {
      const result = await probeProvider('not-a-valid-url');

      expect(['down', 'unknown']).toContain(result.status);
    });

    it('includes a valid ISO timestamp in the result', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {},
      });

      const result = await probeProvider('https://api.example.com/health');

      expect(result.timestamp).toBeDefined();
      const parsed = new Date(result.timestamp as string);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it('returns a result whose status is strictly one of the HealthStatus union values', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

      const result = await probeProvider('https://api.example.com/health');
      const validStatuses: HealthStatus[] = ['healthy', 'degraded', 'down', 'unknown'];

      expect(validStatuses).toContain(result.status);
    });

    it('handles 4xx responses as "down" or "degraded" (provider misconfigured)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 404,
        data: null,
      });

      const result = await probeProvider('https://api.example.com/missing-endpoint');

      expect(['down', 'degraded', 'unknown']).toContain(result.status);
    });
  });

  describe('router (default export)', () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/', router);
    });

    it('is a valid Express router', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('exposes a GET health endpoint that returns JSON', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      const res = await request(app).get('/').expect('Content-Type', /json/);

      expect(res.status).toBeLessThan(500);
      expect(res.body).toBeDefined();
    });

    it('returns an array or object containing health results from the health endpoint', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      const res = await request(app).get('/');

      expect(res.status).toBeLessThan(500);
      const body = res.body;
      if (Array.isArray(body)) {
        body.forEach((item: HealthResult) => {
          expect(['healthy', 'degraded', 'down', 'unknown']).toContain(item.status);
        });
      } else {
        expect(body).toHaveProperty('status');
      }
    });

    it('returns 200 even when some providers are down (aggregate health)', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: {} })
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
    });

    it('does not throw on POST to the health route (returns 404 or 405)', async () => {
      const res = await request(app).post('/');

      expect([404, 405]).toContain(res.status);
    });
  });
});
```

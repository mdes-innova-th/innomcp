<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S059 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":181,"completion_tokens":6490,"total_tokens":6671,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6376,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T11:38:42.481Z -->
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/metrics';
import * as promClient from 'prom-client';

// Mock prom-client as it's the standard external dependency for metrics generation
jest.mock('prom-client', () => {
  const mockMetrics = jest.fn();
  const mockContentType = 'text/plain; version=0.0.4; charset=utf-8';
  const register = {
    metrics: mockMetrics,
    contentType: mockContentType,
  };
  return {
    register,
    Registry: jest.fn(() => register),
    collectDefaultMetrics: jest.fn(),
  };
});

// Mock potential database or service dependencies deterministically
jest.mock('../src/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/services/metrics', () => ({
  getCustomMetrics: jest.fn(),
}));

describe('Metrics Router Contract', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(router);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /', () => {
    it('should return 200 and metrics data in the correct format on success', async () => {
      const metricsData = 'process_cpu_user_seconds_total 0.123456\nprocess_cpu_system_seconds_total 0.045678';
      (promClient.register.metrics as jest.Mock).mockResolvedValue(metricsData);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.text).toBe(metricsData);
      expect(res.headers['content-type']).toBe(promClient.register.contentType);
    });

    it('should return 500 if metrics collection fails internally', async () => {
      (promClient.register.metrics as jest.Mock).mockRejectedValue(new Error('Metrics collection failed'));

      const res = await request(app).get('/');

      expect(res.status).toBe(500);
    });
  });

  describe('Unsupported HTTP methods', () => {
    it('should return 404 for POST /', async () => {
      const res = await request(app).post('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PUT /', async () => {
      const res = await request(app).put('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for DELETE /', async () => {
      const res = await request(app).delete('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PATCH /', async () => {
      const res = await request(app).patch('/');
      expect(res.status).toBe(404);
    });
  });
});
```

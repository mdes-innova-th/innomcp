<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T059 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1548,"completion_tokens":5497,"total_tokens":7045,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3232,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:03:56.522Z -->
```typescript
import express from 'express';
import request from 'supertest';
import metricsRouter from '../src/routes/api/metrics';

import { getAllMetrics, getLatencyStats, clearMetrics } from '../../src/metrics/latency';
import { generateMetricsReport } from '../../src/utils/advancedMetrics';
import logger from '../../src/utils/logger';

jest.mock('../../src/metrics/latency', () => ({
  getAllMetrics: jest.fn(),
  getLatencyStats: jest.fn(),
  clearMetrics: jest.fn(),
}));

jest.mock('../../src/utils/advancedMetrics', () => ({
  generateMetricsReport: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../src/middleware/performanceTracking', () => ({
  getMetrics: jest.fn(),
  getSlowRoutes: jest.fn(),
}));

const { getMetrics, getSlowRoutes } = require('../../src/middleware/performanceTracking');

const app = express();
app.use('/api/metrics', metricsRouter);

describe('Metrics API Router', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-10-01T12:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('GET /api/metrics', () => {
    test('should return grouped metrics successfully', async () => {
      const mockMetrics = {
        'tool:myTool': { p95: 100 },
        'ws:myWs': { p95: 50 },
        'GET:/api/chat': { p95: 150 },
        'system': { p95: 10 }
      };
      (getAllMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const res = await request(app).get('/api/metrics');

      expect(res.status).toBe(200);
      expect(res.body.timestamp).toBe('2023-10-01T12:00:00.000Z');
      expect(res.body.tools).toEqual({ myTool: { p95: 100 } });
      expect(res.body.websockets).toEqual({ myWs: { p95: 50 } });
      expect(res.body.endpoints).toEqual({ 'GET:/api/chat': { p95: 150 } });
      expect(res.body.other).toEqual({ system: { p95: 10 } });
    });

    test('should return 500 if getAllMetrics fails', async () => {
      (getAllMetrics as jest.Mock).mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/metrics');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve metrics');
      expect(logger.error).toHaveBeenCalledWith('[Metrics API] Failed to get metrics', { error: 'DB error' });
    });
  });

  describe('GET /api/metrics/performance', () => {
    test('should return performance metrics and slow routes', async () => {
      const mockPerfMetrics = { 'GET:/api/data': { count: 10, avg: 600 } };
      const mockSlowRoutes = [{ route: 'GET:/api/data', avg: 600 }];
      
      (getMetrics as jest.Mock).mockReturnValue(mockPerfMetrics);
      (getSlowRoutes as jest.Mock).mockReturnValue(mockSlowRoutes);

      const res = await request(app).get('/api/metrics/performance');

      expect(res.status).toBe(200);
      expect(res.body.routes).toEqual(mockPerfMetrics);
      expect(res.body.slowRoutes).toEqual(mockSlowRoutes);
      expect(res.body.generatedAt).toBe('2023-10-01T12:00:00.000Z');
      expect(getSlowRoutes).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /api/metrics/:name', () => {
    test('should return specific metric stats', async () => {
      const mockStats = { p95: 120, p99: 200 };
      (getLatencyStats as jest.Mock).mockResolvedValue(mockStats);

      const res = await request(app).get('/api/metrics/myMetric');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('myMetric');
      expect(res.body.stats).toEqual(mockStats);
      expect(res.body.timestamp).toBe('2023-10-01T12:00:00.000Z');
    });

    test('should return 404 if metric is not found', async () => {
      (getLatencyStats as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/metrics/unknown');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Metric not found');
    });

    test('should return 500 if getLatencyStats fails', async () => {
      (getLatencyStats as jest.Mock).mockRejectedValue(new Error('Lookup failed'));

      const res = await request(app).get('/api/metrics/failingMetric');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve metric');
      expect(logger.error).toHaveBeenCalledWith('[Metrics API] Failed to get metric', { 
        name: 'failingMetric', 
        error: 'Lookup failed' 
      });
    });
  });

  describe('DELETE /api/metrics/:name', () => {
    test('should clear a specific metric successfully', async () => {
      (clearMetrics as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete('/api/metrics/myMetric');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Metric cleared');
      expect(res.body.name).toBe('myMetric');
    });

    test('should return 500 if clearMetrics fails', async () => {
      (clearMetrics as jest.Mock).mockRejectedValue(new Error('Clear failed'));

      const res = await request(app).delete('/api/metrics/failingMetric');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to clear metric');
      expect(logger.error).toHaveBeenCalledWith('[Metrics API] Failed to clear metric', {
        name: 'failingMetric',
        error: 'Clear failed'
      });
    });
  });

  describe('GET /api/metrics/advanced', () => {
    test('should return advanced metrics report with default days', async () => {
      const mockReport = { tools: { tool1: { p99: 300 } } };
      (generateMetricsReport as jest.Mock).mockResolvedValue(mockReport);

      const res = await request(app).get('/api/metrics/advanced');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockReport);
      expect(generateMetricsReport).toHaveBeenCalledWith(1);
    });

    test('should return advanced metrics report with specified days', async () => {
      const mockReport = { tools: { tool1: { p99: 300 } } };
      (generateMetricsReport as jest.Mock).mockResolvedValue(mockReport);

      const res = await request(app).get('/api/metrics/advanced?days=7');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockReport);
      expect(generateMetricsReport).toHaveBeenCalledWith(7);
    });

    test('should return 500 if generateMetricsReport fails', async () => {
      (generateMetricsReport as jest.Mock).mockRejectedValue(new Error('Redis down'));

      const res = await request(app).get('/api/metrics/advanced');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to generate advanced metrics');
      expect(logger.error).toHaveBeenCalledWith('[Metrics API] Failed to generate advanced report', { error: 'Redis down' });
    });
  });

  describe('GET /api/metrics/summary/overview', () => {
    test('should calculate overview and health score correctly', async () => {
      const mockMetrics = {
        'tool:slowTool': { p95: 3000 },
        'GET:/api/slow': { p95: 2500 },
        'tool:fastTool': { p95: 100 },
        'GET:/api/fast': { p95: 50 },
      };
      (getAllMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const res = await request(app).get('/api/metrics/summary/overview');

      expect(res.status).toBe(200);
      expect(res.body.totalMetrics).toBe(4);
      expect(res.body.slowTools).toEqual([{ name: 'slowTool', p95: 3000 }]);
      expect(res.body.slowEndpoints).toEqual([{ name: 'GET:/api/slow', p95: 2500 }]);
      expect(res.body.healthScore).toBe(80); // 100 - (2 * 10)
    });

    test('should handle health score dropping to 0 minimum', async () => {
      const mockMetrics = {
        'tool:slow1': { p95: 3000 },
        'tool:slow2': { p95: 3000 },
        'tool:slow3': { p95: 3000 },
        'GET:/slow1': { p95: 3000 },
        'GET:/slow2': { p95: 3000 },
        'GET:/slow3': { p95: 3000 },
        'GET:/slow4': { p95: 3000 },
        'GET:/slow5': { p95: 3000 },
        'GET:/slow6': { p95: 3000 },
        'GET:/slow7': { p95: 3000 },
        'GET:/slow8': { p95: 3000 },
        'GET:/slow9': { p95: 3000 },
        'GET:/slow10': { p95: 3000 },
        'GET:/slow11': { p95: 3000 },
      };
      (getAllMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const res = await request(app).get('/api/metrics/summary/overview');

      expect(res.status).toBe(200);
      expect(res.body.healthScore).toBe(0);
    });

    test('should return 500 if getAllMetrics fails', async () => {
      (getAllMetrics as jest.Mock).mockRejectedValue(new Error('Metrics fetch error'));

      const res = await request(app).get('/api/metrics/summary/overview');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve overview');
      expect(logger.error).toHaveBeenCalledWith('[Metrics API] Failed to get overview', { error: 'Metrics fetch error' });
    });
  });
});
```

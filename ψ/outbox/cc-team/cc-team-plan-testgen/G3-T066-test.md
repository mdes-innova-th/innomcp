<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T066 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2261,"completion_tokens":2700,"total_tokens":4961,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":817,"image_tokens":0},"cache_creation_input_tokens":0} | 34s
 generated: 2026-06-13T11:05:15.617Z -->
```typescript
import { Router, Request, Response, NextFunction } from 'express';
import motherStatsRouter from '../src/routes/api/motherStats';

// --- Mock the two service modules ---
jest.mock('../src/services/motherHistory', () => ({
  getHistory: jest.fn(),
  clearHistory: jest.fn(),
}));

jest.mock('../src/services/leaderboardMetrics', () => ({
  getProviderStats: jest.fn(),
  resetStats: jest.fn(),
}));

import { getHistory as mockGetHistory, clearHistory as mockClearHistory } from '../src/services/motherHistory';
import { getProviderStats as mockGetProviderStats, resetStats as mockResetStats } from '../src/services/leaderboardMetrics';

// Type helper for mock request / response
function createMockReqRes(method: string, url: string) {
  const req: Partial<Request> = {
    method,
    url,
    path: url,
    headers: {},
    params: {},
    query: {},
    body: {},
  };
  const res: Partial<Response> = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    end: jest.fn(),
  };
  return { req: req as Request, res: res as Response };
}

describe('motherStats router', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Set a fixed "now" for deterministic recentIterations
    jest.setSystemTime(new Date('2025-03-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Helper to invoke the router as middleware
  function invokeRouter(req: Request, res: Response, next: NextFunction = jest.fn()) {
    motherStatsRouter(req, res, next);
  }

  describe('GET /', () => {
    it('returns default empty stats when no history or provider stats', () => {
      mockGetHistory.mockReturnValue([]);
      mockGetProviderStats.mockReturnValue(new Map());

      const { req, res } = createMockReqRes('GET', '/');
      invokeRouter(req, res);

      expect(res.json).toHaveBeenCalledTimes(1);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response).toEqual({
        totalRuns: 0,
        totalProviderCalls: 0,
        avgSuccessRate: 0,
        avgProvidersPerRun: 0,
        fastestProvider: null,
        mostReliableProvider: null,
        topProviderByRequests: null,
        recentIterations: 0,
        lastRunAt: null,
        providerBreakdown: [],
      });
    });

    it('computes stats from history runs and provider stats', () => {
      const now = new Date('2025-03-15T10:00:00Z').getTime();
      // Two runs, each with two providers
      mockGetHistory.mockReturnValue([
        {
          timestamp: new Date(now - 60000).toISOString(), // 1 min ago -> recent
          totalProviders: 2,
          successCount: 1,
          providers: [
            { providerId: 'p1', latencyMs: 100, success: true },
            { providerId: 'p2', latencyMs: 200, success: false },
          ],
        },
        {
          timestamp: new Date(now - 120000).toISOString(), // 2 min ago -> recent
          totalProviders: 1,
          successCount: 1,
          providers: [
            { providerId: 'p1', latencyMs: 150, success: true },
          ],
        },
      ]);

      const providerStatsMap = new Map([
        ['p1', { requests: 10, successRate: 90 }],
        ['p2', { requests: 5, successRate: 80 }],
      ]);
      mockGetProviderStats.mockReturnValue(providerStatsMap);

      const { req, res } = createMockReqRes('GET', '/');
      invokeRouter(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response).toMatchObject({
        totalRuns: 2,
        totalProviderCalls: 3, // p1:2 calls, p2:1 call
        avgSuccessRate: 75, // ((1/2)*100 + (1/1)*100)/2 valid runs = (50+100)/2=75
        avgProvidersPerRun: 1.5, // (2+1)/2 = 1.5
        recentIterations: 2, // both within 5 min
        lastRunAt: expect.any(String),
        fastestProvider: { id: 'p1', avgLatencyMs: 125 }, // (100+150)/2=125
        mostReliableProvider: { id: 'p1', successRate: 90 },
        topProviderByRequests: { id: 'p1', requests: 10 },
        providerBreakdown: expect.arrayContaining([
          expect.objectContaining({ providerId: 'p1', totalCalls: 2, successes: 2, avgLatencyMs: 125, successRate: 100 }),
          expect.objectContaining({ providerId: 'p2', totalCalls: 1, successes: 0, avgLatencyMs: 200, successRate: 0 }),
        ]),
      });
    });

    it('sets fastestProvider from only successful providers (successes>0)', () => {
      mockGetHistory.mockReturnValue([
        {
          timestamp: new Date().toISOString(),
          totalProviders: 2,
          successCount: 0,
          providers: [
            { providerId: 'p1', latencyMs: 50, success: false },
            { providerId: 'p2', latencyMs: 100, success: true },
          ],
        },
      ]);
      mockGetProviderStats.mockReturnValue(new Map());

      const { req, res } = createMockReqRes('GET', '/');
      invokeRouter(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.fastestProvider).toEqual({ id: 'p2', avgLatencyMs: 100 });
    });

    it('handles runs with zero totalProviders gracefully', () => {
      mockGetHistory.mockReturnValue([
        {
          timestamp: new Date().toISOString(),
          totalProviders: 0,
          successCount: 0,
          providers: [],
        },
      ]);
      mockGetProviderStats.mockReturnValue(new Map());

      const { req, res } = createMockReqRes('GET', '/');
      invokeRouter(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.totalRuns).toBe(1);
      expect(response.avgSuccessRate).toBe(0); // no valid runs with providers >0
      expect(response.avgProvidersPerRun).toBe(0);
    });

    it('recentIterations filters by timestamp within last 5 minutes', () => {
      const now = new Date('2025-03-15T10:00:00Z').getTime();
      mockGetHistory.mockReturnValue([
        { timestamp: new Date(now - 10000).toISOString(), totalProviders: 1, successCount: 1, providers: [] }, // recent
        { timestamp: new Date(now - 400000).toISOString(), totalProviders: 1, successCount: 1, providers: [] }, // not recent (>5 min)
      ]);
      mockGetProviderStats.mockReturnValue(new Map());

      const { req, res } = createMockReqRes('GET', '/');
      invokeRouter(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.recentIterations).toBe(1);
    });
  });

  describe('POST /reset', () => {
    it('calls resetStats and clearHistory and returns ok', () => {
      mockResetStats.mockImplementation(() => {});
      mockClearHistory.mockImplementation(() => {});

      const { req, res } = createMockReqRes('POST', '/reset');
      invokeRouter(req, res);

      expect(mockResetStats).toHaveBeenCalledTimes(1);
      expect(mockClearHistory).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        message: 'All mother dispatch stats and history cleared',
        timestamp: expect.any(String),
      });
    });
  });
});
```

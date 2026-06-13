<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T047 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":783,"completion_tokens":4652,"total_tokens":5435,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3573,"image_tokens":0},"cache_creation_input_tokens":0} | 87s
 generated: 2026-06-13T11:01:56.395Z -->
```typescript
import { Request, Response } from 'express';
import router from '../src/routes/api/analytics';
import { analyticsService } from '../src/services/analyticsService';

jest.mock('../src/services/analyticsService', () => ({
  analyticsService: {
    getStats: jest.fn(),
    track: jest.fn(),
    reset: jest.fn(),
  },
}));

const mockedService = analyticsService as jest.Mocked<typeof analyticsService>;

function getHandler(path: string, method: 'get' | 'post') {
  const layer = (router as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method]
  );
  return layer?.route?.stack[0].handle;
}

function createMockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as Response;
}

describe('Analytics Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /stats', () => {
    const handler = getHandler('/stats', 'get');

    test('returns stats on success', () => {
      const req = {} as Request;
      const res = createMockRes();
      const mockStats = { totalVisits: 100, uniqueUsers: 50 };
      mockedService.getStats.mockReturnValue(mockStats as any);

      handler(req, res);

      expect(mockedService.getStats).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockStats });
    });

    test('returns 500 on service error', () => {
      const req = {} as Request;
      const res = createMockRes();
      mockedService.getStats.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB connection failed' });
    });
  });

  describe('POST /event', () => {
    const handler = getHandler('/event', 'post');

    test('tracks event and returns success', () => {
      const body = { type: 'message', content: 'hello' };
      const req = { body } as Request;
      const res = createMockRes();

      handler(req, res);

      expect(mockedService.track).toHaveBeenCalledWith(body);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('returns 400 if type is missing in body', () => {
      const req = { body: { content: 'hello' } } as Request;
      const res = createMockRes();

      handler(req, res);

      expect(mockedService.track).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'ต้องระบุ type ใน body' });
    });

    test('returns 400 if body is null or undefined', () => {
      const req = { body: null } as unknown as Request;
      const res = createMockRes();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'ต้องระบุ type ใน body' });
    });

    test('returns 500 on tracking error', () => {
      const req = { body: { type: 'error' } } as Request;
      const res = createMockRes();
      mockedService.track.mockImplementation(() => {
        throw new Error('Tracking failed');
      });

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Tracking failed' });
    });
  });

  describe('POST /reset', () => {
    const handler = getHandler('/reset', 'post');

    test('resets analytics and returns success message', () => {
      const req = {} as Request;
      const res = createMockRes();

      handler(req, res);

      expect(mockedService.reset).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Analytics reset เรียบร้อย',
      });
    });

    test('returns 500 on reset error', () => {
      const req = {} as Request;
      const res = createMockRes();
      mockedService.reset.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Reset failed' });
    });
  });
});
```

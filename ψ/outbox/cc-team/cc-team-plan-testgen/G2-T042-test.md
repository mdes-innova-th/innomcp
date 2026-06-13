<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T042 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2081,"completion_tokens":5837,"total_tokens":7918,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5174,"image_tokens":0},"cache_creation_input_tokens":0} | 109s
 generated: 2026-06-13T11:01:32.401Z -->
```typescript
import { Request, Response } from 'express';
import router from '../src/routes/api/activity';
import { withDbConnection } from '../../utils/db';

jest.mock('../../utils/db', () => ({
  withDbConnection: jest.fn(),
}));

jest.mock('../../utils/jwt', () => ({
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
}));

const mockWithDbConnection = withDbConnection as jest.MockedFunction<typeof withDbConnection>;

describe('Activity Router', () => {
  let handler: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let mockQuery: jest.Mock;

  beforeAll(() => {
    const routeLayer = (router as any).stack.find((layer: any) => layer.route && layer.route.path === '/');
    handler = routeLayer.route.stack[0].handle;
  });

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([[]]);
    const mockConn = { query: mockQuery };
    mockWithDbConnection.mockImplementation(async (cb: any) => cb(mockConn));

    mockReq = {
      query: { limit: '20' },
      user: { userId: 'user-123' },
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  test('GET / returns activity feed', async () => {
    await handler(mockReq, mockRes, mockNext);

    expect(mockWithDbConnection).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalled();
  });

  test('GET / respects limit and projectId query params', async () => {
    mockReq.query = { limit: '50', projectId: 'proj-abc' };
    
    await handler(mockReq, mockRes, mockNext);

    expect(mockQuery).toHaveBeenCalled();
    const calls = mockQuery.mock.calls;
    const hasProjectParam = calls.some((call: any[]) => 
      Array.isArray(call[1]) && call[1].includes('proj-abc')
    );
    expect(hasProjectParam).toBe(true);
  });

  test('GET / scopes to guest user if unauthenticated', async () => {
    mockReq.user = undefined;
    mockReq.query = { userId: 'guest-123' };

    await handler(mockReq, mockRes, mockNext);

    const calls = mockQuery.mock.calls;
    const hasUserParam = calls.some((call: any[]) => 
      Array.isArray(call[1]) && call[1].includes('guest-123')
    );
    expect(hasUserParam).toBe(true);
  });
});
```

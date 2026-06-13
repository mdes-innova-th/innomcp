<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: T077 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":945,"completion_tokens":6217,"total_tokens":7162,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5244,"image_tokens":0},"cache_creation_input_tokens":0} | 114s
 generated: 2026-06-13T11:08:47.491Z -->
```typescript
import express from 'express';
import http from 'http';
import { Server } from 'http';
import router from '../src/routes/api/stats';
import { withDbConnection } from '../src/utils/db';

jest.mock('../src/utils/db');
const mockWithDbConnection = withDbConnection as jest.MockedFunction<typeof withDbConnection>;

describe('Stats API', () => {
  let server: Server;
  let baseUrl: string;

  const makeRequest = (path: string): Promise<{ status: number; body: any }> => {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  };

  beforeAll((done) => {
    const app = express();
    app.use('/', router);
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns aggregated stats on success', async () => {
    mockWithDbConnection.mockImplementation(async (cb: (conn: any) => Promise<any>) => {
      const mockConn = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ status: 'done', count: 10 }]])
          .mockResolvedValueOnce([[{ avg_rating: 4.5, total: 20 }]])
          .mockResolvedValueOnce([[{ agent_id: 'a1', activations: 5, last_active: '2023-01-01' }]])
      };
      return cb(mockConn);
    });

    const res = await makeRequest('/');
    
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([{ status: 'done', count: 10 }]);
    expect(res.body.feedback).toEqual({ avg_rating: 4.5, total: 20 });
    expect(res.body.agents).toEqual({ active: 12, standby: 4, total: 16 });
    expect(res.body.agentActivity).toEqual([{ agentId: 'a1', activations: 5, lastActive: '2023-01-01' }]);
  });

  test('returns safe defaults when db connection fails', async () => {
    mockWithDbConnection.mockRejectedValue(new Error('DB down'));

    const res = await makeRequest('/');
    
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.feedback).toEqual({ avg_rating: null, total: 0 });
    expect(res.body.agents).toEqual({ active: 12, standby: 4, total: 16 });
    expect(res.body.agentActivity).toEqual([]);
  });

  test('handles missing agent_id column gracefully', async () => {
    mockWithDbConnection.mockImplementation(async (cb: (conn: any) => Promise<any>) => {
      const mockConn = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ status: 'pending', count: 2 }]])
          .mockResolvedValueOnce([[{ avg_rating: null, total: 0 }]])
          .mockRejectedValueOnce(new Error('Unknown column agent_id'))
      };
      return cb(mockConn);
    });

    const res = await makeRequest('/');
    
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([{ status: 'pending', count: 2 }]);
    expect(res.body.feedback).toEqual({ avg_rating: null, total: 0 });
    expect(res.body.agentActivity).toEqual([]);
  });
});
```

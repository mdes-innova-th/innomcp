<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T071 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2038,"completion_tokens":2977,"total_tokens":5015,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":911,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T11:06:07.190Z -->
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/projects';
import { withDbConnection } from '../src/utils/db';
import { clearCache } from '../src/middleware/cacheMiddleware';
import { authenticateToken } from '../src/utils/jwt';

jest.mock('../src/utils/db', () => ({
  withDbConnection: jest.fn(),
}));
jest.mock('../src/middleware/cacheMiddleware', () => ({
  clearCache: jest.fn(),
}));
jest.mock('../src/utils/jwt', () => ({
  authenticateToken: jest.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  }),
}));

beforeAll(() => {
  jest.useFakeTimers();
});
afterAll(() => {
  jest.useRealTimers();
});

describe('projects router', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/projects', router);
  });

  describe('GET /api/projects', () => {
    it('returns list of projects when table exists', async () => {
      const mockRows = [
        { id: '1', name: 'Project A' },
        { id: '2', name: 'Project B' },
      ];
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        const mockConn = { query: jest.fn().mockResolvedValue([mockRows]) };
        return callback(mockConn);
      });

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: mockRows });
    });

    it('creates table and returns empty list when table does not exist', async () => {
      // First call throws error related to table not existing
      (withDbConnection as jest.Mock)
        .mockImplementationOnce(async (callback: any) => {
          throw new Error("Table 'projects' doesn't exist");
        })
        // Second call (from ensureTable) succeeds
        .mockImplementationOnce(async (callback: any) => {
          const mockConn = { query: jest.fn().mockResolvedValue([]) };
          return callback(mockConn);
        });

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });
  });

  describe('POST /api/projects', () => {
    beforeEach(() => {
      // Mock crypto.randomUUID to return fixed id
      jest.spyOn(crypto, 'randomUUID').mockReturnValue('fixed-uuid');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('creates a project and returns 201', async () => {
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        const mockConn = { query: jest.fn().mockResolvedValue([]) };
        return callback(mockConn);
      });

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project', description: 'desc', color: '#ff0000', icon: '🚀' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 'fixed-uuid', name: 'New Project' });
      expect(clearCache).toHaveBeenCalledWith('/api/dashboard');
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app).post('/api/projects').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'name is required' });
    });

    it('returns 400 when name is empty string', async () => {
      const res = await request(app).post('/api/projects').send({ name: '  ' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'name is required' });
    });

    it('creates table and retries when table does not exist', async () => {
      (withDbConnection as jest.Mock)
        .mockImplementationOnce(async (callback: any) => {
          throw new Error("Table 'projects' doesn't exist");
        })
        .mockImplementationOnce(async (callback: any) => {
          const mockConn = { query: jest.fn().mockResolvedValue([]) };
          return callback(mockConn);
        });

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Retry Project' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 'fixed-uuid', name: 'Retry Project' });
    });

    it('returns 500 if retry also fails', async () => {
      (withDbConnection as jest.Mock)
        .mockImplementationOnce(async (callback: any) => {
          throw new Error("Table 'projects' doesn't exist");
        })
        .mockImplementationOnce(async (callback: any) => {
          throw new Error('Some other error');
        });

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Failed Project' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not create project' });
    });

    it('returns 500 on generic database error', async () => {
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        throw new Error('Generic DB error');
      });

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Project' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not create project' });
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns project when found', async () => {
      const mockProject = { id: 'abc', name: 'My Project' };
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        const mockConn = { query: jest.fn().mockResolvedValue([[mockProject]]) };
        return callback(mockConn);
      });

      const res = await request(app).get('/api/projects/abc');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ project: mockProject });
    });

    it('returns 404 when not found', async () => {
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        const mockConn = { query: jest.fn().mockResolvedValue([[]]) };
        return callback(mockConn);
      });

      const res = await request(app).get('/api/projects/unknown');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    it('returns 500 on database error', async () => {
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        throw new Error('DB error');
      });

      const res = await request(app).get('/api/projects/abc');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not fetch project' });
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('updates fields and returns success', async () => {
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        const mockConn = {
          query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        };
        return callback(mockConn);
      });

      const res = await request(app)
        .patch('/api/projects/abc')
        .send({ name: 'Updated', description: 'new desc', color: '#000', icon: '📁' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('returns 400 when no fields provided', async () => {
      const res = await request(app).patch('/api/projects/abc').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'No fields to update' });
    });

    it('returns 404 when no rows affected', async () => {
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        const mockConn = {
          query: jest.fn().mockResolvedValue([{ affectedRows: 0 }]),
        };
        return callback(mockConn);
      });

      const res = await request(app)
        .patch('/api/projects/abc')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Project not found' });
    });

    it('returns 500 on database error', async () => {
      (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
        throw new Error('DB error');
      });

      const res = await request(app)
        .patch('/api/projects/abc')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not update project' });
    });
  });
});
```

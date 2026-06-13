<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S055 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":339,"completion_tokens":1255,"total_tokens":1594,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T11:36:18.199Z -->
```typescript
import request from 'supertest';
import express from 'express';

// Mock external dependencies deterministically (offline)
jest.mock('../../src/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/services/email', () => ({
  sendFeedbackNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', email: 'user@example.com' };
    next();
  },
}));

import router from '../src/routes/api/feedback';
import { pool } from '../src/db';
import { sendFeedbackNotification } from '../src/services/email';

const mockedQuery = pool.query as jest.MockedFunction<typeof pool.query>;
const mockedSendFeedbackNotification =
  sendFeedbackNotification as jest.MockedFunction<typeof sendFeedbackNotification>;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/feedback', router);
  return app;
};

describe('feedback route - contract behavior', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('POST /api/feedback', () => {
    const validPayload = {
      type: 'bug',
      message: 'Something is broken',
      rating: 4,
      email: 'reporter@example.com',
    };

    it('persists feedback and returns 201 with the created record id for a valid payload', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] } as any);

      const res = await request(app)
        .post('/api/feedback')
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 42, success: true });

      // Contract: DB was queried with an INSERT-like statement and params
      expect(mockedQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockedQuery.mock.calls[0];
      expect(typeof sql).toBe('string');
      expect(sql.toUpperCase()).toMatch(/INSERT/);
      expect(params).toEqual(
        expect.arrayContaining(['bug', 'Something is broken', 4, 'reporter@example.com', 'user-123'])
      );
    });

    it('notifies the support email service after a successful insert', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] } as any);

      await request(app).post('/api/feedback').send(validPayload);

      expect(mockedSendFeedbackNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bug',
          message: 'Something is broken',
          email: 'reporter@example.com',
        })
      );
    });

    it('returns 400 when required field `message` is missing or empty', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ ...validPayload, message: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(mockedQuery).not.toHaveBeenCalled();
      expect(mockedSendFeedbackNotification).not.toHaveBeenCalled();
    });

    it('returns 400 when `type` is not a supported category', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ ...validPayload, type: 'unsupported-category' });

      expect(res.status).toBe(400);
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when `rating` is outside the 1..5 boundary', async () => {
      for (const bad of [0, -1, 6, 100]) {
        const res = await request(app)
          .post('/api/feedback')
          .send({ ...validPayload, rating: bad });

        expect(res.status).toBe(400);
      }
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it('accepts boundary ratings of 1 and 5', async () => {
      mockedQuery.mockResolvedValue({ rows: [{ id: 7 }] } as any);

      for (const good of [1, 5]) {
        const res = await request(app)
          .post('/api/feedback')
          .send({ ...validPayload, rating: good });

        expect(res.status).toBe(201);
      }
      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });

    it('returns 500 when the database insert fails', async () => {
      mockedQuery.mockRejectedValueOnce(new Error('db down'));

      const res = await request(app)
        .post('/api/feedback')
        .send(validPayload);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      // Notification must NOT be sent if the feedback was not stored
      expect(mockedSendFeedbackNotification).not.toHaveBeenCalled();
    });
  });

  describe('non-POST methods are not handled on /api/feedback', () => {
    it('returns 404 (or 405) for GET /api/feedback', async () => {
      const res = await request(app).get('/api/feedback');
      expect([404, 405]).toContain(res.status);
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it('returns 404 (or 405) for DELETE /api/feedback', async () => {
      const res = await request(app).delete('/api/feedback');
      expect([404, 405]).toContain(res.status);
      expect(mockedQuery).not.toHaveBeenCalled();
    });
  });
});
```

<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T069 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1100,"completion_tokens":5946,"total_tokens":7046,"prompt_tokens_details":{"cached_tokens":1088,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4295,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T11:08:09.077Z -->
```typescript
import express from 'express';
import supertest from 'supertest';

const mockOptionalAuth = jest.fn();

jest.mock('../../utils/jwt', () => ({
  optionalAuth: (...args: any[]) => mockOptionalAuth(...args),
}));

describe('preferences router', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2024-01-15T10:00:00.000Z') });
    jest.resetModules();
    mockOptionalAuth.mockReset();
    mockOptionalAuth.mockImplementation((req: any, _res: any, next: any) => next());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createApp = () => {
    const router = require('../src/routes/api/preferences').default;
    const a = express();
    a.use(express.json());
    a.use('/api/preferences', router);
    return a;
  };

  test('GET / returns default preferences for guest', async () => {
    app = createApp();
    const res = await supertest(app).get('/api/preferences');
    expect(res.status).toBe(200);
    expect(res.body.preferences).toMatchObject({
      userId: 'guest',
      theme: 'system',
      language: 'th',
      fontSize: 'md',
      chatMode: 'remote',
      showTimestamps: false,
      compactMode: false,
    });
    expect(res.body.preferences.updatedAt).toBe('2024-01-15T10:00:00.000Z');
  });

  test('GET / returns preferences for authenticated user', async () => {
    mockOptionalAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { userId: 'user123' };
      next();
    });
    app = createApp();
    const res = await supertest(app).get('/api/preferences');
    expect(res.status).toBe(200);
    expect(res.body.preferences.userId).toBe('user123');
  });

  test('GET / returns preferences for API key user', async () => {
    mockOptionalAuth.mockImplementation((req: any, _res: any, next: any) => {
      (req as any).apiKeyData = { apikey_id: 'key456' };
      next();
    });
    app = createApp();
    const res = await supertest(app).get('/api/preferences');
    expect(res.status).toBe(200);
    expect(res.body.preferences.userId).toBe('api:key456');
  });

  test('GET / returns stored preferences after PUT', async () => {
    app = createApp();
    await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'dark', compactMode: true });

    const getRes = await supertest(app).get('/api/preferences');
    expect(getRes.status).toBe(200);
    expect(getRes.body.preferences.theme).toBe('dark');
    expect(getRes.body.preferences.compactMode).toBe(true);
  });

  test('PUT / updates preferences for guest', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'dark', language: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toBe('dark');
    expect(res.body.preferences.language).toBe('en');
    expect(res.body.preferences.userId).toBe('guest');
    expect(res.body.preferences.fontSize).toBe('md');
  });

  test('PUT / merges with existing preferences', async () => {
    app = createApp();
    await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'dark' });

    const res = await supertest(app)
      .put('/api/preferences')
      .send({ language: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toBe('dark');
    expect(res.body.preferences.language).toBe('en');
  });

  test('PUT / does not allow overriding userId from body', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'dark', userId: 'hacker' });
    expect(res.status).toBe(200);
    expect(res.body.preferences.userId).toBe('guest');
  });

  test('PUT / updates showTimestamps and compactMode booleans', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ showTimestamps: true, compactMode: true });
    expect(res.status).toBe(200);
    expect(res.body.preferences.showTimestamps).toBe(true);
    expect(res.body.preferences.compactMode).toBe(true);
  });

  test('PUT / updates updatedAt timestamp', async () => {
    app = createApp();
    const firstRes = await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'light' });
    expect(firstRes.body.preferences.updatedAt).toBe('2024-01-15T10:00:00.000Z');

    jest.advanceTimersByTime(5000);

    const secondRes = await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'dark' });
    expect(secondRes.body.preferences.updatedAt).toBe('2024-01-15T10:00:05.000Z');
  });

  test('PUT / rejects invalid theme', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('theme must be light | dark | system');
  });

  test('PUT / rejects invalid language', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ language: 'fr' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('language must be th | en');
  });

  test('PUT / rejects invalid fontSize', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ fontSize: 'xl' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('fontSize must be sm | md | lg');
  });

  test('PUT / rejects invalid chatMode', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ chatMode: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('chatMode must be local | remote | hybrid');
  });

  test('PUT / accepts all valid enum values', async () => {
    app = createApp();
    const res = await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'light', language: 'en', fontSize: 'lg', chatMode: 'hybrid' });
    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toBe('light');
    expect(res.body.preferences.language).toBe('en');
    expect(res.body.preferences.fontSize).toBe('lg');
    expect(res.body.preferences.chatMode).toBe('hybrid');
  });

  test('PUT / with authenticated user stores under correct key', async () => {
    mockOptionalAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { userId: 'user789' };
      next();
    });
    app = createApp();
    const putRes = await supertest(app)
      .put('/api/preferences')
      .send({ theme: 'dark' });
    expect(putRes.body.preferences.userId).toBe('user789');
    expect(putRes.body.preferences.theme).toBe('dark');

    const getRes = await supertest(app).get('/api/preferences');
    expect(getRes.body.preferences.userId).toBe('user789');
    expect(getRes.body.preferences.theme).toBe('dark');
  });

  test('PUT / with numeric userId coerces to string', async () => {
    mockOptionalAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { userId: 42 };
      next();
    });
    app = createApp();
    const res = await supertest(app).get('/api/preferences');
    expect(res.body.preferences.userId).toBe('42');
  });
});
```

<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: T082 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1652,"completion_tokens":6411,"total_tokens":8063,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5234,"image_tokens":0},"cache_creation_input_tokens":0} | 118s
 generated: 2026-06-13T11:17:38.095Z -->
```typescript
import request from 'supertest';
import express from 'express';
import router from '../src/routes/api/webhooks';
import {
  listWebhooks,
  getWebhook,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  fireWebhookById,
} from '../src/services/webhookService';

jest.mock('../src/services/webhookService', () => ({
  listWebhooks: jest.fn(),
  getWebhook: jest.fn(),
  createWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  toggleWebhook: jest.fn(),
  fireWebhookById: jest.fn(),
}));

describe('webhooks router', () => {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware to inject user context
  app.use((req: any, _res, next) => {
    req.user = { id: 'user-123' };
    next();
  });
  
  app.use('/api/webhooks', router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/webhooks lists webhooks with masked secrets', async () => {
    (listWebhooks as jest.Mock).mockReturnValue([
      { id: '1', name: 'wh1', url: 'http://a.com', events: ['task.completed'], secret: 'sec', enabled: true, userId: 'user-123' }
    ]);
    
    const res = await request(app).get('/api/webhooks');
    
    expect(res.status).toBe(200);
    expect(res.body.webhooks).toEqual([
      { id: '1', name: 'wh1', url: 'http://a.com', events: ['task.completed'], enabled: true, userId: 'user-123', hasSecret: true }
    ]);
    expect(listWebhooks).toHaveBeenCalledWith('user-123');
  });

  test('POST /api/webhooks creates a webhook', async () => {
    const mockWh = { id: '2', name: 'wh2', url: 'http://b.com', events: ['task.failed'], secret: 's', enabled: true, userId: 'user-123' };
    (createWebhook as jest.Mock).mockReturnValue(mockWh);
    
    const res = await request(app).post('/api/webhooks').send({
      name: 'wh2', url: 'http://b.com', events: ['task.failed'], secret: 's'
    });
    
    expect(res.status).toBe(201);
    expect(res.body.webhook.hasSecret).toBe(true);
    expect(res.body.webhook.secret).toBeUndefined();
  });

  test('POST /api/webhooks rejects invalid URL', async () => {
    const res = await request(app).post('/api/webhooks').send({
      name: 'wh', url: 'not-a-url', events: ['task.completed']
    });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid URL');
  });

  test('POST /api/webhooks rejects invalid events', async () => {
    const res = await request(app).post('/api/webhooks').send({
      name: 'wh', url: 'http://c.com', events: ['invalid.event']
    });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('invalid events');
  });

  test('POST /api/webhooks/:id/test fires test event', async () => {
    (getWebhook as jest.Mock).mockReturnValue({ id: '1' });
    (fireWebhookById as jest.Mock).mockResolvedValue(undefined);
    
    const res = await request(app).post('/api/webhooks/1/test');
    
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(fireWebhookById).toHaveBeenCalledWith('1', 'task.completed', expect.any(Object));
  });

  test('POST /api/webhooks/:id/test returns 404 if not found', async () => {
    (getWebhook as jest.Mock).mockReturnValue(null);
    
    const res = await request(app).post('/api/webhooks/99/test');
    
    expect(res.status).toBe(404);
  });

  test('PATCH /api/webhooks/:id toggles webhook', async () => {
    const mockWh = { id: '1', enabled: false, secret: 'x' };
    (toggleWebhook as jest.Mock).mockReturnValue(mockWh);
    
    const res = await request(app).patch('/api/webhooks/1').send({ enabled: false });
    
    expect(res.status).toBe(200);
    expect(res.body.webhook.hasSecret).toBe(true);
  });

  test('DELETE /api/webhooks/:id deletes webhook', async () => {
    (deleteWebhook as jest.Mock).mockReturnValue(true);
    
    const res = await request(app).delete('/api/webhooks/1');
    
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

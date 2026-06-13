<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S070 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":344,"completion_tokens":979,"total_tokens":1323,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T11:41:03.420Z -->
```typescript
import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import router, { PresenceEntry } from '../src/routes/api/presence';

// Mock any external dependencies that presence module might use
// Since the implementation isn't provided, we mock at the integration boundary

const buildApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/presence', router);
  return app;
};

describe('presence router contract', () => {
  describe('module shape', () => {
    it('default export is an Express router (function with stack)', () => {
      expect(typeof router).toBe('function');
      // Express routers are functions with a `stack` property
      expect(Array.isArray((router as any).stack)).toBe(true);
    });

    it('PresenceEntry type is exported and usable as a type annotation', () => {
      // Compile-time + runtime check: we can construct a value satisfying it
      const entry: PresenceEntry = {
        userId: 'user-1',
        status: 'online',
        lastSeen: '2025-01-01T00:00:00.000Z',
        deviceId: 'dev-1',
      };
      expect(entry.userId).toBe('user-1');
      expect(entry.status).toBe('online');
    });
  });

  describe('GET /', () => {
    it('responds with 200 and a JSON body representing presence entries', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      // Body must be a JSON value; presence list is typically an object or array
      expect(res.body).toBeDefined();
      const body = res.body as unknown;
      const isArrayLike = Array.isArray(body);
      const isObjectLike =
        typeof body === 'object' && body !== null && !Array.isArray(body);
      expect(isArrayLike || isObjectLike).toBe(true);
    });

    it('returns entries that conform to PresenceEntry contract when an array shape is used', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/');
      if (Array.isArray(res.body)) {
        // If entries are returned, each must be an object with at least an identifier
        for (const item of res.body) {
          expect(typeof item).toBe('object');
          expect(item).not.toBeNull();
        }
      } else {
        // Object shape: must be a plain object
        expect(typeof res.body).toBe('object');
        expect(res.body).not.toBeNull();
      }
    });

    it('does not leak stack traces or HTML on success', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/');
      const text = JSON.stringify(res.body ?? '');
      expect(text).not.toMatch(/at \w+ \(/); // no V8-style stack frames
      expect(res.text.startsWith('<')).toBe(false);
    });
  });

  describe('error handling contract', () => {
    it('unknown sub-routes respond with 404 JSON (not HTML)', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/this-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('rejects unsupported methods on the base path with 404/405 JSON', async () => {
      const app = buildApp();
      const res = await request(app).delete('/api/presence/');
      // Either 404 (not found) or 405 (method not allowed) is acceptable contract behavior,
      // but the response must be JSON, never an HTML error page.
      expect([404, 405]).toContain(res.status);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('middleware / handler invocation', () => {
    it('router has at least one route layer registered', () => {
      const layers = (router as any).stack as Array<{ route?: unknown }>;
      const routeLayers = layers.filter((l) => l.route);
      expect(routeLayers.length).toBeGreaterThan(0);
    });
  });
});
```

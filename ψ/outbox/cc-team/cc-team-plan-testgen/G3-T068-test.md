<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T068 role=test model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":628,"completion_tokens":7830,"total_tokens":8458,"prompt_tokens_details":{"cached_tokens":72,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":7935,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 78s
 generated: 2026-06-13T11:06:20.403Z -->
```typescript
import request from 'supertest';
import express, { Application } from 'express';
import pluginsRouter from '../src/routes/api/plugins';
import { listPlugins, togglePlugin } from '../src/plugins/registry';

jest.mock('../src/plugins/registry', () => ({
  ensureBuiltIns: jest.fn(),
  listPlugins: jest.fn(),
  togglePlugin: jest.fn(),
}));

describe('plugins router', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(pluginsRouter);
  });

  describe('GET /', () => {
    test('returns plugins from registry', async () => {
      const plugins = [{ id: 'builtin-1', name: 'Built-in One', enabled: true }];
      (listPlugins as jest.Mock).mockReturnValue(plugins);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ plugins });
      expect(listPlugins).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /:id', () => {
    test('updates plugin when enabled is boolean', async () => {
      const plugin = { id: 'plugin-1', name: 'Plugin One', enabled: false };
      (togglePlugin as jest.Mock).mockReturnValue(plugin);

      const res = await request(app).patch('/plugin-1').send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ plugin });
      expect(togglePlugin).toHaveBeenCalledWith('plugin-1', false);
    });

    test('returns 400 when enabled is not a boolean', async () => {
      const res = await request(app).patch('/plugin-1').send({ enabled: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'enabled (boolean) is required' });
      expect(togglePlugin).not.toHaveBeenCalled();
    });

    test('returns 404 when plugin does not exist', async () => {
      (togglePlugin as jest.Mock).mockReturnValue(undefined);

      const res = await request(app).patch('/missing').send({ enabled: true });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Plugin 'missing' not found" });
      expect(togglePlugin).toHaveBeenCalledWith('missing', true);
    });
  });
});
```

<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S068 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":185,"completion_tokens":7000,"total_tokens":7185,"prompt_tokens_details":{"cached_tokens":73,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6990,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T11:40:49.153Z -->
```typescript
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import pluginRouter from '../src/routes/api/plugins';

// Deterministic mocks for external service boundaries
const mockList = jest.fn();
const mockGet = jest.fn();
const mockInstall = jest.fn();
const mockUninstall = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../src/services/pluginManager', () => ({
  PluginManager: {
    list: mockList,
    get: mockGet,
    install: mockInstall,
    uninstall: mockUninstall,
    update: mockUpdate,
  },
}));

describe('Plugins Router Contract', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/plugins', pluginRouter);

    // Minimal error boundary to observe HTTP error contracts
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      if (err.message === 'Plugin not found') {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message });
    });
  });

  describe('GET /api/plugins', () => {
    it('returns 200 and an array of plugin descriptors', async () => {
      const plugins = [
        { id: 'fmt', name: 'Formatter', version: '1.0.0', enabled: true },
        { id: 'lint', name: 'Linter', version: '2.0.0', enabled: false },
      ];
      mockList.mockResolvedValue(plugins);

      const res = await request(app).get('/api/plugins');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(plugins);
    });

    it('returns 200 and an empty array when no plugins are installed', async () => {
      mockList.mockResolvedValue([]);

      const res = await request(app).get('/api/plugins');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/plugins/:id', () => {
    it('returns 200 and the matching plugin when it exists', async () => {
      const plugin = { id: 'fmt', name: 'Formatter', version: '1.0.0', enabled: true };
      mockGet.mockResolvedValue(plugin

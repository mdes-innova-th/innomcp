<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T046 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1626,"completion_tokens":2450,"total_tokens":4076,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1190,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T11:01:10.544Z -->
```typescript
import request from 'supertest';
import express from 'express';
import { getCurrentAIMode } from '../src/routes/api/aiMode';

// Mock logger to avoid actual logging and allow assertions if needed
jest.mock('../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('aiMode', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
  });

  beforeEach(() => {
    jest.useFakeTimers();
    // Reset module state for each test by clearing module registry
    jest.resetModules();
    // Re‑import the router and attach it to the app
    const aiModeRouter = require('../src/routes/api/aiMode').default;
    // Remove any previous routes (but since we recreate the app each time, it's fine)
    app._router = express.Router();
    app.use('/ai-mode', aiModeRouter);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.AI_MODE;
    delete process.env.LOCAL_OLLAMA_BASE_URL;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_HOST;
    delete process.env.REMOTE_OLLAMA_BASE_URL;
    delete process.env.OLLAMA_REMOTE_URL;
    delete process.env.OLLAMA_URL;
    delete process.env.LOCAL_OLLAMA_MODEL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.AI_MODEL;
    delete process.env.REMOTE_OLLAMA_MODEL;
  });

  describe('getCurrentAIMode', () => {
    test('returns default mode when no environment variable is set', () => {
      const mode = getCurrentAIMode();
      expect(mode).toBe('local');
    });

    test('returns mode from AI_MODE environment variable', () => {
      process.env.AI_MODE = 'remote';
      jest.resetModules();
      const { getCurrentAIMode: getMode } = require('../src/routes/api/aiMode');
      expect(getMode()).toBe('remote');
    });
  });

  describe('GET /ai-mode', () => {
    test('returns default configuration when no environment variables are set', async () => {
      const res = await request(app).get('/ai-mode');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        mode: 'local',
        availableModes: ['local', 'remote', 'hybrid'],
        config: {
          localUrl: undefined,
          remoteUrl: undefined,
          localModel: undefined,
          remoteModel: undefined,
        },
      });
    });

    test('returns configured values when environment variables are set', async () => {
      process.env.AI_MODE = 'hybrid';
      process.env.LOCAL_OLLAMA_BASE_URL = 'http://local:11434';
      process.env.REMOTE_OLLAMA_BASE_URL = 'http://remote:11434';
      process.env.LOCAL_OLLAMA_MODEL = 'gemma:2b';
      process.env.REMOTE_OLLAMA_MODEL = 'llama3:8b';
      jest.resetModules();
      const aiModeRouter = require('../src/routes/api/aiMode').default;
      app._router = express.Router();
      app.use('/ai-mode', aiModeRouter);
      const res = await request(app).get('/ai-mode');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        mode: 'hybrid',
        config: {
          localUrl: 'http://local:11434',
          remoteUrl: 'http://remote:11434',
          localModel: 'gemma:2b',
          remoteModel: 'llama3:8b',
        },
      });
    });
  });

  describe('POST /ai-mode', () => {
    test('changes mode successfully', async () => {
      const res = await request(app)
        .post('/ai-mode')
        .send({ mode: 'remote' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        mode: 'remote',
        previousMode: 'local',
        message: 'AI mode changed to remote. Next chat will use this mode.',
      });
      // Verify internal state has changed by calling the exported function
      const currentMode = getCurrentAIMode();
      expect(currentMode).toBe('remote');
    });

    test('returns 400 for invalid mode', async () => {
      const res = await request(app)
        .post('/ai-mode')
        .send({ mode: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid mode. Must be one of: local, remote, hybrid',
      });
    });

    test('returns 400 when mode is missing', async () => {
      const res = await request(app)
        .post('/ai-mode')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid mode. Must be one of: local, remote, hybrid',
      });
    });

    test('warns when remote/hybrid is selected but no remote URL configured', async () => {
      const logger = require('../src/utils/logger');
      const res = await request(app)
        .post('/ai-mode')
        .send({ mode: 'hybrid' });
      expect(res.status).toBe(200);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('hybrid mode requested but remote Ollama URL is not configured')
      );
    });
  });
});
```

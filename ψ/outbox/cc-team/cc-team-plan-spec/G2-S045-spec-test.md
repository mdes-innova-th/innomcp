<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S045 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":346,"completion_tokens":2657,"total_tokens":3003,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T11:33:21.602Z -->
```typescript
import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';

// Module under test - imported via the EXACT spec path
import agentStreamRouter from '../src/routes/api/agentStream';

// ---- Types derived from the public surface --------------------------------

interface AgentStreamChunk {
  id: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content: string;
  done: boolean;
}

interface StreamRequestBody {
  prompt?: string;
  sessionId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface StreamResponseBody {
  sessionId: string;
  status: 'started' | 'error';
  message?: string;
}

// ---- Mocks for external dependencies --------------------------------------

// Mock the underlying agent/LLM service so behavior is deterministic/offline.
const mockStreamAgent = jest.fn<
  Promise<AsyncIterable<AgentStreamChunk>>,
  [StreamRequestBody]
>();

jest.mock('../src/services/agentService', () => ({
  __esModule: true,
  default: mockStreamAgent,
}));

// Mock any session/persistence layer deterministically.
const mockSessionStore = {
  create: jest.fn<(sessionId: string) => Promise<void>>(),
  get: jest.fn<(sessionId: string) => Promise<{ id: string; createdAt: number } | null>>(),
  update: jest.fn<(sessionId: string, patch: object) => Promise<void>>(),
};

jest.mock('../src/services/sessionStore', () => mockSessionStore);

// ---- Helpers --------------------------------------------------------------

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/agent', agentStreamRouter);
  return app;
};

const okChunks = (chunks: AgentStreamChunk[]): AsyncIterable<AgentStreamChunk> => {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < chunks.length) {
            return { value: chunks[i++], done: false };
          }
          return { value: undefined as unknown as AgentStreamChunk, done: true };
        },
      };
    },
  };
};

// Reset all mocks between tests for isolation
beforeEach(() => {
  jest.clearAllMocks();
  mockSessionStore.create.mockResolvedValue(undefined);
  mockSessionStore.get.mockResolvedValue({ id: 'srv-session-1', createdAt: Date.now() });
  mockSessionStore.update.mockResolvedValue(undefined);
});

// ---- Tests -----------------------------------------------------------------

describe('agentStream route — contract', () => {
  describe('request validation', () => {
    it('rejects empty body with 400 and a JSON error payload', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/agent/stream').send({});

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'error',
          message: expect.any(String),
        })
      );
    });

    it('rejects non-string prompt with 400', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 12345 } satisfies StreamRequestBody);

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ status: 'error', message: expect.any(String) })
      );
    });

    it('rejects out-of-range temperature with 400', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'hi', temperature: 5 } satisfies StreamRequestBody);

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ status: 'error', message: expect.any(String) })
      );
    });

    it('rejects non-positive maxTokens with 400', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'hi', maxTokens: 0 } satisfies StreamRequestBody);

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ status: 'error', message: expect.any(String) })
      );
    });
  });

  describe('happy-path streaming contract', () => {
    it('streams chunks in order with correct SSE-like framing and terminates with a done chunk', async () => {
      const chunks: AgentStreamChunk[] = [
        { id: 'c1', type: 'message', content: 'Hello', done: false },
        { id: 'c2', type: 'message', content: ' world', done: false },
        { id: 'c3', type: 'done', content: '', done: true },
      ];
      mockStreamAgent.mockResolvedValue(okChunks(chunks));

      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'Say hi' } satisfies StreamRequestBody);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);

      const text = res.text;
      // Each non-done chunk should be framed as a "data:" event
      expect(text).toMatch(/data:\s*\{.*"type":"message".*"content":"Hello"/);
      expect(text).toMatch(/data:\s*\{.*"type":"message".*"content":" world"/);
      // Stream must terminate with the done sentinel
      expect(text).toMatch(/data:\s*\[DONE\]/);
      // Concatenated content should match the message chunks
      const dataLines = text
        .split('\n')
        .filter((l) => l.startsWith('data:') && !l.includes('[DONE]'))
        .map((l) => l.replace(/^data:\s*/, ''));
      const parsed = dataLines.map((l) => JSON.parse(l) as AgentStreamChunk);
      expect(parsed.map((c) => c.content).join('')).toBe('Hello world');
    });

    it('starts a session and returns its id in the initial response headers or body', async () => {
      mockStreamAgent.mockImplementation(async (req) => {
        // Server should have assigned/provided a sessionId before/with streaming
        expect(req.sessionId).toEqual(expect.any(String));
        return okChunks([{ id: 'c1', type: 'message', content: 'ok', done: false }]);
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'p' } satisfies StreamRequestBody);

      expect(res.status).toBe(200);
      // The contract guarantees a sessionId; it must be exposed somewhere observable.
      const sessionId = res.headers['x-session-id'] ?? res.body?.sessionId;
      expect(typeof sessionId).toBe('string');
      expect((sessionId as string).length).toBeGreaterThan(0);
    });
  });

  describe('error-path contract', () => {
    it('emits a single error event and terminates when the underlying agent throws', async () => {
      mockStreamAgent.mockRejectedValue(new Error('upstream boom'));

      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'p' } satisfies StreamRequestBody);

      // Either a non-200 status with JSON error, OR a stream that contains an error event
      if (res.status !== 200) {
        expect(res.status).toBeGreaterThanOrEqual(500);
        expect(res.body).toEqual(
          expect.objectContaining({ status: 'error', message: expect.any(String) })
        );
      } else {
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
        expect(res.text).toMatch(/data:\s*\{.*"type":"error".*"message":"upstream boom"/);
        expect(res.text).toMatch(/data:\s*\[DONE\]/);
      }
    });

    it('propagates tool_call and tool_result chunk types verbatim', async () => {
      const chunks: AgentStreamChunk[] = [
        { id: 'c1', type: 'tool_call', content: '{"name":"search"}', done: false },
        { id: 'c2', type: 'tool_result', content: '{"hits":1}', done: false },
        { id: 'c3', type: 'done', content: '', done: true },
      ];
      mockStreamAgent.mockResolvedValue(okChunks(chunks));

      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'use a tool' } satisfies StreamRequestBody);

      expect(res.status).toBe(200);
      expect(res.text).toMatch(/"type":"tool_call"/);
      expect(res.text).toMatch(/"type":"tool_result"/);
      expect(res.text).toMatch(/data:\s*\[DONE\]/);
    });
  });

  describe('routing & export contract', () => {
    it('exports a default Express router (function with .use/.get/.post stack)', () => {
      expect(agentStreamRouter).toBeDefined();
      // Express router is a function with a stack property
      expect(typeof agentStreamRouter).toBe('function');
      expect(Array.isArray((agentStreamRouter as unknown as { stack: unknown[] }).stack)).toBe(
        true
      );
    });

    it('only handles POST requests on the stream endpoint (GET should 404/405)', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/agent/stream');
      expect([404, 405]).toContain(res.status);
    });

    it('does not crash when a JSON-parseable body has extra unknown fields (forwarded or ignored safely)', async () => {
      mockStreamAgent.mockResolvedValue(
        okChunks([{ id: 'c1', type: 'message', content: 'ok', done: false }])
      );
      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'p', extra: { foo: 'bar' }, debug: true });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      }
    });
  });

  describe('boundary conditions', () => {
    it('accepts a very long prompt without truncating the body (passes through or errors cleanly)', async () => {
      const longPrompt = 'a'.repeat(20_000);
      mockStreamAgent.mockResolvedValue(
        okChunks([{ id: 'c1', type: 'message', content: 'ok', done: false }])
      );
      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: longPrompt } satisfies StreamRequestBody);

      expect([200, 413]).toContain(res.status);
    });

    it('treats an empty stream as a valid empty response that still terminates', async () => {
      mockStreamAgent.mockResolvedValue(okChunks([]));

      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'p' } satisfies StreamRequestBody);

      expect([200, 204]).toContain(res.status);
      if (res.status === 200) {
        expect(res.text).toMatch(/data:\s*\[DONE\]/);
      }
    });
  });
});

// Silence unused-import warnings for types used only via satisfies/JSDoc
type _Used = Request<Response, StreamResponseBody, StreamRequestBody> & {
  res: Response<StreamResponseBody>;
  next: NextFunction;
};
```

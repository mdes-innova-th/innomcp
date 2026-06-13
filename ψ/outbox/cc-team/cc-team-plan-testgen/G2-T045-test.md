<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T045 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1143,"completion_tokens":1652,"total_tokens":2795,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-13T11:00:29.696Z -->
```typescript
import express from 'express';
import http from 'http';
import request from 'supertest';

// Mocks MUST be registered before importing the router under test
jest.mock('../../services/agentLoop', () => {
  const original = jest.requireActual('express');
  return {
    runAgentLoop: jest.fn(),
  };
});

jest.mock('../../tools/registry', () => ({
  createRegistry: jest.fn(),
}));

import agentStreamRouter from '../src/routes/api/agentStream';
import { runAgentLoop } from '../../services/agentLoop';
import { createRegistry } from '../../tools/registry';

const mockedRunAgentLoop = runAgentLoop as jest.MockedFunction<typeof runAgentLoop>;
const mockedCreateRegistry = createRegistry as jest.MockedFunction<typeof createRegistry>;

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/agent', agentStreamRouter);
  return app;
}

describe('agentStream router', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedCreateRegistry.mockReturnValue({} as any);
    app = buildApp();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('input validation', () => {
    test('rejects missing task with 400', async () => {
      const res = await request(app).post('/api/agent/stream').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'task must be a non-empty string' });
      expect(mockedRunAgentLoop).not.toHaveBeenCalled();
    });

    test('rejects empty-string task with 400', async () => {
      const res = await request(app).post('/api/agent/stream').send({ task: '' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'task must be a non-empty string' });
    });

    test('rejects non-string task with 400', async () => {
      const res = await request(app).post('/api/agent/stream').send({ task: 123 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'task must be a non-empty string' });
    });
  });

  describe('successful streaming', () => {
    test('writes SSE headers, emits events, then a done marker', async () => {
      async function* fakeLoop() {
        yield { type: 'message', content: 'hello' } as any;
        yield { type: 'message', content: 'world' } as any;
      }
      mockedRunAgentLoop.mockImplementation(fakeLoop as any);

      const res = await request(app)
        .post('/api/agent/stream')
        .set('Accept', 'text/event-stream')
        .send({ task: 'do something' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/event-stream');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['connection']).toBe('keep-alive');
      expect(res.headers['x-accel-buffering']).toBe('no');

      expect(mockedCreateRegistry).toHaveBeenCalledTimes(1);
      expect(mockedRunAgentLoop).toHaveBeenCalledTimes(1);
      const callArgs = mockedRunAgentLoop.mock.calls[0][0];
      expect(callArgs.task).toBe('do something');
      expect(typeof callArgs.signal).toBe('object');
      expect(typeof callArgs.signal.abort).toBe('function');
      expect(callArgs.tools).toEqual({});

      const body = res.text;
      expect(body).toContain('data: {"type":"message","content":"hello"}');
      expect(body).toContain('data: {"type":"message","content":"world"}');
      expect(body).toContain('event: done');
      expect(body).toContain('data: {}');
    });

    test('passes projectId through to the agent loop when provided', async () => {
      async function* fakeLoop() {
        // yields nothing
      }
      mockedRunAgentLoop.mockImplementation(fakeLoop as any);

      const res = await request(app)
        .post('/api/agent/stream')
        .send({ task: 't', projectId: 'proj-42' });

      expect(res.status).toBe(200);
      expect(mockedRunAgentLoop.mock.calls[0][0].projectId).toBe('proj-42');
    });
  });

  describe('error handling', () => {
    test('emits SSE error event when the agent loop throws and connection still open', async () => {
      async function* fakeLoop() {
        yield { type: 'message', content: 'partial' } as any;
        throw new Error('boom');
      }
      mockedRunAgentLoop.mockImplementation(fakeLoop as any);

      const res = await request(app)
        .post('/api/agent/stream')
        .send({ task: 't' });

      expect(res.status).toBe(200);
      const body = res.text;
      expect(body).toContain('data: {"type":"message","content":"partial"}');
      expect(body).toContain('event: error');
      expect(body).toContain('boom');
    });

    test('emits a generic error message for non-Error throwables', async () => {
      async function* fakeLoop() {
        throw 'string-error';
      }
      mockedRunAgentLoop.mockImplementation(fakeLoop as any);

      const res = await request(app)
        .post('/api/agent/stream')
        .send({ task: 't' });

      expect(res.status).toBe(200);
      expect(res.text).toContain('Unknown error');
    });
  });

  describe('abort behaviour', () => {
    test('aborts the agent loop signal when the client disconnects', async () => {
      let capturedSignal: AbortSignal | undefined;
      async function* fakeLoop(opts: any) {
        capturedSignal = opts.signal;
        yield { type: 'message', content: 'tick' } as any;
      }
      mockedRunAgentLoop.mockImplementation(fakeLoop as any);

      // Start a real HTTP server so we can simulate a real client socket close.
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const received: string[] = [];
      const settled = new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/api/agent/stream',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              received.push(chunk);
              if (chunk.includes('event: done')) {
                req.destroy();
                resolve();
              }
            });
            res.on('end', () => resolve());
            res.on('error', () => resolve());
          },
        );
        req.on('error', () => resolve());
        req.write(JSON.stringify({ task: 't' }));
        req.end();
      });

      await settled;
      await new Promise<void>((resolve) => server.close(() => resolve()));

      expect(capturedSignal).toBeDefined();
      // The signal should be aborted either by client-close or by the finally block.
      expect(capturedSignal!.aborted).toBe(true);
    });
  });
});
```

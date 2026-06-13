<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T055 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":936,"completion_tokens":2803,"total_tokens":3739,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:02:45.043Z -->
```typescript
import { Request, Response } from 'express';

jest.mock('../../src/utils/db', () => ({
  withDbConnection: jest.fn(),
}));

import router from '../src/routes/api/feedback';
import { withDbConnection } from '../../src/utils/db';

const mockedWithDbConnection = withDbConnection as jest.MockedFunction<typeof withDbConnection>;

interface MiddlewareLayer {
  router: {
    stack: Array<{
      route?: {
        path: string;
        methods: Record<string, boolean>;
        stack: Array<{
          handle: (req: Request, res: Response, next: jest.Mock) => Promise<void> | void;
        }>;
      };
    }>;
  };
}

function getPostHandler(): (req: Request, res: Response) => Promise<void> | void {
  const layer = router as unknown as MiddlewareLayer;
  const route = layer.router.stack.find((s) => s.route && s.route.methods.post);
  if (!route || !route.route) {
    throw new Error('POST / route not found on feedback router');
  }
  return route.route.stack[0].handle;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    res.headersSent = true;
    return res;
  });
  return res as Response & {
    statusCode: number;
    body: unknown;
    status: jest.Mock;
    json: jest.Mock;
  };
}

function makeReq(body: unknown): Request {
  return { body } as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedWithDbConnection.mockImplementation(async (_fn) => {
    return undefined as any;
  });
});

describe('POST /api/chat/feedback', () => {
  test('responds 200 with { ok: true } for valid camelCase input and triggers DB insert', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-1', rating: 5, sessionId: 'sess-1' });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });

    // Wait microtask queue so the .catch handler attaches
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedWithDbConnection).toHaveBeenCalledTimes(1);
  });

  test('accepts snake_case aliases (message_id, session_id)', async () => {
    const handler = getPostHandler();
    const req = makeReq({ message_id: 'msg-2', rating: 3, session_id: 'sess-2' });
    const res = makeRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('passes correct params to withDbConnection callback (insert SQL and args)', async () => {
    let capturedQuery = '';
    let capturedArgs: unknown[] = [];
    mockedWithDbConnection.mockImplementation(async (fn: any) => {
      const conn = {
        query: jest.fn(async (q: string, args: unknown[]) => {
          capturedQuery = q;
          capturedArgs = args;
          return [];
        }),
      };
      await fn(conn);
      return undefined as any;
    });

    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-3', rating: 4, sessionId: 'sess-3' });
    const res = makeRes();

    await handler(req, res);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(capturedQuery).toBe(
      'INSERT INTO feedback (message_id, rating, session_id) VALUES (?, ?, ?)'
    );
    expect(capturedArgs).toEqual(['msg-3', 4, 'sess-3']);
  });

  test('passes null for session_id when not provided', async () => {
    let capturedArgs: unknown[] = [];
    mockedWithDbConnection.mockImplementation(async (fn: any) => {
      const conn = {
        query: jest.fn(async (_q: string, args: unknown[]) => {
          capturedArgs = args;
          return [];
        }),
      };
      await fn(conn);
      return undefined as any;
    });

    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-4', rating: 1 });
    const res = makeRes();

    await handler(req, res);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(capturedArgs).toEqual(['msg-4', 1, null]);
  });

  test('coerces numeric rating via Number()', async () => {
    let capturedArgs: unknown[] = [];
    mockedWithDbConnection.mockImplementation(async (fn: any) => {
      const conn = {
        query: jest.fn(async (_q: string, args: unknown[]) => {
          capturedArgs = args;
          return [];
        }),
      };
      await fn(conn);
      return undefined as any;
    });

    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-5', rating: '2' });
    const res = makeRes();

    await handler(req, res);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(capturedArgs[1]).toBe(2);
  });

  test('truncates message_id and session_id to 64 characters', async () => {
    let capturedArgs: unknown[] = [];
    mockedWithDbConnection.mockImplementation(async (fn: any) => {
      const conn = {
        query: jest.fn(async (_q: string, args: unknown[]) => {
          capturedArgs = args;
          return [];
        }),
      };
      await fn(conn);
      return undefined as any;
    });

    const longMsg = 'm'.repeat(200);
    const longSess = 's'.repeat(200);
    const handler = getPostHandler();
    const req = makeReq({ messageId: longMsg, rating: 5, sessionId: longSess });
    const res = makeRes();

    await handler(req, res);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect((capturedArgs[0] as string).length).toBe(64);
    expect((capturedArgs[2] as string).length).toBe(64);
  });

  test('responds 400 with "Invalid messageId" when messageId is missing', async () => {
    const handler = getPostHandler();
    const req = makeReq({ rating: 3 });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid messageId' });
    // Should not trigger DB write
    expect(mockedWithDbConnection).not.toHaveBeenCalled();
  });

  test('responds 400 with "Invalid messageId" when messageId is not a string', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 123, rating: 3 });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid messageId' });
    expect(mockedWithDbConnection).not.toHaveBeenCalled();
  });

  test('responds 400 when rating is missing', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-x' });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid rating: must be integer 1–5' });
    expect(mockedWithDbConnection).not.toHaveBeenCalled();
  });

  test('responds 400 when rating is below 1', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-x', rating: 0 });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid rating: must be integer 1–5' });
    expect(mockedWithDbConnection).not.toHaveBeenCalled();
  });

  test('responds 400 when rating is above 5', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-x', rating: 6 });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid rating: must be integer 1–5' });
    expect(mockedWithDbConnection).not.toHaveBeenCalled();
  });

  test('responds 400 when rating is a non-integer number', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-x', rating: 3.5 });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid rating: must be integer 1–5' });
    expect(mockedWithDbConnection).not.toHaveBeenCalled();
  });

  test('responds 400 when rating is NaN after coercion', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-x', rating: 'abc' });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid rating: must be integer 1–5' });
    expect(mockedWithDbConnection).not.toHaveBeenCalled();
  });

  test('accepts boundary ratings 1 and 5', async () => {
    const handler = getPostHandler();

    for (const rating of [1, 5]) {
      jest.clearAllMocks();
      mockedWithDbConnection.mockImplementation(async (_fn) => undefined as any);
      const req = makeReq({ messageId: 'msg-b', rating });
      const res = makeRes();

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(res.status).not.toHaveBeenCalled();
      expect(mockedWithDbConnection).toHaveBeenCalledTimes(1);
    }
  });

  test('prefers camelCase messageId over snake_case message_id when both provided', async () => {
    let capturedArgs: unknown[] = [];
    mockedWithDbConnection.mockImplementation(async (fn: any) => {
      const conn = {
        query: jest.fn(async (_q: string, args: unknown[]) => {
          capturedArgs = args;
          return [];
        }),
      };
      await fn(conn);
      return undefined as any;
    });

    const handler = getPostHandler();
    const req = makeReq({ messageId: 'camel', message_id: 'snake', rating: 2 });
    const res = makeRes();

    await handler(req, res);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(capturedArgs[0]).toBe('camel');
  });

  test('does not call res.status for successful responses', async () => {
    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-z', rating: 3 });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalled();
  });

  test('swallows DB errors via the .catch handler (does not throw to caller)', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedWithDbConnection.mockImplementation(async () => {
      throw new Error('db down');
    });

    const handler = getPostHandler();
    const req = makeReq({ messageId: 'msg-err', rating: 3 });
    const res = makeRes();

    await handler(req, res);
    // Drain microtasks so the .catch runs
    await Promise.resolve();
    await Promise.resolve();

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[feedback] DB insert error',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
```

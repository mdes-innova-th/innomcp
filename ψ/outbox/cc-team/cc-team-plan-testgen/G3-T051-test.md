<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T051 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2479,"completion_tokens":4224,"total_tokens":6703,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2391,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T11:02:15.414Z -->
```typescript
import chatStreamRouter from '../src/routes/api/chatStream';
import { runConductor } from '../../agents/conductor';
import { optionalAuth } from '../../utils/jwt';
import { guestLimiterMiddleware } from '../../middleware/guestLimiter';
import { createTask, completeTask, appendTaskStep } from './tasks';

jest.mock('../../agents/conductor', () => ({
  runConductor: jest.fn(),
}));

jest.mock('../../utils/jwt', () => ({
  optionalAuth: jest.fn((req, _res, next) => {
    // default: no user attached
    next();
  }),
}));

jest.mock('../../middleware/guestLimiter', () => ({
  guestLimiterMiddleware: jest.fn((req, _res, next) => {
    // default: no guest limits, not a guest
    req.guestLimits = undefined;
    req.isGuest = false;
    next();
  }),
  limitResponseLength: jest.fn((text: string, _limits: any) => text),
}));

jest.mock('./tasks', () => ({
  createTask: jest.fn(),
  completeTask: jest.fn(),
  appendTaskStep: jest.fn(),
}));

describe('chatStream route', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;
  let mockRunConductor: jest.Mock;
  let concurrencyEmit: (ev: any) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    mockRunConductor = jest.mocked(runConductor);
    mockRunConductor.mockImplementation(
      (input: any, opts: { emit: (ev: any) => void }) => {
        concurrencyEmit = opts.emit;
        return Promise.resolve();
      }
    );

    // Reset mocks
    jest.mocked(optionalAuth).mockImplementation((req, _res, next) => {
      req.user = null;
      next();
    });
    jest.mocked(guestLimiterMiddleware).mockImplementation((req, _res, next) => {
      req.guestLimits = undefined;
      req.isGuest = false;
      req.capabilityLevel = 100;
      next();
    });
    jest.mocked(createTask).mockResolvedValue(undefined);
    jest.mocked(completeTask).mockResolvedValue(undefined);
    jest.mocked(appendTaskStep).mockResolvedValue(undefined);

    req = {
      method: 'POST',
      url: '/',
      body: { message: 'Hello' },
      user: null,
    };
    res = {
      statusCode: 0,
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      write: jest.fn().mockReturnValue(true),
      end: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        if (event === 'close') res._closeHandler = handler;
      }),
      flushHeaders: jest.fn(),
      flush: jest.fn(),
      _closeHandler: undefined,
    } as any;
    next = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('responds with 400 when message is missing', async () => {
    req.body = {};
    await chatStreamRouter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  test('sets SSE headers and writes events', async () => {
    const promise = chatStreamRouter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(res.flushHeaders).toHaveBeenCalled();

    // Simulate conductor events
    const event1 = { type: 'thinking', content: '...' };
    const event2 = { type: 'draft_delta', deltaText: 'hello' };
    const event3 = { type: 'final_answer', finalText: 'Done' };

    concurrencyEmit(event1);
    concurrencyEmit(event2);
    concurrencyEmit(event3);

    // Wait for runConductor to resolve and cleanup
    await promise;

    expect(res.write).toHaveBeenCalledTimes(3);
    expect(res.write).toHaveBeenNthCalledWith(
      1,
      `event: ${event1.type}\ndata: ${JSON.stringify(event1)}\n\n`
    );
    expect(res.write).toHaveBeenNthCalledWith(
      2,
      `event: ${event2.type}\ndata: ${JSON.stringify(event2)}\n\n`
    );
    expect(res.write).toHaveBeenNthCalledWith(
      3,
      `event: ${event3.type}\ndata: ${JSON.stringify(event3)}\n\n`
    );
    expect(res.end).toHaveBeenCalled();
    expect(res.flush).toHaveBeenCalledTimes(3);
  });

  test('sends heartbeat every 15 seconds', async () => {
    const promise = chatStreamRouter(req, res, next);

    // Fast-forward 15 seconds
    jest.advanceTimersByTime(15000);
    expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');

    // Fast-forward another 15 seconds
    jest.advanceTimersByTime(15000);
    expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');

    // Clean up by emitting final_answer
    concurrencyEmit({ type: 'final_answer', finalText: 'x' });
    await promise;
    expect(res.end).toHaveBeenCalled();
  });

  test('applies guest limits to draft_delta events', async () => {
    jest.mocked(guestLimiterMiddleware).mockImplementation((req, _res, next) => {
      req.guestLimits = { maxResponseLength: 10, maxHistoryMessages: 5 };
      req.isGuest = true;
      req.capabilityLevel = 50;
      next();
    });

    const promise = chatStreamRouter(req, res, next);

    const draft1 = { type: 'draft_delta', deltaText: '1234567890' }; // exactly 10 chars
    const draft2 = { type: 'draft_delta', deltaText: 'extra' };      // should be null (no remaining)
    concurrencyEmit(draft1);
    concurrencyEmit(draft2);

    concurrencyEmit({ type: 'final_answer', finalText: 'Done' });
    await promise;

    // First draft should be passed through (clamped to 10, original length 10)
    expect(res.write).toHaveBeenCalledWith(
      `event: draft_delta\ndata: ${JSON.stringify(draft1)}\n\n`
    );
    // Second draft should be completely suppressed (null returned => not written)
    expect(res.write).not.toHaveBeenCalledWith(
      expect.stringContaining('extra')
    );
  });

  test('client disconnect triggers cleanup', async () => {
    const promise = chatStreamRouter(req, res, next);
    // Simulate client closing connection
    res._closeHandler();
    // Conductor still resolves
    await promise;
    // End should have been called exactly once (by cleanup)
    expect(res.end).toHaveBeenCalledTimes(1);
    // Heartbeat interval cleared (no further writes)
    jest.advanceTimersByTime(30000);
    expect(res.write).not.toHaveBeenCalledWith(': heartbeat\n\n');
  });

  test('error event from conductor is written and stream closes', async () => {
    const promise = chatStreamRouter(req, res, next);
    const errEvent = { type: 'error', error: 'API failure' };
    concurrencyEmit(errEvent);
    await promise;
    expect(res.write).toHaveBeenCalledWith(
      `event: error\ndata: ${JSON.stringify(errEvent)}\n\n`
    );
    expect(res.end).toHaveBeenCalled();
  });
});
```

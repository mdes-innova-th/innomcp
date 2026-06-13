<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S075 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":355,"completion_tokens":2108,"total_tokens":2463,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:43:21.233Z -->
```typescript
import { WebSocketServer } from 'ws';
import { roomWSS } from '../src/routes/api/roomWss';

jest.mock('ws', () => {
  class FakeWebSocket {
    public static instances: FakeWebSocket[] = [];
    public readyState: number = 0;
    public sent: string[] = [];
    public closeCode: number | null = null;

    constructor(public url: string) {
      FakeWebSocket.instances.push(this);
    }

    send(data: string) {
      this.sent.push(data);
    }

    close(code?: number) {
      this.closeCode = code ?? 1000;
      this.readyState = 3;
    }
  }

  class FakeWebSocketServer {
    public static instances: FakeWebSocketServer[] = [];
    public options: any;
    public connectionHandler: ((ws: any, req: any) => void) | null = null;
    public upgradeHandler: ((req: any, socket: any, head: any) => void) | null = null;
    public handleUpgradeCalls: Array<{ req: any; socket: any; head: any }> = [];

    constructor(options: any) {
      this.options = options;
      FakeWebSocketServer.instances.push(this);
    }

    on(event: string, handler: any) {
      if (event === 'connection') this.connectionHandler = handler;
      if (event === 'upgrade') this.upgradeHandler = handler;
      return this;
    }

    handleUpgrade(req: any, socket: any, head: any, callback: (ws: any) => void) {
      this.handleUpgradeCalls.push({ req, socket, head });
      const ws = new FakeWebSocket(req.url);
      callback(ws);
    }

    shouldHandle(req: any) {
      return Boolean(req.url && req.url.startsWith(this.options.path));
    }
  }

  return {
    WebSocket: FakeWebSocket,
    WebSocketServer: FakeWebSocketServer,
  };
});

import { WebSocket as FakeWS, WebSocketServer as FakeWSS } from 'ws';

describe('roomWss module — public contract', () => {
  beforeEach(() => {
    (FakeWS as any).instances = [];
    (FakeWSS as any).instances = [];
  });

  it('exports a non-null roomWSS instance', () => {
    expect(roomWSS).not.toBeNull();
    expect(roomWSS).toBeDefined();
  });

  it('is a single, stable module-level singleton across re-imports', () => {
    const refA = roomWSS;
    const refB = roomWSS;
    expect(refA).toBe(refB);
  });

  it('constructs a WebSocketServer configured with noServer: true', () => {
    const constructed = (FakeWSS as any).instances;
    expect(constructed.length).toBe(1);
    expect(constructed[0].options).toEqual({ noServer: true });
  });

  it('is the SAME instance as the one created in the module (identity)', () => {
    const constructed = (FakeWSS as any).instances[0];
    expect(roomWSS).toBe(constructed);
  });

  it('extends the ws.WebSocketServer API (has on/handleUpgrade/shouldHandle)', () => {
    expect(typeof (roomWSS as any).on).toBe('function');
    expect(typeof (roomWSS as any).handleUpgrade).toBe('function');
    expect(typeof (roomWSS as any).shouldHandle).toBe('function');
  });

  it('does NOT auto-create a server listener (noServer contract)', () => {
    const constructed = (FakeWSS as any).instances[0];
    expect(constructed.options.noServer).toBe(true);
  });

  it('emits "connection" event when a new client completes the upgrade handshake', () => {
    const constructed = (FakeWSS as any).instances[0];
    const handler = jest.fn();
    roomWSS.on('connection', handler);

    const fakeReq = { url: '/roomWss' };
    const fakeSocket = { destroy: jest.fn() };
    const fakeHead = Buffer.alloc(0);

    (roomWSS as any).handleUpgrade(fakeReq, fakeSocket, fakeHead, () => {
      const ws = (FakeWS as any).instances[(FakeWS as any).instances.length - 1];
      if (constructed.connectionHandler) {
        constructed.connectionHandler(ws, fakeReq);
      }
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeDefined();
    expect(handler.mock.calls[0][1]).toBe(fakeReq);
  });

  it('routes upgrade requests whose path starts with the configured path (shouldHandle)', () => {
    const constructed = (FakeWSS as any).instances[0];
    constructed.options.path = '/roomWss';

    expect((roomWSS as any).shouldHandle({ url: '/roomWss' })).toBe(true);
    expect((roomWSS as any).shouldHandle({ url: '/roomWss/123' })).toBe(true);
  });

  it('rejects upgrade requests for unrelated paths (shouldHandle boundary)', () => {
    const constructed = (FakeWSS as any).instances[0];
    constructed.options.path = '/roomWss';

    expect((roomWSS as any).shouldHandle({ url: '/other' })).toBe(false);
    expect((roomWSS as any).shouldHandle({ url: '/rooms' })).toBe(false);
    expect((roomWSS as any).shouldHandle({ url: '' })).toBe(false);
    expect((roomWSS as any).shouldHandle({})).toBe(false);
  });

  it('forwarded message to a connected client is observable on that client (send round-trip)', () => {
    const constructed = (FakeWSS as any).instances[0];
    let capturedWs: any = null;
    roomWSS.on('connection', (ws: any) => {
      capturedWs = ws;
    });

    const fakeReq = { url: '/roomWss' };
    const fakeSocket = { destroy: jest.fn() };
    const fakeHead = Buffer.alloc(0);

    (roomWSS as any).handleUpgrade(fakeReq, fakeSocket, fakeHead, () => {
      const ws = (FakeWS as any).instances[(FakeWS as any).instances.length - 1];
      if (constructed.connectionHandler) {
        constructed.connectionHandler(ws, fakeReq);
      }
    });

    expect(capturedWs).not.toBeNull();
    capturedWs.send(JSON.stringify({ type: 'hello' }));
    expect(capturedWs.sent).toEqual([JSON.stringify({ type: 'hello' })]);
  });

  it('close propagation: closing the assigned ws ends the client observable state', () => {
    const constructed = (FakeWSS as any).instances[0];
    let capturedWs: any = null;
    roomWSS.on('connection', (ws: any) => {
      capturedWs = ws;
    });

    const fakeReq = { url: '/roomWss' };
    const fakeSocket = { destroy: jest.fn() };

    (roomWSS as any).handleUpgrade(fakeReq, fakeSocket, Buffer.alloc(0), () => {
      const ws = (FakeWS as any).instances[(FakeWS as any).instances.length - 1];
      if (constructed.connectionHandler) {
        constructed.connectionHandler(ws, fakeReq);
      }
    });

    expect(capturedWs.readyState).toBe(0);
    capturedWs.close(1000);
    expect(capturedWs.readyState).toBe(3);
    expect(capturedWs.closeCode).toBe(1000);
  });

  it('boundary: multiple upgrades produce independent websocket instances', () => {
    const constructed = (FakeWSS as any).instances[0];
    const seen: any[] = [];
    roomWSS.on('connection', (ws: any) => seen.push(ws));

    for (let i = 0; i < 3; i++) {
      const req = { url: '/roomWss' };
      const socket = { destroy: jest.fn() };
      (roomWSS as any).handleUpgrade(req, socket, Buffer.alloc(0), () => {
        const ws = (FakeWS as any).instances[(FakeWS as any).instances.length - 1];
        if (constructed.connectionHandler) {
          constructed.connectionHandler(ws, req);
        }
      });
    }

    expect(seen.length).toBe(3);
    expect(new Set(seen).size).toBe(3);
  });

  it('boundary: empty / falsy upgrade requests do not throw at the contract surface', () => {
    expect(() => (roomWSS as any).shouldHandle(undefined)).not.toThrow();
    expect((roomWSS as any).shouldHandle(undefined)).toBe(false);
    expect((roomWSS as any).shouldHandle(null)).toBe(false);
  });

  it('handleUpgrade records the call so an external http server can delegate (noServer contract)', () => {
    const constructed = (FakeWSS as any).instances[0];
    const req = { url: '/roomWss' };
    const socket = { destroy: jest.fn() };
    const head = Buffer.from([0x00]);

    (roomWSS as any).handleUpgrade(req, socket, head, () => undefined);

    expect(constructed.handleUpgradeCalls.length).toBe(1);
    expect(constructed.handleUpgradeCalls[0].req).toBe(req);
    expect(constructed.handleUpgradeCalls[0].socket).toBe(socket);
    expect(constructed.handleUpgradeCalls[0].head).toBe(head);
  });
});
```

<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T075 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1607,"completion_tokens":2204,"total_tokens":3811,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:06:53.362Z -->
```typescript
import { EventEmitter } from "events";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";
import * as roomService from "../../src/services/roomService";
import { verifyToken } from "../../src/utils/jwt";
import logger from "../../src/utils/logger";
import { roomWSS } from "../src/routes/api/roomWss";

jest.mock("ws", () => {
  const { EventEmitter } = require("events");
  class MockWebSocket extends EventEmitter {
    public sent: string[] = [];
    public closeCode: number | undefined;
    public closeReason: string | undefined;
    send(data: string) {
      this.sent.push(data);
    }
    close(code?: number, reason?: string) {
      this.closeCode = code;
      this.closeReason = reason;
      this.emit("close");
    }
  }
  class MockWebSocketServer extends EventEmitter {
    options: unknown;
    constructor(opts: unknown) {
      super();
      this.options = opts;
    }
  }
  return { WebSocket: MockWebSocket, WebSocketServer: MockWebSocketServer };
});

jest.mock("../../src/services/roomService", () => ({
  joinRoom: jest.fn(),
  leaveRoom: jest.fn(),
  broadcastToRoom: jest.fn(),
}));

jest.mock("../../src/utils/jwt", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

type AnyMock = jest.Mock;

const mockedRoomService = roomService as unknown as {
  joinRoom: AnyMock;
  leaveRoom: AnyMock;
  broadcastToRoom: AnyMock;
};
const mockedVerifyToken = verifyToken as unknown as AnyMock;
const mockedLogger = logger as unknown as {
  info: AnyMock;
  warn: AnyMock;
  error: AnyMock;
};

const makeRequest = (url: string): http.IncomingMessage =>
  ({ url } as unknown as http.IncomingMessage);

const emitConnection = (url: string): WebSocket => {
  const ws = new WebSocket("ws://localhost") as unknown as WebSocket;
  const req = makeRequest(url);
  (roomWSS as unknown as EventEmitter).emit("connection", ws, req);
  return ws;
};

describe("roomWSS", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("is a noServer WebSocketServer", () => {
    expect(roomWSS).toBeInstanceOf(WebSocketServer);
    expect((roomWSS as unknown as { options: { noServer?: boolean } }).options).toEqual(
      expect.objectContaining({ noServer: true })
    );
  });

  test("registers a connection listener at import time", () => {
    expect(roomWSS.listenerCount("connection")).toBe(1);
  });

  describe("authentication & validation", () => {
    test("rejects connection with no token (close 4001)", () => {
      const ws = new WebSocket("ws://localhost") as unknown as WebSocket;
      const closeSpy = jest.spyOn(ws, "close");
      const req = makeRequest("/room?projectId=5");

      (roomWSS as unknown as EventEmitter).emit("connection", ws, req);

      expect(closeSpy).toHaveBeenCalledWith(4001, "Unauthorized: token required");
      expect(mockedRoomService.joinRoom).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "[roomWss] Rejected: no token provided"
      );
    });

    test("rejects connection with invalid token (close 4001)", () => {
      mockedVerifyToken.mockReturnValue(null);

      const ws = new WebSocket("ws://localhost") as unknown as WebSocket;
      const closeSpy = jest.spyOn(ws, "close");
      const req = makeRequest("/room?projectId=5&token=bad");

      (roomWSS as unknown as EventEmitter).emit("connection", ws, req);

      expect(closeSpy).toHaveBeenCalledWith(4001, "Unauthorized: invalid token");
      expect(mockedRoomService.joinRoom).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "[roomWss] Rejected: invalid or expired token"
      );
    });

    test.each([
      ["/room?token=good", "missing projectId"],
      ["/room?projectId=abc&token=good", "non-numeric projectId"],
      ["/room?projectId=0&token=good", "zero projectId"],
      ["/room?projectId=-3&token=good", "negative projectId"],
    ])("rejects %s (close 4002)", (url) => {
      mockedVerifyToken.mockReturnValue({ userId: 7, userEmail: "u@example.com" });

      const ws = new WebSocket("ws://localhost") as unknown as WebSocket;
      const closeSpy = jest.spyOn(ws, "close");
      const req = makeRequest(url);

      (roomWSS as unknown as EventEmitter).emit("connection", ws, req);

      expect(closeSpy).toHaveBeenCalledWith(4002, "Bad Request: projectId required");
      expect(mockedRoomService.joinRoom).not.toHaveBeenCalled();
    });

    test("accepts valid token + projectId and joins the room", () => {
      mockedVerifyToken.mockReturnValue({
        userId: 42,
        userEmail: "alice@example.com",
        userDispName: "Alice",
      });

      const ws = emitConnection("/room?projectId=9&token=ok");

      expect(mockedRoomService.joinRoom).toHaveBeenCalledWith(9, ws, 42, "Alice");
      expect(mockedLogger.info).toHaveBeenCalledWith(
        "[roomWss] User 42 (Alice) joined project room 9"
      );
    });

    test("falls back to userEmail then userId for displayName", () => {
      mockedVerifyToken.mockReturnValue({ userId: 3, userEmail: "bob@example.com" });
      emitConnection("/room?projectId=1&token=ok");
      expect(mockedRoomService.joinRoom).toHaveBeenCalledWith(1, expect.anything(), 3, "bob@example.com");

      jest.clearAllMocks();
      mockedVerifyToken.mockReturnValue({ userId: 8 });
      emitConnection("/room?projectId=2&token=ok");
      expect(mockedRoomService.joinRoom).toHaveBeenCalledWith(2, expect.anything(), 8, "8");
    });
  });

  describe("message handling", () => {
    const setupJoinedSocket = () => {
      mockedVerifyToken.mockReturnValue({
        userId: 11,
        userEmail: "carol@example.com",
        userDispName: "Carol",
      });
      return emitConnection("/room?projectId=4&token=ok");
    };

    test("broadcasts typing_start with displayName, excluding sender", () => {
      const ws = setupJoinedSocket();
      ws.emit("message", Buffer.from(JSON.stringify({ type: "typing_start" })));
      expect(mockedRoomService.broadcastToRoom).toHaveBeenCalledWith(
        4,
        { type: "typing_start", userId: 11, displayName: "Carol" },
        ws
      );
    });

    test("broadcasts typing_stop with only userId, excluding sender", () => {
      const ws = setupJoinedSocket();
      ws.emit("message", Buffer.from(JSON.stringify({ type: "typing_stop" })));
      expect(mockedRoomService.broadcastToRoom).toHaveBeenCalledWith(
        4,
        { type: "typing_stop", userId: 11 },
        ws
      );
    });

    test("silently drops unknown message types", () => {
      const ws = setupJoinedSocket();
      ws.emit("message", Buffer.from(JSON.stringify({ type: "ping" })));
      ws.emit("message", Buffer.from(JSON.stringify({ type: 123 })));
      expect(mockedRoomService.broadcastToRoom).not.toHaveBeenCalled();
    });

    test("ignores non-JSON payloads", () => {
      const ws = setupJoinedSocket();
      ws.emit("message", Buffer.from("not json"));
      ws.emit("message", "also not json");
      expect(mockedRoomService.broadcastToRoom).not.toHaveBeenCalled();
    });

    test("ignores messages missing a string type", () => {
      const ws = setupJoinedSocket();
      ws.emit("message", Buffer.from(JSON.stringify({ foo: "bar" })));
      ws.emit("message", Buffer.from(JSON.stringify({ type: 7 })));
      expect(mockedRoomService.broadcastToRoom).not.toHaveBeenCalled();
    });
  });

  describe("lifecycle", () => {
    test("on close, leaves the room and logs", () => {
      mockedVerifyToken.mockReturnValue({
        userId: 21,
        userEmail: "dan@example.com",
        userDispName: "Dan",
      });
      const ws = emitConnection("/room?projectId=6&token=ok");
      jest.clearAllMocks();

      ws.emit("close");

      expect(mockedRoomService.leaveRoom).toHaveBeenCalledWith(6, ws, 21);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        "[roomWss] User 21 left project room 6"
      );
    });

    test("on error, logs a warning; cleanup is delegated to close", () => {
      mockedVerifyToken.mockReturnValue({
        userId: 22,
        userEmail: "eve@example.com",
        userDispName: "Eve",
      });
      const ws = emitConnection("/room?projectId=7&token=ok");
      jest.clearAllMocks();

      ws.emit("error", new Error("boom"));

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "[roomWss] Socket error for user 22: boom"
      );
      expect(mockedRoomService.leaveRoom).not.toHaveBeenCalled();
    });
  });
});
```

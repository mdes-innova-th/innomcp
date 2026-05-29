/**
 * Unit tests for src/services/roomService.ts (Phase 9)
 *
 * Each describe block calls loadModule() which resets the module registry so
 * the in-memory projectRooms Map is fresh for every test — no cross-test state
 * pollution. presenceService is fully mocked so no DB or network required.
 *
 * WebSocket clients are faked as plain objects: { readyState: 1, send: jest.fn() }
 * The ws library's WebSocket.OPEN constant equals 1.
 */

import type {
  joinRoom as JoinRoomFn,
  leaveRoom as LeaveRoomFn,
  broadcastToRoom as BroadcastToRoomFn,
  getRoomSize as GetRoomSizeFn,
} from "../../src/services/roomService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal fake WebSocket that satisfies the readyState + send contract. */
function makeWs(readyState = 1) {
  return { readyState, send: jest.fn() };
}

/**
 * loadModule — resets Jest's module registry, installs a fresh presenceService
 * mock, then requires roomService so the module-level Map starts empty.
 *
 * Returns both the roomService exports and the mock presenceService so tests
 * can assert on join/leave calls.
 */
function loadModule() {
  jest.resetModules();

  // Mock presenceService before roomService is required
  jest.mock("../../src/services/presenceService", () => ({
    join: jest.fn(),
    leave: jest.fn(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const roomService = require("../../src/services/roomService") as {
    joinRoom: typeof JoinRoomFn;
    leaveRoom: typeof LeaveRoomFn;
    broadcastToRoom: typeof BroadcastToRoomFn;
    getRoomSize: typeof GetRoomSizeFn;
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const presenceMock = require("../../src/services/presenceService") as {
    join: jest.Mock;
    leave: jest.Mock;
  };

  return { roomService, presenceMock };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("roomService", () => {
  // ── joinRoom ─────────────────────────────────────────────────────────────

  describe("joinRoom", () => {
    it("joinRoom adds the ws client to the room", () => {
      const { roomService } = loadModule();
      const ws = makeWs();

      roomService.joinRoom(1, ws as any, 42, "Alice");

      expect(roomService.getRoomSize(1)).toBe(1);
    });

    it("joinRoom calls presenceService.join with correct args", () => {
      const { roomService, presenceMock } = loadModule();
      const ws = makeWs();

      roomService.joinRoom(5, ws as any, 99, "Bob");

      expect(presenceMock.join).toHaveBeenCalledTimes(1);
      expect(presenceMock.join).toHaveBeenCalledWith(5, 99, "Bob");
    });

    it("joinRoom broadcasts user_joined to other clients in the room but not to the joining client", () => {
      const { roomService } = loadModule();

      const existing = makeWs();
      // Pre-populate the room by joining with the existing client
      roomService.joinRoom(1, existing as any, 10, "Existing");

      // Now a second client joins — existing should receive user_joined
      const joiner = makeWs();
      roomService.joinRoom(1, joiner as any, 11, "Joiner");

      // existing should have received exactly one message
      expect(existing.send).toHaveBeenCalledTimes(1);
      const msg = JSON.parse(existing.send.mock.calls[0][0]);
      expect(msg).toEqual({ type: "user_joined", userId: 11, displayName: "Joiner" });

      // The joining client itself must NOT receive the broadcast
      // (it receives nothing because it was the excludeWs argument)
      // Note: joiner.send may be 0 or 1 calls from the first joinRoom; we check
      // it was excluded from the SECOND joinRoom broadcast specifically.
      // Since the first joinRoom has no other clients, existing.send was not
      // called for that one. We only care the joiner did not get its own event.
      const joinerCalls = joiner.send.mock.calls.map((c: any[]) => JSON.parse(c[0]));
      expect(joinerCalls.some((m: any) => m.type === "user_joined" && m.userId === 11)).toBe(false);
    });

    it("joinRoom with multiple clients adds all to the same room", () => {
      const { roomService } = loadModule();

      roomService.joinRoom(1, makeWs() as any, 1, "A");
      roomService.joinRoom(1, makeWs() as any, 2, "B");
      roomService.joinRoom(1, makeWs() as any, 3, "C");

      expect(roomService.getRoomSize(1)).toBe(3);
    });
  });

  // ── leaveRoom ────────────────────────────────────────────────────────────

  describe("leaveRoom", () => {
    it("leaveRoom removes the client and decrements room size", () => {
      const { roomService } = loadModule();
      const ws = makeWs();

      roomService.joinRoom(1, ws as any, 42, "Alice");
      roomService.leaveRoom(1, ws as any, 42);

      expect(roomService.getRoomSize(1)).toBe(0);
    });

    it("leaveRoom calls presenceService.leave with correct args", () => {
      const { roomService, presenceMock } = loadModule();
      const ws = makeWs();

      roomService.joinRoom(1, ws as any, 42, "Alice");
      roomService.leaveRoom(1, ws as any, 42);

      expect(presenceMock.leave).toHaveBeenCalledTimes(1);
      expect(presenceMock.leave).toHaveBeenCalledWith(1, 42);
    });

    it("leaveRoom broadcasts user_left to remaining clients", () => {
      const { roomService } = loadModule();

      const ws1 = makeWs();
      const ws2 = makeWs();

      roomService.joinRoom(1, ws1 as any, 10, "Alice");
      roomService.joinRoom(1, ws2 as any, 11, "Bob");

      // Clear send call history from joinRoom broadcasts
      ws1.send.mockClear();
      ws2.send.mockClear();

      roomService.leaveRoom(1, ws1 as any, 10);

      // ws2 (remaining) should receive user_left
      expect(ws2.send).toHaveBeenCalledTimes(1);
      const msg = JSON.parse(ws2.send.mock.calls[0][0]);
      expect(msg).toEqual({ type: "user_left", userId: 10 });
    });

    it("leaveRoom on a non-existent room is a no-op — does not throw", () => {
      const { roomService } = loadModule();
      const ws = makeWs();

      expect(() => roomService.leaveRoom(9999, ws as any, 1)).not.toThrow();
    });

    it("leaveRoom is idempotent — calling twice does not throw", () => {
      const { roomService } = loadModule();
      const ws = makeWs();

      roomService.joinRoom(1, ws as any, 42, "Alice");
      roomService.leaveRoom(1, ws as any, 42);

      expect(() => roomService.leaveRoom(1, ws as any, 42)).not.toThrow();
    });
  });

  // ── broadcastToRoom ──────────────────────────────────────────────────────

  describe("broadcastToRoom", () => {
    it("sends JSON payload to all OPEN clients in the room", () => {
      const { roomService } = loadModule();

      const ws1 = makeWs(); // readyState 1 = OPEN
      const ws2 = makeWs();

      roomService.joinRoom(1, ws1 as any, 10, "A");
      roomService.joinRoom(1, ws2 as any, 11, "B");

      ws1.send.mockClear();
      ws2.send.mockClear();

      roomService.broadcastToRoom(1, { type: "ping" });

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
      expect(JSON.parse(ws1.send.mock.calls[0][0])).toEqual({ type: "ping" });
      expect(JSON.parse(ws2.send.mock.calls[0][0])).toEqual({ type: "ping" });
    });

    it("skips non-OPEN clients (readyState !== 1)", () => {
      const { roomService } = loadModule();

      const wsOpen   = makeWs(1); // OPEN
      const wsClosed = makeWs(3); // CLOSED

      roomService.joinRoom(1, wsOpen   as any, 10, "Open");
      roomService.joinRoom(1, wsClosed as any, 11, "Closed");

      wsOpen.send.mockClear();
      wsClosed.send.mockClear();

      roomService.broadcastToRoom(1, { type: "event" });

      expect(wsOpen.send).toHaveBeenCalledTimes(1);
      expect(wsClosed.send).not.toHaveBeenCalled();
    });

    it("excludes the specified excludeWs client from broadcast", () => {
      const { roomService } = loadModule();

      const ws1 = makeWs();
      const ws2 = makeWs();

      roomService.joinRoom(1, ws1 as any, 10, "A");
      roomService.joinRoom(1, ws2 as any, 11, "B");

      ws1.send.mockClear();
      ws2.send.mockClear();

      roomService.broadcastToRoom(1, { type: "update" }, ws1 as any);

      // ws1 excluded — ws2 should receive it
      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });

    it("is a no-op for an unknown project room — does not throw", () => {
      const { roomService } = loadModule();

      expect(() => roomService.broadcastToRoom(9999, { type: "test" })).not.toThrow();
    });
  });

  // ── getRoomSize ──────────────────────────────────────────────────────────

  describe("getRoomSize", () => {
    it("returns 0 for a project that has no room yet", () => {
      const { roomService } = loadModule();

      expect(roomService.getRoomSize(42)).toBe(0);
    });

    it("returns the correct count after joins", () => {
      const { roomService } = loadModule();

      roomService.joinRoom(1, makeWs() as any, 1, "A");
      roomService.joinRoom(1, makeWs() as any, 2, "B");

      expect(roomService.getRoomSize(1)).toBe(2);
    });

    it("decrements after a leave", () => {
      const { roomService } = loadModule();
      const ws = makeWs();

      roomService.joinRoom(1, ws as any, 1, "A");
      roomService.joinRoom(1, makeWs() as any, 2, "B");
      roomService.leaveRoom(1, ws as any, 1);

      expect(roomService.getRoomSize(1)).toBe(1);
    });

    it("returns 0 after the last client leaves (room is cleaned up)", () => {
      const { roomService } = loadModule();
      const ws = makeWs();

      roomService.joinRoom(1, ws as any, 1, "A");
      roomService.leaveRoom(1, ws as any, 1);

      expect(roomService.getRoomSize(1)).toBe(0);
    });

    it("counts clients in separate rooms independently", () => {
      const { roomService } = loadModule();

      roomService.joinRoom(1, makeWs() as any, 1, "A");
      roomService.joinRoom(2, makeWs() as any, 2, "B");
      roomService.joinRoom(2, makeWs() as any, 3, "C");

      expect(roomService.getRoomSize(1)).toBe(1);
      expect(roomService.getRoomSize(2)).toBe(2);
    });
  });
});

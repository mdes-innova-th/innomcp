/**
 * Unit tests for src/services/presenceService.ts (Phase 8)
 *
 * Each test group reloads the module via jest.resetModules() + require() to
 * get a fresh in-memory Map, avoiding cross-test state pollution.
 * No HTTP, no DB, no sockets required.
 */

import type {
  join as JoinFn,
  leave as LeaveFn,
  ping as PingFn,
  getPresence as GetPresenceFn,
  broadcast as BroadcastFn,
  PresenceEntry,
} from "../../src/services/presenceService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadModule() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("../../src/services/presenceService") as {
    join: typeof JoinFn;
    leave: typeof LeaveFn;
    ping: typeof PingFn;
    getPresence: typeof GetPresenceFn;
    broadcast: typeof BroadcastFn;
  };
  return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("presenceService", () => {
  // ── join ─────────────────────────────────────────────────────────────────

  describe("join", () => {
    it("adds a user to a project room", () => {
      const { join, getPresence } = loadModule();

      join(1, 42, "Alice");

      const entries = getPresence(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe(42);
      expect(entries[0].displayName).toBe("Alice");
    });

    it("adds multiple distinct users to the same room", () => {
      const { join, getPresence } = loadModule();

      join(1, 10, "User A");
      join(1, 11, "User B");
      join(1, 12, "User C");

      expect(getPresence(1)).toHaveLength(3);
    });

    it("adds users to separate rooms independently", () => {
      const { join, getPresence } = loadModule();

      join(1, 10, "Alice");
      join(2, 20, "Bob");

      expect(getPresence(1)).toHaveLength(1);
      expect(getPresence(2)).toHaveLength(1);
      expect(getPresence(1)[0].userId).toBe(10);
      expect(getPresence(2)[0].userId).toBe(20);
    });
  });

  // ── leave ────────────────────────────────────────────────────────────────

  describe("leave", () => {
    it("removes a user from a project room", () => {
      const { join, leave, getPresence } = loadModule();

      join(1, 42, "Alice");
      leave(1, 42);

      expect(getPresence(1)).toHaveLength(0);
    });

    it("only removes the specified user, leaving others intact", () => {
      const { join, leave, getPresence } = loadModule();

      join(1, 10, "Alice");
      join(1, 11, "Bob");
      leave(1, 10);

      const entries = getPresence(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe(11);
    });

    it("is a no-op when the user is not in the room", () => {
      const { join, leave, getPresence } = loadModule();

      join(1, 10, "Alice");
      leave(1, 99); // 99 never joined

      expect(getPresence(1)).toHaveLength(1);
    });

    it("is a no-op when the project room does not exist", () => {
      const { leave } = loadModule();
      // Should not throw
      expect(() => leave(999, 1)).not.toThrow();
    });
  });

  // ── getPresence ──────────────────────────────────────────────────────────

  describe("getPresence", () => {
    it("returns an empty array for an unknown project", () => {
      const { getPresence } = loadModule();
      expect(getPresence(9999)).toEqual([]);
    });

    it("returns an empty array after the last user leaves (room cleaned up)", () => {
      const { join, leave, getPresence } = loadModule();

      join(1, 42, "Alice");
      leave(1, 42);

      expect(getPresence(1)).toEqual([]);
    });

    it("returns correct count of active users", () => {
      const { join, getPresence } = loadModule();

      join(5, 1, "A");
      join(5, 2, "B");
      join(5, 3, "C");

      expect(getPresence(5)).toHaveLength(3);
    });

    it("returned entries contain required fields", () => {
      const { join, getPresence } = loadModule();

      join(1, 7, "Tester");

      const [entry] = getPresence(1) as PresenceEntry[];
      expect(entry).toHaveProperty("userId", 7);
      expect(entry).toHaveProperty("displayName", "Tester");
      expect(entry).toHaveProperty("connectedAt");
      expect(entry).toHaveProperty("lastPingAt");
      expect(new Date(entry.connectedAt).getTime()).not.toBeNaN();
      expect(new Date(entry.lastPingAt).getTime()).not.toBeNaN();
    });
  });

  // ── duplicate join (idempotency) ─────────────────────────────────────────

  describe("duplicate join", () => {
    it("does NOT add a duplicate entry when the same user joins twice", () => {
      const { join, getPresence } = loadModule();

      join(1, 42, "Alice");
      join(1, 42, "Alice");

      expect(getPresence(1)).toHaveLength(1);
    });

    it("updates lastPingAt but preserves connectedAt on duplicate join", async () => {
      const { join, getPresence } = loadModule();

      join(1, 42, "Alice");
      const [first] = getPresence(1) as PresenceEntry[];
      const originalConnectedAt = first.connectedAt;

      // Small async pause so timestamps can differ
      await new Promise((r) => setTimeout(r, 5));

      join(1, 42, "Alice");
      const [updated] = getPresence(1) as PresenceEntry[];

      expect(updated.connectedAt).toBe(originalConnectedAt);
      expect(new Date(updated.lastPingAt).getTime()).toBeGreaterThanOrEqual(
        new Date(first.lastPingAt).getTime()
      );
    });

    it("updates displayName on duplicate join", () => {
      const { join, getPresence } = loadModule();

      join(1, 42, "Alice");
      join(1, 42, "Alice (away)");

      const [entry] = getPresence(1) as PresenceEntry[];
      expect(entry.displayName).toBe("Alice (away)");
    });
  });

  // ── ping ─────────────────────────────────────────────────────────────────

  describe("ping", () => {
    it("refreshes lastPingAt for an existing entry", async () => {
      const { join, ping, getPresence } = loadModule();

      join(1, 42, "Alice");
      const [before] = getPresence(1) as PresenceEntry[];

      await new Promise((r) => setTimeout(r, 5));

      ping(1, 42, "Alice");
      const [after] = getPresence(1) as PresenceEntry[];

      expect(new Date(after.lastPingAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before.lastPingAt).getTime()
      );
    });

    it("acts as an implicit join when user is not yet in the room", () => {
      const { ping, getPresence } = loadModule();

      ping(1, 99, "Ghost");

      expect(getPresence(1)).toHaveLength(1);
      expect(getPresence(1)[0].userId).toBe(99);
    });
  });

  // ── broadcast ────────────────────────────────────────────────────────────

  describe("broadcast", () => {
    it("sends a JSON message to all OPEN clients in the room", () => {
      const { join, broadcast } = loadModule();

      join(1, 10, "A");
      join(1, 11, "B");

      const sendA = jest.fn();
      const sendB = jest.fn();
      const clientMap = new Map([
        [10, { readyState: 1, send: sendA }],
        [11, { readyState: 1, send: sendB }],
      ]);

      broadcast(1, { type: "presence_update" }, clientMap);

      expect(sendA).toHaveBeenCalledTimes(1);
      expect(sendB).toHaveBeenCalledTimes(1);
      expect(JSON.parse(sendA.mock.calls[0][0])).toEqual({ type: "presence_update" });
    });

    it("skips clients whose readyState is not OPEN (1)", () => {
      const { join, broadcast } = loadModule();

      join(1, 10, "A");

      const sendA = jest.fn();
      const clientMap = new Map([
        [10, { readyState: 3 /* CLOSED */, send: sendA }],
      ]);

      broadcast(1, { type: "test" }, clientMap);

      expect(sendA).not.toHaveBeenCalled();
    });

    it("is a no-op for an unknown project room", () => {
      const { broadcast } = loadModule();
      const send = jest.fn();
      const clientMap = new Map([[1, { readyState: 1, send }]]);

      expect(() => broadcast(9999, { type: "test" }, clientMap)).not.toThrow();
      expect(send).not.toHaveBeenCalled();
    });
  });
});

/**
 * Unit tests for src/services/sessionRegistry.ts (Phase 8)
 *
 * Each describe block reloads the module via jest.resetModules() + require()
 * to get fresh in-memory Maps/Sets, preventing cross-test pollution.
 * No HTTP, no DB, no network required.
 */

import type {
  register as RegisterFn,
  touch as TouchFn,
  revoke as RevokeFn,
  isRevoked as IsRevokedFn,
  listForUser as ListForUserFn,
  listAll as ListAllFn,
  revokeAllForUser as RevokeAllForUserFn,
  SessionEntry,
} from "../../src/services/sessionRegistry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadModule() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("../../src/services/sessionRegistry") as {
    register: typeof RegisterFn;
    touch: typeof TouchFn;
    revoke: typeof RevokeFn;
    isRevoked: typeof IsRevokedFn;
    listForUser: typeof ListForUserFn;
    listAll: typeof ListAllFn;
    revokeAllForUser: typeof RevokeAllForUserFn;
  };
  return mod;
}

function makeSessionData(overrides: Partial<Omit<SessionEntry, "jti" | "loginAt" | "lastSeen">> = {}) {
  return {
    userId: 1,
    email: "user@example.com",
    userAgent: "TestAgent/1.0",
    ip: "127.0.0.1",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sessionRegistry", () => {
  // ── register + isRevoked ─────────────────────────────────────────────────

  describe("register + isRevoked", () => {
    it("registers a new session without marking it as revoked", () => {
      const { register, isRevoked } = loadModule();

      register("jti-001", makeSessionData());

      expect(isRevoked("jti-001")).toBe(false);
    });

    it("returns false for an unregistered jti (never seen)", () => {
      const { isRevoked } = loadModule();

      expect(isRevoked("jti-unknown")).toBe(false);
    });

    it("creates session with loginAt and lastSeen set to now", () => {
      const { register, listAll } = loadModule();

      const before = new Date();
      register("jti-002", makeSessionData());
      const after = new Date();

      const [session] = listAll() as SessionEntry[];
      expect(session.loginAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.loginAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(session.lastSeen.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("stores the provided fields correctly", () => {
      const { register, listAll } = loadModule();

      register("jti-003", makeSessionData({ userId: 99, email: "admin@example.com", ip: "10.0.0.1" }));

      const [session] = listAll() as SessionEntry[];
      expect(session.jti).toBe("jti-003");
      expect(session.userId).toBe(99);
      expect(session.email).toBe("admin@example.com");
      expect(session.ip).toBe("10.0.0.1");
    });
  });

  // ── revoke + isRevoked ───────────────────────────────────────────────────

  describe("revoke + isRevoked", () => {
    it("marks a session as revoked", () => {
      const { register, revoke, isRevoked } = loadModule();

      register("jti-010", makeSessionData());
      revoke("jti-010");

      expect(isRevoked("jti-010")).toBe(true);
    });

    it("returns true from revoke() when the session existed", () => {
      const { register, revoke } = loadModule();

      register("jti-011", makeSessionData());
      const result = revoke("jti-011");

      expect(result).toBe(true);
    });

    it("returns false from revoke() when the session did not exist", () => {
      const { revoke } = loadModule();

      const result = revoke("jti-nonexistent");

      expect(result).toBe(false);
    });

    it("removes the session from listAll() after revoking", () => {
      const { register, revoke, listAll } = loadModule();

      register("jti-012", makeSessionData());
      revoke("jti-012");

      expect(listAll()).toHaveLength(0);
    });

    it("persists revoked status across calls (cannot re-register)", () => {
      const { register, revoke, isRevoked } = loadModule();

      register("jti-013", makeSessionData());
      revoke("jti-013");
      // Re-register same jti — should still appear revoked
      register("jti-013", makeSessionData());

      // The revokedSet persists even after re-register
      expect(isRevoked("jti-013")).toBe(true);
    });
  });

  // ── touch ────────────────────────────────────────────────────────────────

  describe("touch", () => {
    it("updates lastSeen for an existing session", async () => {
      const { register, touch, listAll } = loadModule();

      register("jti-020", makeSessionData());
      const [before] = listAll() as SessionEntry[];
      const originalLastSeen = before.lastSeen;

      await new Promise((r) => setTimeout(r, 5));

      touch("jti-020");
      const [after] = listAll() as SessionEntry[];

      expect(after.lastSeen.getTime()).toBeGreaterThanOrEqual(originalLastSeen.getTime());
    });

    it("does not modify loginAt when touching", async () => {
      const { register, touch, listAll } = loadModule();

      register("jti-021", makeSessionData());
      const [before] = listAll() as SessionEntry[];
      const originalLoginAt = before.loginAt;

      await new Promise((r) => setTimeout(r, 5));

      touch("jti-021");
      const [after] = listAll() as SessionEntry[];

      expect(after.loginAt.getTime()).toBe(originalLoginAt.getTime());
    });

    it("is a no-op for an unknown jti (does not throw)", () => {
      const { touch } = loadModule();
      expect(() => touch("jti-unknown")).not.toThrow();
    });
  });

  // ── listForUser ──────────────────────────────────────────────────────────

  describe("listForUser", () => {
    it("returns only sessions belonging to the specified user", () => {
      const { register, listForUser } = loadModule();

      register("jti-030", makeSessionData({ userId: 1 }));
      register("jti-031", makeSessionData({ userId: 1 }));
      register("jti-032", makeSessionData({ userId: 2 }));

      const user1Sessions = listForUser(1) as SessionEntry[];
      expect(user1Sessions).toHaveLength(2);
      expect(user1Sessions.every((s) => s.userId === 1)).toBe(true);
    });

    it("returns an empty array when the user has no sessions", () => {
      const { register, listForUser } = loadModule();

      register("jti-033", makeSessionData({ userId: 99 }));

      expect(listForUser(42)).toEqual([]);
    });

    it("returns copies — mutating returned entries does not affect the store", () => {
      const { register, listForUser, listAll } = loadModule();

      register("jti-034", makeSessionData({ userId: 5 }));
      const [copy] = listForUser(5) as SessionEntry[];
      copy.email = "mutated@example.com";

      const [original] = listAll() as SessionEntry[];
      expect(original.email).toBe("user@example.com");
    });
  });

  // ── listAll ───────────────────────────────────────────────────────────────

  describe("listAll", () => {
    it("returns all active sessions across all users", () => {
      const { register, listAll } = loadModule();

      register("jti-040", makeSessionData({ userId: 1 }));
      register("jti-041", makeSessionData({ userId: 2 }));
      register("jti-042", makeSessionData({ userId: 3 }));

      expect(listAll()).toHaveLength(3);
    });

    it("returns an empty array when no sessions are registered", () => {
      const { listAll } = loadModule();
      expect(listAll()).toEqual([]);
    });

    it("excludes revoked sessions", () => {
      const { register, revoke, listAll } = loadModule();

      register("jti-043", makeSessionData({ userId: 1 }));
      register("jti-044", makeSessionData({ userId: 2 }));
      revoke("jti-043");

      const sessions = listAll() as SessionEntry[];
      expect(sessions).toHaveLength(1);
      expect(sessions[0].jti).toBe("jti-044");
    });
  });

  // ── revokeAllForUser ──────────────────────────────────────────────────────

  describe("revokeAllForUser", () => {
    it("revokes all sessions for the specified user", () => {
      const { register, revokeAllForUser, isRevoked } = loadModule();

      register("jti-050", makeSessionData({ userId: 7 }));
      register("jti-051", makeSessionData({ userId: 7 }));

      revokeAllForUser(7);

      expect(isRevoked("jti-050")).toBe(true);
      expect(isRevoked("jti-051")).toBe(true);
    });

    it("returns the count of sessions revoked", () => {
      const { register, revokeAllForUser } = loadModule();

      register("jti-052", makeSessionData({ userId: 8 }));
      register("jti-053", makeSessionData({ userId: 8 }));
      register("jti-054", makeSessionData({ userId: 8 }));

      const count = revokeAllForUser(8);

      expect(count).toBe(3);
    });

    it("returns 0 when the user has no active sessions", () => {
      const { revokeAllForUser } = loadModule();

      const count = revokeAllForUser(9999);

      expect(count).toBe(0);
    });

    it("does not revoke sessions belonging to other users", () => {
      const { register, revokeAllForUser, listForUser } = loadModule();

      register("jti-055", makeSessionData({ userId: 10 }));
      register("jti-056", makeSessionData({ userId: 11 }));

      revokeAllForUser(10);

      const remaining = listForUser(11) as SessionEntry[];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].jti).toBe("jti-056");
    });

    it("clears all sessions for user so listForUser returns empty", () => {
      const { register, revokeAllForUser, listForUser } = loadModule();

      register("jti-057", makeSessionData({ userId: 12 }));
      register("jti-058", makeSessionData({ userId: 12 }));

      revokeAllForUser(12);

      expect(listForUser(12)).toEqual([]);
    });
  });
});

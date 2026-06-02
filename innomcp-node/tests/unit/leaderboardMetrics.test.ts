/**
 * tests/unit/leaderboardMetrics.test.ts — Phase 13-E
 *
 * Unit tests for services/leaderboardMetrics.ts.
 * All functions are pure in-memory; no mocking needed.
 */

import {
  recordProviderCall,
  getProviderStats,
  resetStats,
} from "../../src/services/leaderboardMetrics";

describe("leaderboardMetrics", () => {
  beforeEach(() => {
    // Isolate each test by wiping all stats
    resetStats();
  });

  // ── recordProviderCall + getProviderStats ─────────────────────────────────

  it("records a single successful call", () => {
    recordProviderCall("test-provider", 500, true);
    const stats = getProviderStats();
    expect(stats.has("test-provider")).toBe(true);
    const entry = stats.get("test-provider")!;
    expect(entry.requests).toBe(1);
    expect(entry.avgLatency).toBe(500);
    expect(entry.successRate).toBe(100);
  });

  it("accumulates multiple calls and computes correct averages", () => {
    recordProviderCall("test-provider", 500, true);   // success
    recordProviderCall("test-provider", 300, true);   // success
    recordProviderCall("test-provider", 100, false);  // failure

    const stats = getProviderStats();
    const entry = stats.get("test-provider")!;
    expect(entry.requests).toBe(3);
    expect(entry.avgLatency).toBe(Math.round((500 + 300 + 100) / 3)); // 300
    expect(entry.successRate).toBe(Math.round((2 / 3) * 100));        // 67
  });

  it("records a single failed call — successRate is 0", () => {
    recordProviderCall("failing-provider", 100, false);
    const stats = getProviderStats();
    const entry = stats.get("failing-provider")!;
    expect(entry.requests).toBe(1);
    expect(entry.avgLatency).toBe(100);
    expect(entry.successRate).toBe(0);
  });

  it("tracks multiple providers independently", () => {
    recordProviderCall("provider-a", 200, true);
    recordProviderCall("provider-b", 800, false);

    const stats = getProviderStats();
    expect(stats.get("provider-a")!.successRate).toBe(100);
    expect(stats.get("provider-b")!.successRate).toBe(0);
    expect(stats.get("provider-a")!.avgLatency).toBe(200);
    expect(stats.get("provider-b")!.avgLatency).toBe(800);
  });

  it("avgLatency rounds to integer", () => {
    // 100 + 200 = 300 / 2 = 150 exactly — but test an odd split too
    recordProviderCall("rounding-test", 100, true);
    recordProviderCall("rounding-test", 201, true);
    const stats = getProviderStats();
    const entry = stats.get("rounding-test")!;
    expect(Number.isInteger(entry.avgLatency)).toBe(true);
    expect(entry.avgLatency).toBe(Math.round(301 / 2));
  });

  it("successRate rounds to integer", () => {
    recordProviderCall("rate-test", 100, true);
    recordProviderCall("rate-test", 100, false);
    recordProviderCall("rate-test", 100, false);
    // 1 success / 3 = 33.33…% → 33
    const stats = getProviderStats();
    expect(stats.get("rate-test")!.successRate).toBe(33);
  });

  // ── resetStats (single provider) ─────────────────────────────────────────

  it("resetStats(providerId) removes only that provider", () => {
    recordProviderCall("test-provider", 500, true);
    recordProviderCall("other-provider", 200, false);

    resetStats("test-provider");
    const stats = getProviderStats();
    expect(stats.has("test-provider")).toBe(false);
    expect(stats.has("other-provider")).toBe(true);
  });

  it("resetStats(providerId) is a no-op for unknown provider", () => {
    recordProviderCall("known", 100, true);
    expect(() => resetStats("unknown-xyz")).not.toThrow();
    expect(getProviderStats().has("known")).toBe(true);
  });

  // ── resetStats (all) ──────────────────────────────────────────────────────

  it("resetStats() with no argument clears all providers", () => {
    recordProviderCall("a", 100, true);
    recordProviderCall("b", 200, false);
    recordProviderCall("c", 300, true);

    resetStats();
    const stats = getProviderStats();
    expect(stats.size).toBe(0);
  });

  it("getProviderStats returns empty Map when nothing recorded", () => {
    const stats = getProviderStats();
    expect(stats.size).toBe(0);
  });

  // ── getProviderStats returns a new snapshot ───────────────────────────────

  it("getProviderStats returns a copy — mutating it does not affect the store", () => {
    recordProviderCall("snap-test", 100, true);
    const snap = getProviderStats();
    snap.delete("snap-test");
    // Original store should still have it
    const fresh = getProviderStats();
    expect(fresh.has("snap-test")).toBe(true);
  });

  // ── Stats after reset can be re-recorded ─────────────────────────────────

  it("can re-record after resetStats — counts restart from 0", () => {
    recordProviderCall("cycle-provider", 400, true);
    resetStats("cycle-provider");
    recordProviderCall("cycle-provider", 100, false);

    const stats = getProviderStats();
    const entry = stats.get("cycle-provider")!;
    expect(entry.requests).toBe(1);
    expect(entry.avgLatency).toBe(100);
    expect(entry.successRate).toBe(0);
  });
});

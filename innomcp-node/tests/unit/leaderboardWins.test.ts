/**
 * tests/unit/leaderboardWins.test.ts
 * Tests for the recordProviderWin function and wins field in getProviderStats.
 */

export {}; // Force module mode

import {
  recordProviderCall,
  recordProviderWin,
  getProviderStats,
  resetStats,
} from "../../src/services/leaderboardMetrics";
import { getSparklineData } from "../../src/services/leaderboardMetrics";

beforeEach(() => resetStats());

describe("recordProviderWin", () => {
  it("increments wins for a known provider", () => {
    recordProviderCall("groq-llama", 300, true);
    recordProviderWin("groq-llama");
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.wins).toBe(1);
  });

  it("creates provider entry with wins=1 when no prior calls", () => {
    recordProviderWin("new-provider");
    const stats = getProviderStats();
    expect(stats.get("new-provider")!.wins).toBe(1);
    expect(stats.get("new-provider")!.requests).toBe(0);
  });

  it("accumulates multiple wins", () => {
    recordProviderCall("mdes-cloud", 500, true);
    recordProviderWin("mdes-cloud");
    recordProviderWin("mdes-cloud");
    recordProviderWin("mdes-cloud");
    const stats = getProviderStats();
    expect(stats.get("mdes-cloud")!.wins).toBe(3);
  });

  it("wins are independent from requests count", () => {
    recordProviderCall("claude-haiku", 200, true);
    recordProviderCall("claude-haiku", 250, true);
    recordProviderWin("claude-haiku");
    const stats = getProviderStats();
    expect(stats.get("claude-haiku")!.requests).toBe(2);
    expect(stats.get("claude-haiku")!.wins).toBe(1);
  });

  it("wins reset with resetStats()", () => {
    recordProviderWin("innova-bot");
    resetStats("innova-bot");
    const stats = getProviderStats();
    expect(stats.get("innova-bot")).toBeUndefined();
  });

  it("getProviderStats includes wins=0 for providers with calls but no wins", () => {
    recordProviderCall("together-llama", 1000, false);
    const stats = getProviderStats();
    expect(stats.get("together-llama")!.wins).toBe(0);
  });
});

describe("recordProviderWin DB persistence (fire-and-forget)", () => {
  it("does not throw when called with no DB available", async () => {
    // DB is not available in unit tests — the setImmediate/withDbConnection
    // silently catches the error; this verifies no synchronous throw
    expect(() => recordProviderWin("test-provider")).not.toThrow();
  });

  it("can be called rapidly without errors (setImmediate queuing)", async () => {
    for (let i = 0; i < 10; i++) {
      recordProviderWin("rapid-provider");
    }
    const stats = getProviderStats();
    expect(stats.get("rapid-provider")!.wins).toBe(10);
  });
});

describe("getSparklineData", () => {
  it("returns empty array for unknown provider", () => {
    expect(getSparklineData("unknown-provider")).toEqual([]);
  });

  it("returns empty array for provider with no calls", () => {
    recordProviderWin("win-only-provider"); // win but no call → no latency samples
    // win-only creates entry with requests=0, latencySamples=[]
    expect(getSparklineData("win-only-provider")).toEqual([]);
  });

  it("returns last N samples (default 10)", () => {
    for (let i = 1; i <= 15; i++) {
      recordProviderCall("sparkline-provider", i * 100, true);
    }
    const samples = getSparklineData("sparkline-provider");
    expect(samples).toHaveLength(10);
    expect(samples[0]).toBe(600); // 6th call (1-indexed: 15-10+1=6), 600ms
    expect(samples[9]).toBe(1500); // last call, 1500ms
  });

  it("returns fewer than N when provider has fewer calls", () => {
    recordProviderCall("few-calls", 200, true);
    recordProviderCall("few-calls", 300, true);
    const samples = getSparklineData("few-calls", 10);
    expect(samples).toHaveLength(2);
    expect(samples).toEqual([200, 300]);
  });

  it("respects custom n parameter", () => {
    for (let i = 1; i <= 20; i++) {
      recordProviderCall("n-param-provider", i * 50, false);
    }
    expect(getSparklineData("n-param-provider", 5)).toHaveLength(5);
    expect(getSparklineData("n-param-provider", 3)).toHaveLength(3);
  });
});

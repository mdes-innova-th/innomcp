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

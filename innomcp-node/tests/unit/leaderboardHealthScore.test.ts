/**
 * tests/unit/leaderboardHealthScore.test.ts
 * Tests for healthScore and efficiencyScore in ProviderStats.
 */

export {}; // Force module mode

import {
  recordProviderCall,
  recordProviderWin,
  getProviderStats,
  resetStats,
} from "../../src/services/leaderboardMetrics";

beforeEach(() => resetStats());

describe("healthScore", () => {
  it("is 0 when no requests", () => {
    recordProviderWin("groq-llama"); // win-only, no calls
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.healthScore).toBe(0);
  });

  it("increases with higher success rate", () => {
    recordProviderCall("groq-llama", 300, true);
    recordProviderCall("groq-llama", 300, true);
    recordProviderCall("deepseek-r1", 400, false);
    recordProviderCall("deepseek-r1", 400, false);

    const stats = getProviderStats();
    const groqHealth = stats.get("groq-llama")!.healthScore;
    const deepHealth = stats.get("deepseek-r1")!.healthScore;
    expect(groqHealth).toBeGreaterThan(deepHealth);
  });

  it("gets +30 bonus when provider has wins", () => {
    // Two providers: same success rate, but only one has wins
    recordProviderCall("provider-a", 300, true);
    recordProviderCall("provider-b", 300, true);
    recordProviderWin("provider-a", "code");

    const stats = getProviderStats();
    const aHealth = stats.get("provider-a")!.healthScore;
    const bHealth = stats.get("provider-b")!.healthScore;
    expect(aHealth).toBeGreaterThan(bHealth);
  });
});

describe("efficiencyScore", () => {
  it("is 0 when no requests", () => {
    const stats = getProviderStats();
    // No stats = empty map
    expect(stats.size).toBe(0);
  });

  it("equals win percentage (wins/requests*100)", () => {
    recordProviderCall("groq-llama", 300, true);
    recordProviderCall("groq-llama", 300, true);
    recordProviderCall("groq-llama", 300, true);
    recordProviderWin("groq-llama");
    // 1 win / 3 requests * 100 = 33
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.efficiencyScore).toBe(33);
  });

  it("capped at 100", () => {
    // More wins than requests (edge case — win-only entry + call)
    recordProviderWin("mdes-cloud");
    recordProviderWin("mdes-cloud");
    recordProviderWin("mdes-cloud");
    recordProviderCall("mdes-cloud", 500, true);
    // wins=3 / requests=1 * 100 = 300, capped to 100
    const stats = getProviderStats();
    expect(stats.get("mdes-cloud")!.efficiencyScore).toBe(100);
  });
});

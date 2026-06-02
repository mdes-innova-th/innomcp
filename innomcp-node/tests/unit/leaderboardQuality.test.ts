/**
 * tests/unit/leaderboardQuality.test.ts
 * Tests for recordProviderQuality and avgQuality in getProviderStats.
 */

export {}; // Force module mode

import {
  recordProviderCall,
  recordProviderQuality,
  getProviderStats,
  resetStats,
} from "../../src/services/leaderboardMetrics";

beforeEach(() => resetStats());

describe("recordProviderQuality", () => {
  it("avgQuality is 0 when no quality recorded", () => {
    recordProviderCall("groq-llama", 300, true);
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.avgQuality).toBe(0);
  });

  it("records quality score and reflects in avgQuality", () => {
    recordProviderQuality("groq-llama", 90);
    recordProviderQuality("groq-llama", 70);
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.avgQuality).toBe(80);
  });

  it("clamps score to 0–100 range", () => {
    recordProviderQuality("mdes-cloud", 150); // clamped to 100
    recordProviderQuality("mdes-cloud", -20); // clamped to 0
    const stats = getProviderStats();
    expect(stats.get("mdes-cloud")!.avgQuality).toBe(50); // (100+0)/2
  });

  it("creates new entry when no prior calls", () => {
    recordProviderQuality("innova-bot", 75);
    const stats = getProviderStats();
    expect(stats.get("innova-bot")!.avgQuality).toBe(75);
    expect(stats.get("innova-bot")!.requests).toBe(0);
  });
});

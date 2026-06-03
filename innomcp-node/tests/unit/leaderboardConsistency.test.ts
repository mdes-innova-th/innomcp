/**
 * tests/unit/leaderboardConsistency.test.ts
 * Tests for consistencyScore in ProviderStats.
 */

export {}; // Force module mode

import {
  recordProviderCall,
  getProviderStats,
  resetStats,
} from "../../src/services/leaderboardMetrics";

beforeEach(() => resetStats());

describe("consistencyScore", () => {
  it("is 0 when fewer than 2 response samples", () => {
    recordProviderCall("groq-llama", 300, true, 500);
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.consistencyScore).toBe(0);
  });

  it("is high (near 100) for identical response lengths", () => {
    // All responses same length → stddev=0 → consistency=100
    recordProviderCall("groq-llama", 300, true, 500);
    recordProviderCall("groq-llama", 350, true, 500);
    recordProviderCall("groq-llama", 280, true, 500);
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.consistencyScore).toBe(100);
  });

  it("is lower for highly variable response lengths", () => {
    // Very different lengths → high stddev → lower consistency
    recordProviderCall("mdes-cloud", 300, true, 10);
    recordProviderCall("mdes-cloud", 400, true, 2000);
    const stats = getProviderStats();
    const score = stats.get("mdes-cloud")!.consistencyScore;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(100);
  });

  it("consistent provider scores higher than variable provider", () => {
    // Provider A: consistent
    recordProviderCall("provider-a", 300, true, 500);
    recordProviderCall("provider-a", 300, true, 510);
    // Provider B: variable
    recordProviderCall("provider-b", 300, true, 50);
    recordProviderCall("provider-b", 300, true, 1500);

    const stats = getProviderStats();
    const aScore = stats.get("provider-a")!.consistencyScore;
    const bScore = stats.get("provider-b")!.consistencyScore;
    expect(aScore).toBeGreaterThan(bScore);
  });
});

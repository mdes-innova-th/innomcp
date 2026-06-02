/**
 * tests/unit/motherHistory.test.ts — Phase 13-E
 *
 * Unit tests for services/motherHistory.ts.
 * Pure in-memory ring buffer; no mocking needed.
 */

import {
  pushRun,
  getHistory,
  clearHistory,
  type MotherRun,
  type MotherRunProvider,
} from "../../src/services/motherHistory";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockProvider(id: string): MotherRunProvider {
  return {
    providerId: id,
    providerName: `Provider ${id}`,
    latencyMs: 100,
    success: true,
    preview: "preview text",
  };
}

function makeMockRun(overrides: Partial<MotherRun> = {}): MotherRun {
  return {
    runId: `run-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    intent: "general",
    query: "test query",
    iteration: 1,
    totalProviders: 1,
    successCount: 1,
    fastestProvider: "mdes-cloud",
    slowestMs: 500,
    synthesis: "synthesized answer",
    providers: [makeMockProvider("mdes-cloud")],
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("motherHistory", () => {
  beforeEach(() => {
    clearHistory();
  });

  // ── pushRun + getHistory ──────────────────────────────────────────────────

  it("pushRun then getHistory returns array with 1 entry", () => {
    const run = makeMockRun();
    pushRun(run);
    const history = getHistory(10);
    expect(history).toHaveLength(1);
    expect(history[0].runId).toBe(run.runId);
  });

  it("most recent run is at index 0 (prepend behaviour)", () => {
    const first = makeMockRun({ intent: "knowledge", query: "first query" });
    const second = makeMockRun({ intent: "code", query: "second query" });
    pushRun(first);
    pushRun(second);
    const history = getHistory(10);
    expect(history[0].runId).toBe(second.runId);
    expect(history[1].runId).toBe(first.runId);
  });

  it("getHistory returns at most `limit` runs", () => {
    for (let i = 0; i < 10; i++) {
      pushRun(makeMockRun());
    }
    expect(getHistory(3)).toHaveLength(3);
    expect(getHistory(5)).toHaveLength(5);
  });

  it("getHistory with limit larger than stored count returns all stored runs", () => {
    pushRun(makeMockRun());
    pushRun(makeMockRun());
    expect(getHistory(100)).toHaveLength(2);
  });

  it("getHistory default limit is 10", () => {
    for (let i = 0; i < 15; i++) {
      pushRun(makeMockRun());
    }
    expect(getHistory()).toHaveLength(10);
  });

  // ── Ring buffer cap at MAX_RUNS = 50 ─────────────────────────────────────

  it("ring buffer caps at 50 runs — pushing 51 keeps 50", () => {
    for (let i = 0; i < 51; i++) {
      pushRun(makeMockRun({ query: `query ${i}` }));
    }
    expect(getHistory(50)).toHaveLength(50);
  });

  it("ring buffer drops oldest entry when capacity exceeded", () => {
    const first = makeMockRun({ query: "oldest run" });
    pushRun(first);
    // Push 50 more to overflow — first should be dropped
    for (let i = 0; i < 50; i++) {
      pushRun(makeMockRun({ query: `run ${i}` }));
    }
    const history = getHistory(50);
    expect(history).toHaveLength(50);
    const found = history.some((r) => r.runId === first.runId);
    expect(found).toBe(false);
  });

  it("after 51 pushes, index 0 is the most recently pushed run", () => {
    const runs: MotherRun[] = [];
    for (let i = 0; i < 51; i++) {
      const r = makeMockRun({ query: `query ${i}` });
      runs.push(r);
      pushRun(r);
    }
    const history = getHistory(1);
    expect(history[0].runId).toBe(runs[50].runId); // last pushed
  });

  // ── clearHistory ─────────────────────────────────────────────────────────

  it("clearHistory resets history to empty", () => {
    pushRun(makeMockRun());
    pushRun(makeMockRun());
    clearHistory();
    expect(getHistory().length).toBe(0);
  });

  it("can push new runs after clearHistory", () => {
    pushRun(makeMockRun({ query: "before clear" }));
    clearHistory();
    const fresh = makeMockRun({ query: "after clear" });
    pushRun(fresh);
    const history = getHistory(10);
    expect(history).toHaveLength(1);
    expect(history[0].runId).toBe(fresh.runId);
  });

  // ── getHistory clamping edge cases ────────────────────────────────────────

  it("getHistory with limit=1 returns only the most recent run", () => {
    for (let i = 0; i < 5; i++) {
      pushRun(makeMockRun({ query: `query ${i}` }));
    }
    const history = getHistory(1);
    expect(history).toHaveLength(1);
  });

  it("getHistory with limit <= 0 clamps to 1 and returns 1 run", () => {
    pushRun(makeMockRun());
    pushRun(makeMockRun());
    const history = getHistory(0);
    expect(history).toHaveLength(1);
  });

  // ── MotherRun shape preservation ─────────────────────────────────────────

  it("stored run preserves all fields", () => {
    const provider = makeMockProvider("thai-llm");
    const run = makeMockRun({
      intent: "knowledge",
      query: "test query for shape",
      iteration: 42,
      totalProviders: 3,
      successCount: 2,
      fastestProvider: "thai-llm",
      slowestMs: 1500,
      synthesis: "synthesized output",
      providers: [provider],
    });
    pushRun(run);
    const stored = getHistory(1)[0];
    expect(stored.intent).toBe("knowledge");
    expect(stored.iteration).toBe(42);
    expect(stored.totalProviders).toBe(3);
    expect(stored.successCount).toBe(2);
    expect(stored.fastestProvider).toBe("thai-llm");
    expect(stored.slowestMs).toBe(1500);
    expect(stored.synthesis).toBe("synthesized output");
    expect(stored.providers).toHaveLength(1);
    expect(stored.providers[0].providerId).toBe("thai-llm");
  });

  // ── motherHistory singleton object ────────────────────────────────────────

  it("singleton re-exports are equivalent to named exports", async () => {
    // Import singleton alongside named exports to ensure they share state
    const { motherHistory } = await import("../../src/services/motherHistory");
    clearHistory();
    const run = makeMockRun({ query: "singleton test" });
    motherHistory.push(run);
    const history = motherHistory.get(10);
    expect(history).toHaveLength(1);
    expect(history[0].runId).toBe(run.runId);
    motherHistory.clear();
    expect(motherHistory.get().length).toBe(0);
  });
});

/**
 * tests/integration/motherPipeline.test.ts — Phase 15-D
 *
 * Integration test: dispatchMother → leaderboardMetrics → motherHistory → getHistory
 *
 * Design notes:
 * - MDES_ONLY=1 causes an early return (line 523-525 of motherDispatch.ts) BEFORE
 *   pushRun is called, because mdes-cloud and thai-llm both require an API key and
 *   have no key set in CI. So tests that need pushRun to fire use a different
 *   strategy: they rely on ollama-local, which bypasses the key check (kind="ollama"
 *   AND id="ollama-local"). ollama-local will fail fast with ECONNREFUSED to
 *   localhost:11434 but the full pipeline still runs — including pushRun and
 *   recordProviderCall.
 *
 * - MOTHER_TIMEOUT_MS env var does NOT control the dispatch timeout (it is a
 *   module-level constant in motherDispatch.ts). Connection-refused errors from
 *   ollama-local resolve in milliseconds anyway — no artificial timeout needed.
 *
 * - The `intent` field stored in MotherRun comes from options?.intent (the 6th
 *   parameter), NOT the first positional `intent` argument. The first argument is
 *   only used to select the prompt template. To store "knowledge" in history, pass
 *   { intent: "knowledge" } as options.
 *
 * - All tests are graceful: providers may fail (expected without real keys/servers),
 *   but the wiring — return shape, history length changes, stats map mutations —
 *   is verified regardless.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { dispatchMother } from "../../src/agents/motherDispatch";
import { getHistory, clearHistory } from "../../src/services/motherHistory";
import { getProviderStats, resetStats } from "../../src/services/leaderboardMetrics";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Unique run IDs to avoid cross-test state collisions in history ring buffer */
let runCounter = 0;
function nextRunId(): string {
  return `test-run-${++runCounter}-${Date.now()}`;
}

function nextMsgId(): string {
  return `test-msg-${runCounter}-${Date.now()}`;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Mother dispatch pipeline integration", () => {

  beforeEach(() => {
    clearHistory();
    resetStats();
    // Do NOT set MDES_ONLY=1 here globally — see per-test comments for why.
    // Each test that needs a specific env posture sets and cleans it itself.
    delete process.env.MDES_ONLY;
  });

  afterEach(() => {
    delete process.env.MDES_ONLY;
  });

  // ── 1. Return shape ─────────────────────────────────────────────────────────

  it("dispatchMother returns MotherDispatchResult shape", async () => {
    // With MDES_ONLY=1 and no API key, eligible list is empty → early return.
    // The early-return value { results: [], synthesis: "", totalAgents: 0, successCount: 0 }
    // is still a valid MotherDispatchResult, so shape assertions hold.
    process.env.MDES_ONLY = "1";

    const result = await dispatchMother(
      "general",
      "test query",
      nextRunId(),
      nextMsgId(),
      () => {}
    );

    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("synthesis");
    expect(result).toHaveProperty("totalAgents");
    expect(result).toHaveProperty("successCount");
    expect(Array.isArray(result.results)).toBe(true);
    expect(typeof result.synthesis).toBe("string");
    expect(typeof result.totalAgents).toBe("number");
    expect(typeof result.successCount).toBe("number");
  }, 10_000);

  // ── 2. Non-zero eligible set returns correct shape ──────────────────────────

  it("dispatchMother with ollama-local eligible returns non-empty results array", async () => {
    // No MDES_ONLY — ollama-local is included (no key required).
    // It will fail (ECONNREFUSED to localhost:11434) but still produces a result entry.
    const result = await dispatchMother(
      "general",
      "hello",
      nextRunId(),
      nextMsgId(),
      () => {}
    );

    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("totalAgents");
    expect(result).toHaveProperty("successCount");
    // ollama-local is always in the eligible list without MDES_ONLY
    expect(result.totalAgents).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.results)).toBe(true);
    // successCount can be 0 (all providers failed) — that's expected without servers
    expect(result.successCount).toBeGreaterThanOrEqual(0);
  }, 30_000);

  // ── 3. dispatchMother pushes a run to motherHistory ────────────────────────

  it("dispatchMother pushes a run to motherHistory", async () => {
    // ollama-local runs, fails fast (ECONNREFUSED), then pushRun is called.
    // MDES_ONLY must NOT be set: with it, early return happens before pushRun.
    const before = getHistory(50).length;

    await dispatchMother(
      "knowledge",             // prompt template selector only
      "what is thailand",
      nextRunId(),
      nextMsgId(),
      () => {},
      { intent: "knowledge" } // ← this is what gets stored in MotherRun.intent
    );

    const after = getHistory(50).length;
    expect(after).toBe(before + 1);

    const run = getHistory(1)[0];
    // intent comes from options.intent (6th arg), not the 1st positional arg
    expect(run.intent).toBe("knowledge");
    expect(run.query).toBe("what is thailand");
    expect(typeof run.runId).toBe("string");
    expect(typeof run.timestamp).toBe("string");
    expect(typeof run.iteration).toBe("number");
    expect(typeof run.totalProviders).toBe("number");
    expect(typeof run.successCount).toBe("number");
    expect(Array.isArray(run.providers)).toBe(true);
  }, 30_000);

  // ── 4. intent defaults to "general" when options.intent is not provided ─────

  it("dispatchMother stores intent='general' when options not passed", async () => {
    await dispatchMother(
      "knowledge",  // used only for buildMotherPrompt, not stored in history
      "some query",
      nextRunId(),
      nextMsgId(),
      () => {}
      // no options → options?.intent is undefined → stored intent = "general"
    );

    const run = getHistory(1)[0];
    expect(run.intent).toBe("general");
  }, 30_000);

  // ── 5. leaderboardMetrics updated after dispatch ────────────────────────────

  it("dispatchMother records provider calls in leaderboardMetrics", async () => {
    resetStats();

    await dispatchMother(
      "general",
      "hello",
      nextRunId(),
      nextMsgId(),
      () => {}
    );

    const stats = getProviderStats();
    // ollama-local is always eligible without MDES_ONLY.
    // It gets recorded regardless of success/failure.
    const totalRequests = Array.from(stats.values()).reduce(
      (sum, v) => sum + v.requests,
      0
    );
    expect(totalRequests).toBeGreaterThanOrEqual(1);

    // Every tracked entry has the correct shape
    for (const [_id, stat] of stats.entries()) {
      expect(typeof stat.requests).toBe("number");
      expect(typeof stat.avgLatency).toBe("number");
      expect(typeof stat.successRate).toBe("number");
      expect(stat.requests).toBeGreaterThan(0);
      expect(stat.successRate).toBeGreaterThanOrEqual(0);
      expect(stat.successRate).toBeLessThanOrEqual(100);
    }
  }, 30_000);

  // ── 6. motherIteration counter increments per dispatch ─────────────────────

  it("motherIteration counter increments — two dispatches push two history entries", async () => {
    clearHistory();

    const r1 = await dispatchMother(
      "general",
      "q1",
      nextRunId(),
      nextMsgId(),
      () => {},
      { intent: "general" }
    );
    const r2 = await dispatchMother(
      "general",
      "q2",
      nextRunId(),
      nextMsgId(),
      () => {},
      { intent: "general" }
    );

    // Both calls return valid shapes
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(typeof r1.totalAgents).toBe("number");
    expect(typeof r2.totalAgents).toBe("number");

    // Both pushed to history
    const history = getHistory(10);
    expect(history.length).toBeGreaterThanOrEqual(2);

    // Second dispatch's run is at index 0 (most-recent-first)
    const [newest, secondNewest] = history;
    expect(newest.query).toBe("q2");
    expect(secondNewest.query).toBe("q1");

    // Iteration counter strictly increases
    expect(newest.iteration).toBeGreaterThan(secondNewest.iteration);
  }, 60_000);

  // ── 7. MDES_ONLY=1 early-return does NOT push to history ───────────────────

  it("MDES_ONLY=1 with no API key produces an empty result and does NOT push to history", async () => {
    // Ensure no MDES key is set so eligible list is empty
    delete process.env.REMOTE_OLLAMA_TOKEN;
    delete process.env.OLLAMA_REMOTE_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    process.env.MDES_ONLY = "1";

    clearHistory();
    const result = await dispatchMother(
      "general",
      "test",
      nextRunId(),
      nextMsgId(),
      () => {}
    );

    // Early return: results is empty, pushRun was never called
    expect(result.results).toHaveLength(0);
    expect(result.totalAgents).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.synthesis).toBe("");
    expect(getHistory(10).length).toBe(0);
  }, 10_000);

  // ── 8. emit callback is invoked (wiring check) ──────────────────────────────

  it("dispatchMother calls the emit callback at least once (per-provider events)", async () => {
    const emitted: unknown[] = [];
    const emit = (ev: unknown) => emitted.push(ev);

    await dispatchMother(
      "general",
      "emit test",
      nextRunId(),
      nextMsgId(),
      emit
    );

    // At least the iteration-counter event fires before any provider runs
    // (agent_started with publicSummary containing "Mother iteration")
    expect(emitted.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  // ── 9. query truncation — queries > 120 chars are stored truncated ──────────

  it("dispatchMother truncates query to 120 chars in history", async () => {
    const longQuery = "x".repeat(200);
    await dispatchMother(
      "general",
      longQuery,
      nextRunId(),
      nextMsgId(),
      () => {}
    );

    const run = getHistory(1)[0];
    expect(run.query.length).toBeLessThanOrEqual(120);
  }, 30_000);

  // ── 10. multiple dispatches respect history ring buffer ordering ────────────

  it("getHistory(1) always returns the most recently dispatched run", async () => {
    await dispatchMother("general", "first", nextRunId(), nextMsgId(), () => {}, { intent: "first" });
    await dispatchMother("general", "second", nextRunId(), nextMsgId(), () => {}, { intent: "second" });
    await dispatchMother("general", "third", nextRunId(), nextMsgId(), () => {}, { intent: "third" });

    const top = getHistory(1)[0];
    expect(top.query).toBe("third");
    expect(top.intent).toBe("third");
  }, 60_000);

});

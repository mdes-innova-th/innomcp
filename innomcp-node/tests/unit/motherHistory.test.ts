/**
 * tests/unit/motherHistory.test.ts — Phase 13-E
 *
 * Unit tests for:
 *   - services/motherHistory.ts  (pure in-memory ring buffer)
 *   - routes/api/motherHistory.ts (HTTP endpoint layer)
 */

import express from "express";
import request from "supertest";
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

// ── Route layer tests: GET /api/mother/history ────────────────────────────────

let routerModule: typeof import("../../src/routes/api/motherHistory");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherHistory");
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/history", routerModule.default);
  return app;
}

describe("GET /api/mother/history (route)", () => {
  beforeEach(() => {
    clearHistory();
  });

  it("returns 200 with empty runs array when no history", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/history");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("runs");
    expect(Array.isArray(res.body.runs)).toBe(true);
    expect(res.body.runs).toHaveLength(0);
  });

  it("returns runs after pushRun", async () => {
    pushRun(makeMockRun({ query: "route test query" }));
    const app = buildApp();
    const res = await request(app).get("/api/mother/history");
    expect(res.status).toBe(200);
    expect(res.body.runs.length).toBeGreaterThanOrEqual(1);
  });

  it("response includes total and timestamp fields", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/history");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("timestamp");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("respects ?limit query parameter", async () => {
    pushRun(makeMockRun({ runId: "r1", query: "q1" }));
    pushRun(makeMockRun({ runId: "r2", query: "q2" }));
    pushRun(makeMockRun({ runId: "r3", query: "q3" }));
    const app = buildApp();
    const res = await request(app).get("/api/mother/history?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.runs).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("defaults to limit=10 when no limit param supplied", async () => {
    for (let i = 0; i < 15; i++) {
      pushRun(makeMockRun({ query: `q${i}` }));
    }
    const app = buildApp();
    const res = await request(app).get("/api/mother/history");
    expect(res.status).toBe(200);
    expect(res.body.runs).toHaveLength(10);
  });

  it("clamps limit to 50 maximum", async () => {
    for (let i = 0; i < 30; i++) {
      pushRun(makeMockRun({ query: `q${i}` }));
    }
    const app = buildApp();
    const res = await request(app).get("/api/mother/history?limit=200");
    expect(res.status).toBe(200);
    expect(res.body.runs.length).toBeLessThanOrEqual(50);
  });

  it("clamps non-finite limit to default=10", async () => {
    for (let i = 0; i < 15; i++) {
      pushRun(makeMockRun({ query: `q${i}` }));
    }
    const app = buildApp();
    const res = await request(app).get("/api/mother/history?limit=abc");
    expect(res.status).toBe(200);
    expect(res.body.runs).toHaveLength(10);
  });

  it("each run has required fields", async () => {
    const provider: MotherRunProvider = {
      providerId: "groq-llama",
      providerName: "Groq",
      latencyMs: 300,
      success: true,
      preview: "Fast response",
    };
    pushRun(makeMockRun({
      query: "shape check query",
      fastestProvider: "groq-llama",
      synthesis: "synthesized answer",
      providers: [provider],
    }));
    const app = buildApp();
    const res = await request(app).get("/api/mother/history");
    const run = res.body.runs[0];
    expect(run).toHaveProperty("runId");
    expect(run).toHaveProperty("query");
    expect(run).toHaveProperty("providers");
    expect(run).toHaveProperty("synthesis");
    expect(run).toHaveProperty("fastestProvider");
    expect(run).toHaveProperty("timestamp");
  });
});

describe("GET /api/mother/history/:runId (route)", () => {
  beforeEach(() => {
    clearHistory();
  });

  it("returns 200 and the run when found", async () => {
    const run = makeMockRun({ runId: "known-run-id", query: "lookup test" });
    pushRun(run);
    const app = buildApp();
    const res = await request(app).get("/api/mother/history/known-run-id");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("run");
    expect(res.body.run.runId).toBe("known-run-id");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("returns 404 when runId not found", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/history/nonexistent-run");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "run not found");
  });

  it("returns 400 for invalid runId format", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/history/" + "x".repeat(200));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "invalid runId");
  });
});

/**
 * tests/unit/motherStatsReset.test.ts
 * Tests for POST /api/mother/stats/reset and GET /api/mother/providers/:id/history
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { recordProviderCall, recordProviderWin, resetStats, getProviderStats } from "../../src/services/leaderboardMetrics";
import { pushRun, getHistory } from "../../src/services/motherHistory";

let statsModule: typeof import("../../src/routes/api/motherStats");
let providersModule: typeof import("../../src/routes/api/motherProviders");

beforeAll(async () => {
  statsModule = await import("../../src/routes/api/motherStats");
  providersModule = await import("../../src/routes/api/motherProviders");
});

beforeEach(() => resetStats());

function buildStatsApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/stats", statsModule.default);
  return app;
}

function buildProvidersApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/providers", providersModule.default);
  return app;
}

describe("POST /api/mother/stats/reset", () => {
  it("returns 200 with ok:true", async () => {
    const app = buildStatsApp();
    const res = await request(app).post("/api/mother/stats/reset");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty("timestamp");
  });

  it("clears in-memory stats after reset", async () => {
    recordProviderCall("groq-llama", 300, true);
    expect(getProviderStats().size).toBe(1);
    const app = buildStatsApp();
    await request(app).post("/api/mother/stats/reset");
    expect(getProviderStats().size).toBe(0);
  });
});

describe("GET /api/mother/providers/:id/history", () => {
  it("returns 404 for unknown provider", async () => {
    const app = buildProvidersApp();
    const res = await request(app).get("/api/mother/providers/unknown/history");
    expect(res.status).toBe(404);
  });

  it("returns empty when no runs", async () => {
    const app = buildProvidersApp();
    const res = await request(app).get("/api/mother/providers/groq-llama/history");
    expect(res.status).toBe(200);
    expect(res.body.runs).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("returns runs where provider participated", async () => {
    pushRun({
      runId: "test-history-1", timestamp: new Date().toISOString(),
      intent: "general", query: "test", iteration: 1,
      totalProviders: 2, successCount: 2,
      fastestProvider: "groq-llama", slowestMs: 800,
      synthesis: "answer", totalEstimatedCostUsd: 0,
      providers: [
        { providerId: "groq-llama", providerName: "Groq", latencyMs: 300, success: true, preview: "fast" },
        { providerId: "mdes-cloud", providerName: "MDES", latencyMs: 800, success: true, preview: "detailed" },
      ],
    });
    const app = buildProvidersApp();
    const res = await request(app).get("/api/mother/providers/groq-llama/history");
    expect(res.body.runs).toHaveLength(1);
    expect(res.body.runs[0].latencyMs).toBe(300);
    expect(res.body.runs[0].isFastest).toBe(true);
  });
});

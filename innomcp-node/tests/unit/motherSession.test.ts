/**
 * tests/unit/motherSession.test.ts
 * Tests for GET /api/mother/session endpoint.
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";

import { pushRun, clearHistory } from "../../src/services/motherHistory";
import { recordProviderCall, recordProviderWin, resetStats } from "../../src/services/leaderboardMetrics";

let routerModule: typeof import("../../src/routes/api/motherSession");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherSession");
});

beforeEach(() => {
  clearHistory?.();
  resetStats();
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/session", routerModule.default);
  return app;
}

describe("GET /api/mother/session", () => {
  it("returns 200 with session shape", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/session");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sessionStart");
    expect(res.body).toHaveProperty("totalDispatches");
    expect(res.body).toHaveProperty("totalProviderCalls");
    expect(res.body).toHaveProperty("sessionSuccessRate");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("starts with zero dispatches", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/session");
    expect(res.body.totalDispatches).toBe(0);
    expect(res.body.totalProviderCalls).toBe(0);
    expect(res.body.mostActiveProvider).toBeNull();
  });

  it("reflects pushed runs in totalDispatches", async () => {
    pushRun({
      runId: "s1", timestamp: new Date().toISOString(), intent: "general", query: "q",
      iteration: 1, totalProviders: 3, successCount: 2,
      fastestProvider: "groq-llama", slowestMs: 500, synthesis: "",
      providers: [], totalEstimatedCostUsd: 0,
    });
    const app = buildApp();
    const res = await request(app).get("/api/mother/session");
    expect(res.body.totalDispatches).toBe(1);
    expect(res.body.totalProviderCalls).toBe(3);
  });

  it("topWinner reflects most wins", async () => {
    recordProviderCall("groq-llama", 300, true);
    recordProviderWin("groq-llama");
    recordProviderWin("groq-llama");
    recordProviderCall("mdes-cloud", 800, true);
    recordProviderWin("mdes-cloud");
    const app = buildApp();
    const res = await request(app).get("/api/mother/session");
    expect(res.body.topWinner?.providerId).toBe("groq-llama");
    expect(res.body.topWinner?.wins).toBe(2);
  });
});

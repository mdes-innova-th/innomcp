/**
 * tests/unit/motherSummary.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { recordProviderCall, recordProviderWin, resetStats } from "../../src/services/leaderboardMetrics";
import { resetAllProviders } from "../../src/services/motherProviderToggle";

let routerModule: typeof import("../../src/routes/api/motherSummary");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherSummary");
});

beforeEach(() => {
  resetStats();
  resetAllProviders();
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/summary", routerModule.default);
  return app;
}

describe("GET /api/mother/summary", () => {
  it("returns 200 with expected shape", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalProviders");
    expect(res.body).toHaveProperty("enabledCount");
    expect(res.body).toHaveProperty("totalDispatches");
    expect(res.body).toHaveProperty("totalWins");
    expect(res.body).toHaveProperty("topProvider");
    expect(res.body).toHaveProperty("recentRuns");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("totalProviders is 14", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/summary");
    expect(res.body.totalProviders).toBe(14);
  });

  it("enabledCount matches after disable", async () => {
    const { disableProvider } = await import("../../src/services/motherProviderToggle");
    disableProvider("groq-llama");
    disableProvider("deepseek-r1");
    const app = buildApp();
    const res = await request(app).get("/api/mother/summary");
    expect(res.body.enabledCount).toBe(12);
  });

  it("fastestProvider populated after calls", async () => {
    recordProviderCall("groq-llama", 200, true);
    recordProviderCall("mdes-cloud", 800, true);
    const app = buildApp();
    const res = await request(app).get("/api/mother/summary");
    expect(res.body.fastestProvider?.id).toBe("groq-llama");
  });

  it("totalWins aggregated from all providers", async () => {
    recordProviderWin("groq-llama");
    recordProviderWin("groq-llama");
    recordProviderWin("mdes-cloud");
    const app = buildApp();
    const res = await request(app).get("/api/mother/summary");
    expect(res.body.totalWins).toBe(3);
  });
});

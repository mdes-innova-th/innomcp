/**
 * tests/unit/motherLeaderboardSnapshot.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { recordProviderCall, recordProviderWin, resetStats } from "../../src/services/leaderboardMetrics";
import { resetAllProviders, disableProvider } from "../../src/services/motherProviderToggle";

let routerModule: typeof import("../../src/routes/api/motherLeaderboardSnapshot");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherLeaderboardSnapshot");
});

beforeEach(() => { resetStats(); resetAllProviders(); });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/leaderboard-snapshot", routerModule.default);
  return app;
}

describe("GET /api/mother/leaderboard-snapshot", () => {
  it("returns 200 with 14 providers", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/leaderboard-snapshot");
    expect(res.status).toBe(200);
    expect(res.body.providers).toHaveLength(14);
    expect(res.body.totalProviders).toBe(14);
  });

  it("includes rank, tier, circuitState per provider", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/leaderboard-snapshot");
    for (const p of res.body.providers) {
      expect(p).toHaveProperty("rank");
      expect(p).toHaveProperty("tier");
      expect(p).toHaveProperty("circuitState");
      expect(p).toHaveProperty("sparkline");
    }
  });

  it("activeCount reflects providers with requests", async () => {
    recordProviderCall("groq-llama", 300, true);
    const app = buildApp();
    const res = await request(app).get("/api/mother/leaderboard-snapshot");
    expect(res.body.activeCount).toBeGreaterThanOrEqual(1);
  });

  it("enabledCount decrements when provider disabled", async () => {
    disableProvider("groq-llama");
    const app = buildApp();
    const res = await request(app).get("/api/mother/leaderboard-snapshot");
    expect(res.body.enabledCount).toBe(13);
  });
});

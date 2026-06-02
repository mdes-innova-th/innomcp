/**
 * tests/unit/motherProviderStats.test.ts
 * Tests for GET /api/mother/providers/:id/stats
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { recordProviderCall, recordProviderWin, resetStats } from "../../src/services/leaderboardMetrics";
import { resetAllProviders } from "../../src/services/motherProviderToggle";

let routerModule: typeof import("../../src/routes/api/motherProviders");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherProviders");
});

beforeEach(() => {
  resetStats();
  resetAllProviders();
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/providers", routerModule.default);
  return app;
}

describe("GET /api/mother/providers/:id/stats", () => {
  it("returns 404 for unknown provider", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/providers/unknown-provider/stats");
    expect(res.status).toBe(404);
  });

  it("returns null stats when provider has no calls", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/providers/groq-llama/stats");
    expect(res.status).toBe(200);
    expect(res.body.providerId).toBe("groq-llama");
    expect(res.body.stats).toBeNull();
    expect(res.body.enabled).toBe(true);
  });

  it("returns populated stats after calls", async () => {
    recordProviderCall("groq-llama", 300, true, 500);
    recordProviderWin("groq-llama", "code");
    const app = buildApp();
    const res = await request(app).get("/api/mother/providers/groq-llama/stats");
    expect(res.status).toBe(200);
    expect(res.body.stats.requests).toBe(1);
    expect(res.body.stats.wins).toBe(1);
    expect(res.body.stats.topIntent).toBe("code");
  });

  it("sparkline is an array", async () => {
    recordProviderCall("mdes-cloud", 800, true);
    const app = buildApp();
    const res = await request(app).get("/api/mother/providers/mdes-cloud/stats");
    expect(Array.isArray(res.body.sparkline)).toBe(true);
  });

  it("enabled reflects toggle state", async () => {
    const { disableProvider } = await import("../../src/services/motherProviderToggle");
    disableProvider("innova-bot");
    const app = buildApp();
    const res = await request(app).get("/api/mother/providers/innova-bot/stats");
    expect(res.body.enabled).toBe(false);
  });
});

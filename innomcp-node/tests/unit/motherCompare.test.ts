/**
 * tests/unit/motherCompare.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { recordProviderCall, recordProviderWin, resetStats } from "../../src/services/leaderboardMetrics";

let routerModule: typeof import("../../src/routes/api/motherCompare");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherCompare");
});

beforeEach(() => resetStats());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/compare", routerModule.default);
  return app;
}

describe("GET /api/mother/compare/:id1/:id2", () => {
  it("returns 400 when same id passed twice", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/compare/groq-llama/groq-llama");
    expect(res.status).toBe(400);
  });

  it("returns 404 when neither provider has stats", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/compare/groq-llama/mdes-cloud");
    expect(res.status).toBe(404);
  });

  it("returns comparison with winners when both have stats", async () => {
    recordProviderCall("groq-llama", 200, true, 300);
    recordProviderCall("mdes-cloud", 800, true, 800);
    const app = buildApp();
    const res = await request(app).get("/api/mother/compare/groq-llama/mdes-cloud");
    expect(res.status).toBe(200);
    expect(res.body.comparison).toHaveProperty("provider1");
    expect(res.body.comparison).toHaveProperty("provider2");
    expect(res.body.comparison).toHaveProperty("winners");
    expect(res.body.comparison.winners.speed).toBe("groq-llama");
    expect(res.body.comparison.winners.verbosity).toBe("mdes-cloud");
  });

  it("overall winner is based on composite score", async () => {
    recordProviderCall("groq-llama", 100, true, 200);
    recordProviderWin("groq-llama");
    recordProviderCall("deepseek-r1", 4000, false, 0);
    const app = buildApp();
    const res = await request(app).get("/api/mother/compare/groq-llama/deepseek-r1");
    expect(res.body.comparison.winners.overall).toBe("groq-llama");
  });
});

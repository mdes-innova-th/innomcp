/**
 * tests/unit/motherRankings.test.ts
 * Tests for GET /api/mother/rankings endpoint.
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";

import {
  recordProviderCall,
  recordProviderWin,
  resetStats,
} from "../../src/services/leaderboardMetrics";

let routerModule: typeof import("../../src/routes/api/motherRankings");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherRankings");
});

beforeEach(() => resetStats());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/rankings", routerModule.default);
  return app;
}

describe("GET /api/mother/rankings", () => {
  it("returns 200 with empty rankings when no stats", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/rankings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("rankings");
    expect(Array.isArray(res.body.rankings)).toBe(true);
    expect(res.body.rankings).toHaveLength(0);
    expect(res.body.totalRanked).toBe(0);
  });

  it("returns ranked entries after provider calls", async () => {
    recordProviderCall("groq-llama", 300, true);
    recordProviderCall("mdes-cloud", 800, true);
    const app = buildApp();
    const res = await request(app).get("/api/mother/rankings");
    expect(res.body.rankings.length).toBeGreaterThanOrEqual(2);
    expect(res.body.totalRanked).toBeGreaterThanOrEqual(2);
  });

  it("each entry has required fields", async () => {
    recordProviderCall("claude-haiku", 400, true);
    const app = buildApp();
    const res = await request(app).get("/api/mother/rankings");
    const entry = res.body.rankings[0];
    expect(entry).toHaveProperty("providerId");
    expect(entry).toHaveProperty("rank");
    expect(entry).toHaveProperty("tier");
    expect(entry).toHaveProperty("compositeScore");
    expect(entry).toHaveProperty("wins");
    expect(["gold", "silver", "bronze", "none"]).toContain(entry.tier);
  });

  it("fastest provider gets better speed score", async () => {
    recordProviderCall("groq-llama", 100, true);
    recordProviderCall("mdes-cloud", 2000, true);
    const app = buildApp();
    const res = await request(app).get("/api/mother/rankings");
    const groq = res.body.rankings.find((r: { providerId: string }) => r.providerId === "groq-llama");
    const mdes = res.body.rankings.find((r: { providerId: string }) => r.providerId === "mdes-cloud");
    expect(groq.speedScore).toBeGreaterThan(mdes.speedScore);
  });

  it("top provider gets gold tier when enough providers ranked", async () => {
    for (let i = 1; i <= 5; i++) {
      recordProviderCall(`provider-${i}`, i * 100, true);
    }
    const app = buildApp();
    const res = await request(app).get("/api/mother/rankings");
    const topEntry = res.body.rankings[0];
    expect(topEntry.tier).toBe("gold");
    expect(topEntry.rank).toBe(1);
  });

  it("rankings sorted by compositeScore descending", async () => {
    recordProviderCall("groq-llama", 100, true);
    recordProviderWin("groq-llama");
    recordProviderWin("groq-llama");
    recordProviderCall("deepseek-r1", 5000, false);
    const app = buildApp();
    const res = await request(app).get("/api/mother/rankings");
    const scores = res.body.rankings.map((r: { compositeScore: number }) => r.compositeScore);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });
});

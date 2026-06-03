/**
 * tests/unit/motherStreaks.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import {
  recordProviderWin,
  recordStreaks,
  getProviderStats,
  resetStats,
} from "../../src/services/leaderboardMetrics";

let routerModule: typeof import("../../src/routes/api/motherStreaks");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherStreaks");
});

beforeEach(() => resetStats());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/streaks", routerModule.default);
  return app;
}

describe("recordStreaks", () => {
  it("increments winner streak", () => {
    recordStreaks("groq-llama");
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.currentStreak).toBe(1);
  });

  it("resets other providers on new winner", () => {
    recordStreaks("groq-llama");
    recordStreaks("groq-llama");
    recordStreaks("mdes-cloud"); // groq loses streak
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.currentStreak).toBe(0);
    expect(stats.get("mdes-cloud")!.currentStreak).toBe(1);
  });

  it("tracks bestStreak independently from currentStreak", () => {
    recordStreaks("groq-llama");
    recordStreaks("groq-llama");
    recordStreaks("groq-llama");
    recordStreaks("mdes-cloud"); // groq loses streak but bestStreak stays at 3
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.bestStreak).toBe(3);
    expect(stats.get("groq-llama")!.currentStreak).toBe(0);
  });
});

describe("GET /api/mother/streaks", () => {
  it("returns 200 with streaks shape", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/streaks");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("streaks");
    expect(res.body).toHaveProperty("currentLeader");
  });

  it("currentLeader reflects active streak", async () => {
    recordStreaks("groq-llama");
    recordStreaks("groq-llama");
    const app = buildApp();
    const res = await request(app).get("/api/mother/streaks");
    expect(res.body.currentLeader?.id).toBe("groq-llama");
    expect(res.body.currentLeader?.streak).toBe(2);
  });
});

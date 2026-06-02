/**
 * tests/unit/motherIntentLeaders.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { recordProviderCall, recordProviderWin, resetStats, getProviderStats } from "../../src/services/leaderboardMetrics";

let routerModule: typeof import("../../src/routes/api/motherIntentLeaders");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherIntentLeaders");
});

beforeEach(() => resetStats());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/intent-leaders", routerModule.default);
  return app;
}

describe("intent wins in leaderboard metrics", () => {
  it("winRate is 0 when no requests", () => {
    recordProviderWin("groq-llama", "knowledge");
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.winRate).toBe(0); // no requests, winRate=0
  });

  it("winRate = wins/requests * 100", () => {
    recordProviderCall("groq-llama", 300, true);
    recordProviderCall("groq-llama", 250, true);
    recordProviderWin("groq-llama", "code");
    const stats = getProviderStats();
    expect(stats.get("groq-llama")!.winRate).toBe(50); // 1/2 = 50%
  });

  it("topIntent reflects most-won intent", () => {
    recordProviderWin("mdes-cloud", "greeting");
    recordProviderWin("mdes-cloud", "knowledge");
    recordProviderWin("mdes-cloud", "knowledge");
    const stats = getProviderStats();
    expect(stats.get("mdes-cloud")!.topIntent).toBe("knowledge");
  });

  it("topIntent is undefined when no wins", () => {
    recordProviderCall("deepseek-r1", 500, true);
    const stats = getProviderStats();
    expect(stats.get("deepseek-r1")!.topIntent).toBeUndefined();
  });
});

describe("GET /api/mother/intent-leaders", () => {
  it("returns 200 with leaders array", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/intent-leaders");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("leaders");
    expect(Array.isArray(res.body.leaders)).toBe(true);
    expect(res.body).toHaveProperty("timestamp");
  });

  it("returns intent leader after wins recorded", async () => {
    recordProviderWin("groq-llama", "code");
    recordProviderWin("groq-llama", "code");
    recordProviderWin("mdes-cloud", "knowledge");
    const app = buildApp();
    const res = await request(app).get("/api/mother/intent-leaders");
    const codeLeader = res.body.leaders.find((l: { intent: string }) => l.intent === "code");
    expect(codeLeader?.leaderId).toBe("groq-llama");
    expect(codeLeader?.wins).toBe(2);
  });
});

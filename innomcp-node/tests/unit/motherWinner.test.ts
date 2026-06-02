/**
 * tests/unit/motherWinner.test.ts
 * Tests for the GET /api/mother/winner endpoint.
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";

import {
  recordProviderCall,
  recordProviderWin,
  resetStats,
} from "../../src/services/leaderboardMetrics";

let routerModule: typeof import("../../src/routes/api/motherWinner");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherWinner");
});

beforeEach(() => resetStats());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/winner", routerModule.default);
  return app;
}

describe("GET /api/mother/winner", () => {
  it("returns 200 with null winner when no wins", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/winner");
    expect(res.status).toBe(200);
    expect(res.body.winner).toBeNull();
    expect(res.body.ranked).toHaveLength(0);
    expect(res.body.totalWins).toBe(0);
  });

  it("returns winner after recordProviderWin", async () => {
    recordProviderCall("groq-llama", 300, true);
    recordProviderWin("groq-llama");
    recordProviderWin("groq-llama");
    recordProviderCall("mdes-cloud", 500, true);
    recordProviderWin("mdes-cloud");

    const app = buildApp();
    const res = await request(app).get("/api/mother/winner");
    expect(res.status).toBe(200);
    expect(res.body.winner.providerId).toBe("groq-llama");
    expect(res.body.winner.wins).toBe(2);
    expect(res.body.totalWins).toBe(3);
    expect(res.body.ranked).toHaveLength(2);
  });

  it("ranked is sorted by wins descending", async () => {
    recordProviderWin("together-llama");
    recordProviderWin("together-llama");
    recordProviderWin("together-llama");
    recordProviderWin("innova-bot");
    recordProviderWin("innova-bot");
    recordProviderWin("ollama-local");

    const app = buildApp();
    const res = await request(app).get("/api/mother/winner");
    const ids = res.body.ranked.map((e: { providerId: string }) => e.providerId);
    expect(ids[0]).toBe("together-llama");
    expect(ids[1]).toBe("innova-bot");
    expect(ids[2]).toBe("ollama-local");
  });

  it("providers with 0 wins are excluded from ranked", async () => {
    recordProviderCall("deepseek-r1", 400, true); // call but no win
    recordProviderWin("claude-haiku");

    const app = buildApp();
    const res = await request(app).get("/api/mother/winner");
    expect(res.body.ranked).toHaveLength(1);
    expect(res.body.ranked[0].providerId).toBe("claude-haiku");
  });
});

/**
 * tests/unit/motherTrends.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { pushRun, clearHistory } from "../../src/services/motherHistory";

let routerModule: typeof import("../../src/routes/api/motherTrends");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherTrends");
});

beforeEach(() => clearHistory?.());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/trends", routerModule.default);
  return app;
}

function makeSampleRun(id: string, fastestProvider: string) {
  pushRun({
    runId: id, timestamp: new Date().toISOString(),
    intent: "general", query: "test", iteration: 1,
    totalProviders: 3, successCount: 3,
    fastestProvider, slowestMs: 900, synthesis: "",
    totalEstimatedCostUsd: 0,
    providers: [
      { providerId: fastestProvider, providerName: fastestProvider, latencyMs: 300, success: true, preview: "" },
      { providerId: "mdes-cloud", providerName: "MDES", latencyMs: 600, success: true, preview: "" },
      { providerId: "claude-haiku", providerName: "Haiku", latencyMs: 900, success: true, preview: "" },
    ],
  });
}

describe("GET /api/mother/trends", () => {
  it("returns 200 with trends shape", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/trends");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("timeline");
    expect(res.body).toHaveProperty("frequency");
    expect(res.body).toHaveProperty("dominantWinner");
    expect(res.body).toHaveProperty("avgSuccessRate");
  });

  it("returns empty timeline when no history", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/trends");
    expect(res.body.timeline).toHaveLength(0);
    expect(res.body.dominantWinner).toBeNull();
  });

  it("identifies dominant winner after runs", async () => {
    makeSampleRun("run-1", "groq-llama");
    makeSampleRun("run-2", "groq-llama");
    makeSampleRun("run-3", "mdes-cloud");
    const app = buildApp();
    const res = await request(app).get("/api/mother/trends");
    expect(res.body.dominantWinner).toBe("groq-llama");
    expect(res.body.frequency["groq-llama"]).toBe(2);
    expect(res.body.frequency["mdes-cloud"]).toBe(1);
  });

  it("timeline entries have required fields", async () => {
    makeSampleRun("run-check", "groq-llama");
    const app = buildApp();
    const res = await request(app).get("/api/mother/trends");
    const entry = res.body.timeline[0];
    expect(entry).toHaveProperty("runId");
    expect(entry).toHaveProperty("winner");
    expect(entry).toHaveProperty("timestamp");
  });
});

/**
 * tests/unit/motherExport.test.ts
 * Tests for GET /api/mother/export/:runId and /latest
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { pushRun, clearHistory } from "../../src/services/motherHistory";

let routerModule: typeof import("../../src/routes/api/motherExport");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherExport");
});

beforeEach(() => clearHistory?.());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/export", routerModule.default);
  return app;
}

const SAMPLE_RUN_ID = "test-export-run-001";

function pushSampleRun() {
  pushRun({
    runId: SAMPLE_RUN_ID,
    timestamp: new Date().toISOString(),
    intent: "general",
    query: "test query for export",
    iteration: 1,
    totalProviders: 2,
    successCount: 2,
    fastestProvider: "groq-llama",
    slowestMs: 800,
    synthesis: "combined answer",
    providers: [
      { providerId: "groq-llama", providerName: "Groq", latencyMs: 300, success: true, preview: "Fast groq response" },
      { providerId: "mdes-cloud", providerName: "MDES", latencyMs: 800, success: true, preview: "MDES response here" },
    ],
    totalEstimatedCostUsd: 0.001,
  });
}

describe("GET /api/mother/export/latest", () => {
  it("returns 404 when no runs", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/export/latest");
    expect(res.status).toBe(404);
  });

  it("returns run + rows after pushRun", async () => {
    pushSampleRun();
    const app = buildApp();
    const res = await request(app).get("/api/mother/export/latest");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("run");
    expect(res.body).toHaveProperty("rows");
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows).toHaveLength(2);
  });
});

describe("GET /api/mother/export/:runId", () => {
  it("returns 404 for unknown runId", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/export/unknown-run");
    expect(res.status).toBe(404);
  });

  it("returns run data for known runId", async () => {
    pushSampleRun();
    const app = buildApp();
    const res = await request(app).get(`/api/mother/export/${SAMPLE_RUN_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.run.runId).toBe(SAMPLE_RUN_ID);
    expect(res.body.rows[0]).toHaveProperty("providerId");
    expect(res.body.rows[0]).toHaveProperty("latencyMs");
    expect(res.body.rows[0]).toHaveProperty("preview");
    expect(res.body.rows[0]).toHaveProperty("isFastest");
  });

  it("isFastest is true for fastestProvider", async () => {
    pushSampleRun();
    const app = buildApp();
    const res = await request(app).get(`/api/mother/export/${SAMPLE_RUN_ID}`);
    const groqRow = res.body.rows.find((r: { providerId: string }) => r.providerId === "groq-llama");
    expect(groqRow.isFastest).toBe(true);
  });
});

describe("GET /api/mother/export/:runId/csv", () => {
  it("returns text/csv content type", async () => {
    pushSampleRun();
    const app = buildApp();
    const res = await request(app).get(`/api/mother/export/${SAMPLE_RUN_ID}/csv`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
  });
});

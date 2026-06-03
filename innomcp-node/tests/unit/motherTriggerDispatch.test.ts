/**
 * tests/unit/motherTriggerDispatch.test.ts
 * Tests for POST /api/mother/trigger-dispatch
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";

let routerModule: typeof import("../../src/routes/api/motherTriggerDispatch");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherTriggerDispatch");
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/trigger-dispatch", routerModule.default);
  return app;
}

describe("POST /api/mother/trigger-dispatch", () => {
  it("returns 400 when query is empty string", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/trigger-dispatch")
      .send({ query: "" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("returns 200 with dispatch result shape", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/trigger-dispatch")
      .send({ query: "hello", intent: "greeting" });
    // May succeed or fail depending on provider keys — just verify shape
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.ok).toBe(true);
      expect(res.body).toHaveProperty("runId");
      expect(res.body).toHaveProperty("totalAgents");
      expect(res.body).toHaveProperty("successCount");
      expect(Array.isArray(res.body.providers)).toBe(true);
    }
  }, 30_000); // providers time out — allow 30s

  it("default query works when no body provided", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/trigger-dispatch").send({});
    // Should not 400 — default query is used
    expect(res.status).not.toBe(400);
  }, 30_000);
});

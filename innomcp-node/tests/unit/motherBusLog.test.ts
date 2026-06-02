/**
 * tests/unit/motherBusLog.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";

let routerModule: typeof import("../../src/routes/api/motherBusLog");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherBusLog");
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/bus-log", routerModule.default);
  return app;
}

describe("GET /api/mother/bus-log", () => {
  it("returns 200 with messages array shape", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/bus-log");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("messages");
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("total matches messages array length", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/bus-log");
    expect(res.body.total).toBe(res.body.messages.length);
  });

  it("limit query parameter is respected", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/bus-log?limit=3");
    expect(res.body.messages.length).toBeLessThanOrEqual(3);
  });
});

/**
 * tests/unit/motherCircuits.test.ts
 * Tests for GET /api/mother/circuits and POST /api/mother/circuits/:id/reset
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";

let routerModule: typeof import("../../src/routes/api/motherCircuits");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherCircuits");
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/circuits", routerModule.default);
  return app;
}

describe("GET /api/mother/circuits", () => {
  it("returns 200 with circuits array", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/circuits");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("circuits");
    expect(Array.isArray(res.body.circuits)).toBe(true);
    expect(res.body).toHaveProperty("openCount");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("returns 14 circuit entries (one per provider)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/circuits");
    expect(res.body.circuits).toHaveLength(14);
  });

  it("each circuit entry has providerId, state, and failures", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/circuits");
    for (const c of res.body.circuits) {
      expect(typeof c.providerId).toBe("string");
      expect(typeof c.state).toBe("string");
      expect(["CLOSED", "OPEN", "HALF_OPEN", "UNKNOWN"]).toContain(c.state);
      expect(typeof c.failures).toBe("number");
    }
  });

  it("openCount matches number of OPEN circuits", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/circuits");
    const openFromList = res.body.circuits.filter((c: { state: string }) => c.state === "OPEN").length;
    expect(res.body.openCount).toBe(openFromList);
  });

  it("innova-oracle is in the circuit list", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/circuits");
    const oracle = res.body.circuits.find((c: { providerId: string }) => c.providerId === "innova-oracle");
    expect(oracle).toBeDefined();
  });
});

describe("POST /api/mother/circuits/:providerId/reset", () => {
  it("returns 200 with ok=true for known provider", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/circuits/groq-llama/reset");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.state).toBe("CLOSED");
  });

  it("returns 404 for unknown provider", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/circuits/unknown-provider/reset");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });
});

/**
 * tests/unit/motherRoster.test.ts — motherRoster route
 */

import express from "express";
import request from "supertest";

// We test the module-level ROSTER via the Express router
let routerModule: typeof import("../../src/routes/api/motherRoster");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherRoster");
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/roster", routerModule.default);
  return app;
}

describe("GET /api/mother/roster", () => {
  it("returns 200 with providers array", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/roster");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("providers");
    expect(Array.isArray(res.body.providers)).toBe(true);
  });

  it("returns exactly 13 providers", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/roster");
    expect(res.body.totalProviders).toBe(13);
    expect(res.body.providers.length).toBe(13);
  });

  it("alwaysOnCount is 2 (ollama-local + innova-bot)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/roster");
    expect(res.body.alwaysOnCount).toBe(2);
  });

  it("each provider has required fields", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/roster");
    for (const p of res.body.providers) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
      expect(typeof p.kind).toBe("string");
      expect(typeof p.model).toBe("string");
      expect(typeof p.alwaysOn).toBe("boolean");
      expect(typeof p.keyAvailable).toBe("boolean");
    }
  });

  it("always-on providers have keyAvailable=true regardless of env", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/roster");
    const alwaysOn = res.body.providers.filter((p: { alwaysOn: boolean }) => p.alwaysOn);
    expect(alwaysOn.length).toBe(2);
    for (const p of alwaysOn) {
      expect(p.keyAvailable).toBe(true);
    }
  });
});

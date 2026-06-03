/**
 * tests/unit/motherInboxConfig.test.ts
 * Tests for GET /api/mother/inbox and GET /api/mother/config
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import { resetAllProviders, disableProvider } from "../../src/services/motherProviderToggle";

let inboxModule: typeof import("../../src/routes/api/motherInbox");
let configModule: typeof import("../../src/routes/api/motherConfig");

beforeAll(async () => {
  inboxModule = await import("../../src/routes/api/motherInbox");
  configModule = await import("../../src/routes/api/motherConfig");
});

beforeEach(() => resetAllProviders());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/inbox", inboxModule.default);
  app.use("/api/mother/config", configModule.default);
  return app;
}

describe("GET /api/mother/inbox", () => {
  it("returns 200 with messages array", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/inbox");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("messages");
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("newCount");
  });

  it("total matches messages length", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/inbox");
    expect(res.body.total).toBe(res.body.messages.length);
  });
});

describe("GET /api/mother/config", () => {
  it("returns 200 with 14 providers", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/config");
    expect(res.status).toBe(200);
    expect(res.body.providers).toHaveLength(14);
    expect(res.body.totalProviders).toBe(14);
  });

  it("alwaysOnCount is 3", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/config");
    expect(res.body.alwaysOnCount).toBe(3);
  });

  it("enabledCount drops after disable", async () => {
    disableProvider("groq-llama");
    const app = buildApp();
    const res = await request(app).get("/api/mother/config");
    expect(res.body.enabledCount).toBe(13);
  });

  it("each provider has required fields (no apiKey)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/config");
    for (const p of res.body.providers) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("model");
      expect(p).toHaveProperty("circuitState");
      expect(p).toHaveProperty("keyConfigured");
      // apiKey must NOT be exposed
      expect(p).not.toHaveProperty("apiKey");
    }
  });

  it("featureFlags present", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/config");
    expect(res.body).toHaveProperty("featureFlags");
    expect(typeof res.body.featureFlags.motherDispatch).toBe("boolean");
    expect(res.body.featureFlags.minAgents).toBe(5);
  });
});

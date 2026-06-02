/**
 * tests/unit/motherProviderToggle.test.ts
 * Tests for provider enable/disable toggle service + route.
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";

import {
  isProviderEnabled,
  enableProvider,
  disableProvider,
  toggleProvider,
  getDisabledProviders,
  resetAllProviders,
} from "../../src/services/motherProviderToggle";

let routerModule: typeof import("../../src/routes/api/motherProviders");

beforeAll(async () => {
  routerModule = await import("../../src/routes/api/motherProviders");
});

beforeEach(() => resetAllProviders());

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/providers", routerModule.default);
  return app;
}

// ── Service unit tests ────────────────────────────────────────────────────────

describe("motherProviderToggle service", () => {
  it("all providers start enabled", () => {
    expect(isProviderEnabled("groq-llama")).toBe(true);
    expect(isProviderEnabled("mdes-cloud")).toBe(true);
    expect(isProviderEnabled("innova-oracle")).toBe(true);
  });

  it("disableProvider makes isProviderEnabled return false", () => {
    disableProvider("groq-llama");
    expect(isProviderEnabled("groq-llama")).toBe(false);
  });

  it("enableProvider re-enables a disabled provider", () => {
    disableProvider("mdes-cloud");
    enableProvider("mdes-cloud");
    expect(isProviderEnabled("mdes-cloud")).toBe(true);
  });

  it("toggleProvider flips state and returns new state", () => {
    expect(toggleProvider("claude-haiku")).toBe(false); // was enabled, now disabled
    expect(isProviderEnabled("claude-haiku")).toBe(false);
    expect(toggleProvider("claude-haiku")).toBe(true);  // was disabled, now enabled
    expect(isProviderEnabled("claude-haiku")).toBe(true);
  });

  it("getDisabledProviders returns all disabled IDs", () => {
    disableProvider("groq-llama");
    disableProvider("deepseek-r1");
    const disabled = getDisabledProviders();
    expect(disabled).toContain("groq-llama");
    expect(disabled).toContain("deepseek-r1");
    expect(disabled).toHaveLength(2);
  });

  it("resetAllProviders re-enables everything", () => {
    disableProvider("copilot");
    disableProvider("gemini-pro");
    resetAllProviders();
    expect(isProviderEnabled("copilot")).toBe(true);
    expect(isProviderEnabled("gemini-pro")).toBe(true);
    expect(getDisabledProviders()).toHaveLength(0);
  });
});

// ── Route tests ───────────────────────────────────────────────────────────────

describe("GET /api/mother/providers", () => {
  it("returns 14 providers all enabled", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/mother/providers");
    expect(res.status).toBe(200);
    expect(res.body.providers).toHaveLength(14);
    expect(res.body.enabledCount).toBe(14);
    for (const p of res.body.providers) {
      expect(p.enabled).toBe(true);
    }
  });
});

describe("POST /api/mother/providers/:id/toggle", () => {
  it("toggles provider state and returns new state", async () => {
    const app = buildApp();
    const res1 = await request(app).post("/api/mother/providers/groq-llama/toggle");
    expect(res1.status).toBe(200);
    expect(res1.body.ok).toBe(true);
    expect(res1.body.enabled).toBe(false);

    const res2 = await request(app).post("/api/mother/providers/groq-llama/toggle");
    expect(res2.body.enabled).toBe(true);
  });

  it("returns 404 for unknown provider", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/providers/fake-provider/toggle");
    expect(res.status).toBe(404);
  });
});

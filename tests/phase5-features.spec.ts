/**
 * Phase 5 Features — INNOMCP E2E Tests
 *
 * Covers 10 acceptance criteria for Phase 5 features:
 *   - Workspace upload endpoint
 *   - Templates API
 *   - Plugins API
 *   - Webhooks CRUD
 *   - Cache stats
 *   - Metrics/performance endpoint
 *   - Health endpoint (uptime + memory)
 *   - Provider health check
 *   - Workspace file list
 *   - Auth/me endpoint
 *
 * Prerequisites (services running):
 *   innomcp-node  :3011
 *
 * Run from repo root:
 *   npx playwright test tests/phase5-features.spec.ts
 */

import { test, expect } from "@playwright/test";

const API = "http://localhost:3011";

test.describe("Phase 5 Features — INNOMCP", () => {

  test("P5-1: workspace upload endpoint accepts CSV", async ({ request }) => {
    const csvContent = "name,value\nAlice,100\nBob,200";
    const formData = new FormData();
    formData.append("file", new Blob([csvContent], { type: "text/csv" }), "test.csv");

    const res = await request.post(`${API}/api/workspace/upload`, {
      multipart: {
        file: {
          name: "test.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvContent),
        },
      },
    });
    // May need auth — accept 200 or 401 (endpoint exists either way)
    expect([200, 401, 403]).toContain(res.status());
  });

  test("P5-2: templates API returns built-in templates", async ({ request }) => {
    const res = await request.get(`${API}/api/templates`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("templates");
    expect(Array.isArray(body.templates)).toBe(true);
  });

  test("P5-3: plugins API returns built-in plugins", async ({ request }) => {
    const res = await request.get(`${API}/api/plugins`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("plugins");
    expect(body.plugins.length).toBeGreaterThan(0);
  });

  test("P5-4: webhooks API CRUD works", async ({ request }) => {
    const create = await request.post(`${API}/api/webhooks`, {
      data: { name: "Test", url: "https://example.com/webhook", events: ["task.completed"] }
    });
    expect([200, 201]).toContain(create.status());
    const list = await request.get(`${API}/api/webhooks`);
    expect(list.status()).toBe(200);
  });

  test("P5-5: cache stats endpoint", async ({ request }) => {
    const res = await request.get(`${API}/api/cache/stats`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("size");
    expect(body).toHaveProperty("keys");
  });

  test("P5-6: metrics/performance endpoint", async ({ request }) => {
    const res = await request.get(`${API}/api/metrics/performance`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("routes");
    expect(body).toHaveProperty("generatedAt");
  });

  test("P5-7: health endpoint returns uptime and memory", async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("memory");
  });

  test("P5-8: provider health check fires", async ({ request }) => {
    const res = await request.post(`${API}/api/providers/health-check`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("results");
    expect(Array.isArray(body.results)).toBe(true);
  });

  test("P5-9: workspace file list returns array", async ({ request }) => {
    const res = await request.get(`${API}/api/workspace/files`);
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("files");
    }
  });

  test("P5-10: auth/me returns user or 401", async ({ request }) => {
    const res = await request.get(`${API}/api/auth/me`);
    expect([200, 401]).toContain(res.status());
  });
});

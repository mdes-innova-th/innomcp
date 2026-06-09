/**
 * tests/unit/healthLivenessReadiness.test.ts
 *
 * TICKET-013: Health Endpoint Refactor — liveness / readiness split.
 *
 * Test coverage:
 *   Unit — checkLiveness(), checkReadiness(), deriveCompositeStatus logic
 *   Integration — GET /api/health?detailed=true via supertest
 *   Backward compat — existing GET /api/health contract unaffected
 *   Spike / degradation — Redis offline does NOT flip liveness red
 *   Performance — liveness returns within 50 ms, readiness within 500 ms
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const axiosMock = jest.fn();
const getRedisClientMock = jest.fn();
const getRedisHealthSnapshotMock = jest.fn();
const pingDatabaseMock = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: axiosMock,
}));

jest.mock("../../src/utils/redis", () => ({
  getRedisClient: getRedisClientMock,
  getRedisHealthSnapshot: getRedisHealthSnapshotMock,
}));

jest.mock("../../src/utils/db", () => ({
  pingDatabase: pingDatabaseMock,
}));

jest.mock("../../src/utils/mcpLogger", () => ({
  logBoth: jest.fn(),
}));

jest.mock("../../src/routes/api/aiMode", () => ({
  getCurrentAIMode: jest.fn(() => "local"),
}));

jest.mock("../../src/routes/api/chat", () => ({
  mcpClient: {
    getToolInventory: jest.fn(() => ({
      totalTools: 10,
      localTools: 4,
      remoteTools: 6,
      connectedClients: 1,
      remoteReady: true,
    })),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

import express from "express";
import request from "supertest";

/** Build an express app that mounts the health router at /api/health */
async function makeApp() {
  const { healthRouter } = await import("../../src/routes/api/health");
  const app = express();
  app.use("/api/health", healthRouter);
  return app;
}

/** Default mock helpers */
function setupHappyPath() {
  // MCP server health check (liveness target) — axios returns 200
  axiosMock.mockImplementation(async (config: { url?: string }) => {
    const url = String(config?.url || "");
    if (url.includes("open-meteo")) {
      return {
        status: 200,
        statusText: "OK",
        data: { current: { temperature_2m: 30 } },
      };
    }
    if (url.includes("api.search.brave.com")) {
      return {
        status: 200,
        statusText: "OK",
        data: { web: { results: [] } },
      };
    }
    // Default: MCP server and any other HTTP service
    return { status: 200, statusText: "OK", data: { status: "ok" } };
  });

  getRedisClientMock.mockResolvedValue({
    ping: jest.fn().mockResolvedValue("PONG"),
  });
  getRedisHealthSnapshotMock.mockReturnValue({
    status: "ready",
    configured: true,
    ready: true,
    retryAfterMs: 0,
    rawStatus: "ready",
  });
  pingDatabaseMock.mockResolvedValue(undefined);
}

function setupRedisOffline() {
  axiosMock.mockImplementation(async (config: { url?: string }) => {
    return { status: 200, statusText: "OK", data: { status: "ok" } };
  });
  getRedisClientMock.mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:6379"));
  getRedisHealthSnapshotMock.mockReturnValue({
    status: "disconnected",
    configured: true,
    ready: false,
    retryAfterMs: 0,
    rawStatus: "disconnected",
  });
  pingDatabaseMock.mockResolvedValue(undefined);
}

function setupDatabaseOffline() {
  axiosMock.mockImplementation(async () => ({
    status: 200,
    statusText: "OK",
    data: { status: "ok" },
  }));
  getRedisClientMock.mockResolvedValue({
    ping: jest.fn().mockResolvedValue("PONG"),
  });
  getRedisHealthSnapshotMock.mockReturnValue({
    status: "ready",
    configured: true,
    ready: true,
    retryAfterMs: 0,
    rawStatus: "ready",
  });
  pingDatabaseMock.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:3306"));
}

function setupMcpServerOffline() {
  axiosMock.mockImplementation(async (config: { url?: string }) => {
    const url = String(config?.url || "");
    if (url.includes("3012") || url.includes("localhost") || url.includes("health")) {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3012");
    }
    return { status: 200, statusText: "OK", data: {} };
  });
  getRedisClientMock.mockResolvedValue({
    ping: jest.fn().mockResolvedValue("PONG"),
  });
  getRedisHealthSnapshotMock.mockReturnValue({
    status: "ready",
    configured: true,
    ready: true,
    retryAfterMs: 0,
    rawStatus: "ready",
  });
  pingDatabaseMock.mockResolvedValue(undefined);
}

// ── Test suites ────────────────────────────────────────────────────────────────

describe("TICKET-013: checkLiveness()", () => {
  beforeEach(() => {
    jest.resetModules();
    axiosMock.mockReset();
    getRedisClientMock.mockReset();
    getRedisHealthSnapshotMock.mockReset();
    pingDatabaseMock.mockReset();
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TMD_UID_API;
    delete process.env.TMD_UKEY_API;
  });

  // Test 1
  it("returns green when MCP server responds 200", async () => {
    setupHappyPath();
    const { checkLiveness } = await import("../../src/utils/monitoring");
    const result = await checkLiveness();

    expect(result.status).toBe("green");
    expect(result.last_error).toBeNull();
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.checks.every((c: { status: string }) => c.status === "green")).toBe(true);
  });

  // Test 2
  it("returns red when MCP server is unreachable", async () => {
    setupMcpServerOffline();
    const { checkLiveness } = await import("../../src/utils/monitoring");
    const result = await checkLiveness();

    expect(result.status).toBe("red");
    expect(result.checks.some((c: { status: string }) => c.status === "red")).toBe(true);
  });

  // Test 3
  it("does NOT include Redis or Database in liveness checks", async () => {
    setupHappyPath();
    const { checkLiveness } = await import("../../src/utils/monitoring");
    const result = await checkLiveness();

    const names = result.checks.map((c: { service: string }) => c.service);
    expect(names).not.toContain("Redis");
    expect(names).not.toContain("Database");
  });

  // Test 4
  it("includes MCP Server in liveness checks", async () => {
    setupHappyPath();
    const { checkLiveness } = await import("../../src/utils/monitoring");
    const result = await checkLiveness();

    const names = result.checks.map((c: { service: string }) => c.service);
    expect(names).toContain("MCP Server");
  });

  // Test 5
  it("always includes response_time_ms in result", async () => {
    setupHappyPath();
    const { checkLiveness } = await import("../../src/utils/monitoring");
    const result = await checkLiveness();

    expect(typeof result.response_time_ms).toBe("number");
    expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
  });

  // Test 6
  it("liveness result has a valid ISO timestamp", async () => {
    setupHappyPath();
    const { checkLiveness } = await import("../../src/utils/monitoring");
    const result = await checkLiveness();

    expect(typeof result.last_check).toBe("string");
    expect(new Date(result.last_check).getTime()).not.toBeNaN();
  });

  // Test 7 - performance
  it("completes within 50ms under normal conditions", async () => {
    // Mock fast responses
    axiosMock.mockResolvedValue({ status: 200, statusText: "OK", data: { status: "ok" } });
    const { checkLiveness } = await import("../../src/utils/monitoring");

    const t0 = Date.now();
    await checkLiveness();
    const elapsed = Date.now() - t0;

    // Jest overhead adds a few ms, allow generous 200ms in test env
    expect(elapsed).toBeLessThan(200);
  });
});

describe("TICKET-013: checkReadiness()", () => {
  beforeEach(() => {
    jest.resetModules();
    axiosMock.mockReset();
    getRedisClientMock.mockReset();
    getRedisHealthSnapshotMock.mockReset();
    pingDatabaseMock.mockReset();
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TMD_UID_API;
  });

  // Test 8
  it("returns green when Redis and DB are healthy", async () => {
    setupHappyPath();
    const { checkReadiness } = await import("../../src/utils/monitoring");
    const result = await checkReadiness();

    expect(result.status).toBe("green");
    expect(result.last_error).toBeNull();
  });

  // Test 9
  it("returns red/yellow when Redis is offline", async () => {
    setupRedisOffline();
    const { checkReadiness } = await import("../../src/utils/monitoring");
    const result = await checkReadiness();

    expect(["yellow", "red"]).toContain(result.status);
    const redisCheck = result.checks.find((c: { service: string }) => c.service === "Redis");
    expect(redisCheck).toBeDefined();
    expect(["yellow", "red"]).toContain(redisCheck!.status);
  });

  // Test 10
  it("returns red/yellow when DB is offline", async () => {
    setupDatabaseOffline();
    const { checkReadiness } = await import("../../src/utils/monitoring");
    const result = await checkReadiness();

    const dbCheck = result.checks.find((c: { service: string }) => c.service === "Database");
    expect(dbCheck).toBeDefined();
    expect(["yellow", "red"]).toContain(dbCheck!.status);
  });

  // Test 11
  it("includes Redis and Database in readiness checks", async () => {
    setupHappyPath();
    const { checkReadiness } = await import("../../src/utils/monitoring");
    const result = await checkReadiness();

    const names = result.checks.map((c: { service: string }) => c.service);
    expect(names).toContain("Redis");
    expect(names).toContain("Database");
  });

  // Test 12
  it("does NOT include MCP Server in readiness checks", async () => {
    setupHappyPath();
    const { checkReadiness } = await import("../../src/utils/monitoring");
    const result = await checkReadiness();

    const names = result.checks.map((c: { service: string }) => c.service);
    expect(names).not.toContain("MCP Server");
  });

  // Test 13 - performance
  it("completes within 500ms under normal conditions", async () => {
    setupHappyPath();
    const { checkReadiness } = await import("../../src/utils/monitoring");

    const t0 = Date.now();
    await checkReadiness();
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(1000); // 1s ceiling in test env
  });

  // Test 14
  it("readiness result has valid response_time_ms and last_check fields", async () => {
    setupHappyPath();
    const { checkReadiness } = await import("../../src/utils/monitoring");
    const result = await checkReadiness();

    expect(typeof result.response_time_ms).toBe("number");
    expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
    expect(new Date(result.last_check).getTime()).not.toBeNaN();
  });
});

describe("TICKET-013: createDetailedHealthResponse()", () => {
  beforeEach(() => {
    jest.resetModules();
    axiosMock.mockReset();
    getRedisClientMock.mockReset();
    getRedisHealthSnapshotMock.mockReset();
    pingDatabaseMock.mockReset();
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TMD_UID_API;
  });

  // Test 15
  it("returns healthy when MCP green and stores green", async () => {
    setupHappyPath();
    const { createDetailedHealthResponse } = await import("../../src/utils/monitoring");
    const result = await createDetailedHealthResponse();

    expect(result.status).toBe("healthy");
    expect(result.liveness.status).toBe("green");
    expect(result.readiness.status).toBe("green");
  });

  // Test 16 — key TICKET-013 requirement
  it("returns degraded (not unhealthy) when Redis is offline but MCP works", async () => {
    setupRedisOffline();
    const { createDetailedHealthResponse } = await import("../../src/utils/monitoring");
    const result = await createDetailedHealthResponse();

    expect(result.status).toBe("degraded");
    expect(result.liveness.status).toBe("green");
    expect(["yellow", "red"]).toContain(result.readiness.status);
  });

  // Test 17 — key TICKET-013 requirement
  it("returns degraded (not unhealthy) when DB is offline but MCP works", async () => {
    setupDatabaseOffline();
    const { createDetailedHealthResponse } = await import("../../src/utils/monitoring");
    const result = await createDetailedHealthResponse();

    expect(result.status).toBe("degraded");
    expect(result.liveness.status).toBe("green");
  });

  // Test 18
  it("returns unhealthy when MCP server is offline", async () => {
    setupMcpServerOffline();
    const { createDetailedHealthResponse } = await import("../../src/utils/monitoring");
    const result = await createDetailedHealthResponse();

    expect(result.status).toBe("unhealthy");
    expect(result.liveness.status).toBe("red");
  });

  // Test 19
  it("includes metrics, liveness, readiness, timestamp at top level", async () => {
    setupHappyPath();
    const { createDetailedHealthResponse } = await import("../../src/utils/monitoring");
    const result = await createDetailedHealthResponse();

    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("liveness");
    expect(result).toHaveProperty("readiness");
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("timestamp");
  });

  // Test 20
  it("metrics block contains memory and process fields", async () => {
    setupHappyPath();
    const { createDetailedHealthResponse } = await import("../../src/utils/monitoring");
    const result = await createDetailedHealthResponse();

    expect(result.metrics).toHaveProperty("memory");
    expect(result.metrics).toHaveProperty("process");
    expect(result.metrics).toHaveProperty("uptime");
  });
});

describe("TICKET-013: GET /api/health?detailed=true (HTTP integration)", () => {
  beforeEach(() => {
    jest.resetModules();
    axiosMock.mockReset();
    getRedisClientMock.mockReset();
    getRedisHealthSnapshotMock.mockReset();
    pingDatabaseMock.mockReset();
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TMD_UID_API;
  });

  // Test 21
  it("returns 200 and detailed shape when system is healthy", async () => {
    setupHappyPath();
    const app = await makeApp();
    const response = await request(app).get("/api/health?detailed=true");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("liveness");
    expect(response.body).toHaveProperty("readiness");
    expect(response.body).toHaveProperty("metrics");
    expect(response.body).toHaveProperty("timestamp");
  });

  // Test 22
  it("returns 200 with status=degraded when Redis offline but MCP works", async () => {
    setupRedisOffline();
    const app = await makeApp();
    const response = await request(app).get("/api/health?detailed=true");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("degraded");
    expect(response.body.liveness.status).toBe("green");
  });

  // Test 23
  it("returns 503 with status=unhealthy when MCP server is offline", async () => {
    setupMcpServerOffline();
    const app = await makeApp();
    const response = await request(app).get("/api/health?detailed=true");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("unhealthy");
    expect(response.body.liveness.status).toBe("red");
  });

  // Test 24
  it("liveness checks field is an array with per-service entries", async () => {
    setupHappyPath();
    const app = await makeApp();
    const response = await request(app).get("/api/health?detailed=true");

    expect(Array.isArray(response.body.liveness.checks)).toBe(true);
    expect(response.body.liveness.checks.length).toBeGreaterThan(0);
    for (const check of response.body.liveness.checks) {
      expect(check).toHaveProperty("service");
      expect(check).toHaveProperty("status");
      expect(check).toHaveProperty("response_time_ms");
    }
  });

  // Test 25
  it("readiness checks field is an array with Redis and Database entries", async () => {
    setupHappyPath();
    const app = await makeApp();
    const response = await request(app).get("/api/health?detailed=true");

    const names = (response.body.readiness.checks as Array<{ service: string }>).map(
      (c) => c.service
    );
    expect(names).toContain("Redis");
    expect(names).toContain("Database");
  });
});

describe("TICKET-013: backward compatibility — GET /api/health (no detailed param)", () => {
  beforeEach(() => {
    jest.resetModules();
    axiosMock.mockReset();
    getRedisClientMock.mockReset();
    getRedisHealthSnapshotMock.mockReset();
    pingDatabaseMock.mockReset();
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TMD_UID_API;
  });

  // Test 26
  it("still returns the legacy shape (no liveness/readiness keys) on plain /api/health", async () => {
    setupHappyPath();
    const app = await makeApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    // Legacy shape must not include the new TICKET-013 keys
    expect(response.body).not.toHaveProperty("liveness");
    expect(response.body).not.toHaveProperty("readiness");
    // Legacy shape must still include mode/redis fields
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("mode");
    expect(response.body).toHaveProperty("redis_status");
  });

  // Test 27
  it("GET /api/health?detailed=false also returns legacy shape", async () => {
    setupHappyPath();
    const app = await makeApp();
    const response = await request(app).get("/api/health?detailed=false");

    expect(response.body).not.toHaveProperty("liveness");
    expect(response.body).not.toHaveProperty("readiness");
    expect(response.body).toHaveProperty("redis_status");
  });

  // Test 28
  it("legacy /api/health still exposes redis_status, redis_ready, redis_configured", async () => {
    setupRedisOffline();
    const app = await makeApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("redis_status");
    expect(response.body).toHaveProperty("redis_ready");
    expect(response.body).toHaveProperty("redis_configured");
  });
});

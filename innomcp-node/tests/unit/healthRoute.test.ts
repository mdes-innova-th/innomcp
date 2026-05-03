import express from "express";
import request from "supertest";

jest.mock("../../src/utils/monitoring", () => ({
  createHealthResponse: jest.fn(),
  getSystemMetrics: jest.fn(() => ({ uptime: 123 })),
}));

jest.mock("../../src/utils/redis", () => ({
  getRedisHealthSnapshot: jest.fn(),
}));

jest.mock("../../src/routes/api/aiMode", () => ({
  getCurrentAIMode: jest.fn(() => "local"),
}));

jest.mock("../../src/routes/api/chat", () => ({
  mcpClient: {
    getToolInventory: jest.fn(() => ({
      totalTools: 56,
      localTools: 4,
      remoteTools: 52,
      connectedClients: 1,
      remoteReady: true,
    })),
  },
}));

import { createHealthResponse } from "../../src/utils/monitoring";
import { getRedisHealthSnapshot } from "../../src/utils/redis";
import { healthRouter } from "../../src/routes/api/health";

const createHealthResponseMock = createHealthResponse as jest.Mock;
const getRedisHealthSnapshotMock = getRedisHealthSnapshot as jest.Mock;

function makeApp() {
  const app = express();
  app.use("/api/health", healthRouter);
  return app;
}

describe("health route Redis contract", () => {
  beforeEach(() => {
    createHealthResponseMock.mockReset();
    getRedisHealthSnapshotMock.mockReset();

    createHealthResponseMock.mockResolvedValue({
      status: "degraded",
      services: [],
      timestamp: "2026-04-29T00:00:00.000Z",
    });
    getRedisHealthSnapshotMock.mockReturnValue({
      status: "cooldown",
      configured: true,
      ready: false,
      retryAfterMs: 1750,
      rawStatus: "disconnected",
    });
  });

  it("GET /api/health exposes explicit redis status fields", async () => {
    const response = await request(makeApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "degraded",
      mode: "online",
      mode_ready: true,
      mcp_status: "connected",
      redis_status: "cooldown",
      redis_ready: false,
      redis_configured: true,
      redis_retry_after_ms: 1750,
      redis_raw_status: "disconnected",
    });
  });

  it("GET /api/health/keys includes redis status in both top-level and data payloads", async () => {
    const response = await request(makeApp()).get("/api/health/keys");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      redisStatus: "cooldown",
      redisReady: false,
      redisConfigured: true,
      redisRetryAfterMs: 1750,
    });
    expect(response.body.data).toMatchObject({
      redisStatus: "cooldown",
      redisReady: false,
      redisConfigured: true,
      redisRetryAfterMs: 1750,
    });
  });

  it("GET /api/health reports disabled Redis explicitly when not configured", async () => {
    getRedisHealthSnapshotMock.mockReturnValue({
      status: "disabled",
      configured: false,
      ready: false,
      retryAfterMs: 0,
      rawStatus: "disconnected",
    });

    const response = await request(makeApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      redis_status: "disabled",
      redis_ready: false,
      redis_configured: false,
      redis_retry_after_ms: 0,
    });
  });
});
import { EventEmitter } from "events";

const loggerMock = {
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

const logBothMock = jest.fn();

class MockRedis extends EventEmitter {
  status = "wait";

  async connect(): Promise<void> {
    this.emit("error", new Error("connect ECONNREFUSED 127.0.0.1:6399"));
    this.status = "end";
    throw new Error("Connection is closed.");
  }

  disconnect(): void {
    this.status = "end";
  }

  async quit(): Promise<string> {
    this.status = "end";
    return "OK";
  }

  multi() {
    throw new Error("Redis multi should not be used during Redis-down fallback");
  }

  async ping(): Promise<string> {
    return "PONG";
  }
}

jest.mock("ioredis", () => ({
  __esModule: true,
  default: MockRedis,
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: loggerMock,
}));

jest.mock("../../src/utils/mcpLogger", () => ({
  logBoth: logBothMock,
}));

describe("Redis-down fallback regression", () => {
  const originalEnv = {
    REDIS_URL: process.env.REDIS_URL,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_RETRY_COOLDOWN_MS: process.env.REDIS_RETRY_COOLDOWN_MS,
    REDIS_CONNECT_TIMEOUT_MS: process.env.REDIS_CONNECT_TIMEOUT_MS,
    REDIS_MAX_CONNECT_RETRIES: process.env.REDIS_MAX_CONNECT_RETRIES,
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.REDIS_URL = "";
    process.env.REDIS_HOST = "127.0.0.1";
    process.env.REDIS_PORT = "6399";
    process.env.REDIS_PASSWORD = "";
    process.env.REDIS_RETRY_COOLDOWN_MS = "1000";
    process.env.REDIS_CONNECT_TIMEOUT_MS = "250";
    process.env.REDIS_MAX_CONNECT_RETRIES = "1";
  });

  afterEach(async () => {
    const redisModule = await import("../../src/utils/redis");
    await redisModule.closeRedisConnection();

    process.env.REDIS_URL = originalEnv.REDIS_URL;
    process.env.REDIS_HOST = originalEnv.REDIS_HOST;
    process.env.REDIS_PORT = originalEnv.REDIS_PORT;
    process.env.REDIS_PASSWORD = originalEnv.REDIS_PASSWORD;
    process.env.REDIS_RETRY_COOLDOWN_MS = originalEnv.REDIS_RETRY_COOLDOWN_MS;
    process.env.REDIS_CONNECT_TIMEOUT_MS = originalEnv.REDIS_CONNECT_TIMEOUT_MS;
    process.env.REDIS_MAX_CONNECT_RETRIES = originalEnv.REDIS_MAX_CONNECT_RETRIES;
  });

  it("enters cooldown and metrics fall back to memory without Redis record warnings", async () => {
    const redisModule = await import("../../src/utils/redis");
    const latencyModule = await import("../../src/metrics/latency");

    await expect(redisModule.getRedisClient()).rejects.toThrow("Connection is closed.");
    expect(redisModule.getRedisStatus()).toBe("cooldown");

    await expect(latencyModule.recordLatency("GET:/api/health", 12)).resolves.toBeUndefined();
    await expect(latencyModule.recordLatency("GET:/api/ai-mode", 9)).resolves.toBeUndefined();

    const stats = await latencyModule.getLatencyStats("GET:/api/health");
    expect(stats?.count).toBe(1);
    expect(stats?.avg).toBe(12);

    const emittedMetricRedisWarning = loggerMock.warn.mock.calls.some(([message, meta]) => {
      return String(message).includes("[Metrics] Redis record failed") || String(meta?.error || "").includes("MaxRetriesPerRequestError");
    });
    expect(emittedMetricRedisWarning).toBe(false);
  });

  it("rate limiter falls back to memory while Redis is cooling down", async () => {
    const redisModule = await import("../../src/utils/redis");
    const rateLimitModule = await import("../../src/fastpath/rateLimit");

    await expect(redisModule.getRedisClient()).rejects.toThrow("Connection is closed.");
    expect(redisModule.getRedisStatus()).toBe("cooldown");

    const result = await rateLimitModule.checkRateLimit("redis-down-test", 5, 8);
    expect(result).toMatchObject({
      allowed: true,
      total: 1,
      remaining: 7,
      ttl: 5,
    });

    await expect(rateLimitModule.getRateLimitStats()).resolves.toEqual({
      backend: "memory",
      connected: false,
    });
  });
});
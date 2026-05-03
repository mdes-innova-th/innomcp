
import Redis, { RedisOptions } from "ioredis";
import "dotenv/config";
import { logBoth } from "./mcpLogger";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatRedisError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

const redisUrl = String(process.env.REDIS_URL || "").trim();
const redisHost = String(process.env.REDIS_HOST || "").trim();
const redisPort = parsePositiveInt(process.env.REDIS_PORT, 6379);
const redisConnectTimeoutMs = parsePositiveInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 1000);
const redisRetryCooldownMs = parsePositiveInt(process.env.REDIS_RETRY_COOLDOWN_MS, 30000);
const redisMaxConnectRetries = parsePositiveInt(process.env.REDIS_MAX_CONNECT_RETRIES, 2);
const hasRedisConfig = Boolean(redisUrl || redisHost);
const redisReadyStatuses = new Set(["ready"]);

export type RedisHealthStatus =
  | "disabled"
  | "cooldown"
  | "ready"
  | "connecting"
  | "reconnecting"
  | "disconnected";

export interface RedisHealthSnapshot {
  status: RedisHealthStatus;
  configured: boolean;
  ready: boolean;
  retryAfterMs: number;
  rawStatus: string;
}

const baseRedisConfig: RedisOptions = {
  password: process.env.REDIS_PASSWORD,
  connectTimeout: redisConnectTimeoutMs,
  enableOfflineQueue: false,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: (times: number) => {
    if (times > redisMaxConnectRetries) return null;
    return Math.min(times * 100, 1000);
  },
};

// Create Redis client instance (can be null if not configured)
export let redisClient: Redis | null = null;
let redisRetryBlockedUntil = 0;
let lastRedisErrorText = "";
let lastRedisErrorAt = 0;

function detachRedisListeners(client: Redis): void {
  client.removeAllListeners("error");
  client.removeAllListeners("connect");
  client.removeAllListeners("ready");
  client.removeAllListeners("end");
}

function releaseRedisClient(client: Redis | null): void {
  if (!client) return;
  detachRedisListeners(client);
  try {
    client.disconnect(false);
  } catch {
    // Ignore disconnect cleanup errors.
  }
  if (redisClient === client) {
    redisClient = null;
  }
}

function logRedisWarningOnce(prefix: string, err: unknown): void {
  const message = `${prefix}${formatRedisError(err)}`;
  const now = Date.now();
  if (message === lastRedisErrorText && now - lastRedisErrorAt < redisRetryCooldownMs) {
    return;
  }
  lastRedisErrorText = message;
  lastRedisErrorAt = now;
  logBoth("warn", message);
}

function buildRedisClient(): Redis {
  const client = redisUrl
    ? new Redis(redisUrl, baseRedisConfig)
    : new Redis({
        ...baseRedisConfig,
        host: redisHost,
        port: redisPort,
      });

  client.on("error", (err) => {
    if (redisClient !== client) return;
    logRedisWarningOnce("[redis] Redis connection error: ", err);
  });

  client.on("connect", () => {
    if (redisClient !== client) return;
    redisRetryBlockedUntil = 0;
    logBoth("info", "[redis] Connected to Redis server");
  });

  client.on("ready", () => {
    if (redisClient !== client) return;
    redisRetryBlockedUntil = 0;
    logBoth("info", "[redis] Redis client is ready");
  });

  client.on("end", () => {
    if (redisClient !== client) return;
    redisRetryBlockedUntil = Date.now() + redisRetryCooldownMs;
    releaseRedisClient(client);
    logBoth("warn", "[redis] Redis connection ended; falling back to in-memory mode");
  });

  return client;
}

export function isRedisConfigured(): boolean {
  return hasRedisConfig;
}

function normalizeRedisStatus(rawStatus: string): RedisHealthStatus {
  if (rawStatus === "ready") return "ready";
  if (rawStatus === "wait" || rawStatus === "connecting" || rawStatus === "connect") return "connecting";
  if (rawStatus === "reconnecting") return "reconnecting";
  return "disconnected";
}

export function getRedisStatus(): RedisHealthStatus {
  if (!hasRedisConfig) return "disabled";
  if (Date.now() < redisRetryBlockedUntil) return "cooldown";
  return normalizeRedisStatus(redisClient?.status || "disconnected");
}

export function getRedisHealthSnapshot(): RedisHealthSnapshot {
  const retryAfterMs = Math.max(0, redisRetryBlockedUntil - Date.now());
  const rawStatus = redisClient?.status || "disconnected";
  const status = getRedisStatus();

  return {
    status,
    configured: hasRedisConfig,
    ready: status === "ready",
    retryAfterMs,
    rawStatus,
  };
}

export function getReadyRedisClient(): Redis | null {
  if (!redisClient) return null;
  return redisReadyStatuses.has(redisClient.status) ? redisClient : null;
}

export const getRedisClient = async (): Promise<Redis> => {
  const readyClient = getReadyRedisClient();
  if (readyClient) {
    return readyClient;
  }

  if (!hasRedisConfig) {
    throw new Error("REDIS_NOT_CONFIGURED");
  }

  if (Date.now() < redisRetryBlockedUntil) {
    throw new Error("REDIS_TEMPORARILY_UNAVAILABLE");
  }

  if (!redisClient || redisClient.status === "end") {
    releaseRedisClient(redisClient);
    redisClient = buildRedisClient();
  }

  if (redisClient.status === "wait") {
    try {
      await redisClient.connect();
    } catch (err) {
      redisRetryBlockedUntil = Date.now() + redisRetryCooldownMs;
      const failedClient = redisClient;
      releaseRedisClient(failedClient);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  if (!redisReadyStatuses.has(redisClient.status)) {
    throw new Error(`REDIS_NOT_READY:${redisClient.status}`);
  }

  return redisClient;
};

// Close Redis connection (useful for testing and graceful shutdowns)
export const closeRedisConnection = async (): Promise<void> => {
  const client = redisClient;
  if (!client) return;

  redisClient = null;
  detachRedisListeners(client);

  try {
    if (client.status === "ready") {
      await client.quit();
    } else {
      client.disconnect(false);
    }
  } finally {
    logBoth("info", "[redis] Redis connection closed");
  }
};


import Redis from "ioredis";
import "dotenv/config";
import { logBoth } from "./mcpLogger";

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    // Exponential backoff with max delay of 10 seconds
    const delay = Math.min(times * 50, 10000);
    return delay;
  },
};

// Create Redis client instance (can be null if not configured)
export let redisClient: Redis | null = null;

export const getRedisClient = async (): Promise<Redis> => {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);

    redisClient.on("error", (err) => {
      logBoth("error", `[redis] Redis connection error: ${err}`);
    });

    redisClient.on("connect", () => {
      logBoth("info", "[redis] Connected to Redis server");
    });
    
    redisClient.on("ready", () => {
      logBoth("info", "[redis] Redis client is ready");
    });
  }

  return redisClient;
};

// Close Redis connection (useful for testing and graceful shutdowns)
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logBoth("info", "[redis] Redis connection closed");
  }
};

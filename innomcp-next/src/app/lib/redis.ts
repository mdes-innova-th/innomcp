import Redis from "ioredis";

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    // Exponential backoff with max delay of 10 seconds, stop after 5 retries
    if (times > 5) return null;
    const delay = Math.min(times * 50, 10000);
    return delay;
  },
};

// Create Redis client instance
let redisClient: Redis | null = null;

export const getRedisClient = async (): Promise<Redis> => {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);

    redisClient.on("error", (err) => {
      console.error("[getRedisClient] Redis connection error:", err);
    });

    redisClient.on("connect", () => {
      console.log("[getRedisClient] Connected to Redis server");
    });
  }

  return redisClient;
};

// Close Redis connection (useful for testing and graceful shutdowns)
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("Redis connection closed");
  }
};

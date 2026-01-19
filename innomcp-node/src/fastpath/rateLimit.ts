/**
 * Rate Limiter - Token Bucket Algorithm with Redis
 * Anti-spam protection
 */

import Redis from 'ioredis';
import { logBoth } from '../utils/mcpLogger';

const REDIS_URL = process.env.REDIS_URL || '';
let redis: Redis | null = null;

// Initialize Redis connection
if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL);
    redis.on('error', (err) => {
      logBoth('error', `[RateLimit] Redis connection error: ${err.message}`);
      redis = null;
    });
    redis.on('connect', () => {
      logBoth('info', '[RateLimit] Redis connected successfully');
    });
  } catch (err) {
    logBoth('error', `[RateLimit] Failed to initialize Redis: ${err}`);
    redis = null;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  ttl: number;
  total: number;
}

/**
 * In-memory fallback rate limiter (when Redis unavailable)
 */
class InMemoryRateLimiter {
  private storage: Map<string, { count: number; resetAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.storage.entries()) {
        if (now > value.resetAt) {
          this.storage.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  async check(key: string, windowSec: number, maxRequests: number): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry || now > entry.resetAt) {
      // New window
      this.storage.set(key, {
        count: 1,
        resetAt: now + windowSec * 1000
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        ttl: windowSec,
        total: 1
      };
    }

    // Existing window
    entry.count++;
    const ttl = Math.ceil((entry.resetAt - now) / 1000);
    const allowed = entry.count <= maxRequests;

    return {
      allowed,
      remaining: Math.max(0, maxRequests - entry.count),
      ttl,
      total: entry.count
    };
  }

  clear() {
    this.storage.clear();
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.storage.clear();
  }
}

const memoryLimiter = new InMemoryRateLimiter();

/**
 * Check rate limit using Redis or in-memory fallback
 */
export async function checkRateLimit(
  key: string,
  windowSec: number = 5,
  maxRequests: number = 8
): Promise<RateLimitResult> {
  // Use in-memory if Redis unavailable
  if (!redis) {
    return memoryLimiter.check(key, windowSec, maxRequests);
  }

  try {
    const rateLimitKey = `rl:${key}`;
    
    // Use Redis pipeline for atomic operations
    const multi = redis.multi();
    multi.incr(rateLimitKey);
    multi.ttl(rateLimitKey);
    
    const results = await multi.exec();
    
    if (!results) {
      throw new Error('Redis multi.exec() returned null');
    }

    const count = Number(results[0][1] || 0);
    let ttl = Number(results[1][1] || -1);

    // Set TTL if key is new
    if (ttl < 0) {
      await redis.expire(rateLimitKey, windowSec);
      ttl = windowSec;
    }

    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    return {
      allowed,
      remaining,
      ttl,
      total: count
    };
  } catch (err) {
    logBoth('error', `[RateLimit] Redis error, falling back to memory: ${err}`);
    // Fallback to in-memory
    return memoryLimiter.check(key, windowSec, maxRequests);
  }
}

/**
 * Build rate limit key from request info
 */
export function buildRateLimitKey(
  ip: string,
  userId?: string,
  route?: string
): string {
  const parts = ['ip', ip];
  if (userId) parts.push('user', userId);
  if (route) parts.push('route', route);
  return parts.join(':');
}

/**
 * Clear rate limit for a key (admin/testing)
 */
export async function clearRateLimit(key: string): Promise<boolean> {
  if (!redis) {
    memoryLimiter.clear();
    return true;
  }

  try {
    const rateLimitKey = `rl:${key}`;
    await redis.del(rateLimitKey);
    return true;
  } catch (err) {
    logBoth('error', `[RateLimit] Failed to clear key ${key}: ${err}`);
    return false;
  }
}

/**
 * Get rate limit stats for monitoring
 */
export async function getRateLimitStats(): Promise<{
  backend: 'redis' | 'memory';
  connected: boolean;
}> {
  return {
    backend: redis ? 'redis' : 'memory',
    connected: redis ? (await redis.ping() === 'PONG') : false
  };
}

export default {
  checkRateLimit,
  buildRateLimitKey,
  clearRateLimit,
  getRateLimitStats
};

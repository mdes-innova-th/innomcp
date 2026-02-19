/**
 * Redis Cache Utility
 * General-purpose caching with TTL support
 * Used for web search, Wikipedia, Drive lists, etc.
 */

import crypto from 'crypto';
import { logBoth } from './mcpLogger';

// In-memory fallback cache
interface CacheEntry {
  data: any;
  expiresAt: number;
}

const inMemoryCache = new Map<string, CacheEntry>();

// Redis client placeholder (not available in MCP server)
const redisClient: any = null;

/**
 * Get cached data or execute fetch function
 * @param key Cache key
 * @param ttlSeconds Time to live in seconds
 * @param fetchFn Function to fetch fresh data
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try Redis first (disabled for MCP server)
  /*
  try {
    if (redisClient) {
      const cached = await redisClient.get(key);
      
      if (cached) {
        logBoth('debug', '[Cache] Hit (Redis)', { key: key.substring(0, 50) });
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    logBoth('warn', '[Cache] Redis get failed', { 
      key: key.substring(0, 50), 
      error: String(err) 
    });
  }
  */

  // Check in-memory cache
  const now = Date.now();
  const memEntry = inMemoryCache.get(key);
  
  if (memEntry && memEntry.expiresAt > now) {
    logBoth('INFO', `[Cache] Hit (in-memory): ${key.substring(0, 50)}`);
    return memEntry.data;
  }

  // Fetch fresh data
  logBoth('INFO', `[Cache] Miss - fetching: ${key.substring(0, 50)}`);
  const fresh = await fetchFn();

  // Cache in-memory
  inMemoryCache.set(key, {
    data: fresh,
    expiresAt: now + (ttlSeconds * 1000)
  });

  return fresh;
}

/**
 * Build cache key from parts
 * Uses MD5 hash to keep keys short
 */
export function cacheKey(...parts: (string | number)[]): string {
  const str = parts.map(String).join(':');
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `cache:${hash}`;
}

/**
 * Build semantic cache key (human-readable prefix + hash)
 */
export function semanticCacheKey(prefix: string, ...parts: (string | number)[]): string {
  const str = parts.map(String).join(':');
  const hash = crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
  return `cache:${prefix}:${hash}`;
}

/**
 * Clear cache by key
 */
export async function clearCache(key: string): Promise<void> {
  inMemoryCache.delete(key);
  logBoth('INFO', `[Cache] Cleared (in-memory): ${key.substring(0, 50)}`);
}

/**
 * Clear all caches matching pattern
 */
export async function clearCachePattern(pattern: string): Promise<number> {
  let count = 0;

  // Clear in-memory matches
  for (const key of inMemoryCache.keys()) {
    if (key.includes(pattern.replace('*', ''))) {
      inMemoryCache.delete(key);
      count++;
    }
  }

  logBoth('INFO', `[Cache] Cleared pattern (in-memory): ${pattern}, count: ${count}`);

  return count;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  redis: { available: boolean; keyCount?: number };
  memory: { entryCount: number };
}> {
  return {
    redis: { available: false },
    memory: { entryCount: inMemoryCache.size }
  };
}

/**
 * Cleanup expired in-memory entries
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of inMemoryCache.entries()) {
    if (entry.expiresAt <= now) {
      inMemoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logBoth('INFO', `[Cache] Cleaned expired entries: ${cleaned}`);
  }
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredCache, 300_000);

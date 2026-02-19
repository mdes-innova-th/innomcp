/**
 * Simple In-Memory Cache Module
 * Cache สำหรับลด API calls และเพิ่มความเร็ว
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * Cache TTL (Time To Live) in seconds
 */
export const CACHE_TTL = {
  WEATHER: 300, // 5 minutes
  WEATHER_SHORT: 120, // 2 minutes (for rapid updates)
  TIME: 10, // 10 seconds (time changes frequently)
  OFFICE_HOLDER: 21600, // 6 hours
  OFFICE_HOLDER_SHORT: 3600, // 1 hour
  SEARCH: 1800, // 30 minutes
  RADAR: 180, // 3 minutes
  DEFAULT: 300, // 5 minutes
} as const;

class SimpleCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  
  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttlSeconds * 1000,
      createdAt: now,
    };
    
    this.cache.set(key, entry);
  }
  
  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache stats
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    
    this.cache.forEach((entry) => {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    });
    
    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
      maxSize: this.maxSize,
    };
  }
  
  /**
   * Clean expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    });
    
    return removed;
  }
  
  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    this.cache.forEach((entry, key) => {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Global cache instance
export const cache = new SimpleCache(1000);

/**
 * Helper: Generate cache key
 */
export function generateCacheKey(
  prefix: string,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join('|');
  
  return `${prefix}:${sortedParams}`;
}

/**
 * Helper: Wrap function with cache
 */
export function withCache<T>(
  cacheKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(cacheKey);
  if (cached !== null) {
    return Promise.resolve(cached);
  }
  
  // Execute function and cache result
  return fn().then((result) => {
    cache.set(cacheKey, result, ttlSeconds);
    return result;
  });
}

/**
 * Schedule periodic cleanup
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) {
    return; // Already started
  }
  
  cleanupInterval = setInterval(() => {
    const removed = cache.cleanup();
    if (removed > 0) {
      console.log(`[Cache] Cleaned up ${removed} expired entries`);
    }
  }, intervalMs);
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

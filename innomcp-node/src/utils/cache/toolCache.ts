
import { LRUCache } from 'lru-cache';
import logger from '../logger';

// Default TTL: 30 minutes
const DEFAULT_TTL = 30 * 60 * 1000;
const MAX_ITEMS = 500;

// Initialize LRU Cache
const toolCache = new LRUCache<string, any>({
  max: MAX_ITEMS,
  ttl: DEFAULT_TTL,
  updateAgeOnGet: false, // Don't extend TTL on read (strict expiration)
});

export const ToolCache = {
  /**
   * Generate a unique cache key for a tool call
   */
  generateKey(toolName: string, args: any): string {
    // Sort keys to ensure consistent cache hits regardless of key order
    const sortedArgs = Object.keys(args)
      .sort()
      .reduce((acc: any, key: string) => {
        acc[key] = args[key];
        return acc;
      }, {});
    
    return `${toolName}:${JSON.stringify(sortedArgs)}`;
  },

  /**
   * Get cached result if available
   */
  get<T>(key: string): T | undefined {
    const value = toolCache.get(key) as T | undefined;
    if (value) {
      logger.info(`[ToolCache] HIT: ${key}`);
    }
    return value;
  },

  /**
   * Set cache with optional custom TTL (ms)
   */
  set(key: string, value: any, ttl?: number): void {
    logger.info(`[ToolCache] SET: ${key} (ttl: ${ttl || DEFAULT_TTL}ms)`);
    toolCache.set(key, value, { ttl: ttl || DEFAULT_TTL });
  },

  /**
   * Clear all cache
   */
  clear(): void {
    toolCache.clear();
    logger.info(`[ToolCache] CLEARED`);
  }
};

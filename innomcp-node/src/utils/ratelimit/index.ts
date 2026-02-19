/**
 * Rate Limiting Module
 * จำกัดจำนวน API calls เพื่อป้องกันการโดนบล็อกและควบคุมต้นทุน
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private config: Record<string, RateLimitConfig>;
  
  constructor() {
    this.limits = new Map();
    
    // Default rate limits
    this.config = {
      'weather': { maxRequests: 100, windowMs: 60000 }, // 100 requests/min
      'search': { maxRequests: 50, windowMs: 60000 }, // 50 requests/min
      'officeholder': { maxRequests: 30, windowMs: 60000 }, // 30 requests/min
      'default': { maxRequests: 60, windowMs: 60000 }, // 60 requests/min
    };
  }
  
  /**
   * Check if request is allowed
   */
  isAllowed(key: string, category: string = 'default'): boolean {
    const config = this.config[category] || this.config['default'];
    const now = Date.now();
    const limitKey = `${category}:${key}`;
    
    let entry = this.limits.get(limitKey);
    
    // Create new entry if not exists
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      this.limits.set(limitKey, entry);
    }
    
    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      return false;
    }
    
    // Increment counter
    entry.count++;
    return true;
  }
  
  /**
   * Get remaining requests
   */
  getRemaining(key: string, category: string = 'default'): number {
    const config = this.config[category] || this.config['default'];
    const limitKey = `${category}:${key}`;
    const entry = this.limits.get(limitKey);
    
    if (!entry || Date.now() > entry.resetAt) {
      return config.maxRequests;
    }
    
    return Math.max(0, config.maxRequests - entry.count);
  }
  
  /**
   * Get reset time
   */
  getResetTime(key: string, category: string = 'default'): number | null {
    const limitKey = `${category}:${key}`;
    const entry = this.limits.get(limitKey);
    
    if (!entry || Date.now() > entry.resetAt) {
      return null;
    }
    
    return entry.resetAt;
  }
  
  /**
   * Reset limit for key
   */
  reset(key: string, category: string = 'default'): void {
    const limitKey = `${category}:${key}`;
    this.limits.delete(limitKey);
  }
  
  /**
   * Set custom rate limit
   */
  setLimit(category: string, maxRequests: number, windowMs: number): void {
    this.config[category] = { maxRequests, windowMs };
  }
  
  /**
   * Get stats
   */
  getStats() {
    const stats: Record<string, any> = {};
    
    this.limits.forEach((entry, key) => {
      const [category, identifier] = key.split(':');
      
      if (!stats[category]) {
        stats[category] = {
          totalKeys: 0,
          totalRequests: 0,
          config: this.config[category] || this.config['default'],
        };
      }
      
      stats[category].totalKeys++;
      stats[category].totalRequests += entry.count;
    });
    
    return stats;
  }
  
  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    this.limits.forEach((entry, key) => {
      if (now > entry.resetAt) {
        this.limits.delete(key);
        removed++;
      }
    });
    
    return removed;
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

/**
 * Middleware-like wrapper for rate limiting
 */
export async function withRateLimit<T>(
  key: string,
  category: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!rateLimiter.isAllowed(key, category)) {
    const resetTime = rateLimiter.getResetTime(key, category);
    const waitMs = resetTime ? resetTime - Date.now() : 60000;
    
    throw new Error(
      `Rate limit exceeded. Please try again in ${Math.ceil(waitMs / 1000)} seconds.`
    );
  }
  
  return fn();
}

/**
 * Start periodic cleanup
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startRateLimitCleanup(intervalMs: number = 120000): void {
  if (cleanupInterval) {
    return;
  }
  
  cleanupInterval = setInterval(() => {
    const removed = rateLimiter.cleanup();
    if (removed > 0) {
      console.log(`[RateLimit] Cleaned up ${removed} expired entries`);
    }
  }, intervalMs);
}

export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

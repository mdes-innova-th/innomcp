/**
 * Performance Metrics System
 * à¹€à¸à¹‡à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥ metrics: response time, cache hit rate, error rate
 * 
 * Features:
 * - Response time tracking
 * - Cache hit/miss statistics
 * - Error rate monitoring
 * - Tool usage analytics
 * 
 * @module utils/metrics
 */

import { logBoth } from '../mcpLogger';

/**
 * Metric Entry
 */
export interface MetricEntry {
  timestamp: Date;
  type: 'response_time' | 'cache' | 'error' | 'tool_usage';
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Performance Statistics
 */
export interface PerformanceStats {
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    count: number;
  };
  cache: {
    hitRate: number;
    hits: number;
    misses: number;
    totalRequests: number;
  };
  errors: {
    rate: number;
    total: number;
    byCategory: Record<string, number>;
  };
  tools: {
    usageCount: Record<string, number>;
    averageTime: Record<string, number>;
  };
}

/**
 * Performance Metrics Manager
 */
class PerformanceMetricsManager {
  private responseTimes: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private errorCount = 0;
  private errorsByCategory: Map<string, number> = new Map();
  private toolUsage: Map<string, number[]> = new Map();
  private maxSamples = 10000;

  /**
   * Record response time
   */
  recordResponseTime(timeMs: number, metadata?: Record<string, any>): void {
    this.responseTimes.push(timeMs);

    // Trim if needed
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }

    if (metadata) {
      logBoth('info', `[Metrics] Response time: ${timeMs}ms (${JSON.stringify(metadata)})`);
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Record error
   */
  recordError(category: string = 'unknown'): void {
    this.errorCount++;
    const current = this.errorsByCategory.get(category) || 0;
    this.errorsByCategory.set(category, current + 1);
  }

  /**
   * Record tool usage
   */
  recordToolUsage(toolName: string, executionTimeMs: number): void {
    if (!this.toolUsage.has(toolName)) {
      this.toolUsage.set(toolName, []);
    }
    const times = this.toolUsage.get(toolName)!;
    times.push(executionTimeMs);

    // Trim if needed
    if (times.length > 1000) {
      times.shift();
    }
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get response time statistics
   */
  getResponseTimeStats(): PerformanceStats['responseTime'] {
    if (this.responseTimes.length === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0
      };
    }

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return {
      avg: sum / this.responseTimes.length,
      min: Math.min(...this.responseTimes),
      max: Math.max(...this.responseTimes),
      p50: this.calculatePercentile(this.responseTimes, 50),
      p95: this.calculatePercentile(this.responseTimes, 95),
      p99: this.calculatePercentile(this.responseTimes, 99),
      count: this.responseTimes.length
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): PerformanceStats['cache'] {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hitRate: total > 0 ? (this.cacheHits / total) * 100 : 0,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      totalRequests: total
    };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): PerformanceStats['errors'] {
    const total = this.responseTimes.length;
    const errorsByCategory: Record<string, number> = {};
    
    for (const [category, count] of this.errorsByCategory) {
      errorsByCategory[category] = count;
    }

    return {
      rate: total > 0 ? (this.errorCount / total) * 100 : 0,
      total: this.errorCount,
      byCategory: errorsByCategory
    };
  }

  /**
   * Get tool usage statistics
   */
  getToolStats(): PerformanceStats['tools'] {
    const usageCount: Record<string, number> = {};
    const averageTime: Record<string, number> = {};

    for (const [toolName, times] of this.toolUsage) {
      usageCount[toolName] = times.length;
      const sum = times.reduce((a, b) => a + b, 0);
      averageTime[toolName] = sum / times.length;
    }

    return {
      usageCount,
      averageTime
    };
  }

  /**
   * Get all statistics
   */
  getAllStats(): PerformanceStats {
    return {
      responseTime: this.getResponseTimeStats(),
      cache: this.getCacheStats(),
      errors: this.getErrorStats(),
      tools: this.getToolStats()
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.responseTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.errorCount = 0;
    this.errorsByCategory.clear();
    this.toolUsage.clear();
    logBoth('info', '[Metrics] Statistics reset');
  }

  /**
   * Get metrics summary
   */
  getSummary(): string {
    const stats = this.getAllStats();
    return `
Performance Metrics Summary:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Response Time:
  â€¢ Average: ${stats.responseTime.avg.toFixed(2)}ms
  â€¢ P50: ${stats.responseTime.p50.toFixed(2)}ms
  â€¢ P95: ${stats.responseTime.p95.toFixed(2)}ms
  â€¢ P99: ${stats.responseTime.p99.toFixed(2)}ms
  â€¢ Min/Max: ${stats.responseTime.min}ms / ${stats.responseTime.max}ms
  â€¢ Count: ${stats.responseTime.count}

Cache:
  â€¢ Hit Rate: ${stats.cache.hitRate.toFixed(2)}%
  â€¢ Hits: ${stats.cache.hits}
  â€¢ Misses: ${stats.cache.misses}
  â€¢ Total: ${stats.cache.totalRequests}

Errors:
  â€¢ Rate: ${stats.errors.rate.toFixed(2)}%
  â€¢ Total: ${stats.errors.total}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }
}

// Export singleton instance
export const performanceMetrics = new PerformanceMetricsManager();

/**
 * Helper: Record response time
 */
export function recordResponseTime(timeMs: number, metadata?: Record<string, any>): void {
  performanceMetrics.recordResponseTime(timeMs, metadata);
}

/**
 * Helper: Record cache hit/miss
 */
export function recordCacheHit(hit: boolean): void {
  if (hit) {
    performanceMetrics.recordCacheHit();
  } else {
    performanceMetrics.recordCacheMiss();
  }
}

/**
 * Helper: Record error
 */
export function recordError(category?: string): void {
  performanceMetrics.recordError(category);
}

/**
 * Helper: Record tool usage
 */
export function recordToolUsage(toolName: string, executionTimeMs: number): void {
  performanceMetrics.recordToolUsage(toolName, executionTimeMs);
}

/**
 * Helper: Get all statistics
 */
export function getPerformanceStats(): PerformanceStats {
  return performanceMetrics.getAllStats();
}

/**
 * Helper: Get metrics summary
 */
export function getMetricsSummary(): string {
  return performanceMetrics.getSummary();
}

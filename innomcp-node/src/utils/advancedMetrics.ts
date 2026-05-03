/**
 * Advanced Metrics: Per-Tool Latency Tracking (p50/p95/p99)
 * Stores latency data in Redis for real-time analytics
 */

import { getReadyRedisClient } from './redis';
import logger from './logger';

interface LatencyRecord {
  tool: string;
  endpoint: string;
  latencyMs: number;
  timestamp: number;
}

const METRICS_TTL = 7 * 24 * 60 * 60; // 7 days
const MAX_RECORDS_PER_KEY = 5000;

/**
 * Record latency for a specific tool
 */
export async function recordToolLatency(
  toolName: string,
  latencyMs: number,
  endpoint = 'websocket'
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `metrics:tool:${toolName}:${today}`;
    const redis = getReadyRedisClient();
    
    if (redis) {
      // Store as list (for percentile calculations)
      await redis.lpush(key, String(latencyMs));
      await redis.ltrim(key, 0, MAX_RECORDS_PER_KEY - 1);
      await redis.expire(key, METRICS_TTL);
      
      logger.debug(`[Metrics] Tool latency recorded: ${toolName} = ${latencyMs}ms`);
    } else {
      // Fallback: just log (in production, consider sending to external metrics service)
      logger.debug(`[Metrics] Tool latency (no Redis): ${toolName} = ${latencyMs}ms`);
    }
  } catch (err) {
    logger.warn(`[Metrics] Failed to record tool latency: ${err}`);
  }
}

/**
 * Record endpoint latency
 */
export async function recordEndpointLatency(
  endpoint: string,
  latencyMs: number
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `metrics:endpoint:${endpoint}:${today}`;
    const redis = getReadyRedisClient();
    
    if (redis) {
      await redis.lpush(key, String(latencyMs));
      await redis.ltrim(key, 0, MAX_RECORDS_PER_KEY - 1);
      await redis.expire(key, METRICS_TTL);
      
      logger.debug(`[Metrics] Endpoint latency recorded: ${endpoint} = ${latencyMs}ms`);
    }
  } catch (err) {
    logger.warn(`[Metrics] Failed to record endpoint latency: ${err}`);
  }
}

/**
 * Calculate percentiles from array of latencies
 */
function calculatePercentiles(values: number[]): {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
  count: number;
} {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0, count: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;
  
  const p50 = sorted[Math.floor(len * 0.50)];
  const p95 = sorted[Math.floor(len * 0.95)];
  const p99 = sorted[Math.floor(len * 0.99)];
  const min = sorted[0];
  const max = sorted[len - 1];
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / len);
  
  return { p50, p95, p99, min, max, avg, count: len };
}

/**
 * Get tool latency statistics
 */
export async function getToolLatencyStats(
  toolName: string,
  days = 1
): Promise<ReturnType<typeof calculatePercentiles>> {
  const allValues: number[] = [];
  const redis = getReadyRedisClient();
  
  try {
    if (!redis) {
      return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0, count: 0 };
    }
    
    // Get data from last N days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const key = `metrics:tool:${toolName}:${dateStr}`;
      
      const values = await redis.lrange(key, 0, -1);
      allValues.push(...values.map(v => parseInt(v, 10)).filter(v => !isNaN(v)));
    }
    
    return calculatePercentiles(allValues);
  } catch (err) {
    logger.warn(`[Metrics] Failed to get tool latency stats: ${err}`);
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0, count: 0 };
  }
}

/**
 * Get endpoint latency statistics
 */
export async function getEndpointLatencyStats(
  endpoint: string,
  days = 1
): Promise<ReturnType<typeof calculatePercentiles>> {
  const allValues: number[] = [];
  const redis = getReadyRedisClient();
  
  try {
    if (!redis) {
      return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0, count: 0 };
    }
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const key = `metrics:endpoint:${endpoint}:${dateStr}`;
      
      const values = await redis.lrange(key, 0, -1);
      allValues.push(...values.map(v => parseInt(v, 10)).filter(v => !isNaN(v)));
    }
    
    return calculatePercentiles(allValues);
  } catch (err) {
    logger.warn(`[Metrics] Failed to get endpoint latency stats: ${err}`);
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0, count: 0 };
  }
}

/**
 * Get all tools' latency summary
 */
export async function getAllToolsLatencyStats(
  days = 1
): Promise<Record<string, ReturnType<typeof calculatePercentiles>>> {
  const stats: Record<string, ReturnType<typeof calculatePercentiles>> = {};
  const redis = getReadyRedisClient();
  
  try {
    if (!redis) {
      return stats;
    }
    
    // Get all tool metric keys
    const pattern = `metrics:tool:*:${new Date().toISOString().slice(0, 10)}`;
    const keys = await redis.keys(pattern);
    
    // Extract unique tool names
    const toolNames = new Set<string>();
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        toolNames.add(parts[2]); // toolName is at index 2
      }
    }
    
    // Get stats for each tool
    for (const toolName of toolNames) {
      stats[toolName] = await getToolLatencyStats(toolName, days);
    }
    
    return stats;
  } catch (err) {
    logger.warn(`[Metrics] Failed to get all tools latency stats: ${err}`);
    return stats;
  }
}

/**
 * Enhanced metrics endpoint response format
 */
export interface AdvancedMetricsResponse {
  system: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    timestamp: string;
  };
  performance: {
    tools: Record<string, {
      p50: number;
      p95: number;
      p99: number;
      avg: number;
      count: number;
    }>;
    endpoints: Record<string, {
      p50: number;
      p95: number;
      p99: number;
      avg: number;
      count: number;
    }>;
  };
  fastPath: {
    enabled: boolean;
    cacheHitRate?: number;
    avgLatencyMs?: number;
  };
}

/**
 * Generate comprehensive metrics report
 */
export async function generateMetricsReport(days = 1): Promise<AdvancedMetricsResponse> {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  const toolsStats = await getAllToolsLatencyStats(days);
  
  // Get FastPath stats
  const fastPathStats = await getEndpointLatencyStats('fastpath', days);
  
  return {
    system: {
      uptime: Math.round(uptime),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      timestamp: new Date().toISOString()
    },
    performance: {
      tools: Object.entries(toolsStats).reduce((acc, [toolName, stats]) => {
        acc[toolName] = {
          p50: stats.p50,
          p95: stats.p95,
          p99: stats.p99,
          avg: stats.avg,
          count: stats.count
        };
        return acc;
      }, {} as any),
      endpoints: {
        fastpath: {
          p50: fastPathStats.p50,
          p95: fastPathStats.p95,
          p99: fastPathStats.p99,
          avg: fastPathStats.avg,
          count: fastPathStats.count
        }
      }
    },
    fastPath: {
      enabled: process.env.FASTPATH_MODE !== 'off',
      avgLatencyMs: fastPathStats.avg
    }
  };
}

export default {
  recordToolLatency,
  recordEndpointLatency,
  getToolLatencyStats,
  getEndpointLatencyStats,
  getAllToolsLatencyStats,
  generateMetricsReport
};

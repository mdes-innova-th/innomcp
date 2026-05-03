/**
 * Performance Metrics Module - Latency Tracking
 * Records p50, p95, p99 latencies for endpoints and tools
 * Uses Redis for storage, in-memory fallback
 */

import { getReadyRedisClient } from '../utils/redis';
import logger from '../utils/logger';

const METRICS_KEY_PREFIX = 'metrics:lat:';
const MAX_SAMPLES = 5000; // Keep last 5000 samples per metric
const RETENTION_DAYS = 7;

// In-memory fallback storage
const inMemoryMetrics = new Map<string, number[]>();

export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

/**
 * Record latency sample
 */
export async function recordLatency(name: string, durationMs: number): Promise<void> {
  const key = `${METRICS_KEY_PREFIX}${name}:${getCurrentDateKey()}`;
  const value = String(Math.round(durationMs));
  const redis = getReadyRedisClient();

  // Try Redis first
  try {
    if (redis) {
      await redis.lpush(key, value);
      await redis.ltrim(key, 0, MAX_SAMPLES - 1);
      await redis.expire(key, RETENTION_DAYS * 24 * 3600);
      return;
    }
  } catch (err) {
    logger.warn('[Metrics] Redis record failed', { name, error: String(err) });
  }

  // Fallback to in-memory
  if (!inMemoryMetrics.has(key)) {
    inMemoryMetrics.set(key, []);
  }
  
  const samples = inMemoryMetrics.get(key)!;
  samples.unshift(durationMs);
  
  if (samples.length > MAX_SAMPLES) {
    samples.splice(MAX_SAMPLES);
  }
}

/**
 * Get latency statistics for a metric
 */
export async function getLatencyStats(name: string): Promise<LatencyStats | null> {
  const key = `${METRICS_KEY_PREFIX}${name}:${getCurrentDateKey()}`;
  const redis = getReadyRedisClient();

  // Try Redis first
  try {
    if (redis) {
      const values = await redis.lrange(key, 0, -1);
      
      if (values.length === 0) return null;
      
      return calculateStats(values.map(Number));
    }
  } catch (err) {
    logger.warn('[Metrics] Redis get failed', { name, error: String(err) });
  }

  // Fallback to in-memory
  const samples = inMemoryMetrics.get(key);
  
  if (!samples || samples.length === 0) return null;
  
  return calculateStats(samples);
}

/**
 * Get metrics for all tracked names (today)
 */
export async function getAllMetrics(): Promise<Record<string, LatencyStats>> {
  const dateKey = getCurrentDateKey();
  const result: Record<string, LatencyStats> = {};
  const redis = getReadyRedisClient();

  // Try Redis first
  try {
    if (redis) {
      const pattern = `${METRICS_KEY_PREFIX}*:${dateKey}`;
      const keys = await redis.keys(pattern);
      
      for (const key of keys) {
        const name = key.replace(`${METRICS_KEY_PREFIX}`, '').replace(`:${dateKey}`, '');
        const stats = await getLatencyStats(name);
        
        if (stats) {
          result[name] = stats;
        }
      }
      
      return result;
    }
  } catch (err) {
    logger.warn('[Metrics] Redis keys failed', { error: String(err) });
  }

  // Fallback to in-memory
  for (const [key, samples] of inMemoryMetrics.entries()) {
    if (key.includes(dateKey)) {
      const name = key.replace(`${METRICS_KEY_PREFIX}`, '').replace(`:${dateKey}`, '');
      const stats = calculateStats(samples);
      result[name] = stats;
    }
  }

  return result;
}

/**
 * Clear metrics for a specific name (for testing)
 */
export async function clearMetrics(name: string): Promise<void> {
  const key = `${METRICS_KEY_PREFIX}${name}:${getCurrentDateKey()}`;
  const redis = getReadyRedisClient();

  try {
    if (redis) {
      await redis.del(key);
    }
  } catch (err) {
    logger.warn('[Metrics] Redis del failed', { name, error: String(err) });
  }

  inMemoryMetrics.delete(key);
}

/**
 * Calculate percentile statistics from samples
 */
function calculateStats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;

  if (n === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      avg: 0
    };
  }

  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    p50: sorted[Math.floor(n * 0.5)],
    p95: sorted[Math.floor(n * 0.95)],
    p99: sorted[Math.floor(n * 0.99)],
    avg: Math.round(sum / n)
  };
}

/**
 * Get current date key (YYYY-MM-DD)
 */
function getCurrentDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cleanup old in-memory metrics (keep only today)
 */
export function cleanupOldMetrics(): void {
  const today = getCurrentDateKey();
  
  for (const key of inMemoryMetrics.keys()) {
    if (!key.includes(today)) {
      inMemoryMetrics.delete(key);
    }
  }
}

// Cleanup every hour without keeping Node alive just for housekeeping.
const cleanupInterval = setInterval(cleanupOldMetrics, 3600_000);
cleanupInterval.unref?.();

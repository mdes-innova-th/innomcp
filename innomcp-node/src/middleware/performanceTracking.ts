/**
 * Performance Tracking Middleware
 * Tracks latency for all HTTP requests and WebSocket messages
 */

import { Request, Response, NextFunction } from 'express';
import { recordLatency } from '../metrics/latency';
import logger from '../utils/logger';

/**
 * Express middleware to track request latency
 */
export function performanceTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const method = req.method;
  const path = req.path;
  const cid = (req as any).correlationId;
  const isHealthProbe = path === '/api/health' || path.startsWith('/api/health/');

  // Track response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const endpoint = `${method}:${path}`;

    // Record latency metric
    recordLatency(endpoint, duration).catch((err) => {
      logger.warn('[Performance] Failed to record latency', {
        endpoint,
        error: String(err)
      });
    });

    // Log slow requests (>2s)
    if (duration > 2000) {
      logger.warn('[Performance] Slow request detected', {
        endpoint,
        duration,
        statusCode,
        cid: cid?.substring(0, 8)
      });
    }

    // Debug logging for all requests
    if (!isHealthProbe) {
      logger.debug('[Performance] Request completed', {
        endpoint,
        duration,
        statusCode,
        cid: cid?.substring(0, 8)
      });
    }
  });

  next();
}

/**
 * Tool execution tracker
 * Usage: wrap tool calls with trackToolExecution
 */
export async function trackToolExecution<T>(
  toolName: string,
  executeFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  let success = false;
  let error: Error | null = null;

  try {
    const result = await executeFn();
    success = true;
    return result;
  } catch (err: any) {
    error = err;
    throw err;
  } finally {
    const duration = Date.now() - start;

    // Record metric
    await recordLatency(`tool:${toolName}`, duration);

    // Log execution
    if (success) {
      logger.debug('[Tool Performance]', {
        tool: toolName,
        duration,
        success: true
      });
    } else {
      logger.error('[Tool Performance]', {
        tool: toolName,
        duration,
        success: false,
        error: error?.message
      });
    }

    // Warn on slow tools (>5s)
    if (duration > 5000) {
      logger.warn('[Tool Performance] Slow tool execution', {
        tool: toolName,
        duration
      });
    }
  }
}

/**
 * WebSocket message tracker
 */
export async function trackWebSocketMessage(
  messageType: string,
  executeFn: () => Promise<void>
): Promise<void> {
  const start = Date.now();

  try {
    await executeFn();
  } finally {
    const duration = Date.now() - start;
    await recordLatency(`ws:${messageType}`, duration);

    logger.debug('[WebSocket Performance]', {
      messageType,
      duration
    });
  }
}

// ---------------------------------------------------------------------------
// In-memory per-route metrics (feeds GET /api/metrics/performance)
// ---------------------------------------------------------------------------

interface RouteMetric {
  route: string;
  method: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  errorCount: number;
  lastCalledAt: string;
}

const routeMetrics = new Map<string, RouteMetric>();

/**
 * Express middleware — accumulates per-route call counts, latency stats, and
 * error rates in memory. Also attaches an X-Response-Time header to every
 * response. Designed to be mounted globally after cors/json/correlationId.
 */
export function trackPerformance(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const isError = res.statusCode >= 400;
    const key = `${req.method}:${req.route?.path ?? req.path}`;

    const existing: RouteMetric = routeMetrics.get(key) ?? {
      route: req.route?.path ?? req.path,
      method: req.method,
      count: 0,
      totalMs: 0,
      minMs: Infinity,
      maxMs: 0,
      errorCount: 0,
      lastCalledAt: '',
    };

    routeMetrics.set(key, {
      ...existing,
      count: existing.count + 1,
      totalMs: existing.totalMs + ms,
      minMs: Math.min(existing.minMs, ms),
      maxMs: Math.max(existing.maxMs, ms),
      errorCount: existing.errorCount + (isError ? 1 : 0),
      lastCalledAt: new Date().toISOString(),
    });

    // Best-effort header — may be a no-op if headers already sent
    try {
      res.setHeader('X-Response-Time', `${ms}ms`);
    } catch { /* ignore */ }
  });

  next();
}

/**
 * Return all accumulated route metrics sorted by call count (descending).
 */
export function getMetrics(): RouteMetric[] {
  return Array.from(routeMetrics.values()).sort((a, b) => b.count - a.count);
}

/**
 * Return routes whose average latency exceeds `thresholdMs` (default 1 000 ms).
 */
export function getSlowRoutes(thresholdMs = 1000): RouteMetric[] {
  return getMetrics().filter((m) => m.count > 0 && m.totalMs / m.count > thresholdMs);
}

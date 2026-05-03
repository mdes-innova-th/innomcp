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

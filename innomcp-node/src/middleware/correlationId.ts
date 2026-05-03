/**
 * Correlation ID Middleware
 * Track requests across Frontend → Backend → MCP Server → Tools
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Correlation ID middleware
 * Extracts or generates correlation ID for request tracing
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract from headers (multiple possible names)
  const incomingId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-trace-id'] as string) ||
    '';

  // Generate new ID if not provided
  const cid = incomingId || crypto.randomUUID();

  // Store in request object
  req.correlationId = cid;

  // Add to response headers
  res.setHeader('x-correlation-id', cid);
  res.setHeader('x-request-id', cid);

  // Log request with correlation ID
  const isHealthProbe = req.path === '/api/health' || req.path.startsWith('/api/health/');
  if (!isHealthProbe) {
    logger.info(`[Request] ${req.method} ${req.path} [cid=${cid.substring(0, 8)}] ip=${req.ip}`);
  }

  next();
}

/**
 * Extract correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || 'unknown';
}

/**
 * Add correlation ID to WebSocket upgrade request
 */
export function extractCorrelationIdFromUpgrade(
  req: any
): string {
  return (
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    crypto.randomUUID()
  );
}

export default {
  correlationIdMiddleware,
  getCorrelationId,
  extractCorrelationIdFromUpgrade
};

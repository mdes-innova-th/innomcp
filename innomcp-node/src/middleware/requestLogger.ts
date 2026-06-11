// innomcp-node/src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Thai error messages for common 4xx HTTP status codes
const THAI_ERROR_MESSAGES: Record<number, string> = {
  400: 'คำขอไม่ถูกต้อง',
  401: 'ไม่ได้รับอนุญาต',
  403: 'ห้ามเข้าถึง',
  404: 'ไม่พบทรัพยากร',
  405: 'วิธีการไม่ได้รับอนุญาต',
  408: 'คำขอหมดเวลา',
  429: 'คำขอมากเกินไป',
};

// Endpoints to skip logging (too noisy)
const SKIP_PATHS = ['/api/health', '/api/metrics'];

/**
 * Express middleware that logs every request with structured details.
 * Skips logging for health and metrics endpoints.
 * Logs format: [YYYY-MM-DD HH:mm:ss] METHOD /path STATUS RESPONSE_TIMEms
 * Includes truncated user agent, optional session ID, and Thai error messages for 4xx.
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Skip logging for quiet endpoints
  if (SKIP_PATHS.includes(req.path)) {
    return next();
  }

  const startTime = Date.now();
  const userAgent = (req.headers['user-agent'] || 'Unknown').substring(0, 100);
  let sessionId: string | undefined;

  // Try to extract session ID from express-session or similar
  const reqSession = (req as { session?: { id?: string } }).session;
  if (reqSession && typeof reqSession === 'object' && 'id' in reqSession) {
    sessionId = reqSession.id;
  }

  // Listen for response finish
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const { method, originalUrl, path } = req;
    const statusCode = res.statusCode;

    // Build structured log message
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19); // 'YYYY-MM-DD HH:mm:ss'
    const logMessageParts: string[] = [
      `[${timestamp}]`,
      method,
      originalUrl || path,
      String(statusCode),
      `${responseTime}ms`,
    ];

    // Add user agent (truncated)
    logMessageParts.push(`UA: ${userAgent}`);

    // Add session ID if present
    if (sessionId) {
      logMessageParts.push(`Session: ${sessionId}`);
    }

    // Add Thai error message for 4xx status codes
    if (statusCode >= 400 && statusCode < 500) {
      const thaiMsg = THAI_ERROR_MESSAGES[statusCode];
      if (thaiMsg) {
        logMessageParts.push(`Error: ${thaiMsg}`);
        // Log as error level to differentiate
        logger.error(logMessageParts.join(' '));
        return;
      }
    }

    // Default log level is info
    logger.info(logMessageParts.join(' '));
  });

  next();
};

export default requestLogger;
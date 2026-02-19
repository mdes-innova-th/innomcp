import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// ============================================================================
// INNOMCP LOGGER CONFIGURATION (THAI GOD 2026 EDITION)
// ============================================================================
// "Robust, Scalable, and Crystal Clear Logging for Enterprise AI Systems"

const LOG_MODE = process.env.LOG_MODE || 'dev';
const NODE_ENV = process.env.NODE_ENV || 'development';

const TRACE_QA_ENABLED = process.env.CHAT_TRACE_QA === '1';
const LOG_DEBUG_ENABLED = process.env.LOG_DEBUG === '1';
const TRACE_QA_SILENT = TRACE_QA_ENABLED && !LOG_DEBUG_ENABLED;

// ----------------------------------------------------------------------------
// 1. Centralized Log Directory Setup
// ----------------------------------------------------------------------------
// All logs go to: C:\Users\USER-NT\DEV\innomcp\logs\backend\
// This ensures no scattering of log files across the project.
const LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs', 'backend');

if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    console.error('CRITICAL: Failed to create log directory:', err);
  }
}

// ----------------------------------------------------------------------------
// 2. Custom Formats
// ----------------------------------------------------------------------------
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }), // Capture stack traces
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // Append Stack Trace if Error
    if (stack) {
      log += `\nExample Stack Trace:\n${stack}`;
    }

    // Append Metadata (Object details) if present and not empty
    if (Object.keys(meta).length > 0) {
      log += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }), // Colorize everything for better readability
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0 && LOG_MODE === 'dev') {
      // In dev mode, show metadata in console too
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// ----------------------------------------------------------------------------
// 3. Transport Configuration (The "Pro" Setup)
// ----------------------------------------------------------------------------
const transports: winston.transport[] = [];

// A. Console Transport
// - Prod: Info+ only (reduce noise)
// - Dev: Debug+ (show everything)
transports.push(
  new winston.transports.Console({
    level: LOG_MODE === 'prod' ? 'info' : 'debug',
    format: consoleFormat,
    silent: TRACE_QA_SILENT,
  })
);

// B. Daily Rotate File (Combined)
// - Rotates every day
// - Keeps logs for 14 days
// - Zips old logs to save space
transports.push(
  new winston.transports.DailyRotateFile({
    filename: path.join(LOG_DIR, 'backend-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '50m', // 50MB per file
    maxFiles: '14d',
    level: 'debug', // We want full traces in files even in prod often
    format: structuredFormat,
  })
);

// C. Daily Rotate File (Errors Only)
// - Critical for quick debugging
// - Keeps logs for 30 days
transports.push(
  new winston.transports.DailyRotateFile({
    filename: path.join(LOG_DIR, 'backend-error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '50m',
    maxFiles: '30d',
    level: 'error',
    format: structuredFormat,
  })
);

// ----------------------------------------------------------------------------
// 4. Logger Instance
// ----------------------------------------------------------------------------
const logger = winston.createLogger({
  level: LOG_MODE === 'prod' ? 'info' : 'debug',
  levels: winston.config.npm.levels,
  transports,
  exitOnError: false, // Do not crash on logging error
});

// ============================================================================
// SPECIALIZED HELPER FUNCTIONS
// ============================================================================
// Use these helpers instead of raw logger calls for consistent key-value pairs.

/**
 * Log HTTP API Requests
 * Use this in Express middleware.
 */
export const logRequest = (req: any, res: any, duration: number) => {
  const meta = {
    method: req.method,
    url: req.originalUrl || req.url,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip || (req.connection && req.connection.remoteAddress) || 'unknown',
    userAgent: req.get('user-agent'),
  };

  if (res.statusCode >= 500) {
    logger.error(`HTTP Server Error: ${req.method} ${meta.url}`, meta);
  } else if (res.statusCode >= 400) {
    logger.warn(`HTTP Client Error: ${req.method} ${meta.url}`, meta);
  } else {
    logger.info(`HTTP Success: ${req.method} ${meta.url}`, meta);
  }
};

/**
 * Log Ollama (AI Model) Interactions
 * Tracks model usage, prompt size, and latency.
 */
export const logOllamaRequest = (model: string, promptLength: number, duration: number, error?: any) => {
  const meta = {
    model,
    promptLength,
    duration: `${duration}ms`,
  };

  if (error) {
    logger.error('Ollama Inference Failed', { ...meta, error: error.message || error });
  } else {
    logger.debug('Ollama Inference Completed', meta);
  }
};

/**
 * Log MCP Tool Executions
 * Tracks which tools are used and their success rate.
 */
export const logMCPRequest = (toolName: string, success: boolean, duration: number, error?: any) => {
  const meta = {
    tool: toolName,
    success,
    duration: `${duration}ms`
  };

  if (!success || error) {
    logger.error(`MCP Tool Execution Failed: ${toolName}`, { ...meta, error: error?.message || error });
  } else {
    logger.info(`MCP Tool Executed: ${toolName}`, meta);
  }
};

/**
 * Log WebSocket Events
 * useful for tracking real-time user connections.
 */
export const logWebSocket = (event: string, clientCount?: number, message?: string) => {
  logger.debug(`WebSocket Event: ${event}`, {
    activeClients: clientCount,
    details: message
  });
};

/**
 * Log System Health / Lifecycle Events
 */
export const logSystemEvent = (event: string, details?: any) => {
  logger.info(`System Event: ${event}`, details || {});
}

export { logger };
export default logger;

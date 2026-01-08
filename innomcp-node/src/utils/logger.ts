import winston from 'winston';
import path from 'path';
import fs from 'fs';

// ========================================
// Logger Configuration
// ========================================

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');
const ENABLE_CONSOLE = process.env.ENABLE_CONSOLE_LOG !== 'false';
const ENABLE_FILE = process.env.ENABLE_FILE_LOG !== 'false';

// Create logs directory if not exists
if (ENABLE_FILE && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Console format (colorized for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create transports
const transports: winston.transport[] = [];

if (ENABLE_CONSOLE) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: LOG_LEVEL,
    })
  );
}

if (ENABLE_FILE) {
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, `backend-${NODE_ENV}.log`),
      format: customFormat,
      level: LOG_LEVEL,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, `backend-error-${NODE_ENV}.log`),
      format: customFormat,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Access log file (HTTP requests)
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, `backend-access-${NODE_ENV}.log`),
      format: customFormat,
      level: 'http',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

// Helper methods
export const logRequest = (req: any, res: any, duration: number) => {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  if (res.statusCode >= 400) {
    logger.error('HTTP Request Failed', logData);
  } else {
    logger.http('HTTP Request', logData);
  }
};

export const logOllamaRequest = (model: string, prompt: string, duration: number, error?: any) => {
  if (error) {
    logger.error('Ollama Request Failed', {
      model,
      promptLength: prompt.length,
      duration: `${duration}ms`,
      error: error.message,
    });
  } else {
    logger.debug('Ollama Request Success', {
      model,
      promptLength: prompt.length,
      duration: `${duration}ms`,
    });
  }
};

export const logMCPRequest = (tool: string, success: boolean, duration: number, error?: any) => {
  if (!success && error) {
    logger.error('MCP Tool Failed', {
      tool,
      duration: `${duration}ms`,
      error: error.message,
    });
  } else {
    logger.debug('MCP Tool Executed', {
      tool,
      success,
      duration: `${duration}ms`,
    });
  }
};

export const logWebSocket = (event: string, clientCount?: number, message?: string) => {
  logger.debug('WebSocket Event', {
    event,
    clientCount,
    message,
  });
};

// Export logger instance and helpers
export { logger };
export default logger;

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// ========================================
// Logger Configuration with LOG_MODE Support
// ========================================

// LOG_MODE: dev (all logs), test (debug), prod (warn+error only)
const LOG_MODE = process.env.LOG_MODE || 'dev';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Determine log level based on LOG_MODE
const getLogLevel = (): string => {
  switch (LOG_MODE) {
    case 'prod':
      return 'warn'; // Production: only warnings and errors
    case 'test':
      return 'debug'; // Test: debug and above
    case 'dev':
    default:
      return 'debug'; // Development: all logs including debug
  }
};

const LOG_LEVEL = process.env.LOG_LEVEL || getLogLevel();
const ENABLE_CONSOLE = process.env.ENABLE_CONSOLE_LOG !== 'false';
const ENABLE_FILE = process.env.ENABLE_FILE_LOG !== 'false';

// Create datetime for filename (YYYYMMDD-HHMMSS format)
const getDateTimeForFilename = (): string => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const DATETIME_STAMP = getDateTimeForFilename();

// Project-specific logs directory
const PROJECT_LOG_DIR = path.join(__dirname, '..', '..', 'logs');

// Root aggregated logs directory
const ROOT_LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs');

// Create both log directories if they don't exist
if (ENABLE_FILE) {
  [PROJECT_LOG_DIR, ROOT_LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
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
  // Combined log file in project logs directory (with datetime)
  transports.push(
    new winston.transports.File({
      filename: path.join(PROJECT_LOG_DIR, `backend-${DATETIME_STAMP}.log`),
      format: customFormat,
      level: LOG_LEVEL,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Symlink to latest log (for easier access)
  const latestLogPath = path.join(PROJECT_LOG_DIR, `backend-${NODE_ENV}.log`);
  const latestLogTarget = `backend-${DATETIME_STAMP}.log`;
  try {
    if (fs.existsSync(latestLogPath)) {
      fs.unlinkSync(latestLogPath);
    }
    // On Windows, create a copy instead of symlink
    const sourceLog = path.join(PROJECT_LOG_DIR, latestLogTarget);
    if (process.platform === 'win32') {
      // Just use the same transport - winston will write to it
    } else {
      fs.symlinkSync(latestLogTarget, latestLogPath);
    }
  } catch (e) {
    // Symlink creation may fail on Windows without admin rights, ignore
  }

  // Error log file in project directory
  transports.push(
    new winston.transports.File({
      filename: path.join(PROJECT_LOG_DIR, `backend-error-${DATETIME_STAMP}.log`),
      format: customFormat,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Symlink for error log
  const latestErrorPath = path.join(PROJECT_LOG_DIR, `backend-error-${NODE_ENV}.log`);
  
  // Access log file (HTTP requests) - only if not in prod mode
  if (LOG_MODE !== 'prod') {
    transports.push(
      new winston.transports.File({
        filename: path.join(PROJECT_LOG_DIR, `backend-access-${DATETIME_STAMP}.log`),
        format: customFormat,
        level: 'http',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 3,
      })
    );
  }

  // Aggregated log in root directory (all projects)
  transports.push(
    new winston.transports.File({
      filename: path.join(ROOT_LOG_DIR, `innomcp-backend-${DATETIME_STAMP}.log`),
      format: customFormat,
      level: LOG_LEVEL,
      maxsize: 20 * 1024 * 1024, // 20MB for aggregated logs
      maxFiles: 10,
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

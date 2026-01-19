// innomcp-next/src/utils/serverLogger.ts
// Server-side logger for Next.js (API routes and server components)

import fs from 'fs';
import path from 'path';

// LOG_MODE support
const LOG_MODE = process.env.LOG_MODE || 'dev';

const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
  if (LOG_MODE === 'prod') {
    return level === 'warn' || level === 'error';
  }
  if (LOG_MODE === 'test') {
    return level !== 'debug';
  }
  return true; // dev: log everything
};

// Create datetime for filename
const getDateTimeForFilename = (): string => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const DATETIME_STAMP = getDateTimeForFilename();

// Project-specific logs directory
const PROJECT_LOG_DIR = path.join(process.cwd(), 'logs');

// Root aggregated logs directory
const ROOT_LOG_DIR = path.join(process.cwd(), '..', 'logs');

// Create directories
[PROJECT_LOG_DIR, ROOT_LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Log file paths
const PROJECT_LOG_FILE = path.join(PROJECT_LOG_DIR, `frontend-${DATETIME_STAMP}.log`);
const ROOT_LOG_FILE = path.join(ROOT_LOG_DIR, `innomcp-frontend-${DATETIME_STAMP}.log`);
const USER_ACTIONS_FILE = path.join(PROJECT_LOG_DIR, `user-actions-${DATETIME_STAMP}.log`);
const ROOT_USER_ACTIONS_FILE = path.join(ROOT_LOG_DIR, `innomcp-user-actions-${DATETIME_STAMP}.log`);

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const writeLog = (level: LogLevel, message: string, data?: any) => {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  if (data !== undefined) {
    if (data instanceof Error) {
      logMessage += `\n  Error: ${data.message}`;
      if (data.stack) {
        logMessage += `\n  Stack: ${data.stack}`;
      }
    } else if (typeof data === 'object') {
      logMessage += `\n  Data: ${JSON.stringify(data, null, 2)}`;
    } else {
      logMessage += `\n  Data: ${data}`;
    }
  }
  
  logMessage += '\n';

  // Console output
  const consoleMethod = level === 'debug' ? 'log' : level;
  console[consoleMethod](`[${level.toUpperCase()}] ${message}`);

  // Write to files
  try {
    fs.appendFileSync(PROJECT_LOG_FILE, logMessage);
    fs.appendFileSync(ROOT_LOG_FILE, logMessage);
  } catch (error) {
    console.error('[ServerLogger] Failed to write log:', error);
  }
};

export const logger = {
  debug: (message: string, data?: any) => writeLog('debug', message, data),
  info: (message: string, data?: any) => writeLog('info', message, data),
  warn: (message: string, data?: any) => writeLog('warn', message, data),
  error: (message: string, data?: any) => writeLog('error', message, data),
};

// Log user actions (from client)
export const logUserActions = (actions: any[]) => {
  if (!shouldLog('info')) return;

  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [USER_ACTIONS] ${actions.length} actions\n${JSON.stringify(actions, null, 2)}\n\n`;

  try {
    fs.appendFileSync(USER_ACTIONS_FILE, logMessage);
    fs.appendFileSync(ROOT_USER_ACTIONS_FILE, logMessage);
  } catch (error) {
    console.error('[ServerLogger] Failed to write user actions:', error);
  }
};

// Log API requests
export const logApiRequest = (
  method: string,
  url: string,
  status: number,
  duration: number,
  error?: any
) => {
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  
  writeLog(level, `API ${method} ${url}`, {
    status,
    duration: `${duration}ms`,
    error: error?.message,
  });
};

export default logger;

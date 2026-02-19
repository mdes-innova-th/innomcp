import fs from 'fs';
import path from 'path';

// LOG_MODE support: dev (all), test (debug), prod (warn+error only)
const LOG_MODE = process.env.LOG_MODE || 'dev';

// Determine if we should log based on LOG_MODE
const shouldLog = (level: 'INFO' | 'WARN' | 'ERROR'): boolean => {
  if (LOG_MODE === 'prod') {
    return level === 'WARN' || level === 'ERROR';
  }
  // dev and test: log everything
  return true;
};

// Create datetime for filename
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

// Create both directories
[PROJECT_LOG_DIR, ROOT_LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Log file paths with datetime
const PROJECT_LOG_FILE = path.join(PROJECT_LOG_DIR, `mcp-server-${DATETIME_STAMP}.log`);
const ROOT_LOG_FILE = path.join(ROOT_LOG_DIR, `innomcp-mcp-server-${DATETIME_STAMP}.log`);

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

/**
 * MCP Server Logger - Writes to both console and file with LOG_MODE support
 */
export function mcpLog(level: LogLevel, message: string, data?: any) {
    if (!shouldLog(level)) {
        return; // Skip logging based on LOG_MODE
    }

    const timestamp = new Date().toISOString();
    let logMessage = `${timestamp} [${level}] ${message}`;
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
    
    // Write to console (for terminal visibility)
    if (level === 'INFO') console.log(`[INFO] ${message}`);
    else if (level === 'WARN') console.warn(`[WARN] ${message}`);
    else if (level === 'ERROR') console.error(`[ERROR] ${message}`);
    
    // Write to project log file
    try {
        fs.appendFileSync(PROJECT_LOG_FILE, logMessage);
    } catch (error) {
        console.error('[ERROR] Failed to write to project log file:', error);
    }

    // Write to root aggregated log file
    try {
        fs.appendFileSync(ROOT_LOG_FILE, logMessage);
    } catch (error) {
        console.error('[ERROR] Failed to write to root log file:', error);
    }
}

/**
 * Log to both console (with proper level) and file using mcpLog.
 */
export function logBoth(level: LogLevel, msg: string, data?: any) {
    // Log to console and file using mcpLog
    mcpLog(level, msg, data);
}

export default mcpLog;

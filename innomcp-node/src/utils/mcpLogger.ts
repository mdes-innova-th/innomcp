// mcpLogger.ts
// Logging utility for MCP operations with LOG_MODE support
import fs from "fs";
import path from "path";

export type LogLevel = "info" | "warn" | "error" | "debug";

// LOG_MODE support: dev (all), test (debug), prod (warn+error only)
const LOG_MODE = process.env.LOG_MODE || 'dev';

// Determine if we should log based on LOG_MODE
const shouldLog = (level: LogLevel): boolean => {
  if (LOG_MODE === 'prod') {
    return level === 'warn' || level === 'error';
  }
  if (LOG_MODE === 'test') {
    return level === 'debug' || level === 'info' || level === 'warn' || level === 'error';
  }
  // dev mode: log everything
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
const PROJECT_LOG_DIR = path.resolve(__dirname, "../../logs");

// Root aggregated logs directory
const ROOT_LOG_DIR = path.resolve(__dirname, "../../../logs");

// Create directories
[PROJECT_LOG_DIR, ROOT_LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Log file paths with datetime
const PROJECT_LOG_FILE = path.join(PROJECT_LOG_DIR, `mcp-${DATETIME_STAMP}.log`);
const ROOT_LOG_FILE = path.join(ROOT_LOG_DIR, `innomcp-mcp-${DATETIME_STAMP}.log`);

export function mcpLog(level: LogLevel, message: string) {
  if (!shouldLog(level)) {
    return; // Skip logging based on LOG_MODE
  }

  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  try {
    // Write to project log
    fs.appendFileSync(PROJECT_LOG_FILE, logLine, { encoding: "utf8" });
    
    // Write to root aggregated log
    fs.appendFileSync(ROOT_LOG_FILE, logLine, { encoding: "utf8" });
  } catch (err) {
    // fallback to console if file write fails
    console.error("[mcpLog] Failed to write log file:", err);
    console[level === 'debug' ? 'log' : level](message);
  }
}

export function logBoth(level: LogLevel, message: string) {
  if (!shouldLog(level)) {
    return;
  }

  // Log to console
  if (level === "info") console.log(message);
  else if (level === "warn") console.warn(message);
  else if (level === "error") console.error(message);
  else if (level === "debug") console.log(`[DEBUG] ${message}`);
  
  // Log to file
  mcpLog(level, message);
}

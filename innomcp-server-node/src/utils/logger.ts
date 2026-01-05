// Simple Logger Utility for MCP Server
// Provides structured logging with timestamps, log levels and file logging


import fs from 'fs';
import path from 'path';
import { logBoth } from "./mcpLogger";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  logDir?: string;
  enableFile?: boolean;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;
  private logDir: string;
  private enableFile: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? "";
    this.timestamp = options.timestamp ?? true;
    this.logDir = options.logDir ?? path.join(process.cwd(), 'logs');
    this.enableFile = options.enableFile ?? (process.env.ENABLE_FILE_LOG !== 'false');
    
    // Create logs directory if enabled
    if (this.enableFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private format(level: string, message: string, ...args: any[]): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${level}]`);

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    parts.push(message);
    
    if (args.length > 0) {
      parts.push(JSON.stringify(args));
    }

    return parts.join(" ");
  }

  private writeToFile(level: string, message: string): void {
    if (!this.enableFile) return;
    
    try {
      const logFile = path.join(this.logDir, `mcp-server-${process.env.NODE_ENV || 'development'}.log`);
      const errorFile = path.join(this.logDir, `mcp-server-error-${process.env.NODE_ENV || 'development'}.log`);
      
      const logEntry = `${message}\n`;
      
      // Write to combined log
      fs.appendFileSync(logFile, logEntry);
      
      // Also write errors to error log
      if (level === 'ERROR') {
        fs.appendFileSync(errorFile, logEntry);
      }
    } catch (err) {
      logBoth('ERROR', `Failed to write log: ${err}`);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const formatted = this.format("DEBUG", message, ...args);
      logBoth('INFO', formatted);
      this.writeToFile("DEBUG", formatted);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const formatted = this.format("INFO", message, ...args);
      logBoth('INFO', formatted);
      this.writeToFile("INFO", formatted);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      const formatted = this.format("WARN", message, ...args);
      logBoth('WARN', formatted);
      this.writeToFile("WARN", formatted);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const formatted = this.format("ERROR", message, ...args);
      logBoth('ERROR', formatted);
      this.writeToFile("ERROR", formatted);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

// Default logger instance
export const logger = new Logger({
  prefix: "MCP",
  level:
    process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
});

// Create logger for specific module
export function createLogger(prefix: string, level?: LogLevel): Logger {
  return new Logger({
    prefix,
    level:
      level ??
      (process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG),
  });
}

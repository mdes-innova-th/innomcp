// Next.js Logger Utility
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const ENABLE_FILE_LOG = process.env.ENABLE_FILE_LOG !== 'false';

// Create logs directory
if (ENABLE_FILE_LOG && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatMessage(level: string, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
  return `${timestamp} [${level}]: ${message}${argsStr}`;
}

function writeToFile(level: string, formatted: string): void {
  if (!ENABLE_FILE_LOG) return;
  
  try {
    const logFile = path.join(LOG_DIR, `frontend-${process.env.NODE_ENV || 'development'}.log`);
    const errorFile = path.join(LOG_DIR, `frontend-error-${process.env.NODE_ENV || 'development'}.log`);
    
    fs.appendFileSync(logFile, `${formatted}\n`);
    
    if (level === 'ERROR') {
      fs.appendFileSync(errorFile, `${formatted}\n`);
    }
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

export const logger = {
  info(message: string, ...args: any[]) {
    const formatted = formatMessage('INFO', message, ...args);
    console.info(formatted);
    writeToFile('INFO', formatted);
  },
  
  warn(message: string, ...args: any[]) {
    const formatted = formatMessage('WARN', message, ...args);
    console.warn(formatted);
    writeToFile('WARN', formatted);
  },
  
  error(message: string, ...args: any[]) {
    const formatted = formatMessage('ERROR', message, ...args);
    console.error(formatted);
    writeToFile('ERROR', formatted);
  },
  
  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV !== 'production') {
      const formatted = formatMessage('DEBUG', message, ...args);
      console.debug(formatted);
      writeToFile('DEBUG', formatted);
    }
  },
};

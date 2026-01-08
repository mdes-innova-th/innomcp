import fs from 'fs';
import path from 'path';

// Create logs directory
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log file path with date
const logFile = path.join(LOG_DIR, `mcp-server-${new Date().toISOString().split('T')[0]}.log`);

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

/**
 * MCP Server Logger - Writes to both console and file
 */
export function mcpLog(level: LogLevel, message: string, data?: any) {
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
    // Write to file
    try {
        fs.appendFileSync(logFile, logMessage);
    } catch (error) {
        // Avoid recursion, just print to console
        console.error('[ERROR] Failed to write to log file:', error);
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

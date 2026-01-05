// mcpLogger.ts
// Logging utility for both console and file logging (like innomcp-server-node)
import fs from "fs";
import path from "path";

export type LogLevel = "info" | "warn" | "error";

const LOG_FILE_PATH = path.resolve(__dirname, "../../../logs/mcp.log");

export function mcpLog(level: LogLevel, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE_PATH, logLine, { encoding: "utf8" });
  } catch (err) {
    // fallback to console if file write fails
    console.error("[mcpLog] Failed to write log file:", err);
    console[level](message);
  }
}

export function logBoth(level: LogLevel, message: string) {
  // Log to console
  if (level === "info") console.log(message);
  else if (level === "warn") console.warn(message);
  else if (level === "error") console.error(message);
  // Log to file
  mcpLog(level, message);
}

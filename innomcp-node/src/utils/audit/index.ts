/**
 * Logging & Audit Trail System
 * à¸šà¸±à¸™à¸—à¸¶à¸ logs à¹à¸¥à¸° audit trail à¸ªà¸³à¸«à¸£à¸±à¸šà¸—à¸¸à¸à¸„à¸³à¸‚à¸­
 * 
 * Features:
 * - Request/Response logging
 * - User action tracking
 * - Security audit
 * - Query history
 * 
 * @module utils/audit
 */

import { logBoth } from '../mcpLogger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  timestamp: Date;
  type: 'query' | 'action' | 'error' | 'security';
  userId?: string;
  sessionId: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
}

/**
 * Query Log Entry
 */
export interface QueryLogEntry {
  timestamp: Date;
  sessionId: string;
  query: string;
  intent?: string;
  response: string;
  responseTime: number;
  toolsUsed: string[];
  success: boolean;
  errorMessage?: string;
}

/**
 * Audit Trail Manager
 */
class AuditTrailManager {
  private auditLogs: AuditLogEntry[] = [];
  private queryLogs: QueryLogEntry[] = [];
  private logDir: string;
  private maxLogsInMemory = 1000;

  constructor() {
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.initializeLogDirectory();
  }

  /**
   * Initialize log directory
   */
  private async initializeLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      await fs.mkdir(path.join(this.logDir, 'audit'), { recursive: true });
      await fs.mkdir(path.join(this.logDir, 'queries'), { recursive: true});
      logBoth('info', `[AuditTrail] Log directory initialized: ${this.logDir}`);
    } catch (error) {
      logBoth('error', `[AuditTrail] Failed to initialize log directory: ${error}`);
    }
  }

  /**
   * Log an audit event
   */
  async logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    // Add to memory
    this.auditLogs.push(auditEntry);

    // Log to console (map severity to LogLevel)
    const logLevel = entry.severity === 'critical' ? 'error' : entry.severity as 'info' | 'warn' | 'error';
    logBoth(logLevel, `[Audit] ${entry.type}: ${entry.action}`);

    // Trim memory if needed
    if (this.auditLogs.length > this.maxLogsInMemory) {
      await this.flushAuditLogs();
    }

    // Critical events: log immediately
    if (entry.severity === 'critical' || entry.severity === 'error') {
      await this.writeAuditLog(auditEntry);
    }
  }

  /**
   * Log a query
   */
  async logQuery(entry: Omit<QueryLogEntry, 'timestamp'>): Promise<void> {
    const queryEntry: QueryLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    // Add to memory
    this.queryLogs.push(queryEntry);

    // Log to console (truncated)
    const truncatedQuery = entry.query.substring(0, 50);
    const truncatedResponse = entry.response.substring(0, 50);
    logBoth('info', `[Query] ${truncatedQuery}... â†’ ${truncatedResponse}... (${entry.responseTime}ms)`);

    // Trim memory if needed
    if (this.queryLogs.length > this.maxLogsInMemory) {
      await this.flushQueryLogs();
    }
  }

  /**
   * Write audit log to file
   */
  private async writeAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      const date = entry.timestamp.toISOString().split('T')[0];
      const filename = path.join(this.logDir, 'audit', `audit-${date}.jsonl`);
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(filename, logLine);
    } catch (error) {
      logBoth('error', `[AuditTrail] Failed to write audit log: ${error}`);
    }
  }

  /**
   * Write query log to file
   */
  private async writeQueryLog(entry: QueryLogEntry): Promise<void> {
    try {
      const date = entry.timestamp.toISOString().split('T')[0];
      const filename = path.join(this.logDir, 'queries', `queries-${date}.jsonl`);
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(filename, logLine);
    } catch (error) {
      logBoth('error', `[AuditTrail] Failed to write query log: ${error}`);
    }
  }

  /**
   * Flush audit logs to disk
   */
  async flushAuditLogs(): Promise<void> {
    const logsToWrite = [...this.auditLogs];
    this.auditLogs = [];

    for (const entry of logsToWrite) {
      await this.writeAuditLog(entry);
    }

    logBoth('info', `[AuditTrail] Flushed ${logsToWrite.length} audit logs to disk`);
  }

  /**
   * Flush query logs to disk
   */
  async flushQueryLogs(): Promise<void> {
    const logsToWrite = [...this.queryLogs];
    this.queryLogs = [];

    for (const entry of logsToWrite) {
      await this.writeQueryLog(entry);
    }

    logBoth('info', `[AuditTrail] Flushed ${logsToWrite.length} query logs to disk`);
  }

  /**
   * Get recent audit logs
   */
  getRecentAuditLogs(count: number = 100): AuditLogEntry[] {
    return this.auditLogs.slice(-count);
  }

  /**
   * Get recent query logs
   */
  getRecentQueryLogs(count: number = 100): QueryLogEntry[] {
    return this.queryLogs.slice(-count);
  }

  /**
   * Get audit logs by type
   */
  getAuditLogsByType(type: AuditLogEntry['type']): AuditLogEntry[] {
    return this.auditLogs.filter(log => log.type === type);
  }

  /**
   * Get audit logs by severity
   */
  getAuditLogsBySeverity(severity: AuditLogEntry['severity']): AuditLogEntry[] {
    return this.auditLogs.filter(log => log.severity === severity);
  }

  /**
   * Get query success rate
   */
  getQuerySuccessRate(): number {
    if (this.queryLogs.length === 0) return 0;
    const successCount = this.queryLogs.filter(log => log.success).length;
    return (successCount / this.queryLogs.length) * 100;
  }

  /**
   * Get average response time
   */
  getAverageResponseTime(): number {
    if (this.queryLogs.length === 0) return 0;
    const totalTime = this.queryLogs.reduce((sum, log) => sum + log.responseTime, 0);
    return totalTime / this.queryLogs.length;
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    return {
      totalAuditLogs: this.auditLogs.length,
      totalQueryLogs: this.queryLogs.length,
      querySuccessRate: this.getQuerySuccessRate(),
      averageResponseTime: this.getAverageResponseTime(),
      auditByType: {
        query: this.getAuditLogsByType('query').length,
        action: this.getAuditLogsByType('action').length,
        error: this.getAuditLogsByType('error').length,
        security: this.getAuditLogsByType('security').length
      },
      auditBySeverity: {
        info: this.getAuditLogsBySeverity('info').length,
        warn: this.getAuditLogsBySeverity('warn').length,
        error: this.getAuditLogsBySeverity('error').length,
        critical: this.getAuditLogsBySeverity('critical').length
      }
    };
  }
}

// Export singleton instance
export const auditTrail = new AuditTrailManager();

/**
 * Helper: Log audit event
 */
export async function logAuditEvent(
  type: AuditLogEntry['type'],
  action: string,
  details: Record<string, any>,
  severity: AuditLogEntry['severity'] = 'info'
): Promise<void> {
  await auditTrail.logAudit({
    type,
    action,
    details,
    severity,
    sessionId: details.sessionId || 'unknown',
    userId: details.userId,
    ipAddress: details.ipAddress,
    userAgent: details.userAgent
  });
}

/**
 * Helper: Log query
 */
export async function logQueryEvent(
  sessionId: string,
  query: string,
  response: string,
  responseTime: number,
  toolsUsed: string[],
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await auditTrail.logQuery({
    sessionId,
    query,
    response,
    responseTime,
    toolsUsed,
    success,
    errorMessage
  });
}

/**
 * Helper: Get audit statistics
 */
export function getAuditStatistics(): Record<string, any> {
  return auditTrail.getStatistics();
}

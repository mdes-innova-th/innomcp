/**
 * SQL Injection Prevention Utility
 * 
 * This module provides utilities to prevent SQL injection attacks
 * by sanitizing input and validating queries
 */

import { logger } from './logger';
import { logBoth } from './mcpLogger';

/**
 * Check if input contains potential SQL injection patterns
 */
export function containsSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Common SQL injection patterns
  const sqlInjectionPatterns = [
    /(\s|^)(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|eval|expression)(\s|$)/i,
    /(\'|\")(\s|;)*(union|select|insert|update|delete|drop)/i,
    /(\s|^)(--)(\s|$)/,
    /(\/\*|\*\/)/,
    /(\s|^)(xp_|sp_)/i,
    /(\||&amp;|;|\$|\+|%)/,
    /(<script|<iframe|<object|<embed|<img)/i
  ];

  return sqlInjectionPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize string input to prevent SQL injection
 * Note: This is a basic sanitization. Always use parameterized queries!
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove dangerous characters and patterns
  return input
    .replace(/['"`;\\]/g, '') // Remove quotes, semicolons, backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comment start
    .replace(/\*\//g, '') // Remove multi-line comment end
    .replace(/<script/gi, '') // Remove script tags
    .replace(/<\/script/gi, '')
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate table name (for dynamic table queries)
 */
export function validateTableName(tableName: string): boolean {
  if (!tableName || typeof tableName !== 'string') {
    return false;
  }

  // Only allow alphanumeric characters and underscores
  const tableNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  
  if (!tableNamePattern.test(tableName)) {
    return false;
  }

  // Blacklist dangerous table names
  const blacklistedTables = [
    'information_schema',
    'mysql',
    'performance_schema',
    'sys'
  ];

  return !blacklistedTables.includes(tableName.toLowerCase());
}

/**
 * Validate column name (for dynamic column queries)
 */
export function validateColumnName(columnName: string): boolean {
  if (!columnName || typeof columnName !== 'string') {
    return false;
  }

  // Only allow alphanumeric characters and underscores
  const columnNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return columnNamePattern.test(columnName);
}

/**
 * Escape special characters for LIKE queries
 */
export function escapeLikePattern(pattern: string): string {
  if (!pattern || typeof pattern !== 'string') {
    return '';
  }

  // Escape special LIKE characters: % _ \ and '
  return pattern
    .replace(/\\/g, '\\\\') // Backslash must be escaped first
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/'/g, "\\'");
}

/**
 * Validate and sanitize ORDER BY clause
 */
export function sanitizeOrderBy(orderBy: string, allowedColumns: string[]): string | null {
  if (!orderBy || typeof orderBy !== 'string') {
    return null;
  }

  // Parse ORDER BY: "column ASC" or "column DESC"
  const parts = orderBy.trim().split(/\s+/);
  if (parts.length === 0 || parts.length > 2) {
    logBoth('warn', `[SQL] Invalid ORDER BY format: ${orderBy}`);
    return null;
  }

  const column = parts[0];
  const direction = parts[1]?.toUpperCase() || 'ASC';

  // Validate column name
  if (!validateColumnName(column)) {
    logBoth('warn', `[SQL] Invalid column name in ORDER BY: ${column}`);
    return null;
  }

  // Check if column is in allowed list
  if (!allowedColumns.includes(column)) {
    logBoth('warn', `[SQL] Column not allowed in ORDER BY: ${column}`);
    return null;
  }

  // Validate direction
  if (direction !== 'ASC' && direction !== 'DESC') {
    logBoth('warn', `[SQL] Invalid ORDER BY direction: ${direction}`);
    return null;
  }

  return `${column} ${direction}`;
}

/**
 * Validate numeric input
 */
export function validateNumericInput(input: any): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  const num = Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  return num;
}

/**
 * Validate and sanitize pagination parameters
 */
export function sanitizePagination(page?: any, limit?: any): { page: number; limit: number } {
  const validatedPage = validateNumericInput(page);
  const validatedLimit = validateNumericInput(limit);

  const safePage = validatedPage && validatedPage > 0 ? validatedPage : 1;
  const safeLimit = validatedLimit && validatedLimit > 0 && validatedLimit <= 100 ? validatedLimit : 10;

  return { page: safePage, limit: safeLimit };
}

/**
 * Create a safe parameterized query placeholder
 * Returns an array of ? placeholders
 */
export function createPlaceholders(count: number): string {
  if (count <= 0 || !Number.isInteger(count)) {
    return '';
  }

  return Array(count).fill('?').join(', ');
}

/**
 * Log potential SQL injection attempt
 */
export function logSQLInjectionAttempt(
  input: string,
  source: string,
  ipAddress?: string
): void {
  logBoth('warn', `[Security] Potential SQL injection attempt detected`);
  logBoth('warn', `  Source: ${source}`);
  logBoth('warn', `  IP: ${ipAddress || 'unknown'}`);
  logBoth('warn', `  Input: ${input.substring(0, 100)}...`);
}

/**
 * Middleware helper to validate and sanitize request body
 */
export function validateRequestBody(
  body: any,
  requiredFields: string[],
  sanitizeFields: string[] = []
): { valid: boolean; errors: string[]; sanitized: any } {
  const errors: string[] = [];
  const sanitized: any = { ...body };

  // Check required fields
  for (const field of requiredFields) {
    if (!body[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Sanitize specified fields
  for (const field of sanitizeFields) {
    if (body[field] && typeof body[field] === 'string') {
      if (containsSQLInjection(body[field])) {
        errors.push(`Suspicious input detected in field: ${field}`);
        logSQLInjectionAttempt(body[field], `Request body field: ${field}`);
      } else {
        sanitized[field] = sanitizeInput(body[field]);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Best practices reminder
 * 
 * ALWAYS use parameterized queries (prepared statements):
 * âœ… GOOD: conn.query('SELECT * FROM users WHERE id = ?', [userId])
 * âŒ BAD: conn.query(`SELECT * FROM users WHERE id = ${userId}`)
 * 
 * Never concatenate user input directly into SQL:
 * âŒ BAD: `SELECT * FROM ${tableName} WHERE name = '${userName}'`
 * 
 * Always validate dynamic identifiers (table/column names):
 * âœ… GOOD: validateTableName(tableName) && validateColumnName(columnName)
 * 
 * Use this module's utilities as an ADDITIONAL layer of defense,
 * but NEVER as a replacement for parameterized queries!
 */

export const sqlSecurityBestPractices = {
  useParameterizedQueries: true,
  validateDynamicIdentifiers: true,
  sanitizeInputs: true,
  logSuspiciousActivity: true,
  useLeastPrivilege: true,
  regularSecurityAudits: true
};

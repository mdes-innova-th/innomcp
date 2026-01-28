/**
 * Error Taxonomy Module
 * จัดหมวดหมู่ error และจัดการแต่ละประเภทอย่างเหมาะสม
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

import { logBoth } from '../mcpLogger';

/**
 * Error categories
 */
export enum ErrorCategory {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PARSE_ERROR = 'PARSE_ERROR',
  STALE_DATA = 'STALE_DATA',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_INPUT = 'INVALID_INPUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW', // ไม่สำคัญ ไม่กระทบผู้ใช้มาก
  MEDIUM = 'MEDIUM', // ควรแก้ไข แต่ยังใช้งานได้
  HIGH = 'HIGH', // ต้องแก้ไขด่วน
  CRITICAL = 'CRITICAL', // ระบบไม่สามารถทำงานได้
}

/**
 * Structured error information
 */
export interface CategorizedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  technicalDetails?: any;
  retryable: boolean;
  suggestedAction?: string;
  timestamp: string;
}

/**
 * Error pattern matching
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
}> = [
  // Network errors
  { pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH/i, category: ErrorCategory.NETWORK_ERROR, severity: ErrorSeverity.MEDIUM },
  { pattern: /network.*fail|connection.*fail/i, category: ErrorCategory.NETWORK_ERROR, severity: ErrorSeverity.MEDIUM },
  
  // Auth errors
  { pattern: /unauthorized|401|403|forbidden|invalid.*key|invalid.*token/i, category: ErrorCategory.AUTH_ERROR, severity: ErrorSeverity.HIGH },
  
  // Quota/Rate limit
  { pattern: /quota.*exceed|rate.*limit|429|too.*many.*request/i, category: ErrorCategory.QUOTA_EXCEEDED, severity: ErrorSeverity.MEDIUM },
  
  // Timeout
  { pattern: /timeout|timed.*out/i, category: ErrorCategory.TIMEOUT, severity: ErrorSeverity.LOW },
  
  // Service unavailable
  { pattern: /503|service.*unavailable|temporarily.*unavailable/i, category: ErrorCategory.SERVICE_UNAVAILABLE, severity: ErrorSeverity.MEDIUM },
  
  // Parse errors
  { pattern: /parse.*error|invalid.*json|unexpected.*token|syntax.*error/i, category: ErrorCategory.PARSE_ERROR, severity: ErrorSeverity.HIGH },
  
  // Invalid input
  { pattern: /invalid.*input|invalid.*parameter|bad.*request|400/i, category: ErrorCategory.INVALID_INPUT, severity: ErrorSeverity.LOW },
];

/**
 * Categorize error
 */
export function categorizeError(error: any): CategorizedError {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorCode = error?.code || error?.status || error?.statusCode;
  
  let category = ErrorCategory.UNKNOWN_ERROR;
  let severity = ErrorSeverity.MEDIUM;
  
  // Match error patterns
  for (const { pattern, category: cat, severity: sev } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage) || pattern.test(String(errorCode))) {
      category = cat;
      severity = sev;
      break;
    }
  }
  
  // Determine if retryable
  const retryable = [
    ErrorCategory.NETWORK_ERROR,
    ErrorCategory.TIMEOUT,
    ErrorCategory.SERVICE_UNAVAILABLE,
    ErrorCategory.RATE_LIMIT,
  ].includes(category);
  
  // Generate user-friendly message
  const userMessage = generateUserMessage(category);
  const suggestedAction = generateSuggestedAction(category);
  
  return {
    category,
    severity,
    message: errorMessage,
    userMessage,
    technicalDetails: {
      code: errorCode,
      stack: error?.stack,
    },
    retryable,
    suggestedAction,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate user-friendly error message
 */
function generateUserMessage(category: ErrorCategory): string {
  const messages: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK_ERROR]: 'ไม่สามารถเชื่อมต่อกับแหล่งข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
    [ErrorCategory.AUTH_ERROR]: 'การยืนยันตัวตนล้มเหลว กรุณาติดต่อผู้ดูแลระบบ',
    [ErrorCategory.QUOTA_EXCEEDED]: 'ใช้งานเกินโควต้า กรุณาลองใหม่อีกครั้งในภายหลัง',
    [ErrorCategory.PARSE_ERROR]: 'ข้อมูลที่ได้รับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
    [ErrorCategory.STALE_DATA]: 'ข้อมูลอาจไม่เป็นปัจจุบัน',
    [ErrorCategory.TIMEOUT]: 'หมดเวลารอการตอบกลับ กรุณาลองใหม่อีกครั้ง',
    [ErrorCategory.RATE_LIMIT]: 'มีการใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
    [ErrorCategory.INVALID_INPUT]: 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่',
    [ErrorCategory.SERVICE_UNAVAILABLE]: 'บริการไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ในภายหลัง',
    [ErrorCategory.UNKNOWN_ERROR]: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง',
  };
  
  return messages[category] || messages[ErrorCategory.UNKNOWN_ERROR];
}

/**
 * Generate suggested action
 */
function generateSuggestedAction(category: ErrorCategory): string {
  const actions: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK_ERROR]: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ',
    [ErrorCategory.AUTH_ERROR]: 'ติดต่อผู้ดูแลระบบเพื่อตรวจสอบสิทธิ์การใช้งาน',
    [ErrorCategory.QUOTA_EXCEEDED]: 'รอ 1-5 นาทีแล้วลองใหม่อีกครั้ง',
    [ErrorCategory.PARSE_ERROR]: 'แจ้งปัญหานี้กับทีมพัฒนา',
    [ErrorCategory.STALE_DATA]: 'ใช้ข้อมูลอย่างระมัดระวัง หรือตรวจสอบจากแหล่งอื่น',
    [ErrorCategory.TIMEOUT]: 'ลองใหม่อีกครั้ง หรือตรวจสอบความเร็วอินเทอร์เน็ต',
    [ErrorCategory.RATE_LIMIT]: 'รอสักครู่แล้วลองใหม่ (แนะนำรอ 1-2 นาที)',
    [ErrorCategory.INVALID_INPUT]: 'ตรวจสอบข้อมูลที่ป้อนและลองใหม่',
    [ErrorCategory.SERVICE_UNAVAILABLE]: 'รอสักครู่แล้วลองใหม่ (บริการอาจกำลังปรับปรุง)',
    [ErrorCategory.UNKNOWN_ERROR]: 'ลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ',
  };
  
  return actions[category] || actions[ErrorCategory.UNKNOWN_ERROR];
}

/**
 * Log categorized error
 */
export function logCategorizedError(error: CategorizedError, context?: any): void {
  const logMessage = `[${error.severity}] ${error.category}: ${error.message}`;
  const logLevel = error.severity === 'CRITICAL' ? 'error' : 
                   error.severity === 'HIGH' ? 'error' :
                   error.severity === 'MEDIUM' ? 'warn' : 'info';
  
  logBoth(logLevel, `${logMessage} ${JSON.stringify({ category: error.category, severity: error.severity, retryable: error.retryable, suggestedAction: error.suggestedAction, timestamp: error.timestamp, context })}`);
}

/**
 * Create error response
 */
export function createErrorResponse(error: CategorizedError) {
  return {
    success: false,
    error: {
      code: error.category,
      message: error.userMessage,
      details: error.severity === ErrorSeverity.LOW ? undefined : {
        category: error.category,
        retryable: error.retryable,
        suggestedAction: error.suggestedAction,
      },
    },
    timestamp: error.timestamp,
  };
}

/**
 * Error metrics for monitoring
 */
class ErrorMetrics {
  private counts: Map<ErrorCategory, number> = new Map();
  private lastOccurrence: Map<ErrorCategory, string> = new Map();
  
  record(category: ErrorCategory): void {
    const current = this.counts.get(category) || 0;
    this.counts.set(category, current + 1);
    this.lastOccurrence.set(category, new Date().toISOString());
  }
  
  getStats() {
    const stats: any = {};
    this.counts.forEach((count, category) => {
      stats[category] = {
        count,
        lastOccurrence: this.lastOccurrence.get(category),
      };
    });
    return stats;
  }
  
  reset(): void {
    this.counts.clear();
    this.lastOccurrence.clear();
  }
}

export const errorMetrics = new ErrorMetrics();

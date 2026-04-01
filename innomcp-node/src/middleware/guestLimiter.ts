/**
 * Guest User Limiter Middleware
 * จำกัดการใช้งานของ Guest (ผู้ใช้ที่ไม่ได้ login) ให้อยู่ที่ 50%
 * 
 * Features:
 * - Rate limiting: จำกัดจำนวน requests
 * - Tool restrictions: จำกัด tools ที่ใช้ได้
 * - Response length limit: จำกัดความยาวคำตอบ
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../utils/jwt';

// ========================================
// Configuration
// ========================================

/**
 * Guest user capability level (50%)
 */
export interface GuestLimits {
  maxRequestsPerHour: number;  // จำนวน requests สูงสุดต่อชั่วโมง
  maxResponseLength: number;    // ความยาวคำตอบสูงสุด (characters)
  allowedTools: string[];       // Tools ที่อนุญาตให้ใช้
  maxTokensPerRequest: number;  // AI tokens สูงสุดต่อ request
}

// Guest limits (50% of full capability)
const GUEST_LIMITS: GuestLimits = {
  maxRequestsPerHour: 10,      // Full user: 20+
  maxResponseLength: 2000,      // Full user: 4000+
  allowedTools: [
    // Basic tools only (50% of all tools)
    'dateTimeTool',
    'calculatorTool',
    'weather',
    'nwp_hourly_by_place',
    'nwp_daily_by_place',
    'tmd_weather_forecast_7days_by_province',
    'tmd_weather_forecast_7days_by_region',
    'echartsTool',
    'newton',
    'worldbank',
    'archive',
    'nasa',
    // ไม่อนุญาต: TMD advanced, file readers, OCR, code formatter, etc.
  ],
  maxTokensPerRequest: 500,     // Full user: 1000+
};

// User limits (100% capability)
const USER_LIMITS: GuestLimits = {
  maxRequestsPerHour: 100,      // Generous limit
  maxResponseLength: 10000,     // Very long responses
  allowedTools: [],             // All tools allowed (empty = no restriction)
  maxTokensPerRequest: 2000,
};

// Admin limits (unlimited)
const ADMIN_LIMITS: GuestLimits = {
  maxRequestsPerHour: 1000,     // Practically unlimited
  maxResponseLength: 50000,
  allowedTools: [],
  maxTokensPerRequest: 4000,
};

// ========================================
// Rate Limiting (in-memory store)
// ========================================

interface RateLimitEntry {
  requests: number;
  resetAt: Date;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if user exceeded rate limit
 */
function checkRateLimit(userId: string | null, limits: GuestLimits): { allowed: boolean; remaining: number; resetAt: Date } {
  const key = userId || 'guest';
  const now = new Date();
  
  let entry = rateLimitStore.get(key);
  
  // Reset if hour passed
  if (!entry || entry.resetAt < now) {
    entry = {
      requests: 0,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000), // +1 hour
    };
    rateLimitStore.set(key, entry);
  }
  
  // Check limit
  const allowed = entry.requests < limits.maxRequestsPerHour;
  const remaining = Math.max(0, limits.maxRequestsPerHour - entry.requests);
  
  if (allowed) {
    entry.requests++;
  }
  
  return { allowed, remaining, resetAt: entry.resetAt };
}

// ========================================
// Middleware
// ========================================

/**
 * Guest Limiter Middleware
 * จำกัดการใช้งานตาม user role
 */
export function guestLimiterMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const smokeHeaderRaw = req.headers['x-smoke-run'] || req.headers['X-Smoke-Run'];
    const smokeHeader = Array.isArray(smokeHeaderRaw) ? smokeHeaderRaw[0] : String(smokeHeaderRaw || '');
    // smoke-only bypass; cannot activate in prod without env
    const smokeBypassEnabled = (process.env.NODE_ENV === 'test' || String(process.env.SMOKE_MODE) === '1')
      && smokeHeader === '1';

    // Determine user role
    const user = req.user;
    const isGuest = !user;
    const isAdmin = user?.userRoleId === 0;
    const isUser = user?.userRoleId === 1 || user?.userRoleId === 2;
    
    // Select limits based on role
    let limits: GuestLimits;
    if (isAdmin) {
      limits = ADMIN_LIMITS;
    } else if (isUser) {
      limits = USER_LIMITS;
    } else {
      limits = GUEST_LIMITS;
    }
    
    const userId = user?.userId?.toString() || null;
    if (!smokeBypassEnabled) {
      // Check rate limit
      const rateLimit = checkRateLimit(userId, limits);

      if (!rateLimit.allowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: isGuest
            ? 'คุณใช้งานเกินจำนวนที่กำหนดสำหรับผู้ใช้ที่ไม่ได้ล็อกอิน กรุณาล็อกอินเพื่อใช้งานได้เต็มประสิทธิภาพ'
            : 'คุณใช้งานเกินจำนวนที่กำหนด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
          limits: {
            maxRequestsPerHour: limits.maxRequestsPerHour,
            resetAt: rateLimit.resetAt.toISOString(),
          },
          isGuest,
        });
        return;
      }

      // Add rate limit info to response headers
      res.setHeader('X-RateLimit-Limit', limits.maxRequestsPerHour.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
      res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());
    }
    
    // Attach limits to request for use in chat handler
    (req as any).guestLimits = limits;
    (req as any).isGuest = isGuest;
    (req as any).capabilityLevel = isGuest ? 50 : 100;
    
    console.log(`[Guest Limiter] ${isGuest ? 'Guest' : `User ${userId}`} - ${smokeBypassEnabled ? 'SMOKE_BYPASS' : 'OK'}`);
    
    next();
  } catch (error) {
    console.error('[Guest Limiter] Error:', error);
    next(); // Allow request to continue even if limiter fails
  }
}

/**
 * Tool Restriction Middleware
 * ตรวจสอบว่า tool ที่ขอใช้อนุญาตสำหรับ user role นี้หรือไม่
 */
export function checkToolAccess(toolName: string, limits: GuestLimits): boolean {
  // If allowedTools is empty, all tools are allowed (admin/user)
  if (limits.allowedTools.length === 0) {
    return true;
  }
  
  // Check if tool is in allowed list
  return limits.allowedTools.includes(toolName);
}

/**
 * Response Length Limiter
 * จำกัดความยาวของคำตอบตาม user role
 */
export function limitResponseLength(response: string, limits: GuestLimits): string {
  if (response.length <= limits.maxResponseLength) {
    return response;
  }
  
  // Truncate and add notice
  const truncated = response.substring(0, limits.maxResponseLength);
  const notice = '\n\n⚠️ **หมายเหตุ**: คำตอบถูกตัดทอนเนื่องจากคุณยังไม่ได้ล็อกอิน กรุณาล็อกอินเพื่อรับคำตอบแบบเต็ม';
  
  return truncated + notice;
}

/**
 * Export limits for use in other modules
 */
export function getLimitsForUser(user: any | null): GuestLimits {
  if (!user) return GUEST_LIMITS;
  if (user.userRoleId === 0) return ADMIN_LIMITS;
  return USER_LIMITS;
}

/**
 * Cleanup old rate limit entries (run periodically)
 */
setInterval(() => {
  const now = new Date();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

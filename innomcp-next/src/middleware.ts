import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── In‑memory rate‑limiting store (scoped to the edge instance) ─────────────
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Cleans expired entries to prevent memory growth.
 * Runs before each check – keeps the map small.
 */
function cleanExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetTime <= now) rateLimitMap.delete(key);
  }
}

/**
 * Checks rate limit for the given IP and rate‑limit window (requests/minute).
 * Returns `true` if the request should be allowed, `false` if it should be
 * blocked (status 429).
 */
function isRateLimited(ip: string, limit: number): boolean {
  const now = Date.now();
  cleanExpiredEntries(now);

  const existing = rateLimitMap.get(ip);

  if (!existing || existing.resetTime <= now) {
    // First request of the window (or expired entry)
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + 60_000,
    });
    return false; // not limited
  }

  existing.count += 1;
  if (existing.count > limit) {
    // Over the limit
    return true;
  }

  return false;
}

// ── Security headers we attach to every API response ───────────────────────
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': [
    "default-src 'self' https://cdn.mdes-innova.online",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.mdes-innova.online",
    "style-src 'self' 'unsafe-inline' https://cdn.mdes-innova.online",
    "img-src 'self' data: https://cdn.mdes-innova.online",
    "connect-src 'self' https://ollama.mdes-innova.online",
    "font-src 'self' https://cdn.mdes-innova.online",
  ].join('; '),
};

// ── Middleware ──────────────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Health‑check endpoints are excluded from rate limiting
  if (pathname === '/api/health' || pathname === '/api/mdes/health') {
    return NextResponse.next();
  }

  // Determine client IP (edge‑friendly, no Node APIs)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.ip ||
    'anonymous';

  // Choose rate limit: chat routes get a stricter window
  const isChatRoute = pathname.startsWith('/api/chat');
  const limit = isChatRoute ? 20 : 60; // requests per minute

  if (isRateLimited(ip, limit)) {
    return NextResponse.json(
      { error: 'คำขอมากเกินไป กรุณาลองใหม่ในภายหลัง' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          ...SECURITY_HEADERS,
        },
      },
    );
  }

  // Allowed – forward the request and attach security headers
  const response = NextResponse.next();

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// ── Optional matcher to narrow middleware execution (edge performance) ──────
export const config = {
  matcher: ['/api/:path*'],
};
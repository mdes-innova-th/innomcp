// rateLimiter.ts
// In-memory sliding window rate limiter for API endpoints.
// Thai error message: "คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง"

interface RateLimitOptions {
  windowMs: number;               // time window in milliseconds
  maxRequests: number;            // max requests per window
  keyFn?: (req: any) => string;   // default: by IP (req.ip or connection remote address)
  skipFn?: (req: any) => boolean; // skip rate limiting if returns true
  message?: string;               // Thai error message (default provided)
}

type Middleware = (req: any, res: any, next: () => void) => void;

const DEFAULT_THAI_MESSAGE = 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง';
const CLEANUP_INTERVAL_MS = 60_000; // 60 seconds

// Internal store: key -> sorted array of timestamps (ms)
const store = new Map<string, number[]>();

// Periodic cleanup of expired entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function startCleanup(windowMs: number): void {
  if (cleanupTimer) return; // already started
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store.entries()) {
      // Remove expired timestamps
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        store.delete(key);
      } else if (valid.length !== timestamps.length) {
        store.set(key, valid);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow Node.js to exit even if timer is still running
  if (cleanupTimer.unref) cleanupTimer.unref();
}

// Simple default key extractor
function defaultKeyFn(req: any): string {
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter(options: RateLimitOptions): Middleware {
  const {
    windowMs,
    maxRequests,
    keyFn = defaultKeyFn,
    skipFn,
    message = DEFAULT_THAI_MESSAGE,
  } = options;

  // Start cleanup timer on first limiter creation
  startCleanup(windowMs);

  return function rateLimitMiddleware(req: any, res: any, next: () => void): void {
    // Optional skip condition
    if (skipFn?.(req)) {
      next();
      return;
    }

    const key = keyFn(req);
    const now = Date.now();

    // Get current timestamps for this key
    let timestamps = store.get(key) || [];

    // Remove timestamps outside the window
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      // Rate limit exceeded
      res.statusCode = 429;
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); // or application/json
      res.end(message);
      return;
    }

    // Allow request and record it
    timestamps.push(now);
    store.set(key, timestamps);

    next();
  };
}

// Predefined limiters
function chatRateLimit(): Middleware {
  return createRateLimiter({ windowMs: 60_000, maxRequests: 20 });
}

function apiRateLimit(): Middleware {
  return createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
}

function providerRateLimit(): Middleware {
  return createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
}

// Aliases used by app.ts route wiring
const generalRateLimit = apiRateLimit();
const authRateLimit = chatRateLimit();

// Test helper — clears the internal store so tests start fresh
function _resetRateLimiterForTests(): void {
  store.clear();
}

export { createRateLimiter, chatRateLimit, apiRateLimit, providerRateLimit, generalRateLimit, authRateLimit, _resetRateLimiterForTests };
export type { RateLimitOptions, Middleware };
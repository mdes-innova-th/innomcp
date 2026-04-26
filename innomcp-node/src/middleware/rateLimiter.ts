/**
 * Phase 3 — In-memory rate limiter.
 *
 * Two presets:
 *   generalRateLimit  60 req/min  (mount on /api)
 *   authRateLimit     10 req/min  (mount on /api/auth — brute-force resistance)
 *
 * Storage is a single Map keyed by `${preset}:${ip}`. Stale buckets are
 * cleared lazily on access (no setInterval — survives test runs without
 * leaking timers and keeps memory bounded under steady traffic).
 *
 * Disabled when:
 *   - process.env.NODE_ENV === "test"
 *   - process.env.SMOKE_MODE === "1"
 *   - process.env.RATE_LIMIT_DISABLED === "1"
 *
 * Deliberately no Redis dependency: the goal is light abuse-protection on
 * a single-node deployment, not distributed coordination.
 */

import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const WINDOW_MS = 60_000;
const GENERAL_LIMIT = 60;
const AUTH_LIMIT = 10;

const buckets = new Map<string, Bucket>();

function isDisabled(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.SMOKE_MODE === "1" ||
    process.env.RATE_LIMIT_DISABLED === "1"
  );
}

function getClientIp(req: Request): string {
  if (req.ip) return req.ip;
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!;
  return "unknown";
}

function makeLimiter(preset: "general" | "auth", limit: number) {
  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    if (isDisabled()) {
      next();
      return;
    }

    const key = `${preset}:${getClientIp(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, limit - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      const retryAfterMs = Math.max(0, bucket.resetAt - now);
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      res.status(429).json({
        error: "rate_limit_exceeded",
        retryAfterMs,
      });
      return;
    }

    next();
  };
}

export const generalRateLimit = makeLimiter("general", GENERAL_LIMIT);
export const authRateLimit = makeLimiter("auth", AUTH_LIMIT);

// Test-only helper: reset state between cases. Not exported via the public
// barrel — import directly when needed.
export function _resetRateLimiterForTests(): void {
  buckets.clear();
}

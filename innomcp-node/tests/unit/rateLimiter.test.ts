/**
 * Unit tests for the in-memory rate limiter.
 * The middleware auto-disables when NODE_ENV=test, so tests that verify
 * HTTP behaviour temporarily clear the guard env vars.
 */

// Minimal Express mock — avoids node-mocks-http dependency
function makeMockReq(ip: string, fwdFor?: string) {
  return {
    ip,
    headers: fwdFor ? { "x-forwarded-for": fwdFor } : {},
  };
}

function makeMockRes() {
  const headers: Record<string, string> = {};
  let _status = 200;
  let _body: unknown;
  return {
    setHeader(k: string, v: string) { headers[k] = v; },
    getHeader(k: string) { return headers[k]; },
    status(code: number) { _status = code; return this; },
    json(body: unknown) { _body = body; },
    get statusCode() { return _status; },
    get _data() { return _body; },
  };
}

describe("Rate Limiter middleware", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let generalRateLimit: (req: any, res: any, next: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authRateLimit: (req: any, res: any, next: any) => void;
  let _reset: () => void;

  // Capture original env values so we can restore them
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSmoke = process.env.SMOKE_MODE;
  const originalDisabled = process.env.RATE_LIMIT_DISABLED;

  // Force the limiter active for tests that need it
  // (process.env values are strings; setting to "" does not satisfy isDisabled check,
  //  so we set to a value that breaks the guard condition)
  function enableLimiter() {
    (process.env as Record<string, string | undefined>).NODE_ENV = undefined as unknown as string;
    (process.env as Record<string, string | undefined>).SMOKE_MODE = undefined as unknown as string;
    (process.env as Record<string, string | undefined>).RATE_LIMIT_DISABLED = undefined as unknown as string;
  }

  function restoreEnv() {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSmoke !== undefined) process.env.SMOKE_MODE = originalSmoke;
    else (process.env as Record<string, string | undefined>).SMOKE_MODE = undefined as unknown as string;
    if (originalDisabled !== undefined) process.env.RATE_LIMIT_DISABLED = originalDisabled;
    else (process.env as Record<string, string | undefined>).RATE_LIMIT_DISABLED = undefined as unknown as string;
  }

  beforeEach(() => {
    const mod = require("../../src/middleware/rateLimiter");
    generalRateLimit = mod.generalRateLimit;
    authRateLimit = mod.authRateLimit;
    _reset = mod._resetRateLimiterForTests;
    _reset();
  });

  afterEach(() => {
    restoreEnv();
    _reset();
  });

  // ── Disabled in test environment ────────────────────────────────────────────

  describe("bypass in test/smoke environment", () => {
    it("calls next() when NODE_ENV=test", () => {
      process.env.NODE_ENV = "test";
      const req = makeMockReq("1.2.3.4");
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });

    it("calls next() when SMOKE_MODE=1", () => {
      enableLimiter();
      process.env.SMOKE_MODE = "1";
      const req = makeMockReq("1.2.3.4");
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("calls next() when RATE_LIMIT_DISABLED=1", () => {
      enableLimiter();
      process.env.RATE_LIMIT_DISABLED = "1";
      const req = makeMockReq("1.2.3.4");
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ── Normal traffic (enabled) ─────────────────────────────────────────────────

  describe("general rate limit (60 req/min)", () => {
    beforeEach(() => enableLimiter());

    it("allows first request and sets X-RateLimit headers", () => {
      const req = makeMockReq("10.0.0.1");
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.getHeader("X-RateLimit-Limit")).toBe("60");
      expect(res.getHeader("X-RateLimit-Remaining")).toBe("59");
      expect(res.getHeader("X-RateLimit-Reset")).toBeDefined();
    });

    it("decrements remaining on each call", () => {
      for (let i = 0; i < 5; i++) {
        generalRateLimit(makeMockReq("10.0.0.2"), makeMockRes(), jest.fn());
      }
      const res = makeMockRes();
      generalRateLimit(makeMockReq("10.0.0.2"), res, jest.fn());
      expect(res.getHeader("X-RateLimit-Remaining")).toBe("54");
    });

    it("returns 429 on 61st request for same IP", () => {
      const ip = "10.0.0.3";
      for (let i = 0; i < 60; i++) {
        generalRateLimit(makeMockReq(ip), makeMockRes(), jest.fn());
      }
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(makeMockReq(ip), res, next);
      expect(res.statusCode).toBe(429);
      expect(next).not.toHaveBeenCalled();
      const body = res._data as { error: string; retryAfterMs: number };
      expect(body.error).toBe("rate_limit_exceeded");
      expect(typeof body.retryAfterMs).toBe("number");
    });

    it("does not affect a different IP", () => {
      const ip = "10.0.0.4";
      for (let i = 0; i < 60; i++) {
        generalRateLimit(makeMockReq(ip), makeMockRes(), jest.fn());
      }
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(makeMockReq("10.0.0.5"), res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("auth rate limit (10 req/min)", () => {
    beforeEach(() => enableLimiter());

    it("allows first 10 requests then blocks the 11th", () => {
      const ip = "10.0.1.1";
      for (let i = 0; i < 10; i++) {
        const next = jest.fn();
        authRateLimit(makeMockReq(ip), makeMockRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
      }
      const res = makeMockRes();
      const next = jest.fn();
      authRateLimit(makeMockReq(ip), res, next);
      expect(res.statusCode).toBe(429);
    });

    it("sets X-RateLimit-Limit=10", () => {
      const res = makeMockRes();
      authRateLimit(makeMockReq("10.0.1.2"), res, jest.fn());
      expect(res.getHeader("X-RateLimit-Limit")).toBe("10");
    });
  });

  // ── X-Forwarded-For ──────────────────────────────────────────────────────────

  describe("X-Forwarded-For handling", () => {
    beforeEach(() => enableLimiter());

    it("uses first X-Forwarded-For value when req.ip is absent", () => {
      const req = makeMockReq("", "203.0.113.5, 10.0.0.1");
      (req as Record<string, unknown>).ip = undefined;
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ── Reset helper ────────────────────────────────────────────────────────────

  describe("_resetRateLimiterForTests", () => {
    it("clears buckets so limit resets between test cases", () => {
      enableLimiter();
      const ip = "10.0.2.1";
      for (let i = 0; i < 60; i++) {
        generalRateLimit(makeMockReq(ip), makeMockRes(), jest.fn());
      }
      _reset();
      const res = makeMockRes();
      const next = jest.fn();
      generalRateLimit(makeMockReq(ip), res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

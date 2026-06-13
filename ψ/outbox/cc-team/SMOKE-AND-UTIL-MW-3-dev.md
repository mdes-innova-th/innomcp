<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: MW-3 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":80,"completion_tokens":2817,"total_tokens":2897,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2525,"image_tokens":0},"cache_creation_input_tokens":0} | 34s
 generated: 2026-06-13T05:29:36.961Z -->
import { Request, Response, NextFunction } from 'express';

function normalizeIp(ip: string): string {
  // Convert IPv4-mapped IPv6 address like "::ffff:192.0.2.1" to pure IPv4
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

const rawWhitelist = process.env.IP_WHITELIST;
let allowedIps: Set<string> | null = null;

if (rawWhitelist !== undefined) {
  const entries = rawWhitelist
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeIp);
  allowedIps = new Set(entries);
}

export function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If environment variable is not set explicitly, allow all traffic
  if (allowedIps === null) {
    next();
    return;
  }

  const clientIp = req.ip;
  if (!clientIp) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const normalized = normalizeIp(clientIp);
  if (!allowedIps.has(normalized)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}

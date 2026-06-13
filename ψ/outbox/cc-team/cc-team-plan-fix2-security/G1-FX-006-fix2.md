<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-006 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":4008,"completion_tokens":8000,"total_tokens":12008,"prompt_tokens_details":{"cached_tokens":3968,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6436,"image_tokens":0},"cache_creation_input_tokens":0} | 83s
 generated: 2026-06-13T11:35:25.933Z -->
FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { evaluate } from "mathjs";
import { logger } from "../utils/logger";
import { maybeFastPath, getFastPathDictInfo } from "../utils/fastPathGreeting";
import { analyzeIntent } from "../fastpath/intentGate";
import { checkRateLimit, buildRateLimitKey } from "../fastpath/rateLimit";
=======
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { evaluate } from "mathjs";
import { logger } from "../utils/logger";
import { maybeFastPath, getFastPathDictInfo } from "../utils/fastPathGreeting";
import { analyzeIntent } from "../fastpath/intentGate";
import { checkRateLimit, buildRateLimitKey } from "../fastpath/rateLimit";
import net from "net";
import { lookup } from "dns/promises";
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
function resolvePathMaybe(p?: string) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}
=======
function resolveExtraPhrasesFilePath(p?: string): string | null {
  if (!p) return null;
  const allowedBase = process.env.FASTPATH_EXTRA_FILE_DIR;
  if (!allowedBase) {
    logger.warn("[FastPath] FASTPATH_EXTRA_FILE_DIR not set; refusing to load external phrases files.");
    return null;
  }
  if (path.isAbsolute(p)) {
    logger.warn(`[FastPath] Absolute path not allowed for extraPhrasesFile: ${p}`);
    return null;
  }
  const resolved = path.resolve(allowedBase, p);
  if (!resolved.startsWith(allowedBase + path.sep) && resolved !== allowedBase) {
    logger.warn(`[FastPath] Path traversal attempt: ${p} -> ${resolved}`);
    return null;
  }
  return resolved;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
  const file = resolvePathMaybe(opts.extraPhrasesFile || process.env.FASTPATH_EXTRA_FILE);
=======
  const file = resolveExtraPhrasesFilePath(opts.extraPhrasesFile || process.env.FASTPATH_EXTRA_FILE);
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
  return out;
}

async function tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases> {
=======
  return out;
}

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  // IPv4 private ranges (RFC 1918) and link-local (169.254)
  const ipv4Private = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3})$|^(172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$|^(192\.168\.\d{1,3}\.\d{1,3})$|^(169\.254\.\d{1,3}\.\d{1,3})$/;
  if (ipv4Private.test(ip)) return true;
  return false;
}

async function tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases> {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
async function tryReadExtraFromUrl(url: string): Promise<ExtraPhrases> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1_500);
    const resp = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    if (!resp.ok) return {};
    const parsed: any = await resp.json();
    return {
      greeting: Array.isArray(parsed.greeting) ? parsed.greeting : undefined,
      identity: Array.isArray(parsed.identity) ? parsed.identity : undefined,
      thanks: Array.isArray(parsed.thanks) ? parsed.thanks : undefined,
      ok: Array.isArray(parsed.ok) ? parsed.ok : undefined,
      ping: Array.isArray(parsed.ping) ? parsed.ping : undefined,
      emoji: Array.isArray(parsed.emoji) ? parsed.emoji : undefined,
    };
  } catch {
    return {};
  }
}
=======
async function tryReadExtraFromUrl(url: string): Promise<ExtraPhrases> {
  try {
    // SSRF protection: validate URL
    const urlObj = new URL(url);
    const allowlist = (process.env.FASTPATH_EXTRA_URL_ALLOWLIST || "").split(",").map(s => s.trim()).filter(Boolean);
    if (allowlist.length > 0) {
      if (!allowlist.includes(urlObj.hostname)) {
        logger.warn(`[FastPath] URL hostname ${urlObj.hostname} not in allowlist`);
        return {};
      }
    } else {
      if (process.env.FASTPATH_EXTRA_URL_ALLOW_PRIVATE !== "true") {
        try {
          const { address } = await lookup(urlObj.hostname, { family: 4 });
          if (isPrivateIp(address)) {
            logger.warn(`[FastPath] URL resolves to private IP: ${url} (${address})`);
            return {};
          }
        } catch (e) {
          logger.warn(`[FastPath] DNS resolution failed for URL: ${url}: ${e}`);
          return {};
        }
      }
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1_500);
    const resp = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    if (!resp.ok) return {};
    const parsed: any = await resp.json();
    return {
      greeting: Array.isArray(parsed.greeting) ? parsed.greeting : undefined,
      identity: Array.isArray(parsed.identity) ? parsed.identity : undefined,
      thanks: Array.isArray(parsed.thanks) ? parsed.thanks : undefined,
      ok: Array.isArray(parsed.ok) ? parsed.ok : undefined,
      ping: Array.isArray(parsed.ping) ? parsed.ping : undefined,
      emoji: Array.isArray(parsed.emoji) ? parsed.emoji : undefined,
    };
  } catch {
    return {};
  }
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
    logger.debug(`[FastPath] Intent bypass: ${intent.reason

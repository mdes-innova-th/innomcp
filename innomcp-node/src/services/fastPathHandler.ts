// innomcp-node/src/services/fastPathHandler.ts
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { evaluate } from "mathjs";
// const evaluate = (expr: string) => { try { return Function('"use strict";return (' + expr + ')')(); } catch(e) { return null; } };
import { logger } from "../utils/logger";
import { maybeFastPath, getFastPathDictInfo } from "../utils/fastPathGreeting";
import { analyzeIntent } from "../fastpath/intentGate";
import { checkRateLimit, buildRateLimitKey } from "../fastpath/rateLimit";

/**
 * FastPath Handler
 * - Short-circuit common small-talk/greetings/identity/ping/thanks to return < 1s
 * - Works for HTTP routes and WebSocket flows (caller provides responder)
 * - Optional: enrich greeting/keywords from external JSON file or local HTTP endpoint
 */

export type FastPathMode = "off" | "on";

export interface FastPathHandlerOptions {
  mode?: FastPathMode;
  maxTextLen?: number;
  logPreviewChars?: number;

  /**
   * Optional extra phrase sources (enrichment).
   * - file: JSON file containing extra phrases
   * - url: local endpoint returning JSON phrases
   * NOTE: fastPathGreeting.ts already supports FASTPATH_DICT_PATH; these are extra overlays.
   */
  extraPhrasesFile?: string;
  extraPhrasesUrl?: string;

  /**
   * Cache refresh for external phrase sources
   */
  extraCacheTtlMs?: number;

  /**
   * Strict latency guard; if something is slow, do not block main AI pipeline.
   */
  maxWorkMs?: number;
}

export interface FastPathDecision {
  handled: boolean;
  reason?: string;
  latencyMs: number;
  hit?: string;
  responseTextPreview?: string;
  structuredContent?: any;
}

export type Responder = (payload: any) => Promise<void> | void;

type ExtraPhrases = {
  greeting?: string[];
  identity?: string[];
  thanks?: string[];
  ok?: string[];
  ping?: string[];
  emoji?: string[];
};

const DEFAULT_OPTS: Required<Omit<FastPathHandlerOptions, "extraPhrasesFile" | "extraPhrasesUrl">> = {
  mode: (process.env.FASTPATH_MODE as FastPathMode) || "on",
  maxTextLen: Number(process.env.FASTPATH_MAX_TEXT_LEN || 400),
  logPreviewChars: Number(process.env.FASTPATH_LOG_PREVIEW || 140),
  extraCacheTtlMs: Number(process.env.FASTPATH_EXTRA_TTL_MS || 60_000),
  maxWorkMs: Number(process.env.FASTPATH_MAX_WORK_MS || 15),
};

let extraCache: { at: number; data: ExtraPhrases } | null = null;

function nowIso() {
  return new Date().toISOString();
}

function safeTrim(s: string, n: number) {
  const x = (s || "").toString().replace(/\s+/g, " ").trim();
  return x.length <= n ? x : x.slice(0, n) + "…";
}

function isEnabled(opts: FastPathHandlerOptions) {
  const mode = opts.mode ?? DEFAULT_OPTS.mode;
  return mode !== "off";
}

function resolvePathMaybe(p?: string) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

function mergeExtra(base: ExtraPhrases, overlay: ExtraPhrases): ExtraPhrases {
  const keys: (keyof ExtraPhrases)[] = ["greeting", "identity", "thanks", "ok", "ping", "emoji"];
  const out: ExtraPhrases = { ...base };
  for (const k of keys) {
    const a = Array.isArray(base[k]) ? (base[k] as string[]) : [];
    const b = Array.isArray(overlay[k]) ? (overlay[k] as string[]) : [];
    if (a.length === 0 && b.length === 0) continue;
    out[k] = Array.from(new Set([...a, ...b].map((x) => String(x).trim()).filter(Boolean)));
  }
  return out;
}

async function tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      greeting: Array.isArray(parsed.greeting) ? parsed.greeting : undefined,
      identity: Array.isArray(parsed.identity) ? parsed.identity : undefined,
      thanks: Array.isArray(parsed.thanks) ? parsed.thanks : undefined,
      ok: Array.isArray(parsed.ok) ? parsed.ok : undefined,
      ping: Array.isArray(parsed.ping) ? parsed.ping : undefined,
      emoji: Array.isArray(parsed.emoji) ? parsed.emoji : undefined,
    };
  } catch (e: any) {
    logger.warn(`[FastPath] extraPhrasesFile parse failed: ${String(e?.message || e)}`);
    return {};
  }
}

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

async function getExtraPhrases(opts: FastPathHandlerOptions): Promise<ExtraPhrases> {
  const ttl = opts.extraCacheTtlMs ?? DEFAULT_OPTS.extraCacheTtlMs;
  if (extraCache && Date.now() - extraCache.at < ttl) return extraCache.data;

  const start = performance.now();
  let data: ExtraPhrases = {};

  const file = resolvePathMaybe(opts.extraPhrasesFile || process.env.FASTPATH_EXTRA_FILE);
  const url = opts.extraPhrasesUrl || process.env.FASTPATH_EXTRA_URL;

  // Best-effort: do not block
  if (file) data = mergeExtra(data, await tryReadExtraFromFile(file));
  if (url) data = mergeExtra(data, await tryReadExtraFromUrl(url));

  extraCache = { at: Date.now(), data };

  const dur = Math.round(performance.now() - start);
  if (dur > 20) logger.debug(`[FastPath] extra phrases refresh took ${dur}ms`);

  return data;
}

/**
 * MAIN: Decide + optionally respond immediately
 * Caller provides `respond(payload)` to send back to client.
 */
export async function handleFastPathMessage(
  text: string,
  respond: Responder,
  opts: FastPathHandlerOptions = {},
  clientIp?: string,
  userId?: string
): Promise<FastPathDecision> {
  const start = performance.now();
  const enabled = isEnabled(opts);

  if (!enabled) {
    return { handled: false, reason: "disabled", latencyMs: 0 };
  }

  // 🚦 Intent Gate: Check if should bypass FastPath
  const intent = analyzeIntent(text);
  if (intent.shouldBypass) {
    logger.debug(`[FastPath] Intent bypass: ${intent.reason} - "${text.slice(0, 50)}"`);
    return { handled: false, reason: intent.reason, latencyMs: Math.round(performance.now() - start) };
  }

  // 🛡️ Rate Limiting
  if (clientIp) {
    const rateLimitKey = buildRateLimitKey(clientIp, userId, 'fastpath');
    const rateLimit = await checkRateLimit(rateLimitKey, 5, 8);
    
    if (!rateLimit.allowed) {
      logger.warn(`[FastPath] Rate limit exceeded for ${rateLimitKey} (${rateLimit.total} requests)`);
      
      const rateLimitPayload = {
        content: [{
          type: "text",
          text: `🛑 กรุณาช้าลงหน่อยครับ (เหลือเวลา ${rateLimit.ttl} วินาที)\n\nคุณได้ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง`
        }],
        structuredContent: {
          fastPath: true,
          rateLimited: true,
          remaining: rateLimit.remaining,
          ttl: rateLimit.ttl,
          total: rateLimit.total
        }
      };
      
      await respond(rateLimitPayload);
      return { handled: true, reason: "rate-limited", latencyMs: Math.round(performance.now() - start) };
    }
  }

  const maxWorkMs = opts.maxWorkMs ?? DEFAULT_OPTS.maxWorkMs;
  const maxTextLen = opts.maxTextLen ?? DEFAULT_OPTS.maxTextLen;
  const previewN = opts.logPreviewChars ?? DEFAULT_OPTS.logPreviewChars;

  const safeText = (text || "").toString().slice(0, maxTextLen);

  // Strict latency guard: do not do extra reads if we are already late
  let extra: ExtraPhrases = {};
  const tBeforeExtra = performance.now();
  if (tBeforeExtra - start < maxWorkMs) {
    extra = await getExtraPhrases(opts);
  }

  // --- 🚀 REAL FAST PATH (Math & History) ---
  const q = safeText.trim();
  
  // 1. Math (Strict Regex)
  // Only allow numbers, operators, parentheses, and math functions common in mathjs
  // (sin|cos|tan|sqrt|log|exp|pow|abs|pi|e)
  if (/^[\d+\-*/().\s%^]+$|^(sin|cos|tan|sqrt|log|exp|pow|abs|pi|e)[\d\W]+$/i.test(q)) {
      try {
          // Dynamic import to avoid load time if not needed (or require if CommonJS)
          // We can use the installed 'mathjs'
          const { evaluate } = require('mathjs'); 
          const result = evaluate(q);
          
          if (typeof result === 'number' || (result && result.type === 'Complex')) {
              const latencyMs = Math.round(performance.now() - start);
              const responseText = `${result}`;
              
              await respond({
                  content: [{ type: "text", text: responseText }],
                  structuredContent: { fastPath: true, fastPathHit: "math", result: responseText }
              });
              
              logger.debug(`[FastPath] Math handled: ${q} -> ${responseText}`);
              return {
                  handled: true,
                  hit: "math",
                  latencyMs,
                  responseTextPreview: responseText,
                  structuredContent: { fastPath: true, hit: "math" }
              };
          }
      } catch (e) {
          // Not valid math, fall through
      }
  }

  // 2. Thai History (Static KB)
  const THAI_HISTORY_KB: Record<string, string> = {
      "รัชกาลที่ 1": "พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช",
      "รัชกาลที่ 2": "พระบาทสมเด็จพระพุทธเลิศหล้านภาลัย",
      "รัชกาลที่ 3": "พระบาทสมเด็จพระนั่งเกล้าเจ้าอยู่หัว",
      "รัชกาลที่ 4": "พระบาทสมเด็จพระจอมเกล้าเจ้าอยู่หัว",
      "รัชกาลที่ 5": "พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว",
      "รัชกาลที่ 6": "พระบาทสมเด็จพระมงกุฎเกล้าเจ้าอยู่หัว",
      "รัชกาลที่ 7": "พระบาทสมเด็จพระปกเกล้าเจ้าอยู่หัว",
      "รัชกาลที่ 8": "พระบาทสมเด็จพระปรเมนทรมหาอานันทมหิดล",
      "รัชกาลที่ 9": "พระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร",
      "รัชกาลที่ 10": "พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว",
      "ร.1": "พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช",
      "ร.2": "พระบาทสมเด็จพระพุทธเลิศหล้านภาลัย",
      "ร.3": "พระบาทสมเด็จพระนั่งเกล้าเจ้าอยู่หัว",
      "ร.4": "พระบาทสมเด็จพระจอมเกล้าเจ้าอยู่หัว",
      "ร.5": "พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว",
      "ร.6": "พระบาทสมเด็จพระมงกุฎเกล้าเจ้าอยู่หัว",
      "ร.7": "พระบาทสมเด็จพระปกเกล้าเจ้าอยู่หัว",
      "ร.8": "พระบาทสมเด็จพระปรเมนทรมหาอานันทมหิดล",
      "ร.9": "พระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร",
      "ร.10": "พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว"
  };

  for (const [key, value] of Object.entries(THAI_HISTORY_KB)) {
       if (q.includes(key) && q.length < 50) {
           const latencyMs = Math.round(performance.now() - start);
           const responseText = `${key} คือ ${value}`;
           
           await respond({
               content: [{ type: "text", text: responseText }],
               structuredContent: { fastPath: true, fastPathHit: "history", result: responseText }
           });
           
           logger.debug(`[FastPath] History handled: ${q}`);
           return {
               handled: true,
               hit: "history",
               latencyMs,
               responseTextPreview: responseText,
               structuredContent: { fastPath: true, hit: "history" }
           };
       }
  }

  // NOTE: maybeFastPath uses its internal dict + optional FASTPATH_DICT_PATH
  // Extra phrases are intended for future extension; for now we only log them (kept to avoid breaking change).
  const fp = maybeFastPath(safeText);
  const latencyMs = Math.round(performance.now() - start);

  if (!fp) {
    return { handled: false, reason: "no-match", latencyMs };
  }

  // If for any reason we exceeded maxWorkMs significantly, still respond (fast path is the point)
  const payload = {
    content: fp.content,
    structuredContent: {
      ...(fp.structuredContent || {}),
      fastPath: true,
      fastPathHit: fp.hit,
      fastPathLatencyMs: latencyMs,
      fastPathAt: nowIso(),
      dictInfo: getFastPathDictInfo(),
      extraPhrasesCounts: {
        greeting: extra.greeting?.length || 0,
        identity: extra.identity?.length || 0,
        thanks: extra.thanks?.length || 0,
        ok: extra.ok?.length || 0,
        ping: extra.ping?.length || 0,
        emoji: extra.emoji?.length || 0,
      },
    },
  };

  try {
    await respond(payload);

    logger.debug(
      `[FastPath] hit=${fp.hit} latency=${latencyMs}ms text="${safeTrim(safeText, previewN)}"`
    );

    return {
      handled: true,
      hit: fp.hit,
      latencyMs,
      responseTextPreview: safeTrim(fp.content?.[0]?.text || "", previewN),
      structuredContent: payload.structuredContent,
    };
  } catch (e: any) {
    logger.warn(`[FastPath] respond failed: ${String(e?.message || e)}`);
    return { handled: false, reason: "respond-failed", latencyMs };
  }
}

/**
 * Express helper: drop-in middleware pattern
 * - expects req.body.message or req.body.text
 * - responds JSON in the same schema your UI already handles
 */
export function createFastPathExpressMiddleware(opts: FastPathHandlerOptions = {}) {
  return async (req: any, res: any, next: any) => {
    try {
      const text = String(req?.body?.message ?? req?.body?.text ?? "");
      if (!text) return next();

      const decision = await handleFastPathMessage(
        text,
        (payload) => res.status(200).json(payload),
        opts
      );

      if (decision.handled) return;
      return next();
    } catch {
      return next();
    }
  };
}

/**
 * WebSocket helper: integrate into your existing ws message handler
 * - caller passes a `sendJson(obj)` function
 */
export async function tryFastPathWebSocket(
  userMessage: string,
  send: (payload: any) => void,
  options: any,
  clientIp?: string
): Promise<{ handled: boolean; latencyMs?: number; hit?: string; responseTextPreview?: string; structuredContent?: any }> {

  const start = Date.now();
  const text = userMessage.trim();

  // ===== HARD MATH DETECTION =====
  // Regex: Detect numbers and operators, optional "เท่ากับเท่าไร"
  const mathMatch = text.match(/^\s*(\d+\s*[\+\-\*\/]\s*\d+)\s*(?:เท่ากับเท่าไร|เท่าไร|=?\s*)?$/i);
  
  console.log("[FASTPATH DEBUG] matched math:", mathMatch);

  if (mathMatch) {
    try {
      const expression = mathMatch[1];
      const result = evaluate(expression);
      // const responseText = `${result}`;

      send({
        id: `fastpath-${Date.now()}`,
        type: "message",
        sender: "ai",
        text: `${result}`,
        timestamp: Date.now()
      });

      return {
        handled: true,
        latencyMs: Date.now() - start
      };

    } catch (err) {
      console.error("[FastPath] Math eval error:", err);
      return { handled: false, latencyMs: Date.now() - start };
    }
  }

  // ===== HISTORY FAST LOOKUP =====
  if (/รัชกาลที่\s*3/.test(text)) {
    // const msg = "รัชกาลที่ 3 คือ พระบาทสมเด็จพระนั่งเกล้าเจ้าอยู่หัว";
    
    send({
        id: `fastpath-${Date.now()}`,
        type: "message",
        sender: "ai",
        text: "รัชกาลที่ 3 คือ พระบาทสมเด็จพระนั่งเกล้าเจ้าอยู่หัว",
        timestamp: Date.now()
      });

    return {
      handled: true,
      latencyMs: Date.now() - start
    };
  }

  return { handled: false, latencyMs: Date.now() - start };
}

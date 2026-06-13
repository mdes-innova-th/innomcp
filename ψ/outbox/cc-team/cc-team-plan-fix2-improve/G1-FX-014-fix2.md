<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-014 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3963,"completion_tokens":8000,"total_tokens":11963,"prompt_tokens_details":{"cached_tokens":3840,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6580,"image_tokens":0},"cache_creation_input_tokens":0} | 79s
 generated: 2026-06-13T11:40:16.323Z -->
FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
export function trigToDeg(expr: string): string {
  if (/\b(deg|rad)\b/i.test(expr) || /\bpi\b/i.test(expr)) return expr;
  return expr.replace(/\b(sin|cos|tan|asin|acos|atan)\s*\(([^)]+)\)/gi, (_, fn, arg) => {
    const trimmed = arg.trim();
    // Only convert if the argument is a plain number (possibly negative)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return `${fn}(${trimmed} deg)`;
    }
    return `${fn}(${trimmed})`;
  });
}
=======
export function trigToDeg(expr: string): string {
  if (/\b(deg|rad)\b/i.test(expr) || /\bpi\b/i.test(expr)) return expr;
  return expr.replace(/\b(sin|cos|tan|asin|acos|atan)\s*\(([^)]+)\)/gi, (match, fn, arg) => {
    // Skip nested function calls to avoid malformed output
    if (arg.includes('(') || arg.includes(')')) return match;
    const trimmed = arg.trim();
    // Only convert if the argument is a plain number (possibly negative)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return `${fn}(${trimmed} deg)`;
    }
    return `${fn}(${trimmed})`;
  });
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
const DEFAULT_OPTS: Required<Omit<FastPathHandlerOptions, "extraPhrasesFile" | "extraPhrasesUrl">> = {
  mode: (process.env.FASTPATH_MODE as FastPathMode) || "on",
  maxTextLen: Number(process.env.FASTPATH_MAX_TEXT_LEN || 400),
  logPreviewChars: Number(process.env.FASTPATH_LOG_PREVIEW || 140),
  extraCacheTtlMs: Number(process.env.FASTPATH_EXTRA_TTL_MS || 60_000),
  maxWorkMs: Number(process.env.FASTPATH_MAX_WORK_MS || 15),
};
=======
const DEFAULT_OPTS: Required<Omit<FastPathHandlerOptions, "extraPhrasesFile" | "extraPhrasesUrl">> = {
  mode: (process.env.FASTPATH_MODE as FastPathMode) || "on",
  maxTextLen: Number(process.env.FASTPATH_MAX_TEXT_LEN ?? 400),
  logPreviewChars: Number(process.env.FASTPATH_LOG_PREVIEW ?? 140),
  extraCacheTtlMs: Number(process.env.FASTPATH_EXTRA_TTL_MS ?? 60_000),
  maxWorkMs: Number(process.env.FASTPATH_MAX_WORK_MS ?? 15),
};
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
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
=======
async function tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
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
    if (e?.code !== 'ENOENT') {
      logger.warn(`[FastPath] extraPhrasesFile parse failed: ${String(e?.message || e)}`);
    }
    return {};
  }
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
  if (clientIp) {
=======
  if (clientIp != null && clientIp !== "") {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
export function cleanFloat(val: number): string {
  const rounded = Math.round(val * 1e10) / 1e10;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
=======
export function cleanFloat(val: number): string {
  if (!Number.isFinite(val)) return String(val);
  const rounded = Math.round(val * 1e10) / 1e10;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/fastPathHandler.ts
<<<<<<< SEARCH
let extraCache: { at: number; data: ExtraPhrases } | null = null;
=======
let extraCache: { at: number; data: ExtraPhrases } | null = null;
let extraRefreshPromise: Promise<ExtraPhrases> | null = null;
>>>>

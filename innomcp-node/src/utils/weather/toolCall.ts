
export class TimeoutError extends Error {
  code = "TIMEOUT" as const;
  constructor(msg: string) { super(msg); }
}

const isTimeoutText = (s: string) =>
  /timeout|timed out|TMD API timeout/i.test(s);

export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Parse MCP tool result into usable JSON payload.
 * Handles:
 *   1. structuredContent: { ok, meta, data } → extract .data
 *   2. content[0].text JSON string → parse
 *   3. Single-element array unwrap: [{ X }] → { X }
 */
export function parseMcpPayload(result: any): any {
  if (!result) return null;

  let payload: any;

  // Step 1: Prefer structuredContent
  if (result?.structuredContent !== undefined) {
    payload = result.structuredContent;
    if (typeof payload === "string") {
      const trimmed = payload.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          payload = JSON.parse(trimmed);
        } catch {
          // keep as string
        }
      }
    }
  }

  // Step 2: Parse from content if structuredContent is missing/empty
  if (payload === undefined) {
    const content = Array.isArray(result?.content) ? result.content : [];
    const first = content[0];

    // Common: { type: 'text', text: '{...json...}' }
    const text = first?.text;
    if (typeof text === "string") {
      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          payload = JSON.parse(trimmed);
        } catch {
          payload = text;
        }
      } else {
        payload = text;
      }
    } else if (first && typeof first === "object") {
      // Some tools may embed a structured object in content
      payload = first?.json ?? first?.data ?? first;
    } else {
      payload = result;
    }
  }

  // Step 3: Unwrap common envelope: { ok, meta, data } -> data
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload) {
    if (("ok" in payload) || ("meta" in payload)) {
      payload = (payload as any).data;
    }
  }

  // Step 4: Unwrap single-element array wrapper
  // TMD often returns [{ Provinces: { Province: [...] } }] or [{ Stations: { Station: [...] } }]
  if (Array.isArray(payload) && payload.length === 1 && typeof payload[0] === "object" && payload[0] !== null) {
    payload = payload[0];
  }

  return payload;
}

export interface ToolExecutionOptions {
    client: any;
    toolName: string;
    args: any;
    timeoutMs: number;
    /** Cache scope hint (e.g. 'national' | 'province'). Used in cache key only. */
    scope?: string;
}

type CacheEntry = {
  at: number;
  payload: any;
};

// Keep cache longer than engine-level micro-caches to absorb slow upstreams.
const TOOL_TTL_MS: Array<{ re: RegExp; ttlMs: number }> = [
  { re: /^tmd_weather_3hours_all_stations$/i, ttlMs: 5 * 60_000 },
  { re: /^tmd_weather_today_07am_all_stations$/i, ttlMs: 5 * 60_000 },
  { re: /^tmd_weather_forecast_7days_by_province$/i, ttlMs: 15 * 60_000 },
  { re: /^nwp_/i, ttlMs: 10 * 60_000 },
];

// Allow timeout fallback to a last-known payload even if stale (bounded).
const MAX_STALE_FALLBACK_MS = 6 * 60 * 60_000; // 6h

const TOOLCALL_CACHE: Map<string, CacheEntry> = new Map();

function ttlForTool(toolName: string): number {
  for (const r of TOOL_TTL_MS) {
    if (r.re.test(toolName)) return r.ttlMs;
  }
  return 60_000;
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function cacheKey(toolName: string, args: any, scope?: string): string {
  const s = scope ? String(scope) : "";
  return `${toolName}|${s}|${stableStringify(args || {})}`;
}

function getFreshCache(key: string, ttlMs: number): CacheEntry | null {
  const entry = TOOLCALL_CACHE.get(key);
  if (!entry) return null;
  if ((Date.now() - entry.at) <= ttlMs) return entry;
  return null;
}

function getStaleCache(key: string): CacheEntry | null {
  const entry = TOOLCALL_CACHE.get(key);
  if (!entry) return null;
  if ((Date.now() - entry.at) <= MAX_STALE_FALLBACK_MS) return entry;
  return null;
}

function withCacheMeta(payload: any, meta: any): any {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { __cache: meta, data: payload };
  }
  return { ...payload, __cache: meta };
}

export async function executeWeatherToolCall(opts: ToolExecutionOptions): Promise<any> {
  const { client, toolName, args, timeoutMs, scope } = opts;
  const ttlMs = ttlForTool(toolName);
  const key = cacheKey(toolName, args, scope);

  const cached = getFreshCache(key, ttlMs);
  if (cached) {
    return withCacheMeta(cached.payload, { hit: true, at: cached.at, ageMs: Date.now() - cached.at, stale: false });
  }

    try {
        const result = await withTimeout(
            client.callTool({
                name: toolName,
                arguments: args,
            }),
            timeoutMs,
            toolName
        );
        const safeResult = result as any;

        if (safeResult.isError) {
            const errText = safeResult.content?.[0]?.text || "Tool execution error";
            if (isTimeoutText(errText)) {
                throw new TimeoutError(errText);
            }
            throw new Error(errText);
        }

        const payload = parseMcpPayload(safeResult);
        TOOLCALL_CACHE.set(key, { at: Date.now(), payload });
        return payload;

    } catch (error: any) {
        if (isTimeoutText(error.message) || error instanceof TimeoutError) {
          const stale = getStaleCache(key);
          if (stale) {
            return withCacheMeta(stale.payload, { hit: true, at: stale.at, ageMs: Date.now() - stale.at, stale: true, reason: "timeout_fallback" });
          }
          throw new TimeoutError(error.message);
        }
        throw error;
    }
}

export function primeWeatherToolCallCachePayload(params: {
  toolName: string;
  args: any;
  scope?: string;
  payload: any;
  at?: number;
}): void {
  const { toolName, args, scope, payload, at } = params;
  const key = cacheKey(toolName, args, scope);
  TOOLCALL_CACHE.set(key, { at: at ?? Date.now(), payload });
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";
import { tmdCacheGet, tmdCacheSet, getTmdCacheTtlMs } from "../../utils/tmdCache";

/**
 * TMD Tools (Production-ish)
 * - Hardcode uid/ukey ตามที่ผู้ใช้ต้องการ
 * - ทุก endpoint จะเติม &format=json อัตโนมัติ
 * - Log: console + mcpLog (คาดว่า mcpLog เขียนลง logs/ อยู่แล้ว)
 * - structuredContent แบบเบา: { ok, meta, data }
 */

// ========== Config ==========
const DEFAULT_TIMEOUT_MS = 60000; // ✅ เพิ่มเป็น 60s: TMD observation endpoints (WeatherToday, Weather3HoursBySynop, WeatherTodayByX) ใช้เวลา 20-31s

// Zod schema: tools เหล่านี้ "ไม่ต้องรับพารามิเตอร์"
const EmptyArgsSchema = z.object({}).passthrough();

/**
 * Key Tier:
 *   "api"  = endpoint ต้องการ credentials จริง (TMD_UID_API / TMD_UKEY_API)
 *            fallback → TMD_UID / TMD_UKEY (deprecated)
 *   "demo" = endpoint ยอมรับ demo credentials (TMD_UID_DEMO / TMD_UKEY_DEMO)
 *            fallback → TMD_UID / TMD_UKEY (deprecated)
 *
 * Mapping (based on TMD API tiers):
 *   demo  – DailySeismicEvent/v1, ThailandClimateNormal/v1, Station/v1,
 *            ThailandMonthlyRainfall/v1, RainRegions/v1
 *   api   – WeatherToday/V2, Weather3Hours/V2, WeatherForecast7Days/v2,
 *            DailyForecast/v2, WeatherWarningNews/v2, WeatherForecast7DaysByRegion/v2,
 *            Weather3HoursByX/V1, WeatherTodayByX/V1
 */
export type TmdKeyTier = "api" | "demo";

// ========== Helpers ==========
function nowMs() {
  return Date.now();
}

function safeStringify(obj: unknown, limitChars = 12000): { text: string; truncated: boolean } {
  let s = "";
  try {
    s = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  } catch {
    s = String(obj);
  }
  if (s.length > limitChars) return { text: s.slice(0, limitChars) + "\n...<truncated>...", truncated: true };
  return { text: s, truncated: false };
}

function appendFormatJson(url: string): string {
  // ถ้ามี format= อยู่แล้ว ไม่แตะ
  if (/([?&])format=/.test(url)) return url;
  // ถ้ามี ? อยู่แล้วเติม & ไม่งั้นเติม ?
  return url.includes("?") ? `${url}&format=json` : `${url}?format=json`;
}

function hasAuthParams(url: string): boolean {
  try {
    const u = new URL(url);
    return u.searchParams.has("uid") || u.searchParams.has("ukey");
  } catch {
    return /([?&])(uid|ukey)=/i.test(String(url || ""));
  }
}

function redactUrlForLog(url: string): string {
  // Redact sensitive query params (uid/ukey) from logged URLs.
  // Keep other params (e.g. format=json) intact.
  try {
    const u = new URL(url);
    u.searchParams.delete("uid");
    u.searchParams.delete("ukey");
    return u.toString();
  } catch {
    // Best-effort for invalid URLs
    let s = String(url || "");
    s = s.replace(/([?&])(uid|ukey)[=][^&]*/gi, "$1$2=<redacted>");
    // Remove the param name too (operator-grade logs should not include ukey[=]/uid[=])
    s = s.replace(/([?&])(uid|ukey)[=]<redacted>/gi, "");
    s = s.replace(/\?&/, "?");
    s = s.replace(/[?&]$/, "");
    return s;
  }
}

function sanitizeSnippetForLog(input: string, maxChars = 200): string {
  let s = String(input ?? "");
  s = s.replace(/[\r\n\t]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Remove braces/quotes/backticks to avoid dumping JSON-ish content.
  s = s.replace(/[{}"'`]/g, "");
  if (s.length > maxChars) s = s.slice(0, maxChars);
  return s;
}

function getInnomcpMode(): "offline" | "online" {
  return String(process.env.INNOMCP_MODE || "offline").trim().toLowerCase() === "online" ? "online" : "offline";
}

function isTmdExternalAllowed(): boolean {
  const mode = getInnomcpMode();
  const isSmoke = process.env.SMOKE_MODE === "1";
  const isFixture = process.env.WEATHER_FIXTURE_W1 === "1" || process.env.CHAT_TRACE_QA === "1";
  return mode === "online" && !isSmoke && !isFixture;
}

function isAuthFailLikeText(input: string): boolean {
  const t = String(input || "").toLowerCase();
  return t.includes("authentication fail") || t.includes("auth fail") || t.includes("invalid ukey") || t.includes("invalid uid");
}

function isAuthFailLikePayload(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  const bag = [payload.status,payload.message,payload.error,payload.msg,payload.result,payload.detail,payload.reason,payload.code]
    .map((v) => String(v || ""))
    .join(" | " );
  return isAuthFailLikeText(bag);
}

/**
 * Resolve credentials for the given tier with fallback chain:
 *   api  → TMD_UID_API / TMD_UKEY_API  → TMD_UID / TMD_UKEY (deprecated)
 *   demo → TMD_UID_DEMO / TMD_UKEY_DEMO → TMD_UID / TMD_UKEY (deprecated)
 *
 * Throws a clear error with setup guidance when no credential is found.
 */
function requireTmdAuthForTier(tier: TmdKeyTier): { uid: string; ukey: string } {
  let uid = "";
  let ukey = "";

  if (tier === "api") {
    uid = String(process.env.TMD_UID_API || "").trim();
    ukey = String(process.env.TMD_UKEY_API || "").trim();
  } else {
    uid = String(process.env.TMD_UID_DEMO || "").trim();
    ukey = String(process.env.TMD_UKEY_DEMO || "").trim();
  }

  // Fallback chain (newest → deprecated):
  // 1. tier-specific TMD_UID_API / TMD_UKEY_API (or DEMO variants)
  // 2. flat TMD_UID / TMD_UKEY
  // 3. legacy alias TMD_API_UID / TMD_API_UKEY (older env naming)
  if (!uid) uid = String(process.env.TMD_UID || process.env.TMD_API_UID || "").trim();
  if (!ukey) ukey = String(process.env.TMD_UKEY || process.env.TMD_API_UKEY || "").trim();

  if (!uid || !ukey) {
    const hint = tier === "api"
      ? "ตั้งค่า TMD_UID_API และ TMD_UKEY_API ใน .env (สมัครที่ https://data.tmd.go.th/)"
      : "ตั้งค่า TMD_UID_DEMO และ TMD_UKEY_DEMO ใน .env (ใช้ demo/demo สำหรับ public endpoints)";
    throw new Error(`TMD_API_PARAMS_MISSING [tier=${tier}]: ${hint}`);
  }

  // Live Mode: warn only — actual block requires TMD_STRICT_DEMO_BLOCK=1
  const isSmoke = process.env.SMOKE_MODE === "1";
  const isFixture = process.env.WEATHER_FIXTURE_W1 === "1" || process.env.CHAT_TRACE_QA === "1";
  const isLiveMode = getInnomcpMode() === "online" && !isSmoke && !isFixture;
  const strictBlock = process.env.TMD_STRICT_DEMO_BLOCK === "1";
  // Only flag as demo-like if truly generic demo credentials — "api"/"api12345" are valid public TMD credentials per TMD staff
  const isDemoLike = uid === "demo" || ukey === "demo" || ukey === "demokey";
  if (isLiveMode && tier === "api" && isDemoLike) {
    if (strictBlock) {
      throw new Error(`TMD_API_LIVE_MODE_DEMO_KEY_BLOCKED [tier=${tier}]: Credential blocked by TMD_STRICT_DEMO_BLOCK=1. Set real TMD_UID_API + TMD_UKEY_API.`);
    }
    console.warn(`WARN: TMD_API_LIVE_MODE_DEMO_KEY [tier=${tier}] uid=${uid}: Using demo/placeholder keys. API may return auth fail. Set TMD_STRICT_DEMO_BLOCK=1 to block, or update TMD_UID_API + TMD_UKEY_API.`);
  } else if (isLiveMode) {
    console.log(`[tmdTools] credential resolved tier=${tier} uid=${uid} mode=online`);
  }

  return { uid, ukey };
}

/** @deprecated Use requireTmdAuthForTier instead */
function requireTmdAuthParams(): { uid: string; ukey: string } {
  return requireTmdAuthForTier("api");
}

function withTmdAuthParams(urlBase: string, tier: TmdKeyTier = "api"): string {
  const { uid, ukey } = requireTmdAuthForTier(tier);
  const u = new URL(urlBase);
  u.searchParams.set("uid", uid);
  u.searchParams.set("ukey", ukey);
  return u.toString();
}

async function fetchWithTimeout(url: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithTimeoutAndSignal(url: string, timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const onAbort = () => {
    try { controller.abort((signal as any)?.reason); } catch { try { controller.abort(); } catch {} }
  };

  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", signal: controller.signal });
  } finally {
    clearTimeout(t);
    if (signal) {
      try { signal.removeEventListener("abort", onAbort as any); } catch {}
    }
  }
}

function isAbortError(err: any): boolean {
  const name = String(err?.name || "");
  const msg = String(err?.message || err || "");
  return name === "AbortError" || /aborted|abort/i.test(msg);
}

async function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(t);
      const e: any = new Error("aborted");
      e.name = "AbortError";
      reject(e);
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}


async function callTmdJson(toolName: string, url: string, signal?: AbortSignal) {
  // Two-layer URL policy:
  // - rawUrl: used for fetch (may include uid/ukey)
  // - safeUrl: used for logs/meta (must NOT include uid/ukey)
  const rawUrl = appendFormatJson(url);
  const safeUrl = redactUrlForLog(rawUrl);
  const authParamsPresent = hasAuthParams(rawUrl);
  const start = nowMs();

  // TTL cache for the 5 slow observation endpoints (28-52s upstream).
  // Cache key uses safeUrl (uid/ukey stripped) so creds rotation doesn't fragment.
  const cacheTtlMs = getTmdCacheTtlMs(toolName);
  const cacheKey = cacheTtlMs ? `tmd:${toolName}:${safeUrl}` : null;
  if (cacheKey) {
    const cached = tmdCacheGet(cacheKey) as
      | { ok: true; meta: Record<string, unknown>; data: unknown }
      | null;
    if (cached) {
      const durationMs = nowMs() - start;
      logBoth("INFO", `[TMD:${toolName}] cache HIT time=${durationMs}ms`);
      return {
        ...cached,
        meta: { ...cached.meta, cacheHit: true, durationMs, fetchedAt: new Date().toISOString() },
      };
    }
  }

  logBoth("INFO", `[TMD:${toolName}] GET ${safeUrl} authParamsPresent=${authParamsPresent ? "true" : "false"}`);

  try {
    // SMOKE verifier: allow simulating slow station calls (must never leak in answers).
    if (process.env.SMOKE_MODE === "1") {
      const delayAll = Number(process.env.WX_TMD_DELAY_MS || "0") || 0;
      const delayStation = Number(process.env.WX_TMD_STATION_DELAY_MS || "0") || 0;
      const isStationTool = toolName === "tmd_weather_3hours_all_stations" || toolName === "tmd_weather_today_07am_all_stations";
      const delayMs = isStationTool ? delayStation : delayAll;
      if (delayMs > 0) await abortableDelay(delayMs, signal);
    }

    // SMOKE verifier: allow forcing a small timeout to deterministically test abort behavior
    // without relying on upstream availability.
    let timeoutMs = DEFAULT_TIMEOUT_MS;
    if (process.env.SMOKE_MODE === "1") {
      const forced = Number(process.env.WX_TMD_TIMEOUT_MS || "0") || 0;
      if (Number.isFinite(forced) && forced > 0) timeoutMs = forced;
    }

    const resp = await fetchWithTimeoutAndSignal(rawUrl, timeoutMs, signal);
    const durationMs = nowMs() - start;

    const bodyText = await resp.text().catch(() => "");
    const snippet = sanitizeSnippetForLog(bodyText, 200);

    logBoth(
      resp.ok ? "INFO" : "ERROR",
      `[TMD:${toolName}] status=${resp.status} time=${durationMs}ms snippet=${snippet || "<empty>"}`
    );

    if (!resp.ok) {
      throw new Error(`TMD API error: HTTP ${resp.status}`);
    }

    // พยายาม parse JSON
    let data: any = null;
    const cleaned = bodyText.replace(/^\uFEFF/, "").trim();
    
    if (isAuthFailLikeText(cleaned)) {
      throw new Error("TMD_API_AUTH_FAIL: Authentication fail (Check TMD_UID_API/TMD_UKEY_API or TMD_UID_DEMO/TMD_UKEY_DEMO in .env — see ENV_SETUP.md)");
    }

    try {
      data = cleaned ? JSON.parse(cleaned) : null;
    } catch (e) {
      // ถ้า parse ไม่ได้ ให้คืนเป็น text ไป (แต่ยังถือว่า ok)
      logBoth("WARN", `[TMD:${toolName}] JSON parse failed, returning raw text. err=${String(e)}`);
      data = { rawText: bodyText };
    }

    if (isAuthFailLikePayload(data)) {
      throw new Error("TMD_API_AUTH_FAIL: Authentication fail payload (Check TMD_UID_API/TMD_UKEY_API or TMD_UID_DEMO/TMD_UKEY_DEMO in .env — see ENV_SETUP.md)");
    }

    const successResult = {
      ok: true as const,
      meta: {
        tool: toolName,
        url: safeUrl,
        authParamsPresent,
        status: resp.status,
        durationMs,
        fetchedAt: new Date().toISOString(),
      },
      data,
    };

    if (cacheKey && cacheTtlMs) {
      tmdCacheSet(cacheKey, successResult, cacheTtlMs);
    }

    return successResult;
  } catch (err: any) {
    const durationMs = nowMs() - start;
    const aborted = signal?.aborted || isAbortError(err);
    const isTimeout = err?.name === "AbortError";
    const message = aborted ? "TMD API aborted" : (isTimeout ? "TMD API timeout" : String(err?.message ?? err));

    // Avoid noisy logs when request was canceled.
    logBoth(aborted ? "WARN" : "ERROR", `[TMD:${toolName}] failed time=${durationMs}ms err=${message}`);

    return {
      ok: false,
      meta: {
        tool: toolName,
        url: safeUrl,
        authParamsPresent,
        status: null,
        durationMs,
        fetchedAt: new Date().toISOString(),
      },
      data: null,
      error: message,
    };
  }
}

function registerSimpleTmdTool(
  mcpserver: McpServer,
  opts: { name: string; title: string; description: string; urlBase: string; keyTier?: TmdKeyTier }
) {
  const tier: TmdKeyTier = opts.keyTier ?? "api";
  mcpserver.registerTool(
    opts.name,
    {
      title: opts.title,
      description: opts.description,
      // IMPORTANT: MCP SDK requires inputSchema to pass args correctly.
      // Without this, the request context (incl. `signal`) may be received as `args`.
      inputSchema: EmptyArgsSchema,
    },
    async (args: unknown, extra: any) => {
      const signal: AbortSignal | undefined = extra?.signal;
      const parsed = EmptyArgsSchema.safeParse(args ?? {});
      if (!parsed.success) {
        // ปกติไม่น่าเข้า แต่กันไว้
        logBoth("WARN", `[TMD:${opts.name}] invalid args: ${parsed.error.message}`);
      } else {
        // ถ้ามี args เกินมา ถือว่า ignore แต่ log ไว้
        const extraKeys = Object.keys(parsed.data ?? {});
        if (extraKeys.length > 0) {
          logBoth("WARN", `[TMD:${opts.name}] args ignored: argsKeys=${extraKeys.join(",")}`);
        }
      }

      if (!isTmdExternalAllowed()) {
        const mode = getInnomcpMode();
        const message = `TMD_EXTERNAL_BLOCKED_BY_MODE: INNOMCP_MODE=${mode} (set online and disable smoke/fixture to call external TMD API)`;
        logBoth("WARN", `[TMD:${opts.name}] blocked: ${message}`);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `ล้มเหลว: ${opts.title} -> ${message}`,
            },
          ],
          structuredContent: {
            ok: false,
            meta: {
              tool: opts.name,
              url: opts.urlBase,
              authParamsPresent: false,
              status: null,
              durationMs: 0,
              fetchedAt: new Date().toISOString(),
            },
            data: null,
            error: message,
          },
        };
      }

      let url = "";
      try {
        url = withTmdAuthParams(opts.urlBase, tier);
      } catch (e: any) {
        const message = String(e?.message || e || "TMD_API_PARAMS_MISSING");
        logBoth("ERROR", `[TMD:${opts.name}] blocked: ${message}`);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `ล้มเหลว: ${opts.title} -> ${message}`,
            },
          ],
          structuredContent: {
            ok: false,
            meta: {
              tool: opts.name,
              url: opts.urlBase,
              authParamsPresent: false,
              status: null,
              durationMs: 0,
              fetchedAt: new Date().toISOString(),
            },
            data: null,
            error: message,
          },
        };
      }

      const result = await callTmdJson(opts.name, url, signal);

      const { text, truncated } = safeStringify(result.data, 12000);
      const summary = result.ok
        ? `สำเร็จ: ${opts.title} (เวลา ${result.meta.durationMs}ms, HTTP ${result.meta.status})`
        : `ล้มเหลว: ${opts.title} (เวลา ${result.meta.durationMs}ms) -> ${result.error}`;

      return {
        isError: !result.ok,
        content: [
          {
            type: "text" as const,
            text: `${summary}\n\n${text}${truncated ? "\n\nหมายเหตุ: content ถูกตัดให้สั้นเพื่อไม่ให้ยาวเกิน แต่ structuredContent ยังมีครบ" : ""}`,
          },
        ],
        structuredContent: {
          ok: result.ok,
          meta: result.meta,
          data: result.data,
          ...(result.ok ? {} : { error: result.error }),
        },
      };
    }
  );
}

// ========== URLs (Hardcode ตามที่คุณให้มา) ==========
const TMD_ENDPOINTS = {
  // 1
  dailySeismicEvent: "http://data.tmd.go.th/api/DailySeismicEvent/v1/",

  // 2
  thailandClimateNormal: "http://data.tmd.go.th/api/ThailandClimateNormal/v1/",

  // 3 (เดิม)
  weatherToday: "https://data.tmd.go.th/api/WeatherToday/V2/",

  // 4
  weather3Hours: "https://data.tmd.go.th/api/Weather3Hours/V2/",

  // 5
  thailandMonthlyRainfall: "http://data.tmd.go.th/api/ThailandMonthlyRainfall/v1/index.php",

  // 6
  rainRegions: "https://data.tmd.go.th/api/RainRegions/v1/",

  // 7
  station: "http://data.tmd.go.th/api/Station/v1/",

  // 8
  weatherForecast7DaysProvince: "https://data.tmd.go.th/api/WeatherForecast7Days/v2/",

  // 9
  dailyForecast: "https://data.tmd.go.th/api/DailyForecast/v2/",

  // 10 
  weatherWarningNews: "http://data.tmd.go.th/api/WeatherWarningNews/v2/",

  // 11
  weatherForecast7DaysByRegion: "https://data.tmd.go.th/api/WeatherForecast7DaysByRegion/v2/",

  // 12
  weather3HoursByHydro: "http://data.tmd.go.th/api/Weather3HoursByHydro/V1/",

  // 13
  weather3HoursByAgro: "http://data.tmd.go.th/api/Weather3HoursByAgro/V1/",

  // 14
  weather3HoursBySynop: "http://data.tmd.go.th/api/Weather3HoursBySynop/V1/",

  // 15
  weatherTodayByHydro: "http://data.tmd.go.th/api/WeatherTodayByHydro/V1/",

  // 16
  weatherTodayByAgro: "http://data.tmd.go.th/api/WeatherTodayByAgro/V1/",

  // 17
  weatherTodayBySynop: "http://data.tmd.go.th/api/weathertodayBySynop/V1/",
} as const;

// ========== Registration ==========
export function registerTmdTool(mcpserver: McpServer) {
  // เพื่อไม่ให้ของเดิมพัง: ยัง export ชื่อเดิม registerTmdTool แต่ภายใน register ครบทุกตัว

  // ── Demo-tier endpoints: public v1 datasets (use TMD_UID_DEMO / TMD_UKEY_DEMO) ──

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_seismic_daily_events",
    title: "รายงานแผ่นดินไหวรายวัน (ไทย/ใกล้เคียง/ทั่วโลก) - TMD",
    description: "ดึงรายงานการเกิดแผ่นดินไหวล่าสุดจาก TMD (DailySeismicEvent) - earthquake, seismic, แผ่นดินไหว, ริกเตอร์, richter แบบ JSON",
    urlBase: TMD_ENDPOINTS.dailySeismicEvent,
    keyTier: "demo",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_thailand_climate_normal_1981_2010",
    title: "ค่าสถิติภูมิอากาศค่าปกติประเทศไทย 1981-2010 - TMD",
    description: "ดึง Climate Normal (ThailandClimateNormal) แบบ JSON",
    urlBase: TMD_ENDPOINTS.thailandClimateNormal,
    keyTier: "demo",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_thailand_monthly_rainfall",
    title: "ปริมาณฝนสะสมรายเดือน/จำนวนวันฝนตก (ประเทศไทย) - TMD",
    description: "ThailandMonthlyRainfall v1 แบบ JSON (ไม่มีพารามิเตอร์ตามที่คุณยืนยัน)",
    urlBase: TMD_ENDPOINTS.thailandMonthlyRainfall,
    keyTier: "demo",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_rain_regions",
    title: "ผลตรวจวัดฝนอำเภอแบ่งตามรายภาค - TMD",
    description: "RainRegions v1 แบบ JSON",
    urlBase: TMD_ENDPOINTS.rainRegions,
    keyTier: "demo",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_station_list",
    title: "รายชื่อสถานีอุตุนิยมวิทยา (Station) - TMD",
    description: "ดึงข้อมูลสถานี (Station v1) แบบ JSON",
    urlBase: TMD_ENDPOINTS.station,
    keyTier: "demo",
  });

  // ── API-tier endpoints: real-time observation + forecast v2 (use TMD_UID_API / TMD_UKEY_API) ──

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_07am_all_stations",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (ทุกสถานี) - TMD",
    description: "ผลตรวจวัดลักษณะอากาศรายวันเวลา 07:00 น. (WeatherToday V2) แบบ JSON",
    urlBase: TMD_ENDPOINTS.weatherToday,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_all_stations",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (ทุกสถานี) - TMD",
    description: "ผลตรวจวัดทุกสถานีทุก 3 ชม. (Weather3Hours V2) แบบ JSON",
    urlBase: TMD_ENDPOINTS.weather3Hours,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_forecast_7days_by_province",
    title: "พยากรณ์อากาศล่วงหน้า 7 วัน รายจังหวัด - TMD",
    description: "WeatherForecast7Days v2 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weatherForecast7DaysProvince,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_daily_forecast_4_times",
    title: "พยากรณ์อากาศรายวัน (06/12/17/23 น.) - TMD",
    description: "DailyForecast v2 แบบ JSON",
    urlBase: TMD_ENDPOINTS.dailyForecast,
    keyTier: "api",
  });

  // #10
  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_warning_news",
    title: "ข่าวเตือนภัย/ติดตามสภาพอากาศร้าย (ตามรายการ #10) - TMD",
    description: "ดึงข้อมูลจาก weatherWarningNews v2 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weatherWarningNews,
    keyTier: "api",
  });

  // #11
  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_forecast_7days_by_region",
    title: "พยากรณ์อากาศ 7 วัน รายภาค - TMD",
    description: "WeatherForecast7DaysByRegion v2 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weatherForecast7DaysByRegion,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_by_hydro",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (สถานีอุทก) - TMD",
    description: "Weather3HoursByHydro V1 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weather3HoursByHydro,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_by_agro",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (สถานีเกษตร) - TMD",
    description: "Weather3HoursByAgro V1 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weather3HoursByAgro,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_by_synop",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (สถานีผิวพื้น) - TMD",
    description: "Weather3HoursBySynop V1 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weather3HoursBySynop,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_by_hydro_07am",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (สถานีอุทก) - TMD",
    description: "WeatherTodayByHydro V1 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weatherTodayByHydro,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_by_agro_07am",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (สถานีเกษตร) - TMD",
    description: "WeatherTodayByAgro V1 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weatherTodayByAgro,
    keyTier: "api",
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_by_synop_07am",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (สถานีผิวพื้น) - TMD",
    description: "WeatherTodayBySynop V1 แบบ JSON",
    urlBase: TMD_ENDPOINTS.weatherTodayBySynop,
    keyTier: "api",
  });

  logBoth("INFO", `[TMD] Registered 17 tools successfully`);
}

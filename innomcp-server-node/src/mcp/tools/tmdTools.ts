import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

/**
 * TMD Tools (Production-ish)
 * - Hardcode uid/ukey ตามที่ผู้ใช้ต้องการ
 * - ทุก endpoint จะเติม &format=json อัตโนมัติ
 * - Log: console + mcpLog (คาดว่า mcpLog เขียนลง logs/ อยู่แล้ว)
 * - structuredContent แบบเบา: { ok, meta, data }
 */

// ========== Config ==========
const DEFAULT_TIMEOUT_MS = 30000; // ✅ เพิ่มจาก 15s เป็น 30s สำหรับ API ที่ช้า

// Zod schema: tools เหล่านี้ "ไม่ต้องรับพารามิเตอร์"
const EmptyArgsSchema = z.object({}).passthrough();

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
    s = s.replace(/([?&])(uid|ukey)=[^&]*/gi, "$1$2=<redacted>");
    // Remove the param name too (operator-grade logs should not include ukey=/uid=)
    s = s.replace(/([?&])(uid|ukey)=<redacted>/gi, "");
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
    try {
      // กัน BOM/whitespace แปลก ๆ
      const cleaned = bodyText.replace(/^\uFEFF/, "").trim();
      data = cleaned ? JSON.parse(cleaned) : null;
    } catch (e) {
      // ถ้า parse ไม่ได้ ให้คืนเป็น text ไป (แต่ยังถือว่า ok)
      logBoth("WARN", `[TMD:${toolName}] JSON parse failed, returning raw text. err=${String(e)}`);
      data = { rawText: bodyText };
    }

    return {
      ok: true,
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
  opts: { name: string; title: string; description: string; url: string }
) {
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

      const result = await callTmdJson(opts.name, opts.url, signal);

      const { text, truncated } = safeStringify(result.data, 12000);
      const summary = result.ok
        ? `สำเร็จ: ${opts.title} (เวลา ${result.meta.durationMs}ms, HTTP ${result.meta.status})`
        : `ล้มเหลว: ${opts.title} (เวลา ${result.meta.durationMs}ms) -> ${result.error}`;

      return {
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
  dailySeismicEvent:
    "http://data.tmd.go.th/api/DailySeismicEvent/v1/?uid=api&ukey=api12345",

  // 2
  thailandClimateNormal:
    "http://data.tmd.go.th/api/ThailandClimateNormal/v1/?uid=api&ukey=api12345",

  // 3 (เดิม)
  weatherToday:
    "https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345",

  // 4
  weather3Hours:
    "http://data.tmd.go.th/api/Weather3Hours/V2/?uid=api&ukey=api12345",

  // 5
  thailandMonthlyRainfall:
    "http://data.tmd.go.th/api/ThailandMonthlyRainfall/v1/index.php?uid=api&ukey=api12345",

  // 6
  rainRegions:
    "https://data.tmd.go.th/api/RainRegions/v1/?uid=api&ukey=api12345",

  // 7
  station:
    "http://data.tmd.go.th/api/Station/v1/?uid=demo&ukey=demokey",

  // 8
  weatherForecast7DaysProvince:
    "https://data.tmd.go.th/api/WeatherForecast7Days/v2/?uid=api&ukey=api12345",

  // 9
  dailyForecast:
    "https://data.tmd.go.th/api/DailyForecast/v2/?uid=api&ukey=api12345",

  // 10 
  weatherWarningNews:
    "http://data.tmd.go.th/api/WeatherWarningNews/v2/?uid=demo&ukey=demokey",

  // 11
  weatherForecast7DaysByRegion:
    "https://data.tmd.go.th/api/WeatherForecast7DaysByRegion/v2/?uid=demo&ukey=demokey",

  // 12
  weather3HoursByHydro:
    "http://data.tmd.go.th/api/Weather3HoursByHydro/V1/?uid=api&ukey=api12345",

  // 13
  weather3HoursByAgro:
    "http://data.tmd.go.th/api/Weather3HoursByAgro/V1/?uid=api&ukey=api12345",

  // 14
  weather3HoursBySynop:
    "http://data.tmd.go.th/api/Weather3HoursBySynop/V1/?uid=api&ukey=api12345",

  // 15
  weatherTodayByHydro:
    "http://data.tmd.go.th/api/WeatherTodayByHydro/V1/?uid=api&ukey=api12345",

  // 16
  weatherTodayByAgro:
    "http://data.tmd.go.th/api/WeatherTodayByAgro/V1/?uid=api&ukey=api12345",

  // 17
  weatherTodayBySynop:
    "http://data.tmd.go.th/api/weathertodayBySynop/V1/?uid=api&ukey=api12345",
} as const;

// ========== Registration ==========
export function registerTmdTool(mcpserver: McpServer) {
  // เพื่อไม่ให้ของเดิมพัง: ยัง export ชื่อเดิม registerTmdTool แต่ภายใน register ครบทุกตัว

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_seismic_daily_events",
    title: "รายงานแผ่นดินไหวรายวัน (ไทย/ใกล้เคียง/ทั่วโลก) - TMD",
    description: "ดึงรายงานการเกิดแผ่นดินไหวล่าสุดจาก TMD (DailySeismicEvent) - earthquake, seismic, แผ่นดินไหว, ริกเตอร์, richter แบบ JSON",
    url: TMD_ENDPOINTS.dailySeismicEvent,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_thailand_climate_normal_1981_2010",
    title: "ค่าสถิติภูมิอากาศค่าปกติประเทศไทย 1981-2010 - TMD",
    description: "ดึง Climate Normal (ThailandClimateNormal) แบบ JSON",
    url: TMD_ENDPOINTS.thailandClimateNormal,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_07am_all_stations",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (ทุกสถานี) - TMD",
    description: "ผลตรวจวัดลักษณะอากาศรายวันเวลา 07:00 น. (WeatherToday V2) แบบ JSON",
    url: TMD_ENDPOINTS.weatherToday,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_all_stations",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (ทุกสถานี) - TMD",
    description: "ผลตรวจวัดทุกสถานีทุก 3 ชม. (Weather3Hours V2) แบบ JSON",
    url: TMD_ENDPOINTS.weather3Hours,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_thailand_monthly_rainfall",
    title: "ปริมาณฝนสะสมรายเดือน/จำนวนวันฝนตก (ประเทศไทย) - TMD",
    description: "ThailandMonthlyRainfall v1 แบบ JSON (ไม่มีพารามิเตอร์ตามที่คุณยืนยัน)",
    url: TMD_ENDPOINTS.thailandMonthlyRainfall,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_rain_regions",
    title: "ผลตรวจวัดฝนอำเภอแบ่งตามรายภาค - TMD",
    description: "RainRegions v1 แบบ JSON",
    url: TMD_ENDPOINTS.rainRegions,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_station_list",
    title: "รายชื่อสถานีอุตุนิยมวิทยา (Station) - TMD",
    description: "ดึงข้อมูลสถานี (Station v1) แบบ JSON (ใช้ demo key ตาม URL ที่คุณให้มา)",
    url: TMD_ENDPOINTS.station,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_forecast_7days_by_province",
    title: "พยากรณ์อากาศล่วงหน้า 7 วัน รายจังหวัด - TMD",
    description: "WeatherForecast7Days v2 แบบ JSON",
    url: TMD_ENDPOINTS.weatherForecast7DaysProvince,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_daily_forecast_4_times",
    title: "พยากรณ์อากาศรายวัน (06/12/17/23 น.) - TMD",
    description: "DailyForecast v2 แบบ JSON",
    url: TMD_ENDPOINTS.dailyForecast,
  });

  // #10 
  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_warning_news",
    title: "ข่าวเตือนภัย/ติดตามสภาพอากาศร้าย (ตามรายการ #10) - TMD",
    description:
      "ดึงข้อมูลจาก weatherWarningNews v2 แบบ JSON",
    url: TMD_ENDPOINTS.weatherWarningNews,
  });

  // #11
  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_forecast_7days_by_region",
    title: "พยากรณ์อากาศ 7 วัน รายภาค - TMD",
    description: "WeatherForecast7DaysByRegion v2 แบบ JSON",
    url: TMD_ENDPOINTS.weatherForecast7DaysByRegion,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_by_hydro",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (สถานีอุทก) - TMD",
    description: "Weather3HoursByHydro V1 แบบ JSON",
    url: TMD_ENDPOINTS.weather3HoursByHydro,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_by_agro",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (สถานีเกษตร) - TMD",
    description: "Weather3HoursByAgro V1 แบบ JSON",
    url: TMD_ENDPOINTS.weather3HoursByAgro,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_3hours_by_synop",
    title: "ผลตรวจวัดอากาศราย 3 ชั่วโมง (สถานีผิวพื้น) - TMD",
    description: "Weather3HoursBySynop V1 แบบ JSON",
    url: TMD_ENDPOINTS.weather3HoursBySynop,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_by_hydro_07am",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (สถานีอุทก) - TMD",
    description: "WeatherTodayByHydro V1 แบบ JSON",
    url: TMD_ENDPOINTS.weatherTodayByHydro,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_by_agro_07am",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (สถานีเกษตร) - TMD",
    description: "WeatherTodayByAgro V1 แบบ JSON",
    url: TMD_ENDPOINTS.weatherTodayByAgro,
  });

  registerSimpleTmdTool(mcpserver, {
    name: "tmd_weather_today_by_synop_07am",
    title: "ผลตรวจวัดอากาศรายวัน 07:00 (สถานีผิวพื้น) - TMD",
    description: "WeatherTodayBySynop V1 แบบ JSON",
    url: TMD_ENDPOINTS.weatherTodayBySynop,
  });

  logBoth("INFO", `[TMD] Registered 17 tools successfully`);
}

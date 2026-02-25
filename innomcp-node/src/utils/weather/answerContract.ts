import { shapeWeatherResults, firstNonEmptyString, normalizeProvinceDisplayName, toNumberOrNull } from "./shaping";
import { WeatherResult } from "./types";

function bkkDateStr(offsetDays: number): string {
  const now = new Date();
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const bkk = new Date(bkkMs);
  bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = bkk.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const THAI_DIGIT_MAP: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

function thaiDigitsToArabic(raw: string): string {
  return String(raw || "").replace(/[๐-๙]/g, (ch) => THAI_DIGIT_MAP[ch] ?? ch);
}

function parseDayOffset(text: string): number {
  const t = String(text || "");
  if (/วันนี้|ตอนนี้|ขณะนี้/i.test(t)) return 0;
  if (/พรุ่งนี้/i.test(t)) return 1;
  if (/มะรืน/i.test(t)) return 2;

  const m = t.match(/อีก\s*(\d+|[๐-๙]+)\s*วัน/i);
  if (m?.[1]) {
    const n = Number(thaiDigitsToArabic(m[1]));
    if (Number.isFinite(n) && n >= 0) return Math.min(n, 14);
  }

  return 0;
}

function timeWindowLabel(userText: string): { label: string; date: string; offset: number } {
  const offset = parseDayOffset(userText);
  const label = offset === 0 ? "วันนี้" : offset === 1 ? "พรุ่งนี้" : offset === 2 ? "มะรืน" : `อีก ${offset} วัน`;
  return { label, date: bkkDateStr(offset), offset };
}

function isTodayRainQuestion(text: string): boolean {
  const t = String(text || "");
  return /วันนี้/i.test(t) && /(ฝนตกไหม|ฝนจะตก|ฝนตกช่วงไหน|ฝน\s*ตก)/i.test(t);
}

function pickStationUpdateTime(stationItems: any[]): string {
  const s = (Array.isArray(stationItems) ? stationItems : [])[0] || {};
  return firstNonEmptyString(
    s.ObservationTime,
    s.ObservationDateTime,
    s.ObservationDatetime,
    s.DateTime,
    s.Datetime,
    s.ObsTime,
    s.Time
  );
}

function pickStationTempC(stationItems: any[]): number | null {
  const s = (Array.isArray(stationItems) ? stationItems : [])[0] || {};
  return (
    toNumberOrNull(s.Temp) ??
    toNumberOrNull(s.Temperature) ??
    toNumberOrNull(s.AirTemperature) ??
    toNumberOrNull(s.TempC)
  );
}

function pickStationWind(stationItems: any[]): { speedKmh: number | null; dir: string } {
  const s = (Array.isArray(stationItems) ? stationItems : [])[0] || {};
  const speed = toNumberOrNull(s.WindSpeed) ?? toNumberOrNull(s.WindSpeedKmh) ?? toNumberOrNull(s.Wind);
  const dir = firstNonEmptyString(s.WindDirection, s.WindDir, s.WindDirectionDeg, s.WindDirectionDegree);
  return { speedKmh: speed, dir };
}

function pickForecastDayIndex(forecast: any, offsetDays: number): number {
  const f = forecast && typeof forecast === "object" ? forecast : {};
  const dates: string[] = Array.isArray((f as any).ForecastDate) ? (f as any).ForecastDate : [];
  if (dates.length === 0) return 0;

  const target = bkkDateStr(offsetDays);
  const idx = dates.indexOf(target);
  return idx >= 0 ? idx : 0;
}

function fmtTempRange(minC: unknown, maxC: unknown): string {
  const min = toNumberOrNull(minC);
  const max = toNumberOrNull(maxC);
  if (min !== null && max !== null) return `${min}–${max}°C`;
  if (max !== null) return `≤${max}°C`;
  if (min !== null) return `≥${min}°C`;
  return "";
}

function fmtWind(speedKmh: number | null, dir: string): string {
  const spd = speedKmh !== null ? `${speedKmh}km/h` : "";
  const d = dir ? String(dir).trim() : "";
  const out = `${spd} ${d}`.replace(/\s+/g, " ").trim();
  return out;
}

function groupByProvince(results: WeatherResult[]): Map<string, WeatherResult[]> {
  const map = new Map<string, WeatherResult[]>();
  for (const r of results || []) {
    const p = normalizeProvinceDisplayName(r?.province || "");
    if (!p) continue;
    const arr = map.get(p) || [];
    arr.push(r);
    map.set(p, arr);
  }
  return map;
}

function classifyErrorCode(err: string): "TIMEOUT" | "UPSTREAM" | "NO_DATA" {
  const e = String(err || "");
  if (e === "TIMEOUT" || e === "BUDGET_EXCEEDED") return "TIMEOUT";

  // No-data style
  if (
    e === "STATION_NOT_FOUND" ||
    e === "PROVINCE_NOT_FOUND_IN_FORECAST" ||
    e === "DATA_UNAVAILABLE" ||
    e === "STATION_SKIPPED" ||
    e === "NWP_UNAVAILABLE" ||
    e === "NATIONAL_DATA_UNAVAILABLE"
  ) {
    return "NO_DATA";
  }

  // Upstream / infra
  return "UPSTREAM";
}

function renderErrorOnlyProvince(province: string, items: WeatherResult[]): string {
  const errs = (items || []).filter((r) => r && r.type === "error").map((r) => String(r.error || ""));
  const priority = errs.map(classifyErrorCode);

  const kind: "TIMEOUT" | "UPSTREAM" | "NO_DATA" =
    priority.includes("TIMEOUT") ? "TIMEOUT" :
    priority.includes("UPSTREAM") ? "UPSTREAM" :
    "NO_DATA";

  const msg = (() => {
    switch (kind) {
      case "TIMEOUT":
        return `ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา กรุณาลองใหม่อีกครั้ง (ERR:WX_TIMEOUT)`;
      case "UPSTREAM":
        return `ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองใหม่อีกครั้ง (ERR:WX_UPSTREAM)`;
      case "NO_DATA":
      default:
        return `ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ (ERR:WX_NO_DATA)`;
    }
  })();

  return [`พื้นที่: ${province}`, msg].join("\n");
}

function renderOneProvince(userText: string, province: string, items: WeatherResult[]): string {
  const shaped = shapeWeatherResults(items, 10);

  // Renderer-only policy: if a province has no usable data, emit a single ERR:WX_* line.
  if (!shaped.some((r) => r && r.type !== "error")) {
    return renderErrorOnlyProvince(province, shaped);
  }

  const station = shaped.find((r) => r.type === "station3h" && Array.isArray(r.data));
  const forecast = shaped.find((r) => r.type === "forecast7d" && r.data && typeof r.data === "object");

  const stationItems = (station && Array.isArray(station.data)) ? station.data : [];
  const forecastBlock = forecast?.data?.forecast;

  const offset = parseDayOffset(userText);
  const dayIdx = pickForecastDayIndex(forecastBlock, offset);

  const rainPct = toNumberOrNull(forecastBlock?.PercentRainCover?.[dayIdx]);
  const tempRange = fmtTempRange(
    forecastBlock?.MinimumTemperature?.[dayIdx],
    forecastBlock?.MaximumTemperature?.[dayIdx]
  );

  const forecastWind = {
    speedKmh: toNumberOrNull(forecastBlock?.WindSpeed?.[dayIdx]),
    dir: firstNonEmptyString(forecastBlock?.WindDirection?.[dayIdx]),
  };

  const stationWind = pickStationWind(stationItems);

  const wind = (() => {
    // NOW/TODAY -> prefer station, FUTURE -> forecast.
    if (/พรุ่งนี้|มะรืน|อีก\s*(\d+|[๐-๙]+)\s*วัน/i.test(userText || "")) {
      return forecastWind;
    }
    return {
      speedKmh: stationWind.speedKmh ?? forecastWind.speedKmh,
      dir: stationWind.dir || forecastWind.dir,
    };
  })();

  const obsTime = pickStationUpdateTime(stationItems);
  const forecastTime = firstNonEmptyString(forecast?.data?.lastBuildDate, forecastBlock?.LastBuildDate);

  const tempFallback = (() => {
    const t = pickStationTempC(stationItems);
    return t !== null ? `${t}°C` : "";
  })();

  const tempText = tempRange ? tempRange : tempFallback;

  const rainText = rainPct !== null ? `${rainPct}%` : "ไม่พบข้อมูล";
  const windText = (() => {
    const w = fmtWind(wind.speedKmh, wind.dir);
    return w ? w : "ไม่พบข้อมูล";
  })();
  const tempOut = tempText ? tempText : "ไม่พบข้อมูล";

  const timeRisk = (() => {
    if (isTodayRainQuestion(userText)) {
      const obs = obsTime || "ไม่พบข้อมูล";
      const fc = forecastTime || "ไม่พบข้อมูล";
      return `เช้า: สังเกตการณ์ล่าสุด (${obs}) | บ่าย-เย็น: พยากรณ์วันนี้ (${fc})`;
    }
    return "ไม่พบข้อมูลช่วงเวลา (มีเฉพาะรายวัน)";
  })();

  const advice = (() => {
    const tips: string[] = [];
    if (rainPct !== null) {
      if (rainPct >= 60) tips.push("ระวังฝนและถนนลื่น");
      else if (rainPct >= 30) tips.push("อาจมีฝนประปราย");
    }
    if (wind.speedKmh !== null && wind.speedKmh >= 40) tips.push("ระวังลมแรง");

    if (tips.length > 0) return tips.join(" | ");
    if (rainPct === null && wind.speedKmh === null) return "ไม่พบข้อมูลคำเตือน";
    return "ไม่มีคำเตือนพิเศษ";
  })();

  const lines: string[] = [];
  lines.push(`พื้นที่: ${province}`);
  lines.push(`โอกาสฝน: ${rainText}`);
  lines.push(`ช่วงเวลาเสี่ยง: ${timeRisk}`);
  lines.push(`อุณหภูมิ: ${tempOut}`);
  lines.push(`ลม: ${windText}`);
  lines.push(`ข้อควรระวัง: ${advice}`);

  return lines.join("\n");
}

export function renderWeatherContractAnswer(userText: string, weatherResults: WeatherResult[]): { text: string; structuredContent: any } {
  const structuredContent = { weatherPipeline: weatherResults };

  const shaped = shapeWeatherResults(weatherResults, 15);

  // Global all-error case (including province=""), keep operator-grade + deterministic token.
  if (!shaped.some((r) => r && r.type !== "error")) {
    const errs = shaped.filter((r) => r && r.type === "error").map((r) => String(r.error || ""));
    const kinds = errs.map(classifyErrorCode);
    const kind: "TIMEOUT" | "UPSTREAM" | "NO_DATA" =
      kinds.includes("TIMEOUT") ? "TIMEOUT" :
      kinds.includes("UPSTREAM") ? "UPSTREAM" :
      "NO_DATA";

    const text = (() => {
      switch (kind) {
        case "TIMEOUT":
          return "ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา กรุณาลองใหม่อีกครั้ง (ERR:WX_TIMEOUT)";
        case "UPSTREAM":
          return "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองใหม่อีกครั้ง (ERR:WX_UPSTREAM)";
        case "NO_DATA":
        default:
          return "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ (ERR:WX_NO_DATA)";
      }
    })();

    return { text, structuredContent };
  }

  const grouped = groupByProvince(shaped);

  const provinces = Array.from(grouped.keys());
  if (provinces.length === 0) {
    return { text: "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ (ERR:WX_NO_DATA)", structuredContent };
  }

  const tw = timeWindowLabel(userText);
  const header = `ช่วงเวลา: ${tw.label} (${tw.date})`;
  const blocks = provinces.map((p) => renderOneProvince(userText, p, grouped.get(p) || []));
  return { text: [header, ...blocks].join("\n\n"), structuredContent };
}

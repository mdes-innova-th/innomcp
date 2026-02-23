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
  return "—";
}

function fmtWind(speedKmh: number | null, dir: string): string {
  const spd = speedKmh !== null ? `${speedKmh}km/h` : "—";
  const d = dir ? String(dir).trim() : "—";
  return `${spd} ${d}`.trim();
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

function renderOneProvince(userText: string, province: string, items: WeatherResult[]): string {
  const shaped = shapeWeatherResults(items, 10);

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
    return t !== null ? `${t}°C` : "—";
  })();

  const tempText = tempRange !== "—" ? tempRange : tempFallback;

  const lines: string[] = [];
  lines.push(`- ${province}`);
  lines.push(`  - โอกาสฝน: ${rainPct !== null ? `${rainPct}%` : "—"}`);
  lines.push(`  - อุณหภูมิ: ${tempText}`);
  lines.push(`  - ลม: ${fmtWind(wind.speedKmh, wind.dir)}`);
  lines.push(`  - เวลาอัปเดต: สังเกตการณ์ ${obsTime || "—"} | พยากรณ์ ${forecastTime || "—"}`);

  if (isTodayRainQuestion(userText)) {
    lines.push(`  - วันนี้ (ช่วงเช้า): อ้างอิงสังเกตการณ์ล่าสุด (${obsTime || "—"})`);
    lines.push(`  - วันนี้ (ช่วงบ่าย): อ้างอิงพยากรณ์วันนี้ (${forecastTime || "—"})`);
    lines.push(`  - วันนี้ (ช่วงเย็น): อ้างอิงพยากรณ์วันนี้ (${forecastTime || "—"})`);
  }

  return lines.join("\n");
}

export function renderWeatherContractAnswer(userText: string, weatherResults: WeatherResult[]): { text: string; structuredContent: any } {
  const structuredContent = { weatherPipeline: weatherResults };

  const shaped = shapeWeatherResults(weatherResults, 15);
  const grouped = groupByProvince(shaped);

  const provinces = Array.from(grouped.keys());
  if (provinces.length === 0) {
    return { text: "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้", structuredContent };
  }

  const tw = timeWindowLabel(userText);
  const header = `ช่วงเวลา: ${tw.label} (${tw.date})`;
  const blocks = provinces.map((p) => renderOneProvince(userText, p, grouped.get(p) || []));
  return { text: [header, ...blocks].join("\n"), structuredContent };
}

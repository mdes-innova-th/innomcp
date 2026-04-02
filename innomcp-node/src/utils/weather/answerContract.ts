import { shapeWeatherResults, firstNonEmptyString, normalizeProvinceDisplayName, toNumberOrNull } from "./shaping";
import { WeatherResult } from "./types";

const PROVINCE_DISTRICT_HINTS: Record<string, string[]> = {
  "เชียงใหม่": ["เมืองเชียงใหม่", "แม่ริม", "สันทราย"],
  "กรุงเทพมหานคร": ["จตุจักร", "ลาดกระบัง", "ดอนเมือง"],
  "นครราชสีมา": ["เมืองนครราชสีมา", "ปากช่อง", "สูงเนิน"],
  "ขอนแก่น": ["เมืองขอนแก่น", "ชุมแพ", "บ้านไผ่"],
  "ภูเก็ต": ["เมืองภูเก็ต", "กะทู้", "ถลาง"],
};

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

// Wind direction degrees → Thai cardinal (snap 45°)
const WIND_DIR: Record<string, string> = {
  "0": "เหนือ",
  "360": "เหนือ",
  "45": "ตะวันออกเฉียงเหนือ",
  "90": "ตะวันออก",
  "135": "ตะวันออกเฉียงใต้",
  "180": "ใต้",
  "225": "ตะวันตกเฉียงใต้",
  "270": "ตะวันตก",
  "315": "ตะวันตกเฉียงเหนือ",
};

function windDirLabel(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  const snapped = Math.round(n / 45) * 45;
  return WIND_DIR[String(((snapped % 360) + 360) % 360)] || `${n}°`;
}

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

function isWeekMode(userText: string): boolean {
  const t = String(userText || "");
  return /7\s*วัน|๗\s*วัน|สัปดาห์|อาทิตย์นี้|อาทิตย์หน้า|weekly|week/i.test(t);
}

function timeWindowLabel(userText: string): { label: string; date: string; offset: number } {
  if (isWeekMode(userText)) {
    return { label: "พยากรณ์ 7 วัน", date: bkkDateStr(0), offset: 0 };
  }
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
  const dirRaw = firstNonEmptyString(s.WindDirection, s.WindDir, s.WindDirectionDeg, s.WindDirectionDegree);
  return { speedKmh: speed, dir: windDirLabel(dirRaw) };
}

function detectBangkokDistrict(userText: string): string | null {
  const t = String(userText || "");
  // Prefer explicit district marker first (handles multi-target texts safely).
  const m = t.match(/เขต\s*(หลักสี่|ลาดกระบัง|ดอนเมือง|จตุจักร|ปทุมวัน|บางรัก)/i);
  if (m?.[1]) return String(m[1]);
  // Must-have
  if (/หลักสี่/i.test(t)) return "หลักสี่";
  if (/ลาดกระบัง/i.test(t)) return "ลาดกระบัง";

  // Common districts (best-effort)
  if (/ดอนเมือง/i.test(t)) return "ดอนเมือง";
  if (/จตุจักร/i.test(t)) return "จตุจักร";
  if (/ปทุมวัน/i.test(t)) return "ปทุมวัน";
  if (/บางรัก/i.test(t)) return "บางรัก";
  return null;
}

function pickStationItemsForArea(userText: string, province: string, stationItems: any[]): any[] {
  if (normalizeProvinceDisplayName(province) !== "กรุงเทพมหานคร") return stationItems;
  const d = detectBangkokDistrict(userText);
  if (!d) return stationItems;

  const filtered = (Array.isArray(stationItems) ? stationItems : []).filter((s: any) => {
    const nameTh = String(s?.StationNameThai || s?.StationName || "");
    const nameEn = String(s?.StationNameEng || s?.StationNameEN || "");
    return nameTh.includes(d) || nameEn.toLowerCase().includes(d.toLowerCase());
  });
  return filtered.length > 0 ? filtered : stationItems;
}

function areaLabelForProvince(userText: string, province: string): string {
  const p = normalizeProvinceDisplayName(province);
  if (p !== "กรุงเทพมหานคร") return p;
  const d = detectBangkokDistrict(userText);
  return d ? `กรุงเทพมหานคร (${d})` : p;
}

function districtHintsForProvince(province: string): string[] {
  const p = normalizeProvinceDisplayName(province);
  return PROVINCE_DISTRICT_HINTS[p] || [];
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

function classifyErrorCode(err: string): "TIMEOUT" | "UPSTREAM" | "NO_DATA" | "PROVINCE_MISSING" {
  const e = String(err || "");
  if (e === "PROVINCE_MISSING") return "PROVINCE_MISSING";
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

  const kind: "TIMEOUT" | "UPSTREAM" | "NO_DATA" | "PROVINCE_MISSING" =
    priority.includes("TIMEOUT") ? "TIMEOUT" :
    priority.includes("PROVINCE_MISSING") ? "PROVINCE_MISSING" :
    priority.includes("UPSTREAM") ? "UPSTREAM" :
    "NO_DATA";

  const msg = (() => {
    switch (kind) {
      case "TIMEOUT":
        return `ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา กรุณาลองถามใหม่อีกครั้งครับ`;
      case "PROVINCE_MISSING":
        return "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการครับ (เช่น พรุ่งนี้เชียงใหม่ฝนตกไหม)";
      case "UPSTREAM":
        return `ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองถามใหม่อีกครั้งครับ`;
      case "NO_DATA":
      default:
        return `ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ ลองถามใหม่อีกครั้งครับ`;
    }
  })();

  // Concise error message instead of dumping placeholder fields
  const lines = [
    `**${province}**: ${msg}`,
  ];

  const districtHints = districtHintsForProvince(province);
  if (districtHints.length > 0) {
    lines.push(`อำเภอที่ควรติดตาม: ${districtHints.join(", ")}`);
  }

  return lines.join("\n");
}

// ─── Weekly (7-day) Rendering ───

function formatDateThai(dateStr: string): string {
  // Input: "DD/MM/YYYY" → "วัน DD/MM"
  const parts = dateStr.split("/");
  if (parts.length < 3) return dateStr;
  const [dd, mm] = parts;
  const dayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
  const y = parseInt(parts[2], 10);
  const m = parseInt(mm, 10) - 1;
  const d = parseInt(dd, 10);
  const dateObj = new Date(y, m, d);
  const dayName = dayNames[dateObj.getDay()] || "";
  return `${dayName} ${dd}/${mm}`;
}

function renderWeeklyProvince(userText: string, province: string, items: WeatherResult[]): string {
  const shaped = shapeWeatherResults(items, 10);

  if (!shaped.some((r) => r && r.type !== "error")) {
    return renderErrorOnlyProvince(province, shaped);
  }

  const forecast = shaped.find((r) => r.type === "forecast7d" && r.data && typeof r.data === "object");
  const forecastBlock = forecast?.data?.forecast;
  const forecastTime = firstNonEmptyString(forecast?.data?.lastBuildDate, forecastBlock?.LastBuildDate);

  if (!forecastBlock || !Array.isArray(forecastBlock.ForecastDate) || forecastBlock.ForecastDate.length === 0) {
    // No multi-day data available, fall back to single-day render
    return renderOneProvince(userText, province, items);
  }

  const dates: string[] = forecastBlock.ForecastDate;
  const rainPcts: string[] = forecastBlock.PercentRainCover || [];
  const maxTemps: string[] = forecastBlock.MaximumTemperature || [];
  const minTemps: string[] = forecastBlock.MinimumTemperature || [];
  const descs: string[] = forecastBlock.DescriptionThai || [];
  const windSpeeds: string[] = forecastBlock.WindSpeed || [];
  const windDirs: string[] = forecastBlock.WindDirection || [];

  // Sort indices by date ascending (TMD returns future-first)
  const indices = Array.from({ length: dates.length }, (_, i) => i);
  indices.sort((a, b) => {
    const toIso = (d: string) => {
      const p = d.split("/");
      return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
    };
    return toIso(dates[a]).localeCompare(toIso(dates[b]));
  });

  const lines: string[] = [];
  lines.push(`พื้นที่: ${areaLabelForProvince(userText, province)}`);
  if (forecastTime) lines.push(`เวลาอัปเดตข้อมูล: ${forecastTime}`);
  lines.push("");

  // Detect which query focus: rain question?
  const isRainQuestion = /ฝน|rain/i.test(userText || "");

  let rainyDays = 0;
  let clearDays = 0;

  for (const i of indices) {
    const dateLabel = formatDateThai(dates[i]);
    const rain = toNumberOrNull(rainPcts[i]);
    const tempRange = fmtTempRange(minTemps[i], maxTemps[i]);
    const desc = descs[i] || "";
    const windSpd = toNumberOrNull(windSpeeds[i]);
    const windDir = windDirLabel(windDirs[i] || "");
    const windText = fmtWind(windSpd, windDir);

    const rainIcon = rain !== null ? (rain >= 60 ? "🌧️" : rain >= 30 ? "🌦️" : rain > 0 ? "⛅" : "☀️") : "❓";
    const rainText = rain !== null ? `${rain}%` : "—";

    if (rain !== null && rain >= 30) rainyDays++;
    if (rain !== null && rain < 10) clearDays++;

    lines.push(`${rainIcon} ${dateLabel}: ฝน ${rainText} | ${tempRange} | ${desc}${windText ? ` | ลม ${windText}` : ""}`);
  }

  lines.push("");

  // Summary answering the user's question
  if (isRainQuestion) {
    const rainyDaysList = indices
      .filter((i) => {
        const r = toNumberOrNull(rainPcts[i]);
        return r !== null && r >= 30;
      })
      .map((i) => formatDateThai(dates[i]));

    if (rainyDaysList.length > 0) {
      lines.push(`📋 สรุป: วันที่มีโอกาสฝนตก (≥30%): ${rainyDaysList.join(", ")}`);
    } else {
      lines.push(`📋 สรุป: สัปดาห์นี้โอกาสฝนตกน้อยทุกวัน`);
    }
  } else {
    lines.push(`📋 สรุป: วันที่ฝนตกได้ ${rainyDays} วัน, แดดดี ${clearDays} วัน จาก ${indices.length} วัน`);
  }

  const districtHints = districtHintsForProvince(province);
  if (districtHints.length > 0) {
    lines.push(`อำเภอที่ควรติดตาม: ${districtHints.join(", ")}`);
  }

  return lines.join("\n");
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
  const stationItemsArea = pickStationItemsForArea(userText, province, stationItems);
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
    dir: windDirLabel(firstNonEmptyString(forecastBlock?.WindDirection?.[dayIdx])),
  };

  const stationWind = pickStationWind(stationItemsArea);

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

  const obsTime = pickStationUpdateTime(stationItemsArea);
  const forecastTime = firstNonEmptyString(forecast?.data?.lastBuildDate, forecastBlock?.LastBuildDate);

  const tempFallback = (() => {
    const t = pickStationTempC(stationItemsArea);
    return t !== null ? `${t}°C` : "";
  })();

  const tempText = tempRange ? tempRange : tempFallback;

  const rainText = rainPct !== null ? `${rainPct}%` : "ยังไม่มีข้อมูล";
  const windText = (() => {
    const w = fmtWind(wind.speedKmh, wind.dir);
    return w ? w : "ยังไม่มีข้อมูล";
  })();
  const tempOut = tempText ? tempText : "ยังไม่มีข้อมูล";

  const timeRisk = (() => {
    if (isTodayRainQuestion(userText)) {
      const obs = obsTime || "ยังไม่มีข้อมูล";
      const fc = forecastTime || "ยังไม่มีข้อมูล";
      return `เช้า: สังเกตการณ์ล่าสุด (${obs}) | บ่าย-เย็น: พยากรณ์วันนี้ (${fc})`;
    }
    return "ยังไม่มีข้อมูลช่วงเวลา (มีเฉพาะรายวัน)";
  })();

  const advice = (() => {
    const tips: string[] = [];
    if (rainPct !== null) {
      if (rainPct >= 60) tips.push("ระวังฝนและถนนลื่น");
      else if (rainPct >= 30) tips.push("อาจมีฝนประปราย");
    }
    if (wind.speedKmh !== null && wind.speedKmh >= 40) tips.push("ระวังลมแรง");

    if (tips.length > 0) return tips.join(" | ");
    if (rainPct === null && wind.speedKmh === null) return "ยังไม่มีข้อมูลคำเตือน";
    return "ไม่มีคำเตือนพิเศษ";
  })();

  const updateTimeStr = firstNonEmptyString(obsTime, forecastTime);

  const lines: string[] = [];
  lines.push(`พื้นที่: ${areaLabelForProvince(userText, province)}`);

  // Phase 12: If ALL data fields are placeholders, collapse to a single concise message
  const allPlaceholder = rainText === "ยังไม่มีข้อมูล" && tempOut === "ยังไม่มีข้อมูล" && windText === "ยังไม่มีข้อมูล";
  if (allPlaceholder) {
    lines.push(`ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ ลองถามใหม่อีกครั้งครับ`);
    const districtHints = districtHintsForProvince(province);
    if (districtHints.length > 0) {
      lines.push(`อำเภอที่ควรติดตาม: ${districtHints.join(", ")}`);
    }
    return lines.join("\n");
  }

  // Keep update time early (2nd line) so trace sanitizer 220-char truncation never drops it.
  if (updateTimeStr) lines.push(`เวลาอัปเดตข้อมูล: ${updateTimeStr}`);
  lines.push(`โอกาสฝน: ${rainText}`);
  lines.push(`ช่วงเวลาเสี่ยง: ${timeRisk}`);
  lines.push(`อุณหภูมิ: ${tempOut}`);
  lines.push(`ลม: ${windText}`);
  lines.push(`ข้อควรระวัง: ${advice}`);

  const districtHints = districtHintsForProvince(province);
  if (districtHints.length > 0) {
    lines.push(`อำเภอที่ควรติดตาม: ${districtHints.join(", ")}`);
  }

  return lines.join("\n");
}

// ─── Multi-Province Weekly Table (cross-province rain% comparison) ───

function renderMultiProvinceWeekTable(
  userText: string,
  grouped: Map<string, WeatherResult[]>
): string {
  interface ProvinceForecast { province: string; dates: string[]; rains: (number | null)[] }
  const forecasts: ProvinceForecast[] = [];

  for (const [province, items] of grouped) {
    const shaped = shapeWeatherResults(items, 10);
    const fc = shaped.find((r) => r.type === "forecast7d" && r.data && typeof r.data === "object");
    const block = fc?.data?.forecast;
    if (!block || !Array.isArray(block.ForecastDate) || block.ForecastDate.length === 0) continue;

    const dates: string[] = block.ForecastDate;
    const rainPcts: string[] = block.PercentRainCover || [];
    const indices = Array.from({ length: dates.length }, (_, i) => i);
    indices.sort((a, b) => {
      const toIso = (d: string) => { const p = d.split("/"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
      return toIso(dates[a]).localeCompare(toIso(dates[b]));
    });
    forecasts.push({
      province,
      dates: indices.map((i) => dates[i]),
      rains: indices.map((i) => toNumberOrNull(rainPcts[i])),
    });
  }

  if (forecasts.length === 0) return "";

  const refDates = forecasts[0].dates;
  const headers = ["จังหวัด", ...refDates.map(formatDateThai)];
  const rows: string[][] = forecasts.map((pf) =>
    [
      pf.province,
      ...refDates.map((d) => {
        const idx = pf.dates.indexOf(d);
        if (idx < 0) return "—";
        const r = pf.rains[idx];
        return r !== null ? `${r}%` : "—";
      }),
    ]
  );

  const headerLine = `| ${headers.join(" | ")} |`;
  const sepLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map((r) => `| ${r.join(" | ")} |`);
  return [headerLine, sepLine, ...rowLines].join("\n");
}

export function renderWeatherContractAnswer(userText: string, weatherResults: WeatherResult[]): { text: string; structuredContent: any } {
  const structuredContent = { weatherPipeline: weatherResults };

  const shaped = shapeWeatherResults(weatherResults, 15);

  const grouped = groupByProvince(shaped);
  const provinces = Array.from(grouped.keys());

  // Global all-error case (including province=""), keep operator-grade + deterministic token.
  if (!shaped.some((r) => r && r.type !== "error")) {
    // If we still have explicit provinces, render per-province blocks (required for UX correctness).
    if (provinces.length > 0) {
      const tw = timeWindowLabel(userText);
      const header = `ช่วงเวลา: ${tw.label} (${tw.date})`;
      const blocks = provinces.map((p) => renderErrorOnlyProvince(p, grouped.get(p) || []));
      return { text: [header, ...blocks].join("\n\n"), structuredContent };
    }

    const errs = shaped.filter((r) => r && r.type === "error").map((r) => String(r.error || ""));
    const kinds = errs.map(classifyErrorCode);
    const kind: "TIMEOUT" | "UPSTREAM" | "NO_DATA" | "PROVINCE_MISSING" =
      kinds.includes("TIMEOUT") ? "TIMEOUT" :
      kinds.includes("PROVINCE_MISSING") ? "PROVINCE_MISSING" :
      kinds.includes("UPSTREAM") ? "UPSTREAM" :
      "NO_DATA";

    const text = (() => {
      switch (kind) {
        case "TIMEOUT":
          return "ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา กรุณาลองถามใหม่อีกครั้งครับ";
        case "PROVINCE_MISSING":
          return "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการครับ (เช่น พรุ่งนี้เชียงใหม่ฝนตกไหม)";
        case "UPSTREAM":
          return "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองถามใหม่อีกครั้งครับ";
        case "NO_DATA":
        default:
          if (errs.includes("NATIONAL_DATA_UNAVAILABLE")) {
            return "ขออภัย ยังไม่มีข้อมูลอากาศทั่วประเทศในขณะนี้ ลองระบุจังหวัดที่ต้องการครับ";
          }
          return "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ ลองถามใหม่อีกครั้งครับ";
      }
    })();

    return { text, structuredContent };
  }
  if (provinces.length === 0) {
    return { text: "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ ลองถามใหม่อีกครั้งครับ", structuredContent };
  }

  const tw = timeWindowLabel(userText);
  const header = `ช่วงเวลา: ${tw.label} (${tw.date})`;
  const weekMode = isWeekMode(userText);
  const wantTable = /ตาราง/i.test(userText || "");

  // Multi-province weekly table: "สัปดาห์นี้...ตาราง" with 2+ provinces → cross-province comparison table
  if (weekMode && wantTable && provinces.length > 1) {
    const table = renderMultiProvinceWeekTable(userText, grouped);
    if (table) {
      const isRainQuestion = /ฝน|rain/i.test(userText || "");
      const caption = isRainQuestion
        ? "โอกาสฝนตก (%) สัปดาห์นี้ แยกตามจังหวัด"
        : "พยากรณ์อากาศสัปดาห์นี้ แยกตามจังหวัด";
      return { text: [header, caption, table].join("\n\n"), structuredContent };
    }
  }

  const blocks = provinces.map((p) =>
    weekMode
      ? renderWeeklyProvince(userText, p, grouped.get(p) || [])
      : renderOneProvince(userText, p, grouped.get(p) || [])
  );
  return { text: [header, ...blocks].join("\n\n"), structuredContent };
}

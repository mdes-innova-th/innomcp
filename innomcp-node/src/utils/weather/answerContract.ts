import { shapeWeatherResults, firstNonEmptyString, normalizeProvinceDisplayName, toNumberOrNull } from "./shaping";
import { WeatherResult } from "./types";
import { getLocationDisplayLabel, isDistrictLevel } from "../locationResolver";

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
  if (/เมื่อวาน(?:นี้)?/i.test(t)) return -1;
  if (/วันนี้|ตอนนี้|ขณะนี้/i.test(t)) return 0;
  if (/พรุ่งนี้/i.test(t)) return 1;
  if (/มะรืน/i.test(t)) return 2;

  const m = t.match(/อีก\s*(\d+|[๐-๙]+)\s*วัน/i);
  if (m?.[1]) {
    const n = Number(thaiDigitsToArabic(m[1]));
    if (Number.isFinite(n) && n >= 0) return Math.min(n, 14);
  }

  // Day-of-week names → compute offset from today (BKK timezone)
  const dayMap: Record<string, number> = {
    "อาทิตย์": 0, "จันทร์": 1, "อังคาร": 2, "พุธ": 3,
    "พฤหัส": 4, "พฤหัสบดี": 4, "ศุกร์": 5, "เสาร์": 6,
  };
  const dayMatch = t.match(/วัน(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)|(?:^|\s)(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)\s*(?:นี้|หน้า|ที่จะถึง)?/i);
  if (dayMatch) {
    const dayName = (dayMatch[1] || dayMatch[2] || "").trim();
    const targetDay = dayMap[dayName];
    if (targetDay !== undefined) {
      const now = new Date();
      const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
      const bkk = new Date(bkkMs);
      const today = bkk.getUTCDay();
      let diff = targetDay - today;
      if (diff <= 0) diff += 7; // next occurrence
      return Math.min(diff, 14);
    }
  }

  return 0;
}

function parseDaypart(text: string): string | null {
  const t = String(text || "");
  if (/ตอนเช้า|ช่วงเช้า|เช้า(?:มืด)?(?:ถึง|จนถึง|ถึงสาย)/i.test(t)) return "เช้า";
  if (/ตอนสาย|ช่วงสาย/i.test(t)) return "สาย";
  if (/บ่าย(?:ถึง|จนถึง)\s*ค่ำ/i.test(t)) return "บ่ายถึงค่ำ";
  if (/ตอนบ่าย|ช่วงบ่าย|บ่าย/i.test(t)) return "บ่าย";
  if (/ตอนเย็น|ช่วงเย็น|เย็น/i.test(t)) return "เย็น";
  if (/ตอนค่ำ|ช่วงค่ำ|ค่ำ/i.test(t)) return "ค่ำ";
  if (/กลางคืน|ตอนดึก|ดึก/i.test(t)) return "กลางคืน";
  if (/ตอนเช้า|เช้า/i.test(t)) return "เช้า";
  return null;
}

function isWeekMode(userText: string): boolean {
  const t = String(userText || "");
  return /7\s*วัน|๗\s*วัน|สัปดาห์|อาทิตย์นี้|อาทิตย์หน้า|weekly|week/i.test(t);
}

function timeWindowLabel(userText: string): { label: string; date: string; offset: number; daypart: string | null } {
  const daypart = parseDaypart(userText);
  if (isWeekMode(userText)) {
    return { label: "พยากรณ์ 7 วัน", date: bkkDateStr(0), offset: 0, daypart };
  }
  const offset = parseDayOffset(userText);
  const dayLabel = offset === -1 ? "เมื่อวาน" : offset === 0 ? "วันนี้" : offset === 1 ? "พรุ่งนี้" : offset === 2 ? "มะรืน" : `อีก ${offset} วัน`;
  const label = daypart ? `${dayLabel} (${daypart})` : dayLabel;
  return { label, date: bkkDateStr(offset), offset, daypart };
}

function isTodayRainQuestion(text: string): boolean {
  const t = String(text || "");
  return /วันนี้/i.test(t) && /(ฝนตกไหม|ฝนจะตก|ฝนตกช่วงไหน|ฝน\s*ตก)/i.test(t);
}

function isTemperatureQuestion(text: string): boolean {
  const t = String(text || "");
  return /อุณหภูมิ|สูงสุด.*ต่ำสุด|ต่ำสุด.*สูงสุด|ร้อนสุด|หนาวสุด|กี่องศา|temp.*max|temp.*min|max.*temp|min.*temp/i.test(t);
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
  // Check if user text contains a district/alias name that resolved to this province
  const aliasMatch = findAliasInUserText(userText, p);
  if (aliasMatch) return aliasMatch;
  if (p !== "กรุงเทพมหานคร") return p;
  const d = detectBangkokDistrict(userText);
  return d ? `กรุงเทพมหานคร (${d})` : p;
}

/** Detect if user text contains a known alias/district that resolved to the given province */
function findAliasInUserText(userText: string, province: string): string | null {
  const t = String(userText || "");
  // Known district-level aliases that differ from province name
  const DISTRICT_ALIASES: Record<string, string[]> = {
    "สมุทรสงคราม": ["อัมพวา", "แม่กลอง"],
    "สมุทรสาคร": ["มหาชัย", "กระทุ่มแบน"],
    "สงขลา": ["หาดใหญ่", "สะเดา"],
    "ชลบุรี": ["พัทยา", "เกาะล้าน"],
    "นครราชสีมา": ["ปากช่อง", "เขาใหญ่", "วังน้ำเขียว"],
    "เชียงราย": ["แม่สาย", "เชียงแสน"],
    "ตาก": ["แม่สอด"],
    "ยะลา": ["เบตง"],
    "สุราษฎร์ธานี": ["เกาะสมุย", "สมุย", "เกาะพะงัน", "เกาะเต่า"],
    "ระยอง": ["เกาะเสม็ด"],
    "ตราด": ["เกาะช้าง"],
    "แม่ฮ่องสอน": ["ปาย"],
    "นราธิวาส": ["สุไหงโก-ลก"],
  };
  const aliases = DISTRICT_ALIASES[province];
  if (!aliases) return null;
  for (const alias of aliases) {
    if (t.includes(alias)) {
      return `${province} (${alias})`;
    }
  }
  return null;
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

function classifyErrorCode(err: string): "TIMEOUT" | "UPSTREAM" | "NO_DATA" | "PROVINCE_MISSING" | "MONTHLY_NOT_SUPPORTED" | "YESTERDAY_NOT_SUPPORTED" {
  const e = String(err || "");
  if (e === "MONTHLY_NOT_SUPPORTED") return "MONTHLY_NOT_SUPPORTED";
  if (e === "YESTERDAY_NOT_SUPPORTED") return "YESTERDAY_NOT_SUPPORTED";
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

  const kind: "TIMEOUT" | "UPSTREAM" | "NO_DATA" | "PROVINCE_MISSING" | "MONTHLY_NOT_SUPPORTED" | "YESTERDAY_NOT_SUPPORTED" =
    priority.includes("YESTERDAY_NOT_SUPPORTED") ? "YESTERDAY_NOT_SUPPORTED" :
    priority.includes("MONTHLY_NOT_SUPPORTED") ? "MONTHLY_NOT_SUPPORTED" :
    priority.includes("TIMEOUT") ? "TIMEOUT" :
    priority.includes("PROVINCE_MISSING") ? "PROVINCE_MISSING" :
    priority.includes("UPSTREAM") ? "UPSTREAM" :
    "NO_DATA";

  const msg = (() => {
    switch (kind) {
      case "YESTERDAY_NOT_SUPPORTED":
        return `ขออภัย ระบบพยากรณ์อากาศรองรับเฉพาะข้อมูลปัจจุบันและพยากรณ์ล่วงหน้า (วันนี้/พรุ่งนี้/7 วัน) — ยังไม่รองรับข้อมูลย้อนหลัง (เมื่อวาน) ครับ`;
      case "MONTHLY_NOT_SUPPORTED":
        return `ขออภัย ระบบพยากรณ์อากาศรองรับเฉพาะข้อมูลรายวัน (วันนี้/พรุ่งนี้/7 วัน) — ยังไม่รองรับข้อมูลรายเดือนหรือสรุปย้อนหลังเป็นเดือนครับ`;
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
  const toIsoDate = (d: string) => {
    const p = d.split("/");
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
  };
  const allIndices = Array.from({ length: dates.length }, (_, i) => i);
  allIndices.sort((a, b) => toIsoDate(dates[a]).localeCompare(toIsoDate(dates[b])));

  // Filter out past dates (before today BKK time)
  const todayStr = bkkDateStr(0);
  const todayIso = toIsoDate(todayStr);
  const indices = allIndices.filter((i) => toIsoDate(dates[i]) >= todayIso);
  // Fallback: if all filtered out, keep all (shouldn't happen normally)
  if (indices.length === 0) indices.push(...allIndices);

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
      if (rainPct !== null && rainPct >= 60) return "ช่วงบ่ายถึงค่ำ ฝนตกหนักได้";
      if (rainPct !== null && rainPct >= 30) return "อาจมีฝนช่วงบ่ายถึงเย็น";
      if (rainPct !== null && rainPct > 0) return "โอกาสฝนน้อยตลอดวัน";
      return "แดดจัดตลอดวัน";
    }
    return "พยากรณ์รายวัน";
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

  // Build natural opening sentence
  const naturalSummary = (() => {
    const area = areaLabelForProvince(userText, province);
    const parts: string[] = [];
    const isTempQ = isTemperatureQuestion(userText);
    if (isTempQ && tempText) {
      parts.push(`อุณหภูมิ ${tempText}`);
    }
    if (rainPct !== null) {
      if (rainPct >= 60) parts.push("มีฝนตกหนัก");
      else if (rainPct >= 30) parts.push("มีโอกาสฝนตก");
      else if (rainPct > 0) parts.push("โอกาสฝนน้อย");
      else parts.push("อากาศดี ฟ้าใส");
    }
    if (!isTempQ && tempText) parts.push(`อุณหภูมิ ${tempText}`);
    return parts.length > 0 ? `📍 ${area} — ${parts.join(" ")}` : `📍 ${area}`;
  })();

  const lines: string[] = [];
  lines.push(`พื้นที่: ${areaLabelForProvince(userText, province)}`);
  lines.push(naturalSummary);

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
  if (isTemperatureQuestion(userText)) {
    lines.push(`อุณหภูมิ: ${tempOut}`);
    lines.push(`โอกาสฝน: ${rainText}`);
  } else {
    lines.push(`โอกาสฝน: ${rainText}`);
    lines.push(`ช่วงเวลาเสี่ยง: ${timeRisk}`);
    lines.push(`อุณหภูมิ: ${tempOut}`);
  }
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
    const toIso = (d: string) => { const p = d.split("/"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
    const allIdx = Array.from({ length: dates.length }, (_, i) => i);
    allIdx.sort((a, b) => toIso(dates[a]).localeCompare(toIso(dates[b])));
    // Filter out past dates
    const todayIso = toIso(bkkDateStr(0));
    const indices = allIdx.filter((i) => toIso(dates[i]) >= todayIso);
    if (indices.length === 0) indices.push(...allIdx);
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
    // If we still have explicit provinces but ALL are error, collapse into a single clean message
    if (provinces.length > 0) {
      const tw = timeWindowLabel(userText);
      const header = `ช่วงเวลา: ${tw.label} (${tw.date})`;
      // Classify the dominant error
      const allErrs = shaped.filter((r) => r && r.type === "error").map((r) => String(r.error || ""));
      const allKinds = allErrs.map(classifyErrorCode);
      const dominantKind = allKinds.includes("YESTERDAY_NOT_SUPPORTED") ? "YESTERDAY_NOT_SUPPORTED" : allKinds.includes("MONTHLY_NOT_SUPPORTED") ? "MONTHLY_NOT_SUPPORTED" : allKinds.includes("TIMEOUT") ? "TIMEOUT" : allKinds.includes("UPSTREAM") ? "UPSTREAM" : "NO_DATA";
      const provList = provinces.join(", ");
      const msg = dominantKind === "YESTERDAY_NOT_SUPPORTED"
        ? `ขออภัย ระบบพยากรณ์อากาศรองรับเฉพาะข้อมูลปัจจุบันและพยากรณ์ล่วงหน้า (วันนี้/พรุ่งนี้/7 วัน) — ยังไม่รองรับข้อมูลย้อนหลัง (เมื่อวาน) ครับ`
        : dominantKind === "MONTHLY_NOT_SUPPORTED"
        ? `ขออภัย ระบบพยากรณ์อากาศรองรับเฉพาะข้อมูลรายวัน (วันนี้/พรุ่งนี้/7 วัน) — ยังไม่รองรับข้อมูลรายเดือนหรือสรุปย้อนหลังเป็นเดือนครับ`
        : dominantKind === "TIMEOUT"
        ? `ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา (${provList}) กรุณาลองถามใหม่อีกครั้งครับ`
        : dominantKind === "UPSTREAM"
        ? `ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง (${provList}) กรุณาลองถามใหม่อีกครั้งครับ`
        : tw.daypart
        ? `ขออภัย ยังไม่มีข้อมูลอากาศรายช่วงเวลา (${tw.daypart}) สำหรับ ${provList} — ระบบมีเฉพาะพยากรณ์รายวัน ลองถามแบบ "${tw.label.replace(/ *\(.*\)/, "")} ${provList} อากาศเป็นอย่างไร" ครับ`
        : `ขออภัย ยังไม่มีข้อมูลอากาศสำหรับ ${provList} ในขณะนี้ กรุณาลองถามใหม่ภายหลังครับ`;
      return { text: [header, msg].join("\n\n"), structuredContent };
    }

    const errs = shaped.filter((r) => r && r.type === "error").map((r) => String(r.error || ""));
    const kinds = errs.map(classifyErrorCode);
    const kind: "TIMEOUT" | "UPSTREAM" | "NO_DATA" | "PROVINCE_MISSING" =
      kinds.includes("TIMEOUT") ? "TIMEOUT" :
      kinds.includes("PROVINCE_MISSING") ? "PROVINCE_MISSING" :
      kinds.includes("UPSTREAM") ? "UPSTREAM" :
      "NO_DATA";

    const text = (() => {
      const daypart = parseDaypart(userText);
      const daypartNote = daypart ? ` (ช่วง${daypart}) — ระบบมีเฉพาะพยากรณ์รายวัน` : "";
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
            return daypart
              ? `ขออภัย ยังไม่มีข้อมูลอากาศรายช่วงเวลา${daypartNote} — ลองระบุจังหวัดที่ต้องการครับ`
              : "ขออภัย ยังไม่มีข้อมูลอากาศทั่วประเทศในขณะนี้ ลองระบุจังหวัดที่ต้องการครับ";
          }
          return `ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้${daypartNote} ลองถามใหม่อีกครั้งครับ`;
      }
    })();

    return { text, structuredContent };
  }
  if (provinces.length === 0) {
    return { text: "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ ลองถามใหม่อีกครั้งครับ", structuredContent };
  }

  const tw = timeWindowLabel(userText);
  const daypartCaveat = tw.daypart ? `\n(หมายเหตุ: ข้อมูลเป็นพยากรณ์รายวัน — ยังไม่รองรับการกรองเฉพาะช่วง "${tw.daypart}")` : "";
  const header = `ช่วงเวลา: ${tw.label} (${tw.date})${daypartCaveat}`;
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

  // Regional summary for multi-province queries (e.g., "ภาคกลาง", "ภาคเหนือ")
  if (provinces.length > 1 && !weekMode) {
    const regionSummary = buildRegionalSummary(userText, grouped);
    if (regionSummary) {
      return { text: [header, regionSummary, ...blocks].join("\n\n"), structuredContent };
    }
  }

  return { text: [header, ...blocks].join("\n\n"), structuredContent };
}

/** Build a 1-2 line summary for multi-province regional queries */
function buildRegionalSummary(userText: string, grouped: Map<string, WeatherResult[]>): string | null {
  // Detect region name from user text
  const regionMatch = (userText || "").match(/ภาค(ตะวันออกเฉียงเหนือ|กลาง|เหนือ|ใต้|ตะวันออก|ตะวันตก|อีสาน)/);
  if (!regionMatch && grouped.size <= 1) return null;

  const regionName = regionMatch ? `ภาค${regionMatch[1]}` : "";
  const provinces = Array.from(grouped.keys());
  const rainPcts: number[] = [];
  let minTemp = Infinity;
  let maxTemp = -Infinity;

  for (const [, items] of grouped) {
    const shaped = shapeWeatherResults(items, 10);
    const fc = shaped.find((r) => r.type === "forecast7d" && r.data && typeof r.data === "object");
    const block = fc?.data?.forecast;
    if (!block) continue;
    const offset = parseDayOffset(userText);
    const dayIdx = pickForecastDayIndex(block, offset);
    const rain = toNumberOrNull(block.PercentRainCover?.[dayIdx]);
    if (rain !== null) rainPcts.push(rain);
    const lo = toNumberOrNull(block.MinimumTemperature?.[dayIdx]);
    const hi = toNumberOrNull(block.MaximumTemperature?.[dayIdx]);
    if (lo !== null && lo < minTemp) minTemp = lo;
    if (hi !== null && hi > maxTemp) maxTemp = hi;
  }

  if (rainPcts.length === 0) return null;

  const avgRain = Math.round(rainPcts.reduce((a, b) => a + b, 0) / rainPcts.length);
  const maxRainProv = (() => {
    let best = { prov: "", rain: -1 };
    for (const [prov, items] of grouped) {
      const shaped = shapeWeatherResults(items, 10);
      const fc = shaped.find((r) => r.type === "forecast7d" && r.data && typeof r.data === "object");
      const block = fc?.data?.forecast;
      if (!block) continue;
      const offset = parseDayOffset(userText);
      const dayIdx = pickForecastDayIndex(block, offset);
      const rain = toNumberOrNull(block.PercentRainCover?.[dayIdx]);
      if (rain !== null && rain > best.rain) best = { prov, rain };
    }
    return best.prov ? `${best.prov} (${best.rain}%)` : "";
  })();

  const tempStr = (minTemp < Infinity && maxTemp > -Infinity) ? ` อุณหภูมิ ${minTemp}–${maxTemp}°C` : "";
  const label = regionName || `${provinces.length} จังหวัด`;
  const rainDesc = avgRain >= 60 ? "มีฝนตกหนัก" : avgRain >= 30 ? "มีโอกาสฝนตก" : "โอกาสฝนน้อย";

  return `📊 สรุป${label}: ${rainDesc} เฉลี่ย ${avgRain}%${tempStr}\nจังหวัดที่ฝนมากสุด: ${maxRainProv}`;
}

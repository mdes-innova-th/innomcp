import { WeatherResult } from "./types";

type SourceKind = "station" | "forecast" | "nwp" | "national";

export interface WeatherAreaPayload {
  area: string;
  rainChancePct: number | null;
  temperature: string;
  wind: string;
  updateTime: string;
  summary: string;
  sourcesUsed: SourceKind[];
  confidence: number;
}

export interface WeatherMapTile {
  area: string;
  label: string;
  url: string;
}

export interface WeatherPayloadContract {
  version: "10.1";
  generatedAt: string;
  sourcesUsed: SourceKind[];
  confidence: number;
  errTaxonomy: {
    timeout: number;
    noData: number;
    upstream: number;
    provinceMissing: number;
  };
  areas: WeatherAreaPayload[];
  mapTiles: WeatherMapTile[];
}

function asNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickFirstString(...vals: any[]): string {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function normalizeType(t: string): SourceKind | null {
  if (t === "station3h") return "station";
  if (t === "forecast7d") return "forecast";
  if (t === "nwp") return "nwp";
  if (t === "national") return "national";
  return null;
}

function classifyError(err: string): "timeout" | "noData" | "upstream" | "provinceMissing" {
  const e = String(err || "");
  if (e === "PROVINCE_MISSING") return "provinceMissing";
  if (e === "TIMEOUT" || e === "BUDGET_EXCEEDED") return "timeout";
  if (
    e === "STATION_NOT_FOUND" ||
    e === "PROVINCE_NOT_FOUND_IN_FORECAST" ||
    e === "DATA_UNAVAILABLE" ||
    e === "STATION_SKIPPED" ||
    e === "NWP_UNAVAILABLE" ||
    e === "NATIONAL_DATA_UNAVAILABLE"
  ) {
    return "noData";
  }
  return "upstream";
}

function confidenceBySources(sources: SourceKind[]): number {
  if (sources.length >= 3) return 0.95;
  if (sources.length === 2) return 0.85;
  if (sources.length === 1) return 0.7;
  return 0.4;
}

export function buildWeatherPayloadContract(results: WeatherResult[]): WeatherPayloadContract {
  const srcSet = new Set<SourceKind>();
  const byProvince = new Map<string, WeatherResult[]>();
  const nationalRows: Array<{
    province: string;
    percentRain: number;
    tempMax: number | null;
    tempMin: number | null;
    windSpeed: number | null;
    windDir: string | null;
    desc: string | null;
  }> = [];

  const errTaxonomy = {
    timeout: 0,
    noData: 0,
    upstream: 0,
    provinceMissing: 0,
  };

  for (const r of results || []) {
    if (!r || !r.province) continue;
    const arr = byProvince.get(r.province) || [];
    arr.push(r);
    byProvince.set(r.province, arr);

    if (r.type === "error") {
      const k = classifyError(String(r.error || ""));
      errTaxonomy[k] += 1;
      continue;
    }

    if (r.type === "national") {
      const rows = Array.isArray((r as any)?.data?.rows) ? (r as any).data.rows : [];
      for (const row of rows) {
        const province = String(row?.province || "").trim();
        if (!province) continue;
        nationalRows.push({
          province,
          percentRain: Number(row?.percentRain ?? 0) || 0,
          tempMax: asNum(row?.tempMax),
          tempMin: asNum(row?.tempMin),
          windSpeed: asNum(row?.windSpeed),
          windDir: row?.windDir ? String(row.windDir) : null,
          desc: row?.desc ? String(row.desc) : null,
        });
      }
    }

    const src = normalizeType(String(r.type || ""));
    if (src) srcSet.add(src);
  }

  const areas: WeatherAreaPayload[] = [];

  for (const [province, rows] of byProvince.entries()) {
    if (nationalRows.length > 0 && province === "ทั่วประเทศ") {
      continue;
    }

    const station = rows.find((r) => r.type === "station3h");
    const forecast = rows.find((r) => r.type === "forecast7d");
    const nwp = rows.find((r) => r.type === "nwp");
    const national = rows.find((r) => r.type === "national");

    const localSources: SourceKind[] = [];
    if (station) localSources.push("station");
    if (forecast) localSources.push("forecast");
    if (nwp) localSources.push("nwp");
    if (national) localSources.push("national");

    const st0: any = Array.isArray(station?.data) ? station?.data?.[0] : null;
    const fc: any = forecast?.data?.forecast || forecast?.data || null;
    const n0: any = Array.isArray((nwp as any)?.data?.forecast)
      ? (nwp as any).data.forecast[0]
      : Array.isArray((nwp as any)?.data)
      ? (nwp as any).data[0]
      : null;

    const rainChancePct =
      asNum(fc?.PercentRainCover?.[0]) ??
      asNum(fc?.percentRain?.[0]) ??
      asNum(st0?.RainProbability) ??
      null;

    const minT = asNum(fc?.MinimumTemperature?.[0]);
    const maxT = asNum(fc?.MaximumTemperature?.[0]);
    const nowT = asNum(st0?.Temperature) ?? asNum(st0?.Temp) ?? asNum(n0?.temp);

    const temperature =
      minT !== null && maxT !== null
        ? `${minT}–${maxT}°C`
        : nowT !== null
        ? `${nowT}°C`
        : "ยังไม่มีข้อมูล";

    const windSpeed =
      asNum(st0?.WindSpeed) ??
      asNum(fc?.WindSpeed?.[0]) ??
      asNum(n0?.wind) ??
      asNum(n0?.windSpeed);

    const windDir = pickFirstString(st0?.WindDirection, fc?.WindDirection?.[0], n0?.windDir, n0?.windDirection);
    const wind = windSpeed !== null ? `${windSpeed} ${windDir || ""}`.trim() : "ยังไม่มีข้อมูล";

    const updateTime = pickFirstString(
      st0?.ObservationTime,
      st0?.DateTime,
      forecast?.data?.lastBuildDate,
      fc?.LastBuildDate,
      n0?.time,
      n0?.datetime
    ) || "ยังไม่มีข้อมูล";

    const summary = pickFirstString(
      fc?.DescriptionThai?.[0],
      fc?.Description?.[0],
      n0?.description,
      n0?.weather,
      station ? "ข้อมูลสถานีล่าสุด" : "ข้อมูลพยากรณ์อากาศ"
    );

    areas.push({
      area: province,
      rainChancePct,
      temperature,
      wind,
      updateTime,
      summary,
      sourcesUsed: localSources,
      confidence: confidenceBySources(localSources),
    });
  }

  if (nationalRows.length > 0) {
    for (const row of nationalRows) {
      const tempText =
        row.tempMin !== null && row.tempMax !== null
          ? `${row.tempMin}–${row.tempMax}°C`
          : row.tempMax !== null
          ? `${row.tempMax}°C`
          : "ยังไม่มีข้อมูล";
      const windText = row.windSpeed !== null ? `${row.windSpeed} ${row.windDir || ""}`.trim() : "ยังไม่มีข้อมูล";

      areas.push({
        area: row.province,
        rainChancePct: row.percentRain,
        temperature: tempText,
        wind: windText,
        updateTime: "พยากรณ์รายวัน",
        summary: row.desc || "ข้อมูลฝนรายจังหวัด",
        sourcesUsed: ["national"],
        confidence: 0.8,
      });
    }
  }

  const sourcesUsed = Array.from(srcSet.values());
  const confidence = areas.length > 0 ? Number((areas.reduce((acc, a) => acc + a.confidence, 0) / areas.length).toFixed(2)) : 0.4;

  if (areas.length === 0) {
    const hasNationalUnavailable = (results || []).some(
      (r: any) => r && r.type === "error" && String(r.error || "") === "NATIONAL_DATA_UNAVAILABLE",
    );
    const fallbackArea = hasNationalUnavailable ? "ประเทศไทย" : "ไม่ระบุพื้นที่";

    areas.push({
      area: fallbackArea,
      rainChancePct: null,
      temperature: "ยังไม่มีข้อมูล",
      wind: "ยังไม่มีข้อมูล",
      updateTime: "ยังไม่มีข้อมูล",
      summary: "ยังไม่มีข้อมูลสภาพอากาศ",
      sourcesUsed: [],
      confidence: 0.4,
    });
  }

  const mapTiles = areas.map((a) => ({
    area: a.area,
    label: `แผนที่อากาศ ${a.area}`,
    url: `/weather-tiles/default.svg?area=${encodeURIComponent(a.area)}`,
  }));

  return {
    version: "10.1",
    generatedAt: new Date().toISOString(),
    sourcesUsed,
    confidence,
    errTaxonomy,
    areas,
    mapTiles,
  };
}

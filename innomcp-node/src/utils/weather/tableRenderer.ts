import { WeatherResponsePayload, WeatherResult } from "./types";
import {
  firstNonEmptyString,
  formatNumber,
  normalizeProvinceDisplayName,
  shapeWeatherResults,
  toNumberOrNull,
  trimArray,
} from "./shaping";

type RenderInput = WeatherResponsePayload | WeatherResult[];

function asResults(input: RenderInput): WeatherResult[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray((input as any).results)) return (input as any).results;
  return [];
}

function mdEscape(s: string): string {
  return String(s || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function padRight(s: string, len: number): string {
  const t = String(s);
  if (t.length >= len) return t;
  return t + " ".repeat(len - t.length);
}

function buildMarkdownTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(
      h.length,
      ...rows.map((r) => (r[i] ? String(r[i]).length : 0))
    )
  );

  const headerLine = `| ${headers.map((h, i) => padRight(h, widths[i])).join(" | ")} |`;
  const sepLine = `| ${widths.map((w) => "-".repeat(Math.max(3, w))).join(" | ")} |`;
  const rowLines = rows.map((r) => `| ${r.map((c, i) => padRight(c ?? "", widths[i])).join(" | ")} |`);

  return [headerLine, sepLine, ...rowLines].join("\n");
}

function renderStationTable(result: WeatherResult, maxRows: number): string {
  const province = normalizeProvinceDisplayName(result.province);
  const list = Array.isArray(result.data) ? result.data : [];

  const rows = trimArray(list, maxRows)
    .map((s: any) => {
      const station = firstNonEmptyString(s?.StationNameThai, s?.StationName, s?.name);
      const time = firstNonEmptyString(s?.ObservationTime, s?.Time, s?.Datetime, s?.DateTime);
      const temp = formatNumber(s?.Temperature, 1);
      const rh = formatNumber(s?.RelativeHumidity, 0);
      const rain = formatNumber(s?.Rainfall, 1);
      const wind = formatNumber(s?.WindSpeed, 1);
      const windDir = firstNonEmptyString(s?.WindDirection, s?.WindDir);

      return [
        mdEscape(time || "—"),
        mdEscape(station || "—"),
        `${temp}°C`,
        `${rh}%`,
        `${rain}mm`,
        windDir ? `${wind} (${mdEscape(windDir)})` : `${wind}`,
        mdEscape(province || "—"),
      ];
    });

  return buildMarkdownTable(
    ["เวลา", "สถานี", "อุณหภูมิ", "RH", "ฝน", "ลม", "จังหวัด"],
    rows
  );
}

function renderForecast7dTable(result: WeatherResult, maxRows: number): string {
  const province = normalizeProvinceDisplayName(result.province);
  const forecast = (result.data as any)?.forecast;
  const fc = forecast?.SevenDaysForecast || forecast;

  // TMD shape (common): found.SevenDaysForecast with arrays
  const dates: string[] = Array.isArray(fc?.ForecastDate) ? fc.ForecastDate : [];
  const descs: string[] = Array.isArray(fc?.DescriptionThai) ? fc.DescriptionThai : [];
  const tmin: Array<string | number> = Array.isArray(fc?.MinimumTemperature) ? fc.MinimumTemperature : [];
  const tmax: Array<string | number> = Array.isArray(fc?.MaximumTemperature) ? fc.MaximumTemperature : [];
  const rain: Array<string | number> = Array.isArray(fc?.PercentRainCover) ? fc.PercentRainCover : [];

  const rowCount = Math.min(dates.length, maxRows);
  const rows: string[][] = [];

  for (let i = 0; i < rowCount; i++) {
    rows.push([
      mdEscape(dates[i] || "—"),
      mdEscape(descs[i] || "—"),
      `${formatNumber(tmin[i], 0)}°C`,
      `${formatNumber(tmax[i], 0)}°C`,
      `${formatNumber(rain[i], 0)}%`,
      mdEscape(province || "—"),
    ]);
  }

  // If arrays missing, fallback to show single “forecast” preview line deterministically
  if (rows.length === 0) {
    const preview = mdEscape(JSON.stringify(fc ?? {}).slice(0, 140));
    rows.push(["—", preview || "—", "—", "—", "—", mdEscape(province || "—")]);
  }

  return buildMarkdownTable(
    ["วันที่", "พยากรณ์", "ต่ำสุด", "สูงสุด", "ฝน", "จังหวัด"],
    rows
  );
}

function renderNwpTable(result: WeatherResult, maxRows: number): string {
  const province = normalizeProvinceDisplayName(result.province);
  const forecast = (result.data as any)?.forecast;
  const list = Array.isArray(forecast) ? forecast : (Array.isArray(result.data) ? (result.data as any[]) : []);

  const rows = trimArray(list, maxRows)
    .map((x: any) => {
      const time = firstNonEmptyString(x?.time, x?.datetime, x?.dt, x?.timestamp, x?.validTime);
      const temp = toNumberOrNull(x?.temp ?? x?.temperature);
      const rain = toNumberOrNull(x?.rain ?? x?.precip ?? x?.precipitation);
      const wind = toNumberOrNull(x?.wind ?? x?.windSpeed);
      const desc = firstNonEmptyString(x?.desc, x?.description, x?.weather);

      return [
        mdEscape(time || "—"),
        temp === null ? "—" : `${temp.toFixed(1)}°C`,
        rain === null ? "—" : `${rain.toFixed(1)}mm`,
        wind === null ? "—" : `${wind.toFixed(1)}m/s`,
        mdEscape(desc || "—"),
        mdEscape(province || "—"),
      ];
    });

  return buildMarkdownTable(
    ["เวลา", "อุณหภูมิ", "ฝน", "ลม", "สภาพอากาศ", "จังหวัด"],
    rows
  );
}

export function renderWeatherMarkdownTable(input: RenderInput, maxRows = 15): string {
  const results = shapeWeatherResults(asResults(input), maxRows);

  // Prefer station table if present, otherwise forecast, otherwise nwp.
  const station = results.find((r) => r.type === "station3h" && Array.isArray(r.data) && r.data.length > 0);
  if (station) return renderStationTable(station, maxRows);

  const forecast = results.find((r) => r.type === "forecast7d" && r.data);
  if (forecast) return renderForecast7dTable(forecast, maxRows);

  const nwp = results.find((r) => r.type === "nwp" && r.data);
  if (nwp) return renderNwpTable(nwp, maxRows);

  const errResults = results.filter((r) => r.type === "error");
  const errToThai = (e: string): string => {
    const code = String(e || "");
    if (code === "TIMEOUT" || code === "BUDGET_EXCEEDED") return "ดึงข้อมูลไม่ทันเวลา";
    if (code.includes("NOT_FOUND") || code === "DATA_UNAVAILABLE" || code === "NWP_UNAVAILABLE") return "ยังไม่มีข้อมูล";
    if (code === "NATIONAL_DATA_UNAVAILABLE") return "ยังไม่มีข้อมูลทั่วประเทศ";
    if (code === "PROVINCE_MISSING") return "ไม่ระบุจังหวัด";
    return "ยังไม่มีข้อมูล";
  };
  if (errResults.length > 0) {
    const hasProvinces = errResults.some((r) => r.province);
    if (hasProvinces) {
      return buildMarkdownTable(
        ["จังหวัด", "สถานะ"],
        errResults.map((r) => [mdEscape(normalizeProvinceDisplayName(r.province) || "—"), errToThai(r.error || "")])
      );
    }
    return buildMarkdownTable(["สถานะ"], [[errToThai(errResults[0].error || "")]]);
  }

  return buildMarkdownTable(["สถานะ"], [["ยังไม่มีข้อมูล"]]);
}

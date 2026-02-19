import { WeatherResult } from "./types";

const PROVINCE_NORMALIZE_MAP: Array<[RegExp, string]> = [
  [/^(กทม|กรุงเทพ|กรุงเทพฯ|ก\.?ท\.?ม\.?)(\s*)$/i, "กรุงเทพมหานคร"],
];

export function normalizeProvinceDisplayName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  for (const [re, normalized] of PROVINCE_NORMALIZE_MAP) {
    if (re.test(trimmed)) return normalized;
  }
  return trimmed;
}

export function dedupeProvinces(provinces: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of provinces || []) {
    const n = normalizeProvinceDisplayName(p);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function trimArray<T>(arr: T[], max: number): T[] {
  if (!Array.isArray(arr)) return [] as T[];
  if (!Number.isFinite(max) || max <= 0) return [] as T[];
  if (arr.length <= max) return arr;
  return arr.slice(0, max);
}

export function firstNonEmptyString(...values: Array<unknown>): string {
  for (const v of values) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return "";
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(n: unknown, digits = 0): string {
  const nn = toNumberOrNull(n);
  if (nn === null) return "—";
  return nn.toFixed(digits);
}

export function shapeWeatherResults(results: WeatherResult[], maxRows = 15): WeatherResult[] {
  // Deterministic shaping: normalize province display names and cap any large arrays.
  const shaped: WeatherResult[] = [];

  for (const r of results || []) {
    const province = normalizeProvinceDisplayName(r.province);
    const next: WeatherResult = { ...r, province };

    if (r.type === "station3h" && Array.isArray(r.data)) {
      next.data = trimArray(r.data, maxRows);
    }

    if (r.type === "nwp" && r.data && typeof r.data === "object") {
      const forecast = (r.data as any).forecast;
      if (Array.isArray(forecast)) {
        next.data = { ...(r.data as any), forecast: trimArray(forecast, maxRows) };
      }
    }

    shaped.push(next);
  }

  return shaped;
}

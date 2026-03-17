/**
 * tmdApiConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for TMD endpoint → key-tier mapping.
 *
 * Two tiers of TMD credentials:
 *   "api"  – registered credentials: TMD_UID_API / TMD_UKEY_API
 *            → v2 real-time weather endpoints (require registered account)
 *   "demo" – public credentials: TMD_UID_DEMO / TMD_UKEY_DEMO (default: demo/demo)
 *            → v1 public datasets (seismic, climate, station, rainfall, rain-regions)
 *
 * Credential resolution (fallback chain):
 *   api  → TMD_UID_API  || TMD_UID  (deprecated)
 *   demo → TMD_UID_DEMO || TMD_UID  (deprecated)
 *
 * Usage:
 *   import { TMD_ENDPOINT_TIERS, getTmdTierForTool, getTmdCredsForTier } from "../tmdApiConfig";
 */

export type TmdKeyTier = "api" | "demo";

// ─── Endpoint → tool name → tier mapping ─────────────────────────────────────
/**
 * Full mapping of all 17 registered TMD MCP tool names → credential tier.
 * Update this table when adding new TMD endpoints.
 */
export const TMD_ENDPOINT_TIERS: Record<string, TmdKeyTier> = {
  // ── Demo tier: v1 public datasets ──────────────────────────────────────────
  // Uses TMD_UID_DEMO / TMD_UKEY_DEMO (default: demo/demo)
  tmd_seismic_daily_events:               "demo",  // DailySeismicEvent/v1
  tmd_thailand_climate_normal_1981_2010:  "demo",  // ThailandClimateNormal/v1
  tmd_thailand_monthly_rainfall:          "demo",  // ThailandMonthlyRainfall/v1
  tmd_rain_regions:                       "demo",  // RainRegions/v1
  tmd_station_list:                       "demo",  // Station/v1

  // ── API tier: v2 real-time weather + observation ──────────────────────────
  // Uses TMD_UID_API / TMD_UKEY_API (registered credentials required)
  tmd_weather_today_07am_all_stations:    "api",   // WeatherToday/V2
  tmd_weather_3hours_all_stations:        "api",   // Weather3Hours/V2
  tmd_weather_forecast_7days_by_province: "api",   // WeatherForecast7Days/v2
  tmd_daily_forecast_4_times:             "api",   // DailyForecast/v2
  tmd_weather_warning_news:               "api",   // WeatherWarningNews/v2
  tmd_weather_forecast_7days_by_region:   "api",   // WeatherForecast7DaysByRegion/v2
  tmd_weather_3hours_by_hydro:            "api",   // Weather3HoursByHydro/V1
  tmd_weather_3hours_by_agro:             "api",   // Weather3HoursByAgro/V1
  tmd_weather_3hours_by_synop:            "api",   // Weather3HoursBySynop/V1
  tmd_weather_today_by_hydro:             "api",   // WeatherTodayByHydro/V1
  tmd_weather_today_by_agro:              "api",   // WeatherTodayByAgro/V1
  tmd_weather_today_by_synop:             "api",   // weathertodayBySynop/V1
};

/** Lookup the credential tier for a given TMD tool name. */
export function getTmdTierForTool(toolName: string): TmdKeyTier {
  return TMD_ENDPOINT_TIERS[toolName] ?? "api"; // default to api (more restrictive)
}

// ─── NWP scope → endpoint mapping ────────────────────────────────────────────
/**
 * Required JWT scopes for each NWP endpoint category.
 * A JWT with empty scopes ([]) will receive 401 on all NWP endpoints.
 * Source: https://data.tmd.go.th/nwpapi/
 */
export const NWP_SCOPE_MAP: Record<string, string> = {
  // Scope name                              → Endpoint / tool
  "nwp.api.forecast_location":              "nwp_daily_by_place (province/amphoe/tambon)",
  "nwp.api.location.forecast_daily":        "nwp_daily_by_location (lat/lon)",
  "nwp.api.location.forecast_hourly":       "nwp_hourly_by_location + nwp_hourly_by_place",
  "nwp.api.forecast_area":                  "nwp_daily_by_region + nwp_hourly_by_region",
};

/** All 4 scopes required for full NWP API access. */
export const NWP_REQUIRED_SCOPES: string[] = Object.keys(NWP_SCOPE_MAP);

// ─── Credential resolver ──────────────────────────────────────────────────────
/**
 * Resolve TMD uid/ukey for the given tier with fallback chain.
 *
 * api  → TMD_UID_API  → TMD_UID (deprecated)
 * demo → TMD_UID_DEMO → TMD_UID (deprecated)
 *
 * Throws TMD_API_PARAMS_MISSING if no credential found.
 */
export function getTmdCredsForTier(tier: TmdKeyTier): { uid: string; ukey: string } {
  let uid = "";
  let ukey = "";

  if (tier === "api") {
    uid  = String(process.env.TMD_UID_API  || "").trim();
    ukey = String(process.env.TMD_UKEY_API || "").trim();
  } else {
    uid  = String(process.env.TMD_UID_DEMO  || "").trim();
    ukey = String(process.env.TMD_UKEY_DEMO || "").trim();
  }

  // Fallback to deprecated TMD_UID / TMD_UKEY
  if (!uid)  uid  = String(process.env.TMD_UID  || "").trim();
  if (!ukey) ukey = String(process.env.TMD_UKEY || "").trim();

  if (!uid || !ukey) {
    const hint = tier === "api"
      ? "ตั้งค่า TMD_UID_API + TMD_UKEY_API ใน .env (สมัครที่ https://data.tmd.go.th/)"
      : "ตั้งค่า TMD_UID_DEMO + TMD_UKEY_DEMO ใน .env (ใช้ demo/demo สำหรับ public datasets)";
    throw new Error(`TMD_API_PARAMS_MISSING [tier=${tier}]: ${hint}`);
  }

  return { uid, ukey };
}

/**
 * Decode a NWP JWT and return its scopes array.
 * Returns [] if the token is invalid or missing the payload section.
 * Does NOT make a network call — purely local base64 decode.
 */
export function decodeNwpJwtScopes(jwt: string): string[] {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return [];
    const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = raw + "=".repeat((4 - raw.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return Array.isArray(payload.scopes) ? payload.scopes : [];
  } catch {
    return [];
  }
}

/**
 * Check whether the current NWP_API_KEY has all required scopes.
 * Returns { ok: true } if all scopes present, or { ok: false, missing: string[] } otherwise.
 */
export function checkNwpScopes(): { ok: boolean; missing: string[]; present: string[] } {
  const key = String(process.env.NWP_API_KEY || "").trim();
  if (!key) return { ok: false, missing: NWP_REQUIRED_SCOPES, present: [] };

  const present = decodeNwpJwtScopes(key);
  const missing = NWP_REQUIRED_SCOPES.filter((s) => !present.includes(s));
  return { ok: missing.length === 0, missing, present };
}

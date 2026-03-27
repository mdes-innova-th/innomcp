/**
 * tmdApiConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * TMD / NWP Endpoint Capability Matrix — Tier Mapping & Key Selection
 *
 * Phase 11.0 — additive-only (do not remove or disable existing entries)
 *
 * Purpose:
 *   - Map every TMD/NWP tool name to its API tier (api | demo | nwp)
 *   - Auto-select the correct credentials based on tier
 *   - Used by: verify_phase110_tmd_nwp_chat_matrix.ts, health.ts, NwpEngine.ts
 *
 * Tier definitions:
 *   api   = real-time v2 endpoints; requires registered TMD_UID_API / TMD_UKEY_API
 *   demo  = public v1 datasets; uses TMD_UID_DEMO / TMD_UKEY_DEMO (default: demo/demo)
 *   nwp   = NWP API endpoints; uses NWP_API_KEY (JWT Bearer token)
 *
 * @author MDES Innovation Team
 * @created 2026-03-25 (Phase 11.0)
 */

export type TmdToolTier = "api" | "demo" | "nwp";

export interface TmdToolConfig {
  /** MCP tool name as registered with innomcp-server-node */
  toolName: string;
  /** Human-readable description */
  description: string;
  /** API tier: api | demo | nwp */
  tier: TmdToolTier;
  /** Backend endpoint path (for documentation / debugging) */
  endpointPath: string;
  /** Whether this tool is currently wired up in the chat pipeline */
  chatReachable: boolean;
  /** Reason if not chat-reachable */
  notReachableReason?: string;
  /** Expected chat route when invoked */
  expectedRoute: string;
}

/**
 * Complete TMD/NWP capability matrix — 17 groups.
 * Matches: verify_phase110_tmd_nwp_chat_matrix.ts MATRIX definition.
 */
export const TMD_API_CONFIG: TmdToolConfig[] = [
  // ─── TMD API-tier (v2 real-time) — require registered credentials ──────────
  {
    toolName: "tmd_weather_today_07am_all_stations",
    description: "TMD Current Weather – today 7am all stations",
    tier: "api",
    endpointPath: "/WeatherToday/V2",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_weather_3hours_all_stations",
    description: "TMD 3-Hourly Observations – all stations",
    tier: "api",
    endpointPath: "/Weather3Hours/V2",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_weather_forecast_7days_by_province",
    description: "TMD 7-Day Province Forecast",
    tier: "api",
    endpointPath: "/WeatherForecast7Days/v2",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_weather_forecast_7days_by_region",
    description: "TMD 7-Day Region Forecast",
    tier: "api",
    endpointPath: "/WeatherForecast7DaysByRegion/v2",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_weather_warning_news",
    description: "TMD Weather Warning/News",
    tier: "api",
    endpointPath: "/WeatherWarningNews/v2",
    chatReachable: true,
    expectedRoute: "weather",
  },
  // Bonus api-tier: 3-hourly and today by specific locations
  {
    toolName: "tmd_weather_3hours_by_province",
    description: "TMD 3-Hour by Province",
    tier: "api",
    endpointPath: "/Weather3HoursByProvince/V1",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_weather_today_by_province",
    description: "TMD Today by Province",
    tier: "api",
    endpointPath: "/WeatherTodayByProvince/V1",
    chatReachable: true,
    expectedRoute: "weather",
  },
  // ─── TMD Demo-tier (v1 public) — demo/demo credentials work ──────────────
  {
    toolName: "tmd_seismic_daily_events",
    description: "TMD Seismic Daily Events",
    tier: "demo",
    endpointPath: "/DailySeismicEvent/v1",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_thailand_climate_normal_1981_2010",
    description: "TMD Climate Normal 1981–2010",
    tier: "demo",
    endpointPath: "/ThailandClimateNormal/v1",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_thailand_monthly_rainfall",
    description: "TMD Monthly Rainfall Thailand",
    tier: "demo",
    endpointPath: "/ThailandMonthlyRainfall/v1",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_rain_regions",
    description: "TMD Rain Regions",
    tier: "demo",
    endpointPath: "/RainRegions/v1",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "tmd_station_list",
    description: "TMD Station List",
    tier: "demo",
    endpointPath: "/Station/v1",
    chatReachable: true,
    expectedRoute: "weather",
  },
  // ─── NWP API (Numerical Weather Prediction) — JWT bearer token ────────────
  {
    toolName: "nwp_daily",
    description: "NWP Daily Forecast by Location",
    tier: "nwp",
    endpointPath: "/forecast/location/daily",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "nwp_hourly",
    description: "NWP Hourly Forecast by Location",
    tier: "nwp",
    endpointPath: "/forecast/location/hourly",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "nwp_area",
    description: "NWP Area/Region Forecast",
    tier: "nwp",
    endpointPath: "/forecast/area/region",
    chatReachable: true,
    expectedRoute: "weather",
  },
  // Aliases registered with MCP server-node (backward-compatible names)
  {
    toolName: "nwp_daily_by_place",
    description: "NWP Daily by Place (alias for nwp_daily)",
    tier: "nwp",
    endpointPath: "/forecast/location/daily/at",
    chatReachable: true,
    expectedRoute: "weather",
  },
  {
    toolName: "nwp_hourly_by_place",
    description: "NWP Hourly by Place (alias for nwp_hourly)",
    tier: "nwp",
    endpointPath: "/forecast/location/hourly/place",
    chatReachable: true,
    expectedRoute: "weather",
  },
];

// ─── Key selectors ────────────────────────────────────────────────────────────

/**
 * Get TMD credentials (uid + ukey) for a given tier.
 * Falls back to deprecated TMD_UID/TMD_UKEY for backward compatibility.
 */
export function getTmdCredentials(tier: "api" | "demo"): { uid: string; ukey: string } {
  if (tier === "api") {
    const uid = process.env.TMD_UID_API || process.env.TMD_UID || "demo";
    const ukey = process.env.TMD_UKEY_API || process.env.TMD_UKEY || "demo";
    return { uid, ukey };
  }
  // demo tier
  const uid = process.env.TMD_UID_DEMO || process.env.TMD_UID || "demo";
  const ukey = process.env.TMD_UKEY_DEMO || process.env.TMD_UKEY || "demo";
  return { uid, ukey };
}

/**
 * Get NWP Bearer token from env.
 * Always prepends "Bearer " with capital B if not already present.
 */
export function getNwpBearerToken(): string {
  const raw = process.env.NWP_API_KEY || "";
  if (!raw) return "";
  // Ensure "Bearer " prefix with capital B
  if (raw.toLowerCase().startsWith("bearer ")) {
    return `Bearer ${raw.slice(raw.indexOf(" ") + 1).trim()}`;
  }
  return `Bearer ${raw.trim()}`;
}

/**
 * Return the correct auth header value for a given tool.
 * - api/demo tier: `uid:ukey` style (or pass as query params – handled by server-node)
 * - nwp tier: `Bearer <JWT>`
 */
export function getAuthForTool(toolName: string): { type: "tmd" | "nwp" | "none"; uid?: string; ukey?: string; bearer?: string } {
  const config = TMD_API_CONFIG.find(c => c.toolName === toolName);
  if (!config) return { type: "none" };

  if (config.tier === "nwp") {
    return { type: "nwp", bearer: getNwpBearerToken() };
  }
  const creds = getTmdCredentials(config.tier);
  return { type: "tmd", uid: creds.uid, ukey: creds.ukey };
}

/**
 * Get all tool configs for a given tier.
 */
export function getToolsByTier(tier: TmdToolTier): TmdToolConfig[] {
  return TMD_API_CONFIG.filter(c => c.tier === tier);
}

/**
 * Look up a tool config by name (exact match first, then prefix match).
 */
export function getToolConfig(toolName: string): TmdToolConfig | undefined {
  return TMD_API_CONFIG.find(c => c.toolName === toolName)
    || TMD_API_CONFIG.find(c => toolName.startsWith(c.toolName));
}

/**
 * Summary: returns tier counts for reporting.
 */
export function getTierSummary(): Record<TmdToolTier, number> {
  const summary: Record<TmdToolTier, number> = { api: 0, demo: 0, nwp: 0 };
  for (const c of TMD_API_CONFIG) summary[c.tier]++;
  return summary;
}

// ── GEO Core Interfaces (Phase 1 – Weather Only) ──

/** Weather sub-intents recognised by GeoIntent */
export type WeatherSubdomain =
  | "nwp_hourly"
  | "nwp_daily"
  | "tmd_forecast"
  | "other_weather";

/** Features extracted from the user message */
export interface GeoIntentFeatures {
  has_coords: boolean;
  has_time_range_24h: boolean;
  wants_hourly: boolean;
  wants_daily: boolean;
  location_terms: string[];
  coords?: { lat: number; lon: number };
}

/** Result produced by GeoIntent.analyze() */
export interface GeoIntentResult {
  domain: "weather" | "unknown";
  subdomain: WeatherSubdomain | null;
  features: GeoIntentFeatures;
  confidence: number;
  raw_input: string;
}

/** A single tool invocation step inside a ToolPlan */
export interface ToolStep {
  tool_name: string;
  params: Record<string, unknown>;
  reason: string;
}

/** Ordered execution plan produced by GeoRouter */
export interface ToolPlan {
  primary: ToolStep;
  fallbacks: ToolStep[];
}

/** Compact weather packet – the final output of the GEO pipeline */
export interface WeatherPacket {
  summary: string;
  temp?: number;
  humidity?: number;
  timestamp: string;
  source: string;
  raw_data?: unknown;
  evidence: {
    tool: string;
    latency_ms: number;
    confidence: number;
  };
  error?: string;
  fallback_used?: boolean;
}

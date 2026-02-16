
export interface WeatherDateIntent {
  mode: "now" | "today" | "future" | "week" | "table" | "nationwide";
  date?: string; // YYYY-MM-DD
  /** Nationwide intent detected from query (e.g. "ในไทย", "ประเทศไทย", "ทั่วประเทศ"). */
  national?: boolean;
  /** Optional sort preference for nationwide output. */
  sort?: "percentRain_desc" | "percentRain_asc" | "tempMax_desc" | "tempMin_asc";
  /** Optional top-N for nationwide output. */
  topN?: number;
}

export interface WeatherTarget {
  provinces: string[];
  intent: WeatherDateIntent;
  originalText: string;
}

export interface WeatherResult {
  province: string;
  type: "forecast7d" | "station3h" | "nwp" | "national" | "error";
  data?: any;
  error?: string;
  sourceTool?: string;
}

export interface WeatherResponsePayload {
  success: boolean;
  results: WeatherResult[];
  summary: string; // Overall summary for AI to render
}

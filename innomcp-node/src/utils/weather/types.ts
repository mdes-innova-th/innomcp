
export interface WeatherDateIntent {
  mode: "now" | "today" | "future" | "week" | "table";
  date?: string; // YYYY-MM-DD
}

export interface WeatherTarget {
  provinces: string[];
  intent: WeatherDateIntent;
  originalText: string;
  national?: boolean;
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

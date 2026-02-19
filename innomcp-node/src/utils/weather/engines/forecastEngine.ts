import { executeWeatherToolCall, TimeoutError } from "../toolCall";
import { WeatherResult } from "../types";
import { ToolCache } from "../../cache/toolCache";

// Timeout constants (configurable)
const FORECAST_TIMEOUT_MS = 12_000;


export class ForecastEngine {
    constructor(private clients: Map<string, any>) {}

    private getClient(): any {
        return this.clients.get("innomcp-server") || this.clients.values().next().value;
    }

    async getForecast(province: string): Promise<WeatherResult> {
        const client = this.getClient();
        if (!client) return { province, type: "error", error: "CLIENT_NOT_FOUND" };

        try {
            let payload: any;
            const toolName = "tmd_weather_forecast_7days_by_province";
            const cacheKey = ToolCache.generateKey(toolName, { scope: "national" });
            
            payload = ToolCache.get(cacheKey);

            if (!payload) {
                // TMD 7-Day Forecast: returns all 77 provinces, we cache + filter
                payload = await executeWeatherToolCall({
                    client,
                    toolName,
                    args: {},
                    timeoutMs: FORECAST_TIMEOUT_MS,
                    scope: "national",
                });
                ToolCache.set(cacheKey, payload);
            }

            const data = this.extractForecast(payload, province);
            if (data) {
                return {
                    province,
                    type: "forecast7d",
                    data,
                    sourceTool: "tmd_weather_forecast_7days_by_province",
                };
            }

            return { province, type: "error", error: "PROVINCE_NOT_FOUND_IN_FORECAST" };

        } catch (error: any) {
            if (error instanceof TimeoutError || error.code === "TIMEOUT") {
                return { province, type: "error", error: "TIMEOUT" };
            }
            return { province, type: "error", error: "API_ERROR" };
        }
    }

    /**
     * Fetch (or use cache) and return ALL Province[] from TMD 7-day forecast.
     * Used by national queries that need the entire country dataset.
     */
    async getAllForecasts(): Promise<any[]> {
        const client = this.getClient();
        if (!client) return [];

        try {
            let payload: any;
            const toolName = "tmd_weather_forecast_7days_by_province";
            const cacheKey = ToolCache.generateKey(toolName, { scope: "national" });
            
            payload = ToolCache.get(cacheKey);

            if (!payload) {
                payload = await executeWeatherToolCall({
                    client,
                    toolName,
                    args: {},
                    timeoutMs: FORECAST_TIMEOUT_MS,
                    scope: "national",
                });
                ToolCache.set(cacheKey, payload);
            }

            const raw = payload?.Provinces?.Province;
            const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            // LOG POINT #3: ForecastEngine (short only)
            console.log(`[ForecastEngine] provinceCount=${list.length}`);
            return list;
        } catch (error: any) {
            return [];
        }
    }

    /**
     * Extract forecast data for a specific province.
     * After parseMcpPayload unwrapping, payload structure is:
     *   { Provinces: { Province: [...] } }
     */
    private extractForecast(payload: any, target: string): any | null {
        if (!payload || typeof payload !== "object") return null;

        const raw = payload?.Provinces?.Province;
        const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);

        const found = list.find((p: any) => {
            const name = (p?.ProvinceNameThai || p?.ProvinceName || "").trim();
            return name === target.trim();
        });

        if (!found) return null;

        return {
            province: found.ProvinceNameThai || found.ProvinceName,
            forecast: found.SevenDaysForecast || found.ForecastDaily || [],
        };
    }
}

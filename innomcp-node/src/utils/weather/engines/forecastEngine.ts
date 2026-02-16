
import { executeWeatherToolCall, TimeoutError } from "../toolCall";
import { WeatherResult } from "../types";

// Timeout constants (configurable)
const FORECAST_TIMEOUT_MS = 12_000;

// Cache TTL: TMD forecast updates ~every 6 hours; 5 min cache is safe
const CACHE_TTL_MS = 5 * 60 * 1000;

export class ForecastEngine {
    // In-memory cache: TMD returns all 77 provinces per call, no need to call again
    private cachedPayload: any = null;
    private cachedAt = 0;

    constructor(private clients: Map<string, any>) {}

    private getClient(): any {
        return this.clients.get("innomcp-server") || this.clients.values().next().value;
    }

    private isCacheValid(): boolean {
        return this.cachedPayload !== null && (Date.now() - this.cachedAt) < CACHE_TTL_MS;
    }

    async getForecast(province: string): Promise<WeatherResult> {
        const client = this.getClient();
        if (!client) return { province, type: "error", error: "CLIENT_NOT_FOUND" };

        try {
            let payload: any;

            if (this.isCacheValid()) {
                payload = this.cachedPayload;
            } else {
                // TMD 7-Day Forecast: returns all 77 provinces, we cache + filter
                payload = await executeWeatherToolCall({
                    client,
                    toolName: "tmd_weather_forecast_7days_by_province",
                    args: {},
                    timeoutMs: FORECAST_TIMEOUT_MS,
                });
                this.cachedPayload = payload;
                this.cachedAt = Date.now();
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

            console.warn(`[ForecastEngine] province="${province}" not found in TMD forecast`);
            return { province, type: "error", error: "PROVINCE_NOT_FOUND_IN_FORECAST" };

        } catch (error: any) {
            console.warn(`[ForecastEngine] province=${province} error=${error.code || error.message}`);
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

            if (this.isCacheValid()) {
                payload = this.cachedPayload;
            } else {
                payload = await executeWeatherToolCall({
                    client,
                    toolName: "tmd_weather_forecast_7days_by_province",
                    args: {},
                    timeoutMs: FORECAST_TIMEOUT_MS,
                });
                this.cachedPayload = payload;
                this.cachedAt = Date.now();
            }

            const raw = payload?.Provinces?.Province;
            const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            console.log(`[ForecastEngine] provinceCount=${list.length}`);
            return list;
        } catch (error: any) {
            console.warn(`[ForecastEngine] getAllForecasts error=${error.code || error.message}`);
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
        console.log(`[ForecastEngine] provinceCount=${list.length}`);

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

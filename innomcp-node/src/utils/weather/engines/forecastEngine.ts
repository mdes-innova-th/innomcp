import { executeWeatherToolCall, TimeoutError } from "../toolCall";
import { WeatherResult } from "../types";
import { ToolCache } from "../../cache/toolCache";
import { firstNonEmptyString } from "../shaping";
import { resetFixturePrimeFlag, primeWeatherFixturesW1 } from "../fixtures/w1";

// Timeout constants (configurable)
const FORECAST_TIMEOUT_MS = 12_000;

function getTimeoutFromEnv(name: string, fallback: number): number {
    if (process.env.SMOKE_MODE !== "1") return fallback;
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}


export class ForecastEngine {
    constructor(private clients: Map<string, any>) {}

    private isFixtureMode(): boolean {
        return process.env.WEATHER_FIXTURE_W1 === "1" || process.env.SMOKE_MODE === "1";
    }

    private getClient(): any {
        const c = this.clients.get("innomcp-server") || this.clients.values().next().value;
        if (c) return c;
        // In fixture/SMOKE mode, return a dummy client that should never be called
        // (fixtures should be served from cache)
        if (this.isFixtureMode()) {
            return {
                callTool: async () => {
                    throw new Error("WEATHER_FIXTURE_W1 dummy client should not be called");
                },
            };
        }
        return undefined;
    }

    async getForecast(province: string, signal?: AbortSignal): Promise<WeatherResult> {
        const client = this.getClient();
        if (!client) return { province, type: "error", error: "CLIENT_NOT_FOUND" };
        if (process.env.TEST_DEGRADE_TMD === "1") return { province, type: "error", error: "API_ERROR" };

        const forecastTimeoutMs = getTimeoutFromEnv("WX_FORECAST_TIMEOUT_MS", FORECAST_TIMEOUT_MS);

        try {
            let payload: any;
            const toolName = "tmd_weather_forecast_7days_by_province";
            const cacheKey = ToolCache.generateKey(toolName, { scope: "national" });
            
            payload = ToolCache.get(cacheKey);

            if (!payload) {
                // Fixture mode must never call upstream APIs.
                if (this.isFixtureMode()) {
                    // Re-prime fixtures and retry once before giving up
                    resetFixturePrimeFlag();
                    await primeWeatherFixturesW1();
                    payload = ToolCache.get(cacheKey);
                    if (!payload) {
                        return { province, type: "error", error: "FIXTURE_FORECAST_MISS" };
                    }
                } else {
                    // TMD 7-Day Forecast: returns all 77 provinces, we cache + filter
                    payload = await executeWeatherToolCall({
                        client,
                        toolName,
                        args: {},
                        timeoutMs: forecastTimeoutMs,
                        scope: "national",
                        signal,
                    });
                    ToolCache.set(cacheKey, payload);
                }
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
    async getAllForecasts(signal?: AbortSignal): Promise<any[]> {
        const client = this.getClient();
        if (!client) return [];
        if (process.env.TEST_DEGRADE_TMD === "1") throw new Error("API_ERROR");

        const forecastTimeoutMs = getTimeoutFromEnv("WX_FORECAST_TIMEOUT_MS", FORECAST_TIMEOUT_MS);

        try {
            let payload: any;
            const toolName = "tmd_weather_forecast_7days_by_province";
            const cacheKey = ToolCache.generateKey(toolName, { scope: "national" });
            
            payload = ToolCache.get(cacheKey);

            if (!payload) {
                // Fixture mode must never call upstream APIs.
                if (this.isFixtureMode()) {
                    return [];
                }
                payload = await executeWeatherToolCall({
                    client,
                    toolName,
                    args: {},
                    timeoutMs: forecastTimeoutMs,
                    scope: "national",
                    signal,
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

        const lastBuildDate = firstNonEmptyString(
            payload?.LastBuildDate,
            payload?.lastBuildDate,
            payload?.Header?.LastBuildDate,
            payload?.header?.lastBuildDate
        );

        const raw = payload?.Provinces?.Province;
        const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);

        const found = list.find((p: any) => {
            const name = (p?.ProvinceNameThai || p?.ProvinceName || "").trim().normalize("NFKC");
            return name === target.trim().normalize("NFKC");
        });

        if (!found) return null;

        return {
            province: found.ProvinceNameThai || found.ProvinceName,
            forecast: found.SevenDaysForecast || found.ForecastDaily || [],
            lastBuildDate: lastBuildDate || undefined,
        };
    }
}

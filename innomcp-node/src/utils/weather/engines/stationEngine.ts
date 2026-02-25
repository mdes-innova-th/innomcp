
import { executeWeatherToolCall, TimeoutError } from "../toolCall";
import { WeatherResult } from "../types";

// Timeout constants
// Station APIs are slow (15-25s common). Keep tight to leave budget for fallback.
const STATION_3H_TIMEOUT_MS = 15_000;
const STATION_TODAY_TIMEOUT_MS = 15_000;

function getTimeoutFromEnv(name: string, fallback: number): number {
    if (process.env.SMOKE_MODE !== "1") return fallback;
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeThaiProvince(input: string): string {
    const s = String(input || "").trim();
    if (!s) return "";
    const noPrefix = s.replace(/^จังหวัด\s*/u, "");
    const compact = noPrefix.replace(/\s+/gu, "");
    if (/(กรุงเทพ|กรุงเทพมหานคร|กทม)/u.test(compact)) return "กรุงเทพมหานคร";
    return noPrefix.trim();
}

export class StationEngine {
    constructor(private clients: Map<string, any>) {}

    private getClient(): any {
        const c = this.clients.get("innomcp-server") || this.clients.values().next().value;
        if (c) return c;
        if (process.env.WEATHER_FIXTURE_W1 === "1") {
            return {
                callTool: async () => {
                    throw new Error("WEATHER_FIXTURE_W1 dummy client should not be called");
                },
            };
        }
        return undefined;
    }

    async getStationData(province: string, signal?: AbortSignal): Promise<WeatherResult> {
        const client = this.getClient();
        if (!client) return { province, type: "error", error: "CLIENT_NOT_FOUND" };

        // Track whether TMD returned data at all (vs empty Stations)
        let apiReturnedEmpty = false;
        let primaryTimedOut = false;

        const station3hTimeoutMs = getTimeoutFromEnv("WX_STATION_TIMEOUT_MS", STATION_3H_TIMEOUT_MS);
        const stationTodayTimeoutMs = getTimeoutFromEnv("WX_STATION_07AM_TIMEOUT_MS", STATION_TODAY_TIMEOUT_MS);

        // Try primary: 3-hour stations
        try {
            const payload = await executeWeatherToolCall({
                client,
                toolName: "tmd_weather_3hours_all_stations",
                args: {},
                timeoutMs: station3hTimeoutMs,
                scope: "province",
                signal,
            });

            const { total, filtered } = this.extractStations(payload, province);
            if (filtered.length > 0) {
                return {
                    province,
                    type: "station3h",
                    data: filtered,
                    sourceTool: "tmd_weather_3hours_all_stations",
                };
            }

            // API responded but 0 total stations → TMD has no data right now
            // Skip 07am fallback (likely also empty), let pipeline fall through faster
            if (total === 0) apiReturnedEmpty = true;
        } catch (error: any) {
            if (error instanceof TimeoutError) primaryTimedOut = true;
        }

        // Fallback: Today 07am stations (only if 3h didn't respond with empty data)
        // If 3h timed out, skip fallback to reduce wasted upstream calls.
        if (!apiReturnedEmpty && !primaryTimedOut) {
            try {
                const payload = await executeWeatherToolCall({
                    client,
                    toolName: "tmd_weather_today_07am_all_stations",
                    args: {},
                    timeoutMs: stationTodayTimeoutMs,
                    scope: "province",
                    signal,
                });

                const { filtered } = this.extractStations(payload, province);
                if (filtered.length > 0) {
                    return {
                        province,
                        type: "station3h",
                        data: filtered,
                        sourceTool: "tmd_weather_today_07am_all_stations",
                    };
                }
            } catch (error: any) {
                // no extra logs (keep only the required StationEngine log point)
            }
        }

        if (primaryTimedOut) return { province, type: "error", error: "TIMEOUT" };
        return { province, type: "error", error: "STATION_NOT_FOUND" };
    }

    /**
     * Extract stations for a specific province.
     * After parseMcpPayload unwrapping, payload structure is:
     *   { Stations: { Station: [...] } }  (or Stations is empty {} when no data)
     * Station items have .Province field (Thai name).
     * Returns both total count and filtered array so caller can decide on fallback.
     */
    private extractStations(payload: any, target: string): { total: number; filtered: any[] } {
        if (!payload || typeof payload !== "object") return { total: 0, filtered: [] };

        const raw = payload?.Stations?.Station;
        const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);

        const targetNorm = normalizeThaiProvince(target);
        const filtered = list.filter((s: any) => {
            const prov = normalizeThaiProvince((s?.Province || s?.StationProvince || "").trim());
            return prov === targetNorm;
        });

        console.log(`[StationEngine] stationCount=${list.length} filteredCount=${filtered.length} province=${target}`);
        return { total: list.length, filtered };
    }
}

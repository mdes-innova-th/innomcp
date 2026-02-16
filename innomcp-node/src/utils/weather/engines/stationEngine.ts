
import { executeWeatherToolCall, TimeoutError } from "../toolCall";
import { WeatherResult } from "../types";

// Timeout constants
// Station APIs are slow (15-25s common). Keep tight to leave budget for fallback.
const STATION_3H_TIMEOUT_MS = 15_000;
const STATION_TODAY_TIMEOUT_MS = 15_000;

export class StationEngine {
    constructor(private clients: Map<string, any>) {}

    private getClient(): any {
        return this.clients.get("innomcp-server") || this.clients.values().next().value;
    }

    async getStationData(province: string): Promise<WeatherResult> {
        const client = this.getClient();
        if (!client) return { province, type: "error", error: "CLIENT_NOT_FOUND" };

        // Track whether TMD returned data at all (vs empty Stations)
        let apiReturnedEmpty = false;

        // Try primary: 3-hour stations
        try {
            const payload = await executeWeatherToolCall({
                client,
                toolName: "tmd_weather_3hours_all_stations",
                args: {},
                timeoutMs: STATION_3H_TIMEOUT_MS,
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
            if (total === 0) {
                apiReturnedEmpty = true;
                console.log(`[StationEngine] province=${province} tool=tmd_weather_3hours_all_stations stationCount=0 (API empty, skip 07am)`);
            }
        } catch (error: any) {
            console.warn(`[StationEngine] province=${province} tool=tmd_weather_3hours_all_stations error=${error.code || error.message}`);
        }

        // Fallback: Today 07am stations (only if 3h didn't respond with empty data)
        if (!apiReturnedEmpty) {
            try {
                const payload = await executeWeatherToolCall({
                    client,
                    toolName: "tmd_weather_today_07am_all_stations",
                    args: {},
                    timeoutMs: STATION_TODAY_TIMEOUT_MS,
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
                console.warn(`[StationEngine] province=${province} tool=tmd_weather_today_07am_all_stations error=${error.code || error.message}`);
            }
        }

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

        const filtered = list.filter((s: any) => {
            const prov = (s?.Province || s?.StationProvince || "").trim();
            return prov === target.trim();
        });

        console.log(`[StationEngine] stationCount=${list.length} filteredCount=${filtered.length} province=${target}`);
        return { total: list.length, filtered };
    }
}

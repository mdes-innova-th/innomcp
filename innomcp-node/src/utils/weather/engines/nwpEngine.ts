
import { executeWeatherToolCall, TimeoutError } from "../toolCall";
import { WeatherResult } from "../types";
import { ToolCache } from "../../cache/toolCache";

// Timeout constants (configurable)
const NWP_TIMEOUT_MS = 12_000;

function getTimeoutFromEnv(name: string, fallback: number): number {
    if (process.env.SMOKE_MODE !== "1") return fallback;
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class NwpEngine {
    constructor(private clients: Map<string, any>) {}

    private getClient(): any {
        return this.clients.get("innomcp-server") || this.clients.values().next().value;
    }

    async getNwpData(province: string, signal?: AbortSignal): Promise<WeatherResult> {
        // Phase 8.9 verifier support: allow asserting whether NWP was called.
        // Gated to SMOKE_MODE + WX_VERIFY_COUNTER to avoid production log noise.
        if (process.env.SMOKE_MODE === "1" && process.env.WX_VERIFY_COUNTER === "1") {
            const g: any = globalThis as any;
            const ctr = (g.__wxCounter = g.__wxCounter || { nwpCalls: 0 });
            ctr.nwpCalls = Number(ctr.nwpCalls || 0) + 1;
            console.log(`[WX_COUNTER] nwp_call count=${ctr.nwpCalls} province=${province}`);
        }

        const client = this.getClient();
        if (!client) return { province, type: "error", error: "CLIENT_NOT_FOUND" };
        if (process.env.TEST_DEGRADE_NWP === "1") return { province, type: "error", error: "NWP_UNAVAILABLE" };

        const nwpTimeoutMs = getTimeoutFromEnv("WX_NWP_TIMEOUT_MS", NWP_TIMEOUT_MS);

        // Try NWP daily by place (canonical arg key is "place")
        try {
            const toolName = "nwp_daily_by_place";
            const args = { place: province };
            const cacheKey = ToolCache.generateKey(toolName, args);
            
            let payload = ToolCache.get(cacheKey);
            if (!payload) {
                payload = await executeWeatherToolCall({
                    client,
                    toolName,
                    args,
                    timeoutMs: nwpTimeoutMs,
                    scope: "province",
                    signal,
                });
                ToolCache.set(cacheKey, payload);
            }

            const data = this.extractNwp(payload, province);
            if (data) {
                return {
                    province,
                    type: "nwp",
                    data,
                    sourceTool: "nwp_daily_by_place",
                };
            }
        } catch (error: any) {
            console.warn(`[NwpEngine] province=${province} tool=nwp_daily_by_place error=${error.code || error.message}`);
            if (error instanceof TimeoutError || error.code === "TIMEOUT") {
                return { province, type: "error", error: "TIMEOUT" };
            }
        }

        // Fallback: NWP hourly by place (canonical arg key is "place")
        try {
            const toolName = "nwp_hourly_by_place";
            const args = { place: province };
            const cacheKey = ToolCache.generateKey(toolName, args);

            let payload = ToolCache.get(cacheKey);
            if (!payload) {
                payload = await executeWeatherToolCall({
                    client,
                    toolName,
                    args,
                    timeoutMs: nwpTimeoutMs,
                    scope: "province",
                    signal,
                });
                ToolCache.set(cacheKey, payload);
            }

            const data = this.extractNwp(payload, province);
            if (data) {
                return {
                    province,
                    type: "nwp",
                    data,
                    sourceTool: "nwp_hourly_by_place",
                };
            }
        } catch (error: any) {
            console.warn(`[NwpEngine] province=${province} tool=nwp_hourly_by_place error=${error.code || error.message}`);
        }

        return { province, type: "error", error: "NWP_UNAVAILABLE" };
    }

    /**
     * Extract NWP data for a province.
     * NWP responses vary: can be array or object with .data field.
     * After parseMcpPayload, typically:
     *   { source, location, data: { daily: [...] }, ... } (place-based)
     *   or raw array of forecast entries
     */
    private extractNwp(payload: any, target: string): any | null {
        if (!payload) return null;

        // If payload has 'success: false', skip
        if (payload?.success === false) return null;

        // Normalize common shapes into a consistent object
        // Supported:
        // - array
        // - { data: ... }
        // - { data: { daily|hourly } }
        // - { daily|hourly }
        // - nested wrappers
        const unwrap = (x: any): any => {
            if (!x) return x;
            if (Array.isArray(x) && x.length === 1 && typeof x[0] === "object") return x[0];
            if (typeof x === "object" && x.data !== undefined) return x.data;
            return x;
        };

        const normalized = unwrap(payload);

        if (normalized && (normalized.daily || normalized.hourly || normalized.data)) {
            const data = normalized.daily ?? normalized.hourly ?? normalized.data;
            return {
                province: target,
                forecast: data,
                source: payload.source || normalized.source || "NWP",
            };
        }

        // If array of entries, filter by province if field exists
        if (Array.isArray(normalized)) {
            const filtered = normalized.filter((item: any) =>
                (item?.province || item?.place || item?.location || "").trim() === target.trim()
            );
            if (filtered.length > 0) return { province: target, forecast: filtered, source: "NWP" };
            // If no province field, return all (location-based output)
            if (normalized.length > 0 && !normalized[0]?.province && !normalized[0]?.place) {
                return { province: target, forecast: normalized, source: "NWP" };
            }
        }

        return null;
    }
}

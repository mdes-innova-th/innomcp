/*
verify_weather_v2.ts — Phase 6.5 deterministic weather verification (NO NETWORK)

Run (from innomcp-node):
    npx ts-node -P tsconfig.json scripts/verify_weather_v2.ts

Help:
    npx ts-node -P tsconfig.json scripts/verify_weather_v2.ts --help

What this does:
- Uses WeatherPipeline + engines
- Injects a deterministic in-memory MCP mock client (no HTTP/fetch)
- Verifies 6 required cases:
    1) alias
    2) multi-province
    3) fake province block (no tool calls)
    4) fallback (StationEngine 3h -> 07am)
    5) timeout (stale-cache timeout fallback)
    6) payload variance (structuredContent/content JSON/array unwrap)
*/

import { WeatherPipeline } from "../src/utils/weather/weatherPipeline";
import { ToolCache } from "../src/utils/cache/toolCache";
import {
    executeWeatherToolCall,
    parseMcpPayload,
    primeWeatherToolCallCachePayload,
} from "../src/utils/weather/toolCall";

type ToolCallReq = { name: string; arguments: any };

type MockToolResult = {
    structuredContent?: any;
    content?: Array<{ type?: string; text?: string; json?: any; data?: any }>;
    isError?: boolean;
};

class MockMcpClient {
    public calls: Array<{ name: string; arguments: any }> = [];

    private handlers: Map<string, (args: any) => Promise<MockToolResult> | MockToolResult> = new Map();

    on(toolName: string, handler: (args: any) => Promise<MockToolResult> | MockToolResult) {
        this.handlers.set(toolName, handler);
    }

    async callTool(req: ToolCallReq): Promise<MockToolResult> {
        this.calls.push({ name: req.name, arguments: req.arguments });

        const handler = this.handlers.get(req.name);
        if (!handler) {
            return {
                isError: true,
                content: [{ type: "text", text: `No mock handler for tool: ${req.name}` }],
            };
        }

        return await handler(req.arguments);
    }

    countCalls(prefixOrName: string): number {
        return this.calls.filter((c) => c.name === prefixOrName || c.name.startsWith(prefixOrName)).length;
    }
}

function assert(condition: any, message: string): void {
    if (!condition) throw new Error(message);
}

function stableJson(value: any): string {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

async function runCase(name: string, fn: () => Promise<void>): Promise<{ name: string; ok: boolean; error?: string }> {
    try {
        await fn();
        console.log(`[PASS] ${name}`);
        return { name, ok: true };
    } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        console.log(`[FAIL] ${name} reason=${msg}`);
        return { name, ok: false, error: msg };
    }
}

function makeForecastPayload(provinces: string[]): any {
    return {
        Provinces: {
            Province: provinces.map((p) => ({
                ProvinceNameThai: p,
                SevenDaysForecast: [{ Day: 1, TempMax: 35, TempMin: 25, PercentRain: 60 }],
            })),
        },
    };
}

function makeStationsPayload(stations: Array<{ Province: string; StationName?: string }>): any {
    return {
        Stations: {
            Station: stations.map((s) => ({
                Province: s.Province,
                StationNameThai: s.StationName || "MockStation",
                Temperature: 30,
                RelativeHumidity: 70,
            })),
        },
    };
}

async function main() {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
        console.log(
            [
                "verify_weather_v2.ts — Phase 6.5 deterministic weather verification (NO NETWORK)",
                "",
                "Run:",
                "  cd innomcp-node",
                "  npx ts-node -P tsconfig.json scripts/verify_weather_v2.ts",
                "",
                "Exit codes:",
                "  0 = all PASS",
                "  1 = any FAIL",
                "",
                "Example PASS output:",
                "  [PASS] alias: 'กทม' -> 'กรุงเทพมหานคร'",
                "  [PASS] multi-province: 2 provinces",
                "  [PASS] fake province block: PROVINCE_MISSING and no tool calls",
                "  [PASS] fallback: station uses tmd_weather_today_07am_all_stations",
                "  [PASS] timeout: stale timeout fallback returned",
                "  [PASS] payload variance: parse unwrap shapes",
                "  Summary: pass=6 fail=0",
            ].join("\n")
        );
        process.exitCode = 0;
        return;
    }

    ToolCache.clear();

    const client = new MockMcpClient();
    const clients = new Map<string, any>([["innomcp-server", client]]);
    const pipeline = new WeatherPipeline(clients);

    client.on("tmd_weather_forecast_7days_by_province", () => {
        const payload = makeForecastPayload(["กรุงเทพมหานคร", "สมุทรสาคร", "ศรีสะเกษ", "ปทุมธานี"]);
        return {
            structuredContent: { ok: true, meta: { source: "mock" }, data: [payload] },
        };
    });

    client.on("tmd_weather_3hours_all_stations", () => {
        return {
            isError: true,
            content: [{ type: "text", text: "TMD API timeout" }],
        };
    });

    client.on("tmd_weather_today_07am_all_stations", () => {
        const payload = makeStationsPayload([
            { Province: "ปทุมธานี", StationName: "Rangsit" },
            { Province: "กรุงเทพมหานคร", StationName: "BKK" },
        ]);

        return {
            content: [{ type: "text", text: stableJson([payload]) }],
        };
    });

    client.on("nwp_daily_by_place", (args) => {
        return {
            structuredContent: { data: { daily: [{ place: args?.place, temp: 30 }] } },
        };
    });
    client.on("nwp_hourly_by_place", (args) => {
        return {
            structuredContent: { data: { hourly: [{ place: args?.place, temp: 30 }] } },
        };
    });

    const results = [] as Array<{ name: string; ok: boolean; error?: string }>;

    results.push(
        await runCase("alias: 'กทม' -> 'กรุงเทพมหานคร'", async () => {
            const target = pipeline.resolveTarget("วันนี้กทมฝนตกไหม");
            assert(target.provinces.includes("กรุงเทพมหานคร"), `Expected provinces to include กรุงเทพมหานคร, got=${target.provinces.join(",")}`);
            const out = await pipeline.execute(target);
            assert(out.length === 1, `Expected 1 result, got=${out.length}`);
            assert(out[0].province === "กรุงเทพมหานคร", `Expected province กรุงเทพมหานคร, got=${out[0].province}`);
            assert(out[0].type !== "error", `Expected non-error result, got=${out[0].error}`);
        })
    );

    results.push(
        await runCase("multi-province: 2 provinces", async () => {
            const target = pipeline.resolveTarget("พรุ่งนี้ สมุทรสาคร, ศรีสะเกษ อากาศเป็นไง");
            assert(target.provinces.includes("สมุทรสาคร"), `Missing สมุทรสาคร got=${target.provinces.join(",")}`);
            assert(target.provinces.includes("ศรีสะเกษ"), `Missing ศรีสะเกษ got=${target.provinces.join(",")}`);
            const out = await pipeline.execute(target);
            const provinces = out.map((r) => r.province).sort();
            assert(out.length === 2, `Expected 2 results, got=${out.length}`);
            assert(provinces.join("|") === ["ศรีสะเกษ", "สมุทรสาคร"].sort().join("|"), `Unexpected provinces=${provinces.join(",")}`);
            assert(out.every((r) => r.type !== "error"), `Expected all non-error, got=${stableJson(out)}`);
        })
    );

    results.push(
        await runCase("fake province block: PROVINCE_MISSING and no tool calls", async () => {
            const beforeCalls = client.calls.length;
            const target = pipeline.resolveTarget("พรุ่งนี้ เมืองทิพย์ ฝนตกไหม");
            assert(target.provinces.length === 0, `Expected no provinces, got=${target.provinces.join(",")}`);
            const out = await pipeline.execute(target);
            assert(out.length === 1, `Expected 1 result, got=${out.length}`);
            assert(out[0].type === "error" && out[0].error === "PROVINCE_MISSING", `Expected PROVINCE_MISSING, got=${stableJson(out[0])}`);
            assert(client.calls.length === beforeCalls, `Expected zero tool calls, got delta=${client.calls.length - beforeCalls}`);
        })
    );

    results.push(
        await runCase("fallback: station uses tmd_weather_today_07am_all_stations", async () => {
            ToolCache.clear();

            const target = pipeline.resolveTarget("ตอนนี้อากาศรังสิตเป็นไง");
            assert(target.provinces.includes("ปทุมธานี"), `Expected ปทุมธานี, got=${target.provinces.join(",")}`);
            const out = await pipeline.execute(target);
            assert(out.length === 1, `Expected 1 result, got=${out.length}`);
            assert(out[0].province === "ปทุมธานี", `Expected ปทุมธานี, got=${out[0].province}`);
            assert(out[0].type === "station3h", `Expected station3h, got=${out[0].type}`);
            assert(out[0].sourceTool === "tmd_weather_today_07am_all_stations", `Expected fallback sourceTool, got=${out[0].sourceTool}`);
            assert(client.countCalls("tmd_weather_3hours_all_stations") >= 1, "Expected primary station tool to be attempted");
            assert(client.countCalls("tmd_weather_today_07am_all_stations") >= 1, "Expected fallback station tool to be used");
        })
    );

    results.push(
        await runCase("timeout: stale timeout fallback returned", async () => {
            const timeoutClient = new MockMcpClient();
            timeoutClient.on("tmd_weather_forecast_7days_by_province", () => {
                return {
                    isError: true,
                    content: [{ type: "text", text: "timeout" }],
                };
            });

            const toolName = "tmd_weather_forecast_7days_by_province";
            const args = {};
            const scope = "timeoutCase";

            primeWeatherToolCallCachePayload({
                toolName,
                args,
                scope,
                payload: makeForecastPayload(["กรุงเทพมหานคร"]),
                at: Date.now() - 60 * 60 * 1000,
            });

            const payload = await executeWeatherToolCall({
                client: timeoutClient,
                toolName,
                args,
                timeoutMs: 50,
                scope,
            });

            assert(payload && typeof payload === "object", `Expected object payload, got=${typeof payload}`);
            assert(payload.__cache?.stale === true, `Expected stale cache meta, got=${stableJson(payload.__cache)}`);
            assert(payload.__cache?.reason === "timeout_fallback", `Expected timeout_fallback, got=${stableJson(payload.__cache)}`);
        })
    );

    results.push(
        await runCase("payload variance: parse unwrap shapes", async () => {
            const v1 = parseMcpPayload({
                structuredContent: JSON.stringify({ ok: true, meta: {}, data: [makeForecastPayload(["กรุงเทพมหานคร"])] }),
            });
            assert(v1?.Provinces?.Province, `Expected Provinces.Province, got=${stableJson(v1)}`);

            const v2 = parseMcpPayload({
                content: [{ type: "text", text: stableJson(makeStationsPayload([{ Province: "ปทุมธานี" }])) }],
            });
            assert(v2?.Stations?.Station, `Expected Stations.Station, got=${stableJson(v2)}`);

            const v3 = parseMcpPayload({
                content: [{ type: "text", text: stableJson([makeStationsPayload([{ Province: "ปทุมธานี" }])]) }],
            });
            assert(v3?.Stations?.Station, `Expected Stations.Station after unwrap, got=${stableJson(v3)}`);
        })
    );

    const pass = results.filter((r) => r.ok).length;
    const fail = results.length - pass;
    console.log(`Summary: pass=${pass} fail=${fail}`);

    process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => {
    console.error(`[verify_weather_v2] fatal error: ${e?.message || String(e)}`);
    process.exitCode = 1;
});

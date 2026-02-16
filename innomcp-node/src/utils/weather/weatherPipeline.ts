
import { ForecastEngine } from "./engines/forecastEngine";
import { StationEngine } from "./engines/stationEngine";
import { NwpEngine } from "./engines/nwpEngine";
import { WeatherResult, WeatherTarget } from "./types";
import { resolveProvinces } from "../locationResolver";

// National query: show top N provinces by rain
const NATIONAL_TOP_N = 20;

// Wind direction degrees → Thai cardinal
const WIND_DIR: Record<string, string> = {
  "0": "เหนือ", "360": "เหนือ", "45": "ตะวันออกเฉียงเหนือ",
  "90": "ตะวันออก", "135": "ตะวันออกเฉียงใต้",
  "180": "ใต้", "225": "ตะวันตกเฉียงใต้",
  "270": "ตะวันตก", "315": "ตะวันตกเฉียงเหนือ",
};

function windLabel(deg: string | number): string {
  const d = Number(deg);
  if (isNaN(d)) return String(deg);
  // Snap to nearest 45°
  const snapped = Math.round(d / 45) * 45;
  return WIND_DIR[String(snapped % 360)] || `${d}°`;
}

/**
 * Get tomorrow's date string in DD/MM/YYYY format (Asia/Bangkok).
 */
function tomorrowDateStr(): string {
  const now = new Date();
  // Asia/Bangkok = UTC+7
  const bkkMs = now.getTime() + (7 * 60 * 60 * 1000);
  const bkk = new Date(bkkMs);
  bkk.setUTCDate(bkk.getUTCDate() + 1);
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = bkk.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export class WeatherPipeline {
    private forecastEngine: ForecastEngine;
    private stationEngine: StationEngine;
    private nwpEngine: NwpEngine;

    constructor(clients: Map<string, any>) {
        this.forecastEngine = new ForecastEngine(clients);
        this.stationEngine = new StationEngine(clients);
        this.nwpEngine = new NwpEngine(clients);
    }

    public resolveTarget(userText: string): WeatherTarget {
        const provinces = resolveProvinces(userText);
        const mode = this.detectMode(userText);
        const national = this.isNationalQuery(userText, provinces);

        return {
            provinces,
            intent: { mode },
            originalText: userText,
            national,
        };
    }

    // ─── Intent Detection ───

    private detectMode(text: string): "now" | "today" | "future" | "week" | "table" {
        const t = text || "";
        if (/ตารางแสดง|ตาราง|รายสถานี|สถานี|station\b/i.test(t)) return "table";
        if (/ตอนนี้|ขณะนี้|เดี๋ยวนี้|ปัจจุบัน|observation|current\b|real\s*time/i.test(t)) return "now";
        if (/7\s*วัน|๗\s*วัน|หนึ่งสัปดาห์|สัปดาห์นี้|สัปดาห์หน้า|อาทิตย์นี้|อาทิตย์หน้า/i.test(t)) return "week";
        if (/พรุ่งนี้|มะรืน|เดือนหน้า|ล่วงหน้า|พยากรณ์|forecast|\d+\s*วัน/i.test(t)) return "future";
        return "today";
    }

    /**
     * Detect national/Thailand-wide weather query.
     * national=true when:
     *   - resolvedProvinces is empty AND
     *   - message contains national scope keywords AND
     *   - it's a weather-intent message (already routed here)
     */
    private isNationalQuery(text: string, provinces: string[]): boolean {
        if (provinces.length > 0) return false;

        const t = text || "";
        const hasNationalScope = /ในไทย|ทั่วประเทศ|ทั้งประเทศ|ที่ไหน|จังหวัดไหน|บ้าง|ทุกจังหวัด|ประเทศไทย|ทั่วไทย/i.test(t);
        return hasNationalScope;
    }

    // ─── Execution ───

    public async execute(target: WeatherTarget): Promise<WeatherResult[]> {
        const startedAt = Date.now();
        const budgetMs = 30_000;
        const budgetUsedMs = () => Date.now() - startedAt;
        const budgetRemainingMs = () => Math.max(0, budgetMs - budgetUsedMs());

        const mode = target.intent.mode;
        const chain = (() => {
            switch (mode) {
                case "now":
                case "table":
                    return "Station>Forecast>NWP";
                case "today":
                    return "Forecast>Station>NWP";
                case "future":
                case "week":
                    return "Forecast>NWP";
                default:
                    return "Forecast>Station>NWP";
            }
        })();

        // ─── National query: bypass PROVINCE_MISSING, use dedicated strategy ───
        if (target.national) {
            console.log(`[WeatherPipeline] mode=${mode} national=true chain=Forecast`);
            return this.executeNational(target);
        }

        // Guard: no provinces resolved (and not national)
        if (target.provinces.length === 0) {
            console.log(`[WeatherPipeline] mode=${mode} chain=${chain} budgetUsedMs=${budgetUsedMs()} PROVINCE_MISSING`);
            return [{
                province: "",
                type: "error",
                error: "PROVINCE_MISSING",
            }];
        }

        console.log(`[WeatherPipeline] mode=${mode} chain=${chain} provinces=${target.provinces.length} budgetMs=${budgetMs}`);

        // Track engine availability across provinces in this execution
        let stationAvailable = true;
        let budgetExceeded = false;
        const results: WeatherResult[] = [];

        for (const province of target.provinces) {
            let result: WeatherResult | null = null;

            try {
                const runWithBudget = async (fn: () => Promise<WeatherResult>): Promise<WeatherResult> => {
                    if (budgetRemainingMs() <= 0) {
                        budgetExceeded = true;
                        return { province, type: "error", error: "BUDGET_EXCEEDED" };
                    }
                    const r = await fn();
                    if (budgetRemainingMs() <= 0) {
                        budgetExceeded = true;
                    }
                    return r;
                };

                const tryStation = async (): Promise<WeatherResult> => {
                    if (!stationAvailable) {
                        console.log(`[WeatherPipeline] province=${province} stationEngine=SKIPPED (failed on previous province)`);
                        return { province, type: "error", error: "STATION_SKIPPED" };
                    }
                    const r = await runWithBudget(() => this.stationEngine.getStationData(province));
                    if (r.type === "error") {
                        stationAvailable = false;
                    }
                    return r;
                };

                if (mode === "now" || mode === "table") {
                    result = await tryStation();
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        result = await runWithBudget(() => this.forecastEngine.getForecast(province));
                    }
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province));
                    }
                } else if (mode === "future" || mode === "week") {
                    result = await runWithBudget(() => this.forecastEngine.getForecast(province));
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province));
                    }
                } else {
                    result = await runWithBudget(() => this.forecastEngine.getForecast(province));
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        result = await tryStation();
                    }
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province));
                    }
                }
            } catch (err: any) {
                console.error(`[WeatherPipeline] province=${province} error=${err.message || "UNEXPECTED_ERROR"}`);
                result = { province, type: "error", error: err.message || "UNEXPECTED_ERROR" };
            }

            results.push(result || { province, type: "error", error: "DATA_UNAVAILABLE" });

            if (budgetRemainingMs() <= 0) {
                break;
            }
        }

        const successCount = results.filter(r => r.type !== "error").length;
        const failCount = results.filter(r => r.type === "error").length;

        if (budgetExceeded && successCount === 0) {
            console.log(`[WeatherPipeline] mode=${mode} chain=${chain} budgetUsedMs=${budgetUsedMs()} TIMEOUT`);
            return [{ province: "", type: "error", error: "TIMEOUT" }];
        }

        console.log(`[WeatherPipeline] mode=${mode} chain=${chain} budgetUsedMs=${budgetUsedMs()} success=${successCount} fail=${failCount}`);
        return results;
    }

    // ─── National Execution ───

    private async executeNational(target: WeatherTarget): Promise<WeatherResult[]> {
        // Single TMD call to get all provinces
        const allProvinces = await this.forecastEngine.getAllForecasts();
        if (allProvinces.length === 0) {
            return [{ province: "", type: "error", error: "NATIONAL_DATA_UNAVAILABLE" }];
        }

        // Find tomorrow's index in ForecastDate array
        const tomorrow = tomorrowDateStr();

        // Build per-province rows for tomorrow
        interface NationalRow {
            province: string;
            rain: number;
            desc: string;
            tempMin: string;
            tempMax: string;
            wind: string;
            windSpeed: string;
        }

        const rows: NationalRow[] = [];

        for (const p of allProvinces) {
            const name = p?.ProvinceNameThai || "";
            const fc = p?.SevenDaysForecast;
            if (!fc || !fc.ForecastDate) continue;

            const dates: string[] = Array.isArray(fc.ForecastDate) ? fc.ForecastDate : [];
            let idx = dates.indexOf(tomorrow);

            // Fallback: if tomorrow not found, use first entry (most future date)
            if (idx < 0) idx = 0;

            const rain = Number(fc.PercentRainCover?.[idx]) || 0;
            const desc = String(fc.DescriptionThai?.[idx] || "");
            const tempMin = String(fc.MinimumTemperature?.[idx] || "—");
            const tempMax = String(fc.MaximumTemperature?.[idx] || "—");
            const windDeg = String(fc.WindDirection?.[idx] || "");
            const windSpd = String(fc.WindSpeed?.[idx] || "");

            // Include if rain > 0 OR description mentions rain
            if (rain > 0 || /ฝน|พายุ|rain|storm/i.test(desc)) {
                rows.push({
                    province: name,
                    rain,
                    desc,
                    tempMin,
                    tempMax,
                    wind: windLabel(windDeg),
                    windSpeed: windSpd,
                });
            }
        }

        // Sort by rain% descending, take top N
        rows.sort((a, b) => b.rain - a.rain);
        const topRows = rows.slice(0, NATIONAL_TOP_N);

        console.log(`[National] rainyCount=${rows.length} topN=${topRows.length}`);

        // Build structured data for LLM/UI
        const tableData = topRows.map(r => ({
            จังหวัด: r.province,
            "%ฝน": r.rain,
            "อุณหภูมิ": `${r.tempMin}–${r.tempMax} °C`,
            "ลม": `${r.wind} ${r.windSpeed} กม./ชม.`,
            "ความชื้น": "—",
            "สภาพอากาศ": r.desc,
        }));

        return [{
            province: "ทั่วประเทศ",
            type: "national",
            data: {
                date: tomorrow,
                totalRainyProvinces: rows.length,
                topN: topRows.length,
                table: tableData,
                footnote: "ความชื้นไม่มีในพยากรณ์ 7 วัน TMD; ใช้ข้อมูลสถานี (ราย 3 ชม.) สำหรับความชื้นจริง",
            },
            sourceTool: "tmd_weather_forecast_7days_by_province",
        }];
    }
}

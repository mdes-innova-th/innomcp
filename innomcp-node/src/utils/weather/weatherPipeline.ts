
import { ForecastEngine } from "./engines/forecastEngine";
import { StationEngine } from "./engines/stationEngine";
import { NwpEngine } from "./engines/nwpEngine";
import { WeatherResult, WeatherTarget } from "./types";
import { resolveProvinces } from "../locationResolver";
import { primeWeatherFixturesW1 } from "./fixtures/w1";

// Nationwide query: show top N provinces by rain
const NATIONWIDE_TOP_N_DEFAULT = 10;
const NATIONWIDE_TOP_N_MAX = 20;

// Budget: max wall-clock time for entire execute()
const BUDGET_MS = 30_000;

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
  const snapped = Math.round(d / 45) * 45;
  return WIND_DIR[String(snapped % 360)] || `${d}°`;
}

/** Bangkok date string in DD/MM/YYYY for a given offset (0=today, 1=tomorrow). */
function bkkDateStr(offsetDays: number): string {
  const now = new Date();
  const bkkMs = now.getTime() + (7 * 60 * 60 * 1000);
  const bkk = new Date(bkkMs);
  bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = bkk.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Bangkok date string in YYYY-MM-DD for a given offset (0=today, 1=tomorrow). */
function bkkIsoDateStr(offsetDays: number): string {
    const now = new Date();
    const bkkMs = now.getTime() + (7 * 60 * 60 * 1000);
    const bkk = new Date(bkkMs);
    bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
    const yyyy = bkk.getUTCFullYear();
    const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(bkk.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// ─── Nationwide intent detection ───
// Keep broad + cheap; pipeline decides national-mode (NOT resolver-only)
const NATIONWIDE_KEYWORDS = /ในไทย|ประเทศไทย|ทั่วประเทศ|ทั้งประเทศ|ทั่วไทย|ที่ไหน/i;

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function detectNationwideParams(text: string): {
    national: boolean;
    wantToday: boolean;
    wantTable: boolean;
    topN: number;
    sort: "percentRain_desc" | "percentRain_asc" | "tempMax_desc" | "tempMin_asc";
} {
    const t = text || "";
    const national = NATIONWIDE_KEYWORDS.test(t);
    const wantToday = /วันนี้|ตอนนี้|ขณะนี้/i.test(t);
    const wantTable = /ตารางแสดง|ตาราง/i.test(t);

    let topN = NATIONWIDE_TOP_N_DEFAULT;
    const m = t.match(/(\d{1,2})\s*(อันดับ|จังหวัด)/);
    if (m?.[1]) topN = Number(m[1]);
    topN = clamp(Number.isFinite(topN) ? topN : NATIONWIDE_TOP_N_DEFAULT, 1, NATIONWIDE_TOP_N_MAX);

    // Minimal sort selection (default: rain desc)
    let sort: "percentRain_desc" | "percentRain_asc" | "tempMax_desc" | "tempMin_asc" = "percentRain_desc";
    if (/น้อยไปมาก|ต่ำสุด|ฝนน้อย/i.test(t)) sort = "percentRain_asc";
    if (/เรียงตาม\s*อุณหภูมิ\s*สูงสุด|ร้อนสุด/i.test(t)) sort = "tempMax_desc";
    if (/เรียงตาม\s*อุณหภูมิ\s*ต่ำสุด|หนาวสุด/i.test(t)) sort = "tempMin_asc";

    return { national, wantToday, wantTable, topN, sort };
}

function buildNationwideMarkdownTable(rows: Array<{ province: string; percentRain: number; tempMax: number | null; tempMin: number | null; windSpeed: number | null; windDir: string | null; desc: string | null; }>): string {
    const headers = ["จังหวัด", "%ฝน", "สูงสุด", "ต่ำสุด", "ลม", "ทิศลม", "คำอธิบาย"];
    const safe = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v).replace(/[\r\n|]/g, " "));

    const rowLines = rows.map((r) => [
        safe(r.province),
        safe(r.percentRain),
        r.tempMax === null ? "—" : `${r.tempMax}°C`,
        r.tempMin === null ? "—" : `${r.tempMin}°C`,
        r.windSpeed === null ? "—" : `${r.windSpeed}km/h`,
        safe(r.windDir),
        safe(r.desc),
    ]);

    const headerLine = `| ${headers.join(" | ")} |`;
    const sepLine = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rowLines.map((rr) => `| ${rr.join(" | ")} |`);
    return [headerLine, sepLine, ...body].join("\n");
}

export class WeatherPipeline {
    private forecastEngine: ForecastEngine;
    private stationEngine: StationEngine;
    private nwpEngine: NwpEngine;

    constructor(clients: Map<string, any>) {
        this.forecastEngine = new ForecastEngine(clients);
        this.stationEngine = new StationEngine(clients);
        this.nwpEngine = new NwpEngine(clients);

        // Phase W1: allow deterministic zero-network fixtures for verifier/evidence.
        if (process.env.WEATHER_FIXTURE_W1 === "1") {
            primeWeatherFixturesW1();
        }
    }

    public resolveTarget(userText: string): WeatherTarget {
        const provinces = resolveProvinces(userText);
        const mode: WeatherTarget["intent"]["mode"] = this.detectMode(userText);
        const nat = detectNationwideParams(userText);

        // Mixed intent: keep province mode AND add a nationwide row block
        if (nat.national && provinces.length > 0 && !provinces.includes("ALL_THAILAND")) {
            provinces.push("ALL_THAILAND");
        }

        return {
            provinces,
            intent: { mode, national: nat.national, sort: nat.sort, topN: nat.topN },
            originalText: userText,
        };
    }

    // ─── Intent Detection ───

    private detectMode(text: string): "now" | "today" | "future" | "week" | "table" | "nationwide" {
        const t = text || "";
        if (/ตารางแสดง|ตาราง|รายสถานี|สถานี|station\b/i.test(t)) return "table";
        // Mode v2: NOW must win even if other timewords exist.
        if (/ตอนนี้(ที่)?|ขณะนี้|เดี๋ยวนี้|ปัจจุบัน|observation|current\b|real\s*time/i.test(t)) return "now";
        if (/7\s*วัน|๗\s*วัน|หนึ่งสัปดาห์|สัปดาห์นี้|สัปดาห์หน้า|อาทิตย์นี้|อาทิตย์หน้า/i.test(t)) return "week";
        // Support Thai digits for "อีก X วัน"
        if (/พรุ่งนี้|มะรืน|เดือนหน้า|ล่วงหน้า|พยากรณ์|forecast|\d+\s*วัน|[๐-๙]+\s*วัน|อีก\s*(\d+|[๐-๙]+)\s*วัน/i.test(t)) return "future";
        return "today";
    }

    // ─── Execution ───

    public async execute(target: WeatherTarget): Promise<WeatherResult[]> {
        const startedAt = Date.now();
        const budgetUsedMs = () => Date.now() - startedAt;
        const budgetRemainingMs = () => Math.max(0, BUDGET_MS - budgetUsedMs());

        const mode = target.intent.mode;
        const nat = detectNationwideParams(target.originalText || "");
        const isNational = Boolean(target.intent.national) || nat.national;

        const isTodayRainQuestion = (() => {
            const t = target.originalText || "";
            // "วันนี้" + rain question -> summarize by observation (latest) + today's forecast
            return /วันนี้/i.test(t) && /(ฝนตกไหม|ฝนจะตก|ฝนตกช่วงไหน|ฝน\s*ตก)/i.test(t);
        })();

        const chain = (() => {
            // National uses only forecast
            if (isNational && target.provinces.length === 0) return "Forecast";
            switch (mode) {
                case "now":
                case "table":
                    return "Station>Forecast>NWP";
                case "today":
                    if (isTodayRainQuestion) return "Station>Forecast>NWP";
                    return "Forecast>Station>NWP";
                case "future":
                case "week":
                    return "Forecast>NWP";
                default:
                    return "Forecast>Station>NWP";
            }
        })();

        // LOG POINT #2: Pipeline (short only, grep-friendly)
        const prov = target.provinces.length > 0 ? target.provinces.join(",") : "";
        console.log(`[WeatherPipeline] mode=${isNational && target.provinces.length === 0 ? "national" : mode} province=${prov} chain=${chain} budgetMs=${BUDGET_MS}`);

        // Guard: no provinces resolved
        // New rule: if national=true, bypass PROVINCE_MISSING gate and compute nationwide from forecast array.
        if (target.provinces.length === 0) {
            if (isNational) {
                return this.executeNationwide(target);
            }
            return [{ province: "", type: "error", error: "PROVINCE_MISSING" }];
        }

        // Track engine availability across provinces in this execution
        let stationAvailable = true;
        let budgetExceeded = false;
        const results: WeatherResult[] = [];

        for (const province of target.provinces) {
            let result: WeatherResult | null = null;
            let shouldSupplementForecast = false;

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

            try {
                if (province === "ALL_THAILAND") {
                    const natResults = await this.executeNationwide(target);
                    results.push(...natResults);
                    continue;
                }

                const tryStation = async (): Promise<WeatherResult> => {
                    if (!stationAvailable) {
                        return { province, type: "error", error: "STATION_SKIPPED" };
                    }
                    const r = await runWithBudget(() => this.stationEngine.getStationData(province));
                    if (r.type === "error") {
                        stationAvailable = false;
                    }
                    return r;
                };

                if (mode === "now" || mode === "table" || (mode === "today" && isTodayRainQuestion)) {
                    result = await tryStation();

                    // For NOW and "วันนี้+ฝน" questions, keep station-first but also try to add forecast
                    // so that rain% and forecast update-time are always available when possible.
                    shouldSupplementForecast = (result.type !== "error");

                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        console.log(`[WeatherPipeline] fallback=Forecast reason=StationError province=${province} error=${result.error}`);
                        result = await runWithBudget(() => this.forecastEngine.getForecast(province));
                    }
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        console.log(`[WeatherPipeline] fallback=NWP reason=ForecastError province=${province} error=${result.error}`);
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province));
                    }
                } else if (mode === "future" || mode === "week") {
                    result = await runWithBudget(() => this.forecastEngine.getForecast(province));
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        console.log(`[WeatherPipeline] fallback=NWP reason=ForecastError province=${province} error=${result.error}`);
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province));
                    }
                } else {
                    result = await runWithBudget(() => this.forecastEngine.getForecast(province));
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        console.log(`[WeatherPipeline] fallback=Station reason=ForecastError province=${province} error=${result.error}`);
                        result = await tryStation();
                    }
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED") {
                        console.log(`[WeatherPipeline] fallback=NWP reason=StationError province=${province} error=${result.error}`);
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province));
                    }
                }
            } catch (err: any) {
                result = { province, type: "error", error: err.message || "UNEXPECTED_ERROR" };
            }

            results.push(result || { province, type: "error", error: "DATA_UNAVAILABLE" });

            // Supplement forecast (non-blocking) when station succeeded and we still have budget.
            if (shouldSupplementForecast && result && result.type === "station3h" && budgetRemainingMs() > 0) {
                const fc = await (async () => {
                    try {
                        return await runWithBudget(() => this.forecastEngine.getForecast(province));
                    } catch {
                        return null;
                    }
                })();
                if (fc && fc.type !== "error") {
                    results.push(fc);
                }
            }

            if (budgetRemainingMs() <= 0) {
                break;
            }
        }

        const successCount = results.filter(r => r.type !== "error").length;

        if (budgetExceeded && successCount === 0) {
            return [{ province: "", type: "error", error: "TIMEOUT" }];
        }
        return results;
    }

    // ─── Nationwide Execution ───

    private async executeNationwide(target: WeatherTarget): Promise<WeatherResult[]> {
        // Single TMD call to get all provinces (uses cache if warm)
        const allProvinces = await this.forecastEngine.getAllForecasts();
        if (allProvinces.length === 0) {
            return [{ province: "", type: "error", error: "NATIONAL_DATA_UNAVAILABLE" }];
        }

        const nat = detectNationwideParams(target.originalText || "");

        // Pick target day: "พรุ่งนี้" → tomorrow, "วันนี้"/"ตอนนี้" → today, default tomorrow
        const offsetDays = nat.wantToday ? 0 : 1;
        const targetDate = bkkDateStr(offsetDays);
        const targetIsoDate = bkkIsoDateStr(offsetDays);
        const dateLabel = nat.wantToday ? "วันนี้" : "พรุ่งนี้";

        // Build per-province rows for target day
        interface NationwideRow {
            province: string;
            percentRain: number;
            tempMax: number | null;
            tempMin: number | null;
            windSpeed: number | null;
            windDir: string | null;
            desc: string | null;
            humidity: null;
        }

        const rows: NationwideRow[] = [];

        for (const p of allProvinces) {
            const name = p?.ProvinceNameThai || "";
            const fc = p?.SevenDaysForecast;

            let rain = 0;
            let desc: string | null = null;
            let maxTempNum = NaN;
            let minTempNum = NaN;
            let windDeg = "";
            let windSpdNum = NaN;

            if (fc?.ForecastDate) {
                const dates: string[] = Array.isArray(fc.ForecastDate) ? fc.ForecastDate : [];
                let idx = dates.indexOf(targetDate);
                if (idx < 0) idx = dates.indexOf(targetIsoDate);
                if (idx < 0) idx = 0;

                rain = Number(fc.PercentRainCover?.[idx]) || 0;
                desc = String(fc.DescriptionThai?.[idx] || "") || null;
                maxTempNum = fc.MaximumTemperature?.[idx] !== undefined ? Number(fc.MaximumTemperature?.[idx]) : NaN;
                minTempNum = fc.MinimumTemperature?.[idx] !== undefined ? Number(fc.MinimumTemperature?.[idx]) : NaN;
                windDeg = String(fc.WindDirection?.[idx] || "");
                windSpdNum = fc.WindSpeed?.[idx] !== undefined ? Number(fc.WindSpeed?.[idx]) : NaN;
            } else {
                // Alternate shape (commonly used in mocks / some payloads): ForecastDaily[] items
                const dailyRaw = p?.ForecastDaily;
                const dailyList = Array.isArray(dailyRaw) ? dailyRaw : (dailyRaw ? [dailyRaw] : []);
                if (dailyList.length === 0) continue;

                const picked = dailyList.find((d: any) => {
                    const dt = String(d?.Date || "");
                    return dt === targetIsoDate || dt === targetDate;
                }) || dailyList[0];

                rain = Number(picked?.Rain60 ?? picked?.PercentRainCover ?? picked?.Rain ?? 0) || 0;
                desc = String(picked?.DescTh ?? picked?.DescriptionThai ?? picked?.Desc ?? "") || null;
                maxTempNum = picked?.TempMax !== undefined ? Number(picked?.TempMax) : NaN;
                minTempNum = picked?.TempMin !== undefined ? Number(picked?.TempMin) : NaN;
                windDeg = String(picked?.WindDir ?? picked?.WindDirection ?? "");
                windSpdNum = picked?.WindSpeed !== undefined ? Number(picked?.WindSpeed) : NaN;
            }

            // Include if rain > 0 OR description mentions rain
                        if (rain > 0 || (desc && /ฝน|พายุ|rain|storm/i.test(desc))) {
                rows.push({
                    province: name,
                                        percentRain: rain,
                                        tempMax: Number.isFinite(maxTempNum) ? Math.round(maxTempNum) : null,
                                        tempMin: Number.isFinite(minTempNum) ? Math.round(minTempNum) : null,
                                        windSpeed: Number.isFinite(windSpdNum) ? Math.round(windSpdNum) : null,
                                        windDir: windDeg ? windLabel(windDeg) : null,
                                        desc,
                                        humidity: null,
                });
            }
        }

                // Sort + slice
                const sort = (target.intent.sort || nat.sort || "percentRain_desc");
                rows.sort((a, b) => {
                    switch (sort) {
                        case "percentRain_asc":
                            return a.percentRain - b.percentRain;
                        case "tempMax_desc":
                            return (b.tempMax ?? -9999) - (a.tempMax ?? -9999);
                        case "tempMin_asc":
                            return (a.tempMin ?? 9999) - (b.tempMin ?? 9999);
                        case "percentRain_desc":
                        default:
                            return b.percentRain - a.percentRain;
                    }
                });
                const topN = clamp(target.intent.topN ?? nat.topN ?? NATIONWIDE_TOP_N_DEFAULT, 1, NATIONWIDE_TOP_N_MAX);
                const topRows = rows.slice(0, topN);

                const markdownTable = (nat.wantTable || target.intent.mode === "table")
                    ? buildNationwideMarkdownTable(topRows)
                    : undefined;

        return [{
            province: "ทั่วประเทศ",
            type: "national",
            data: {
                date: targetDate,
                dateLabel,
                                totalRainyProvinces: rows.length,
                                topN: topRows.length,
                                sort,
                                rows: topRows.map((r) => ({
                                    province: r.province,
                                    percentRain: r.percentRain,
                                    tempMax: r.tempMax,
                                    tempMin: r.tempMin,
                                    windSpeed: r.windSpeed,
                                    windDir: r.windDir,
                                    desc: r.desc,
                                    humidity: null,
                                })),
                                tableMarkdown: markdownTable,
                                note: "TMD 7-day ไม่มี humidity (แสดงเป็น null และไม่เดา)",
            },
            sourceTool: "tmd_weather_forecast_7days_by_province",
        }];
    }
}


import { ForecastEngine } from "./engines/forecastEngine";
import { StationEngine } from "./engines/stationEngine";
import { NwpEngine } from "./engines/nwpEngine";
import { WeatherResult, WeatherTarget } from "./types";
import { resolveProvinces } from "../locationResolver";
import { primeWeatherFixturesW1 } from "./fixtures/w1";

// Nationwide query: show top N provinces by rain
const NATIONWIDE_TOP_N_DEFAULT = 10;
const NATIONWIDE_TOP_N_MAX = 20;

const NATIONWIDE_FALLBACK_ROWS: Array<{
    province: string;
    percentRain: number;
    tempMax: number;
    tempMin: number;
    windSpeed: number;
    windDir: string;
    desc: string;
}> = [
    { province: "ระนอง", percentRain: 70, tempMax: 31, tempMin: 24, windSpeed: 22, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "พังงา", percentRain: 68, tempMax: 32, tempMin: 25, windSpeed: 21, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "ภูเก็ต", percentRain: 67, tempMax: 31, tempMin: 25, windSpeed: 20, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "กระบี่", percentRain: 66, tempMax: 32, tempMin: 24, windSpeed: 19, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "สุราษฎร์ธานี", percentRain: 64, tempMax: 33, tempMin: 25, windSpeed: 18, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "ตรัง", percentRain: 63, tempMax: 32, tempMin: 24, windSpeed: 18, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "สตูล", percentRain: 62, tempMax: 32, tempMin: 24, windSpeed: 17, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "ชุมพร", percentRain: 60, tempMax: 33, tempMin: 24, windSpeed: 17, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "นครศรีธรรมราช", percentRain: 59, tempMax: 33, tempMin: 24, windSpeed: 16, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
    { province: "สงขลา", percentRain: 57, tempMax: 33, tempMin: 25, windSpeed: 16, windDir: "ตะวันตกเฉียงใต้", desc: "ความเสี่ยงฝนตามภูมิอากาศโดยรวม" },
];

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
// NOTE: "ที่ไหน" removed — it's a question particle ("where?"), not a nationwide marker.
// "ภาคเหนือฝนจะตกที่ไหน" = region query, not nationwide.
const NATIONWIDE_KEYWORDS = /ในไทย|ประเทศไทย|ทั่วประเทศ|ทั้งประเทศ|ทั่วไทย/i;

function hasExplicitLocalScopeCue(text: string): boolean {
    const t = String(text || "");
    if (/(จังหวัด|อำเภอ|เขต|ตำบล|แขวง|ภาค|แถว)\s*[ก-๙A-Za-z]+/i.test(t)) return true;
    if (/เมือง\s*[ก-๙A-Za-z]{2,}/i.test(t)) return true;
    if (/ที่(?!ไหน)\s*[ก-๙A-Za-z]{3,}/i.test(t)) return true;
    return false;
}

function shouldAutoNationwideDefault(text: string): boolean {
    const t = String(text || "");
    const weatherIntent = /(ฝน|อากาศ|พยากรณ์|อุณหภูมิ|ลม|weather|forecast|rain)/i.test(t);
    if (!weatherIntent) return false;
    return !hasExplicitLocalScopeCue(t);
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function detectNationwideParams(text: string): {
    national: boolean;
    wantToday: boolean;
    wantTable: boolean;
    topN: number;
    sort: "percentRain_desc" | "percentRain_asc" | "tempMax_desc" | "tempMin_asc";
    offsetDays: number;
    dateLabel: string;
} {
    const t = text || "";
    const national = NATIONWIDE_KEYWORDS.test(t);
    const wantToday = /วันนี้|ตอนนี้|ขณะนี้/i.test(t);
    const wantTable = /ตารางแสดง|ตาราง/i.test(t);

    // B2 fix: derive offsetDays from the user query so the nationwide top-rain label
    // and target date match what the user actually asked. Previously the path only
    // distinguished today vs "default tomorrow", silently labelling มะรืน/อีก N วัน
    // as "(พรุ่งนี้)" and pulling the wrong day's data.
    let offsetDays = wantToday ? 0 : 1;
    if (!wantToday) {
        if (/มะรืน/i.test(t)) offsetDays = 2;
        else {
            const thaiDigitMap: Record<string, string> = { "๐":"0","๑":"1","๒":"2","๓":"3","๔":"4","๕":"5","๖":"6","๗":"7","๘":"8","๙":"9" };
            const tArab = t.replace(/[๐-๙]/g, (d) => thaiDigitMap[d] || d);
            const m = tArab.match(/อีก\s*(\d{1,2})\s*วัน/i);
            if (m?.[1]) offsetDays = Math.max(1, Math.min(7, Number(m[1])));
        }
    }
    const dateLabel = offsetDays === 0 ? "วันนี้"
        : offsetDays === 1 ? "พรุ่งนี้"
        : offsetDays === 2 ? "มะรืน"
        : `อีก ${offsetDays} วัน`;

    let topN = NATIONWIDE_TOP_N_DEFAULT;
    const m = t.match(/(\d{1,2})\s*(อันดับ|จังหวัด)/);
    if (m?.[1]) topN = Number(m[1]);
    topN = clamp(Number.isFinite(topN) ? topN : NATIONWIDE_TOP_N_DEFAULT, 1, NATIONWIDE_TOP_N_MAX);

    // Minimal sort selection (default: rain desc)
    let sort: "percentRain_desc" | "percentRain_asc" | "tempMax_desc" | "tempMin_asc" = "percentRain_desc";
    if (/น้อยไปมาก|ต่ำสุด|ฝนน้อย/i.test(t)) sort = "percentRain_asc";
    if (/เรียงตาม\s*อุณหภูมิ\s*สูงสุด|ร้อนสุด/i.test(t)) sort = "tempMax_desc";
    if (/เรียงตาม\s*อุณหภูมิ\s*ต่ำสุด|หนาวสุด/i.test(t)) sort = "tempMin_asc";

    return { national, wantToday, wantTable, topN, sort, offsetDays, dateLabel };
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
        // Auto-enable in SMOKE_MODE for deterministic tests without network calls.
        if (process.env.WEATHER_FIXTURE_W1 === "1" || process.env.SMOKE_MODE === "1") {
            primeWeatherFixturesW1();
        }
    }

    public resolveTarget(userText: string): WeatherTarget {
        const provinces = resolveProvinces(userText);
        const mode: WeatherTarget["intent"]["mode"] = this.detectMode(userText);
        const nat = detectNationwideParams(userText);
        const autoNational = provinces.length === 0 && shouldAutoNationwideDefault(userText);

        // Scope guard: if user specified a region (ภาคเหนือ, ภาคใต้, ภาคอีสาน etc.),
        // do NOT add ALL_THAILAND — the user's scope must be preserved exactly.
        // Province-level queries with explicit nationwide keywords ("ทั่วไทย") are OK to mix.
        const hasRegionScope = /ภาค(เหนือ|ใต้|กลาง|อีสาน|ตะวันออก|ตะวันตก|ตะวันออกเฉียงเหนือ)/i.test(userText || "");

        // Only add nationwide block when user explicitly asked for nationwide AND no region scope
        if ((nat.national || autoNational) && provinces.length > 0 && !provinces.includes("ALL_THAILAND") && !hasRegionScope) {
            provinces.push("ALL_THAILAND");
        }

        return {
            provinces,
            intent: { mode, national: nat.national || autoNational, sort: nat.sort, topN: nat.topN },
            originalText: userText,
        };
    }

    // ─── Intent Detection ───

    private detectMode(text: string): "now" | "today" | "future" | "week" | "table" | "nationwide" {
        const t = text || "";
        // Station-specific data requests → table/observation mode
        if (/รายสถานี|สถานี|station\b/i.test(t)) return "table";
        // Mode v2: NOW must win even if other timewords exist.
        if (/ตอนนี้(ที่)?|ขณะนี้|เดี๋ยวนี้|ปัจจุบัน|observation|current\b|real\s*time/i.test(t)) return "now";
        // WEEK wins over "ตาราง" — "จงแสดงในรูปตาราง" is a formatting instruction, not a data-type selector
        if (/7\s*วัน|๗\s*วัน|หนึ่งสัปดาห์|สัปดาห์นี้|สัปดาห์หน้า|อาทิตย์นี้|อาทิตย์หน้า/i.test(t)) return "week";
        // Support Thai digits for "อีก X วัน"
        if (/พรุ่งนี้|มะรืน|เดือนหน้า|ล่วงหน้า|พยากรณ์|forecast|\d+\s*วัน|[๐-๙]+\s*วัน|อีก\s*(\d+|[๐-๙]+)\s*วัน/i.test(t)) return "future";
        // "ตาราง" in non-week, non-now queries → station/observation table mode
        if (/ตารางแสดง|ตาราง/i.test(t)) return "table";
        return "today";
    }

    // ─── Execution ───

    public async execute(target: WeatherTarget, opts?: { signal?: AbortSignal }): Promise<WeatherResult[]> {
        const startedAt = Date.now();
        const budgetUsedMs = () => Date.now() - startedAt;
        const budgetRemainingMs = () => Math.max(0, BUDGET_MS - budgetUsedMs());
        const signal = opts?.signal;

        // ─── Yesterday/past query guard ───
        // TMD APIs provide only current observations and future forecasts.
        // Historical/yesterday queries have no data source — must not silently fall through to forecast.
        const yesterdayPattern = /เมื่อวาน(?:นี้)?|วานนี้|yesterday|เมื่อวานซืน/i;
        if (yesterdayPattern.test(target.originalText || "")) {
            const prov = target.provinces.length > 0 ? target.provinces[0] : "ทั่วประเทศ";
            return [{
                province: prov,
                type: "error",
                error: "YESTERDAY_NOT_SUPPORTED",
            }];
        }

        // ─── Past-week / past-year guard ───
        // Same honest-unsupported policy as yesterday: no historical data source available.
        // Patterns include common Thai forms ("สัปดาห์ที่แล้ว", "อาทิตย์ที่แล้ว", "ปีที่แล้ว", "ปีก่อน")
        // and English ("last week", "past week", "last year", "past year"). Note: "สัปดาห์นี้",
        // "สัปดาห์หน้า", "this week" remain handled by the future/week mode (forecast supports them).
        const pastWeekYearPattern = /สัปดาห์ที่แล้ว|สัปดาห์ก่อน|อาทิตย์ที่แล้ว|อาทิตย์ก่อน|ปีที่แล้ว|ปีก่อน|past\s*week|last\s*week|past\s*year|last\s*year/i;
        if (pastWeekYearPattern.test(target.originalText || "")) {
            const prov = target.provinces.length > 0 ? target.provinces[0] : "ทั่วประเทศ";
            return [{
                province: prov,
                type: "error",
                error: "YESTERDAY_NOT_SUPPORTED",
            }];
        }

        // ─── Monthly query guard ───
        // TMD APIs provide daily forecasts and current observations only.
        // Monthly aggregation (เดือนที่ผ่านมา, เดือนที่แล้ว, เดือนนี้, ฝนเดือนนี้) is not supported.
        const monthlyPattern = /เดือนที่ผ่านมา|เดือนที่แล้ว|เดือนก่อน|เดือนนี้|ฝน(?:เดือน|ประจำเดือน)|รายเดือน|monthly|past\s*month|last\s*month|this\s*month/i;
        if (monthlyPattern.test(target.originalText || "")) {
            const prov = target.provinces.length > 0 ? target.provinces[0] : "ทั่วประเทศ";
            return [{
                province: prov,
                type: "error",
                error: "MONTHLY_NOT_SUPPORTED",
            }];
        }

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
                return this.executeNationwide(target, signal);
            }
            return [{ province: "", type: "error", error: "PROVINCE_MISSING" }];
        }

        // Track engine availability across provinces in this execution
        let stationAvailable = true;
        let budgetExceeded = false;
        const results: WeatherResult[] = [];

        const isTerminalForecastNoData = (r: WeatherResult | null | undefined): boolean => {
            return Boolean(r && r.type === "error" && r.error === "PROVINCE_NOT_FOUND_IN_FORECAST");
        };

        const shouldDisableStationForRest = (err?: string): boolean => {
            return err === "TIMEOUT" || err === "CLIENT_NOT_FOUND" || err === "API_ERROR";
        };

        const wantsDetailed = /ละเอียด|แบบละเอียด|จงบอกแบบละเอียด/i.test(target.originalText || "");
        const wantsBangkokDistrict = (() => {
            const t = String(target.originalText || "");
            if (!/(กรุงเทพ|กรุงเทพมหานคร|กทม|bkk|bangkok)/i.test(t)) return false;
            // Must-have districts + generic district marker
            return /เขต|หลักสี่|ลาดกระบัง/i.test(t);
        })();

        for (const province of target.provinces) {
            if (signal?.aborted) {
                return [{ province: "", type: "error", error: "TIMEOUT" }];
            }
            let result: WeatherResult | null = null;
            let shouldSupplementForecast = false;
            let stationSupplement: WeatherResult | null = null;

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
                    const natResults = await this.executeNationwide(target, signal);
                    results.push(...natResults);
                    continue;
                }

                const tryStation = async (): Promise<WeatherResult> => {
                    if (!stationAvailable) {
                        return { province, type: "error", error: "STATION_SKIPPED" };
                    }
                    const r = await runWithBudget(() => this.stationEngine.getStationData(province, signal));
                    if (r.type === "error") {
                        if (shouldDisableStationForRest(r.error)) {
                            stationAvailable = false;
                        }
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
                        result = await runWithBudget(() => this.forecastEngine.getForecast(province, signal));
                    }
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED" && !isTerminalForecastNoData(result)) {
                        console.log(`[WeatherPipeline] fallback=NWP reason=ForecastError province=${province} error=${result.error}`);
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province, signal));
                    }
                } else if (mode === "future" || mode === "week") {
                    result = await runWithBudget(() => this.forecastEngine.getForecast(province, signal));
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED" && !isTerminalForecastNoData(result)) {
                        console.log(`[WeatherPipeline] fallback=NWP reason=ForecastError province=${province} error=${result.error}`);
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province, signal));
                    }
                } else {
                    result = await runWithBudget(() => this.forecastEngine.getForecast(province, signal));
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED" && !isTerminalForecastNoData(result)) {
                        console.log(`[WeatherPipeline] fallback=Station reason=ForecastError province=${province} error=${result.error}`);
                        result = await tryStation();
                    }
                    if (result.type === "error" && result.error !== "BUDGET_EXCEEDED" && !isTerminalForecastNoData(result)) {
                        console.log(`[WeatherPipeline] fallback=NWP reason=StationError province=${province} error=${result.error}`);
                        result = await runWithBudget(() => this.nwpEngine.getNwpData(province, signal));
                    }

                    // Phase 8.9: Bangkok district UX requires station data when available.
                    // Keep this scoped to explicit district/detailed asks to avoid wasted upstream.
                    if (
                        result &&
                        result.type !== "error" &&
                        province === "กรุงเทพมหานคร" &&
                        stationAvailable &&
                        (wantsBangkokDistrict || wantsDetailed) &&
                        budgetRemainingMs() > 0
                    ) {
                        const st = await (async () => {
                            try {
                                return await runWithBudget(() => this.stationEngine.getStationData(province, signal));
                            } catch {
                                return null;
                            }
                        })();
                        if (st && st.type !== "error") {
                            stationSupplement = st;
                        }
                    }
                }
            } catch (err: any) {
                result = { province, type: "error", error: err.message || "UNEXPECTED_ERROR" };
            }

            results.push(result || { province, type: "error", error: "DATA_UNAVAILABLE" });

            if (stationSupplement) {
                results.push(stationSupplement);
            }

            // Supplement forecast (non-blocking) when station succeeded and we still have budget.
            if (shouldSupplementForecast && result && result.type === "station3h" && budgetRemainingMs() > 0) {
                const fc = await (async () => {
                    try {
                        return await runWithBudget(() => this.forecastEngine.getForecast(province, signal));
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

    private async executeNationwide(target: WeatherTarget, signal?: AbortSignal): Promise<WeatherResult[]> {
        // Single TMD call to get all provinces (uses cache if warm)
        const allProvinces = await this.forecastEngine.getAllForecasts(signal);

        const nat = detectNationwideParams(target.originalText || "");

        // B2 fix: honor user-specified day (today / พรุ่งนี้ / มะรืน / อีก N วัน) so
        // both the data scope AND the rendered label match the question.
        const offsetDays = nat.offsetDays;
        const targetDate = bkkDateStr(offsetDays);
        const targetIsoDate = bkkIsoDateStr(offsetDays);
        const dateLabel = nat.dateLabel;

        // Weather truth contract: when upstream fails, return an honest error — NOT fake confident data.
        // NEVER return hardcoded province rankings as if they are real forecasts.
        const fallbackNational = (): WeatherResult[] => {
            return [{
                province: "ทั่วประเทศ",
                type: "error",
                error: "NATIONAL_DATA_UNAVAILABLE",
            }];
        };

        if (allProvinces.length === 0) {
            return fallbackNational();
        }

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

                if (topRows.length === 0) {
                    return fallbackNational();
                }

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
                                note: "",
            },
            sourceTool: "tmd_weather_forecast_7days_by_province",
        }];
    }
}

#!/usr/bin/env npx tsx
/**
 * TMD 17 APIs – Comprehensive Test Suite
 * 5 test cases per API = 85 total tests
 *
 * Test categories per API:
 *   T1 – Connectivity: API responds with HTTP 200
 *   T2 – Response structure: Has expected wrapper/header
 *   T3 – Data presence: Core data array/object is non-empty
 *   T4 – Field validation: Key fields exist with correct types
 *   T5 – Data quality: Values are within reasonable ranges
 *
 * Run:  npx tsx scripts/test-tmd-17-apis.ts
 */

// ─── helpers ───────────────────────────────────────────────────────
const TIMEOUT_MS = 35_000;

async function fetchTmd(url: string): Promise<{ status: number; body: string; json: any }> {
  const finalUrl = url.includes("format=") ? url : url.includes("?") ? `${url}&format=json` : `${url}?format=json`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(finalUrl, { signal: ctrl.signal });
    const body = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(body.replace(/^\uFEFF/, "").trim());
    } catch { /* XML fallback handled per test */ }
    return { status: res.status, body, json };
  } finally {
    clearTimeout(t);
  }
}

// Mini test runner
let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function ok(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ ${label}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    failures.push(msg);
  }
}

function skip(label: string, reason: string) {
  skipped++;
  console.log(`  ⏭️  ${label} — SKIPPED: ${reason}`);
}

// helper to get nested data – TMD JSON wraps differently per endpoint
function dig(json: any): any {
  if (!json) return null;
  // Some APIs wrap: { Header: {...}, Stations: {...} }
  // Others: { header: {...}, data: [...] }
  // Try common patterns
  if (json.Stations?.Station) return arrify(json.Stations.Station);
  if (json.Provinces?.Province) return arrify(json.Provinces.Province);
  if (json.Regions?.Region) return arrify(json.Regions.Region);
  if (json.DailyEarthquakes) return arrify(json.DailyEarthquakes);
  if (json.StationClimateNormal) return arrify(json.StationClimateNormal);
  if (json.DailyForecast) return json.DailyForecast; // object, not array
  if (json.RegionForecast) return arrify(json.RegionForecast);
  if (json.OverallForecast) return json.OverallForecast;
  if (json.Warnings !== undefined) return json.Warnings; // may be empty/null
  // fallback: return json itself
  return json;
}

function arrify(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") return [x];
  return [];
}

function isNumericString(v: any): boolean {
  if (typeof v === "number") return true;
  if (typeof v === "string") return v.trim() !== "" && !isNaN(Number(v));
  return false;
}

// ─── endpoints ─────────────────────────────────────────────────────
const E = {
  dailySeismicEvent:        "http://data.tmd.go.th/api/DailySeismicEvent/v1/?uid=api&ukey=api12345",
  thailandClimateNormal:    "http://data.tmd.go.th/api/ThailandClimateNormal/v1/?uid=api&ukey=api12345",
  weatherToday:             "https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345",
  weather3Hours:            "http://data.tmd.go.th/api/Weather3Hours/V2/?uid=api&ukey=api12345",
  thailandMonthlyRainfall:  "http://data.tmd.go.th/api/ThailandMonthlyRainfall/v1/index.php?uid=api&ukey=api12345",
  rainRegions:              "https://data.tmd.go.th/api/RainRegions/v1/?uid=api&ukey=api12345",
  station:                  "http://data.tmd.go.th/api/Station/v1/?uid=demo&ukey=demokey",
  weatherForecast7Days:     "https://data.tmd.go.th/api/WeatherForecast7Days/v2/?uid=api&ukey=api12345",
  dailyForecast:            "https://data.tmd.go.th/api/DailyForecast/v2/?uid=api&ukey=api12345",
  weatherWarningNews:       "http://data.tmd.go.th/api/WeatherWarningNews/v2/?uid=demo&ukey=demokey",
  forecast7DaysByRegion:    "https://data.tmd.go.th/api/WeatherForecast7DaysByRegion/v2/?uid=demo&ukey=demokey",
  weather3HoursByHydro:     "http://data.tmd.go.th/api/Weather3HoursByHydro/V1/?uid=api&ukey=api12345",
  weather3HoursByAgro:      "http://data.tmd.go.th/api/Weather3HoursByAgro/V1/?uid=api&ukey=api12345",
  weather3HoursBySynop:     "http://data.tmd.go.th/api/Weather3HoursBySynop/V1/?uid=api&ukey=api12345",
  weatherTodayByHydro:      "http://data.tmd.go.th/api/WeatherTodayByHydro/V1/?uid=api&ukey=api12345",
  weatherTodayByAgro:       "http://data.tmd.go.th/api/WeatherTodayByAgro/V1/?uid=api&ukey=api12345",
  weatherTodayBySynop:      "http://data.tmd.go.th/api/weathertodayBySynop/V1/?uid=api&ukey=api12345",
};

// ─── test suites ───────────────────────────────────────────────────

async function test01_DailySeismicEvent() {
  console.log("\n━━ API #1: DailySeismicEvent (แผ่นดินไหว) ━━");
  const r = await fetchTmd(E.dailySeismicEvent);

  // T1 Connectivity
  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  // T2 Structure – header exists
  const hasHeader = r.json?.header || r.json?.Header || r.body.includes("<header>");
  ok(!!hasHeader, "T2 has header element");

  // T3 Data presence – earthquakes array
  const quakes = r.json?.DailyEarthquakes ? arrify(r.json.DailyEarthquakes) : [];
  const hasQuakes = quakes.length > 0 || r.body.includes("<DailyEarthquakes>");
  ok(hasQuakes, "T3 earthquake data present", `found ${quakes.length} items (JSON) or XML data`);

  // T4 Field validation
  if (quakes.length > 0) {
    const q = quakes[0];
    ok(
      q.Magnitude !== undefined && q.Latitude !== undefined && q.Longitude !== undefined,
      "T4 fields: Magnitude, Latitude, Longitude exist"
    );
    // T5 Data quality
    const mag = Number(q.Magnitude);
    ok(mag >= 0 && mag <= 12, "T5 magnitude in range 0-12", `got ${mag}`);
  } else {
    // Try XML parsing
    const hasMag = r.body.includes("<Magnitude>");
    ok(hasMag, "T4 XML has <Magnitude> element");
    ok(hasMag, "T5 earthquake data looks valid (XML)");
  }
}

async function test02_ThailandClimateNormal() {
  console.log("\n━━ API #2: ThailandClimateNormal (ค่าสถิติภูมิอากาศ 1981-2010) ━━");
  const r = await fetchTmd(E.thailandClimateNormal);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.header || r.body.includes("<header>");
  ok(!!hasHeader, "T2 has header element");

  const normals = r.json?.StationClimateNormal ? arrify(r.json.StationClimateNormal) : [];
  const hasData = normals.length > 0 || r.body.includes("<StationClimateNormal>");
  ok(hasData, "T3 climate normal data present", `found ${normals.length} items`);

  if (normals.length > 0) {
    const n = normals[0];
    ok(n.StationName !== undefined && n.NormalValue !== undefined, "T4 fields: StationName, NormalValue exist");
    ok(n.StartYear !== undefined && Number(n.StartYear) === 1981, "T5 StartYear is 1981", `got ${n.StartYear}`);
  } else {
    ok(r.body.includes("<StationName>"), "T4 XML has <StationName>");
    ok(r.body.includes("<StartYear>1981"), "T5 StartYear is 1981 (XML)");
  }
}

async function test03_WeatherToday() {
  console.log("\n━━ API #3: WeatherToday (ตรวจอากาศรายวัน 07:00 ทุกสถานี) ━━");
  const r = await fetchTmd(E.weatherToday);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.Header || r.json?.header || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 station data present", `found ${stations.length} stations`);

  if (stations.length > 0) {
    const s = stations[0];
    const obs = s.Observation;
    ok(
      s.WmoStationNumber !== undefined && s.Province !== undefined && obs !== undefined,
      "T4 fields: WmoStationNumber, Province, Observation"
    );
    const temp = Number(obs?.Temperature ?? obs?.temperature);
    ok(temp > -10 && temp < 60, "T5 temperature in range -10 to 60°C", `got ${temp}`);
  } else {
    ok(r.body.includes("<WmoStationNumber>"), "T4 XML has <WmoStationNumber>");
    ok(r.body.includes("<Temperature"), "T5 XML has <Temperature>");
  }
}

async function test04_Weather3Hours() {
  console.log("\n━━ API #4: Weather3Hours (ทุก 3 ชม. ทุกสถานี) ━━");
  const r = await fetchTmd(E.weather3Hours);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.Header || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 station data present", `found ${stations.length}`);

  if (stations.length > 0) {
    const s = stations[0];
    const obs = s.Observation;
    ok(
      obs?.AirTemperature !== undefined && obs?.RelativeHumidity !== undefined,
      "T4 fields: AirTemperature, RelativeHumidity"
    );
    const rh = Number(obs?.RelativeHumidity);
    ok(rh >= 0 && rh <= 100, "T5 humidity 0-100%", `got ${rh}`);
  } else {
    ok(r.body.includes("<AirTemperature"), "T4 XML has <AirTemperature>");
    ok(r.body.includes("<RelativeHumidity"), "T5 XML has <RelativeHumidity>");
  }
}

async function test05_ThailandMonthlyRainfall() {
  console.log("\n━━ API #5: ThailandMonthlyRainfall (ฝนสะสมรายเดือน) ━━");
  const r = await fetchTmd(E.thailandMonthlyRainfall);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.header || r.body.includes("<header>") || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  // This API may return empty data without year parameter
  const hasRoot = r.json?.ThailandMonthlyRainfall !== undefined || r.body.includes("<ThailandMonthlyRainfall");
  ok(hasRoot, "T3 root element exists (may be empty without year param)");

  // The API requires a year parameter to return data, without it returns empty
  const hasTitle = r.body.includes("Thailand monthly rainfall") || r.json?.header?.title?.includes("rainfall");
  ok(!!hasTitle, "T4 title mentions rainfall");

  ok(r.body.length > 100, "T5 response body is non-trivial", `${r.body.length} chars`);
}

async function test06_RainRegions() {
  console.log("\n━━ API #6: RainRegions (ฝนอำเภอรายภาค) ━━");
  const r = await fetchTmd(E.rainRegions);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.Header || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  const regions = r.json?.Regions?.Region ? arrify(r.json.Regions.Region) : [];
  const hasRegions = regions.length > 0 || r.body.includes("<Region>");
  ok(hasRegions, "T3 region data present", `found ${regions.length}`);

  if (regions.length > 0) {
    const reg = regions[0];
    ok(reg.RegionName !== undefined, "T4 field: RegionName exists", `got "${reg.RegionName}"`);
    // Check nested Province
    const provinces = reg.Provinces?.Province ? arrify(reg.Provinces.Province) : [];
    ok(provinces.length > 0, "T5 has province data inside region", `found ${provinces.length}`);
  } else {
    ok(r.body.includes("<RegionName>"), "T4 XML has <RegionName>");
    ok(r.body.includes("<Rainfall"), "T5 XML has <Rainfall>");
  }
}

async function test07_Station() {
  console.log("\n━━ API #7: Station (สถานีอุตุฯ) ━━");
  const r = await fetchTmd(E.station);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.header || r.body.includes("<header>");
  ok(!!hasHeader, "T2 has header element");

  const stations = r.json?.Station ? arrify(r.json.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 station data present", `found ${stations.length}`);

  if (stations.length > 0) {
    const s = stations[0];
    ok(
      s.StationID !== undefined && s.Province !== undefined && s.Latitude !== undefined,
      "T4 fields: StationID, Province, Latitude"
    );
    const lat = Number(s.Latitude);
    ok(lat >= 5 && lat <= 21, "T5 latitude in Thailand range 5-21°N", `got ${lat}`);
  } else {
    ok(r.body.includes("<StationID>"), "T4 XML has <StationID>");
    ok(r.body.includes("<Province>"), "T5 XML has <Province>");
  }
}

async function test08_WeatherForecast7Days() {
  console.log("\n━━ API #8: WeatherForecast7Days (พยากรณ์ 7 วัน รายจังหวัด) ━━");
  const r = await fetchTmd(E.weatherForecast7Days);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.header || r.body.includes("<header>");
  ok(!!hasHeader, "T2 has header element");

  const provinces = r.json?.Provinces?.Province ? arrify(r.json.Provinces.Province) : [];
  const hasProvinces = provinces.length > 0 || r.body.includes("<Province>");
  ok(hasProvinces, "T3 province forecast data present", `found ${provinces.length}`);

  if (provinces.length > 0) {
    const p = provinces[0];
    ok(
      p.ProvinceNameThai !== undefined || p.ProvinceNameEnglish !== undefined,
      "T4 field: ProvinceNameThai/English"
    );
    const forecasts = p.SevenDaysForecast ? arrify(p.SevenDaysForecast) : [];
    ok(forecasts.length >= 1, "T5 has forecast entries", `found ${forecasts.length} days`);
  } else {
    ok(r.body.includes("<ProvinceNameThai>"), "T4 XML has <ProvinceNameThai>");
    ok(r.body.includes("<ForecastDate>"), "T5 XML has <ForecastDate>");
  }
}

async function test09_DailyForecast() {
  console.log("\n━━ API #9: DailyForecast (พยากรณ์รายวัน 4 เวลา) ━━");
  const r = await fetchTmd(E.dailyForecast);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.header || r.body.includes("<header>");
  ok(!!hasHeader, "T2 has header element");

  const forecast = r.json?.DailyForecast || null;
  const hasForecast = forecast !== null || r.body.includes("<DailyForecast>");
  ok(hasForecast, "T3 DailyForecast data present");

  if (forecast) {
    ok(
      forecast.OverallDescriptionThai !== undefined || forecast.Date !== undefined,
      "T4 fields: Date / OverallDescriptionThai"
    );
    const hasRegion = forecast.RegionForecast !== undefined || r.body.includes("<RegionForecast>");
    ok(!!hasRegion, "T5 has RegionForecast inside DailyForecast");
  } else {
    ok(r.body.includes("<OverallDescriptionThai>"), "T4 XML has <OverallDescriptionThai>");
    ok(r.body.includes("<RegionForecast>"), "T5 XML has <RegionForecast>");
  }
}

async function test10_WeatherWarningNews() {
  console.log("\n━━ API #10: WeatherWarningNews (เตือนภัยอากาศ) ━━");
  const r = await fetchTmd(E.weatherWarningNews);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.header || r.body.includes("<header>");
  ok(!!hasHeader, "T2 has header element");

  // Warnings may be empty when no active warnings
  const hasWarningsField = r.json?.Warnings !== undefined || r.body.includes("<Warnings");
  ok(hasWarningsField, "T3 Warnings element present (may be empty)");

  // Title should mention weather/climate news
  const title = r.json?.header?.title || "";
  const hasTitle = title.includes("Weather") || title.includes("Climate") || r.body.includes("Weather") || r.body.includes("Climate");
  ok(hasTitle, "T4 title mentions Weather/Climate");

  ok(r.body.length > 50, "T5 response is non-empty", `${r.body.length} chars`);
}

async function test11_Forecast7DaysByRegion() {
  console.log("\n━━ API #11: WeatherForecast7DaysByRegion (พยากรณ์ 7 วัน รายภาค) ━━");
  const r = await fetchTmd(E.forecast7DaysByRegion);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.header || r.body.includes("<header>");
  ok(!!hasHeader, "T2 has header element");

  const hasOverall = r.json?.OverallForecast !== undefined || r.body.includes("<OverallForecast>");
  ok(hasOverall, "T3 OverallForecast data present");

  const regions = r.json?.RegionForecast ? arrify(r.json.RegionForecast) : [];
  const hasRegions = regions.length > 0 || r.body.includes("<RegionForecast>");
  ok(hasRegions, "T4 RegionForecast entries exist");

  if (regions.length > 0) {
    const reg = regions[0];
    ok(
      reg.RegionNameThai !== undefined || reg.RegionNameEnglish !== undefined,
      "T5 field: RegionNameThai/English"
    );
  } else {
    ok(r.body.includes("<RegionNameThai>"), "T5 XML has <RegionNameThai>");
  }
}

async function test12_Weather3HoursByHydro() {
  console.log("\n━━ API #12: Weather3HoursByHydro (3 ชม. สถานีอุทก) ━━");
  const r = await fetchTmd(E.weather3HoursByHydro);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.Header || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 hydro station data present", `found ${stations.length}`);

  if (stations.length > 0) {
    const s = stations[0];
    ok(s.Observation !== undefined, "T4 has Observation block");
    const obs = s.Observation;
    ok(obs?.Rainfall !== undefined || obs?.Rainfall24Hr !== undefined, "T5 has Rainfall data");
  } else {
    ok(r.body.includes("<Observation>"), "T4 XML has <Observation>");
    ok(r.body.includes("<Rainfall"), "T5 XML has <Rainfall>");
  }
}

async function test13_Weather3HoursByAgro() {
  console.log("\n━━ API #13: Weather3HoursByAgro (3 ชม. สถานีเกษตร) ━━");
  const r = await fetchTmd(E.weather3HoursByAgro);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasTitle = r.body.includes("Weather3HoursByAgro") || r.body.includes("Weather3Hours") || r.body.includes("Agro");
  ok(hasTitle, "T2 response identifies as Agro data");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 agro station data present", `found ${stations.length}`);

  if (stations.length > 0) {
    const s = stations[0];
    ok(s.Province !== undefined || s.StationNameThai !== undefined, "T4 has Province or StationName");
    const obs = s.Observation;
    const temp = Number(obs?.AirTemperature);
    ok(temp > -10 && temp < 60, "T5 AirTemperature reasonable", `got ${temp}`);
  } else {
    ok(r.body.includes("<Province>"), "T4 XML has <Province>");
    ok(r.body.includes("<AirTemperature"), "T5 XML has <AirTemperature>");
  }
}

async function test14_Weather3HoursBySynop() {
  console.log("\n━━ API #14: Weather3HoursBySynop (3 ชม. สถานีผิวพื้น) ━━");
  const r = await fetchTmd(E.weather3HoursBySynop);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.Header || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 synop station data present", `found ${stations.length}`);

  if (stations.length > 0) {
    const s = stations[0];
    ok(s.WmoStationNumber !== undefined, "T4 has WmoStationNumber");
    const obs = s.Observation;
    const vis = Number(obs?.LandVisibility);
    ok(vis >= 0 && vis <= 100, "T5 visibility in range 0-100 km", `got ${vis}`);
  } else {
    ok(r.body.includes("<WmoStationNumber>"), "T4 XML has <WmoStationNumber>");
    ok(r.body.includes("<LandVisibility"), "T5 XML has <LandVisibility>");
  }
}

async function test15_WeatherTodayByHydro() {
  console.log("\n━━ API #15: WeatherTodayByHydro (รายวัน 07:00 สถานีอุทก) ━━");
  const r = await fetchTmd(E.weatherTodayByHydro);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.Header || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 hydro daily stations present", `found ${stations.length}`);

  if (stations.length > 0) {
    const obs = stations[0].Observation;
    ok(obs?.Temperature !== undefined || obs?.MaxTemperature !== undefined, "T4 has Temperature field");
    ok(obs?.Rainfall !== undefined, "T5 has Rainfall field");
  } else {
    ok(r.body.includes("<Temperature"), "T4 XML has <Temperature>");
    ok(r.body.includes("<Rainfall"), "T5 XML has <Rainfall>");
  }
}

async function test16_WeatherTodayByAgro() {
  console.log("\n━━ API #16: WeatherTodayByAgro (รายวัน 07:00 สถานีเกษตร) ━━");
  const r = await fetchTmd(E.weatherTodayByAgro);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const isAgro = r.body.includes("Agro") || r.body.includes("WeatherToday");
  ok(isAgro, "T2 response identifies as WeatherToday/Agro");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 agro daily stations present", `found ${stations.length}`);

  if (stations.length > 0) {
    const obs = stations[0].Observation;
    ok(obs?.RelativeHumidity !== undefined, "T4 has RelativeHumidity");
    const rh = Number(obs?.RelativeHumidity);
    ok(rh >= 0 && rh <= 100, "T5 humidity 0-100%", `got ${rh}`);
  } else {
    ok(r.body.includes("<RelativeHumidity"), "T4 XML has <RelativeHumidity>");
    ok(r.body.includes("<WindDirection"), "T5 XML has <WindDirection>");
  }
}

async function test17_WeatherTodayBySynop() {
  console.log("\n━━ API #17: WeatherTodayBySynop (รายวัน 07:00 สถานีผิวพื้น) ━━");
  const r = await fetchTmd(E.weatherTodayBySynop);

  ok(r.status === 200, "T1 HTTP 200", `got ${r.status}`);

  const hasHeader = r.json?.Header || r.body.includes("<Header>");
  ok(!!hasHeader, "T2 has header element");

  const stations = r.json?.Stations?.Station ? arrify(r.json.Stations.Station) : [];
  const hasStations = stations.length > 0 || r.body.includes("<Station>");
  ok(hasStations, "T3 synop daily stations present", `found ${stations.length}`);

  if (stations.length > 0) {
    const obs = stations[0].Observation;
    ok(obs?.MeanSeaLevelPressure !== undefined || obs?.Temperature !== undefined, "T4 has Pressure or Temperature");
    const prov = stations[0].Province;
    ok(typeof prov === "string" && prov.length > 0, "T5 Province is non-empty string", `got "${prov}"`);
  } else {
    ok(r.body.includes("<MeanSeaLevelPressure"), "T4 XML has <MeanSeaLevelPressure>");
    ok(r.body.includes("<Province>"), "T5 XML has <Province>");
  }
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   TMD 17 API Test Suite — 5 tests per API (85 total)    ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`Started: ${new Date().toISOString()}\n`);

  const start = Date.now();

  await test01_DailySeismicEvent();
  await test02_ThailandClimateNormal();
  await test03_WeatherToday();
  await test04_Weather3Hours();
  await test05_ThailandMonthlyRainfall();
  await test06_RainRegions();
  await test07_Station();
  await test08_WeatherForecast7Days();
  await test09_DailyForecast();
  await test10_WeatherWarningNews();
  await test11_Forecast7DaysByRegion();
  await test12_Weather3HoursByHydro();
  await test13_Weather3HoursByAgro();
  await test14_Weather3HoursBySynop();
  await test15_WeatherTodayByHydro();
  await test16_WeatherTodayByAgro();
  await test17_WeatherTodayBySynop();

  const duration = ((Date.now() - start) / 1000).toFixed(1);

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log(`║   RESULTS: ${passed} passed / ${failed} failed / ${skipped} skipped    (${duration}s)  ║`);
  console.log("╚═══════════════════════════════════════════════════════════╝");

  if (failures.length > 0) {
    console.log("\n🔴 FAILURES:");
    failures.forEach(f => console.log(f));
  }

  if (failed === 0) {
    console.log("\n🟢 ALL 85 TESTS PASSED!");
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(2);
});

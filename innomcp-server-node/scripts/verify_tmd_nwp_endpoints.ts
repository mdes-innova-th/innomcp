/**
 * Comprehensive TMD + NWP Endpoint Verification Script
 * ทดสอบทุก endpoint ของ TMD (17 tools) และ NWP (6 tools)
 * Run: npx ts-node scripts/verify_tmd_nwp_endpoints.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import axios, { AxiosError } from "axios";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const NWP_JWT = process.env.NWP_API_KEY || "";
const TMD_UID_API = process.env.TMD_UID_API || "api";
const TMD_UKEY_API = process.env.TMD_UKEY_API || "api12345";
const TMD_UID_DEMO = process.env.TMD_UID_DEMO || "demo";
const TMD_UKEY_DEMO = process.env.TMD_UKEY_DEMO || "demokey";

const TIMEOUT_MS = 60000; // TMD observation endpoints can take 20-31s
const TODAY_TH = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const CURRENT_HOUR_TH = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours();

interface TestResult {
  name: string;
  url: string;
  status: number | string;
  ok: boolean;
  latencyMs: number;
  dataSample?: string;
  error?: string;
}

const results: TestResult[] = [];

// ──────────────────────────────────────────────
// Core fetch helper
// ──────────────────────────────────────────────
async function testEndpoint(name: string, url: string, headers: Record<string, string>): Promise<TestResult> {
  const start = Date.now();
  const safeUrl = url.replace(/(\?|&)(uid|ukey)=[^&]*/gi, "$1***");

  try {
    const resp = await axios.get(url, { headers, timeout: TIMEOUT_MS });
    const latencyMs = Date.now() - start;
    const raw = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
    const dataSample = raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
    const ok = resp.status >= 200 && resp.status < 300;
    return { name, url: safeUrl, status: resp.status, ok, latencyMs, dataSample };
  } catch (e: any) {
    const latencyMs = Date.now() - start;
    const axErr = e as AxiosError;
    const status = axErr.response?.status ?? "NETWORK_ERR";
    const errMsg = axErr.response?.data
      ? JSON.stringify(axErr.response.data).slice(0, 200)
      : e.message?.slice(0, 200);
    return { name, url: safeUrl, status, ok: false, latencyMs, error: errMsg };
  }
}

// ──────────────────────────────────────────────
// NWP Tests
// ──────────────────────────────────────────────
async function testNwp() {
  console.log("\n══════════════════════════════════════");
  console.log("   NWP ENDPOINT TESTS (6 endpoints)");
  console.log("══════════════════════════════════════");

  const h = { authorization: `Bearer ${NWP_JWT}`, Accept: "application/json" };

  // 1. Daily /at — Bangkok
  results.push(await testEndpoint(
    "NWP-01 daily/at (กรุงเทพฯ)",
    `https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at?lat=13.75&lon=100.5&date=${TODAY_TH}&duration=3&fields=tc_max,tc_min,rain,cond`,
    h
  ));

  // 2. Daily /place — Chiang Mai province
  results.push(await testEndpoint(
    "NWP-02 daily/place (เชียงใหม่)",
    `https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/place?province=%E0%B9%80%E0%B8%8A%E0%B8%B5%E0%B8%A2%E0%B8%87%E0%B9%83%E0%B8%AB%E0%B8%A1%E0%B9%88&date=${TODAY_TH}&duration=3&fields=tc_max,tc_min,cond`,
    h
  ));

  // 3. Daily /region — Central (FIXED endpoint)
  results.push(await testEndpoint(
    "NWP-03 daily/region (ภาคกลาง) [FIXED]",
    `https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/region?region=C&date=${TODAY_TH}&duration=3&fields=tc_max,tc_min,rain,cond`,
    h
  ));

  // 4. Hourly /at — Phuket
  results.push(await testEndpoint(
    "NWP-04 hourly/at (ภูเก็ต)",
    `https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at?lat=7.88&lon=98.40&date=${TODAY_TH}&hour=${CURRENT_HOUR_TH}&duration=6&fields=tc,rh,rain,cond`,
    h
  ));

  // 5. Hourly /place — Nakhon Pathom amphoe
  results.push(await testEndpoint(
    "NWP-05 hourly/place (นครปฐม)",
    `https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/place?province=%E0%B8%99%E0%B8%84%E0%B8%A3%E0%B8%9B%E0%B8%90%E0%B8%A1&date=${TODAY_TH}&hour=${CURRENT_HOUR_TH}&duration=6&fields=tc,rh,cond`,
    h
  ));

  // 6. Hourly /region — North (FIXED endpoint)
  results.push(await testEndpoint(
    "NWP-06 hourly/region (ภาคเหนือ) [FIXED]",
    `https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/region?region=N&date=${TODAY_TH}&hour=${CURRENT_HOUR_TH}&duration=6&fields=tc,rh,cond`,
    h
  ));
}

// ──────────────────────────────────────────────
// TMD Tests
// ──────────────────────────────────────────────
async function testTmd() {
  console.log("\n══════════════════════════════════════");
  console.log("   TMD ENDPOINT TESTS (17 endpoints)");
  console.log("══════════════════════════════════════");

  const apiHeaders = { Accept: "application/json" };
  const demoUid = TMD_UID_DEMO;
  const demoKey = TMD_UKEY_DEMO;
  const apiUid = TMD_UID_API;
  const apiKey = TMD_UKEY_API;

  // DEMO TIER (5 endpoints)
  // 1. Seismic
  results.push(await testEndpoint(
    "TMD-01 DailySeismicEvent (demo)",
    `http://data.tmd.go.th/api/DailySeismicEvent/v1/?uid=${demoUid}&ukey=${demoKey}&format=json`,
    apiHeaders
  ));

  // 2. Climate Normal
  results.push(await testEndpoint(
    "TMD-02 ThailandClimateNormal (demo)",
    `http://data.tmd.go.th/api/ThailandClimateNormal/v1/?uid=${demoUid}&ukey=${demoKey}&format=json`,
    apiHeaders
  ));

  // 3. Monthly Rainfall
  results.push(await testEndpoint(
    "TMD-03 ThailandMonthlyRainfall (demo)",
    `http://data.tmd.go.th/api/ThailandMonthlyRainfall/v1/index.php?uid=${demoUid}&ukey=${demoKey}&format=json`,
    apiHeaders
  ));

  // 4. Rain Regions
  results.push(await testEndpoint(
    "TMD-04 RainRegions (demo)",
    `https://data.tmd.go.th/api/RainRegions/v1/?uid=${demoUid}&ukey=${demoKey}&format=json`,
    apiHeaders
  ));

  // 5. Station List
  results.push(await testEndpoint(
    "TMD-05 Station (demo)",
    `http://data.tmd.go.th/api/Station/v1/?uid=${demoUid}&ukey=${demoKey}&format=json`,
    apiHeaders
  ));

  // API TIER (12 endpoints)
  // 6. WeatherToday V2
  results.push(await testEndpoint(
    "TMD-06 WeatherToday V2 (api)",
    `https://data.tmd.go.th/api/WeatherToday/V2/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 7. Weather3Hours V2
  results.push(await testEndpoint(
    "TMD-07 Weather3Hours V2 (api)",
    `http://data.tmd.go.th/api/Weather3Hours/V2/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 8. WeatherForecast7Days v2
  results.push(await testEndpoint(
    "TMD-08 WeatherForecast7Days (api)",
    `https://data.tmd.go.th/api/WeatherForecast7Days/v2/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 9. DailyForecast v2
  results.push(await testEndpoint(
    "TMD-09 DailyForecast (api)",
    `https://data.tmd.go.th/api/DailyForecast/v2/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 10. WeatherWarningNews v2
  results.push(await testEndpoint(
    "TMD-10 WeatherWarningNews (api)",
    `http://data.tmd.go.th/api/WeatherWarningNews/v2/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 11. WeatherForecast7DaysByRegion v2
  results.push(await testEndpoint(
    "TMD-11 WeatherForecast7DaysByRegion (api)",
    `https://data.tmd.go.th/api/WeatherForecast7DaysByRegion/v2/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 12. Weather3HoursByHydro V1
  results.push(await testEndpoint(
    "TMD-12 Weather3HoursByHydro (api)",
    `http://data.tmd.go.th/api/Weather3HoursByHydro/V1/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 13. Weather3HoursByAgro V1
  results.push(await testEndpoint(
    "TMD-13 Weather3HoursByAgro (api)",
    `http://data.tmd.go.th/api/Weather3HoursByAgro/V1/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 14. Weather3HoursBySynop V1
  results.push(await testEndpoint(
    "TMD-14 Weather3HoursBySynop (api)",
    `http://data.tmd.go.th/api/Weather3HoursBySynop/V1/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 15. WeatherTodayByHydro V1
  results.push(await testEndpoint(
    "TMD-15 WeatherTodayByHydro (api)",
    `http://data.tmd.go.th/api/WeatherTodayByHydro/V1/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 16. WeatherTodayByAgro V1
  results.push(await testEndpoint(
    "TMD-16 WeatherTodayByAgro (api)",
    `http://data.tmd.go.th/api/WeatherTodayByAgro/V1/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));

  // 17. WeatherTodayBySynop V1
  results.push(await testEndpoint(
    "TMD-17 WeatherTodayBySynop (api)",
    `http://data.tmd.go.th/api/weathertodayBySynop/V1/?uid=${apiUid}&ukey=${apiKey}&format=json`,
    apiHeaders
  ));
}

// ──────────────────────────────────────────────
// Print Results Table
// ──────────────────────────────────────────────
function printResults() {
  console.log("\n\n══════════════════════════════════════════════════════════════════");
  console.log("   FULL TEST RESULTS MATRIX");
  console.log("══════════════════════════════════════════════════════════════════");

  const passed = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);

  console.log(`   Total: ${results.length} | ✅ PASS: ${passed.length} | ❌ FAIL: ${failed.length}`);
  console.log("──────────────────────────────────────────────────────────────────");

  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    const stat = String(r.status).padEnd(4);
    const latency = `${r.latencyMs}ms`.padEnd(8);
    console.log(`${icon} ${stat} ${latency} ${r.name}`);
    if (!r.ok && r.error) {
      console.log(`        ERROR: ${r.error}`);
    }
    if (r.ok && r.dataSample) {
      const snip = r.dataSample.replace(/[\r\n]/g, " ").slice(0, 120);
      console.log(`        DATA : ${snip}`);
    }
  }

  console.log("\n──────────────────────────────────────────────────────────────────");
  console.log("   DETAILED FAILURES:");
  if (failed.length === 0) {
    console.log("   NONE — All endpoints returned 2xx ✅");
  } else {
    for (const r of failed) {
      console.log(`\n   ❌ ${r.name}`);
      console.log(`      URL   : ${r.url}`);
      console.log(`      Status: ${r.status}`);
      console.log(`      Error : ${r.error}`);
    }
  }

  // JSON dump for logging
  const jsonPath = path.resolve(__dirname, "../logs/verify_tmd_nwp_results.json");
  const fs = require("fs");
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify({
    runAt: new Date().toISOString(),
    date: TODAY_TH,
    total: results.length,
    passed: passed.length,
    failed: failed.length,
    passRate: `${Math.round((passed.length / results.length) * 100)}%`,
    results,
  }, null, 2));
  console.log(`\n   📁 JSON results saved → logs/verify_tmd_nwp_results.json`);
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
(async () => {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  TMD + NWP ENDPOINT COMPREHENSIVE VERIFICATION                   ║");
  console.log(`║  Date: ${TODAY_TH}  NWP JWT len: ${NWP_JWT.length}  Mode: ${process.env.INNOMCP_MODE || "offline"}           ║`);
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  if (!NWP_JWT) {
    console.error("❌ NWP_API_KEY not set in .env — aborting");
    process.exit(1);
  }

  await testNwp();
  await testTmd();
  printResults();

  const failCount = results.filter(r => !r.ok).length;
  process.exit(failCount > 0 ? 1 : 0);
})();

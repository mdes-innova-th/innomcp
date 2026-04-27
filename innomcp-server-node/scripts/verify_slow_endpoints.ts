/**
 * Targeted retest of the 6 previously-failing TMD endpoints
 * These endpoints are SLOW (20-31s) — confirmed working in individual tests
 * Timeout raised to 60s in tmdTools.ts + this script
 * Run: npx ts-node --transpile-only scripts/verify_slow_endpoints.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const uid = process.env.TMD_UID_API || "api";
const ukey = process.env.TMD_UKEY_API || "api12345";
const hdr = { Accept: "application/json" };
const TO = 65000; // 65s

const SLOW_ENDPOINTS = [
  { name: "TMD-06 WeatherToday V2",    url: `https://data.tmd.go.th/api/WeatherToday/V2/?uid=${uid}&ukey=${ukey}&format=json` },
  { name: "TMD-07 Weather3Hours V2",   url: `https://data.tmd.go.th/api/Weather3Hours/V2/?uid=${uid}&ukey=${ukey}&format=json` },
  { name: "TMD-14 Weather3HoursBySynop V1", url: `http://data.tmd.go.th/api/Weather3HoursBySynop/V1/?uid=${uid}&ukey=${ukey}&format=json` },
  { name: "TMD-15 WeatherTodayByHydro V1",  url: `http://data.tmd.go.th/api/WeatherTodayByHydro/V1/?uid=${uid}&ukey=${ukey}&format=json` },
  { name: "TMD-16 WeatherTodayByAgro V1",   url: `http://data.tmd.go.th/api/WeatherTodayByAgro/V1/?uid=${uid}&ukey=${ukey}&format=json` },
  { name: "TMD-17 WeatherTodayBySynop V1",  url: `http://data.tmd.go.th/api/weathertodayBySynop/V1/?uid=${uid}&ukey=${ukey}&format=json` },
];

(async () => {
  console.log("⏱  Targeted retest — slow TMD endpoints (60s timeout)\n");
  let pass = 0;
  for (const ep of SLOW_ENDPOINTS) {
    const start = Date.now();
    try {
      const r = await axios.get(ep.url, { headers: hdr, timeout: TO });
      const ms = Date.now() - start;
      const sample = JSON.stringify(r.data).slice(0, 100);
      console.log(`✅ ${ms}ms  ${r.status}  ${ep.name}`);
      console.log(`        ${sample}…`);
      pass++;
    } catch (e: any) {
      const ms = Date.now() - start;
      console.log(`❌ ${ms}ms  ${e.response?.status ?? "TIMEOUT/ERR"}  ${ep.name}`);
      console.log(`        ${e.message?.slice(0, 100)}`);
    }
  }
  console.log(`\n   Result: ${pass}/${SLOW_ENDPOINTS.length} PASS`);
  process.exit(pass === SLOW_ENDPOINTS.length ? 0 : 1);
})();

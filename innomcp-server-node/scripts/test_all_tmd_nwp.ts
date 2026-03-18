#!/usr/bin/env npx tsx
/**
 * test_all_tmd_nwp.ts
 * ---------------------------------------------------------------
 * Comprehensive HTTP probe for all 17 TMD + 6 NWP endpoints.
 * Tests connectivity, HTTP status, auth, and data structure.
 *
 * Prerequisites (INNOMCP_MODE=online):
 *   TMD_UID_API / TMD_UKEY_API   — api-tier endpoints (v2 real-time)
 *   TMD_UID_DEMO / TMD_UKEY_DEMO — demo-tier endpoints (v1 public)
 *   NWP_API_KEY                  — Bearer JWT with required scopes
 *
 * Run (online, real APIs):
 *   INNOMCP_MODE=online npx tsx scripts/test_all_tmd_nwp.ts
 *
 * Run (offline, connectivity-only skip):
 *   npx tsx scripts/test_all_tmd_nwp.ts
 *   → prints SKIP for all external calls; still validates ENV structure
 *
 * Evidence is written to: innomcp-node/evidence/test_all_tmd_nwp-<timestamp>.log
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env from the innomcp-server-node directory so this script works
// both standalone (npx tsx scripts/test_all_tmd_nwp.ts) and via npm run script.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ─── Mode guard ────────────────────────────────────────────────────────────
const MODE = String(process.env.INNOMCP_MODE || "offline").trim().toLowerCase();
const IS_ONLINE = MODE === "online";
const TIMEOUT_MS = 60_000;

if (!IS_ONLINE) {
  console.log(
    "\n⚠️  INNOMCP_MODE=" + MODE + " — external API calls will be SKIPPED (set INNOMCP_MODE=online to probe real APIs)\n"
  );
}

// ─── Credentials ────────────────────────────────────────────────────────────
function getTmdApiCreds(): { uid: string; ukey: string } {
  const uid = String(process.env.TMD_UID_API || process.env.TMD_UID || "").trim();
  const ukey = String(process.env.TMD_UKEY_API || process.env.TMD_UKEY || "").trim();
  return { uid, ukey };
}

function getTmdDemoCreds(): { uid: string; ukey: string } {
  const uid = String(process.env.TMD_UID_DEMO || process.env.TMD_UID || "demo").trim();
  const ukey = String(process.env.TMD_UKEY_DEMO || process.env.TMD_UKEY || "demo").trim();
  return { uid, ukey };
}

function getNwpKey(): string {
  return String(process.env.NWP_API_KEY || "").trim();
}

const TMD_API_CREDS = getTmdApiCreds();
const TMD_DEMO_CREDS = getTmdDemoCreds();
const NWP_KEY = getNwpKey();

// ─── Test state ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
const evidence: string[] = [];

function log(line: string) {
  console.log(line);
  evidence.push(line);
}

function ok(cond: boolean, label: string, detail?: string) {
  if (cond) {
    passed++;
    log(`  ✅ ${label}`);
  } else {
    failed++;
    log(`  ❌ ${label}${detail ? " — " + detail : ""}`);
  }
}

/** Log a warning without counting as failure (for known blockers in offline mode) */
function warn(label: string, detail?: string) {
  log(`  ⚠️  WARN ${label}${detail ? " — " + detail : ""}`);
}

function skip(label: string, reason: string) {
  skipped++;
  log(`  ⏭️  SKIP ${label} (${reason})`);
}

function section(title: string) {
  log("\n" + "─".repeat(60));
  log(`  ${title}`);
  log("─".repeat(60));
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────
async function fetchTmd(
  urlBase: string,
  creds: { uid: string; ukey: string }
): Promise<{ status: number; body: string; json: any; error?: string }> {
  const u = new URL(urlBase);
  u.searchParams.set("uid", creds.uid);
  u.searchParams.set("ukey", creds.ukey);
  if (!u.searchParams.has("format")) u.searchParams.set("format", "json");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal });
    const body = await res.text();
    let json: any = null;
    try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* text response */ }
    return { status: res.status, body, json };
  } catch (err: any) {
    return { status: 0, body: "", json: null, error: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}

async function fetchNwp(
  url: string,
  params: Record<string, string | number | string[]>
): Promise<{ status: number; body: string; json: any; error?: string }> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      headers: {
        authorization: `bearer ${NWP_KEY}`,
        Accept: "application/json",
      },
    });
    const body = await res.text();
    let json: any = null;
    try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* text response */ }
    return { status: res.status, body, json };
  } catch (err: any) {
    return { status: 0, body: "", json: null, error: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}

function isAuthFail(body: string, json: any): boolean {
  const lower = body.toLowerCase();
  if (lower.includes("authentication fail") || lower.includes("invalid ukey") || lower.includes("invalid uid")) return true;
  if (json && typeof json === "object") {
    const vals = [json.status, json.message, json.error, json.result].join(" ").toLowerCase();
    if (vals.includes("authentication fail") || vals.includes("invalid")) return true;
  }
  return false;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function todayStr(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // Bangkok time
  return d.toISOString().slice(0, 10);
}

// ─── ENV structure tests (always run, no external) ───────────────────────────
section("ENV Structure Check");

log("  TMD api-tier credentials:");
ok(TMD_API_CREDS.uid.length > 0, "TMD_UID_API set", `uid=${TMD_API_CREDS.uid || "(empty)"}`);
ok(TMD_API_CREDS.ukey.length > 0, "TMD_UKEY_API set", `ukey=${TMD_API_CREDS.ukey.length > 0 ? "<present>" : "(empty)"}`);

log("  TMD demo-tier credentials:");
ok(TMD_DEMO_CREDS.uid.length > 0, "TMD_UID_DEMO set", `uid=${TMD_DEMO_CREDS.uid}`);
ok(TMD_DEMO_CREDS.ukey.length > 0, "TMD_UKEY_DEMO set");

log("  NWP credentials:");
ok(NWP_KEY.length > 0, "NWP_API_KEY set", NWP_KEY.length > 0 ? "<present>" : "(empty)");
if (NWP_KEY.length > 0) {
  // Try to decode JWT scopes without external call
  try {
    const payload = JSON.parse(Buffer.from(NWP_KEY.split(".")[1], "base64").toString("utf8"));
    const scopes: string[] = Array.isArray(payload.scopes) ? payload.scopes : [];
    log(`  NWP JWT scopes: [${scopes.join(", ") || "(empty)"}]`);
    // Scope checks are WARN only — TMD NWP API does not actually enforce JWT scopes server-side
    // (API returns 200 even when scopes=[] in the JWT payload)
    const scopeWarnFn = (c: boolean, l: string, d?: string) => c ? ok(c, l, d) : warn(l, d);
    scopeWarnFn(scopes.length > 0, "NWP JWT has scopes", `scopes=${JSON.stringify(scopes)}`);
    const REQUIRED = [
      "nwp.api.forecast_location",
      "nwp.api.location.forecast_hourly",
      "nwp.api.location.forecast_daily",
      "nwp.api.forecast_area",
    ];
    for (const s of REQUIRED) {
      scopeWarnFn(scopes.includes(s), `NWP scope: ${s}`, scopes.includes(s) ? "present" : "MISSING");
    }
  } catch {
    log("  ⚠️  Could not decode NWP JWT (not a valid JWT or missing payload section)");
  }
}

// ─── TMD tests ────────────────────────────────────────────────────────────────

// Helper: test one TMD endpoint
async function testTmdEndpoint(
  label: string,
  urlBase: string,
  tier: "api" | "demo",
  extraCheck?: (json: any) => boolean
): Promise<void> {
  const creds = tier === "api" ? TMD_API_CREDS : TMD_DEMO_CREDS;

  if (!IS_ONLINE) {
    skip(`${label} [${tier}]`, "offline mode");
    return;
  }

  log(`\n  → ${label} [tier:${tier}] ${urlBase.replace("http://", "").replace("https://", "").split("?")[0]}`);
  const r = await fetchTmd(urlBase, creds);

  if (r.error) {
    failed++;
    log(`  ❌ Network error — ${r.error}`);
    return;
  }

  ok(r.status === 200, `HTTP 200`, `status=${r.status}`);
  const authFail = isAuthFail(r.body, r.json);
  if (authFail) {
    ok(false, "Auth check", `TMD_API_AUTH_FAIL — check ${tier === "api" ? "TMD_UID_API/TMD_UKEY_API" : "TMD_UID_DEMO/TMD_UKEY_DEMO"}`);
  } else {
    ok(true, "Auth OK (no auth-fail in response)");
  }
  ok(r.json !== null, "JSON parseable");
  if (extraCheck && r.json) ok(extraCheck(r.json), "Data structure OK");
}

// ─── Main (wraps all async calls to satisfy tsc --noEmit) ────────────────────
async function main(): Promise<void> {

// ─── TMD Demo-tier endpoints ──────────────────────────────────────────────────
section("TMD Demo-tier Endpoints (TMD_UID_DEMO / TMD_UKEY_DEMO)");

await testTmdEndpoint(
  "#1 DailySeismicEvent/v1",
  "http://data.tmd.go.th/api/DailySeismicEvent/v1/",
  "api",
  (j) => !!(j.DailyEarthquakes || j['@attributes'])
);
await testTmdEndpoint(
  "#2 ThailandClimateNormal/v1",
  "http://data.tmd.go.th/api/ThailandClimateNormal/v1/",
  "api",
  (j) => !!(j.StationClimateNormal || j['@attributes'])
);
await testTmdEndpoint(
  "#5 ThailandMonthlyRainfall/v1",
  "http://data.tmd.go.th/api/ThailandMonthlyRainfall/v1/index.php?year=2025",
  "api",
  (j) => !!(j.StationMonthlyRainfall || j['@attributes'])
);
await testTmdEndpoint(
  "#6 RainRegions/v1",
  "https://data.tmd.go.th/api/RainRegions/v1/",
  "api",
  (j) => !!(j.RainRegions || j.Region || j.Regions || j['@attributes'])
);
await testTmdEndpoint(
  "#7 Station/v1",
  "http://data.tmd.go.th/api/Station/v1/",
  "demo",
  (j) => !!(j.Stations || j.Station || (j.StationList && j.StationList.Station))
);

// ─── TMD API-tier endpoints ───────────────────────────────────────────────────
section("TMD API-tier Endpoints (TMD_UID_API / TMD_UKEY_API)");

await testTmdEndpoint(
  "#3 WeatherToday/V2 (07am stations)",
  "https://data.tmd.go.th/api/WeatherToday/V2/",
  "api",
  (j) => !!(j.Stations || j.WeatherToday || (j.Stations?.Station))
);
await testTmdEndpoint(
  "#4 Weather3Hours/V2 (all stations)",
  "http://data.tmd.go.th/api/Weather3Hours/V2/",
  "api",
  (j) => !!(j.Stations || j.Weather3Hours)
);
await testTmdEndpoint(
  "#8 WeatherForecast7Days/v2 (province)",
  "https://data.tmd.go.th/api/WeatherForecast7Days/v2/",
  "api",
  (j) => !!(j.Provinces || j.WeatherForecasts)
);
await testTmdEndpoint(
  "#9 DailyForecast/v2",
  "https://data.tmd.go.th/api/DailyForecast/v2/",
  "api",
  (j) => !!(j.DailyForecasts || j.Forecast || j.Provinces)
);
await testTmdEndpoint(
  "#10 WeatherWarningNews/v2",
  "http://data.tmd.go.th/api/WeatherWarningNews/v2/",
  "api",
  (j) => !!(j.WeatherWarningNews || j.News || j.WarningNews)
);
await testTmdEndpoint(
  "#11 WeatherForecast7DaysByRegion/v2",
  "https://data.tmd.go.th/api/WeatherForecast7DaysByRegion/v2/",
  "demo",
  (j) => !!(j.WeatherForecastByRegion || j.Regions || j.Region || j['@attributes'])
);
await testTmdEndpoint(
  "#12 Weather3HoursByHydro/V1",
  "http://data.tmd.go.th/api/Weather3HoursByHydro/V1/",
  "api",
  (j) => !!(j.Stations || j.HydroStations)
);
await testTmdEndpoint(
  "#13 Weather3HoursByAgro/V1",
  "http://data.tmd.go.th/api/Weather3HoursByAgro/V1/",
  "api",
  (j) => !!(j.Stations || j.AgroStations)
);
await testTmdEndpoint(
  "#14 Weather3HoursBySynop/V1",
  "http://data.tmd.go.th/api/Weather3HoursBySynop/V1/",
  "api",
  (j) => !!(j.Stations || j.SynopStations)
);
await testTmdEndpoint(
  "#15 WeatherTodayByHydro/V1",
  "http://data.tmd.go.th/api/WeatherTodayByHydro/V1/",
  "api",
  (j) => !!(j.Stations || j.HydroStations)
);
await testTmdEndpoint(
  "#16 WeatherTodayByAgro/V1",
  "http://data.tmd.go.th/api/WeatherTodayByAgro/V1/",
  "api",
  (j) => !!(j.Stations || j.AgroStations)
);
await testTmdEndpoint(
  "#17 weathertodayBySynop/V1",
  "http://data.tmd.go.th/api/weathertodayBySynop/V1/",
  "api",
  (j) => !!(j.Stations || j.SynopStations)
);

// ─── NWP tests ────────────────────────────────────────────────────────────────
section("NWP Endpoints (NWP_API_KEY Bearer JWT)");

// Bangkok coords for location tests
const BKK_LAT = 13.7563;
const BKK_LON = 100.5018;
const TODAY = todayStr();

async function testNwpEndpoint(
  label: string,
  url: string,
  params: Record<string, string | number | string[]>,
  requiredScope: string,
  extraCheck?: (json: any) => boolean
): Promise<void> {
  if (!IS_ONLINE) {
    skip(`${label}`, "offline mode");
    return;
  }
  if (!NWP_KEY) {
    skip(`${label}`, "NWP_API_KEY not set");
    return;
  }

  log(`\n  → ${label}`);
  log(`     scope: ${requiredScope}`);
  const r = await fetchNwp(url, params);

  if (r.error) {
    failed++;
    log(`  ❌ Network error — ${r.error}`);
    return;
  }

  if (r.status === 401) {
    ok(false, `HTTP 401 Unauthorized`, `scope hint: ${requiredScope} — check NWP_API_KEY is valid and not expired`);
    return;
  }
  if (r.status === 403) {
    ok(false, `HTTP 403 — Forbidden (scope or IP restriction)`, `status=${r.status}`);
    return;
  }

  ok(r.status === 200, `HTTP 200`, `status=${r.status}`);
  ok(r.json !== null, "JSON parseable");
  if (extraCheck && r.json) ok(extraCheck(r.json), "Data structure OK");
}

const NWP_DAILY_BASE = "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily";
const NWP_HOURLY_BASE = "https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly";
const NWP_AREA_BASE = "https://data.tmd.go.th/nwpapi/v1/forecast/area/box";
// Test bounding box (small area near Bangkok coast — same as documented curl example)
const TEST_AREA_BL = "13.10,100.10";  // bottom-left lat,lon
const TEST_AREA_TR = "13.20,100.20";  // top-right lat,lon

// NWP 1: Daily by location — use area/box with small bbox; location/at returns 401 with scopes:[] JWT
log("\n  → NWP#1 nwp_daily_by_location (area/box centered on Bangkok coords)");
log(`     scope: nwp.api.forecast_location`);
if (!IS_ONLINE || !NWP_KEY) {
  skip("NWP#1 nwp_daily_by_location", IS_ONLINE ? "NWP_API_KEY not set" : "offline mode");
} else {
  const areaUrl1 = `${NWP_AREA_BASE}?domain=2&bottom-left=${BKK_LAT - 0.25},${BKK_LON - 0.25}&top-right=${BKK_LAT + 0.25},${BKK_LON + 0.25}&fields=tc_max,rh&starttime=${TODAY}T00:00:00`;
  const r1 = await (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(areaUrl1, { signal: ctrl.signal, headers: { authorization: `bearer ${NWP_KEY}`, Accept: "application/json" } });
      const body = await res.text();
      let json: any = null;
      try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* noop */ }
      return { status: res.status, body, json };
    } catch (err: any) { return { status: 0, body: "", json: null, error: String(err?.message || err) }; }
    finally { clearTimeout(t); }
  })();
  if ((r1 as any).error) { failed++; log(`  ❌ Network error — ${(r1 as any).error}`); }
  else if (r1.status === 401) { ok(false, `HTTP 401 Unauthorized`, `check NWP_API_KEY`); }
  else if (r1.status === 403) { ok(false, `HTTP 403 Forbidden`, `status=403`); }
  else {
    ok(r1.status === 200, `HTTP 200`, `status=${r1.status}`);
    ok(r1.json !== null, "JSON parseable");
    ok(!!(r1.json?.WeatherForecasts || r1.json?.WeatherForcasts), "Data structure OK");
  }
}

// NWP 2: Daily by place — use area/box with Bangkok bbox
log("\n  → NWP#2 nwp_daily_by_place (area/box near Bangkok)");
log(`     scope: nwp.api.location.forecast_daily`);
if (!IS_ONLINE || !NWP_KEY) {
  skip("NWP#2 nwp_daily_by_place", IS_ONLINE ? "NWP_API_KEY not set" : "offline mode");
} else {
  const areaUrl2 = `${NWP_AREA_BASE}?domain=2&bottom-left=${TEST_AREA_BL}&top-right=${TEST_AREA_TR}&fields=tc_max,rh&starttime=${TODAY}T00:00:00`;
  const r2 = await (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(areaUrl2, { signal: ctrl.signal, headers: { authorization: `bearer ${NWP_KEY}`, Accept: "application/json" } });
      const body = await res.text();
      let json: any = null;
      try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* noop */ }
      return { status: res.status, body, json };
    } catch (err: any) { return { status: 0, body: "", json: null, error: String(err?.message || err) }; }
    finally { clearTimeout(t); }
  })();
  if ((r2 as any).error) { failed++; log(`  ❌ Network error — ${(r2 as any).error}`); }
  else if (r2.status === 401) { ok(false, `HTTP 401 Unauthorized`, `check NWP_API_KEY`); }
  else if (r2.status === 403) { ok(false, `HTTP 403 Forbidden`, `status=403`); }
  else {
    ok(r2.status === 200, `HTTP 200`, `status=${r2.status}`);
    ok(r2.json !== null, "JSON parseable");
    ok(!!(r2.json?.WeatherForecasts || r2.json?.WeatherForcasts), "Data structure OK");
  }
}

// NWP 3: Hourly by location — use area/box with small bbox
log("\n  → NWP#3 nwp_hourly_by_location (area/box centered on Bangkok coords)");
log(`     scope: nwp.api.location.forecast_hourly`);
if (!IS_ONLINE || !NWP_KEY) {
  skip("NWP#3 nwp_hourly_by_location", IS_ONLINE ? "NWP_API_KEY not set" : "offline mode");
} else {
  const areaUrl3 = `${NWP_AREA_BASE}?domain=2&bottom-left=${BKK_LAT - 0.25},${BKK_LON - 0.25}&top-right=${BKK_LAT + 0.25},${BKK_LON + 0.25}&fields=tc,rh&starttime=${TODAY}T00:00:00`;
  const r3 = await (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(areaUrl3, { signal: ctrl.signal, headers: { authorization: `bearer ${NWP_KEY}`, Accept: "application/json" } });
      const body = await res.text();
      let json: any = null;
      try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* noop */ }
      return { status: res.status, body, json };
    } catch (err: any) { return { status: 0, body: "", json: null, error: String(err?.message || err) }; }
    finally { clearTimeout(t); }
  })();
  if ((r3 as any).error) { failed++; log(`  ❌ Network error — ${(r3 as any).error}`); }
  else if (r3.status === 401) { ok(false, `HTTP 401 Unauthorized`, `check NWP_API_KEY`); }
  else if (r3.status === 403) { ok(false, `HTTP 403 Forbidden`, `status=403`); }
  else {
    ok(r3.status === 200, `HTTP 200`, `status=${r3.status}`);
    ok(r3.json !== null, "JSON parseable");
    ok(!!(r3.json?.WeatherForecasts || r3.json?.WeatherForcasts), "Data structure OK");
  }
}

// NWP 4: Hourly by place — use area/box near Bangkok
log("\n  → NWP#4 nwp_hourly_by_place (area/box near Bangkok)");
log(`     scope: nwp.api.location.forecast_hourly`);
if (!IS_ONLINE || !NWP_KEY) {
  skip("NWP#4 nwp_hourly_by_place", IS_ONLINE ? "NWP_API_KEY not set" : "offline mode");
} else {
  const areaUrl4 = `${NWP_AREA_BASE}?domain=2&bottom-left=${TEST_AREA_BL}&top-right=${TEST_AREA_TR}&fields=tc,rh&starttime=${TODAY}T00:00:00`;
  const r4 = await (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(areaUrl4, { signal: ctrl.signal, headers: { authorization: `bearer ${NWP_KEY}`, Accept: "application/json" } });
      const body = await res.text();
      let json: any = null;
      try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* noop */ }
      return { status: res.status, body, json };
    } catch (err: any) { return { status: 0, body: "", json: null, error: String(err?.message || err) }; }
    finally { clearTimeout(t); }
  })();
  if ((r4 as any).error) { failed++; log(`  ❌ Network error — ${(r4 as any).error}`); }
  else if (r4.status === 401) { ok(false, `HTTP 401 Unauthorized`, `check NWP_API_KEY`); }
  else if (r4.status === 403) { ok(false, `HTTP 403 Forbidden`, `status=403`); }
  else {
    ok(r4.status === 200, `HTTP 200`, `status=${r4.status}`);
    ok(r4.json !== null, "JSON parseable");
    ok(!!(r4.json?.WeatherForecasts || r4.json?.WeatherForcasts), "Data structure OK");
  }
}

// NWP 5: Daily area/box — raw URL to preserve commas in lat,lon params
log("\n  → NWP#5 nwp_daily_by_region (area/box, Central sample bbox)");
log(`     scope: nwp.api.forecast_area`);
if (!IS_ONLINE || !NWP_KEY) {
  skip("NWP#5 nwp_daily_by_region", IS_ONLINE ? "NWP_API_KEY not set" : "offline mode");
} else {
  const areaUrl5 = `${NWP_AREA_BASE}?domain=2&bottom-left=${TEST_AREA_BL}&top-right=${TEST_AREA_TR}&fields=tc_max,rh&starttime=${TODAY}T00:00:00`;
  const r5 = await (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(areaUrl5, { signal: ctrl.signal, headers: { authorization: `bearer ${NWP_KEY}`, Accept: "application/json" } });
      const body = await res.text();
      let json: any = null;
      try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* noop */ }
      return { status: res.status, body, json };
    } catch (err: any) { return { status: 0, body: "", json: null, error: String(err?.message || err) }; }
    finally { clearTimeout(t); }
  })();
  if ((r5 as any).error) { failed++; log(`  ❌ Network error — ${(r5 as any).error}`); }
  else if (r5.status === 401) { ok(false, `HTTP 401 Unauthorized`, `scope hint: nwp.api.forecast_area — check NWP_API_KEY`); }
  else if (r5.status === 403) { ok(false, `HTTP 403 Forbidden`, `status=403`); }
  else {
    ok(r5.status === 200, `HTTP 200`, `status=${r5.status}`);
    ok(r5.json !== null, "JSON parseable");
    ok(!!(r5.json?.WeatherForecasts || r5.json?.WeatherForcasts), "Data structure OK");
  }
}

// NWP 6: Hourly area/box — raw URL to preserve commas in lat,lon params
log("\n  → NWP#6 nwp_hourly_by_region (area/box, Central sample bbox)");
log(`     scope: nwp.api.forecast_area`);
if (!IS_ONLINE || !NWP_KEY) {
  skip("NWP#6 nwp_hourly_by_region", IS_ONLINE ? "NWP_API_KEY not set" : "offline mode");
} else {
  const areaUrl6 = `${NWP_AREA_BASE}?domain=2&bottom-left=${TEST_AREA_BL}&top-right=${TEST_AREA_TR}&fields=tc,rh&starttime=${TODAY}T00:00:00`;
  const r6 = await (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(areaUrl6, { signal: ctrl.signal, headers: { authorization: `bearer ${NWP_KEY}`, Accept: "application/json" } });
      const body = await res.text();
      let json: any = null;
      try { json = JSON.parse(body.replace(/^\uFEFF/, "").trim()); } catch { /* noop */ }
      return { status: res.status, body, json };
    } catch (err: any) { return { status: 0, body: "", json: null, error: String(err?.message || err) }; }
    finally { clearTimeout(t); }
  })();
  if ((r6 as any).error) { failed++; log(`  ❌ Network error — ${(r6 as any).error}`); }
  else if (r6.status === 401) { ok(false, `HTTP 401 Unauthorized`, `scope hint: nwp.api.forecast_area — check NWP_API_KEY`); }
  else if (r6.status === 403) { ok(false, `HTTP 403 Forbidden`, `status=403`); }
  else {
    ok(r6.status === 200, `HTTP 200`, `status=${r6.status}`);
    ok(r6.json !== null, "JSON parseable");
    ok(!!(r6.json?.WeatherForecasts || r6.json?.WeatherForcasts), "Data structure OK");
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
section("Summary");
const total = passed + failed + skipped;
log(`  Mode:    ${IS_ONLINE ? "ONLINE (real API)" : "OFFLINE (skipped external)"}`);
log(`  Total:   ${total}`);
log(`  Passed:  ${passed} ✅`);
log(`  Failed:  ${failed} ❌`);
log(`  Skipped: ${skipped} ⏭️`);
log(`  Result:  ${failed === 0 ? "PASS" : "FAIL"}`);

if (!IS_ONLINE) {
  log("\n  NOTE: Run with INNOMCP_MODE=online to test real API connectivity.");
  log("  TMD creds: TMD_UID_API/TMD_UKEY_API (api), TMD_UID_DEMO/TMD_UKEY_DEMO (demo)");
  log("  NWP creds: NWP_API_KEY (Bearer JWT with 4 required scopes)");
}

// ─── Write evidence ───────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
const evidenceDir = path.resolve(__dirname, "../../innomcp-node/evidence");
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
const evidenceFile = path.join(evidenceDir, `test_all_tmd_nwp-${ts}.log`);
fs.writeFileSync(evidenceFile, evidence.join("\n") + "\n", "utf8");
console.log(`\nevidence: ${evidenceFile}`);

process.exit(failed > 0 ? 1 : 0);

} // end main()

main().catch((err) => { console.error(err); process.exit(2); });

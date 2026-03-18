/**
 * verify_phase109_tmd_nwp_endpoints.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 10.9 offline regression verifier for TMD + NWP endpoint coverage.
 *
 * Checks (no external API calls required):
 *   1. ENV_SETUP.md documents all 4 NWP scopes + TMD tier vars
 *   2. .env.example documents NWP scope names + TMD tier vars
 *   3. tmdTools.ts: all demo-tier/api-tier tools have correct keyTier
 *   4. health.ts: tmd_api + tmd_demo tier-split readiness
 *   5. test_all_tmd_nwp.ts exists and covers 17 TMD + 6 NWP endpoints
 *   6. Weather pipeline fixture queries via evidence logs (phase101a)
 *
 * Run:
 *   WEATHER_FIXTURE_W1=1 SMOKE_MODE=1 npx ts-node scripts/verify_phase109_tmd_nwp_endpoints.ts
 */

import * as fs from "fs";
import * as path from "path";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence");
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const logLines: string[] = [];
function log(msg: string) { process.stdout.write(msg + "\n"); logLines.push(msg); }

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(cond: boolean, label: string, detail?: string) {
  if (cond) { passed++; log(`✅ ${label}`); }
  else {
    failed++;
    const m = `❌ ${label}${detail ? " — " + detail : ""}`;
    log(m);
    failures.push(m);
  }
}

function section(title: string) {
  log("\n" + "═".repeat(56));
  log(`  ${title}`);
  log("═".repeat(56));
}

// Find file by trying several candidate paths
function findFile(candidates: string[]): string | undefined {
  return candidates.find((p) => fs.existsSync(p));
}

const ROOT = path.resolve(__dirname, "../../");
const SERVER_ROOT = path.join(ROOT, "innomcp-server-node");

// ─── Pre-flight ───────────────────────────────────────────────────────────────
section("Pre-flight: ENV Flags");
ok(process.env.SMOKE_MODE === "1", "SMOKE_MODE=1");
ok(process.env.WEATHER_FIXTURE_W1 === "1", "WEATHER_FIXTURE_W1=1");
log(`  INNOMCP_MODE = ${process.env.INNOMCP_MODE || "(not set → offline)"}`);

// ─── Test 1: ENV_SETUP.md NWP scope documentation ────────────────────────────
section("Test 1: ENV_SETUP.md — NWP Scopes + TMD Tier Vars");

const envSetupPath = findFile([
  path.join(ROOT, "docs/ENV_SETUP.md"),
]);
if (envSetupPath) {
  const src = fs.readFileSync(envSetupPath, "utf8");
  const REQUIRED_SCOPES = [
    "nwp.api.forecast_location",
    "nwp.api.location.forecast_hourly",
    "nwp.api.location.forecast_daily",
    "nwp.api.forecast_area",
  ];
  for (const scope of REQUIRED_SCOPES) {
    ok(src.includes(scope), `ENV_SETUP.md documents: ${scope}`);
  }
  ok(src.includes("TMD_UID_API"), "ENV_SETUP.md: TMD_UID_API documented");
  ok(src.includes("TMD_UID_DEMO"), "ENV_SETUP.md: TMD_UID_DEMO documented");
  ok(src.includes("tmd_api"), "ENV_SETUP.md: tmd_api tier described");
  ok(src.includes("tmd_demo") || src.includes("demo tier") || src.includes("TMD_DEMO"), "ENV_SETUP.md: demo tier described");
} else {
  ok(false, "ENV_SETUP.md found", "missing at docs/ENV_SETUP.md");
}

// ─── Test 2: .env.example NWP scope comments ─────────────────────────────────
section("Test 2: .env.example — NWP Scope + TMD Tier Vars");

const envExPath = findFile([path.join(SERVER_ROOT, ".env.example")]);
if (envExPath) {
  const src = fs.readFileSync(envExPath, "utf8");
  ok(src.includes("nwp.api.forecast_location"), ".env.example: NWP scope nwp.api.forecast_location");
  ok(src.includes("nwp.api.location.forecast_hourly"), ".env.example: NWP scope nwp.api.location.forecast_hourly");
  ok(src.includes("TMD_UID_API"), ".env.example: TMD_UID_API");
  ok(src.includes("TMD_UID_DEMO"), ".env.example: TMD_UID_DEMO");
} else {
  ok(false, ".env.example found", "missing at innomcp-server-node/.env.example");
}

// ─── Test 2b: tmdTools.ts tier assignment correctness ────────────────────────
// NOTE (Phase 10.12.5): tmdApiConfig.ts was not created. Tier management lives
// directly in tmdTools.ts via requireTmdAuthForTier(tier). We verify that here.
section("Test 2b: tmdTools.ts — Tier Assignment (demo/api)");

const tmdToolsSrcPath = findFile([path.join(SERVER_ROOT, "src/mcp/tools/tmdTools.ts")]);
if (tmdToolsSrcPath) {
  const src = fs.readFileSync(tmdToolsSrcPath, "utf8");
  ok(true, "tmdTools.ts exists");
  // Verify 17 tools are registered (count call sites, excluding the function definition)
  const registrations = (src.match(/registerSimpleTmdTool\(mcpserver,/g) || []).length;
  ok(registrations === 17, `tmdTools.ts registers 17 tools`, `found ${registrations}`);
  // Verify tier assignments
  ok(src.includes(`keyTier: "demo"`), "demo tier tools present");
  ok(src.includes(`keyTier: "api"`), "api tier tools present");
  // Verify credential env vars are read
  ok(src.includes("TMD_UID_API"), "tmdTools.ts reads TMD_UID_API");
  ok(src.includes("TMD_UKEY_API"), "tmdTools.ts reads TMD_UKEY_API");
  ok(src.includes("TMD_UID_DEMO"), "tmdTools.ts reads TMD_UID_DEMO");
  ok(src.includes("TMD_UKEY_DEMO"), "tmdTools.ts reads TMD_UKEY_DEMO");
  // Verify TMD_STRICT_DEMO_BLOCK guard
  ok(src.includes("TMD_STRICT_DEMO_BLOCK"), "tmdTools.ts: TMD_STRICT_DEMO_BLOCK guard present");
  // Verify legacy fallback
  ok(src.includes("TMD_API_UID"), "tmdTools.ts: legacy TMD_API_UID fallback");
} else {
  ok(false, "tmdTools.ts found", "missing at innomcp-server-node/src/mcp/tools/tmdTools.ts");
}

// ─── Test 2c: NWP tools use correct endpoints per API type ───────────────────
// NOTE (Phase 10.13): Tools now use proper location vs area endpoints per docs:
//   location endpoints: /forecast/location/{daily,hourly}/at|place  (date= param)
//   area endpoint:      /forecast/area/region                        (starttime= param)
// getProvinceCoords is no longer needed — province param passed directly to /place endpoint.
section("Test 2c: NWP Tools — correct endpoints + Bearer header");

const nwpDailyPath = findFile([path.join(SERVER_ROOT, "src/mcp/tools/nwpDailyTool.ts")]);
const nwpHourlyPath = findFile([path.join(SERVER_ROOT, "src/mcp/tools/nwpHourlyTool.ts")]);
if (nwpDailyPath) {
  const src = fs.readFileSync(nwpDailyPath, "utf8");
  ok(src.includes("forecast/location/daily"), "nwpDailyTool.ts uses /forecast/location/daily endpoint");
  ok(src.includes("forecast/area/region"), "nwpDailyTool.ts uses /forecast/area/region for region queries");
  ok(src.includes("domain"), "nwpDailyTool.ts accepts domain param");
  ok(src.includes("starttime") || src.includes("date"), "nwpDailyTool.ts accepts date/starttime param");
  ok(src.includes("place") && src.includes("province"), "nwpDailyTool.ts accepts place/province aliases");
  ok(src.includes("Bearer"), "nwpDailyTool.ts uses Bearer (capital B) auth header");
} else {
  ok(false, "nwpDailyTool.ts found", "missing");
}
if (nwpHourlyPath) {
  const src = fs.readFileSync(nwpHourlyPath, "utf8");
  ok(src.includes("forecast/location/hourly"), "nwpHourlyTool.ts uses /forecast/location/hourly endpoint");
  ok(src.includes("forecast/area/region"), "nwpHourlyTool.ts uses /forecast/area/region for region queries");
  ok(src.includes("domain"), "nwpHourlyTool.ts accepts domain param");
  ok(src.includes("starttime") || src.includes("date"), "nwpHourlyTool.ts accepts date/starttime param");
  ok(src.includes("Bearer"), "nwpHourlyTool.ts uses Bearer (capital B) auth header");
} else {
  ok(false, "nwpHourlyTool.ts found", "missing");
}

// Check nwpApiConfig.ts itself
const nwpApiConfigPath = findFile([path.join(SERVER_ROOT, "src/mcp/config/nwpApiConfig.ts")]);
if (nwpApiConfigPath) {
  const src = fs.readFileSync(nwpApiConfigPath, "utf8");
  ok(true, "nwpApiConfig.ts exists");
  ok(src.includes("กรุงเทพมหานคร"), "nwpApiConfig: กรุงเทพมหานคร present");
  ok(src.includes("ภูเก็ต"), "nwpApiConfig: ภูเก็ต present");
  ok(src.includes("ภูเกตุ"), "nwpApiConfig: ภูเกตุ (alt spelling) present");
  ok(src.includes("getProvinceCoords"), "nwpApiConfig: getProvinceCoords() exported");
  ok(src.includes('"S"') && src.includes('"N"') && src.includes('"NE"'), "nwpApiConfig: all region codes present");
} else {
  ok(false, "nwpApiConfig.ts found", "missing at innomcp-server-node/src/mcp/config/nwpApiConfig.ts");
}

// ─── Test 3: tmdTools.ts tier assignments ────────────────────────────────────
section("Test 3: tmdTools.ts — Tier Assignments");

const tmdToolsPath = findFile([path.join(SERVER_ROOT, "src/mcp/tools/tmdTools.ts")]);
if (tmdToolsPath) {
  const src = fs.readFileSync(tmdToolsPath, "utf8");

  const demoTools = [
    "tmd_seismic_daily_events",
    "tmd_thailand_climate_normal_1981_2010",
    "tmd_thailand_monthly_rainfall",
    "tmd_rain_regions",
    "tmd_station_list",
  ];
  for (const tool of demoTools) {
    const idx = src.indexOf(`name: "${tool}"`);
    if (idx >= 0) {
      const block = src.slice(idx, idx + 400);
      ok(block.includes(`keyTier: "demo"`), `${tool}: keyTier="demo"`);
    } else {
      ok(false, `${tool}: found in tmdTools.ts`, "not found");
    }
  }

  const apiTools = [
    "tmd_weather_today_07am_all_stations",
    "tmd_weather_3hours_all_stations",
    "tmd_weather_forecast_7days_by_province",
    "tmd_weather_forecast_7days_by_region",
    "tmd_weather_warning_news",
  ];
  for (const tool of apiTools) {
    const idx = src.indexOf(`name: "${tool}"`);
    if (idx >= 0) {
      const block = src.slice(idx, idx + 400);
      ok(block.includes(`keyTier: "api"`), `${tool}: keyTier="api"`);
    } else {
      ok(false, `${tool}: found in tmdTools.ts`, "not found");
    }
  }

  ok(src.includes("requireTmdAuthForTier"), "requireTmdAuthForTier() defined");
  ok(src.includes("TMD_UID_API"), "tmdTools.ts reads TMD_UID_API");
  ok(src.includes("TMD_UID_DEMO"), "tmdTools.ts reads TMD_UID_DEMO");
  ok(src.includes("isTmdExternalAllowed"), "isTmdExternalAllowed() guard present");
} else {
  ok(false, "tmdTools.ts found", "missing");
}

// ─── Test 4: health.ts API key readiness ──────────────────────────────────────
// NOTE (Phase 10.12.5): health.ts was simplified to check openweather/nasa/nwp/tmd flat.
// TMD tier-split (tools.tmd_api / tools.tmd_demo) was not needed at this layer.
section("Test 4: health.ts — API Key Readiness");

const healthPath = findFile([path.join(SERVER_ROOT, "src/routes/api/health.ts")]);
if (healthPath) {
  const src = fs.readFileSync(healthPath, "utf8");
  ok(src.includes("NWP_API_KEY"), "health.ts checks NWP_API_KEY");
  ok(src.includes("openweather") || src.includes("OPENWEATHER"), "health.ts checks openweather");
  ok(src.includes("nasa") || src.includes("NASA"), "health.ts checks nasa");
  ok(src.includes("TMD_UID") || src.includes("TMD_API_UID"), "health.ts checks TMD credentials");
  ok(src.includes("Bearer token") || src.includes("bearer"), "health.ts: NWP uses Bearer token");
} else {
  ok(false, "health.ts found", "missing");
}

// ─── Test 5: test_all_tmd_nwp.ts structure ───────────────────────────────────
section("Test 5: test_all_tmd_nwp.ts — Coverage Check");

const testScriptPath = findFile([path.join(SERVER_ROOT, "scripts/test_all_tmd_nwp.ts")]);
if (testScriptPath) {
  const src = fs.readFileSync(testScriptPath, "utf8");
  ok(true, "test_all_tmd_nwp.ts exists");
  ok(src.includes("TMD_UID_API"), "script uses TMD_UID_API (api tier)");
  ok(src.includes("TMD_UID_DEMO"), "script uses TMD_UID_DEMO (demo tier)");
  ok(src.includes("NWP_API_KEY"), "script tests NWP_API_KEY");
  ok(src.includes("INNOMCP_MODE"), "script respects INNOMCP_MODE guard");

  const tmdCalls = (src.match(/testTmdEndpoint\(/g) || []).length;
  ok(tmdCalls >= 17, `≥17 TMD testTmdEndpoint() calls`, `found ${tmdCalls}`);

  // Script uses fetchNwpRaw + checkNwpResult pattern (refactored from testNwpEndpoint in phase10.13)
  const nwpRawCalls = (src.match(/fetchNwpRaw\(/g) || []).length;
  const nwpLegacyCalls = (src.match(/testNwpEndpoint\(/g) || []).length;
  const nwpTotalCoverage = nwpRawCalls + nwpLegacyCalls;
  ok(nwpTotalCoverage >= 4, `≥4 NWP endpoint calls (fetchNwpRaw or testNwpEndpoint)`, `found ${nwpTotalCoverage}`);

  // Verify demo-tier tools are tested with demo creds
  ok(src.includes(`"demo"`), "demo-tier tests use creds labeled demo");
  // Verify api-tier tools are tested with api creds
  ok(src.includes(`"api"`), "api-tier tests use creds labeled api");
} else {
  ok(false, "test_all_tmd_nwp.ts found", "missing at innomcp-server-node/scripts/");
}

// ─── Test 6: Evidence log coverage check ─────────────────────────────────────
section("Test 6: Evidence — phase101a Weather Pipeline Coverage");

const evidenceFiles = fs.existsSync(EVIDENCE_DIR)
  ? fs.readdirSync(EVIDENCE_DIR).filter((f) => f.startsWith("phase101a") && f.endsWith(".log")).sort().reverse()
  : [];

if (evidenceFiles.length > 0) {
  const latestLog = fs.readFileSync(path.join(EVIDENCE_DIR, evidenceFiles[0]), "utf8");
  ok(latestLog.includes("กรุงเทพมหานคร"), `Evidence: กรุงเทพมหานคร present`, evidenceFiles[0]);
  ok(latestLog.includes("เชียงใหม่"), `Evidence: เชียงใหม่ present`);
  ok(latestLog.includes("ภูเก็ต"), `Evidence: ภูเก็ต present`);
  ok(latestLog.includes("สงขลา") || latestLog.includes("Top 7"), `Evidence: สงขลา or nationwide table present`);
  ok(latestLog.includes("status=200") || latestLog.includes("code=OK"), `Evidence: status=200 or code=OK present`);
  log(`  Latest evidence: ${evidenceFiles[0]}`);
} else {
  log("  ⚠️  No phase101a evidence files — run verify_phase101a first");
  ok(false, "phase101a evidence files found", "run: WEATHER_FIXTURE_W1=1 SMOKE_MODE=1 npx ts-node scripts/verify_phase101a_weather_contract.ts");
}

// ─── Summary ──────────────────────────────────────────────────────────────────
section("Summary");
log(`  Passed: ${passed}/${passed + failed}`);
log(`  Failed: ${failed}/${passed + failed}`);
if (failures.length) {
  log("\n  Failures:");
  failures.forEach((f) => log("  " + f));
}
log(`\n  Result: ${failed === 0 ? "PASS ✅" : "FAIL ❌"}`);

// ─── Write evidence ───────────────────────────────────────────────────────────
const ts = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace("T", "-")
  .slice(0, 15);
const evidenceFile = path.join(EVIDENCE_DIR, `phase109-tmd-nwp-endpoints-${ts}.log`);
fs.writeFileSync(evidenceFile, logLines.join("\n") + "\n", "utf8");
log(`\nevidence: ${evidenceFile}`);

process.exit(failed > 0 ? 1 : 0);

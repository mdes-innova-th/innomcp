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

// ─── Test 2b: tmdApiConfig.ts exists and is complete ─────────────────────────
section("Test 2b: tmdApiConfig.ts — Endpoint→Tier Config Module");

const tmdApiConfigPath = findFile([path.join(SERVER_ROOT, "src/mcp/tmdApiConfig.ts")]);
if (tmdApiConfigPath) {
  const src = fs.readFileSync(tmdApiConfigPath, "utf8");
  ok(true, "tmdApiConfig.ts exists at innomcp-server-node/src/mcp/");

  // Check all 17 TMD tool names are present
  const ALL_17_TMD_TOOLS = [
    "tmd_seismic_daily_events",
    "tmd_thailand_climate_normal_1981_2010",
    "tmd_thailand_monthly_rainfall",
    "tmd_rain_regions",
    "tmd_station_list",
    "tmd_weather_today_07am_all_stations",
    "tmd_weather_3hours_all_stations",
    "tmd_weather_forecast_7days_by_province",
    "tmd_daily_forecast_4_times",
    "tmd_weather_warning_news",
    "tmd_weather_forecast_7days_by_region",
    "tmd_weather_3hours_by_hydro",
    "tmd_weather_3hours_by_agro",
    "tmd_weather_3hours_by_synop",
    "tmd_weather_today_by_hydro",
    "tmd_weather_today_by_agro",
    "tmd_weather_today_by_synop",
  ];
  let toolCount = 0;
  for (const tool of ALL_17_TMD_TOOLS) {
    if (src.includes(tool)) toolCount++;
  }
  ok(toolCount === 17, `TMD_ENDPOINT_TIERS has all 17 tools`, `found ${toolCount}/17`);

  // Check demo assignments
  ok(src.includes(`tmd_seismic_daily_events`), "seismic in config");
  ok(src.includes(`"demo"`), "demo tier present in config");
  ok(src.includes(`"api"`), "api tier present in config");
  ok(src.includes("getTmdCredsForTier"), "getTmdCredsForTier() exported");
  ok(src.includes("getTmdTierForTool"), "getTmdTierForTool() exported");
  ok(src.includes("checkNwpScopes"), "checkNwpScopes() exported");
  ok(src.includes("decodeNwpJwtScopes"), "decodeNwpJwtScopes() exported");
  ok(src.includes("NWP_REQUIRED_SCOPES"), "NWP_REQUIRED_SCOPES exported");
  ok(src.includes("nwp.api.forecast_location"), "NWP scope: nwp.api.forecast_location");
  ok(src.includes("nwp.api.location.forecast_daily"), "NWP scope: nwp.api.location.forecast_daily");
  ok(src.includes("nwp.api.location.forecast_hourly"), "NWP scope: nwp.api.location.forecast_hourly");
  ok(src.includes("nwp.api.forecast_area"), "NWP scope: nwp.api.forecast_area");
} else {
  ok(false, "tmdApiConfig.ts found", "missing at innomcp-server-node/src/mcp/tmdApiConfig.ts");
}

// ─── Test 2c: NWP tools import tmdApiConfig ───────────────────────────────────
section("Test 2c: NWP Tools — tmdApiConfig Integration");

const nwpDailyPath = findFile([path.join(SERVER_ROOT, "src/mcp/tools/nwpDailyTool.ts")]);
const nwpHourlyPath = findFile([path.join(SERVER_ROOT, "src/mcp/tools/nwpHourlyTool.ts")]);
if (nwpDailyPath) {
  const src = fs.readFileSync(nwpDailyPath, "utf8");
  ok(src.includes("tmdApiConfig"), "nwpDailyTool.ts imports tmdApiConfig");
  ok(src.includes("checkNwpScopes"), "nwpDailyTool.ts calls checkNwpScopes()");
  ok(src.includes("NWP_JWT_EMPTY_SCOPES") || src.includes("NWP_JWT_MISSING_SCOPES"), "nwpDailyTool.ts has scope warn log");
} else {
  ok(false, "nwpDailyTool.ts found", "missing");
}
if (nwpHourlyPath) {
  const src = fs.readFileSync(nwpHourlyPath, "utf8");
  ok(src.includes("tmdApiConfig"), "nwpHourlyTool.ts imports tmdApiConfig");
  ok(src.includes("checkNwpScopes"), "nwpHourlyTool.ts calls checkNwpScopes()");
} else {
  ok(false, "nwpHourlyTool.ts found", "missing");
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

// ─── Test 4: health.ts tier-split readiness ───────────────────────────────────
section("Test 4: health.ts — TMD Tier-split Readiness");

const healthPath = findFile([path.join(SERVER_ROOT, "src/routes/api/health.ts")]);
if (healthPath) {
  const src = fs.readFileSync(healthPath, "utf8");
  ok(src.includes("tools.tmd_api"), "tools.tmd_api entry added");
  ok(src.includes("tools.tmd_demo"), "tools.tmd_demo entry added");
  ok(src.includes("TMD_UID_API"), "health.ts checks TMD_UID_API");
  ok(src.includes("TMD_UID_DEMO"), "health.ts checks TMD_UID_DEMO");
  ok(src.includes("required_for_online: true"), "tmd_api: required_for_online=true");
  ok(src.includes("required_for_online: false") && src.includes("tmd_demo"), "tmd_demo: required_for_online=false");
  ok(
    src.includes("migrate to TMD_UID_API") || src.includes("TMD_UID_API/TMD_UKEY_API"),
    "health.ts: migration note for deprecated TMD_UID/TMD_UKEY"
  );
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

  const nwpCalls = (src.match(/testNwpEndpoint\(/g) || []).length;
  ok(nwpCalls >= 4, `≥4 NWP testNwpEndpoint() calls`, `found ${nwpCalls}`);

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

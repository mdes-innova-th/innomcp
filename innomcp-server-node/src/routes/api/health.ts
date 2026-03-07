import { Router } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

/**
 * Readiness / health check — tool key status
 * GET /api/health/keys
 *
 * ตรวจว่า env ที่ tools ต้องใช้มีครบหรือไม่ โดยไม่ยิง HTTP จริง
 * status values: "ready" | "missing" | "demo" | "configured"
 */
router.get("/keys", async (_req, res) => {
  const mode = String(process.env.INNOMCP_MODE || "offline").trim().toLowerCase() === "online" ? "online" : "offline";
  const smokeMode = process.env.SMOKE_MODE === "1";
  const weatherFixtureW1 = process.env.WEATHER_FIXTURE_W1 === "1";

  const results: Record<string, { status: string; message: string; required_for_online: boolean }> = {};
  const deprecatedEnvDetected = {
    TMD_API_UID: String(process.env.TMD_API_UID || "").trim().length > 0,
    TMD_API_UKEY: String(process.env.TMD_API_UKEY || "").trim().length > 0,
  };

  // --- TMD API (tmdTools.ts อ่าน TMD_UID / TMD_UKEY) ---
  const tmdUid = String(process.env.TMD_UID || "").trim();
  const tmdUkey = String(process.env.TMD_UKEY || "").trim();
  if (!tmdUid || !tmdUkey) {
    results.tmd = { status: "missing", message: "TMD_UID หรือ TMD_UKEY ไม่ได้ตั้งค่า", required_for_online: true };
  } else {
    results.tmd = { status: "ready", message: "TMD credentials พร้อมใช้", required_for_online: true };
  }

  // --- NWP API (nwpDailyTool / nwpHourlyTool) ---
  const nwpKey = String(process.env.NWP_API_KEY || "").trim();
  if (!nwpKey) {
    results.nwp = { status: "missing", message: "NWP_API_KEY ไม่ได้ตั้งค่า", required_for_online: true };
  } else {
    results.nwp = { status: "ready", message: "NWP Bearer JWT พร้อมใช้", required_for_online: true };
  }

  // --- OpenWeather (weatherTool.ts) ---
  const owKey = String(process.env.OPENWEATHER_API_KEY || "").trim();
  if (!owKey) {
    results.openweather = { status: "missing", message: "OPENWEATHER_API_KEY ไม่ได้ตั้งค่า", required_for_online: false };
  } else {
    results.openweather = { status: "ready", message: "OpenWeather API key พร้อมใช้", required_for_online: false };
  }

  // --- NASA (nasaTool.ts — default DEMO_KEY ใช้ได้เสมอ) ---
  const nasaKey = String(process.env.NASA_API_KEY || "DEMO_KEY").trim();
  results.nasa = {
    status: nasaKey === "DEMO_KEY" ? "demo" : "ready",
    message: nasaKey === "DEMO_KEY" ? "ใช้ DEMO_KEY (rate limit ต่ำ)" : "NASA custom key พร้อมใช้",
    required_for_online: false,
  };

  // --- WEBDDSB (webdTools.ts) ---
  const webddsbHost = String(process.env.WEBDDSB_HOST || "").trim();
  const webddsbApiKey = String(process.env.WEBDDSB_APIKEY || "").trim();
  if (!webddsbHost || !webddsbApiKey) {
    results.webddsb = { status: "missing", message: "WEBDDSB_HOST หรือ WEBDDSB_APIKEY ไม่ได้ตั้งค่า", required_for_online: false };
  } else {
    results.webddsb = { status: "ready", message: `WEBDDSB พร้อมใช้ (${webddsbHost})`, required_for_online: false };
  }

  // --- DetectDB / EvidenceTool ---
  const detectHost = String(process.env.DETECT_DB_HOST || "").trim();
  const detectUser = String(process.env.DETECT_DB_USER || "").trim();
  const detectPass = process.env.DETECT_DB_PASSWORD;
  const detectDb = String(process.env.DETECT_DB_NAME || "").trim();
  if (!detectHost || !detectUser || detectPass === undefined || !detectDb) {
    results.detect_db = { status: "missing", message: "DETECT_DB_* ไม่ครบ (HOST/USER/PASSWORD/NAME)", required_for_online: false };
  } else {
    results.detect_db = { status: "ready", message: `DetectDB พร้อมใช้ (${detectHost})`, required_for_online: false };
  }

  // --- App DB ---
  const dbHost = String(process.env.DB_HOST || "").trim();
  const dbUser = String(process.env.DB_USER || "").trim();
  if (!dbHost || !dbUser) {
    results.app_db = { status: "missing", message: "DB_HOST หรือ DB_USER ไม่ได้ตั้งค่า", required_for_online: false };
  } else {
    results.app_db = { status: "ready", message: `App DB พร้อมใช้ (${dbHost})`, required_for_online: false };
  }

  // --- Summary ---
  const notReadyOnline = Object.entries(results)
    .filter(([, v]) => v.required_for_online && v.status === "missing")
    .map(([k]) => k);

  const modeReady = mode === "online" ? notReadyOnline.length === 0 : true;
  const modeNote = mode === "offline"
    ? "offline mode: external checks are skipped and API keys are not required"
    : (modeReady ? "online mode: required keys are configured" : "online mode: missing required keys");

  res.json({
    timestamp: new Date().toISOString(),
    mode,
    smoke_mode: smokeMode,
    weather_fixture_w1: weatherFixtureW1,
    mode_ready: modeReady,
    mode_note: modeNote,
    not_ready_for_online: notReadyOnline,
    deprecated_env_detected: deprecatedEnvDetected,
    tools: results,
  });
});

export default router;

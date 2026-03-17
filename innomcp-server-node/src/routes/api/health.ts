import { Router } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

type ReadinessStatus = "ready" | "missing" | "demo" | "configured";
type ReadinessItem = {
  status: ReadinessStatus;
  message: string;
  required_for_online: boolean;
};

type SmokeStatus = "pass" | "fail" | "skip";
type SmokeToolResult = {
  status: SmokeStatus;
  reason: string;
  details?: Record<string, unknown>;
};

function normalizeMode(raw: string | undefined): "offline" | "online" {
  return String(raw || "offline").trim().toLowerCase() === "online" ? "online" : "offline";
}

function getWebdBaseUrl(): string {
  const rawHost = String(process.env.WEBDDSB_HOST || "").trim();
  const port = String(process.env.WEBDDSB_PORT || "3011").trim();
  if (!rawHost) return "";
  const hasScheme = /^https?:\/\//i.test(rawHost);
  if (hasScheme) return rawHost.replace(/\/$/, "");
  return `http://${rawHost}:${port}`;
}

function hasEnv(name: string): boolean {
  return String(process.env[name] || "").trim().length > 0;
}

async function probeWebd(baseUrl: string, apiKey: string): Promise<SmokeToolResult> {
  if (!baseUrl) {
    return { status: "fail", reason: "missing WEBDDSB_HOST" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${baseUrl}/api-get/csrf`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        status: "fail",
        reason: "webd csrf probe failed",
        details: { status_code: res.status, base_url: baseUrl },
      };
    }

    return {
      status: "pass",
      reason: "webd config + csrf probe ok",
      details: { base_url: baseUrl },
    };
  } catch (error: any) {
    return {
      status: "fail",
      reason: "webd unreachable",
      details: { error: String(error?.message || error), base_url: baseUrl },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Readiness / health check — tool key status
 * GET /api/health/keys
 */
router.get("/keys", async (_req, res) => {
  const mode = normalizeMode(process.env.INNOMCP_MODE);
  const smokeMode = process.env.SMOKE_MODE === "1";
  const weatherFixtureW1 = process.env.WEATHER_FIXTURE_W1 === "1";

  const tools: Record<string, ReadinessItem> = {};
  const deprecatedEnvDetected = {
    TMD_API_UID: String(process.env.TMD_API_UID || "").trim().length > 0,
    TMD_API_UKEY: String(process.env.TMD_API_UKEY || "").trim().length > 0,
  };

  // api tier: TMD_UID_API / TMD_UKEY_API (fallback to deprecated TMD_UID / TMD_UKEY)
  const tmdApiUid = String(process.env.TMD_UID_API || process.env.TMD_UID || "").trim();
  const tmdApiUkey = String(process.env.TMD_UKEY_API || process.env.TMD_UKEY || "").trim();
  tools.tmd_api = (!tmdApiUid || !tmdApiUkey)
    ? { status: "missing", message: "missing TMD_UID_API/TMD_UKEY_API (api-tier: v2 real-time endpoints)", required_for_online: true }
    : { status: "ready", message: `TMD api-tier ready (uid=${tmdApiUid})`, required_for_online: true };

  // demo tier: TMD_UID_DEMO / TMD_UKEY_DEMO (fallback to deprecated TMD_UID / TMD_UKEY; default demo/demo is valid)
  const tmdDemoUid = String(process.env.TMD_UID_DEMO || process.env.TMD_UID || "demo").trim();
  const tmdDemoUkey = String(process.env.TMD_UKEY_DEMO || process.env.TMD_UKEY || "demo").trim();
  tools.tmd_demo = (!tmdDemoUid || !tmdDemoUkey)
    ? { status: "missing", message: "missing TMD_UID_DEMO/TMD_UKEY_DEMO (demo-tier: v1 public datasets)", required_for_online: false }
    : { status: tmdDemoUid === "demo" ? "demo" : "ready", message: `TMD demo-tier ready (uid=${tmdDemoUid})`, required_for_online: false };

  const nwpKey = String(process.env.NWP_API_KEY || "").trim();
  tools.nwp = !nwpKey
    ? { status: "missing", message: "missing NWP_API_KEY", required_for_online: true }
    : { status: "ready", message: "NWP token ready", required_for_online: true };

  const webddsbHost = String(process.env.WEBDDSB_HOST || "").trim();
  const webddsbApiKey = String(process.env.WEBDDSB_APIKEY || "").trim();
  tools.webddsb = (!webddsbHost || !webddsbApiKey)
    ? { status: "missing", message: "missing WEBDDSB_HOST/WEBDDSB_APIKEY", required_for_online: false }
    : { status: "ready", message: "WEBDDSB ready (" + webddsbHost + ")", required_for_online: false };

  const owKey = String(process.env.OPENWEATHER_API_KEY || "").trim();
  tools.openweather = !owKey
    ? { status: "missing", message: "missing OPENWEATHER_API_KEY", required_for_online: false }
    : { status: "ready", message: "OpenWeather key ready", required_for_online: false };

  const nasaKey = String(process.env.NASA_API_KEY || "DEMO_KEY").trim();
  tools.nasa = {
    status: nasaKey === "DEMO_KEY" ? "demo" : "ready",
    message: nasaKey === "DEMO_KEY" ? "using DEMO_KEY" : "NASA key ready",
    required_for_online: false,
  };

  const detectHost = String(process.env.DETECT_DB_HOST || "").trim();
  const detectUser = String(process.env.DETECT_DB_USER || "").trim();
  const detectPass = String(process.env.DETECT_DB_PASSWORD || "");
  const detectDb = String(process.env.DETECT_DB_NAME || "").trim();
  tools.detect_db = (!detectHost || !detectUser || !detectPass || !detectDb)
    ? { status: "missing", message: "missing DETECT_DB_HOST/USER/PASSWORD/NAME", required_for_online: false }
    : { status: "ready", message: "DetectDB ready (" + detectHost + ")", required_for_online: false };

  const dbHost = String(process.env.DB_HOST || "").trim();
  const dbUser = String(process.env.DB_USER || "").trim();
  const dbPass = String(process.env.DB_PASSWORD || "");
  const dbName = String(process.env.DB_NAME || "").trim();
  tools.app_db = (!dbHost || !dbUser || !dbPass || !dbName)
    ? { status: "missing", message: "missing DB_HOST/USER/PASSWORD/NAME", required_for_online: false }
    : { status: "ready", message: "AppDB ready (" + dbHost + ")", required_for_online: false };

  const requiredMissing = Object.entries(tools)
    .filter(([, v]) => v.required_for_online && v.status === "missing")
    .map(([k]) => k);
  const allMissing = Object.entries(tools)
    .filter(([, v]) => v.status === "missing")
    .map(([k]) => k);

  const modeReady = mode === "online" ? requiredMissing.length === 0 : true;
  const notes: string[] = [];
  if (mode === "offline") notes.push("offline mode: external API calls must be blocked by tools");
  if (mode === "online" && modeReady) notes.push("online mode: required keys configured");
  if (mode === "online" && !modeReady) notes.push("online mode: required keys missing");
  if (deprecatedEnvDetected.TMD_API_UID || deprecatedEnvDetected.TMD_API_UKEY) {
    notes.push("deprecated TMD_API_UID/TMD_API_UKEY detected; use TMD_UID_API/TMD_UKEY_API");
  }
  const tmdUidLegacy = String(process.env.TMD_UID || "").trim();
  const tmdUkeyLegacy = String(process.env.TMD_UKEY || "").trim();
  if ((tmdUidLegacy || tmdUkeyLegacy) && (!String(process.env.TMD_UID_API || "").trim())) {
    notes.push("TMD_UID/TMD_UKEY detected as fallback; migrate to TMD_UID_API/TMD_UKEY_API (see ENV_SETUP.md)");
  }

  res.json({
    timestamp: new Date().toISOString(),
    mode,
    smoke_mode: smokeMode,
    weather_fixture_w1: weatherFixtureW1,
    mode_ready: modeReady,
    missing_keys: allMissing,
    required_missing_keys: requiredMissing,
    notes,
    tools,
    deprecated_env_detected: deprecatedEnvDetected,
  });
});

/**
 * Mode-aware smoke test for critical MCP tools (TMD/NWP/WEBD)
 * GET /api/health/smoke-tools
 */
router.get("/smoke-tools", async (_req, res) => {
  const mode = normalizeMode(process.env.INNOMCP_MODE);
  const smokeMode = process.env.SMOKE_MODE === "1";
  const weatherFixtureW1 = process.env.WEATHER_FIXTURE_W1 === "1";
  const externalAllowed = mode === "online" && !smokeMode && !weatherFixtureW1;

  const tools: Record<string, SmokeToolResult> = {};

  if (!externalAllowed) {
    const reason = "skipped by mode (requires INNOMCP_MODE=online and no smoke/fixture flags)";
    tools.tmd = { status: "skip", reason };
    tools.nwp = { status: "skip", reason };
    tools.webd = { status: "skip", reason };
  } else {
    const tmdUidOk = hasEnv("TMD_UID");
    const tmdUkeyOk = hasEnv("TMD_UKEY");
    tools.tmd = tmdUidOk && tmdUkeyOk
      ? { status: "pass", reason: "TMD credentials present" }
      : {
          status: "fail",
          reason: "missing TMD_UID/TMD_UKEY",
          details: { TMD_UID: tmdUidOk, TMD_UKEY: tmdUkeyOk },
        };

    const nwpKey = String(process.env.NWP_API_KEY || "").trim();
    tools.nwp = nwpKey
      ? {
          status: "pass",
          reason: "NWP token present",
          details: { demo_like_key: nwpKey === "demo" || nwpKey === "demokey" || nwpKey.includes("api12345") },
        }
      : { status: "fail", reason: "missing NWP_API_KEY" };

    const webdApiKey = String(process.env.WEBDDSB_APIKEY || "").trim();
    if (!webdApiKey) {
      tools.webd = { status: "fail", reason: "missing WEBDDSB_APIKEY" };
    } else {
      tools.webd = await probeWebd(getWebdBaseUrl(), webdApiKey);
    }
  }

  const failing = Object.entries(tools)
    .filter(([, v]) => v.status === "fail")
    .map(([k]) => k);

  const status = failing.length > 0 ? "fail" : "pass";
  const notes: string[] = [];
  if (!externalAllowed) {
    notes.push("smoke endpoint skipped external checks because current mode is offline/smoke/fixture");
  }

  res.status(status === "pass" ? 200 : 503).json({
    timestamp: new Date().toISOString(),
    status,
    mode,
    smoke_mode: smokeMode,
    weather_fixture_w1: weatherFixtureW1,
    external_checks_enabled: externalAllowed,
    failing_tools: failing,
    notes,
    tools,
  });
});

export default router;

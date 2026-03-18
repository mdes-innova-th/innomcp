import { Router } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

/**
 * Health check endpoint with API key validation
 * GET /api/health/keys
 */
router.get("/keys", async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    openweather: { status: "unknown", message: "" },
    nasa: { status: "unknown", message: "" },
    nwp: { status: "unknown", message: "" },
    tmd: { status: "unknown", message: "" },
  };

  // Check OpenWeather API
  const openweatherKey = process.env.OPENWEATHER_API_KEY;
  if (!openweatherKey) {
    results.openweather = { status: "missing", message: "API key not configured" };
  } else {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=Bangkok&appid=${openweatherKey}`
      );
      if (response.ok) {
        results.openweather = { status: "valid", message: "API key working" };
      } else if (response.status === 401) {
        results.openweather = { status: "invalid", message: "API key invalid" };
      } else if (response.status === 429) {
        results.openweather = { status: "rate_limited", message: "Rate limit exceeded" };
      } else {
        results.openweather = { status: "error", message: `HTTP ${response.status}` };
      }
    } catch (error) {
      results.openweather = { status: "error", message: String(error) };
    }
  }

  // Check NASA API
  const nasaKey = process.env.NASA_API_KEY;
  if (!nasaKey) {
    results.nasa = { status: "missing", message: "API key not configured" };
  } else {
    results.nasa = { status: "configured", message: nasaKey === "DEMO_KEY" ? "Using demo key" : "Custom key set" };
  }

  // Check NWP API
  const nwpKey = process.env.NWP_API_KEY;
  if (!nwpKey) {
    results.nwp = { status: "missing", message: "API key not configured" };
  } else {
    results.nwp = { status: "configured", message: "Bearer token configured (NWP does not require non-empty scopes in local validation)" };
  }

  // Check TMD API
  const tmdUid = process.env.TMD_UID || process.env.TMD_API_UID;
  const tmdUkey = process.env.TMD_UKEY || process.env.TMD_API_UKEY;
  if (!tmdUid || !tmdUkey) {
    results.tmd = { status: "missing", message: "API credentials not configured" };
  } else {
    results.tmd = { status: "configured", message: "Public API credentials set" };
  }

  res.json(results);
});

export default router;

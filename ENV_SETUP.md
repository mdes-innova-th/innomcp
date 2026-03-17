# ENV_SETUP.md — Environment Configuration Guide

> Updated: 2026-03-17 | Phase 10.7+

---

## Services Overview

| Service | Port | .env file |
|---------|------|-----------|
| innomcp-node | 3011 | `innomcp-node/.env` |
| innomcp-server-node | 3012 | `innomcp-server-node/.env` |
| innomcp-next | 3000 | `innomcp-next/.env.local` |

---

## INNOMCP_MODE

`INNOMCP_MODE` is the master switch for external API access. Set in **both** services.

| Value | Behavior |
|-------|----------|
| `offline` | All external API calls blocked; fixture/smoke mode only |
| `online` | External APIs enabled; requires valid credentials |

**Default:** `offline` (if unset)

### Set in both services:
```
# innomcp-node/.env
INNOMCP_MODE=online

# innomcp-server-node/.env
INNOMCP_MODE=online
```

---

## Offline Mode (Fixture/Smoke)

Use offline mode for development, CI, or when real credentials are unavailable.

```bash
# innomcp-server-node/.env
INNOMCP_MODE=offline
WEATHER_FIXTURE_W1=1   # primes fixture cache for Bangkok, Chiang Rai, Phuket
SMOKE_MODE=1           # enables smoke-only responses
```

Fixture data covers: กรุงเทพมหานคร, เชียงราย, ภูเก็ต
Queries for other provinces return `FIXTURE_FORECAST_MISS`.

### Test offline mode:
```bash
curl -X POST http://localhost:3011/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"อากาศภูเก็ตวันนี้","sessionId":"test-offline"}'
```

---

## Online Mode — Required Credentials

### TMD (Thai Meteorological Department)

Used for: weather forecast, station data, warnings, seismic events

TMD credentials are split into two tiers with separate env vars:

#### API Tier — real-time observation + forecast v2 endpoints

```
# innomcp-server-node/.env
TMD_UID_API=<your_registered_uid>
TMD_UKEY_API=<your_registered_ukey>
```

Used by: `WeatherToday/V2`, `Weather3Hours/V2`, `WeatherForecast7Days/v2`, `DailyForecast/v2`, `WeatherWarningNews/v2`, `WeatherForecast7DaysByRegion/v2`, all `Weather3HoursByX/V1`, `WeatherTodayByX/V1`

- Register at: https://data.tmd.go.th/
- **`demo`/`demo` will fail** with `TMD_API_AUTH_FAIL` on these endpoints

#### Demo Tier — public v1 datasets

```
# innomcp-server-node/.env
TMD_UID_DEMO=demo
TMD_UKEY_DEMO=demo
```

Used by: `DailySeismicEvent/v1`, `ThailandClimateNormal/v1`, `Station/v1`, `ThailandMonthlyRainfall/v1`, `RainRegions/v1`

- Default `demo`/`demo` works for public datasets
- Can be overridden with registered credentials

#### Deprecated (backwards-compatible fallback)

```
# innomcp-server-node/.env — used only if TMD_UID_API / TMD_UID_DEMO are not set
TMD_UID=<fallback_uid>
TMD_UKEY=<fallback_ukey>
```

Fallback chain: `TMD_UID_API` → `TMD_UID` (deprecated)

- Auth failure is auto-detected by `isAuthFailLikeText()` and returned as structured error `TMD_API_AUTH_FAIL`

### NWP (Numerical Weather Prediction)

Used for: hourly/daily high-resolution forecast by lat/lon

```
# innomcp-server-node/.env
NWP_API_KEY=<jwt_token>
```

- JWT token from TMD NWP API registration
- Token with empty `"scopes":[]` will get 401 Unauthorized
- Register at: https://data.tmd.go.th/nwpapi/

### Verifying credentials:
```bash
curl http://localhost:3012/api/health/keys
```

Expected online-ready response:
```json
{
  "mode": "online",
  "mode_ready": true,
  "tools": {
    "tmd": { "status": "ready" },
    "nwp": { "status": "ready" }
  }
}
```

---

## TMD Auth Fail Handling

When TMD credentials fail, the system:
1. Detects `"Authentication fail"` in response body via `isAuthFailLikeText()`
2. Returns `TMD_API_AUTH_FAIL` error code (not a timeout)
3. Weather pipeline returns `WX_NO_DATA` to the chat response
4. Chat renders a polite "ยังไม่มีข้อมูลอากาศ" message (not a crash)

---

## Environment Variables Reference

### innomcp-server-node/.env (weather-critical)

| Variable | Required | Description |
|----------|----------|-------------|
| `INNOMCP_MODE` | Yes | `online` or `offline` |
| `TMD_UID_API` | Online | TMD UID for api-tier endpoints (v2 forecast/observation) |
| `TMD_UKEY_API` | Online | TMD key for api-tier endpoints |
| `TMD_UID_DEMO` | Optional | TMD UID for demo-tier endpoints (public v1); default `demo` |
| `TMD_UKEY_DEMO` | Optional | TMD key for demo-tier endpoints; default `demo` |
| `TMD_UID` | Deprecated | Fallback UID (use TMD_UID_API instead) |
| `TMD_UKEY` | Deprecated | Fallback key (use TMD_UKEY_API instead) |
| `NWP_API_KEY` | Online | TMD NWP JWT token (must have full scopes, not empty `[]`) |
| `WEATHER_FIXTURE_W1` | Offline | `1` to enable fixture mode |
| `SMOKE_MODE` | Dev | `1` to enable smoke-only mode |
| `WEBDDSB_HOST` | Optional | WebD DSB service host |
| `WEBDDSB_PORT` | Optional | WebD DSB service port |

### innomcp-node/.env (chat/routing)

| Variable | Required | Description |
|----------|----------|-------------|
| `INNOMCP_MODE` | Yes | `online` or `offline` (controls chatMeta.mode) |
| `MCPSERVER_URL` | Yes | URL to innomcp-server-node MCP endpoint |
| `TMD_UID` | Online | TMD UID (passed to server if needed) |
| `TMD_UKEY` | Online | TMD key (passed to server if needed) |
| `OLLAMA_MODEL` | Yes | LLM model name (e.g. `gemma3:4b`) |
| `OLLAMA_HOST` | Yes | Ollama base URL |
| `REDIS_HOST` | Yes | Redis host for session cache |

---

## Restart Procedure

After changing `.env` files, restart the affected service:

```bash
# Restart innomcp-server-node
cd innomcp-server-node
npm run dev

# Restart innomcp-node
cd innomcp-node
npm run dev
```

**Note:** The running process must be restarted for env changes to take effect. Patching `.env` while the service is running has no immediate effect.

---

## Testing Guide

### Quick HTTP chat test:
```bash
# Offline mode (fixture)
WEATHER_FIXTURE_W1=1 in server-node .env, then:
curl -X POST http://localhost:3011/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"อากาศกรุงเทพวันนี้","sessionId":"s1"}'

# Online mode
INNOMCP_MODE=online + real TMD credentials, then same curl
```

### Verifiers:
```bash
# Offline verifier (WEATHER_FIXTURE_W1=1 in server-node)
npx ts-node innomcp-node/src/utils/weather/verifiers/verify_phase101a_weather_contract.ts

# Thai knowledge routing verifier
npx ts-node innomcp-node/src/utils/verifiers/verify_phase105_thai_knowledge_routing.ts
```

### Health checks:
```bash
# Server-node key status
curl http://localhost:3012/api/health/keys

# Server-node smoke tools
curl http://localhost:3012/api/health/smoke-tools
```

---

## Known Limitations (as of 2026-03-17)

- **TMD demo credentials**: `demo`/`demo` returns auth fail — requires real registration
- **NWP JWT scopes**: Empty `scopes:[]` in JWT causes 401 — requires full-access token
- **webd service**: Not running locally (non-critical, tool gracefully degrades)
- **DETECT_DB**: External detect DB at 209.15.105.27 (optional, for evidence tools)

---

## Related Files

- `innomcp-server-node/.env` — server-node environment (weather keys here)
- `innomcp-node/.env` — node environment (chat, LLM, MCP URL)
- `REPORT_PROBLEM.md` — active incidents and fixes log
- `TODO.md` — development progress log
- `docs/reports/` — phase completion reports and evidence

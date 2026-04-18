# Test-Only vs Production-Intended Configuration

**Commit:** `7157dc8` | **Date:** 2026-04-18

---

## Purpose

This document separates test-environment-only values from production-intended configuration, so the team knows exactly what must change before any production deployment.

---

## 🔴 MUST ROTATE Before Production

These values are hardcoded in test files and/or `.env` for local development. They **must not** go to production as-is.

| Variable | Current Value | Where Used | Action |
|----------|--------------|------------|--------|
| `JWT_SECRET` | `gMail.com` | `.env`, signoff.spec.ts fallback | Generate strong random ≥32 chars |
| `API_KEY_SECRET` | `yaHoo.com` | `.env` | Generate strong random |
| `DB_PASSWORD` | `rockbottom` | `.env` | Use strong unique password |
| `MARIADB_ROOT_PASSWORD` | `rockbottom` | `.env` | Use strong unique password |
| `REDIS_PASSWORD` | `rockbottom` | `.env` | Use strong unique password |
| `EVIDENCE_DB_PASSWORD` | `1nNo12345678!@#$` | `.env` (remote 209.15.105.27) | Rotate on remote server |
| `REMOTE_OLLAMA_TOKEN` | `9e34679b9d60d8b...` | `.env` | Rotate token |
| `API_KEY` (base) | `innomcp_d5acd09c...` | `.env`, test files | Generate new key for prod |

## 🟡 Code Fallback Values (Ensure Env Var Is Set)

These fallbacks exist in source code and will activate if the env var is missing. **Production must always set the env var.**

| Fallback | File | Value |
|----------|------|-------|
| `JWT_SECRET` | `src/utils/jwt.ts` | `innomcp-secret-key-change-in-production` |
| `JWT_SECRET` | `src/utils/config/index.ts` | `default-secret-change-me` |
| `API_KEY_ENCRYPTION_SECRET` | `src/utils/apikey/index.ts` | `default-secret-change-me` |

## 🟢 Test-Only Values (No Production Impact)

These exist only in test fixtures and don't need rotation — they're not used by the production server.

| Value | Purpose | Location |
|-------|---------|----------|
| `CSRF_SECRET=testcsrf123` | E2E test CSRF token | signoff.spec.ts, tmp/ battery tests |
| `Test1234!` | Test register password | signoff.spec.ts |
| `admin@innomcp.local` / `admin1234` | Test login fixture | signoff.spec.ts |
| `userId: 999` | Synthetic JWT payload | signoff.spec.ts |
| `admin` / `admin123` | Test admin | config/test_settings.json |

## 🟢 Production-Intended (Working Correctly)

These settings are verified working and intended for production use.

| Capability | Config | Status |
|------------|--------|--------|
| AI Mode Switching | `local` / `remote` / `hybrid` via API | ✅ Working |
| Local Ollama | `127.0.0.1:11434` | ✅ Connected |
| Remote Ollama | `ollama.mdes-innova.online` / `gemma3:12b` | ✅ Connected |
| MCP Server | `localhost:3012/mcp` | ✅ Connected |
| Weather Pipeline | TMD + NWP + fallback chain | ✅ Working |
| Thai Geo/Knowledge | MCP tools via ThaiGeoTool, ThaiKnowledgeTool | ✅ Working |
| Session Memory | In-memory per session | ✅ Working |
| Cold RAG | 4 docs / 15 chunks loaded | ✅ Working |
| Rate Limiting | Guest limiter active | ✅ Working |
| WebSocket Streaming | ws://localhost:3011 | ✅ Working |
| CORS | ALLOWED_ORIGIN configured | ✅ Working |

## 🟡 Mode Flags (Must Be Off in Production)

| Flag | Test Value | Production Value | Why |
|------|-----------|-----------------|-----|
| `SMOKE_MODE` | `0` or `1` | `0` | Mock mode — must be off |
| `WEATHER_FIXTURE_W1` | `1` | `0` | Forces fixture weather data |
| `CHAT_TRACE_QA` | `1` | `0` | Debug trace output |
| `NODE_ENV` | `development` | `production` | Standard |
| `INNOMCP_MODE` | `online` / `offline` | `online` | Offline disables real APIs |

## 🔵 External API Keys (Not Yet Configured)

These are in `env.template` but need real keys for production:

| Key | Current Status | Required For |
|-----|---------------|-------------|
| `TMD_UID_API` / `TMD_UKEY_API` | Demo values | Real TMD weather data |
| `NWP_API_KEY` | Blank | NWP forecast model |
| `OPENWEATHER_API_KEY` | Blank | Fallback weather source |
| `NASA_API_KEY` | Blank | Satellite imagery (optional) |
| `GOOGLE_SEARCH_API_KEY` | Blank | Web search tool (optional) |

---

## Verification Summary

All tests ran with `SMOKE_MODE=0` (production code path), confirming the actual production logic works. The only differences between test and production:

1. **Secrets** need rotation (🔴 section above)
2. **Debug flags** need to be off (🟡 section above)
3. **Service URLs** need to point to production hosts instead of localhost
4. **Evidence API** (port 3013) needs to be running for S3 tests to show real data

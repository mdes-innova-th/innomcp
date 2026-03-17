# ENV Setup & Operating Mode Guide

เอกสารนี้อธิบายกติกาการตั้งค่า environment variables ของ innomcp
ทุก service ต้องปฏิบัติตามกติกาเดียวกัน

---

## 1. Operating Mode (กติกาหลัก)

ตัวแปร: **`INNOMCP_MODE`**

| ค่า | ความหมาย | ต้องมี key จริงไหม |
|---|---|---|
| `offline` | fixture/smoke mode — ห้ามยิง external API | ไม่จำเป็น |
| `online` | integration mode — ยิง API จริง | ต้องมีครบ |

ตั้งใน `.env` ของ **ทุก service ที่เกี่ยวข้อง** ให้ตรงกัน:
- `innomcp-server-node/.env`
- `innomcp-node/.env`

```bash
# offline (default สำหรับ dev / CI ที่ไม่มี key)
INNOMCP_MODE=offline

# online (สำหรับ integration test ที่มี key จริง)
INNOMCP_MODE=online
```

---

## 2. กติกา offline mode

- **ห้ามยิง HTTP ไป external** (TMD, NWP, OpenWeather ฯลฯ)
- ใช้ `WEATHER_FIXTURE_W1=1` หรือ `SMOKE_MODE=1` แทน
- test ต้องผ่านได้ **โดยไม่ต้องมี key จริงแม้แต่ตัวเดียว**
- เร็วและ deterministic — ไม่ขึ้นกับ network

```bash
INNOMCP_MODE=offline
SMOKE_MODE=1
WEATHER_FIXTURE_W1=1
```

---

## 3. กติกา online mode

- **ต้องมี** `TMD_UID_API` + `TMD_UKEY_API` และ `NWP_API_KEY`
- ตัวแปร `TMD_UID_API_DEMO` / `TMD_UKEY_API_DEMO` ใช้โดย v1 public endpoints (demo tier)
- ชื่อ env เก่า `TMD_UID` / `TMD_UKEY` ถูก deprecated ระบบใช้เป็น fallback เท่านั้น
- ถ้าขาดตัวใดตัวหนึ่ง server จะ log `[READINESS] ERROR` ตอน boot
- endpoint `GET /api/health/keys` จะแสดง `mode_ready: false` + รายการที่ขาด

```bash
INNOMCP_MODE=online

# API tier (v2 real-time weather + observation)
TMD_UID_API=<uid-จาก-data.tmd.go.th>
TMD_UKEY_API=<ukey-จาก-data.tmd.go.th>

# Demo tier (v1 public datasets: seismic, climate, station, rainfall)
TMD_UID_DEMO=demo
TMD_UKEY_DEMO=demo

# NWP JWT Bearer token (ต้องมี scopes — ดูหัวข้อ 4)
NWP_API_KEY=<your-jwt-token>
```

---

## 4. TMD Key Tier System

`tmdTools.ts` แบ่ง 17 endpoint ออกเป็น 2 tier ตามประเภท credential ที่ต้องการ:

### api tier — ต้องใช้ `TMD_UID_API` / `TMD_UKEY_API`

endpoint เหล่านี้เรียก v2 API ที่ต้องการ registered credentials จริง:

| Tool | Endpoint |
|---|---|
| `tmd_weather_today_07am_all_stations` | WeatherToday/V2 |
| `tmd_weather_3hours_all_stations` | Weather3Hours/V2 |
| `tmd_weather_forecast_7days_by_province` | WeatherForecast7Days/v2 |
| `tmd_daily_forecast_4_times` | DailyForecast/v2 |
| `tmd_weather_warning_news` | WeatherWarningNews/v2 |
| `tmd_weather_forecast_7days_by_region` | WeatherForecast7DaysByRegion/v2 |
| `tmd_weather_3hours_by_hydro` | Weather3HoursByHydro/V1 |
| `tmd_weather_3hours_by_agro` | Weather3HoursByAgro/V1 |
| `tmd_weather_3hours_by_synop` | Weather3HoursBySynop/V1 |
| `tmd_weather_today_by_hydro` | WeatherTodayByHydro/V1 |
| `tmd_weather_today_by_agro` | WeatherTodayByAgro/V1 |
| `tmd_weather_today_by_synop` | weathertodayBySynop/V1 |

### demo tier — ใช้ `TMD_UID_DEMO` / `TMD_UKEY_DEMO` (default: `demo`/`demo`)

endpoint เหล่านี้เป็น v1 public datasets ที่ใช้ demo credentials ได้:

| Tool | Endpoint |
|---|---|
| `tmd_seismic_daily_events` | DailySeismicEvent/v1 |
| `tmd_thailand_climate_normal_1981_2010` | ThailandClimateNormal/v1 |
| `tmd_thailand_monthly_rainfall` | ThailandMonthlyRainfall/v1 |
| `tmd_rain_regions` | RainRegions/v1 |
| `tmd_station_list` | Station/v1 |

### Fallback chain

```
TMD_UID_API  → TMD_UID  (deprecated)
TMD_UKEY_API → TMD_UKEY (deprecated)

TMD_UID_DEMO  → TMD_UID  (deprecated)
TMD_UKEY_DEMO → TMD_UKEY (deprecated)
```

---

## 5. NWP API Key & Required Scopes

NWP (Numerical Weather Prediction) ใช้ JWT Bearer token จาก **TMD NWP Portal**
สมัครได้ที่ https://data.tmd.go.th/nwpapi/

### ⚠️ CRITICAL: JWT ต้องมี scopes ครบ

JWT ที่มี `"scopes": []` (ว่าง) จะได้ `401 Unauthorized` ทุก NWP endpoint
ต้องขอ token ที่มี scopes ต่อไปนี้ **ครบทุก scope**:

| Scope | ใช้โดย endpoint |
|---|---|
| `nwp.api.forecast_location` | nwp_daily_by_place (รายวัน per จุด) |
| `nwp.api.location.forecast_hourly` | nwp_hourly_by_place (รายชั่วโมง per จุด) |
| `nwp.api.location.forecast_daily` | nwp_daily_by_place (รายวัน) |
| `nwp.api.forecast_area` | nwp_daily_area, nwp_hourly_area (พื้นที่ bbox) |

### วิธีตรวจสอบ scopes ของ JWT ที่มีอยู่

```bash
# decode payload (base64) — ดูที่ scopes field
echo "<jwt_token>" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool | grep -A5 scopes
```

ถ้าเห็น `"scopes": []` → token นั้น **ใช้ NWP ไม่ได้** ต้องขอใหม่

### วิธีขอ NWP token ใหม่ที่มี scopes

1. เข้า https://data.tmd.go.th/nwpapi/
2. เข้าสู่ระบบด้วย account ที่ลงทะเบียนแล้ว
3. ขอ token พร้อมระบุ scopes: `nwp.api.forecast_location`, `nwp.api.location.forecast_hourly`, `nwp.api.location.forecast_daily`, `nwp.api.forecast_area`
4. บันทึก JWT ที่ได้ลงใน `NWP_API_KEY=<token>` ใน `.env`

---

## 6. รายการ env vars ทั้งหมด (innomcp-server-node)

| ตัวแปร | Required online | ใช้โดย | หมายเหตุ |
|---|---|---|---|
| `INNOMCP_MODE` | - | server.ts | `offline` หรือ `online` |
| `SMOKE_MODE` | - | tmdTools, nwpTools | `0` หรือ `1` |
| `WEATHER_FIXTURE_W1` | - | nwpTools, tmdTools | `0` หรือ `1` |
| `CHAT_TRACE_QA` | - | nwpTools, tmdTools | `0` หรือ `1` |
| `SERVER_HOST` | - | server.ts | default `0.0.0.0` |
| `SERVER_PORT` | - | server.ts | default `3012` |
| `LOG_MODE` | - | mcpLogger.ts | `dev` หรือ `prod` |
| `NODE_ENV` | - | logger.ts | `development` / `production` |
| `ALLOWED_ORIGIN` | - | app.ts | comma-separated origins |
| `TMD_UID_API` | **YES** | tmdTools.ts | uid จาก data.tmd.go.th (api tier) |
| `TMD_UKEY_API` | **YES** | tmdTools.ts | ukey จาก data.tmd.go.th (api tier) |
| `TMD_UID_DEMO` | - | tmdTools.ts | uid demo tier (default: `demo`) |
| `TMD_UKEY_DEMO` | - | tmdTools.ts | ukey demo tier (default: `demo`) |
| `TMD_UID` | - | tmdTools.ts | **deprecated** — fallback เท่านั้น |
| `TMD_UKEY` | - | tmdTools.ts | **deprecated** — fallback เท่านั้น |
| `WX_TMD_DELAY_MS` | - | tmdTools.ts | smoke test helper |
| `WX_TMD_STATION_DELAY_MS` | - | tmdTools.ts | smoke test helper |
| `WX_TMD_TIMEOUT_MS` | - | tmdTools.ts | smoke test helper |
| `NWP_API_KEY` | **YES** | nwpDailyTool, nwpHourlyTool | Bearer JWT (ต้องมี scopes — หัวข้อ 5) |
| `WEBDDSB_HOST` | - | webdTools.ts | default `localhost` |
| `WEBDDSB_PORT` | - | webdTools.ts | default `3011` |
| `WEBDDSB_APIKEY` | - | webdTools.ts | API key ของ WEBDDSB |
| `OPENWEATHER_API_KEY` | - | weatherTool.ts | OpenWeatherMap key |
| `NASA_API_KEY` | - | nasaTool.ts | default `DEMO_KEY` |
| `DB_HOST` | - | db.ts | MariaDB host |
| `DB_PORT` | - | db.ts | default `3308` |
| `DB_USER` | - | db.ts | |
| `DB_PASSWORD` | - | db.ts | |
| `DB_NAME` | - | db.ts | |
| `DETECT_DB_HOST` | - | dbDetect.ts, evidenceTool | |
| `DETECT_DB_PORT` | - | dbDetect.ts | |
| `DETECT_DB_USER` | - | dbDetect.ts | |
| `DETECT_DB_PASSWORD` | - | dbDetect.ts | |
| `DETECT_DB_NAME` | - | dbDetect.ts | |
| `USE_INTELLIGENCE_PIPELINE` | - | server.ts | `true` / `false` |
| `ENABLE_FILE_LOG` | - | logger.ts | `true` / `false` |

---

## 7. Boot Readiness Log

เมื่อ `innomcp-server-node` start จะแสดง readiness report อัตโนมัติ:

```
[READINESS] INNOMCP_MODE=online
[READINESS]   READY   TMD_API (TMD_UID_API / TMD_UKEY_API)  (tmdTools.ts — 12 api-tier tools)
[READINESS]   READY   TMD_DEMO (TMD_UID_DEMO / TMD_UKEY_DEMO)  (tmdTools.ts — 5 demo-tier tools)
[READINESS]   READY   NWP (NWP_API_KEY)  (nwpDailyTool + nwpHourlyTool — 6 tools)
[READINESS]   missing WEBDDSB (WEBDDSB_HOST / WEBDDSB_APIKEY)  (webdTools.ts — 3 tools)
...
[READINESS] MODE=online — keys ครบ พร้อมใช้งาน
```

และ endpoint:
```
GET http://localhost:3012/api/health/keys
```

---

## 8. ตัวอย่าง: ทดสอบ offline (ไม่ต้องมี key)

```bash
cd innomcp-server-node
cp .env.example .env
# ค่า default คือ INNOMCP_MODE=offline ไม่ต้องกรอก key ใดๆ
npm run dev

# รัน verifier
cd innomcp-node
WEATHER_FIXTURE_W1=1 SMOKE_MODE=1 npx ts-node scripts/verify_phase101a_weather_contract.ts
```

ผลลัพธ์ที่คาดหวัง: ผ่านทุก test โดยไม่มี network request ออกไปภายนอก

---

## 9. ตัวอย่าง: ทดสอบ online (ต้องมี key จริง)

```bash
cd innomcp-server-node
cp .env.example .env
# กรอก key จริง:
# TMD_UID_API=<uid>
# TMD_UKEY_API=<ukey>
# NWP_API_KEY=<jwt-with-scopes>
# แล้วเปลี่ยน:
# INNOMCP_MODE=online

npm run dev
# ดู boot log: [READINESS] MODE=online — keys ครบ พร้อมใช้งาน

# ตรวจ readiness endpoint
curl http://localhost:3012/api/health/keys
# คาด: mode_ready: true, tools.tmd_api.status: "ready", tools.nwp.status: "ready"

# ทดสอบ TMD tool (forecast)
curl -X POST http://localhost:3012/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"tmd_weather_forecast_7days_by_province","arguments":{}},"id":1}'
```

---

## 10. TMD Auth Fail Policy

TMD API อาจคืน HTTP 200 พร้อม body ว่า `Authentication fail`
`tmdTools.ts` จัดการแล้ว: ถ้า body มี `Authentication fail` จะ throw error เสมอ
**ห้าม cache response ที่มี auth fail** — ให้ fail-fast และรายงาน error กลับ tool caller

### Error taxonomy

| Error code | ความหมาย | วิธีแก้ |
|---|---|---|
| `TMD_API_AUTH_FAIL` | UID/UKEY ไม่ถูกต้อง | ตรวจ TMD_UID_API/TMD_UKEY_API ใน .env |
| `TMD_API_PARAMS_MISSING` | ไม่มี UID/UKEY ใน .env เลย | เพิ่ม TMD_UID_API / TMD_UKEY_API |
| `NWP_401` | NWP JWT ไม่มี scopes | ขอ token ใหม่ที่มี scopes ครบ (หัวข้อ 5) |
| `INNOMCP_OFFLINE` | INNOMCP_MODE=offline | เปลี่ยนเป็น INNOMCP_MODE=online |

---

## 11. MariaDB Connection (innomcp-node)

MariaDB ทำงานใน Docker container และ port mapping แตกต่างกันตาม context:

| Context | DB_HOST | DB_PORT | หมายเหตุ |
|---|---|---|---|
| Host (npm run dev) | `127.0.0.1` | `3308` | Docker maps container:3306 → host:3308 |
| Docker container | `mariadb` | `3306` | ใช้ชื่อ service ใน Docker network |

**ปัญหา `Access denied for 'jlapps'@'172.19.0.1'`:**
- `MARIADB_PASSWORD` ใน docker-compose ต้องตรงกับ `DB_PASSWORD` ใน `.env.local`
- ตรวจสอบ: `docker inspect mariadb-innomcp | grep MARIADB_PASSWORD`
- แก้: อัปเดต `DB_PASSWORD=<actual>` ใน innomcp-node/.env.local ให้ตรงกัน

## 12. Health Check Proxy (innomcp-next)

Next.js `/api/health` route proxies ไปยัง innomcp-node `/api/health/keys`:

```
innomcp-next:3000/api/health → innomcp-node:3011/api/health/keys
```

ตัวแปรที่ใช้ (เลือก env var แรกที่ set):
- `NEXT_PUBLIC_BACKEND_URL` (Phase 10.11+)
- `NEXT_PUBLIC_NODE_HOST` (fallback — set ใน .env.local)
- default: `http://localhost:3011`

**Phase 10.12 fix**: `/api/health` ถูก exempt จาก `apiKeyMiddleware` แล้ว (ไม่ต้อง auth ใด ๆ)

---

*อัปเดตล่าสุด: 2026-03-18 (Phase 10.12)*

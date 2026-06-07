# TMD + NWP Endpoint Verification Report (สำหรับ Claude Opus)

**ทดสอบโดย:** SA (System Architect)
**วันที่:** 2026-04-27
**HEAD:** `e4cfaaa` + fixes (tmdTools + nwpDailyTool + nwpHourlyTool)

---

## 🎯 สรุปผลรวม

| กลุ่ม | จำนวน | ผ่าน | หมายเหตุ |
|-------|-------|------|---------|
| NWP (6 tools) | 6 | **6/6 ✅** | ทุก endpoint HTTP 200 |
| TMD demo tier (5 tools) | 5 | **5/5 ✅** | ตอบเร็ว < 4s |
| TMD api tier (12 tools) | 12 | **12/12 ✅** | 7 เร็ว / 5 ช้า (20–52s) |
| **รวม** | **23** | **23/23 ✅** | ทุก endpoint ใช้งานได้ |

> ⚠️ **สำคัญ:** TMD-15, TMD-16, TMD-17 ใช้เวลา 40–52 วินาที — ต้องใช้ 60s timeout

---

## 🔧 สิ่งที่ SA แก้ไข (ก่อนทดสอบ)

### Bug 1+2: NWP Region Tools — endpoint ผิดและไม่ส่ง params

ทั้ง `nwpHourlyByRegionTool` และ `nwpDailyByRegionTool` ใช้ endpoint ผิด:

```
เดิม (ผิด): /nwpapi/v1/forecast/area/region?domain=2&starttime=YYYY-MM-DDTHH:00:00
ใหม่ (ถูก): /nwpapi/v1/forecast/location/{hourly|daily}/region?region=X&date=YYYY-MM-DD&duration=N
```

พร้อมกันนั้น `input.date`, `input.hour`, `input.duration` ก็ถูก **IGNORED** ในโค้ดเดิม (hardcode เวลาปัจจุบัน) ตอนนี้ส่งค่าจาก input แล้ว

### Bug 3: tmdTools.ts — false positive `isDemoLike = uid === "api"`

TMD staff ยืนยันว่า `uid=api / ukey=api12345` เป็น credential จริง ไม่ใช่ demo:
```typescript
// เดิม: uid === "api" ถูก flag เป็น demo → warn log ที่ไม่ถูกต้อง
const isDemoLike = uid === "demo" || ukey === "demo" || uid === "api" || ukey.includes("api12345");
// ใหม่:
const isDemoLike = uid === "demo" || ukey === "demo" || ukey === "demokey";
```

### Bug 4 (bonus): Weather3Hours V2 ใช้ HTTP, HTTPS เร็วกว่า

```typescript
// เดิม: weather3Hours: "http://data.tmd.go.th/api/Weather3Hours/V2/"
// ใหม่: weather3Hours: "https://data.tmd.go.th/api/Weather3Hours/V2/"
```

### Bug 5: DEFAULT_TIMEOUT_MS ต้องการ 60s

```typescript
// เดิม: DEFAULT_TIMEOUT_MS = 30000  (TMD-15,16,17 ใช้ 40–52s → timeout!)
// ใหม่: DEFAULT_TIMEOUT_MS = 60000
```

---

## 📋 ผลทดสอบ NWP (6/6 ✅)

| # | Tool | URL | Status | Latency | ข้อมูลตัวอย่าง |
|---|------|-----|--------|---------|--------------|
| NWP-01 | `nwp_daily_by_location` | `/daily/at?lat=13.75&lon=100.5` | ✅ 200 | 332ms | `tc_max:36.69, tc_min:28.43, cond:1 (Clear)` |
| NWP-02 | `nwp_daily_by_place` | `/daily/place?province=เชียงใหม่` | ✅ 200 | 250ms | `tc_max:37.18, cond:1` |
| NWP-03 | `nwp_daily_by_region` **[FIXED]** | `/daily/region?region=C&date=2026-04-27` | ✅ 200 | 1000ms | `กรุงเทพมหานคร, นนทบุรี, ...` |
| NWP-04 | `nwp_hourly_by_location` | `/hourly/at?lat=7.88&lon=98.40` | ✅ 200 | 192ms | `tc:29.5, rh:79, cond:2` |
| NWP-05 | `nwp_hourly_by_place` | `/hourly/place?province=นครปฐม` | ✅ 200 | 204ms | `tc:33.9, rh:62, cond:1` |
| NWP-06 | `nwp_hourly_by_region` **[FIXED]** | `/hourly/region?region=N&date=2026-04-27` | ✅ 200 | 327ms | `แม่ฮ่องสอน, เชียงใหม่, เชียงราย, ...` |

---

## 📋 ผลทดสอบ TMD (17/17 ✅)

### Demo Tier

| # | Tool | Endpoint | Status | Latency |
|---|------|---------|--------|---------|
| TMD-01 | `tmd_seismic_daily_events` | DailySeismicEvent/v1 | ✅ 200 | 2051ms |
| TMD-02 | `tmd_thailand_climate_normal_1981_2010` | ThailandClimateNormal/v1 | ✅ 200 | 176ms |
| TMD-03 | `tmd_thailand_monthly_rainfall` | ThailandMonthlyRainfall/v1 | ✅ 200 | 294ms |
| TMD-04 | `tmd_rain_regions` | RainRegions/v1 | ✅ 200 | 3748ms |
| TMD-05 | `tmd_station_list` | Station/v1 | ✅ 200 | 69ms |

### API Tier

| # | Tool | Endpoint | Status | Latency |
|---|------|---------|--------|---------|
| TMD-06 | `tmd_weather_today_07am_all_stations` | WeatherToday/V2 | ✅ 200 | **31.4s** ⚠️ |
| TMD-07 | `tmd_weather_3hours_all_stations` | Weather3Hours/V2 **(https)** | ✅ 200 | **27.5s** ⚠️ |
| TMD-08 | `tmd_weather_forecast_7days_by_province` | WeatherForecast7Days/v2 | ✅ 200 | 433ms |
| TMD-09 | `tmd_daily_forecast_4_times` | DailyForecast/v2 | ✅ 200 | 1506ms |
| TMD-10 | `tmd_weather_warning_news` | WeatherWarningNews/v2 | ✅ 200 | 434ms |
| TMD-11 | `tmd_weather_forecast_7days_by_region` | WeatherForecast7DaysByRegion/v2 | ✅ 200 | 904ms |
| TMD-12 | `tmd_weather_3hours_by_hydro` | Weather3HoursByHydro/V1 | ✅ 200 | 16.4s |
| TMD-13 | `tmd_weather_3hours_by_agro` | Weather3HoursByAgro/V1 | ✅ 200 | 11.8s |
| TMD-14 | `tmd_weather_3hours_by_synop` | Weather3HoursBySynop/V1 | ✅ 200 | 19.6s |
| TMD-15 | `tmd_weather_today_by_hydro_07am` | WeatherTodayByHydro/V1 | ✅ 200 | **41.9s** ⚠️ |
| TMD-16 | `tmd_weather_today_by_agro_07am` | WeatherTodayByAgro/V1 | ✅ 200 | **52.5s** ⚠️ |
| TMD-17 | `tmd_weather_today_by_synop_07am` | WeatherTodayBySynop/V1 | ✅ 200 | **51.4s** ⚠️ |

> ⚠️ **TMD-06, 07, 15, 16, 17:** Server ช้า 27–52s — เป็น behavior ของ TMD server (query สถานีหลายร้อยสถานี) ไม่ใช่ bug ในโค้ด `DEFAULT_TIMEOUT_MS = 60000` ตั้งค่าแล้ว

---

## 📁 ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|--------------|
| `innomcp-server-node/src/mcp/tools/nwpHourlyTool.ts` | Fix `nwpHourlyByRegionTool` endpoint + pass date/hour/duration params |
| `innomcp-server-node/src/mcp/tools/nwpDailyTool.ts` | Fix `nwpDailyByRegionTool` endpoint + pass date/duration params |
| `innomcp-server-node/src/mcp/tools/tmdTools.ts` | Fix `isDemoLike` false-positive; http→https for Weather3Hours; 30s→60s timeout |
| `innomcp-server-node/scripts/verify_tmd_nwp_endpoints.ts` | NEW: comprehensive test script (23 endpoints) |
| `innomcp-server-node/scripts/verify_slow_endpoints.ts` | NEW: targeted retest for slow TMD endpoints |
| `innomcp-server-node/logs/verify_tmd_nwp_results.json` | NEW: JSON test results (auto-generated) |

**TypeScript compile:** 0 errors ✅

---

## 🔑 Credentials ที่ใช้อยู่ (ยืนยันใช้งานได้)

| Env Var | ค่า | Tier | สถานะ |
|---------|-----|------|-------|
| `NWP_API_KEY` | `eyJ0eXAiOiJK...` (1075 chars) | JWT | ✅ Valid (exp: 2027-03-23) |
| `TMD_UID_API` | `api` | API tier | ✅ Valid (ยืนยันจากเจ้าหน้าที่ TMD) |
| `TMD_UKEY_API` | `api12345` | API tier | ✅ Valid |
| `TMD_UID_DEMO` | `demo` | Demo tier | ✅ Valid (endpoints สาธารณะ) |
| `TMD_UKEY_DEMO` | `demokey` | Demo tier | ✅ Valid |

> 💡 **หมายเหตุ JWT scopes=[]:** ถึงแม้ payload แสดง `"scopes":[]` แต่ API คืน 200 ปกติ — scopes เป็น optional claim ที่ TMD ไม่บังคับ

---

## 🚀 สิ่งที่ Opus ควรรู้เพิ่มเติม

### TMD Slow Endpoints — ควร cache ผล
เนื่องจาก TMD-15/16/17 ใช้เวลา 40–52s ต่อ call ถ้า Opus ต้องการปรับปรุงเพิ่มเติม แนะนำ:
1. เพิ่ม in-memory cache (TTL 5 นาที) สำหรับ endpoints เหล่านี้
2. หรือ run as background fetch + serve cached response

### NWP Region — ข้อมูลที่ได้
- `daily/region` → array of provinces ในภูมิภาค (ภาคกลาง = ~15 จังหวัด)
- `hourly/region` → array of provinces พร้อม forecasts รายชั่วโมง
- Response key: `WeatherForecasts[].location.province` (ภาษาไทย)

### TMD Demo vs API Tier
- **Demo tier:** DailySeismic, ClimateNormal, MonthlyRainfall, RainRegions, Station → ใช้ `demo/demokey`
- **API tier:** ทุก endpoint ที่เหลือ (real-time + forecast) → ใช้ `api/api12345`
- โค้ดใน `tmdTools.ts` แยก tier ชัดเจน + fallback chain ทำงานถูกต้อง

---

*ทดสอบทั้งหมด 23 endpoints — ผ่าน 23/23 (100%)*
*SA: SA-Agent | 2026-04-27*

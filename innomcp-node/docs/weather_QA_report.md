# Weather Architecture QA Report (Phase 6.5)

## 1. Patch Plan

**Status**: minimal-change (Verification Only).
Codebase is already stabilized with required fixes.

| Component                              | Status    | Verification                                                       |
| :------------------------------------- | :-------- | :----------------------------------------------------------------- |
| `src/utils/locationResolver.ts`        | ✅ Stable | Logic confirmed (Substring scan + Sort + Fuzzy)                    |
| `src/utils/weather/weatherPipeline.ts` | ✅ Stable | Logic confirmed (Mode detection + Fallback chains + No Call Guard) |
| `src/utils/weather/toolCall.ts`        | ✅ Stable | Parsing logic checks out                                           |
| `tests/weather_regression.test.ts`     | ✅ Added  | Covers 4 regression groups + No Call Proof                         |

## 2. Test Plan (Unit / Regression)

Run the automated regression suite:

```bash
npx jest tests/weather_regression.test.ts
```

**Coverage**:

- **Thai Unsegmented**: "พรุ่งนี้หลักสี่ฝนจะตกไหม" -> `["กรุงเทพมหานคร"]`
- **Multi-Province**: "สมุทรสาคร, ศรีสะเกษ" -> 2 Unique
- **Alias**: "สุราษฯ", "กทม", "เชียงแสน" -> Mapped correctly
- **Fake Province**: "เมืองทิพย์" -> `PROVINCE_MISSING` error & **NO MCP CALL** (Spy verified)

## 3. Smoke Test Checklist (Manual / UI)

**Environment**: Dev (Frontend + Backend + Real MCP)

| ID    | Input Text                       | Expected Outcome                                   | Logic/Engine                 |
| :---- | :------------------------------- | :------------------------------------------------- | :--------------------------- |
| **A** | "พรุ่งนี้หลักสี่ฝนจะตกไหม"       | Result for **Bangkok** (Forecast)                  | Resolver: Substring scan     |
| **B** | "สมุทรสาคร, ศรีสะเกษ"            | **2 Results** (Sakhon + Sisaket), No Dupes         | Pipeline: Loop               |
| **C** | "สุราษฯ", "กทม", "เชียงแสน"      | **Surat, BKK, Chiang Rai** results                 | Resolver: Alias/District Map |
| **D** | "เมืองทิพย์"                     | **Error**: "ไม่พบชื่อจังหวัด..." (No Spinner/Call) | Pipeline: Guard              |
| **E** | "กรุงเทพฯ พยากรณ์ 7 วัน"         | **Forecast** (7 Days)                              | Pipeline: Mode=Future        |
| **F** | "ตอนนี้อากาศ สมุทรปราการ"        | **Station** (Current Obs)                          | Pipeline: Mode=Now           |
| **G** | "พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง บอกในรูปแบบตาราง % ฝน อุณหภูมิ ความชื้น ลม" | **Nationwide Table** (top 15, sorted by %Rain desc) | Intent: mode=nationwide |
| **H** | "จังหวัดไหนฝนตกวันนี้" | **Nationwide Table** (today's date) | Intent: mode=nationwide |
| **I** | "อากาศทั่วประเทศ" | **Nationwide Table** (default tomorrow) | Intent: mode=nationwide |

## 4. Acceptance Logs

Verify these logs appear in server output/console during Smoke Test:

- `[LocationResolver] resolvedProvinces=[...] method=substring|token|fuzzy`
- `[WeatherPipeline] mode=now|today|future chain=Station>Forecast>NWP ...`
- `[ForecastEngine] provinceCount=...` (Should be ~77 or specific count)
- `[StationEngine] stationCount=... filteredCount=... province=...`
- `[WeatherPipeline] mode=nationwide chain=Forecast`
- `[WeatherPipeline] nationwide date=DD/MM/YYYY rainyProvinces=N topN=N`

## 5. MCP "No Call" Proof

- **Mechanism**: `WeatherPipeline.execute` returns `[{ error: "PROVINCE_MISSING" }]` immediately if `provinces.length === 0` and mode is NOT "nationwide".
- **Nationwide bypass**: If mode=nationwide (provinces=[] + nationwide keywords), pipeline calls `executeNationwide()` instead of blocking. Only ONE forecast MCP call is made.
- **Verification**: `scripts/test-weather-phase65.ts` mock tests assert: nationwide → 1 MCP call, fake province → 0 MCP calls.

---

# Acceptance Report Template

**Date**: **\*\*\*\***\_\_\_\_**\*\*\*\***
**Commit ID**: **\*\***\_\_\_\_**\*\***
**Tester**: **\*\*\*\***\_\_\_**\*\*\*\***

## Checklist

- [ ] **Unit Tests Passed** (`npx jest tests/weather_regression.test.ts`)
- [ ] **Smoke Test A** (Thai Unsegmented) -> Pass/Fail
- [ ] **Smoke Test B** (Multi-Province) -> Pass/Fail
- [ ] **Smoke Test C** (Aliases) -> Pass/Fail
- [ ] **Smoke Test D** (Fake Province / No Call) -> Pass/Fail
- [ ] **Smoke Test E** (Future Mode) -> Pass/Fail
- [ ] **Smoke Test F** (Now Mode) -> Pass/Fail
- [ ] **Smoke Test G** (Nationwide Table) -> Pass/Fail
- [ ] **Smoke Test H** (Nationwide วันนี้) -> Pass/Fail

## Log Verification

- [ ] Resolver Logs visible?
- [ ] Pipeline Mode/Chain Logs visible?
- [ ] Engine Count Logs visible?
- [ ] Nationwide Logs visible? (`mode=nationwide chain=Forecast`, `rainyProvinces=N topN=N`)

## Screenshots / Notes

_(Paste screenshot of "เมืองทิพย์2" error or standard logs here)_

**Sign-off**: 🟢 READY / 🔴 FIX REQUIRED

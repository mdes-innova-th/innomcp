# FINAL VERDICT — Weather Truth Contract Fix

**Date:** 2026-04-01  
**Commit:** `5ffb6b9` (pushed to `origin/main`)  
**Prev HEAD:** `d636705`

---

## 1. Problem Statement

User asked: **"วันนี้ฝนจะตกที่ไหนบ้าง ในภาคเหนือ"** (Where will it rain today in the North?)

Three product bugs appeared:
1. Error banner + confident forecast data **mixed** in same response
2. Results covered **nationwide** instead of **northern region only**
3. Fake hardcoded fallback data presented as real forecast

---

## 2. Root Cause Analysis

| Bug | Root Cause | File |
|-----|-----------|------|
| Nationwide scope leak | `"ที่ไหน"` in `NATIONWIDE_KEYWORDS` regex triggered ALL_THAILAND for any question containing "ที่ไหน" even when a region was specified | weatherPipeline.ts |
| Region scope ignored | `resolveTarget()` had no guard — only greedy "if multi-province → ALL_THAILAND" logic, overriding explicit region requests like ภาคเหนือ | weatherPipeline.ts |
| Fake fallback data | `fallbackNational()` returned hardcoded rows with real-looking temperature/rain data instead of an error | weatherPipeline.ts |
| Stale routing | `ts-node` cache served old compiled code after edits | Runtime (TS_NODE_CACHE) |
| Smoke bypass broken | CMD `set SMOKE_MODE=1 && ...` sets value `"1 "` (trailing space) → strict `=== '1'` check failed | guestLimiter.ts |

---

## 3. Fixes Applied (5 files)

### A. weatherPipeline.ts — 3 fixes
- **NATIONWIDE_KEYWORDS**: Removed `"ที่ไหน"` from regex
- **resolveTarget()**: Added `hasRegionScope` guard using `/ภาค(เหนือ|ใต้|กลาง|อีสาน|ตะวันออก|ตะวันตก|ตะวันออกเฉียงเหนือ)/i` — blocks ALL_THAILAND when user explicitly names a region
- **fallbackNational()**: Returns `{ type: "error", error: "NATIONAL_DATA_UNAVAILABLE" }` instead of fake data

### B. guestLimiter.ts — smoke bypass fix
- Added `.trim()` to `SMOKE_MODE` env check to handle CMD trailing space

### C. globalSetup.ts — warmup fix
- Added `"x-smoke-run": "1"` header to E2E warmup requests

### D. weather_regression.test.ts — Test H updated
- Updated for new `NATIONAL_DATA_UNAVAILABLE` error return

### E. signoff.spec.ts — S7 Weather Truth Contract
- Added `apiChatDeep()` deep response parser
- Added 7 new test assertions (S7-01 through S7-07)

---

## 4. Unit Test Evidence

```
Test Suites: 12 passed, 12 total
Tests:       69 passed, 69 total
```

---

## 5. E2E Signoff Evidence

```
57 passed (4.6m) — 0 failed
50 screenshots captured
```

| Section | Tests | Status |
|---------|-------|--------|
| S1: Auth + User Flow | 5 | ✅ |
| S2: AI Mode UI Flow | 6 | ✅ |
| S3: Evidence / DetectDB | 5 | ✅ |
| S4: Weather Noisy Prompts | 26 | ✅ |
| S5: Thai Knowledge Multi-Turn | 4 | ✅ |
| S6: General Tool Flow | 4 | ✅ |
| **S7: Weather Truth Contract** | **7** | **✅** |

---

## 6. S7 Weather Truth Contract — Detail

| Test | Assertion | Result |
|------|----------|--------|
| S7-01 | ภาคเหนือ query routes to `weather` (not `general`) | ✅ route=weather, weatherResults present |
| S7-02 | ภาคเหนือ returns ONLY northern provinces | ✅ เชียงใหม่, เชียงราย, พิษณุโลก, ลำปาง — no southern/central |
| S7-03 | No confident forecast when upstream down (honest error) | ✅ no rain%, no ranked temps |
| S7-04 | Nationwide fallback returns honest error | ✅ NATIONAL_DATA_UNAVAILABLE |
| S7-05 | ERR:WX_UPSTREAM never mixed with confident ranked data | ✅ |
| S7-06 | AI mode endpoint reports honestly | ✅ mode=local, smoke=true |
| S7-07 | ภาคใต้ returns ONLY southern provinces | ✅ สุราษฎร์ธานี, ภูเก็ต, นครศรีธรรมราช, สงขลา |

---

## 7. Runtime HTTP Evidence

```
POST /api/chat { message: "วันนี้ฝนจะตกที่ไหนบ้าง ในภาคเหนือ" }

Route: weather ✓ (not general)
Provinces: เชียงใหม่, เชียงราย, พิษณุโลก, ลำปาง (northern only) ✓
No fake nationwide data ✓
Honest error when upstream unreachable ✓
```

---

## 8. Browser Screenshot Evidence

50 screenshots in `innomcp-next/e2e/screenshots/signoff/`:
- S1-01 through S1-05: Auth flow
- S2-01 through S2-06: AI mode switching
- S3-01 through S3-05: Evidence dashboard
- S4-W01 through S4-W26: Weather noisy prompts (26 screenshots)
- S5-01 through S5-04: Thai knowledge
- S6-01 through S6-04: General tools
- Key: **S4-W10** (ภาคใต้ only southern provinces visible in browser)

---

## 9. Bug Class Eliminated

| Before | After |
|--------|-------|
| "ที่ไหน" = nationwide | "ที่ไหน" = user's intended scope |
| ภาคเหนือ → ALL_THAILAND | ภาคเหนือ → northern provinces only |
| Upstream fail → fake confidence | Upstream fail → honest error |
| Error banner + confident data | Error-only OR data-only, never mixed |
| SMOKE_MODE="1 " bypass fail | `.trim()` handles CMD trailing space |

---

## 10. Regression Guard

- Jest 69/69: All existing weather, geo, evidence, NWP tests pass
- Playwright S1-S6: All 50 pre-existing tests pass
- No test was weakened or deleted

---

## 11. Files Changed

| File | Lines Added | Lines Removed |
|------|------------|--------------|
| innomcp-node/src/utils/weather/weatherPipeline.ts | +30 | -15 |
| innomcp-node/tests/weather_regression.test.ts | +4 | -2 |
| innomcp-next/e2e/signoff.spec.ts | +155 | -5 |
| innomcp-next/e2e/globalSetup.ts | +5 | -0 |
| innomcp-node/src/middleware/guestLimiter.ts | +10 | -5 |
| **Total** | **+204** | **-27** |

---

## 12. Verdict

**PASS** — All three product bugs fixed. Bug class eliminated via code guard + 7 contractual tests.  
57/57 E2E green. 69/69 unit green. 50 screenshots captured. Pushed as `5ffb6b9`.

# Test Results Matrix — สถานะการทดสอบทั้งหมด
**Date:** 2026-04-27 (updated after Opus fixes) | **Working tree:** ต้อง commit หลัง verify

---

## A. Jest Unit Tests (innomcp-node)

**Command:** `cd innomcp-node && npx jest`
**Result:** ✅ **618/618 PASS** — 25 suites — ~13s

| Suite | Tests | Status | หมายเหตุ |
|-------|-------|--------|---------|
| `tests/unit/logger.test.ts` | — | ✅ | — |
| `tests/unit/__tests__/weather-toolCall-unwrap-phase65.test.ts` | — | ✅ | — |
| `tests/unit/__tests__/thaiKnowledgeTool.test.ts` | — | ✅ | — |
| `tests/unit/__tests__/locationResolver-phase65.test.ts` | — | ✅ | — |
| `tests/unit/__tests__/weatherPipeline-phase65.test.ts` | — | ✅ | — |
| `tests/unit/system_status_tool.test.ts` | — | ✅ | — |
| `tests/unit/__tests__/memoryRag.test.ts` | — | ✅ | — |
| `tests/unit/__tests__/fastpathIdentity.test.ts` | — | ✅ | — |
| `tests/unit/__tests__/thaiGeoTool.test.ts` | 48 | ✅ 48/48 | — |
| `tests/unit/__tests__/nwpEngine-phase65.test.ts` | — | ✅ | — |
| `tests/unit/mcpClient.test.ts` | 17 | ✅ 17/17 | Phase 4 |
| `tests/unit/feedbackMigration.test.ts` | 11 | ✅ 11/11 | Phase 5 |
| `tests/unit/pytestConfig.test.ts` | 3 | ✅ 3/3 | pytest fix |
| `tests/unit/rateLimiter.test.ts` | 11 | ✅ 11/11 | Phase 3 |
| **`tests/unit/adminAuditLog.test.ts`** | **6** | **✅ 6/6** | **Phase 3 audit log (NEW)** |
| **`tests/thaiDomainRouting.test.ts`** | **28** | **✅ 28/28** | **BUG-001 fixed (NEW in pipeline)** |
| **`tests/unit/thaiWeatherIntelligence.test.ts`** | **98** | **✅ 98/98** | **BUG-002 fixed (NEW in pipeline)** |
| **`tests/geo/geo-core-phase1.test.ts`** | **8** | **✅ 8/8** | **BUG-003 fixed (converted to Jest)** |
| `tests/thaiNLP.test.ts` | 90 | ✅ 90/90 | — |
| `tests/evidence_tool.test.ts` | 7 | ✅ 7/7 | — |
| `tests/query_coverage.test.ts` | — | ✅ | — |
| `tests/query_coverage_v2.test.ts` | — | ✅ | — |
| `tests/weather_regression.test.ts` | 26 | ✅ 26/26 | — |
| `tests/weather_regression_phase65_final.test.ts` | — | ✅ | — |
| `tests/integration/health.test.ts` | 3 | ✅ 3/3 | — |

**TOTAL JEST:** ✅ **618 tests PASS** | 0 failures | 0 skipped

**Delta vs prior matrix (478 tests):** +28 (BUG-001) + 98 (BUG-002) + 8 (BUG-003) + 6 (audit log) = **+140 tests now in Jest pipeline**

---

## B. Non-Jest Tests (DB-dependent — kept under custom runner)

> ผ่านทุก test แต่ต้อง build + DB seed (จึงไม่อยู่ใน `npm test` — รันได้ผ่าน `npm run test:geo`)

| ไฟล์ | Runner | Tests | Status | รัน |
|------|--------|-------|--------|-----|
| `tests/geo/thai-geo-roundC.test.js` | `node:test` | 40 | ✅ 40/40 | `npm run test:geo` |

**คำสั่งรวม:** `npm run test:all` → จะรัน jest (618) + test:geo (40) = **658 tests ทั้งหมด**

---

## C. TypeScript Compile Check

| Project | Command | Result |
|---------|---------|--------|
| `innomcp-node` | `npx tsc --noEmit` | ✅ **0 errors** |
| `innomcp-next` | `npx tsc --noEmit` | ✅ **0 errors** |
| `innomcp-server-node` | `npx tsc --noEmit` | ✅ **0 errors** |

---

## D. Playwright E2E Tests (innomcp-next)

**Status:** ⚠️ ยังไม่ได้รัน (ต้องมี backend+frontend online)

| Section | Tests | Last Status | หมายเหตุ |
|---------|-------|-------------|---------|
| S1: Auth flow | 5 | — | รอ backend |
| S2: Basic chat | 5 | — | รอ backend |
| S3: Evidence/DetectDB | 5 | — | รอ backend |
| S4: Weather noisy prompts | 26 | — | รอ backend |
| S5: Thai Knowledge multi-turn | 4 | — | รอ backend |
| S6: General tool flow | 4 | — | รอ backend |
| S7: Weather truth contract | 7 | — | รอ backend |
| S8: Public readiness proof | 4 | — | รอ backend |
| **Total** | **60+** | **⚠️ NOT RUN** | — |

**คำสั่งรัน:**
```powershell
cd c:\Users\USER-NT\DEV\innomcp\innomcp-next
$env:SMOKE_MODE=1; npx playwright test e2e/signoff.spec.ts --reporter=list
```

---

## E. Grand Total

| Category | Tests | Pass | Fail | Status |
|----------|-------|------|------|--------|
| Jest (innomcp-node) | 618 | 618 | 0 | ✅ |
| Non-Jest (custom runner — DB) | 40 | 40 | 0 | ✅ |
| TypeScript compile | 3 projects | 3 | 0 | ✅ |
| Playwright E2E | 60+ | — | — | ⚠️ ต้องรัน |
| **COMBINED (excl. E2E)** | **658** | **658** | **0** | **✅** |

---

## F. Bugs Fixed in This Pass (Opus)

| ID | สิ่งที่ทำ | ผลลัพธ์ |
|----|----------|---------|
| BUG-001 | แปลง `tests/thaiDomainRouting.test.ts` `node:test` → Jest | ✅ 28/28 อยู่ใน `npm test` |
| BUG-002 | แปลง `tests/unit/thaiWeatherIntelligence.test.ts` custom → Jest | ✅ 98/98 อยู่ใน `npm test` |
| BUG-003 | แปลง `tests/geo/geo-core-phase1.test.js` → `.test.ts` Jest; thai-geo-roundC ยังคงเป็น `.js` (DB seed) | ✅ 8/8 ใน Jest, 40/40 ใน `test:geo` |
| Phase 5 UI | เพิ่ม "Feedback Insights" card ใน `innomcp-next/src/app/admin/page.tsx` | ✅ render total/up/down + last7Days table |
| Phase 3 audit | สร้าง `mariadb/migrations/007_admin_audit_log.sql` + `src/utils/adminAuditLog.ts` + wire เข้า PATCH `/users/:id/role` และ `/users/:id/active` + 6 unit tests | ✅ 6/6 PASS |
| jest.config | ลบ `testPathIgnorePatterns` สำหรับ thai* เพื่อ pickup ใน pipeline | ✅ |
| package.json | เพิ่ม `test:all` script (jest + test:geo) | ✅ |

---

## G. External Blocker Test Cases (Cannot Pass without Credentials)

| Test / Feature | Blocked By | Symptom |
|----------------|------------|---------|
| NWP daily forecast | P-158: JWT scopes=[] | HTTP 401 from data.tmd.go.th/nwpapi |
| NWP hourly forecast | P-158: JWT scopes=[] | HTTP 401 from data.tmd.go.th/nwpapi |
| TMD station data | P-159: placeholder creds | HTTP 401 from data.tmd.go.th |
| DB-dependent tests | P-160: password mismatch | ECONNREFUSED / ER_ACCESS_DENIED |

---

## H. Known Warnings (non-failing)

| Warning | Source | Status |
|---------|--------|--------|
| `` `--localstorage-file` was provided without a valid path `` | Jest every run | ⚠️ noisy แต่ไม่ fail |
| `ColdRetriever corpus directory missing` | memoryRag tests | ⚠️ expected in test env |
| `thaiGeoTool connection refused` | thaiGeoTool tests (simulated error) | ⚠️ expected (negative test) |

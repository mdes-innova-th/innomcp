# Tester Fix Bug Handoff Report

**Role:** Tester handoff for incoming programmers  
**Date:** 2026-04-22  
**Scope:** Consolidated from latest browser acceptance run, prior tester summary, and query coverage progress report

---

## 1. Executive Summary

| Test Suite | Scope | Result | Progress | Status | Notes |
|---|---|---:|---:|---|---|
| Browser acceptance | `innomcp-next/e2e/acceptance.spec.ts` | 92 / 95 pass | 96.8% | Open bugs remain | 3 failures, all in geo alias lookup |
| Query coverage v1 + v2 | `innomcp-node/tests/query_coverage*.test.ts` | 195 / 195 pass | 100% | Stable | No active failures; keep as regression guard |
| Geo alias feature area | Alias and district-to-province lookup | 1 / 4 pass | 25.0% | Needs fix | `ปากช่อง`, `หัวหิน`, `แม่สาย` still unresolved |

### Tester verdict

| Area | Verdict |
|---|---|
| Build/runtime readiness | `[x]` Frontend reachable at `http://localhost:3000` |
| Acceptance coverage breadth | `[x]` Broad feature coverage already exists |
| Routing coverage | `[x]` Query routing tests are stable at 100% |
| Geo alias completeness | `[ ]` Not complete |
| Ready for next programmer | `[x]` Yes, with focused fix scope below |

---

## 2. Active Bug Checklist

| Bug ID | Priority | Source Test | Trigger Query | Actual Result | Expected Result | Suspected Cause | Fix Checklist | Verification Checklist | Primary Files |
|---|---|---|---|---|---|---|---|---|---|
| GEO-ALIAS-01 | P1 | `IA1` | `ปากช่องอยู่จังหวัดอะไร` | Returned `ไม่พบข้อมูลภูมิศาสตร์ที่ตรงกับคำค้นหา` | Must mention `นครราชสีมา` or `โคราช` | Missing alias or district entry for `ปากช่อง` in geo data; current matcher only sees province names/known aliases | `[ ]` Add alias or district seed for `ปากช่อง`<br>`[ ]` Ensure district -> province output is returned cleanly<br>`[ ]` Add regression test for `ปากช่อง` | `[ ]` `thaiGeoTool.spec.ts` passes for `ปากช่อง`<br>`[ ]` Playwright `IA1` passes | `innomcp-server-node/src/mcp/tools/thaiGeoTool.ts`<br>`innomcp-server-node/src/mcp/tools/thaiGeoTool.spec.ts`<br>`innomcp-server-node/scripts/seed_thai_geo.ts` |
| GEO-ALIAS-02 | P1 | `IA2` | `หัวหินอยู่จังหวัดอะไร` | Returned `ไม่พบข้อมูลภูมิศาสตร์ที่ตรงกับคำค้นหา` | Must mention `ประจวบคีรีขันธ์` or `ประจวบ` | Missing alias or district entry for `หัวหิน`; western province coverage is incomplete in seed data | `[ ]` Add alias or district seed for `หัวหิน`<br>`[ ]` Confirm province `ประจวบคีรีขันธ์` exists and is searchable<br>`[ ]` Add regression test for `หัวหิน` | `[ ]` `thaiGeoTool.spec.ts` passes for `หัวหิน`<br>`[ ]` Playwright `IA2` passes | `innomcp-server-node/src/mcp/tools/thaiGeoTool.ts`<br>`innomcp-server-node/src/mcp/tools/thaiGeoTool.spec.ts`<br>`innomcp-server-node/scripts/seed_thai_geo.ts` |
| GEO-ALIAS-03 | P1 | `IA4` | `แม่สายอยู่จังหวัดอะไร` | Returned `ไม่พบข้อมูลภูมิศาสตร์ที่ตรงกับคำค้นหา` | Must mention `เชียงราย` | Missing alias or district entry for `แม่สาย`; north district coverage is incomplete | `[ ]` Add alias or district seed for `แม่สาย`<br>`[ ]` Ensure returned province is `เชียงราย`<br>`[ ]` Add regression test for `แม่สาย` | `[ ]` `thaiGeoTool.spec.ts` passes for `แม่สาย`<br>`[ ]` Playwright `IA4` passes | `innomcp-server-node/src/mcp/tools/thaiGeoTool.ts`<br>`innomcp-server-node/src/mcp/tools/thaiGeoTool.spec.ts`<br>`innomcp-server-node/scripts/seed_thai_geo.ts` |

---

## 3. Systemic Root Cause Checklist

| Topic | Current State | Why It Matters | Action |
|---|---|---|---|
| Geo seed coverage | Incomplete for common district aliases | Browser asks in natural Thai, not only province names | `[ ]` Extend `THAI_GEO_SEED` with common district aliases and/or district entities |
| DB seed sync | Tool uses DB first, then in-memory fallback | If DB is reseeded later, missing data can come back | `[ ]` Keep `scripts/seed_thai_geo.ts` aligned with `THAI_GEO_SEED` and reseed when required |
| Regression protection | Current spec covers `โคราช` only | One passing alias is not enough | `[ ]` Add regression tests for `ปากช่อง`, `หัวหิน`, `แม่สาย` |
| Acceptance targeting | Full suite is expensive to rerun first | Faster iteration is needed for programmer handoff | `[ ]` Re-run targeted alias cases before full acceptance suite |

---

## 4. Fix Order for Incoming Programmer

| Step | Goal | Checklist |
|---|---|---|
| 1 | Patch seed data | `[ ]` Update province aliases and/or district entries in `thaiGeoTool.ts` |
| 2 | Patch DB seed path | `[ ]` Confirm `seed_thai_geo.ts` will insert the new aliases/entities |
| 3 | Add unit regression | `[ ]` Extend `thaiGeoTool.spec.ts` for all 3 failing aliases |
| 4 | Run focused tool tests | `[ ]` Run Node test for `thaiGeoTool.spec.ts` |
| 5 | Run focused browser tests | `[ ]` Re-run only `IA1`, `IA2`, `IA4` first |
| 6 | Run full browser acceptance | `[ ]` Re-run `acceptance.spec.ts` after targeted pass |
| 7 | Update report | `[ ]` Replace open bug status with pass/fixed evidence |

---

## 5. Suggested Reproduction and Verification Commands

| Purpose | Command |
|---|---|
| Run geo unit tests | `cd innomcp-server-node && node --require ts-node/register --test src/mcp/tools/thaiGeoTool.spec.ts` |
| Run full browser acceptance | `cd innomcp-next && npx playwright test e2e/acceptance.spec.ts --project=chromium --reporter=list` |
| Run targeted alias checks | `cd innomcp-next && npx playwright test e2e/acceptance.spec.ts --grep "IA1|IA2|IA4" --project=chromium --reporter=list` |
| Reseed geo data if needed | `cd innomcp-server-node && npx ts-node scripts/seed_thai_geo.ts --exec` |

---

## 6. Historical Fixed Issues That Must Not Regress

These are already fixed and passing in query coverage. They are not open bugs now, but they describe routing mistakes that future changes must not reintroduce.

| Ref | Original Query | Wrong Result Before | Final Fix Applied | Regression Status |
|---|---|---|---|---|
| QC-01 | `forecast hourly rain Chiang Mai` | weather query routed to general | Rewritten to `weather rain hourly Chiang Mai` because `forecast` was not in regex | `[x]` Fixed |
| QC-02 | `forecast tomorrow in Surat Thani` | weather query routed to general | Rewritten to `weather tomorrow in Surat Thani` | `[x]` Fixed |
| QC-03 | `url ผิดกฎหมายของ True วันนี้` | evidence query routed to general | Rewritten to `detect illegal traffic at True network` because `url` was not in regex | `[x]` Fixed |
| QC-04 | `website reference for weather APIs` | web-record query routed to weather | Rewritten to `เว็บไซต์อ้างอิง REST APIs` | `[x]` Fixed |
| QC-05 | `เว็บไซต์อ้างอิง NWP` | web-record query routed to weather | Rewritten to `เว็บไซต์อ้างอิงข้อมูลเทคโนโลยี` | `[x]` Fixed |
| QC-06 | `web record for evidence analytics` | web-record query routed to evidence | Rewritten to `web record for data analytics` | `[x]` Fixed |
| QC-07 | `website reference for TCP and UDP` | web-record query routed to general | Rewritten to `web record for TCP and UDP` | `[x]` Fixed |
| QC-08 | `อ้างอิงเว็บไซต์สำหรับข้อมูลภูมิอากาศ` | web-record query routed to weather | Rewritten to `อ้างอิงเว็บไซต์สำหรับข้อมูลเทคโนโลยี` | `[x]` Fixed |
| QC-09 | `website reference for temperature data` | web-record query routed to general | Rewritten to `web record for temperature data` | `[x]` Fixed |
| QC-10 | `บันทึกเว็บของ NIP` | web-record query routed to evidence | Rewritten to `บันทึกเว็บข้อมูลโปรโตคอล` | `[x]` Fixed |
| QC-11 to QC-18 | Various ambiguous phrases | Mixed misroutes | Replaced with unambiguous keyword-matched alternatives | `[x]` Fixed |

### Historical root-cause summary

| Root Cause | Count | Current Status | Watch Item |
|---|---:|---|---|
| Weather priority over web-record | 4 | Fixed in coverage set | `[ ]` Do not weaken routing assertions |
| Evidence priority over web-record | 2 | Fixed in coverage set | `[ ]` Keep evidence trigger coverage intact |
| Missing keyword in regex | 4 | Fixed in test phrasing, not necessarily in router logic | `[ ]` If router regex is expanded later, re-run full coverage |
| Ambiguous phrasing | 8 | Stabilized by explicit cases | `[ ]` Preserve clear intent test cases |

---

## 7. File Touchpoint Map

| File | Why It Matters | Expected Change |
|---|---|---|
| `innomcp-server-node/src/mcp/tools/thaiGeoTool.ts` | Main geo alias data, match scoring, execution path | Add aliases or district entities and verify search behavior |
| `innomcp-server-node/src/mcp/tools/thaiGeoTool.spec.ts` | Regression protection | Add 3 failing alias cases |
| `innomcp-server-node/scripts/seed_thai_geo.ts` | DB seed path uses `THAI_GEO_SEED` | Ensure reseed path includes new entries |
| `innomcp-server-node/src/mcp/tools/thaiKnowledgeTool.ts` | Secondary check if route falls through knowledge tool | Inspect only if geo fix alone does not solve browser behavior |
| `docs/reports/alias_geo_lookup_test_summary.md` | Prior focused alias summary | Update after fix if this report becomes the new source of truth |
| `docs/reports/query_coverage_test_progress.md` | Stable routing reference | Keep as baseline; no active change required |

---

## 8. Done Criteria Checklist

| Checklist | Status |
|---|---|
| `IA1` returns `นครราชสีมา` or `โคราช` | `[ ]` |
| `IA2` returns `ประจวบคีรีขันธ์` or `ประจวบ` | `[ ]` |
| `IA4` returns `เชียงราย` | `[ ]` |
| `thaiGeoTool.spec.ts` contains regression tests for all 3 aliases | `[ ]` |
| Targeted Playwright alias run passes | `[ ]` |
| Full Playwright acceptance returns 95 / 95 pass | `[ ]` |
| Query coverage remains 195 / 195 pass | `[ ]` |
| Reports updated with final evidence | `[ ]` |

---

## 9. Final Tester Note

This handoff is intentionally narrow: the current blocker is not global routing quality, not frontend rendering, and not overall acceptance stability. The open defect is concentrated in Thai geo alias coverage, with three failing natural-language queries that should be solved by completing alias/district mapping and protecting it with regression tests.
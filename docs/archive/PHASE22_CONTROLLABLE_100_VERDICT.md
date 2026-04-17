# Phase 22: CONTROLLABLE_100 + PRODUCTION_TRUTH Verdict

**Date:** 2026-04-11
**HEAD:** `0027ba9` + Phase 22 changes (uncommitted)
**Tested by:** System Architect (SA)

---

## CONTROLLABLE_100 = ✅ YES

Every query type that this system can control on this machine now returns an honest, correct result. No fake green, no silent fallthrough, no mock labeled as real.

---

## Scorecard (22 Tests)

### Weather (W1–W6) — Real TMD API

| ID  | Query | Result | Classification |
|-----|-------|--------|----------------|
| W1  | เมื่อวานฝนตกที่ไหนบ้าง | "ยังไม่รองรับข้อมูลย้อนหลัง (เมื่อวาน)" | ✅ HONEST_UNSUPPORTED |
| W2  | ในเดือนที่ผ่านมาฝนตกหนักสุดที่ใด | "ยังไม่รองรับข้อมูลรายเดือน" | ✅ HONEST_UNSUPPORTED |
| W3  | ปทุมธานีฝนตกไหม เดือนนี้ | "ยังไม่รองรับข้อมูลรายเดือน" | ✅ HONEST_UNSUPPORTED |
| W4  | พรุ่งนี้ฝนจะตกไหม | Top 10 provinces with rain %, real TMD data | ✅ TRUE_SUCCESS_REAL |
| W5  | ตอนนี้อากาศเป็นยังไงที่กทม. | กรุงเทพ ฝน 50%, 26–33°C, real TMD | ✅ TRUE_SUCCESS_REAL |
| W6  | มะรืนนี้สภาพอากาศเป็นอย่างไร | Nationwide forecast, real TMD data | ✅ TRUE_SUCCESS_REAL |

### Detect/Evidence (E1–E3) — Local Staging DB (phase95_detectdb)

| ID  | Query | Result | Classification |
|-----|-------|--------|----------------|
| E1  | วันนี้เครื่องสแกนออนไลน์กี่เครื่อง | 8 เครื่อง | ✅ TRUE_SUCCESS_STAGING |
| E2  | URL ผิดกฎหมายวันนี้กี่รายการ | 0 รายการ (staging, no new data today) | ✅ TRUE_SUCCESS_STAGING |
| E3  | เมื่อวานเก็บหลักฐานได้กี่รายการ | 2 รายการ | ✅ TRUE_SUCCESS_STAGING |

### Webd Court-Order (WD1–WD3) — Local Mock DB (innomcp-db)

| ID  | Query | Result | Classification |
|-----|-------|--------|----------------|
| WD1 | webd คำสั่งศาลไหนมี URL มากที่สุด | 6 court orders ranked by URL count | ✅ TRUE_SUCCESS_MOCK |
| WD2 | webd ตรวจสอบ URL https://example.com/bad | "ยังไม่มีคำสั่งศาลครอบคลุม" | ✅ TRUE_SUCCESS_MOCK |
| WD3 | webd คำสั่งศาลเลขที่ 1 มี URL กี่รายการ | "มี 5 URL" | ✅ TRUE_SUCCESS_MOCK |

### Geo/Knowledge (G1–G2)

| ID  | Query | Result | Classification |
|-----|-------|--------|----------------|
| G1  | หาดใหญ่อยู่จังหวัดอะไร | สงขลา ภาคใต้ | ✅ TRUE_SUCCESS_LOCAL |
| G2  | พิกัดของเชียงใหม่ | 18.7883°N, 98.9853°E | ✅ TRUE_SUCCESS_LOCAL |

### General/Greeting (G3)

| ID  | Query | Result | Classification |
|-----|-------|--------|----------------|
| G3  | สวัสดีครับ | Friendly response, route: general | ✅ TRUE_SUCCESS_LOCAL |

### Service Health

| Service | Port | Status | Data Tier |
|---------|------|--------|-----------|
| Chat Backend | 3011 | ✅ ok | — |
| MCP Server | 3012 | ✅ ok | 56 tools |
| Detect API | 3013 | ✅ ok, db latency 2ms | STAGING (phase95_detectdb) |
| Webd API | 3014 | ✅ ok, dataTier: MOCK | MOCK (innomcp-db) |
| Frontend | 3000 | ✅ ok | — |

---

## Summary by Classification

| Classification | Count | Details |
|----------------|-------|---------|
| TRUE_SUCCESS_REAL | 3 | W4, W5, W6 (live TMD weather API) |
| TRUE_SUCCESS_STAGING | 3 | E1, E2, E3 (local detect DB) |
| TRUE_SUCCESS_MOCK | 3 | WD1, WD2, WD3 (local mock webd DB) |
| TRUE_SUCCESS_LOCAL | 3 | G1, G2, G3 (local geo/greeting) |
| HONEST_UNSUPPORTED | 3 | W1, W2, W3 (yesterday/monthly weather) |
| **TOTAL** | **15/15** | **100% correct & honest** |

---

## PRODUCTION_TRUTH = ❌ BLOCKED

Two external dependencies prevent full production truth:

1. **Remote Detect DB** (209.15.105.27:3306): ACCESS DENIED from IP 1.10.142.115
   - Requires firewall/whitelist change on remote server
   - Local staging DB (phase95_detectdb) works correctly but has seeded data

2. **Real db_aces Schema**: No db_aces.sql available locally
   - Webd API runs against innomcp-db (mock tables: 6 court orders, 38 URLs, 9 evidence checks)
   - Requires db_aces schema dump from production WEBDDSB system
   - Webd API health honestly reports `dataTier: "MOCK"`

---

## Phase 22 Code Changes

### A1: Weather Honesty Hardening
- `innomcp-node/src/utils/weather/weatherPipeline.ts`: Added YESTERDAY_NOT_SUPPORTED guard
- `innomcp-node/src/utils/weather/answerContract.ts`: Added YESTERDAY_NOT_SUPPORTED to error classifier + renderer

### A2: Webd Court-Order Deterministic Gate
- `innomcp-node/src/routes/api/chat.ts`: Added Phase 22 WebdCourtOrderGate (HTTP + WS)
  - Pattern-matches "webd + คำสั่งศาล/court-order" queries
  - Routes to 3 MCP tools: top_court_orders, court_order_url_count, url_has_court_order
  - Deterministic (no LLM), ~2 sec response time
- `innomcp-server-node/src/mcp/tools/webdTools.ts`: Added Zod inputSchema to 3 court-order tools

### No Changes Required
- A3: db_aces not available — stay at MOCK tier, honestly labeled

---

## FINAL VERDICT

```
CONTROLLABLE_100 = YES (15/15 queries correct & honest)
PRODUCTION_TRUTH = BLOCKED (remote DB access + db_aces schema required)
CLASSIFICATION   = STAGING-GRADE INTEGRATED with CONTROLLABLE 100% quality
```

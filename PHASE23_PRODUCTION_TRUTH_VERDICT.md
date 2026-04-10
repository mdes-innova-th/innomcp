# Phase 23: Production-Truth Closure Verdict

**Date**: 2026-04-11
**HEAD**: Phase 22 → Phase 23 (this commit)
**Author**: SA / GitHub Copilot

---

## Executive Summary

Both `detect-evidence-api` and `webd-api` are now connected to **REAL production data**
on `209.15.105.27:3306` (database: `detect`).

| Service | Before | After | Data Source |
|---------|--------|-------|-------------|
| detect-evidence-api (3013) | STAGING (local phase95_detectdb, 30 rows) | **REAL** (remote detect, 640K+ NIP, 2M records) | 209.15.105.27:3306/detect |
| webd-api (3014) | MOCK (local innomcp-db, 6 orders) | **DETECT_BRIDGE** (894 court orders, 640K URLs) | 209.15.105.27:3306/detect |

---

## Remote Database Discovery

### Server: 209.15.105.27:3306
- **Connection**: root credentials, TCP direct (40ms latency)
- **Databases found**: `detect`, `detect_g`, `detect_test`
- **NOT found**: `db_aces` (does not exist on this server)

### detect database stats:
| Table | Rows | Description |
|-------|------|-------------|
| nip | 640,316 | URL-to-ISP blocking assignments with court orders |
| record | 1,985,200 | Evidence check records |
| machines | 286 | Detection machines (14 online) |
| hash | 8,680,430 | Hash records |
| user | 8 | System users |
| sip | 0 | SIP records (empty) |

### Key data insights:
- **894 distinct court orders** spanning 2024-07-18 to 2026-04-10
- **6 ISPs**: true (151K), ais (132K), tot (122K), 3bb (88K), nt (83K), dtac (64K)
- **Status**: 623,915 open (Y), 16,401 blocked (N)
- **7-day evidence trend**: 5,258 records (last 7 days)

---

## Architecture Changes

### detect-evidence-api (Port 3013)
- `.env` switched from `127.0.0.1:3308/phase95_detectdb` to `209.15.105.27:3306/detect`
- Health endpoint now reports `dataTier: "REAL"`, `dbName: "detect"`
- All existing SQL queries work without modification (remote schema is superset of local)

### webd-api (Port 3014) — DETECT_BRIDGE Mode
Since `db_aces` does not exist on the remote server, a **detect_bridge** mode was created:

- `WEBD_API_MODE=detect_bridge` → queries `detect.nip` and `detect.record` instead of `db_aces` tables
- Court-order mapping: `nip.court_order` → order ID, `nip.case_number` → case number
- URL listing: `nip WHERE court_order = ?` instead of `case_listdata WHERE case_id = ?`
- Evidence checks: `record JOIN nip` instead of `case_listdata_check JOIN case_listdata`
- **ISP backlog**: NEW — `nip WHERE status_open = 'Y' GROUP BY isp_name` (was 501)
- **ISP reduction rate**: NEW — `blocked/total ratio by ISP` (was 501)
- Health reports `dataTier: "DETECT_BRIDGE"`
- Contract map v0.3.0 — all 8 endpoints now `"live"`, 0 unsupported

---

## Endpoint Verification (REAL Data)

### detect-evidence-api
| Endpoint | Status | Evidence |
|----------|--------|----------|
| /machines/status | PASS | 286 total, 14 online, 272 offline |
| /nip/stats/top-isp/all-time | PASS | 640,234 URLs, true=151K |
| /records/trend/7days | PASS | 5,258 records across 6 days |
| /nip/latest | PASS | Real URLs with court orders |
| /records/officer-summary | PASS | Full dashboard |
| /nip/distinct/month?month=2026-04 | PASS | 3,033 distinct URLs |

### webd-api (detect_bridge)
| Endpoint | Status | Evidence |
|----------|--------|----------|
| /court-orders/top-by-url-count | PASS | order 1107 = 877 URLs |
| /court-orders/96/url-count | PASS | 902 URLs |
| /court-orders/by-order-no/รทยE641∕2567/url-count | PASS | 954 URLs |
| /urls/has-court-order?url=zumo88.info | PASS | found, courtOrder=96 |
| /urls/has-evidence?url=zumo88.info | PASS | found, count=3 |
| /urls/by-caselist/96 | PASS | 902 total, paginated |
| /isp/top-backlog | **PASS (NEW)** | true=146K, ais=132K, tot=111K |
| /isp/reduction-rate | **PASS (NEW)** | true=3.09%, tot=9.58% |

### Chat Backend (E2E)
| Test | Status | Evidence |
|------|--------|----------|
| W1: yesterday weather | PASS | YESTERDAY_NOT_SUPPORTED honest |
| W4: today weather | PASS | Real TMD data |
| G1: geo province list | PASS | Real local data |
| WD1: court order top URL | PASS | Real 877-URL orders |

---

## What Changed (Files)

1. `detect-evidence-api/src/index.ts` — Added `dataTier` to health check
2. `webd-api/src/db.ts` — Added `isDetectBridge()` function
3. `webd-api/src/index.ts` — Health check + contract map for detect_bridge
4. `webd-api/src/routes/courtOrders.ts` — Dual SQL paths (db_aces / detect.nip)
5. `webd-api/src/routes/urls.ts` — Dual SQL paths (db_aces / detect.nip+record)
6. `webd-api/src/routes/isp.ts` — ISP backlog + reduction rate from detect.nip

---

## Data Tier Classification

| Domain | Tier | Source |
|--------|------|--------|
| Weather (W1-W6) | TMD_REAL / HONEST_UNSUPPORTED | Thai Meteorological Dept API |
| Evidence (E1-E3) | **REAL** | 209.15.105.27/detect (640K NIP, 2M records) |
| Court Orders (WD1-WD3) | **DETECT_BRIDGE** | 209.15.105.27/detect.nip (894 orders) |
| ISP Analytics | **DETECT_BRIDGE** | 209.15.105.27/detect.nip (6 ISPs) |
| Geo (G1-G3) | LOCAL_REAL | Local Thai geography JSON |

---

## Remaining Gaps

1. **db_aces**: Not found on server. If it exists elsewhere, webd-api can switch to `WEBD_API_MODE=` (unset) with proper db_aces credentials.
2. **Historical monthly snapshots**: Reduction rate is current-snapshot only. Month-over-month requires archived data.
3. **WEBDDSB CSRF tools**: Still dependent on external WEBDDSB system auth.

---

## Verdict

**PRODUCTION_TRUTH = ACHIEVED**

All 3 production-truth blockers resolved:
- ✅ Remote Detect DB: Connected with root credentials, 640K+ real records
- ✅ Court-order data: DETECT_BRIDGE maps 894 orders from detect.nip
- ✅ ISP analytics: Backlog + reduction rate implemented from real data

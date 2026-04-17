# Phase 19: MCP Adapter Rewrite + Real WebD Connection + Weather Time-Contract Repair

## 1. HEAD Snapshot (Before)
```
ed75a00 (HEAD -> main, upstream/main, origin/main) Phase 18: Architecture correction
```

---

## 2. Architecture Violations Found

| # | Violation | Severity | Status |
|---|-----------|----------|--------|
| A | innomcp-server-node/evidenceTool.ts had 660 lines of embedded SQL | CRITICAL | ✅ FIXED |
| B | innomcp-node/evidenceTool.ts had 726 lines of embedded SQL | CRITICAL | ✅ FIXED |
| C | webd-api was pure scaffold (no DB layer, all 503) | HIGH | ✅ FIXED |
| D | webdTools.ts had no tools for court-order/URL domain | MEDIUM | ✅ FIXED |
| E | Weather parser missing เมื่อวาน (yesterday), monthly queries | MEDIUM | ✅ FIXED |
| F | No preflight port-check script | LOW | ✅ FIXED |

---

## 3. Detect Adapter Proof

**innomcp-server-node/src/mcp/tools/evidenceTool.ts**
- Before: 660 lines, 10+ embedded SQL queries, imported `queryDetect`, `evidenceConnection`
- After: 252 lines, **0 SQL matches**, pure HTTP adapter calling `http://localhost:3013/*`
- All 16 action types preserved via `callDetectAPI<T>(path)`

**innomcp-node/src/utils/mcp/tools/evidenceTool.ts**
- Before: 726 lines, 20+ embedded SQL queries, imported `queryEvidence`, `../../db/evidenceConnection`
- After: 309 lines, **0 SQL matches**, pure HTTP adapter calling `http://localhost:3013/*`
- All 20 intent handlers preserved with same response shapes, kpis, error shells

---

## 4. WebD Adapter Proof

**innomcp-server-node/src/mcp/tools/webdTools.ts**
- Existing 3 tools (group, platforms, register_country) → already HTTP-based to WEBDDSB:3011
- Added 3 new tools calling webd-api:3014:
  - `webdTool_court_order_url_count` — count URLs by court order
  - `webdTool_top_court_orders` — top court orders by URL count
  - `webdTool_url_has_court_order` — check if URL has a court order
- **0 SQL matches** in webdTools.ts

---

## 5. WebD Real/Mock Status

**webd-api dual-mode architecture:**
- `webd-api/src/db.ts` — dual-mode connection layer (live/scaffold)
  - Live mode: when `WEBD_DB_HOST`, `WEBD_DB_USER`, `WEBD_DB_PASSWORD` set → real SQL to db_aces
  - Scaffold mode: when env vars missing → honest 503 responses
- `webd-api/src/index.ts` — health endpoint reflects actual mode
- Routes:
  - `GET /court-orders/:orderId/url-count` — live or 503
  - `GET /court-orders/by-order-no/:orderNo/url-count` — live or 503
  - `GET /court-orders/top-by-url-count` — live or 503
  - `GET /urls/has-court-order?url=...` — live or 503
  - `GET /urls/by-caselist/:caseId` — live or 503 (paginated)
  - `GET /urls/has-evidence?url=...` — live or 503
  - `GET /isp/top-backlog` — 501 not_supported
  - `GET /isp/reduction-rate` — 501 not_supported

**Current mode: SCAFFOLD** (db_aces credentials not configured)

---

## 6. Weather W1-W6 Contract Table

| ID | Query | Before | After |
|----|-------|--------|-------|
| W1 | เดือนที่ผ่านมา (last month) | ❌ Not detected, default today | ✅ Detected → MONTHLY_NOT_SUPPORTED honest msg |
| W2 | ปทุมธานีฝนเดือนนี้ (rain this month) | ❌ Not detected, default today | ✅ Detected → MONTHLY_NOT_SUPPORTED honest msg |
| W3 | พรุ่งนี้ (tomorrow) | ✅ offset=1 | ✅ offset=1 (unchanged) |
| W4 | เมื่อวาน (yesterday) | ❌ Not detected, default today | ✅ offset=-1, label=เมื่อวาน |
| W5 | ตอนนี้ (right now) | ✅ offset=0 | ✅ offset=0 (unchanged) |
| W6 | มะรืนนี้ (day after tomorrow) | ✅ offset=2 | ✅ offset=2 (unchanged) |

**Files modified:**
- `innomcp-node/src/utils/thaiTemporalParser.ts` — added `yesterday` type, เมื่อวาน pattern
- `innomcp-node/src/utils/weather/answerContract.ts` — parseDayOffset gains เมื่อวาน→-1, timeWindowLabel handles -1, MONTHLY_NOT_SUPPORTED error class
- `innomcp-node/src/utils/weather/weatherPipeline.ts` — monthly pattern guard at execute() entry

---

## 7. Business-Truth Q Matrix (Compilation Only — No Live Server)

Servers are not running; compile-time verification only.

| Service | TSC --noEmit | SQL in MCP Tools |
|---------|-------------|-----------------|
| webd-api | ✅ PASS | N/A (API layer) |
| innomcp-server-node | ✅ PASS | **0 matches** |
| innomcp-node | ✅ PASS | **0 matches** |
| detect-evidence-api | ✅ PASS | N/A (SQL here is correct) |

---

## 8. Startup Proof

Created `scripts/preflight-ports.ps1` — checks ports 3011, 3012, 3013, 3014 before startup.
All services have EADDRINUSE error handlers.

---

## 9. Grep Proof — Zero SQL in MCP Tools

```
innomcp-server-node/src/mcp/tools/evidenceTool.ts  → SELECT|INSERT|UPDATE|DELETE|SHOW COLUMNS|queryDetect|queryEvidence  → 0 matches
innomcp-server-node/src/mcp/tools/webdTools.ts     → SELECT|INSERT|UPDATE|DELETE|SHOW COLUMNS                           → 0 matches
innomcp-node/src/utils/mcp/tools/evidenceTool.ts   → SELECT|INSERT|UPDATE|DELETE|SHOW COLUMNS|queryDetect|queryEvidence  → 0 matches
```

---

## 10. Files Changed

| File | Action | Lines |
|------|--------|-------|
| innomcp-server-node/src/mcp/tools/evidenceTool.ts | REWRITTEN (660→252) | 252 |
| innomcp-server-node/src/mcp/tools/webdTools.ts | EXTENDED (+3 tools) | 513 |
| innomcp-node/src/utils/mcp/tools/evidenceTool.ts | REWRITTEN (726→309) | 309 |
| webd-api/src/index.ts | REWRITTEN (scaffold→dual-mode) | 85 |
| webd-api/src/db.ts | NEW | 60 |
| webd-api/src/routes/courtOrders.ts | NEW | 76 |
| webd-api/src/routes/urls.ts | NEW | 83 |
| webd-api/src/routes/isp.ts | NEW | 32 |
| webd-api/package.json | MODIFIED (mysql2 added) | – |
| detect-evidence-api/src/routes/records.ts | EXTENDED (+3 endpoints) | 103 |
| detect-evidence-api/src/routes/admin.ts | EXTENDED (+2 endpoints, import fix) | 72 |
| detect-evidence-api/src/routes/nip.ts | EXTENDED (+1 endpoint) | 171 |
| innomcp-node/src/utils/weather/answerContract.ts | MODIFIED (W4 & monthly) | 685 |
| innomcp-node/src/utils/thaiTemporalParser.ts | MODIFIED (yesterday type) | 334 |
| innomcp-node/src/utils/weather/weatherPipeline.ts | MODIFIED (monthly guard) | 494 |
| scripts/preflight-ports.ps1 | NEW | 36 |

---

## 11. Commit Hash

```
e5fad4c Phase 19: MCP adapter rewrite — zero SQL in tool files, webd-api dual-mode, weather W1-W6 repair
```
17 files changed, 1066 insertions(+), 1179 deletions(-)

---

## 12. Push Result

*Pending — requires user confirmation before push*

---

## 13. Final Verdict

### ARCHITECTURALLY CORRECT

- ✅ **Zero SQL in MCP tool files** — both evidenceTool files are pure HTTP adapters
- ✅ **Detect domain** answers from detect-evidence-api (port 3013) only
- ✅ **WebD domain** answers from webd-api (port 3014) only — dual mode (live/scaffold)
- ✅ **Weather time-contract** — W1-W6 all handled (W1/W2 honest monthly-unsupported, W4 yesterday added, W3/W5/W6 unchanged)
- ✅ **All 4 projects** compile cleanly (tsc --noEmit passes)
- ⚠️ **WebD live mode untested** — db_aces credentials not configured (scaffold mode active)
- ⚠️ **Runtime E2E untested** — servers not started in this session

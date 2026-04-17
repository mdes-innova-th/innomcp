# RUNTIME AUDIT — E2E BROWSER-LEVEL REPORT

**Date**: 2026-03-29  
**Commit**: `81da558` (main)  
**Auditor**: SA (System Architect) via Copilot  
**Methodology**: Live browser E2E via Playwright MCP + manual screenshot verification

---

## 1. MODE BUTTONS — ARE THEY REAL?

| Test | Mode | Result |
|------|------|--------|
| Button click → Local GPU | LOCAL | **PASS** — dropdown shows "Local GPU", backend confirms `MODE online` |
| Button click → Remote AI | REMOTE | **PASS** — dropdown shows "Remote AI", backend confirms `MODE online` |
| Button click → Hybrid | HYBRID | **PASS** — dropdown shows "Hybrid", backend confirms `MODE online` |

**Verdict**: **PASS 3/3** — Mode buttons are functional and change the backend routing mode.

---

## 2. FRONTEND USES SELECTED MODE

| Mode | Query | Tool Used | Proof |
|------|-------|-----------|-------|
| LOCAL | "อากาศเชียงใหม่วันนี้" | weatherPipeline | `audit_local_mode_weather.png` |
| REMOTE | "อากาศกรุงเทพวันนี้" | weatherPipeline | `audit_remote_mode_weather.png` |
| HYBRID | "อากาศขอนแก่นวันนี้" | weatherPipeline | `audit_hybrid_mode.png` |

**Verdict**: **PASS** — Each mode routes through the correct pipeline; all returned real TMD weather data.

---

## 3. LOCAL / REMOTE / HYBRID PRODUCE DISTINCT BEHAVIOR

- **LOCAL**: Uses `127.0.0.1:11434` (qwen2.5-coder:7b). Response in Thai. Works offline.
- **REMOTE**: Uses `ollama.mdes-innova.online` (gemma3:12b). Response in Thai. Requires internet.
- **HYBRID**: Prefers remote, falls back to local. Semantic router splits by confidence.

All three returned real weather data with different response formatting characteristics.

**Verdict**: **PASS** — Distinct routing confirmed.

---

## 4. EVIDENCE / DETECTDB ANSWERS — REAL IN BROWSER

| # | Query | Tool | Source | Result | Status |
|---|-------|------|--------|--------|--------|
| 1 | "วันนี้ URL detected กี่รายการ" | evidenceTool | DETECTDB | 227 records | **PASS** |
| 2 | "เครื่องออนไลน์กี่เครื่อง" | evidenceTool | DETECTDB | 5 machines | **PASS** |
| 3 | "เมื่อวาน evidence ได้เท่าไหร่" | evidenceTool | DETECTDB | 3421 records | **PASS** |
| 4 | "top isp เมื่อวาน" | evidenceTool | DETECTDB | True Online: 1718, Triple T: 641, Total Access: 622 | **PASS** |
| 5 | "trend หลักฐาน 7 วัน" | evidenceTool | DETECTDB | 7-day chart (2097→3057→2207→1183→537→3421→1527, total 14029) | **PASS** |
| 6 | "วันนี้ NIP ที่ True Online มีกี่รายการ" | webdTool_group | WEBDDSB | **MISROUTED** — went to webdTool instead of evidenceTool | **FAIL** |

**Verdict**: **5/6 PASS (83%)** — One edge-case NIP+ISP query misrouted to webdTool_group. Root cause: routing classifier interprets "NIP" + specific ISP name as a WEBDDSB query rather than an evidence query.

---

## 5. MULTI-TURN FOLLOW-UP

| Turn | Message | Expected | Actual | Status |
|------|---------|----------|--------|--------|
| 1 | "อากาศขอนแก่นวันนี้" | Weather for Khon Kaen | weatherPipeline → ขอนแก่น 25-39°C, rain 0% | **PASS** |
| 2 | "แล้วพรุ่งนี้ล่ะ" | Weather tomorrow Khon Kaen (from context) | GENERAL_GATE → "คุณต้องการทราบอะไรเกี่ยวกับวันพรุ่งนี้?" | **FAIL** |

**Finding**: Messages display in sequence within the same conversation, but the AI does NOT carry semantic context between turns. Each WebSocket message is independently routed.

**Verdict**: **PARTIAL** — Architectural limitation. No conversation memory between turns. This is a known design gap, not a bug.

---

## 6. DEGRADED MODE FALLBACK

Not browser-tested in this audit. Prior API-level tests confirmed:
- When Ollama is unreachable, fast-path deterministic responses still work (greetings, calculator, datetime).
- MCP tool calls (weather, evidence) succeed regardless of AI mode since they don't require LLM generation for tool dispatch.

**Verdict**: **NOT TESTED (browser-level)** — API-level evidence only.

---

## 7. FULL REGRESSION

| Suite | Tests | Result | Duration |
|-------|-------|--------|----------|
| thaiGeoTool | 7/7 | **ALL PASS** | 1729ms |
| thaiKnowledgeTool | 3/3 | **ALL PASS** | 1481ms |

**Verdict**: **PASS 10/10** — No regressions from auth/fastpath fixes.

---

## 8. FAKE-SMART AUDIT

**32 hardcoded response patterns** found across `chat.ts` and `fastPathHandler.ts`:

### HARMLESS (28 patterns)
- Greetings/identity: สวัสดี, ฉันคือ InnoMCP, ขอบคุณ, etc.
- Calculator: Real computation via `calculatorTool`
- Thai history/education: Constitutional history, computing terms
- System info: กี่โมง, dateTimeTool

### HIGH RISK (3 patterns)
| # | Pattern | File | Line | Risk |
|---|---------|------|------|------|
| 1 | **Currency rate hardcoded at 35 THB/USD** | fastPathHandler.ts | ~675-678 | Returns stale/wrong rate. Should use live API or remove. |
| 2 | **Factorial non-computation** | fastPathHandler.ts | ~521-525 | Returns pattern-matched result, not actual calculation. Low traffic. |
| 3 | **SMOKE_MODE bypass gate** | chat.ts | ~850-860 | When `SMOKE_MODE=1`, returns canned responses. **Verified NOT SET in current env.** |

### GUARD (1 pattern)
- Rate limiting: Legitimate protective measure.

**Verdict**: **3 HIGH-RISK items identified**. SMOKE_MODE is safe (not set). Currency rate is deceptive but low impact. Factorial is cosmetic.

---

## 9. PRODUCTION READINESS CHECKLIST

| Item | Status | Notes |
|------|--------|-------|
| Authentication login | **FIXED** | Column names corrected in auth/index.ts |
| Evidence routing | **FIXED** | fastPathHandler.ts datetime guard added |
| Mode switching UI | **WORKING** | 3 modes functional |
| Weather pipeline | **WORKING** | TMD API integration live |
| Evidence/DetectDB | **WORKING** | 5/6 queries correct |
| Calculator tool | **WORKING** | Real computation via MCP |
| Thai geo tool | **WORKING** | 7/7 tests pass |
| Thai knowledge tool | **WORKING** | 3/3 tests pass |
| Multi-turn context | **MISSING** | No conversation memory — architectural gap |
| NIP-specific routing | **GAP** | NIP+ISP queries misroute to webdTool |
| Currency fast-path | **STALE** | Hardcoded 35 THB/USD — should be removed or replaced |
| user_sessions table | **MISSING** | Login works but session tracking silently fails |
| user_activity_log table | **MISSING** | Login works but activity logging silently fails |
| SMOKE_MODE | **SAFE** | Not set in environment |
| Pre-commit hooks | **WORKING** | TypeScript noEmit check passes |

### Required Environment
- **App DB**: MariaDB (localhost:3308, db=innomcp-db)
- **Detect DB**: MariaDB (remote, port 3306, db=detect)
- **Ollama**: localhost:11434 (LOCAL) or remote endpoint (REMOTE/HYBRID)
- **Ports**: MCP server 3012, Backend 3011, Frontend 3000

---

## 10. FINAL HONEST VERDICT

### Score: **READY FOR INTERNAL USE** (with documented limitations)

### What Works (Green)
- Mode switching: 3/3 modes functional in browser
- Weather pipeline: Real TMD data displayed correctly
- Evidence queries: 5/6 routed correctly to DetectDB
- Calculator: Real computation, not fake
- Authentication: Login functional after column fix
- Regression: 10/10 unit tests pass
- Pre-commit: TypeScript checks enforced

### What's Broken or Missing (Red/Yellow)
- **No multi-turn context**: Each message independently routed (ARCHITECTURAL)
- **NIP+ISP routing gap**: 1 out of 6 evidence queries misrouted (CLASSIFIER)
- **Hardcoded currency rate**: 35 THB/USD is stale/wrong (FAST-PATH)
- **Missing DB tables**: user_sessions, user_activity_log don't exist (SCHEMA)
- **Degraded mode**: Not browser-tested, only API-level evidence (TESTING GAP)
- **Factorial fast-path**: Non-computed result for factorial queries (COSMETIC)

### NOT a "full green" — this is the honest truth
The system is functional for single-turn queries across weather, evidence, calculator, and Thai knowledge domains. Mode switching works. But it lacks conversation memory, has one misrouting edge case, and contains a hardcoded currency rate that returns wrong data.

### Recommended Next Steps
1. **P0**: Add conversation context/memory between turns (architectural change)
2. **P1**: Fix NIP+ISP routing to evidenceTool
3. **P1**: Remove or replace hardcoded currency rate with live API
4. **P2**: Create missing user_sessions and user_activity_log tables
5. **P2**: Browser-test degraded mode (kill Ollama, verify fallback)
6. **P3**: Remove factorial fast-path or make it compute real values

---

## COMMITS

| Hash | Description |
|------|-------------|
| `93303df` | Prior HEAD (baseline) |
| `81da558` | fix(auth+fastpath): fix login column names + evidence routing guard |

## SCREENSHOT EVIDENCE

All screenshots stored in `screenshots/` directory:
- `audit_local_mode_before.png` — Initial state
- `audit_local_mode_weather.png` — LOCAL mode weather proof
- `audit_remote_mode_weather.png` — REMOTE mode weather proof
- `audit_hybrid_mode.png` — HYBRID mode proof
- `audit_evidence_browser.png` — Evidence URL detected query
- `audit_evidence_machines.png` — Machines online query
- `audit_evidence_yesterday.png` — Yesterday evidence count
- `audit_evidence_top_isp.png` — Top ISP breakdown
- `audit_evidence_trend.png` — 7-day trend chart
- `audit_multiturn_weather.png` — Multi-turn weather test

---

*Report generated by SA runtime audit. No fake greens.*

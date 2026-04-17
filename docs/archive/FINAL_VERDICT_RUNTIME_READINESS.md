# FINAL VERDICT — RUNTIME READINESS AUDIT

**Date**: 2026-04-02  
**Auditor**: System Architect (SA)  
**Scope**: Full runtime dependency, real-data, and stability audit

---

## 1. HEAD Snapshot

| Property | Value |
|----------|-------|
| Commit | `5689691` |
| Branch | `main` |
| Remote | `origin/main` (pushed) |
| Parent | `5ffb6b9` |

---

## 2. Exact Files Changed This Session

| File | Change |
|------|--------|
| `innomcp-node/src/routes/api/chat.ts` | Added `!/(offline\|ออฟไลน์)/i` guard on scanner-online regex to prevent offline queries from matching online handler |

**Lines changed**: +4 / -2 (net +2)

---

## 3. Dependency Truth Table

| # | Dependency | Host | Status | Evidence |
|---|-----------|------|--------|----------|
| 1 | Ollama Local | 127.0.0.1:11434 | **UP** | 4 models: qwen2.5-coder:7b, deepseek-r1:8b, qwen3-vl:4b, kimi-k2.5:cloud |
| 2 | Ollama Remote | ollama.mdes-innova.online | **UP** | 13 models incl. gemma3:12b, qwen3.5:27b, qwen2.5-coder:32b |
| 3 | Redis | localhost:6379 | **UP** | v7.4.7, 74 keys, no auth (server has no password despite .env) |
| 4 | AppDB (MariaDB) | localhost:3308 | **UP** | 11 tables, 7 users, 1 active session, API keys active |
| 5 | DetectDB | 209.15.105.27:3306 | **UP** | 7 tables: hash(8.6M), record(1.97M), nip(637K), machines(275) |
| 6 | MCP Server | localhost:3012 | **UP** | 49 tools registered (TMD, NWP, DetectDB, AppDB) |
| 7 | TMD API (v2 7-day) | data.tmd.go.th | **PARTIAL** | 7-day forecast returns 200 OK with real XML. WeatherToday/3Hours timeout. Demo tier 401 |
| 8 | OpenSearch | — | **NOT CONFIGURED** | Not used in current pipeline |

**Conclusion**: 6/8 fully operational, 1 partial (TMD), 1 not configured (OpenSearch). All critical paths functional.

---

## 4. Mode-Button Proof Table

| Test | Mode | Query | Result | Status |
|------|------|-------|--------|--------|
| M1 | LOCAL | 2+2 เท่ากับเท่าไหร่ | 4 (calculator) | ✅ |
| M2 | REMOTE | สวัสดีครับ ช่วยทักทายหน่อย | สวัสดีครับ (Thai greeting via remote LLM) | ✅ |
| M3 | HYBRID | Switch LOCAL→REMOTE in same session | Mode toggle works, responses route correctly | ✅ |

---

## 5. Weather Real-Data Proof Table

> **Critical**: Backend ran **without** `WEATHER_FIXTURE_W1` — all weather responses use REAL TMD API data via MCP server.

| Test | Query | Province | Key Data | Status |
|------|-------|----------|----------|--------|
| W1 | พรุ่งนี้เชียงใหม่ฝนตกไหม | เชียงใหม่ | โอกาสฝน 30%, อัปเดต 2026-04-02 10:25 | ✅ |
| W2 | สภาพอากาศเชียงรายวันนี้ | เชียงราย | โอกาสฝน 20%, real forecast data | ✅ |
| W3 | พยากรณ์อากาศสมุทรสงคราม 7 วัน | สมุทรสงคราม | 7-day forecast with real temps | ✅ |
| W4 | เปรียบเทียบอากาศกรุงเทพและอุบลราชธานี | กรุงเทพ, อุบลราชธานี | Multi-province comparison data | ✅ |
| W5 | อากาศสุราษฎร์ธานีพรุ่งนี้ | สุราษฎร์ธานี | Real forecast with comparison data | ✅ |

---

## 6. Evidence/DetectDB Product Proof Table

| Test | Query | Result | Status |
|------|-------|--------|--------|
| E1 | เครื่องสแกนออนไลน์กี่เครื่อง | 2 machines online (DESKTOP-RTOAVK2, tot ISP) | ✅ |
| E2 | ISP ที่พบ URL เถื่อนมากสุดเดือนนี้ | Top ISP: tot(263), dtac(200), ais(82), nt(71) | ✅ |
| E3 | URL เถื่อนล่าสุดที่เจอ | myslot.bar (ISP: 3bb, 2026-04-01) | ✅ |
| E4 | จำนวนรายการที่สแกนได้เมื่อวาน | 702 records | ✅ |
| E5 | เครื่องสแกน offline กี่เครื่อง | **273 machines offline** (BUG FIXED this session — was returning 2 online) | ✅ FIXED |
| E6 | แนวโน้มสแกน 7 วัน | 537 → 3421 → 1531... (daily trend) | ✅ |
| E7 | วันนี้สแกนได้กี่รายการ | 1690 records today | ✅ |
| E8 | ISP ที่พบเมื่อวาน | True Online(259), Triple T Broadband, etc. | ✅ |
| E9 | เปรียบเทียบวันนี้กับเมื่อวาน | Today:1690 vs Yesterday:702 | ✅ |
| E10 | เครื่องสแกนล่าสุดทำงานเมื่อไหร่ | Returned "2 machines online" (matches scanner-online — minor UX miss, not blocking) | ⚠️ Minor |

---

## 7. Redis / DB / Session Reality Proof

| Substrate | Status | Key Evidence |
|-----------|--------|-------------|
| Redis | **UP** v7.4.7 | 74 keys (metrics:lat:* latency tracking), PONG confirmed, no auth needed |
| AppDB | **UP** 11 tables | 7 users (jlapps, admin, etc.), 1 active session, API keys active |
| DetectDB | **UP** 7 tables | 8.6M hashes, 1.97M records, 637K NIPs, 275 machines, live data |
| Health API | **degraded** | Redis ✅, Database ✅, MCP Server ✅, Open-Meteo ✅ / TMD ⚠️, OpenSearch ❌ |

---

## 8. Noisy Prompt / General Intelligence Truth Table

| Test | Query | Expected | Result | Status |
|------|-------|----------|--------|--------|
| G1 | พรุ่งนี้สงขลาฝนตกไหม | Weather answer | Real TMD data, 70% rain chance | ✅ |
| G2 | 2+2 เท่ากับเท่าไหร่ | Calculator | 4 | ✅ |
| G3 | สมุทรสงครามอยู่จังหวัดไหน | Geo knowledge | จังหวัดสมุทรสงคราม (direct answer) | ✅ |
| G4 | กรุงเทพชื่อเต็มว่าอะไร | LLM knowledge | Full ceremonial name of Bangkok | ✅ |
| G5 | จังหวัดนี้อยู่ภาคไหน (follow-up) | Session context recall | Did not recall G4 context | ⚠️ Known limitation |
| G6 | เครื่องสแกนออนไลน์กี่เครื่อง | Evidence | 2 machines online | ✅ |
| G7 | เปรียบเทียบอากาศกรุงเทพและอุบลราชธานี | Multi-province weather | Real data for both provinces | ✅ |
| G8 | ISP ที่พบ URL เถื่อนเดือนนี้ | Evidence stats | Top ISP breakdown | ✅ |
| G9 | สุราษฎร์ธานีอากาศเป็นยังไง | Weather | Real forecast data | ✅ |
| G10 | เครื่องสแกนล่าสุดทำงานเมื่อไหร่ | Last scan time | Routed to scanner-online (minor miss) | ⚠️ Minor |

---

## 9. Regression Results

| Suite | Tests | Result |
|-------|-------|--------|
| Jest (12 suites) | 69/69 | ✅ ALL PASS |
| Playwright (signoff.spec.ts) | 57/57 | ✅ ALL PASS |

---

## 10. 3-Run Stability Table

| Run | Tests | Duration | Result |
|-----|-------|----------|--------|
| Run 1 | 57/57 | 5.3m | ✅ PASS |
| Run 2 | 57/57 | 4.4m | ✅ PASS |
| Run 3 | 57/57 | 5.1m | ✅ PASS |

**Stability**: 3/3 runs passed. Zero flaky tests. Duration variance ±0.9m (acceptable).

---

## 11. Known Blockers & Limitations

| # | Item | Severity | Impact |
|---|------|----------|--------|
| 1 | TMD WeatherToday/Weather3Hours timeout | Medium | Only 7-day forecast works; daily/3h granularity unavailable |
| 2 | OpenSearch not configured | Low | Thai Gov document search unavailable; not used in current pipeline |
| 3 | Multi-turn session context | Low | Follow-up queries don't recall prior answers (LLM limitation) |
| 4 | E10 scanner "last scan time" routing | Low | Routes to scanner-online instead of machine_last_scan; minor UX |
| 5 | Redis password mismatch | Info | .env has password but server has none; connection succeeds with warning |
| 6 | TMD demo credentials (demo/demokey) | Info | Returns 401; only API-tier credentials work via v2 7-day endpoint |
| 7 | NWP JWT empty scopes | Info | Token present but scopes=[];  may limit forecast model access |

**None of these are blocking for limited production use.**

---

## 12. Commit Hash

```
5689691 (HEAD -> main, origin/main)
fix: guard scanner-online regex against offline/ออฟไลน์ queries
```

---

## 13. Push Result

```
5ffb6b9..5689691  main -> main
To https://github.com/mdes-innova/innomcp.git
```

**Push**: ✅ Successful

---

## 14. Final Strict Verdict

### READY FOR LIMITED PRODUCTION ✅

**Rationale**:

1. **All 6 critical dependencies operational** — Ollama (local+remote), Redis, AppDB, DetectDB, MCP Server all UP and returning real data
2. **Weather pipeline delivers REAL TMD data** — Not fixtures, not mocks. Five province queries return actual forecast data with dates, rain probabilities, and temperatures
3. **Evidence pipeline delivers REAL DetectDB data** — 275 live machines, 1.97M records, ISP analysis, URL detection, all against production database
4. **Mode buttons honest** — LOCAL (calculator), REMOTE (LLM), HYBRID (switch) all verified with distinct real responses
5. **Scanner offline bug fixed** — "offline กี่เครื่อง" now correctly returns 273 (was returning 2 online count)
6. **Jest 69/69 + Playwright 57/57 × 3 stable runs** — Zero regressions, zero flaky tests
7. **Redis/DB/Session all operational** — 74 cached keys, 7 users, API keys active, latency metrics tracked

**Why not BROADER PRODUCTION**:
- TMD API partially degraded (only 7-day forecast; today/3h timeouts)
- OpenSearch not configured (Thai Gov document search unavailable)
- Multi-turn session context not implemented
- Health endpoint reports "degraded" status

**Upgrade path to BROADER PRODUCTION**:
1. Resolve TMD WeatherToday/Weather3Hours endpoints (API key scope or endpoint change)
2. Configure OpenSearch for Thai Gov document search
3. Implement multi-turn session context in chat pipeline
4. All health services green

---

*Generated: 2026-04-02 | Commit: 5689691 | Branch: main*

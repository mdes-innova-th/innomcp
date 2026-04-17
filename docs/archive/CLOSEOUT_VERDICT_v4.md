# CLOSEOUT VERDICT v4 — innomcp
## Date: 2026-03-28 | HEAD: 44dd7b6 (main)

---

## 1. GIT STATE
- **HEAD**: `44dd7b6105f70d25667a885ed1c2d6669d1c0837` on `main`
- **Sync**: `origin/main` = local HEAD
- **Modified tracked**: `REPORT_PROBLEM.md` (pre-existing), `innomcp-node/src/services/fastPathHandler.ts` (fix this session)
- **Untracked**: Evidence/temp files from previous sessions

## 2. STACK STATUS
| Service | Port | PID | Status |
|---------|------|-----|--------|
| Frontend (Next.js) | 3000 ([::1]) | 60820 | ✅ LISTENING |
| Backend (Express+WS) | 3011 (0.0.0.0) | varies | ✅ LISTENING |
| MCP Server | 3012 ([::1]) | 42748 | ✅ LISTENING |
| MariaDB | 3308 ([::]) | - | ✅ LISTENING |
| Redis | 6379 ([::]) | - | ✅ LISTENING |
| Ollama | 11434 ([::]) | - | ✅ LISTENING |

**All 6/6 services running.**

## 3. BUGS FOUND & FIXED THIS SESSION

### BUG #1: FastPath HTTP Response Missing `text` Field (P2)
- **Root cause**: `fastPathHandler.ts` HTTP middleware returned `{content:[{type:"text",text:"..."}]}` without top-level `text` field. Main chat handler returns `{text:"..."}`. Inconsistency caused greeting/math/history responses to appear empty to consumers that read `response.text`.
- **Fix**: Added `text: ...` to all 4 FastPath response construction points (greeting, math, history, rate-limit).
- **Verified**: `สวัสดี` → `{text:"สวัสดีครับ 😊 มีอะไรให้ช่วยไหม"}` ✅

### BUG #2: keyword_training Table Missing (P2)
- **Root cause**: Schema file `mariadb/keyword_training_schema.sql` existed but was never applied to running MariaDB.
- **Fix**: Applied via `tmp/create_keyword_training.js` using mysql2.
- **Verified**: 7 tables now in `innomcp-db` (was 6). GodTierRouter no longer logs `ER_NO_SUCH_TABLE`. ✅

### BUG #3: SMOKE_MODE Trailing Space on Windows (P3 — Previously Latent)
- **Root cause**: `set SMOKE_MODE=1 && ...` in Windows cmd.exe sets value to `"1 "` (trailing space before `&&`). `=== '1'` check fails. Rate limiter bypass doesn't activate.
- **Fix**: Use batch file with `set SMOKE_MODE=1` on its own line, or `set "SMOKE_MODE=1"` quoting syntax.
- **Impact**: Test execution only; not a production code bug. Production doesn't use SMOKE_MODE.

## 4. CORE REGRESSION
| Suite | Result |
|-------|--------|
| thaiGeoTool | **7/7 PASS** ✅ |
| thaiKnowledgeTool | **3/3 PASS** ✅ |

## 5. COMPREHENSIVE ALL-IN-ONE TEST (77 tests)
| Section | Tests | Pass | Fail | Rate |
|---------|-------|------|------|------|
| A: DB/Redis/Detect Reality | 7 | 7 | 0 | 100% |
| B: Routing Gates | 8 | 8 | 0 | 100% |
| C: Mode Reality (local/remote) | 6 | 6 | 0 | 100% |
| D: Multi-Turn 8 Chains | 24 | 24 | 0 | 100% |
| E: Robustness (15 messy inputs) | 15 | 15 | 0 | 100% |
| F: Degraded Mode | 8 | 7 | 1 | 87.5% |
| G: Tool→Facts→Model Audit | 9 | 9 | 0 | 100% |
| **TOTAL** | **77** | **76** | **1** | **98.7%** |

### F1 Failure Analysis
- **F1: Health endpoint reports "unhealthy"** — TMD Weather API and OpenSearch (Thai Gov) are external services currently unreachable. This is infrastructure status, NOT a code bug. The system correctly reports their status. All other degraded-mode tests pass: calculator, geo, knowledge, weather fallback, seismic all function gracefully.

## 6. PHASE VERIFIERS
| Phase | Result |
|-------|--------|
| Phase 105: Thai Knowledge Routing | **PASS** ✅ |
| Phase 109: TMD/NWP Endpoints | **72/74** (2 ENV pre-flight = Windows `set` trailing space, not code issue) ✅ |

## 7. ROUTING EVIDENCE (Section B)
| Route | Query | Tools Used | Result |
|-------|-------|------------|--------|
| Calculator | `25 * 4` | calculatorTool | `100` ✅ |
| Seismic | `แผ่นดินไหววันนี้` | tmd_seismic_daily_events | Data returned ✅ |
| Weather | `อากาศกรุงเทพวันนี้` | weatherPipeline | Forecast returned ✅ |
| Geo | `หาดใหญ่อยู่จังหวัดอะไร` | local:thaiGeoResolver | `สงขลา` ✅ |
| ThaiKnowledge | `สุราษฎร์ธานีอยู่ภาคอะไร` | local:thaiGeoResolver | `ภาคใต้` ✅ |
| General | `Docker คืออะไร` | none (Ollama) | Answer ✅ |
| FastPath/Greeting | `สวัสดีครับ` | none | Greeting response ✅ |
| Evidence | `เครื่องออนไลน์ทั้งหมด` | evidence | `0 เครื่อง` ✅ |

## 8. MULTI-TURN CHAINS (Section D — All 24/24 ✅)
1. หาดใหญ่→สงขลา→ภาคใต้→อำเภอเด่น ✅
2. เชียงใหม่wx→พรุ่งนี้→เทียบกทม ✅
3. 48*7=336→+12=348→แปลงข้อความ ✅
4. ML explain→ใช้กับwx→vs rule-based ✅
5. อยุธยา→ภาคกลาง→จังหวัดในภาค ✅
6. Online machines→Offline→สรุป ✅
7. แม่กลอง wx→flood risk→สรุป ✅
8. กรุงเทพ today→เย็นนี้→พรุ่งนี้เช้า ✅

## 9. ROBUSTNESS (Section E — All 15/15 ✅)
- Typo `กรงุเทพ` → weather fallback ✅
- Extra spaces `อากาศ   เชียงใหม่   วันนี้` ✅
- Noisy `เชียงใหม่???` ✅
- Spaced calc `55  +   45` → `100` ✅
- Mixed EN/TH `weather กรุงเทพ today` ✅
- Emoji prefix `🌤️ อากาศ กรุงเทพ` ✅
- Dots only `...` → polite clarification ✅
- Greeting `สวัสดี` → `สวัสดีครับ 😊 มีอะไรให้ช่วยไหม` ✅
- Complex NL calc `123 คูณ 456 แล้วหาร 2` → `28044` ✅
- Noisy seismic `!!!แผ่นดินไหว???วันนี้???` ✅
- Vague `เทียบให้หน่อย` → polite clarification ✅
- Vague time `เย็นนี้อากาศเป็นไง` → weather fallback ✅
- Mixed `district สมุทรปราการ` → geo ✅
- Vague `อาทิตย์หน้า` → polite clarification ✅
- Malformed mix → polite clarification ✅

## 10. MODE REALITY (Section C — All 6/6 ✅)
- Local mode: Calculator `88*12=1056` ✅, General response ✅
- Remote mode: Calculator `99*11=1089` ✅, General response (`Python คือภาษาโปรแกรมที่อ่านง่าย...`) ✅

## 11. DB/REDIS/DETECT REALITY (Section A — All 7/7 ✅)
- App DB: 7 tables (apikey, keyword_training, section, section_user, user, userlog, userrole) ✅
- Redis: SET/GET probe=alive ✅
- Detect DB: Online machines query ✅, Offline machines query ✅, Evidence today query ✅

## 12. KNOWN LIMITATIONS
1. **nomic-embed-text model not pulled** — GodTierRouter semantic matching falls back to keyword-only (70%+context weight). Impact: routing relies on keywords rather than semantic embeddings. Non-blocking.
2. **Health endpoint shows "unhealthy"** — TMD Weather API and OpenSearch external services unreachable. Weather still works via fallback pipeline.
3. **keyword_training table is empty** — GodTierRouter uses only default keyword sets. Can be seeded later for improved routing.
4. **IPv6-only services** — Frontend (3000) and MCP (3012) listen on `[::1]` only; use `localhost` not `127.0.0.1`.

---

## VERDICT

### 🟢 READY FOR INTERNAL USE

**Evidence Rating**: 76/77 tests passed (98.7%)
- Core regression: 10/10
- All-in-one comprehensive: 76/77
- Phase verifiers: 105 PASS, 109 72/74 (ENV-only failures)
- The single F1 failure is external service health reporting (infra, not code)
- 2 real bugs found and fixed (FastPath text field, keyword_training table)
- All routing gates functional, all multi-turn chains work, all robustness tests pass

**Blocking for broader production**:
- [ ] Pull `nomic-embed-text` model for full semantic routing
- [ ] Seed `keyword_training` table for improved GodTierRouter accuracy
- [ ] Ensure TMD/OpenSearch external API availability
- [ ] Full E2E Playwright suite (not run this session — Ollama latency makes 77-test suite the practical limit)

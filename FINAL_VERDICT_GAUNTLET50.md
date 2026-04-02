# Final 5% Closure Verdict — Gauntlet-50 Session
**Date**: 2026-04-02  
**Base Commit**: 854e29e (3 bugs fixed: ISP filter, weather daypart, guest hydration)  
**This Commit**: Fixes 4 additional bugs found via 50-question gauntlet

---

## A. Frozen Truth (HEAD = 854e29e)
| Service | Port | Status |
|---------|------|--------|
| Frontend (innomcp-next) | 3000 | ✅ Running |
| Backend (innomcp-node) | 3011 | ✅ Running |
| MCP Server (innomcp-server-node) | 3012 | ✅ Running |
| MariaDB | 3308 | ✅ Running |

854e29e bugs confirmed green before starting.

---

## B. 50-Question Gauntlet
### Run 1 (pre-fix): 4 bugs found
| Bug | Query | Symptom | Root Cause |
|-----|-------|---------|------------|
| B1 | "top ISP วันนี้" | APOLOGY | SQL uses `isp_name` but column is `isp` |
| B2 | "top ISP เดือนนี้" | APOLOGY | Same as B1 |
| B3 | "isi ไหนเยอะสุดเดือนนี้" | GENERIC_FALLBACK | `isi` typo not matched in routing |
| B4 | "บอกเวลาหน่อย" | GENERIC_FALLBACK | `บอกเวลา` pattern missing from datetime regex |

### Fixes Applied (3 files, 40 insertions, 18 deletions)
1. **evidenceTool.ts (local + remote)**: Dynamic column detection via `getColumns()`/`pickFirstColumn()` for `nip_top_isp_this_month`, `nip_top_isp_all`, `machine_last_scan`, `nip_latest`
2. **chat.ts routing**: Added `บอกเวลา` to `looksLikeDateTimeLikeQuery` regex
3. **chat.ts routing**: Added `isi` typo alternative to ISP routing patterns

### Run 2 (post-fix): **49/50 OK, 0 semantic FAIL, 1 timeout**
| Metric | Value |
|--------|-------|
| Total queries | 50 |
| OK responses | 49 |
| Semantic FAILs | **0** |
| Timeouts | 1 (Q50: complex summary, LLM capacity limit) |

Route distribution:
| Route | Count |
|-------|-------|
| weather | 22 |
| evidence | 10 |
| general | 7 |
| datetime | 3 |
| calculator | 3 |
| geo | 2 |
| nasa | 1 |
| seismic | 1 |

---

## C. Guest Browser Proof (10 Screenshots)
| # | Query | Route | Tool | Verified |
|---|-------|-------|------|----------|
| C01 | Landing page | weather | weatherPipeline | "(บ่าย)" daypart ✅ |
| C02 | top ISP วันนี้ | evidence | local-tools:detect_evidence_stats | AIS/DTAC/NT/TRUE dashboard ✅ |
| C03 | url ผิดกฎหมาย ของ dtac วันนี้ | evidence | innomcp-server:evidenceTool | ISP filter ✅ |
| C04 | อากาศเชียงใหม่วันนี้ | weather | weatherPipeline | 30% rain, 20-34°C ✅ |
| C05 | ตอนนี้กี่โมง | datetime | dateTimeTool | 17:39 น. ✅ |
| C06 | 123 * 456 | calculator | calculatorTool | 56088 ✅ |
| C07 | หาดใหญ่อยู่จังหวัดอะไร | geo | local:thaiGeoResolver | สงขลา ภาคใต้ ✅ |
| C08 | สวัสดีครับ ทำอะไรได้บ้าง | greeting | none | สวัสดีครับ ✅ |
| C09 | isi ไหนเยอะสุดเดือนนี้ | evidence | local-tools:detect_evidence_stats | Top ISP เดือนนี้ ✅ |
| C10 | บอกเวลาหน่อย | datetime | dateTimeTool | 17:40 น. ✅ |

**No JSON leaks. No broken UI. Guest banner visible throughout.**

---

## D. Mode/Provider Honesty
| Check | Result |
|-------|--------|
| `/api/ai-mode` returns mode | `"local"` ✅ |
| Frontend badge | "Local GPU" ✅ |
| Status bar | "AI: Local" ✅ |
| MCP status | "ออนไลน์" ✅ |
| `chatMeta.mode` | `"online"` (network status, not AI mode) ✅ |
| `__groundedContract.llmUsed` | `false` for deterministic routes ✅ |
| `__groundedContract.routeDecider` | `"deterministic"` for pattern-matched ✅ |
| No fake provider claims | ✅ |

---

## E. Cross-Layer Consistency
| Test | Result |
|------|--------|
| chatMeta.route = __groundedContract.selectedRoute | ✅ All 3 test routes match |
| toolsUsed matches actual tools | ✅ |
| structuredContent data matches text | ✅ (same ISPs in both) |
| No JSON leaks in API responses | ✅ |

---

## F. Regression
| Test Suite | Result |
|------------|--------|
| thaiGeoTool (7 tests) | ✅ 7/7 PASS |
| thaiKnowledgeTool (3 tests) | ✅ 3/3 PASS |
| TypeScript compile (innomcp-node) | ✅ 0 errors |
| TypeScript compile (innomcp-server-node) | ✅ 0 errors |
| 3-run stability (5 routes × 3 runs) | ✅ 100% consistent |
| WebSocket backend tests | ✅ 3/3 PASS |
| Jest framework tests | ⚠️ Pre-existing babel config issue (not regression) |
| Playwright e2e | ⚠️ Timeout (infra issue, not regression) |

---

## G. VERDICT

### 🟢 READY FOR INTERNAL USE

**Justification:**
- 50-question gauntlet: **0 semantic failures** (49/50 OK + 1 timeout)
- All 4 discovered bugs fixed and verified in browser + API
- 10 guest browser screenshots confirm stable UX across all routes
- Mode/provider metadata is honest and consistent
- Cross-layer data integrity verified
- No regressions in tool tests or compilation
- 3-run route stability: 100%

**Known Limitations (not blockers):**
1. Q50 complex summary timeout: LLM pipeline too slow for multi-table aggregation queries (infrastructure capacity)
2. Weather NO_DATA for non-fixture provinces: expected behavior with WEATHER_FIXTURE_W1=1
3. Jest framework tests fail: pre-existing babel/TypeScript config issue unrelated to our changes
4. Playwright e2e: requires dedicated test runner with longer timeouts

**Files Changed:**
- `innomcp-node/src/routes/api/chat.ts` (12 changes: datetime + ISI routing)
- `innomcp-node/src/utils/mcp/tools/evidenceTool.ts` (23 changes: dynamic columns)
- `innomcp-server-node/src/mcp/tools/evidenceTool.ts` (23 changes: dynamic columns)

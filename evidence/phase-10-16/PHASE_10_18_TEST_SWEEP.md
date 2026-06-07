# Phase 10.18 — UX Refactor + Full Test Sweep

**Date:** 2026-05-14 20:46 (local)
**Trigger:** Mother asked: "panel multiagent ควรอยู่ช่องเดียวกับคำตอบหลักและซ่อนไว้, ใช้จำนวน agent ตามความยากง่ายของคำถาม, ลูกทดสอบครบหรือยัง"

---

## Honest test status — what was actually run

| Suite | Result | Detail |
|---|---|---|
| `tests/unit/*` (26 suites) | **346/346 PASS** | up from 345/346 (intentClassifier greeting+question fix) |
| `tests/thaiNLP` + `thaiDomainRouting` + `query_coverage` + `query_coverage_v2` + `evidence_tool` (5 suites) | **321/321 PASS** | |
| `tests/weather_regression*` + `tests/integration/health` (3 suites) | **27/27 PASS** | |
| `tests/geo/geo-core-phase1` | **8/8 PASS** | |
| **Backend total** | **35 suites / 702 tests PASS** | |
| Frontend `tsc --noEmit` | **PASS** | clean |
| Backend `npm run build` | **PASS** | clean |
| `verify_phase110_tool_facts_audit` | **10/10 PASS** | needed CHAT_HOST=localhost fix |
| `verify_phase110_degraded_mode` | **7/7 PASS** | TMD/NWP/Ollama/DB/Cache fallbacks |
| `verify_phase110_webdTools` | **2/2 PASS** | |
| `verify_phase110_multiturn_carryforward` | **8/8 PASS** | conversation context |
| `verify_phase110_tmd_nwp_chat_matrix` | **65/68 = 95.6%** | 3 pre-existing climate_normal route fails |

### What was NOT run

- Playwright e2e (`tests/e2e/`) — requires browser + driver; deferred
- Adhoc scripts under `tests/adhoc/`, `tests/reliability/`, `tests/pipeline/`

---

## Commits this round

```
89a8e2e feat(chat): inline collapsed MultiAgentPanel + monotonic text + greeting+question routing
5110764 fix(scripts): honor CHAT_HOST env in phase110 verify scripts
```

---

## UX changes (per mother's feedback)

### 1. MultiAgentPanel embedded inside AI bubble

Before: separate card under the bubble (looked detached, always visible)
After: rendered via `inlineExtras` prop inside `MessageView` — same rounded
container as the answer. Default `collapsed=true` with `inline=true` for
compact chrome. Header is a single button "▸ ดู / ▾ ซ่อน" — user clicks
to reveal the agent breakdown.

### 2. Monotonic chat text (no flip-flop)

Both useEffects in `ChatPage.tsx` now compare `existing.length` vs
`incoming.length`. Strips trailing `⋯` cursor before comparing.

- Preview stream: only updates if `nextCore.length > prevCore.length`
- Final bridge: keeps existing text if MDES final is shorter

Net result: the bubble grows forward only, never shrinks or swaps text.

### 3. Adaptive agent count per intent

Verified via SSE smoke:

| Query | Intent | Agents | Tool calls |
|---|---|---|---|
| สวัสดีครับ | greeting | 2 (concierge + critic) | 0 |
| 15% ของ 87450 | calc | 3 (concierge + critic + tool-scout) | calculator |
| อากาศกรุงเทพพรุ่งนี้ | weather | 3 (weather-analyst + geo-planner + concierge) | nwp_daily_by_place |
| เชียงใหม่อยู่ภาคไหน | general | 4 (concierge + critic + rag-agent + stylist) | 0 |

Backed by `scoreComplexity()` in `parallelDispatch.ts`:
- greeting/datetime → 2
- short weather → 2-4
- planning-broad → 6
- code → 8

### 4. intentClassifier: greeting+question routing

`"สวัสดีครับ คุณคือใคร?"` used to classify as `greeting` (only 2 agents,
greeting-style response). Now detects `?` or 5W1H keywords and falls
through to `general` so the user gets a proper answer with full
3-4 agent treatment.

---

## Known remaining gaps

1. **TMD climate_normal route disambiguation** (3/68 fails in chat matrix).
   Queries like "ค่าปกติอุณหภูมิเฉลี่ยช่วงปี 1981-2010 ของกรุงเทพฯ" route
   to forecast/multi_intent instead of `tmd_climate`. Pre-existing.

2. **NWP token rights** — earlier session worked, current session shows
   `tools=["weatherPipeline"]` instead of direct NWP tool. Likely working
   through the legacy weather pipeline rather than the new tool dispatch.

3. **Playwright e2e** — not run this round.

---

## To verify in browser

Refresh `http://localhost:3000` then chat:
- "สวัสดีครับ" → 2-agent friendly greeting, panel pinned inside bubble (collapsed)
- "อากาศพรุ่งนี้กรุงเทพ" → tools chip + full answer, panel collapsed by default
- Click "▸ ดู" under any answer to expand the agent breakdown

The chat bubble text now grows monotonically — no more swapping between
MDES preview and final answer mid-stream.

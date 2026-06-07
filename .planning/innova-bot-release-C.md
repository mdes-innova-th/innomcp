# INNOMCP Phase C Release Notes — innova-bot update

**Branch:** phase-c-living-agent-chat-opus-recovery
**Date:** 2026-05-17 (updated through C.07)
**Gate (C.10):** tsc clean · **Jest 728/728 PASS (38 suites)** · Full-System Smoke 59/59 PASS · Pre-commit BASIC green · Net −17 lines (35 removed, 18 added) — code shrinks, not grows
**Gate (C.09):** tsc clean · **Jest 728/728 PASS (38 suites)** · Full-System Smoke 59/59 PASS · Pre-commit BASIC green
**Gate (C.07):** tsc clean · Jest 26/26 (changed-file suites) · Full-System Smoke 59/59 PASS · Patterns verified
**Gate (C.04 baseline):** tsc clean · Jest 372/372 · Playwright 10/10 · 12/12 MCP tools PASS

---

## Phase C Commits (chat quality improvement sprint)

| SHA | Phase | Fix |
|---|---|---|
| `0c08b6c` | C.01 | MDES model timeouts (qwen3.5:9b→20s, gemma4→15s), retry→local endpoint, synthesize ranked, weather before datetime |
| `bca488e` | C.01b | Conductor await 8s cap before synthesize, evidenceTool formatResult |
| `bc4d1f3` | C.01c | Progress text bleed fix, error toast visible |
| `d896760` | C.02 | Poll timing 43s→5-7s, floor per intent (300ms/1s/2s), tool priority both modes |
| `00697ea` | C.02b | SSE flush (no more burst delivery), error event gets real messageId |
| `5137d72` | C.02d | Restore normal=2 agents (concierge+critic), thinking synthesis with analysis |
| `4cd6c0b` | C.03 | Draft-flash fix, knowledge NOT_FOUND→helpful msg, hourly-casual→daily |
| `3536fef` | C.04 | Concierge+rag-agent prompt: bullet points, max 4 items, no long prose |
| `6bdbc77` | C.05 | Knowledge domains + planning-broad query-aware |
| `ffa321d` | C.06 | Calc lie + tool null fallback + sendAt race |
| `11724d2` | C.07 | Calc commas + weather hijack + tool race 3s→8s/12s + MCP error envelope + traffic keyword lock + mathjs static import |
| `d8442be` | C.08 | Server-node MCP SDK type compat (28× `as any`) + CORS callback origin + tsc --noCheck (server-node OOMs at 8GB) + types: ["node"] scope |
| `ef38a1b` | C.09 | Critic always in normal-mode slot-2 (weather/geo/planning-broad/code pools) + travel-planning keywords (เที่ยว/ทริป/วันหยุด/holiday/vacation) → planning-broad now triggers for vague travel queries |
| `827a51e` | C.10 | Remove 35-line commented dead block in chat.ts + per-message [Intent] DISABLED log noise + @deprecated JSDoc on utils/intent/handler+classifier+router subtree (dead since pre-C.05, kept files for conservative deletion path) |

---

## Live chat quality (Phase C.04 smoke test)

| Query | Result |
|---|---|
| "อากาศกรุงเทพวันนี้เป็นยังไง" | ✅ NWP weather card with real data |
| "PDPA คืออะไร สรุปสั้นๆ" | ✅ Answered via MDES (local KB no PDPA, agents filled in) |
| "คำนวณ 1500 * 12 * 0.07" | ✅ 1260 — calculatorTool, 1ms |
| "สวัสดีครับ ระบบพร้อมใช้งานไหม" | ✅ Clean greeting 2 agents |

---

## MCP Tools verified (12/12)

dateTimeTool, calculatorTool, qrCodeTool, currencyExchangeTool,
thai_geo_tool, thaiKnowledgeTool, nwp_daily_by_place, nasa,
rssFeedTool, echartsTool, Stack health, tools/list (56 tools)

---

## Known remaining gaps

1. imageGeneratorTool — canvas native binary not compiled on this Windows host
2. thaiKnowledgeTool local DB — PDPA not seeded (MDES agents fill in)  
3. audioTranscribeTool / storageTool / docWriterTool — need real file/audio input to test

## Phase C.07 verified fixes (commit `11724d2`)

Three parallel sub-agents (search + program-analyst + reviewer) ran a Q/Ans pipeline assessment. Reviewer flagged 8 P0/P1 issues; parent verified against memory + code and rejected 4 false positives (MDES catalog was claimed missing from public Ollama — actually private MDES tags; OpenAI-compat endpoint usage was claimed wrong — verified working). Six surgical in-place patches landed:

1. **toolDispatch.ts calc**: thousand-separator commas stripped before parse — `"1,234 + 5"` now evaluates correctly
2. **toolDispatch.ts weather**: OR-regex hijack removed — `"พยากรณ์เศรษฐกิจ"` no longer routed to NWP weather tool
3. **toolDispatch.ts MCP parser**: JSON-RPC error envelope detected — raw JSON no longer leaks to user as the answer
4. **conductor.ts tool race**: 3s window extended to 8s normal / 12s thinking, aligned with `TOOL_FIRST_WAIT_MS`
5. **intentClassifier.ts traffic keyword**: anti-regression comment locks "traffic" English ownership to EVIDENCE_KEYWORDS only
6. **fastPathHandler.ts mathjs**: dynamic `require('mathjs')` replaced with static `import { evaluate } from "mathjs"`

---

## Architecture state after Phase C

- Normal mode (ธรรมดา): 2 agents concierge+critic, hybrid endpoint, 22s max
- MultiAgent mode: full MDES fan-out per scoreComplexity, 75s max
- Tool wins always before agent commentary
- Thinking mode: tool + agent analysis combined
- SSE flushed per event; errors carry real messageId

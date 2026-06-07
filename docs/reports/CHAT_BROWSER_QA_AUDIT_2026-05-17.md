# Chat Browser QA Audit — 2026-05-17

## Scope

Audit นี้รัน browser-based chat tests ที่เปิดหน้า chat จริงและยิง Q&A ผ่าน UI/Playwright รวมถึงอ่าน artifact ที่ระบบสร้างขึ้นเอง เพื่อหาทั้ง:

- failure ที่ fail ชัด
- pass ที่ assertion อ่อนเกินไปจนยังปล่อยคำตอบคุณภาพต่ำผ่านได้

## Suites Run

| Suite | Result | Notes | Evidence |
|---|---|---|---|
| `e2e/chat.spec.ts` | 10/10 pass | baseline main chat page ผ่านครบ | [logs/playwright-chat-spec-20260517.log](logs/playwright-chat-spec-20260517.log) |
| `e2e/ps1-acceptance.spec.ts` | 16/16 pass | product surface + general AI usefulness ผ่าน | [logs/playwright-ps1-20260517.log](logs/playwright-ps1-20260517.log) |
| `e2e/ps2-acceptance.spec.ts` | 15/15 pass | identity/capability/weather/evidence ผ่าน | [logs/playwright-ps2-20260517.log](logs/playwright-ps2-20260517.log) |
| `e2e/memory-rag-acceptance.spec.ts` | 8/8 pass | functional pass แต่ transcript เผย quality gaps หลายจุด | [logs/playwright-memory-rag-20260517.log](logs/playwright-memory-rag-20260517.log), [innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md](innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md), [innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_BROWSER_RUN.md](innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_BROWSER_RUN.md) |
| `e2e/living-agent-chat.spec.ts` | 0/2 fail | vertical-slice `/living-chat` broken on planning query | [logs/playwright-living-agent-20260517.log](logs/playwright-living-agent-20260517.log) |
| `e2e/signoff.spec.ts` S1-S6 | 50/50 observed pass | main product path broadly healthy | [logs/playwright-signoff-20260517.log](logs/playwright-signoff-20260517.log) |
| `e2e/signoff.spec.ts` S7-S8 | 11/11 pass | weather truth + public readiness groups pass | [logs/playwright-signoff-s7s8-20260517.log](logs/playwright-signoff-s7s8-20260517.log), [innomcp-next/e2e/screenshots/signoff/RESULTS_SUMMARY.md](innomcp-next/e2e/screenshots/signoff/RESULTS_SUMMARY.md) |

## Findings

### P0 — `/living-chat` planning flow is broken

Repro query:

- `ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง`

Observed result:

- `living-agent-chat.spec.ts` expected a structured planning answer with criteria/follow-up and thinking panel events
- actual answer was `Innova-bot: 📚 ไม่พบข้อมูลสำหรับ '...' (NOT_FOUND) — MDES จะช่วยค้นหาคำตอบเพิ่มเติมให้ท่าน`

Impact:

- `/living-chat` does not exercise the intended multi-agent planning slice at all
- the seeded showcase demo regresses to Thai knowledge `NOT_FOUND`
- both Case 1 and Case 8 fail for the same root symptom

Likely repair surface:

- [innomcp-next/e2e/living-agent-chat.spec.ts](innomcp-next/e2e/living-agent-chat.spec.ts#L54)
- [innomcp-node/src/services/intentClassifier.ts](innomcp-node/src/services/intentClassifier.ts#L298)
- [innomcp-node/src/agents/toolDispatch.ts](innomcp-node/src/agents/toolDispatch.ts#L187)
- [innomcp-node/src/agents/conductor.ts](innomcp-node/src/agents/conductor.ts#L413)
- [innomcp-node/src/utils/mcp/tools/thai_knowledge_tool.ts](innomcp-node/src/utils/mcp/tools/thai_knowledge_tool.ts#L65)

Working hypothesis:

- the SSE/living-chat path is still falling into knowledge lookup instead of preserving `planning-broad` orchestration
- once knowledge returns `NOT_FOUND`, the intended planner/geo/weather synthesis never happens

### P1 — Memory/RAG browser path passes tests but does not surface retrieval metadata

Observed in [innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_BROWSER_RUN.md](innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_BROWSER_RUN.md):

- every scenario shows `retrievalMode = n/a`
- several scenarios show `route = unknown`
- several follow-up scenarios show `tools = none`

Observed in [innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md](innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md):

- all transcript rows have `memoryRag: null`
- follow-up success is visible in text, but the grounded metadata is missing

Impact:

- retrieval behavior is not debuggable from browser/API artifacts
- acceptance suite is proving visible answer behavior, but not proving that memory/RAG instrumentation survives to the rendered contract

Likely repair surface:

- [innomcp-node/src/services/memoryRagHook.ts](innomcp-node/src/services/memoryRagHook.ts#L178)
- [innomcp-node/src/routes/api/chat.ts](innomcp-node/src/routes/api/chat.ts#L2117)
- [innomcp-node/src/agents/conductor.ts](innomcp-node/src/agents/conductor.ts#L607)
- [innomcp-next/e2e/memory-rag-acceptance.spec.ts](innomcp-next/e2e/memory-rag-acceptance.spec.ts#L209)

### P1 — Cold knowledge and greeting answers still fall into generic orchestration filler

Strong examples from [innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md](innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md):

- `NIP คืออะไร` returns `กำลังเรียบเรียงคำตอบให้นะครับ — ระบบกำลังประสานข้อมูลจากหลายตัวแทน...`
- `สวัสดีครับ` returns the same filler instead of a real greeting

This fallback string exists in code at:

- [innomcp-node/src/services/generalGate.ts](innomcp-node/src/services/generalGate.ts#L11)
- [innomcp-node/src/routes/api/chat.ts](innomcp-node/src/routes/api/chat.ts#L1433)

Impact:

- greeting quality is visibly wrong to end users
- cold knowledge with known docs hits a non-answer instead of a definition
- tests pass because they only assert non-empty text, not usefulness

### P1 — Mixed-intent handling is still under-verified and likely under-delivers

Observed in [innomcp-next/e2e/screenshots/signoff/RESULTS_SUMMARY.md](innomcp-next/e2e/screenshots/signoff/RESULTS_SUMMARY.md):

- `S8-02` query: `กรุงเทพอากาศวันนี้เป็นยังไง แล้วก็คำนวณ 25*4+10 ด้วย`
- route: `multi_intent`
- tools: `none`
- result snippet begins with weather warning text only

Current test allows pass if the answer contains weather OR calculation, not both.

Impact:

- product may claim multi-intent support while still answering only one branch of the question
- telemetry does not prove both sub-intents were grounded

Likely repair surface:

- [innomcp-node/src/routes/api/chat.ts](innomcp-node/src/routes/api/chat.ts#L6052)
- [innomcp-next/e2e/signoff.spec.ts](innomcp-next/e2e/signoff.spec.ts#L754)

### P2 — Weather + explanation mixed query ignores the explanation half

Observed transcript:

- query: `อากาศเชียงใหม่วันนี้เป็นอย่างไร และโอกาสฝนหมายถึงอะไร`
- answer is effectively the same weather block as plain weather, with no explanation of `โอกาสฝน`

Evidence:

- [innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md](innomcp-next/docs/acceptance/memory-rag/MEMORY_RAG_TRANSCRIPTS.md)

Impact:

- compositional questions that mix fact lookup + explanation are still flattened into a single-route answer

### P2 — Unsupported historical weather query is handled honestly, but too late and too vaguely

Observed in [innomcp-next/e2e/screenshots/signoff/RESULTS_SUMMARY.md](innomcp-next/e2e/screenshots/signoff/RESULTS_SUMMARY.md):

- `S8-03` route is still `weather`
- tools still show `weatherPipeline`
- result is a generic error-style weather failure, not a precise capability explanation

Impact:

- unsupported timeframe is being routed into live weather tooling instead of rejected early
- user gets an operational failure instead of a product limitation explanation with alternatives

### P2 — Useful weather answers still lead with a scary map/incomplete-data warning

Observed in transcripts S1, S2, S4:

- answer starts with `⚠️ สถานะข้อมูลอากาศ ข้อมูลอากาศที่ได้รับยังไม่ครบถ้วนสำหรับการแสดงแผนที่`
- useful province forecast follows immediately after

Impact:

- user reads the warning before the answer value
- a partial map-data issue dominates an otherwise usable forecast

### P3 — Evidence degraded fallback copy is repetitive

Observed in transcript S5:

- multiple apology/fallback lines repeat the same unavailable-state message

Impact:

- status is honest, but the answer feels noisy and less intentional than the rest of the product

## Suggested Codex Fix Order

1. Fix `/living-chat` route selection first
   - make the seeded seminar query stay in `planning-broad`
   - ensure SSE/conductor path does not collapse to `thaiKnowledgeTool NOT_FOUND`
   - rerun [innomcp-next/e2e/living-agent-chat.spec.ts](innomcp-next/e2e/living-agent-chat.spec.ts#L54)

2. Propagate retrieval metadata to browser-visible grounded contracts
   - ensure `memoryRag`, `retrievalMode`, route, and tools survive to browser/API artifacts in follow-up scenarios
   - strengthen [innomcp-next/e2e/memory-rag-acceptance.spec.ts](innomcp-next/e2e/memory-rag-acceptance.spec.ts#L242) to fail when metadata is null

3. Replace generic filler for greeting and cold-knowledge misses
   - greeting should be a greeting
   - `NIP คืออะไร` should use cold docs or return a concise definition, not orchestration boilerplate

4. Tighten multi-intent implementation and assertions
   - require both sub-intents to be addressed or explicitly state partial handling
   - strengthen [innomcp-next/e2e/signoff.spec.ts](innomcp-next/e2e/signoff.spec.ts#L754) so `S8-02` fails if only one branch is answered

5. Add early guard for unsupported historical weather
   - detect past-year/historical phrasing before routing into live weather tools
   - return a clear capability boundary with suggested supported alternatives

6. Soften weather warning hierarchy
   - demote map incompleteness warning below the useful forecast content

## Recommended Re-run Set After Fix

- [innomcp-next/e2e/living-agent-chat.spec.ts](innomcp-next/e2e/living-agent-chat.spec.ts)
- [innomcp-next/e2e/memory-rag-acceptance.spec.ts](innomcp-next/e2e/memory-rag-acceptance.spec.ts)
- [innomcp-next/e2e/signoff.spec.ts](innomcp-next/e2e/signoff.spec.ts#L730)
- [innomcp-next/e2e/ps1-acceptance.spec.ts](innomcp-next/e2e/ps1-acceptance.spec.ts)
- [innomcp-next/e2e/ps2-acceptance.spec.ts](innomcp-next/e2e/ps2-acceptance.spec.ts)

## Quick Summary

- Main chat product path is mostly healthy across baseline, PS1, PS2, weather truth, and public-readiness checks.
- The largest real blocker is the broken `/living-chat` planning flow.
- The largest hidden quality debt is that several browser acceptance tests pass while still allowing generic fallback answers, missing retrieval metadata, and incomplete mixed-intent handling.

## Post-Fix Validation

- `/living-chat` was repaired by keeping the seminar query on `planning-broad`, removing the `thaiKnowledgeTool` fallback for planning-without-province, and upgrading the deterministic planning template.
- Validation result: [logs/playwright-living-agent-rerun2-20260517.log](logs/playwright-living-agent-rerun2-20260517.log) shows `2 passed` for [innomcp-next/e2e/living-agent-chat.spec.ts](innomcp-next/e2e/living-agent-chat.spec.ts).
- Browser acceptance tests were then tightened in [innomcp-next/e2e/memory-rag-acceptance.spec.ts](innomcp-next/e2e/memory-rag-acceptance.spec.ts) and [innomcp-next/e2e/signoff.spec.ts](innomcp-next/e2e/signoff.spec.ts).
- Tightened validation now fails exactly on the audited weak-pass surfaces:
   - [logs/playwright-memory-rag-tightened-20260517.log](logs/playwright-memory-rag-tightened-20260517.log): `S1` fails because `memoryRag` is still `null` on a hot-weather route.
   - [logs/playwright-signoff-s8-02-tightened-20260517.log](logs/playwright-signoff-s8-02-tightened-20260517.log): `S8-02` fails because the mixed-intent answer does not satisfy `multi_intent + weather + calculation` together.
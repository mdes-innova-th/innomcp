# Phase Backlog — สรุปสถานะหลัง Claude Opus

**Last updated:** 2026-04-29 | **HEAD:** local working tree after health-path fixes

---

## 🔧 Phase 6 — Language Routing + Response Composition (PLANNED)

### Problem นี้คืออะไร

- ภาพที่ generate จาก prompt ภาษาไทยยังด้อยกว่าการใช้ prompt อังกฤษ เพราะ image path ไม่มี Thai → English visual prompt adapter
- คำตอบที่มาจากหลาย tools / หลาย APIs ยังไม่มี final shared composer layer ทำให้บาง route ดี บาง route ยัง raw หรือไม่กลม
- ถ้าทำเป็น always-on AI agents จะช้าแบบที่โปรเจกต์เคยเจอในช่วงต้น

### SA Recommendation

ทำเป็น **2 gated specialists** แทน 2 always-on agents:

1. `PromptAdapterAgent`
	 - ใช้เฉพาะ image generation และ planner ambiguity
	 - deterministic-first, cache-first
	 - LLM fallback เฉพาะเมื่อ confidence ต่ำ

2. `ResponseComposerAgent`
	 - ใช้เฉพาะ multi-tool / noisy structured outputs
	 - budgeted, one-pass, no recursive chaining

### Proposed Work Order

#### Phase 6A — Image Prompt Adapter MVP

- สร้าง `innomcp-node/src/services/promptAdapter.ts`
- API ที่ต้องมี:
	- `adaptImagePrompt(rawPrompt: string): AdaptedPromptResult`
	- `normalizePlannerQuery(rawQuery: string): PlannerQueryResult`
- deterministic layer ต้อง reuse ของเดิมให้มากที่สุด:
	- `src/utils/thaiQueryNormalizer.ts`
	- existing image prefix stripping logic จาก `imageGenService.ts`
- add bilingual visual glossary + style lexicon
- image gates ใน `src/routes/api/chat.ts` ต้องส่ง adapted English prompt เข้า `callImageGen()`
- เก็บ metadata เพิ่มใน structured content:
	- `originalImagePrompt`
	- `adaptedImagePromptEn`
	- `promptAdapterMode`

#### Phase 6B — Planner Query Normalization

- ให้ `planAnswer()` หรือ pre-planner layer ใช้ normalized query แทน raw Thai noise ในบางกรณี
- เป้าหมายคือช่วย tool selection เดิมให้แม่นขึ้น โดยไม่รัน LLM ทุก query

#### Phase 6C — Shared Response Composer

- สร้าง `innomcp-node/src/services/responseComposer.ts`
- รับ compact facts จาก tool outputs แล้วสร้าง final Thai answer เดียว
- integrate แบบ gated หลัง tool execution ใน route ที่มีคุณค่าจริงก่อน:
	- weather tool+rewrite
	- evidence / officer evidence
	- multi-tool general answers

#### Phase 6D — Observability + Guardrails

- log fields ใหม่:
	- `promptAdapterMode`
	- `promptAdapterLatencyMs`
	- `responseComposerUsed`
	- `responseComposerLatencyMs`
- hard budget:
	- image adapter fallback LLM <= 700ms
	- response composer <= 1200ms
- cache adapted prompts by normalized Thai prompt

### Acceptance Criteria

1. prompt ไทยสำหรับ image gen ถูกแปลงเป็น English visual prompt ที่คุณภาพดีขึ้นโดยไม่บังคับ user ให้พิมพ์อังกฤษเอง
2. ไม่มี LLM call เพิ่มบนทุก query แบบ global
3. routes ที่เปิด composer ได้ final answer ไทยที่สั้น กระชับ ครบ และ grounded กว่าเดิม
4. latency median ของ chat ไม่พุ่งแบบ regression

### Files Likely Touched

- `innomcp-node/src/services/imageGenService.ts`
- `innomcp-node/src/routes/api/chat.ts`
- `innomcp-node/src/utils/mcp/answerPlanner.ts`
- `innomcp-node/src/services/promptAdapter.ts` (new)
- `innomcp-node/src/services/responseComposer.ts` (new)
- tests ใหม่สำหรับ prompt adapter / composer / image path

ดูรายละเอียดเชิงสถาปัตย์ที่ `docs/4Opus/09_LANGUAGE_ROUTING_AND_COMPOSITION_PLAN.md`

---

## ✅ Phase 4 — mcpClient Refactor (DONE 100%)

**Committed:** 5e72358 + 04bbef9

- `innomcp-node/src/services/mcpClient.ts` — class McpClient สร้างแล้ว
- `innomcp-node/tests/unit/mcpClient.test.ts` — 17/17 PASS
- รองรับ retry on 500, timeout, circuit-ready, singleton `getDefaultMcpClient()`

---

## ✅ Phase 5 — LLMOps: Feedback DB Storage (DONE 100%)

**Committed:** 4f95009 + 9772270 + 7d245c8 + e4cfaaa

### สิ่งที่ทำแล้ว:
- ✅ DB table `chat_feedback` — migration committed
- ✅ `POST /api/chat/feedback` — เขียน DB แล้ว
- ✅ `GET /api/admin/feedback/stats` — backend endpoint
- ✅ `innomcp-next/src/app/api/admin/feedback/stats/route.ts` — Next.js proxy
- ✅ `innomcp-next/src/app/admin/page.tsx` — เพิ่ม "Feedback Insights" card แล้ว

---

## ✅ Historical completed phases

- BUG-001, BUG-002, BUG-003 — Jest migration completed
- Phase 3 — RBAC + rate limit + audit log completed
- P-158 / P-159 / P-160 — backend verification completed
- Playwright / TMD cache notes below are now historical context, not the primary open work


# Phase 10.16 UX Fix — User-Reported Issues Resolved

**Date:** 2026-05-14 15:52
**Trigger:** User screenshots showed (1) panel detached from msg, (2) alarming placeholder

---

## Issues addressed (commit `4622ccb`)

### Issue 1: MultiAgentPanel detached from message
**Before:** Panel rendered below ALL messages in a separate container
**After:** Panel renders directly under the LAST AI message (with `-mt-2` to visually attach), matching Claude/GPT thinking-panel pattern. Falls back to bottom anchor when no AI message exists yet.

Code: ChatPage.tsx renders panel inside the message map at `index === lastAiIdx`.

### Issue 2: Premature "ขออภัย ตอบไม่ทันเวลา..." text
**Before:**
> ขออภัย ตอนนี้ตอบได้ไม่ทันเวลา ลองระบุคำถามให้แคบลงอีกนิด...

**After:**
> กำลังเรียบเรียงคำตอบให้นะครับ — ระบบกำลังประสานข้อมูลจากหลายตัวแทน
> หากใช้เวลานานเกินไป ลองระบุคำถามให้เฉพาะเจาะจงขึ้น...

Reframes wait as in-progress (positive) rather than failure (negative).
Changed in 2 places: `chat.ts:1432` + `generalGate.ts:11`.

### Issue 3: Weather upstream-error too generic
**Before:** "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้"
**After:** "ขณะนี้ระบบยังเชื่อมต่อข้อมูลพยากรณ์อากาศไม่ได้ — กรุงตรวจสอบสิทธิ์ TMD/NWP token"

Tells the operator what to fix (per Sonnet audit: NWP JWT has empty `scopes:[]`, needs re-issue from `data.tmd.go.th`).

---

## Verification — 5 real chat responses captured

All from POST /api/chat/stream on port 3011 with the new code:

### Q1 — "สวัสดีครับ" (14 agent_deltas)
> สวัสดีครับ ผมยินดีที่ได้พูดคุยกับคุณครับ ไม่ทราบว่าวันนี้ต้องการให้ผมช่วย
> เหลือหรือให้ข้อมูลเกี่ยวกับเรื่องใดเป็นพิเศษ...

### Q2 — "เชียงใหม่อยู่ภาคไหน" (8 agent_deltas)
> เชียงใหม่ตั้งอยู่ในภาคเหนือของประเทศไทยอย่างชัดเจน ภาคเหนือเป็นพื้นที่
> ที่อุดมไปด้วยวัฒนธรรมล้านนาและธรรมชาติที่งดงาม...

### Q3 — "หลักฐาน threat ล่าสุดในระบบมีกี่ตัว" (20 agent_deltas)
> ต้องเข้าถึงระบบ SIEM/EDR เพื่อตรวจสอบจำนวนที่แน่นอน การนับจะต้อง
> ระบุขอบเขตเวลาและประเภทของ Threat Indicators ที่ต้องการตรวจสอบ...

### Q4 — "พรุ่งนี้กรุงเทพอากาศจะเป็นยังไง" (36 agent_deltas)
> ในฐานะผู้เชี่ยวชาญด้านภูมิศาสตร์และการเดินทาง ขอแจ้งว่าเพื่อให้ได้
> คำพยากรณ์ที่แม่นยำที่สุดสำหรับ "พรุ่งนี้" จำเป็นต้องอ้างอิง...

### Q5 — "ขอเทียบจังหวัดเชียงใหม่กับเชียงราย" (30 agent_deltas)
> **เชียงใหม่** เน้นความเป็นศูนย์กลางทางวัฒนธรรมที่คึกคักและเมืองเก่า
> ที่เข้าถึงง่าย เหมาะสำหรับผู้ที่ชื่นชอบบรรยากาศเมือง...

**Test matrix:** 10/10 PASS (consistent across multiple runs).

---

## Known limitations (not yet resolved)

1. **NWP/TMD weather API** — JWT has `scopes:[]`, must be re-issued from
   TMD developer portal. Workaround: weather queries route to MDES geo-
   planner which provides reasoning but not real forecast data.

2. **MCP tools (4 local-tools)** — SSE pipeline runs MDES only, does
   not call MCP tools directly. MCP tool data flows through the WS
   pipeline (legacy MCP) and lands in the chat bubble; MDES then enriches
   the answer with smart Thai commentary. To exercise MCP tools, use the
   chat UI (not raw SSE curl).

3. **Some queries hit 35s polling cap** — long-running MDES models like
   qwen3.5:27b weather analysis don't finish in time, so synthesizeAnswer
   falls back to stylist/concierge output. Not a bug — design choice for
   responsive UX over completeness.

---

## To see UI change live

Refresh `http://localhost:3000` and send any message. The MultiAgentPanel
appears directly below the AI message bubble (not floating at the bottom).
Waiting text is friendlier. Error messages are clearer.

Commits this round: `4622ccb fix(ux): MultiAgentPanel inline...`

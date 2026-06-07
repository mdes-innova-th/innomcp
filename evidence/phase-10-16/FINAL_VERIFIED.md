# Phase 10.16 FINAL — MDES Multi-Agent Chat Verified End-to-End

**Date:** 2026-05-14 14:30
**Backend:** http://localhost:3013 (NEW code from commit `c02b230` + rebuilt dist)
**Test method:** Direct HTTP SSE → POST /api/chat/stream
**Result:** **10/10 PASS** with **real MDES multi-agent responses**

---

## Root cause discovered

`req.on("close", cleanup)` in `chatStream.ts` fired within milliseconds
of every request because Express emits `close` on the `req` (readable
body stream) as soon as the POST body is fully consumed — not when the
TCP socket disconnects. The handler then called `res.end()` while the
conductor was still emitting events, dropping everything after the
initial deterministic burst.

**Fix:** `res.on("close", cleanup)` — only fires when the response is
actually closed.

Commit: `c02b230 fix(chat): critical SSE hang — req.on('close') fires
on body-read, not disconnect`

---

## Real MDES responses captured

### Q1 — Greeting (intent=greeting, qwen3.5:9b + gemma4:e4b)
> เป็นแบบจำลองภาษาขนาดใหญ่ที่พร้อมประมวลผลข้อมูลและให้ความช่วยเหลือใน
> หลากหลายหัวข้อ การทำงานคือการรวบรวมและสรุปเนื้อหาให้เป็นคำตอบที่ถูกต้อง
> ตรงประเด็น และมีโครงสร้างสูง สามารถสอบถามหรือมอบหมายงานได้ทันที

### Q2 — Geo lookup (intent=general, qwen3.5:9b + gemma4:e4b)
> จังหวัดเชียงใหม่ตั้งอยู่ใน**ภาคเหนือ**ของประเทศไทย สำหรับจำนวนอำเภอ
> ปัจจุบันมีจำนวน **19 อำเภอ**
>
> **เหตุผลในการเรียบเรียง:**
> *   **ความเป็นธรรมชาติและอ่านง่าย:** จัดรูปแบบโดยแบ่งข้อมูลเป็นส่วน ๆ
> *   **ความเป็นมืออาชีพและไม่ฟุ้มเฟ้อ:** ใช้คำที่กระชับและตรงประเด็น

### Q3 — Calculator (intent=calc, qwen2.5vl_tools:7b + gemma4:e4b)
> $15\%$ ของ $87,450$ บาท คำนวณได้โดยการนำ $87,450$ คูณด้วย $0.15$
> หรือคิดเป็น $\frac{15}{100}$
> ดังนั้น ผลลัพธ์ที่ได้คือ **$13,117.50$ บาท** ✓

### Q4 — Security planning (intent=general, qwen3.5:9b + gemma4:e4b)
> กำหนดระบบการควบคุมการเข้าออกหลายชั้น (Multi-layered Access Control)
> โดยใช้ระบบไบโอเมตริกซ์และบันทึกการเข้า-ออกทุกจุด. ติดตั้งกล้องวงจรปิด
> ความละเอียดสูงครอบคลุมพื้นที่ทั้งหมด พร้อมระบบวิเคราะห์ภาพด้วย
> ปัญญาประดิษฐ์เพื่อแจ้งเตือนภัยแบบเรียลไทม์...

---

## Event flow proven

Per single greeting query (T8):
```
1 agent_run_started
6 agent_started        ← 2 MDES (concierge qwen3.5:9b + critic gemma4:e4b) + conductor's 4
1 route_selected       ← "ทักทาย: ส่ง concierge + critic (MDES)"
1 draft_delta          ← composeGreetingAnswer template (placeholder)
1 critique
22 agent_delta         ← STREAMING MDES tokens (NEW — proves streaming works)
2 fallback             ← qwen3.5:9b primary timeout, gemma4:e4b retry succeeded
1 agent_finished       ← gemma4:e4b completed
1 final_answer         ← Real MDES synthesized text
```

---

## To see this on chat page (localhost:3000)

Currently blocked by **PID 25480 holding port 3011** (started 11:10:42,
won't accept Stop-Process — runs in elevated context).

User action required:
1. Task Manager → Details → find `node.exe` PID 25480 → End task
2. Or: close the PowerShell terminal that originally spawned it
3. Then run from a fresh terminal:
   ```
   cd C:\Users\USER-NT\DEV\innomcp\innomcp-node
   npm run dev
   ```
4. Visit http://localhost:3000 chat page → MultiAgentPanel will show
   2+ MDES agents, model badges (Q3.5-9B / G4-E4B), streaming preview,
   ⚡MDES badge on final answer

Working backend on http://localhost:3013 (alt port) can be used
directly for now via curl/Postman.

---

## Phase 10.16 commit chain (latest 16)

```
c02b230 fix(chat): critical SSE hang — req.on('close') fires on body-read, not disconnect ⭐
3c1019a fix(chat): replace Promise.race with explicit poll loop
fdaa2b6 fix(chat): protect race from rejection + fallbackReason on agent fail
646481d test(phase10.16): direct MDES dispatch via ts-node — 8/10 PASS
e305243 fix(chat): thread partial agent outputs through conductor race timeout
d92d498 test(phase10.16): add 10-query MDES test matrix runner script
8330836 feat(chat): MCP tool chips on AI messages
8da75f9 feat(chat): real Ollama streaming with progressive agent_delta events
6c34c18 perf(chat): MDES race 25s + 220-char preview + agent progress bar
2e14aed feat(chat): ⚡MDES badge on enhanced messages + phase10.16 docs
b5e1f66 feat(chat): MDES streaming preview in chat bubble (GPT thinking style)
4c2a6c5 feat(chat): bridge MDES final_answer to main chat bubble
815f575 feat(chat): MDES loading indicator + improved agent prompts
f812823 feat(ui+backend): MDES model badges + streaming cursor in MultiAgentPanel
618868f feat(chat): mother-orchestrated MDES multi-agent dispatch for every query
```

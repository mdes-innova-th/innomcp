# INNOMCP → manus.im Parity Gap (north-star spec)

> เป้าหมาย: innomcp ใช้งานได้เหมือน manus.im 100%
> เขียน 2026-06-13 จาก: manus analysis (TICKET-006), pipeline จริง, KNOWN-ISSUES, browser VQA
> สถานะนี้คือ **target ที่ล็อกแล้ว** — แทนที่ MANUS_REDESIGN_ARCHITECTURE.md (6 บรรทัด ASCII)

## manus.im คืออะไร (โมเดลที่ต้องเทียบ)

Autonomous agent workspace: ผู้ใช้ให้ "task" → agent **วางแผน → execute หลาย step ด้วย tools จริง (web, code, file) → stream ความคืบหน้าเข้า workspace panel ขวา → ส่ง artifact**. แกน 4 อย่าง: **Task** (lifecycle: create→execute→done/webhook), **Project** (shared context/instructions), **Skills/Agents** (capability ที่ invoke ได้), **Webhooks** (async completion/input-required). Response wrapper `{ok, request_id, data}`.

## 5 เสาที่วัด parity (ranked by gap)

| # | เสา (manus) | innomcp วันนี้ | Gap | ความสำคัญ |
|---|---|---|---|---|
| **P1** | **Agentic loop** — plan→act→observe→repeat จนงานเสร็จ | มี conductor/orchestrator/parallelDispatch/intentClassifier (กำลังแก้) แต่ chat ตอบ single-shot + greeting ขยะ ("ห้ามเดาโว้ย") | ยังไม่มี loop ที่ run จน task done; ยังไม่ stream step | 🔴 สูงสุด — แกน manus |
| **P2** | **Tool execution + live streaming เข้า workspace panel** | toolDispatch + ManusWorkspacePanel (right) มีโครง แต่ panel ยังไม่ auto-open/stream tool output จริง | เชื่อม tool-run → SSE/WS → panel render ไม่ครบ | 🔴 สูง |
| **P3** | **Task lifecycle + history/resume** | /api/tasks + TaskDetailPanel มี (เพิ่งแก้ dead-port) | task create→execute→persist→resume ครบ flow ยังไม่ proven | 🟠 กลาง |
| **P4** | **Artifact output** (ไฟล์/โค้ด/รายงานที่ดาวน์โหลดได้) | workspace files browser มี | agent ผลิต artifact ลง workspace + ให้ดาวน์โหลด ยังไม่ครบ | 🟠 กลาง |
| **P5** | **Multi-provider reliability** (ตอบถูก ไม่ crash) | providerManager/Failover/HealthProbe มี แต่ GLM crash บน Thai ยาว, greeting ขยะ | provider select + Thai handling + failover ที่ใช้ได้จริง | 🟠 กลาง |

## Blocking defects (ต้องแก้ก่อนอ้าง parity)

1. **chat greeting ขยะ** "ห้ามเดาโว้ย" (Phase 3.1 — session อื่นกำลังทำ: conductor.ts/intentClassifier.ts/systemInventory.ts) 🔴
2. **GLM crash บน Thai prompt ยาว** → ต้อง route เลี่ยง/ตัด หรือ fallback 🟠
3. **NEXT_PUBLIC baked at build** → เปลี่ยน url ต้อง rebuild (แก้แล้วบางส่วนด้วย docker ARG) 🟡
4. **zombie :3011 (Windows)** — dev friction 🟡

## หลักการแบ่งงาน (ตาม Fable 5 advisor)

- **manus core (P1/P2)** = serial integration + run-iterate → **Fable/Opus ทำเอง** (army ทำแทนไม่ได้) + ไม่ชนงาน session อื่นที่แก้ conductor อยู่
- **army (CommandCode) ชี้ไปงาน additive/verifiable/non-colliding**: endpoint contract tests ที่ **รันจริง**, tool-adapter scaffold ที่ loop บริโภค, component polish เป็น diff ที่ apply+screenshot, parity-gap specs ที่ป้อน serial thread
- **opus-gates wave ที่มีอยู่แล้ว (118 งาน)** = resume ไม่สร้างใหม่ชน

## Definition of "manus 100%" (วัดได้)

E2E: ผู้ใช้พิมพ์งานไทย เช่น "วิเคราะห์สภาพอากาศ 3 จังหวัดแล้วทำตาราง" → agent วางแผน, เรียก weather tool หลายครั้ง (เห็น step ใน panel ขวา), ผลิตตารางเป็น artifact, ตอบสรุปไทยถูกต้อง, ไม่ crash, task ปรากฏใน history + resume ได้ — **พิสูจน์ด้วย Playwright spec ที่ผ่านจริง ไม่ใช่แค่ parse**

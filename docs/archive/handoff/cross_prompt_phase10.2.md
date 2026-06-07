# CROSS TARGET: PHASE 10.2 (Answer Planner & Operator-Grade Fallback)

## Context

You are CROSS (Claude Code), the main coder for project `innomcp`.
The SA (GRAVY) has prepared this specification for you to implement Phase 10.2.

## Goal

ทำให้ backend “คิดก่อนตอบ” ด้วย Answer Planner + tool plan + fallback แบบ operator-grade

## Deliverables

1. **เพิ่ม Answer Planner ชั้นบาง ๆ ใน backend chat route (`innomcp-node/src/routes/api/chat.ts`)**:
   - Classify/Plan "intent": `general` / `evidence` / `weather` / `web-record`
   - วาง "tool plan" ก่อนตอบ (จะเรียก tools อะไรบ้าง + fallback คืออะไรถ้าล่ม)
   - ถ้า tool/DB ล่ม ต้องให้ fallback ตอบดี และห้ามหลุด technical internal error messages
   - เพิ่ม log เฉพาะฝั่ง server (ห้ามเผลอส่งออกไปใน user response): `intent=`, `plan=`, `fallback=`, `keywordSource/dbOperational=` ที่เกี่ยวข้อง
2. **สร้าง Verifier**: `innomcp-node/scripts/verify_phase102_chat_iq_gate.ts` (<=12 cases)
   - **general**: ไม่พึ่ง DB ก็ต้องตอบดี (ทดสอบ fallback)
   - **evidence**: ทดสอบ intent evidence ต้องได้ `structuredContent` + `meta.dataSource` ถูกต้อง
   - **weather**: ทกสอบ intent weather ต้องได้ `5 fields/area` + `weatherPayload` shape ถูกต้อง
   - **web-record**: ค้นหาบันทึกระบบ ต้องมีรูปแบบสรุป + อ้างอิงจาก “ระบบเรา” (ไม่หลอน)
3. **Evidence**:
   - รัน verifier และบันทึกลง `innomcp-node/evidence/phase102-*.log`
   - log ต้องมีบรรทัดจบว่า `RESULT: PASS` + summary

## Files to review before execution:

- `innomcp-node/src/routes/api/chat.ts`
- `innomcp-node/src/utils/mcp/godTierRouter.ts`
- `innomcp-node/scripts/verify_phase94_router_db_degrade.ts` (for good verifier patterns)
- `innomcp-node/scripts/verify_phase101b_weather_map.ts` (for good verifier patterns)

## ABSOLUTE RULES

- **DO NOT** `git add .` (only stage explicitly changed files).
- **DO NOT** change remote URL.
- **DETERMINISTIC TESTING ONLY**: Ensure you use `SMOKE_MODE=1`, `CHAT_TRACE_QA=1`, `LOG_DEBUG=0`, `TS_NODE_CACHE=false` when running verifiers.

When you finish, provide a summary of the implementation and your test results.

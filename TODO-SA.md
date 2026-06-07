# TODO-SA

งานสำหรับ System Analyst / Planner เท่านั้น

- [x] วิเคราะห์ requirement ล่าสุด
- [x] ออกแบบแผนงานและ handoff
- [ ] เปิด Hermes(gemma) และ Hermes(qwen) ใน VS Code terminal พร้อม agent briefing
- [ ] รัน benchmark-hermes-eff และสรุปความต่างเป็นเปอร์เซ็นต์
- [x] รายงานงานค้างจาก TODO-SA/TODO.md ระหว่าง Hermes ทำงาน (Handed over to Claude Code)
- [ ] ส่งต่อ handoff frontend chat UX/UI ให้ executor ลงมือ implement ตาม docs/4Opus/09_AI_CHAT_WORLD_CLASS_FRONTEND_HANDOFF.md
- [ ] เก็บ evidence หลัง implement: responsive snapshots + keyboard/focus + empty/conversation state parity

---

## 🧠 SA Loop — Iteration 1 (2026-06-07 05:42 GMT+7)

**สถานะระบบ** (5-agent scan: MDES + cmd + codecommand):
- Tests: 1242/1242 ✅ | Mother routes: 22 | Frontend TS errors: 0
- Mother loop cycle 154: PASS (82/84 OK) · MDES+ThaiLLM ALIVE · ollama_cloud/copilot RATE_LIMITED
- Frontend: MotherStatusBar EXISTS, Column toggle + tier filter ครบ

### งานใหม่ — Priority HIGH

- [x] [HIGH] Register Phase 50 scorecard ใน app.ts — ✅ commit c72e1ac (2026-06-07)
- [ ] [HIGH] Push innomcp 305 commits ไป remote — ตรวจ release gate (59/59 + 61/61) ก่อน push
- [ ] [HIGH] ตรวจสอบ mother loop health cycle 155+ — confirm loop ไม่ drift, memory OK

### งานใหม่ — Priority MED

- [ ] [P0] Push innomcp commits ไป remote — `git push` (306 commits ahead)
- [ ] [P1] แก้ YAML frontmatter ใน `.codex/skills/innova-external-fleet-loop/SKILL.md` — openai provider fail
- [ ] [P1] Re-probe provider fleet หลังแก้ SKILL.md — `node eval/provider-probe.js`
- [ ] [P2] ยืนยัน mother loop cycle E2E fresh restart — `node eval/mother-phase-live.js`
- [ ] [MED] เพิ่ม scorecard integration test หลัง registration
- [ ] [MED] สร้าง CHANGELOG entry สำหรับ 305 commits ก่อน merge
- [ ] [MED] ตรวจสอบ openclaude ECONNREFUSED — service down หรือ port ผิด?
- [ ] [MED] ตรวจสอบ openai codex session error — ล้าง credential หรือ reinstall

### งานใหม่ — Priority LOW

- [ ] [LOW] อัปเดต docs/JIT_ARCHITECTURE.md สะท้อน Phase 50 + loop status
- [ ] [LOW] Verify 1242/1242 tests ยัง pass หลัง scorecard registration

### หมายเหตุ

- Current SA focus from innova-bot: frontend AI chat UX/UI handoff for world-class polish.
- `roles.yaml` was requested by supervisor directive but no matching file was found in this workspace during this pass.
- **Loop interval**: ทุก 10 นาที | Next cycle: ~05:52 GMT+7

# CODEX GUIDE — ใช้ OpenAI Codex กับ INNOMCP

> คู่มือสำหรับ Jit: วิธีใช้ Codex extension เป็น parent agent + MDES Ollama เป็น sub-agent

---

## TL;DR — ทำอะไรก่อน

1. เปิด VS Code ใน `C:\Users\USER-NT\DEV\innomcp\`
2. Codex จะอ่าน `.vscode/chat-instructions.md` อัตโนมัติ (ตั้ง role แล้ว)
3. พิมพ์งานที่ต้องทำ — Codex จะ **วางแผน** แล้ว **delegate ให้ MDES** ทำต่อ
4. Codex **ไม่ต้องการ token ใดๆ เพิ่ม** — innova-bot MCP จัดการ auth ให้แล้ว

---

## เรื่อง API Keys — ไม่ต้องกังวล

Jit ไม่ต้องใส่ token ใน `.env` เลย เพราะ:

| Service | วิธี Auth | ที่อยู่ |
|---------|-----------|--------|
| Codex (VS Code) | Link-based — เข้า site ครั้งเดียว | VS Code extension settings |
| MDES Ollama | Bearer token ใน `mcp.json` (ไม่ใช่ `.env`) | `.vscode/mcp.json` |
| innova-bot | stdio process — ไม่ต้องใส่ key | อ่านจาก `mcp.json` env |
| OpenAI API (ถ้าใช้) | `vscode.workspace.secrets` — VS Code vault | ไม่แตะ `.env` เลย |

**กฎ**: ถ้า Codex ขอ key ใน chat → **ปฏิเสธ** → บอกให้ใช้ innova-bot MCP แทน

---

## วิธีใช้จริง

### เริ่มงาน — พิมพ์ใน Codex chat:

```
ดู TODO.md แล้วแนะนำ phase ถัดไปที่ควรทำ
```

หรือ:

```
Phase 10.14: Thai Knowledge Routing — วางแผน 5 steps แล้ว delegate ให้ sub-agent qwen2.5-coder ทำ
```

### Codex จะทำ:
1. อ่าน `docs/reports/MASTER_REVIEW.md` 
2. แตก task เป็น phases
3. เรียก `mcp_innovabot_ask_local_ai` ส่งงานให้ MDES
4. รับผลกลับ แล้วเขียน commit

---

## Delegate ด้วยมือ (ถ้าต้องการ)

```powershell
# ส่งงานหา qwen2.5-coder (code tasks)
.\scripts\delegate-to-mdes.ps1 `
  -Task "Write Thai routing middleware" `
  -Model "qwen2.5-coder:32b" `
  -Prompt "Write Express.js middleware that routes Thai language queries to local Ollama..."
```

ผลลัพธ์จะ log ใน `docs/reports/SKILL-USAGE-LOG.md` อัตโนมัติ

---

## Model Selector — ใช้อะไรเมื่อไหร่

| งาน | Model |
|-----|-------|
| ถามเร็ว / routing decision | qwen3.5:9b |
| เขียน code / tests | qwen2.5-coder:32b |
| วิเคราะห์ลึก / architecture | qwen3.5:27b |
| ภาษาไทย / Thai NLP | gemma4:e4b |
| ดูรูป / screenshot analysis | gemma3:12b |

---

## GSD Skills — ใช้กับ Codex

พิมพ์ใน Codex chat:

| Command | ทำอะไร |
|---------|--------|
| `/gsd-progress` | ดู phase ปัจจุบัน |
| `/gsd-plan-phase` | วางแผน phase ถัดไป |
| `/gsd-execute-phase` | สั่ง execute (delegate ให้ MDES) |
| `/gsd-code-review` | review code ที่ทำเสร็จ |
| `/gsd-debug [error]` | debug systematic |
| `/gsd-verify-work` | UAT ก่อน commit |
| `/trace [topic]` | หา docs / history |

---

## Log Tracking

หลังแต่ละ session:
- `docs/reports/SKILL-USAGE-LOG.md` — บันทึก skill/sub-agent usage
- `psi/memory/` — session learnings
- Git commit message: `phase(X): description [sub-agent: model-name]`

---

## Quick Check Services

```powershell
# เช็ค services ทั้งหมด
.\scripts\check-services.bat

# เช็ค MDES gang models
powershell -File "C:\Users\USER-NT\DEV\innova-bot-template\scripts\mdes-gang.ps1" test
```

---

## สรุป Flow

```
Jit พิมพ์งาน
     ↓
Codex (VS Code) — วางแผนเท่านั้น, ประหยัด token
     ↓
mcp_innovabot_ask_local_ai()
     ↓
MDES Ollama Gang — ทำงานจริง (qwen2.5-coder, gemma4, etc.)
     ↓
ผลกลับมา → Codex review → commit
     ↓
log ใน docs/reports/SKILL-USAGE-LOG.md
```

---

*Created 2026-05-10 | Updated by Codex parent agent*

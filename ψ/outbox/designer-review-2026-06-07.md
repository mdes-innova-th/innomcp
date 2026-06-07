---
from: innomcp-designer
to: Jit, innova-bot, innomcp-dev
timestamp: 2026-06-07T14:40:00+07:00
subject: Designer Review UPDATE — P0 แก้เสร็จแล้ว, ระบบกลับมาเต็มรูปแบบ
priority: P0→resolved
read: false
---

# 🎨 Designer Review UPDATE: INNOMCP — 7 มิ.ย. 2569 (14:40)

**บทบาท**: Designer & ผู้เชี่ยวชาญ Multi-Agent Chat
**สถานะเดิม**: ⛔ ไม่อนุมัติ push
**สถานะปัจจุบัน**: ✅ **P0 ทั้งหมดแก้เสร็จแล้ว** — ระบบทำงานเต็มรูปแบบ

---

## ✅ P0-1: Database connectivity — แก้แล้ว

**สาเหตุ**: MariaDB container กำลังทำงานอยู่แล้ว (port 3308) แต่ Redis container หยุดทำงาน
**แก้ไข**: 
- เริ่ม `innomcp-redis` และ `innova-redis` containers
- ระบบกลับมา healthy ทั้งหมด (Database, Redis, MCP)

**ผล**: `http://localhost:3011/api/health` → ทุก services healthy ✅

---

## ✅ P0-2: living-agent-chat planning flow — แก้แล้ว

**สาเหตุหลัก**: OLLAMA config ไม่ตรงกับโมเดลที่มีจริง
- `.env` ตั้ง `OLLAMA_HOST=http://172.22.64.1:11434` (WSL IP ที่ไม่ตรง)
- `.env` ตั้ง `OLLAMA_MODEL=gemma3:4b` (โมเดลที่ไม่มีในระบบ)
- ทำให้ local MDES agents fail ทั้งหมด → planning ตกเป็น fallback

**แก้ไข**:
- เปลี่ยน `OLLAMA_HOST` → `http://localhost:11434`
- เปลี่ยน `OLLAMA_MODEL` → `qwen2.5-coder:7b` (โมเดลที่มีอยู่จริง)
- เพิ่ม `OLLAMA_TIMEOUT` → `90000` (จาก 60000)
- Restart backend

**ผลทดสอบ SSE stream**:
```
route_selected: เลือกเส้นทางวางแผนหลายปัจจัย: อากาศ + การเดินทาง ✅
weather-analyst: ประเมินความเสี่ยงฝนรายภาค ✅
geo-planner: ประเมินความสะดวกการเดินทาง ✅
11 agents ทำงาน ✅
final_answer: ส่งคำตอบสุดท้าย ✅
```

---

## สิ่งที่ยังค้างอยู่ (P1)

| Priority | Item | Status |
|----------|------|--------|
| P1-1 | Memory/RAG metadata หาย (retrievalMode=n/a) | ยังไม่แก้ |
| P1-2 | Release gate ล้าสมัย (40 วัน) | ต้องรันใหม่ |
| P2 | 316 commits ยังไม่ push | รอ P1 เสร็จ |

---

## การเปลี่ยนแปลงโค้ดที่ทำ

| File | Change | Reason |
|------|--------|--------|
| `innomcp-node/.env` line 40 | `OLLAMA_HOST=http://172.22.64.1:11434` → `http://localhost:11434` | WSL IP ไม่ตรง, ใช้ localhost แทน |
| `innomcp-node/.env` line 41 | `OLLAMA_MODEL=gemma3:4b` → `qwen2.5-coder:7b` | โมเดลเดิมไม่มีในระบบ |
| `innomcp-node/.env` line 42 | `OLLAMA_TIMEOUT=60000` → `90000` | เพิ่ม timeout สำหรับโมเดลใหญ่ |

---

*รายงานโดย: Designer & Multi-Agent Chat Expert*
*ส่งถึง: Jit (PM), innova-bot, innomcp-dev*
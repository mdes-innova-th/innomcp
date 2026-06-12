<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-25 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":104,"completion_tokens":2802,"total_tokens":2906,"prompt_tokens_details":{"cached_tokens":96,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":46,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 114s
 generated: 2026-06-12T04:28:11.366Z -->
```markdown
# 🚀 Pre-Deployment Checklist / รายการตรวจสอบก่อน Deploy

> **Innomcp** — Production Readiness Verification / ตรวจสอบความพร้อมก่อนขึ้น Production

---

## 1. Backend Checks / ตรวจสอบ Backend

| # | Check Item / รายการตรวจสอบ | Criteria / เกณฑ์ | Status / สถานะ |
|---|---|---|---|
| 1.1 | TypeScript Compilation / คอมไพล์ TypeScript | `tsc` exits with **code 0**, zero errors | ☐ |
| 1.2 | Recovery Verification / ตรวจสอบ Recovery | `verify-recovery` passes **8/8** checks | ☐ |
| 1.3 | Backend Startup / เริ่ม Backend | Server starts on **port 3012** without crash | ☐ |
| 1.4 | WebSocket Connection / การเชื่อมต่อ WebSocket | WS client connects to `ws://localhost:3012/ws` successfully | ☐ |
| 1.5 | Environment Variables / ตัวแปรสภาพแวดล้อม | All required `ENV` vars set (API keys, DB URL, etc.) | ☐ |
| 1.6 | Database Migration / Migration ฐานข้อมูล | All migrations applied, no pending | ☐ |
| 1.7 | Health Endpoint / Health Endpoint | `GET /health` returns `200 OK` | ☐ |
| 1.8 | CORS Configuration / การตั้งค่า CORS | Allowed origins match production domain | ☐ |

### Detailed Steps / ขั้นตอนรายละเอียด

```bash
# 1.1 — TypeScript Compilation
cd innomcp-next
npx tsc --noEmit
echo $?  # Must be 0 / ต้องเป็น 0

# 1.2 — Recovery Verification
npm run verify-recovery
# Expected: 8/8 checks passed / คาดหวัง: ผ่าน 8/8 รายการ

# 1.3 ��� Backend Startup
PORT=3012 npm run start
# Check: no unhandled promise rejection / ตรวจสอบ: ไม่มี unhandled promise rejection

# 1.4 — WebSocket Connection
wscat -c ws://localhost:3012/ws
# Must connect without error / ต้องเชื่อมต่อได้โดยไม่มี error
```

---

## 2. Frontend Checks / ตรวจสอบ Frontend

| # | Check Item / รายการตรวจสอบ | Criteria / เกณฑ์ | Status / สถานะ |
|---|---|---|---|
| 2.1 | Production Build / Build สำหรับ Production | `pnpm build` completes with **exit code 0** | ☐ |
| 2.2 | Console Errors / Console Errors | **Zero** unhandled errors in browser console | ☐ |
| 2.3 | 3-Column Layout / Layout 3 คอลัมน์ | Left panel (chat), Center panel (workspace), Right panel (status) all visible | ☐ |
| 2.4 | Responsive Breakpoints / Responsive Breakpoints | Layout adapts at ≥1024px (3-col), 768–1023px (2-col), <768px (1-col) | ☐ |
| 2.5 | Static Assets / Static Assets | All CSS, JS, fonts, images load (no 404s) | ☐ |
| 2.6 | Theme Rendering / การแสดงผล Theme | Dark/light theme applies correctly | ☐ |

### Detailed Steps / ขั้นตอนรายละเอียด

```bash
# 2.1 — Production Build
cd innomcp-next/frontend
pnpm build
# Must complete without error / ต้องเสร็จสมบูรณ์โดยไม่มี error

# 2.2 — Start preview server
pnpm preview
# Open browser DevTools → Console tab
# No red errors allowed / ห้ามมี error สีแดง
```

### 3-Column Layout Verification / ตรวจสอบ Layout 3 คอลัมน์

```
┌──────────────┬────────────────────┬──────────────┐
│              │                    │              │
│  LEFT PANEL  │   CENTER PANEL     │ RIGHT PANEL  │
│    (Chat)    │   (Workspace)      │  (Status)    │
│              │                    │              │
│  ☐ Visible   │   ☐ Visible        │  ☐ Visible   │
│  ☐ Scrollable│   ☐ Scrollable     │  ☐ Scrollable│
│              │                    │              │
└──────────────┴────────────────────┴──────────────┘
```

---

## 3. Integration Checks / ตรวจสอบ Integration

| # | Check Item / รายการตรวจสอบ | Criteria / เกณฑ์ | Status / สถานะ |
|---|---|---|---|
| 3.1 | Hello → Greeting Flow / ขั้นตอน Hello → Greeting | Sending "hello" returns a valid greeting response via MCP | ☐ |
| 3.2 | Panels Render / การแสดงผล Panels | All 3 panels render with live data from backend | ☐ |
| 3.3 | Health Shows Providers / Health แสดง Providers | `/health` endpoint lists all configured MCP providers with status | ☐ |
| 3.4 | End-to-End Chat / สนทนา End-to-End | Message sent from frontend → processed by backend → response displayed | ☐ |
| 3.5 | WebSocket Real-time / WebSocket แบบ Real-time | Chat updates stream via WS without page refresh | ☐ |
| 3.6 | Error Handling / การจัดการ Error | Backend error returns user-friendly message in UI (no raw stack trace) | ☐ |

### Detailed Steps / ขั้นตอนรายละเอียด

```bash
# 3.1 — Hello → Greeting Flow
curl -X POST http://localhost:3012/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
# Expected: {"response": "<greeting>", ...}
# คาดหวัง: ได้ response ที่เป็น greeting

# 3.3 — Health Shows Providers
curl http://localhost:3012/health
# Expected JSON includes "providers" array with each provider status
# คาดหวัง: JSON มี array "providers" พร้อมสถานะของแต่ละ provider
```

### Integration Flow Diagram / แผนภาพ Integration Flow

```
┌──────────┐    POST /api/chat     ┌──────────┐    MCP Protocol    ┌──────────┐
│ Frontend │ ──────────────────► │  Backend  │ ─────────────────► │ Provider  │
│  (UI)    │ ◄────────────────── │ (3012)    │ ◄─────────────────  │  (LLM)   │
└──────────┘    JSON Response    └──────────┘    Tool Response    └──────────┘
      │                                │
      │         WebSocket             │
      └────────────────────────────────┘
          Real-time streaming / สตรีมแบบ Real-time
```

---

## 4. Go/No-Go Decision Criteria / เกณฑ์การตัดสินใจ Go/No-Go

### ✅ GO — Deploy to Production / ปรับใช้ Production

All of the following must be true / ต้องเป็นจริงทั้งหมด:

| Criteria / เกณ���์ | Requirement / ข้อกำหนด |
|---|---|
| `tsc` compilation | **0 errors** / ไม่มี error |
| `verify-recovery` | **8/8 passed** / ผ่าน 8/8 |
| Backend on 3012 | **Starts & stable** / เริ่มได้และมีเสถียรภาพ |
| WebSocket | **Connects & streams** / เชื่อมต่อและสตรีมได้ |
| `pnpm build` | **Exit 0** / จบด้วย code 0 |
| Console errors | **0 critical errors** / ไม่มี error ร้ายแรง |
| 3-column layout | **All panels visible** / แสดงผลครบทุก panel |
| Hello → Greeting | **Returns valid response** / ส่ง response ถูกต้อง |
| Health → Providers | **Lists all providers** / แสดง provider ครบ |
| No regressions | **All existing tests pass** / ทุก test ผ่าน |

### 🛑 NO-GO — Do Not Deploy / ห้าม Deploy

Any of the following is a blocker / หากมีข้อใดข้อหนึ่งต่อไปนี้เกิดขึ้น:

| Blocker / สิ่งที่ขัดขวาง | Reason / เหตุผล |
|---|---|
| `tsc` has errors | Type safety compromised / ความปลอดภัยของ Type ไม่ครบ |
| `verify-recovery` < 8/8 | System integrity uncertain / ความสมบูรณ์ของระบบไม่แน่นอน |
| Backend crashes on start | Service unavailable / บริการไม่พร้อมใช้งาน |
| WS fails to connect | Real-time features broken / ฟีเจอร์ real-time ใช้ไม่ได้ |
| `pnpm build` fails | Cannot serve frontend / ให้บริการ frontend ไม่ได้ |
| Console errors in UI | Poor user experience / ประสบการณ์ผู้ใช้ไม่ดี |
| Layout broken (missing panels) | Core UX broken / UX หลักใช้ไม่ได้ |
| Hello → Greeting fails | Core functionality broken / ฟังก์ชันหลักใช้ไม่ได้ |
| Health missing providers | Monitoring blind spot / จุดบอดในการ monitor |

---

## 5. Sign-Off / การอนุมัติ

| Role / บทบาท | Name / ชื่อ | Date / วันที่ | Signature / ลายเซ็น |
|---|---|---|---|
| Backend Engineer / วิศวกร Backend | | | |
| Frontend Engineer / วิศวกร Frontend | | | |
| QA / ทดสอบ | | | |
| DevOps / ปรับใช้ระบบ | | | |
| Product Owner / เจ้าของผลิตภัณฑ์ | | | |

---

> **Decision / การตัดสินใจ:** ☐ GO &nbsp;&nbsp;&nbsp; ☐ NO-GO
>
> **Reason (if NO-GO) / เหตุผล (ถ้า NO-GO):** _________________________________

---

*Last updated / อัปเดตล่าสุด: 2025-07-10*
```

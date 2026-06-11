```markdown
# INNOMCP Testing Guide / คู่มือการทดสอบ INNOMCP

## ภาพรวม (Overview)
INNOMCP is the Thai government AI platform (MDES). การทดสอบที่ครอบคลุมช่วยให้ระบบมีความเสถียรและพร้อมใช้งานตลอด 24 ชั่วโมง  
Comprehensive testing ensures 24/7 reliability for critical AI services.

## กลยุทธ์การทดสอบ (Testing Strategy)

### Frontend – innomcp-next
**Unit Tests (การทดสอบระดับหน่วย)**  
ใช้ Jest + Testing Library เพื่อทดสอบ Components, Hooks, และ Lib  
Run: `pnpm --filter innomcp-next test`  
Coverage targets: ≥80% สำหรับ services, ≥70% สำหรับ key component paths

**E2E Tests (การทดสอบแบบ end‑to‑end)**  
ใช้ Playwright จำลองการทำงานจริง: การแชท, การจัดการ Provider, Full chat flow  
Run: `pnpm --filter innomcp-next exec playwright test`  
Smoke test with reduced assertions: `SMOKE_MODE=1 pnpm ... exec playwright test`

### Backend – innomcp-node
**Unit Tests (การทดสอบระดับหน่วย)**  
Jest ครอบคลุม services และ routes หลัก  
Run: `pnpm --filter innomcp-node test`  
Coverage targets: ≥80% สำหรับ services, ≥60% สำหรับ API routes

**Integration Tests (การทดสอบบูรณาการ)**  
ไฟล์ `mother-phase-live.js` จำลองการทำงานแบบ end‑to‑end ของระบบหลังบ้าน

### System Tests (การทดสอบทั้งระบบ)
- Release gate: รันชุดทดสอบ 59/59 รายการ ด้วย `node eval/run-all.js`  
- Browser signoff: Playwright 61/61 tests (ต้องผ่านทั้งหมดเมื่อ `SMOKE_MODE=1`)

## รายการตรวจสอบก่อนส่งมอบ (Pre‑ship Checklist)
1. Type checking: `tsc --noEmit` ในทั้งสอง packages  
2. Unit tests: `pnpm test` (ทั้งโปรเจกต์)  
3. System smoke: `node eval/mother-phase-live.js`  
4. Manual: เปิด UI, ส่งข้อความ และตรวจสอบว่า MDES ตอบกลับอย่างถูกต้อง

## เป้าหมาย Coverage
| Layer       | Target   |
|-------------|----------|
| Services    | > 80%    |
| Components  | > 70%    |
| API Routes  | > 60%    |

ปฏิบัติตามขั้นตอนเหล่านี้เพื่อให้แน่ใจว่า INNOMCP พร้อมสำหรับผู้ใช้งานจริงและรองรับภาระงานแบบไม่จำกัดของ MDES Ollama
```
<!-- cc-team deliverable
 group: R (Rebuild 3 quarantined REST routes against real service APIs (Express Router, TypeScript))
 member: R5 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":170,"completion_tokens":1213,"total_tokens":1383,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":135,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-11T19:27:25.918Z -->
```markdown
# Phase 2 — Recovery Verification Checklist

## 1. Pre-checks

- [ ] `npx tsc --noEmit` → exit code **0** (zero type errors)
- [ ] `npm run build` → exit code **0**, ไม่มี error ใน stdout/stderr
- [ ] ไฟล์ `dist/` ถูกสร้าง/อัปเดตใหม่ทั้งหมด

## 2. Route Re-wiring Checklist

เปิด `src/routes/api/index.ts` แล้วยืนยันทีละรายการ:

- [ ] `import { analyticsRouter } from '../analytics'` (หรือ path ที่ถูกต้อง) มีอยู่
- [ ] `import { mdesModelsRouter } from '../mdesModels'` (หรือ path ที่ถูกต้อง) มีอยู่
- [ ] `import { thaiNLPRouter } from '../thaiNLP'` (หรือ path ที่ถูกต้อง) มีอยู่
- [ ] `apiRouter.use('/analytics', analyticsRouter)` มีอยู่
- [ ] `apiRouter.use('/mdes/models', mdesModelsRouter)` มีอยู่
- [ ] `apiRouter.use('/thai', thaiNLPRouter)` มีอยู่
- [ ] ไม่มี commented-out / dead import ของ router ทั้งสามตัว

## 3. Curl Smoke Commands

รันคำสั่งทีละข้อ (สมมติ server ที่ `http://localhost:3000`):

- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/analytics/stats` → **200**
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/mdes/models` → **200**
- [ ] `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"text":"สวัสดี"}' http://localhost:3000/api/thai/analyze` → **200**
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/analytics/stats?from=2025-01-01&to=2025-01-31` → **200**
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/mdes/models?limit=5` → **200**
- [ ] `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"text":"ทดสอบ","mode":"tokenize"}' http://localhost:3000/api/thai/analyze` → **200**

## 4. Regression — ไม่มี @ts-nocheck

- [ ] `grep -r "@ts-nocheck" src/services/` → **ไม่มี output ใด ๆ** (exit code 1)
- [ ] `grep -r "@ts-ignore" src/services/` → ตรวจสอบว่าแต่ละรายการที่เหลือมีเหตุผลที่เพียงพอ (ถ้ามี ให้เอาออกหรือเพิ่ม comment อธิบาย)

## 5. Pass Criteria

ทั้ง 5 ข้อต้องครบจึงจะถือว่า Phase 2 ผ่าน:

- [ ] **P2-01** — `tsc --noEmit` และ `npm run build` ผ่านโดยไม่มี error
- [ ] **P2-02** — router ทั้งสาม (analytics / mdesModels / thaiNLP) ถูก import และ register ใน `apiRouter` ครบถ้วน
- [ ] **P2-03** — curl smoke test ทั้ง 6 คำสั่งคืน HTTP 200
- [ ] **P2-04** — ไม่มี `@ts-nocheck` ใน `src/services/`
- [ ] **P2-05** — ไม่มี regression ใหม่ในชุดทดสอบเดิม (`npm test` ผ่านทั้งหมด)
```

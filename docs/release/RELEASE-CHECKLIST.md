# RELEASE-CHECKLIST.md – innomcp

## 1. Pre‑release Gates
- [ ] **tsc** EXIT 0 ทั้ง `innomcp-next` และ `innomcp-node` (ไม่มี error)
- [ ] **Playwright e2e** pass ทุก test (`cd tests/e2e && npx playwright test`) โดยใช้ baseURL `http://localhost:3000` และ viewport ตาม `test.use`
- [ ] **gitleaks** clean (`gitleaks detect --no-git` หรือ scan repo) – ไม่มี secrets รั่วไหล
- [ ] **.env** ไม่ถูก commit (ตรวจ `git diff --cached` และ ignore rules)
- [ ] **docker build** สำเร็จทั้ง `innomcp-next` และ `innomcp-node` (คำสั่ง `docker compose build` ไม่ error)
- [ ] **Historical gate: dead-port 3011→3015** – ตรวจสอบว่าคอนฟิก backend ชี้ `:3015` (ไม่ใช่ `:3011`) ทั้งใน `docker-compose.yml` และ `NEXT_PUBLIC_BACKEND_URL`
- [ ] **Historical gate: MEGA-100 fence‑corruption** – ตรวจว่าการ migrate DB และ Redis operation ไม่มีการ write ทับพื้นที่ shared state โดยไม่ได้ตั้งใจ (โดยเฉพาะใน `/living-chat` และ `/dashboard`)

## 2. Release Steps
- [ ] **Tag release** – `git tag -a v<version> -m "release <version>" && git push origin v<version>`
- [ ] **Build images** – `docker compose build --no-cache` (หรือ push ไป registry)
- [ ] **DB migrate** – รัน migration script (ถ้ามี) บน MariaDB (`:3308`)
- [ ] **Deploy compose** – `docker compose up -d` (ตรวจว่าบริการทั้งหมดขึ้นปกติ)
- [ ] **Smoke test** – ทดสอบ:
  - [ ] Health endpoint node: `http://localhost:3015/health`
  - [ ] UI หน้า `/login` โหลดได้
  - [ ] UI หน้า `/dashboard` ทำงาน
  - [ ] Chat modal `/living-chat` มีปุ่ม "ข้าม" ทำงาน

## 3. Post‑release Verification
- [ ] **Health endpoints** ตอบ `200` ทั้ง `innomcp-node` (REST :3015) และ WebSocket
- [ ] **Chat roundtrip** – ส่งข้อความ `/living-chat` → รับตอบกลับจาก backend ผ่าน WS ครบวงจร
- [ ] **Browser signoff** – เปิดเบราว์เซอร์ (viewport ตาม Playwright) ตรวจสอบ UI:
  - ภาษาไทย / อังกฤษสลับได้
  - ขั้นตอน onboarding ผ่านปุ่ม "ข้าม"
  - Input chat ส่งข้อความได้
- [ ] **Monitor logs** – `docker compose logs --tail=50` ไม่มี error ผิดปกติ

## 4. Rollback Trigger Conditions
- [ ] Health endpoint `:3015` หรือ `:3000` ไม่ออนไลน์ภายใน 30 วินาที
- [ ] DB migration ล้มเหลวหรือ schema mismatch
- [ ] Chat roundtrip ล้มเหลว (ส่งแล้วไม่ตอบกลับ / WS disconnect)
- [ ] gitleaks หรือ tsc error ที่ถูกมองข้ามข้าม gate
- [ ] พบ fence‑corruption pattern คล้าย MEGA-100 (data leak ระหว่างรีดิสคีย์หรือ MariaDB table)

> **Rollback procedure:** `git revert <tag>` → rebuild images → deploy compose ใหม่ด้วย tag ก่อนหน้า

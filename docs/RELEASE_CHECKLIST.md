# INNOMCP Production Release Checklist
# รายการตรวจสอบการปล่อยจริงสำหรับ INNOMCP

---

## 1. Pre‑Release / ก่อนเผยแพร่

- [ ] **pnpm tsc --noEmit** (innomcp-next) – No type errors.  
  `pnpm tsc --noEmit` (innomcp-next) – ไม่มีข้อผิดพลาดของ type

- [ ] **pnpm tsc --noEmit** (innomcp-node) – No type errors.  
  `pnpm tsc --noEmit` (innomcp-node) – ไม่มีข้อผิดพลาดของ type

- [ ] **pnpm test** (both packages) – All unit & integration tests pass.  
  `pnpm test` (ทั้งสอง package) – การทดสอบทั้งหมดผ่าน

- [ ] **pnpm build** (innomcp-next) – Production build succeeds with no warnings.  
  `pnpm build` (innomcp-next) – การ build สำหรับ production สำเร็จโดยไม่มีคำเตือน

- [ ] **node eval/run-all.js** – 59/59 system tests pass.  
  `node eval/run-all.js` – การทดสอบระบบทั้ง 59 รายการผ่าน

- [ ] **SMOKE_MODE=1 playwright test** – Browser smoke tests pass (real browser).  
  `SMOKE_MODE=1 playwright test` – การทดสอบแบบ smoke test ในเบราว์เซอร์จริงผ่าน

- [ ] **No secrets in Git** – `git grep -r "user_63"` returns nothing. Also check for any other keys/tokens.  
  ไม่มี secret ใน Git – `git grep -r "user_63"` ไม่พบผลลัพธ์ และตรวจสอบ token อื่น ๆ ด้วย

- [ ] **.env.example** is up‑to‑date (all required env vars documented).  
  `.env.example` ถูกต้องและเป็นปัจจุบัน (มีรายการ environment variable ที่จำเป็นทั้งหมด)

- [ ] **CHANGELOG.md** updated with user‑facing changes.  
  `CHANGELOG.md` ได้รับการอัปเดตตามการเปลี่ยนแปลงที่ผู้ใช้เห็น

- [ ] **Linting** passes (`pnpm lint` or `eslint .`).  
  การตรวจสอบโค้ด (lint) ผ่านทั้งหมด

- [ ] **Thai UI strings** completed for all user‑facing components.  
  ข้อความภาษาไทยใน UI ครบถ้วนทุกจุดที่ผู้ใช้เห็น

- [ ] **Dependency audit** – `pnpm audit` shows no critical vulnerabilities.  
  ตรวจสอบ dependency – `pnpm audit` ไม่พบช่องโหว่ร้ายแรง

- [ ] **Feature flags** reviewed – toggles for new features are correctly set for production.  
  ตรวจสอบ feature flag – การตั้งค่าสำหรับฟีเจอร์ใหม่ถูกต้องสำหรับ production

- [ ] **Database backup** taken and verified.  
  สำรองฐานข้อมูลแล้วและตรวจสอบความถูกต้อง

- [ ] **Data migration scripts** tested against a production‑sized dataset.  
  สคริปต์ migration ทดสอบกับข้อมูลขนาดใกล้เคียง production แล้ว

- [ ] **Staging environment** passes all checks above (identical smoke tests).  
  สภาพแวดล้อม staging ผ่านการตรวจสอบทุกข้อข้างต้น (ใช้ smoke test ชุดเดียวกัน)

---

## 2. Environment Setup / การตั้งค่าสภาพแวดล้อม

- [ ] **MDES_OLLAMA_URL** is set and reachable from the server.  
  `MDES_OLLAMA_URL` ถูกตั้งค่าและติดต่อได้จากเซิร์ฟเวอร์

- [ ] **JWT_SECRET** is at least 32 characters, cryptographically random.  
  `JWT_SECRET` มีความยาวอย่างน้อย 32 ตัวอักษร และสุ่มด้วยวิธีที่ปลอดภัย

- [ ] **Database migrations** run successfully (connection string correct, schema up‑to‑date).  
  การ migration ฐานข้อมูลสำเร็จ (connection string ถูกต้อง, schema ตรงกับรุ่นล่าสุด)

- [ ] **Redis** (optional) is running and reachable if used for caching/session.  
  Redis (ถ้าใช้) ทำงานและติดต่อได้

- [ ] **Workspace storage directory** exists and is writable by the application.  
  โฟลเดอร์จัดเก็บพื้นที่ทำงาน (workspace) มีอยู่และแอปพลิเคชันสามารถเขียนได้

- [ ] **SSL certificates** valid for the domain (if HTTPS).  
  ใบรับรอง SSL ถูกต้องสำหรับโดเมน (หากใช้ HTTPS)

- [ ] **Firewall rules** allow only necessary ports (e.g., 443, 80) and internal services.  
  กฎไฟร์วอลล์เปิดเฉพาะพอร์ตที่จำเป็น (เช่น 443, 80) และบริการภายใน

- [ ] **Log directories** created with proper permissions for audit logs.  
  โฟลเดอร์สำหรับเก็บ log ถูกสร้างขึ้นและมีสิทธิ์ที่เหมาะสมสำหรับ audit log

- [ ] **System time/date** synchronized (NTP) — crucial for JWT/audit.  
  เวลาในระบบตรงกันผ่าน NTP – สำคัญสำหรับ JWT และ audit

---

## 3. Deployment / การปรับใช้

- [ ] **Build and start** – `pnpm build && pnpm start` (or pm2/docker equivalent).  
  Build และเริ่มบริการ – `pnpm build && pnpm start` (หรือเทียบเท่าเช่น pm2/docker)

- [ ] **Health check** – `curl /api/health` returns 200 with `"status":"ok"`.  
  ตรวจสอบสถานะ – `curl /api/health` ตอบกลับ 200 พร้อม `"status":"ok"`

- [ ] **MDES check** – `curl /api/mdes/health` confirms Ollama is ready.  
  ตรวจสอบ MDES – `curl /api/mdes/health` ยืนยันว่า Ollama พร้อม

- [ ] **Auth flow** – Login and register endpoints work (return valid tokens).  
  ระบบยืนยันตัวตน – จุดเข้า login และ register ทำงานได้ (ส่ง token ที่ถูกต้องกลับมา)

- [ ] **Protected routes** – /living-chat (and other guarded pages) load only after login.  
  เส้นทางที่มีการป้องกัน – /living-chat และหน้าอื่นโหลดได้เฉพาะเมื่อเข้าสู่ระบบแล้ว

- [ ] **AI response** – Send a test message in /living-chat and receive a meaningful answer.  
  การตอบกลับของ AI – ส่งข้อความทดสอบใน /living-chat และได้รับการตอบกลับที่สมเหตุสมผล

- [ ] **Static assets** – CSS, JS bundles, and images load without 404 errors.  
  ทรัพยากร static – CSS, JS bundles และรูปภาพโหลดสมบูรณ์ ไม่มี error 404

- [ ] **API error handling** – A malformed request returns proper error JSON (e.g., 400/422).  
  การจัดการข้อผิดพลาดของ API – คำขอที่ผิดรูปแบบส่งกลับ JSON error ที่เหมาะสม (เช่น 400/422)

- [ ] **Database backup** immediately before applying any schema change (if migration included).  
  สำรองฐานข้อมูลก่อนทำการเปลี่ยน schema ทุกครั้ง (หากมีการ migration)

- [ ] **Rollback plan** confirmed – how to revert code + database if needed.  
  แผนการย้อนกลับ (rollback) ยืนยันแล้ว – วิธีคืนค่าโค้ดและฐานข้อมูลหากจำเป็น

---

## 4. Post‑Deploy / หลังการปรับใช้

- [ ] **Monitor** – `/api/health/detailed` shows all subsystems healthy within first 5 minutes.  
  ติดตาม – `/api/health/detailed` แสดงว่าระบบย่อยทั้งหมดปกติภายใน 5 นาทีแรก

- [ ] **Metrics** – `/api/metrics` shows expected request rates and no abnormally high error count.  
  ตัวชี้วัด – `/api/metrics` แสดงอัตราการร้องขอตามที่คาด และไม่มีจำนวนข้อผิดพลาดที่สูงผิดปกติ

- [ ] **Audit logs** – Check `logs/audit.jsonl` has new entries after deployment.  
  บันทึก audit – ตรวจสอบ `logs/audit.jsonl` มีรายการใหม่หลังจาก deploy

- [ ] **Error monitoring** (Sentry/LogRocket/…) – zero new critical errors in dashboard.  
  การตรวจสอบข้อผิดพลาด – ไม่มีข้อผิดพลาดร้ายแรงใหม่ใน dashboard

- [ ] **Performance** – Page load times and AI response times within acceptable range.  
  ประสิทธิภาพ – เวลาโหลดหน้าเว็บและเวลาตอบกลับของ AI อยู่ในเกณฑ์ที่ยอมรับได้

- [ ] **User feedback** – No immediate user complaints about login, chat, or features.  
  ความคิดเห็นจากผู้ใช้ – ไม่มีข้อร้องเรียนทันทีเกี่ยวกับการเข้าสู่ระบบ แชท หรือฟีเจอร์

- [ ] **External integrations** (email, SMS, payment) tested with a live transaction.  
  การเชื่อมต่อภายนอก (อีเมล, SMS, การชำระเงิน) ทดสอบด้วยธุรกรรมจริง

- [ ] **Log rotation** – Confirm log files are rotated and not consuming excessive disk.  
  การหมุนเวียน log – ยืนยันว่าไฟล์ log มีการหมุนเวียนและไม่ใช้พื้นที่มากเกินไป

---

## 5. Security & Compliance / ความปลอดภัยและการปฏิบัติตามกฎหมาย

- [ ] **OWASP Top 10** scan (if automated) passed with no high‑severity findings.  
  การสแกนตาม OWASP Top 10 (หากมี) ผ่านโดยไม่มีผลการตรวจร้ายแรง

- [ ] **Content Security Policy (CSP)** header set and not blocking legitimate resources.  
  ส่วนหัว Content Security Policy (CSP) ถูกตั้งค่าและไม่ปิดกั้นทรัพยากรที่ถูกต้อง

- [ ] **Rate limiting** active on critical endpoints (login, AI chat).  
  การจำกัดอัตราการร้องขอทำงานในจุดวิกฤต (login, AI chat)

- [ ] **Data retention** policies aligned with Thai PDPA – audit confirms no unnecessary PII stored.  
  นโยบายการเก็บรักษาข้อมูลสอดคล้องกับ พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล – การตรวจสอบยืนยันว่าไม่มีการเก็บข้อมูลส่วนบุคคลเกินจำเป็น

- [ ] **Secrets rotation** – If any credential was rotated, verify old ones are revoked.  
  การหมุนเวียน secret – หากมีการเปลี่ยน credential ใด ๆ ให้ตรวจสอบว่า credential เดิมถูกยกเลิก

- [ ] **Incident response** team on-call and aware of the release.  
  ทีมตอบสนองเหตุการณ์พร้อมปฏิบัติหน้าที่และรับทราบการปล่อยเวอร์ชัน

- [ ] **All third‑party dependencies** licenses reviewed (compatible with government use).  
  ตรวจสอบสัญญาอนุญาตของไลบรารีภายนอกทั้งหมดว่าเข้ากันได้กับการใช้งานภาครัฐ

---

*Apply this checklist before every INNOMCP production release to ensure quality, security, and reliability.*  
*ใช้รายการตรวจสอบนี้ก่อนการปล่อยจริงของ INNOMCP ทุกครั้งเพื่อรับประกันคุณภาพ ความปลอดภัย และความน่าเชื่อถือ*
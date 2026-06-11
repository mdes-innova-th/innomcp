```markdown
# INNOMCP v10.17 Enhanced Security Guide (คู่มือความปลอดภัยขั้นสูง)

**คำนำ (Introduction)**  
คู่มือนี้สรุปมาตรการรักษาความปลอดภัยของ INNOMCP v10.17 ซึ่งผ่านมาตรฐานกระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (MDES) และ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)

---

## 1. API Key Management (การจัดการ API Key)
- CommandCode API key **ต้องไม่ commit ลง git** — ไฟล์ `cc_*.js` ถูกเพิ่มใน `.gitignore` แล้ว
- MDES Ollama token เก็บในตัวแปรสภาพแวดล้อม `.env` (`MDES_API_KEY`)
- Third-party provider keys (OpenAI, Anthropic, ฯลฯ) **ถูกเข้ารหัสในฐานข้อมูล** ผ่าน `ProviderModal` ด้วย encryption service
- All keys encrypted at rest and transmitted over TLS only

## 2. Middleware Security (ความปลอดภัยของ Middleware)
- `middleware.ts` ใช้ **rate limiting** และเพิ่ม HTTP security headers (CSP, X-Content-Type-Options, X-Frame-Options)
- **CSP nonce** ถูก inject ในทุก `<script>` เพื่อป้องกัน XSS โดยไม่ต้องใช้ `unsafe-inline`
- ทุกเส้นทางที่ป้องกัน (protected routes) ใช้ **JWT authentication** ตรวจสอบในทุก request
- ป้องกัน CSRF ด้วย **double-submit cookie** pattern

## 3. Data Privacy (ความเป็นส่วนตัวของข้อมูล — PDPA)
- **ไม่มี PII ใน telemetry** (no personal identifiable information in telemetry data)
- `auditLogger` บันทึกเหตุการณ์ตามข้อกำหนดของ MDES เช่น login success/fail, data access
- Session data จะถูก **encrypted at rest** ในอนาคต (อยู่ใน roadmap)
- สิทธิ์การลบข้อมูล: endpoint `/clear-history` รองรับการลบข้อมูลผู้ใช้เมื่อร้องขอ

## 4. Workspace Security (ความปลอดภัยของ Workspace)
- `workspaceService` มี `sanitizePath()` ป้องกัน path traversal (`../`, absolute path)
- จำกัดชนิดไฟล์: อนุญาตเฉพาะ `.pdf, .txt, .docx, .xlsx, .pptx, .csv, .json, .yml, .yaml, .md` เท่านั้น
- ขนาดไฟล์สูงสุด 10 MB ต่อไฟล์ (reject oversized uploads)
- Session isolation: แต่ละ session มี workspace directory แยก ไม่สามารถเข้าถึงไฟล์ข้าม session ได้

## 5. Incident Response (การตอบสนองต่อเหตุการณ์)
- `eventBus` ดักจับ `'error'` events ทั้งหมด และส่งต่อให้ `auditLogger` บันทึก
- `auditLogger` บันทึก security events (เช่น failed login, access denied) เพื่อการตรวจสอบภายหลัง
- `healthAggregator` ตรวจสอบ `/health` endpoints ของทุกบริการ (MDES API, database, external providers) และแจ้งเตือนผู้ดูแลระบบผ่าน eventBus

---

**สรุป (Conclusion)**  
INNOMCP v10.17 ตอบโจทย์ความปลอดภัยระดับสูงของภาครัฐไทย พร้อมรองรับ PDPA และแนวปฏิบัติของ MDES.  
For more details, refer to internal docs: `docs/security.md` และ `README.md` (Thai + English).
```
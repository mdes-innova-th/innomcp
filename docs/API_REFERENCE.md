# INNOMCP API Reference

เอกสาร API สำหรับแพลตฟอร์ม INNOMCP (Next.js App Router) – กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (MDES)  
All routes prefixed with `/api`. Authentication via session cookie (NextAuth) or `Authorization: Bearer <token>` header. Rate limiting: 100 req/min/IP on proxy/model endpoints; 30 req/min for uploads.

---

## GET /api/mdes/models

**Description (TH)**: ดึงรายชื่อโมเดล AI ที่พร้อมใช้งานจาก MDES Ollama  
**Description (EN)**: List all available models from the MDES Ollama inference server.

**Query params**: None

**Response**
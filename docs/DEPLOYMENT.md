# INNOMCP Deployment Guide / คู่มือการติดตั้งระบบ INNOMCP  
**กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (MDES) – Thailand’s Premier Government AI Platform**

---

## Prerequisites / ข้อกำหนดเบื้องต้น

- **Node.js** 20+ (แนะนำ 20 LTS)  
- **pnpm** 8+ (Package Manager)  
- **MariaDB** – สำหรับฐานข้อมูลของ innomcp-server-node (ควรใช้เวอร์ชัน 10.6 ขึ้นไป)  
- **Docker** (Optional) – สำหรับการติดตั้งแบบ containerized  
- **สิทธิ์เข้าถึง MDES Ollama** – URL: `https://ollama.mdes-innova.online` (ต้องมี API key ที่ออกโดย MDES)  
- **Redis** (Optional) – สำหรับ session/caching (แนะนำ Redis 7+)

---

## Environment Variables / ตัวแปรสภาพแวดล้อม

สร้างไฟล์ `.env` ใน root project และกำหนดค่าดังนี้:

| Variable | Description | Example |
|----------|-------------|---------|
| `MDES_OLLAMA_URL` | Base URL ของ MDES Ollama API | `https://ollama.mdes-innova.online` |
| `MDES_API_KEY` | API Key สำหรับเข้าถึง Ollama | `sk-xxxxx` |
| `DATABASE_URL` | MariaDB connection string | `mysql://user:pass@localhost:3306/innomcp` |
| `REDIS_URL` | Redis connection string (ถ้ามี) | `redis://localhost:6379` |
| `JWT_SECRET` | คีย์ลับสำหรับ JWT – อย่างน้อย 32 ตัวอักษร; ห้ามใช้ค่า default ใน production ระบบจะตรวจสอบความยาวตอนสตาร์ท | `aB3$kL9!pQ2@zR8...` (min 32 chars) |
| `NEXT_PUBLIC_BACKEND_URL` | URL ของฝั่ง backend สำหรับ frontend | `http://localhost:3011` |
| `NODE_ENV` | สภาพแวดล้อม | `production` หรือ `development` |

> **Security Note / หมายเหตุความปลอดภัย:** ไฟล์ `.env` ควรถูกเพิ่มลงใน `.gitignore` ทันที ห้าม commit ขึ้น repository โดยเด็ดขาด

---

## Development / การพัฒนา

ใช้คำสั่งต่อไปนี้เพื่อเริ่มระบบทั้งหมดในโหมด development (hot reload ทั้ง frontend และ backend):
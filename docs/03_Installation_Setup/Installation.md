# คู่มือการติดตั้ง (Installation Guide)

ติดตั้งง่ายๆ ใน 3 ขั้นตอนด้วย Docker Compose

## ขั้นตอนที่ 1: Clone Project
เปิด Terminal หรือ PowerShell แล้วคำสั่ง:
```bash
git clone https://github.com/your-repo/innomcp.git
cd innomcp
```

## ขั้นตอนที่ 2: ตั้งค่า Environment (.env)
เรามีไฟล์ตัวอย่างให้แล้ว ให้คัดลอกไฟล์ `.env` ที่จำเป็น:
```bash
# สำหรับ Windows PowerShell
Copy-Item .env.local.example .env.local
Copy-Item .env.hybrid.example .env
```
*หมายเหตุ: ตรวจสอบค่าในไฟล์ `.env` โดยเฉพาะ `OLLAMA_HOST` ให้ชี้ไปที่ IP ของเครื่อง Host (เช่น `http://host.docker.internal:11434`)*

## ขั้นตอนที่ 3: รันระบบ (Run)
ใช้ Docker Compose เพื่อเริ่มการทำงานทุก Service พร้อมกัน:
```bash
docker-compose up --build -d
```
*รอสักครู่เพื่อให้ระบบ Build และเริ่มทำงาน*

## การเข้าใช้งาน verify
เมื่อระบบรันเสร็จแล้ว ให้เปิด Browser ไปที่:
*   **Frontend (Chat)**: `http://localhost:3000`
*   **Backend API**: `http://localhost:3004`
*   **Tool Server**: `http://localhost:3005`

---
**Tip**: หากเจอ Error เกี่ยวกับการเชื่อมต่อ Database ให้รอสักพักแล้วรัน `docker-compose restart`

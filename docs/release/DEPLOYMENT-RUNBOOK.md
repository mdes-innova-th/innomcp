# คู่มือการติดตั้งและใช้งาน (Deployment Runbook) – innomcp (Docker Compose)

> **Status:** Refined through 10x Debug-Mantra iterations.
> **Focus:** Reproducibility, Fail-path elimination, and Environment accuracy.

## 1. ข้อกำหนดเบื้องต้น (Prerequisites)

### 1.1 ซอฟต์แวร์ที่ต้องติดตั้ง
- **Docker Desktop** (แนะนำเวอร์ชันล่าสุด) พร้อมเปิดใช้งาน **WSL 2 Backend** (สำหรับ Windows)
- **Docker Compose V2** (ตรวจสอบด้วย `docker compose version`)

### 1.2 การเตรียม Environment Variables (`.env`)
สร้างไฟล์ `.env` ที่ root directory โดยใช้ค่าเริ่มต้นดังนี้:

```env
# MariaDB Configuration
MARIADB_ROOT_PASSWORD=root_password_here
MARIADB_DATABASE=innomcp_db
MARIADB_USER=innomcp_user
MARIADB_PASSWORD=user_password_here

# API Configuration
# ใช้พอร์ตภายใน container (Internal) สำหรับ service อื่นๆ
API_INTERNAL_URL=http://api:3011
# พอร์ตที่ API expose ออกมาภายนอก (External)
API_EXTERNAL_URL=http://localhost:3015

# Frontend Configuration
# CRITICAL: ค่านี้จะถูก bake เข้าไปใน client-side bundle ต้องใช้ External URL เท่านั้น
NEXT_PUBLIC_API_URL=http://localhost:3015
```

### 1.3 พอร์ตที่ต้องว่าง (Port Mapping)
| Service | External Port | Internal Port | Description |
|---------|---------------|---------------|-------------|
| **Web** | `3000` | `3000` | Frontend Application |
| **API** | `3015` | `3011` | Backend API |
| **MariaDB**| `3308` | `3306` | Database |
| **Redis** | `6379` | `6379` | Cache/Session |

---

## 2. ขั้นตอนการติดตั้งและเริ่มระบบ (Deployment)

### 2.1 การ Build และ Start ระบบ
ใช้คำสั่งเดียวเพื่อทำการ build และรันในโหมด background:

```bash
# Build และเริ่มทำงานทุก service
docker compose up -d --build
```

### 2.2 การตรวจสอบสถานะ (Health Check)
ตรวจสอบว่าทุก Container อยู่ในสถานะ `running` และ `healthy`:

```bash
# ดูสถานะสรุปของทุก service
docker compose ps
```

**การตรวจสอบเชิงลึก (Deep Verification):**
```bash
# 1. ตรวจสอบ MariaDB: ต้องเข้าใช้งานได้และคืนค่า 1
docker compose exec mariadb mariadb -u root -p"$MARIADB_ROOT_PASSWORD" -e "SELECT 1;"

# 2. ตรวจสอบ Redis: ต้องตอบกลับด้วย PONG
docker compose exec redis redis-cli ping

# 3. ตรวจสอบ API Health: ต้องได้ response OK
curl -s http://localhost:3015/health

# 4. ตรวจสอบ Web: ต้องได้ HTML content ของหน้าแรก
curl -s http://localhost:3000
```

---

## 3. การจัดการระบบและการบำรุงรักษา (Maintenance)

### 3.1 การดู Log เพื่อ Debug
```bash
# ดู log ของทุก service แบบ realtime
docker compose logs -f

# ดู log เฉพาะ service ที่สงสัย (เช่น api)
docker compose logs -f api
```

### 3.2 การ Reset ระบบ (Hard Reset)
ในกรณีที่ฐานข้อมูลมีปัญหา หรือต้องการล้างข้อมูลทั้งหมดเพื่อเริ่มใหม่:
```bash
# หยุดการทำงานและลบ volumes (ข้อมูลใน DB จะหายทั้งหมด)
docker compose down -v

# เริ่มระบบใหม่ตั้งแต่ต้น
docker compose up -d --build
```

---

## 4. ปัญหาที่พบบ่อยและวิธีแก้ไข (Troubleshooting)

### 4.1 พอร์ตถูกใช้งานอยู่ (Port Conflict)
**อาการ:** `Error response from daemon: driver failed programming external connectivity on endpoint...`
- **วิธีแก้:** 
  1. ตรวจสอบว่ามี process อื่นใช้พอร์ตหรือไม่: `netstat -ano | findstr :3000` (Windows)
  2. ปิด process นั้น หรือเปลี่ยนพอร์ตใน `docker-compose.yml` และ `.env` แล้วรัน `docker compose up -d --build`

### 4.2 ฐานข้อมูลไม่พร้อมใช้งาน (Database Connection Error)
**อาการ:** API log แสดง `ECONNREFUSED` หรือ `Access denied for user...`
- **สาเหตุ:** 
  - `.env` รหัสผ่านไม่ตรงกับที่สร้างไว้ใน Volume
  - MariaDB ยัง boot ไม่เสร็จขณะ API เริ่มทำงาน
- **วิธีแก้:** 
  - รัน `docker compose down -v` เพื่อล้าง volume เดิมที่อาจเก็บรหัสผ่านเก่าไว้
  - ตรวจสอบว่าใช้ `MARIADB_ROOT_PASSWORD` ใน `.env` ถูกต้อง

### 4.3 หน้าเว็บเรียก API ไม่ได้ (CORS or Connection Refused)
**อาการ:** Console ใน Browser แสดง `GET http://localhost:3015/... net::ERR_CONNECTION_REFUSED`
- **สาเหตุ:** `NEXT_PUBLIC_API_URL` ใน `.env` ถูกตั้งเป็น `http://api:3011` (ซึ่งใช้ได้เฉพาะภายใน network ของ Docker)
- **วิธีแก้:** แก้เป็น `http://localhost:3015` $\rightarrow$ รัน `docker compose build web` $\rightarrow$ `docker compose up -d web`

---

## 5. ตัวอย่างไฟล์ docker-compose.yml (Standard)

```yaml
version: '3.8'

services:
  mariadb:
    image: mariadb:10.11
    container_name: innomcp-mariadb
    restart: always
    ports:
      - "3308:3306"
    env_file: .env
    volumes:
      - mariadb_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: innomcp-redis
    restart: always
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  api:
    build: 
      context: ./api
    container_name: innomcp-api
    restart: always
    ports:
      - "3015:3011"
    env_file: .env
    depends_on:
      mariadb:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build: 
      context: ./web
    container_name: innomcp-web
    restart: always
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      api:
        condition: service_started

volumes:
  mariadb_data:

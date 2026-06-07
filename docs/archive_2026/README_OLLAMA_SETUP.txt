# 📘 Ollama Standalone Setup - Complete Guide

## สรุปการเปลี่ยนแปลง

✅ **docker-compose.yml** ถูกปรับปรุงแล้ว:
- ลบ Ollama service ออก
- เปลี่ยน OLLAMA_HOST ใหม่: `http://host.docker.internal:11434`
- ลบ dependencies ไปยัง Ollama

---

## 🖥️ การติดตั้ง Ollama บน Windows

### Step 1: ดาวน์โหลด Ollama
1. ไปที่ https://ollama.ai
2. ดาวน์โหลด "Ollama for Windows"
3. เปิด installer และทำตามขั้นตอน
4. ติดตั้งที่ตำแหน่ง default

### Step 2: เปิด Ollama Service
```powershell
# เปิด PowerShell (ปกติ หรือ Terminal)
ollama serve

# ถ้าใช้ได้ คุณจะเห็น:
# Serving on http://127.0.0.1:11434
```

### Step 3: ตรวจสอบ Ollama เปิดสำเร็จ
```powershell
# ใน terminal อื่น ให้รัน:
curl http://localhost:11434/api/tags

# ถ้าเห็น JSON response = สำเร็จ
```

### Step 4: ดาวน์โหลด Model
```powershell
# ดาวน์โหลด llama2 (โมเดลที่ project ใช้)
ollama pull llama2

# สามารถลองโมเดลอื่นได้:
ollama pull mistral       # เร็ว (5GB)
ollama pull neural-chat   # สมดุล (4GB)
ollama pull openhermes    # คุณภาพสูง (5GB)

# ตรวจสอบว่าดาวน์โหลดสำเร็จ:
ollama list
```

### Step 5: ตั้งค่า GPU (ถ้ามี NVIDIA GPU)

#### ตรวจสอบ GPU
```powershell
nvidia-smi
# ถ้าเห็นข้อมูล GPU = มี GPU ที่ใช้ได้
```

#### ตั้งค่า Environment Variable
**วิธี A: Temporary (Session นี้เท่านั้น)**
```powershell
$env:OLLAMA_RUNNER_CUDA='1'
ollama serve
```

**วิธี B: Permanent (ถาวร)**
1. กด `Win + X` → เลือก "System"
2. ไปที่ "Advanced system settings"
3. ไปที่ "Environment Variables"
4. ภายใต้ "User variables" คลิก "New"
5. ตั้งค่า:
   - Variable name: `OLLAMA_RUNNER_CUDA`
   - Variable value: `1`
6. คลิก OK และ Apply
7. Restart Ollama

---

## 🐳 การสตาร์ท Docker + Ollama

### ตัวเลือก A: ใช้ Script (ง่ายที่สุด)

```powershell
# 1. ปิด PowerShell ที่เปิด Ollama ไว้ (หรือปล่อยให้ทำงานเบื้องหลัง)

# 2. เปิด PowerShell ใหม่ แล้วรัน:
cd C:\Users\USER-NT\DEV\innomcp
.\start-all.ps1

# Script จะช่วยตรวจสอบทุกอย่างและเปิด Docker containers
```

### ตัวเลือก B: Manual (เข้าใจการทำงานมากขึ้น)

**Terminal 1: เปิด Ollama**
```powershell
ollama serve
# เปิดไว้เสมอในทำงาน
```

**Terminal 2: เปิด Docker**
```powershell
cd C:\Users\USER-NT\DEV\innomcp

# ลบ containers เก่า
docker compose down

# สร้าง build ใหม่และเปิด
docker compose up --build
```

---

## ✅ ตรวจสอบว่าทุกอย่างทำงาน

### 1️⃣ ตรวจสอบ Ollama
```powershell
# ในเบราว์เซอร์เปิด:
http://localhost:11434

# ถ้าเห็น "Ollama is running" = ✅ สำเร็จ
```

### 2️⃣ ตรวจสอบ Docker Containers
```powershell
docker ps

# ควรเห็น containers:
# - innomcp-next
# - innomcp-node
# - innomcp-server-node
# - innomcp-mariadb
# - innomcp-redis
```

### 3️⃣ ตรวจสอบ Docker สามารถเชื่อมต่อ Ollama
```powershell
docker exec innomcp-node curl -v http://host.docker.internal:11434/api/tags

# ถ้าเห็น:
# {"models":[{"name":"llama2:latest","... = ✅ สำเร็จ
```

### 4️⃣ ตรวจสอบ Chat API
```powershell
# เปิดเบราว์เซอร์:
http://localhost:3004

# ลองพิมพ์: "สวัสดี"
# ถ้าได้คำตอบ = ✅ ระบบสำเร็จทั้งหมด!
```

---

## 🔧 Troubleshooting

### ❌ Docker ไม่เชื่อมต่อ Ollama

**สาเหตุ**: `host.docker.internal` อาจไม่ทำงาน

**วิธีแก้**:
```powershell
# 1. เช็ก Docker Desktop Settings
# Settings > General > ตรวจสอบ "Expose daemon on tcp://localhost:2375"

# 2. ลองใช้ IP address แทน
docker inspect host.docker.internal

# 3. หากต้อง Manual, ไปที่ docker-compose.yml เปลี่ยน:
# OLLAMA_HOST=http://host.docker.internal:11434
# เป็น:
# OLLAMA_HOST=http://<YOUR_LOCAL_IP>:11434
# เช่น: http://192.168.1.100:11434
```

### ❌ Ollama ไม่มี Model

```powershell
# ดาวน์โหลด llama2
ollama pull llama2

# ตรวจสอบ
ollama list
```

### ❌ GPU ไม่ทำงาน

```powershell
# 1. เช็ก NVIDIA drivers
nvidia-smi

# 2. ดูว่า environment variable set แล้ว
echo $env:OLLAMA_RUNNER_CUDA

# 3. ดู Ollama logs
# ลองค้นหา "nvidia" ในการเรียก ollama serve
```

### ❌ Container ติด Error

```powershell
# ดูเหตุผล
docker logs innomcp-node

# ถ้าเห็น "Cannot connect to Ollama"
# แสดงว่า Docker ไม่เชื่อมต่อ Ollama ได้
# ให้เช็ก Step ด้านบน
```

---

## 📊 Architecture ที่เก่า vs ใหม่

### ❌ Old (Docker Ollama - ไม่ใช้แล้ว)
```
Windows Host
    └─ Docker Desktop
       ├─ innomcp-next (port 3004)
       ├─ innomcp-node (port 3010) ──→ ollama:11434 (Docker container)
       ├─ innomcp-server-node (port 3011)
       ├─ mariadb (port 3306)
       ├─ redis (port 6379)
       └─ ollama (port 11434) ← GPU?
```

### ✅ New (Standalone Ollama)
```
Windows Host
    ├─ ollama serve (localhost:11434) ← GPU ของเครื่องโดยตรง
    │
    └─ Docker Desktop
       ├─ innomcp-next (port 3004)
       ├─ innomcp-node (port 3010) ──→ host.docker.internal:11434
       ├─ innomcp-server-node (port 3011)
       ├─ mariadb (port 3306)
       └─ redis (port 6379)
```

**ข้อดี**:
- ✅ GPU ทำงานได้ดีกว่า (ไม่ผ่าน virtualization)
- ✅ ง่ายในการ debug
- ✅ ไม่ต้อง NVIDIA Container Runtime

---

## 📁 ไฟล์ที่สร้างขึ้น

- ✅ `docker-compose.yml` - ปรับปรุงแล้ว (ลบ Ollama service)
- ✅ `OLLAMA_SETUP_GUIDE.md` - คำแนะนำโดยละเอียด
- ✅ `QUICK_START.md` - เริ่มต้นเร็ว
- ✅ `start-all.ps1` - Script เปิดทุกอย่างโดยอัตโนมัติ
- ✅ `.env-ollama` - ตัวแปร environment (สำหรับอ้างอิง)

---

## 🚀 Quick Start Command

```powershell
# Terminal 1: เปิด Ollama
ollama serve

# Terminal 2: เปิด Docker + Project
cd C:\Users\USER-NT\DEV\innomcp
.\start-all.ps1

# หรือ manual:
docker compose down
docker compose up --build
```

---

## 📞 Support

**ถ้ามีปัญหา ให้ตรวจสอบ**:
1. ✅ Ollama Server ทำงาน (localhost:11434)
2. ✅ Model ถูก download (ollama list)
3. ✅ Docker Desktop ทำงาน
4. ✅ Docker containers เปิด (docker ps)
5. ✅ Docker สามารถเชื่อมต่อ Ollama ได้

**Resource**:
- Ollama: https://ollama.ai
- Docker: https://docker.com
- นี้: OLLAMA_SETUP_GUIDE.md (คำแนะนำโดยละเอียด)

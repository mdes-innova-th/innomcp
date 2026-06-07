# 🎯 Ollama Installation for Windows - Step by Step

## 📥 Step 1: ดาวน์โหลด Ollama

### วิธี A: ใช้เบราว์เซอร์ (ง่ายที่สุด)
1. เปิดเบราว์เซอร์ไปที่: **https://ollama.ai**
2. ค้นหา "Download" button
3. เลือก "Ollama for Windows" 
4. ไฟล์ `OllamaSetup.exe` จะถูก download

### วิธี B: ใช้ Command Line
```powershell
# เปิด PowerShell เป็น Administrator
# Download Ollama installer
curl -o $env:TEMP\OllamaSetup.exe https://ollama.ai/download/windows/OllamaSetup.exe

# เรียกใช้ installer
& $env:TEMP\OllamaSetup.exe
```

---

## 🔧 Step 2: ติดตั้ง Ollama

1. **เปิด OllamaSetup.exe**
   - ดับเบิลคลิก: `OllamaSetup.exe`

2. **ยอมรับ License**
   - อ่านและคลิก "I Agree"

3. **เลือก Install Location** (แนะนำใช้ default)
   - Path: `C:\Users\<YourUsername>\AppData\Local\Programs\Ollama`
   - คลิก "Next"

4. **เสร็จสิ้น Installation**
   - คลิก "Finish"
   - Ollama จะเปิดอยู่เบื้องหลัง

---

## 📍 Step 3: ตรวจสอบการติดตั้ง

### เปิด PowerShell และรัน:
```powershell
# ตรวจสอบ Ollama version
ollama --version

# Output ควรแสดง: ollama version 0.x.x
```

### ถ้าคำสั่ง `ollama` ไม่ทำงาน:
```powershell
# ลองใช้ full path
& "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama\ollama.exe" --version

# หรือเพิ่มเข้า PATH (ใน PowerShell Admin):
$ollama_path = "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$ollama_path", "User")

# Restart PowerShell และลองอีกครั้ง
ollama --version
```

---

## 🚀 Step 4: เปิด Ollama Service

### วิธี A: ใช้ GUI (ง่าย)
```
- Windows จะมี Ollama icon ใน System Tray
- Ollama จะเปิดโดยอัตโนมัติเมื่อ restart
- ไม่ต้องทำอะไรเพิ่มเติม
```

### วิธี B: ใช้ Command Line
```powershell
# เปิด PowerShell (ปกติ หรือ Terminal)
ollama serve

# Output:
# Serving on http://127.0.0.1:11434
# Listening on [::]:11434 ...
```

**ปล.** เก็บ terminal นี้ไว้เปิดเสมอ (หรือให้ทำงานเบื้องหลัง)

---

## ✅ Step 5: ตรวจสอบ Ollama Server

### เปิด Terminal ใหม่:
```powershell
# ทดสอบ HTTP request
curl http://localhost:11434

# ถ้าเห็น "Ollama is running" = ✅ สำเร็จ
```

---

## 📦 Step 6: ดาวน์โหลด Model

### ดาวน์โหลด Model สำหรับ Project
```powershell
# ดาวน์โหลด llama2 (โมเดลที่ project ใช้)
ollama pull llama2

# Output จะแสดง progress:
# 100%
# verifying sha256 digest
# writing manifest
```

**สำคัญ**: ขั้นตอนนี้ใช้เวลา 10-30 นาที ขึ้นอยู่กับความเร็ว Internet

### ลองใช้ Model อื่น (Optional)
```powershell
# ตัวเลือก 1: Mistral (เร็ว, 5GB)
ollama pull mistral

# ตัวเลือก 2: Neural Chat (สมดุล, 4GB)
ollama pull neural-chat

# ตัวเลือก 3: Open Hermes (คุณภาพดี, 5GB)
ollama pull openhermes
```

### ตรวจสอบว่าดาวน์โหลดสำเร็จ
```powershell
# ดูรายการ models ที่ download แล้ว
ollama list

# Output:
# NAME                DESCRIPTION    SIZE     MODIFIED
# llama2:latest       ...            3.8 GB   12 hours ago
```

---

## 🎮 Step 7: ทดสอบ Ollama API

### Test 1: ดูรายการ Models
```powershell
curl http://localhost:11434/api/tags

# ถ้าเห็น models = ✅ สำเร็จ
```

### Test 2: ทดสอบ Chat
```powershell
# PowerShell Script
$body = @{
    model = "llama2"
    prompt = "สวัสดี ชื่อของคุณคืออะไร"
    stream = $false
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:11434/api/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$response.Content | ConvertFrom-Json | Select-Object -ExpandProperty response
```

---

## 🖥️ Step 8: ตั้งค่า GPU Support (Optional but Recommended)

### ตรวจสอบ NVIDIA GPU
```powershell
# ลองรัน nvidia-smi
nvidia-smi

# ถ้าเห็น GPU info = มี GPU ที่ใช้ได้
# ถ้าไม่เห็น = ไม่มี NVIDIA GPU หรือ drivers ไม่ติดตั้ง
```

### ติดตั้ง NVIDIA Drivers (ถ้าต้อง)
1. ไปที่: https://www.nvidia.com/Download/driverDetails.aspx
2. เลือก GPU ของคุณ
3. ดาวน์โหลดและติดตั้ง driver ล่าสุด
4. Restart computer

### เปิด GPU Support
**วิธี A: Temporary (Session นี้)**
```powershell
# ตั้งค่า environment variable
$env:OLLAMA_RUNNER_CUDA='1'

# เปิด Ollama ใหม่
ollama serve

# Ollama logs จะแสดง: "CUDA device: <GPU Name>"
```

**วิธี B: Permanent (ทุก session)**
1. กด `Win + X` → เลือก "System"
2. เลื่อนลงและคลิก "Advanced system settings"
3. คลิก "Environment Variables" button
4. ภายใต้ "User variables for <username>" คลิก "New"
5. ตั้งค่า:
   - Variable name: `OLLAMA_RUNNER_CUDA`
   - Variable value: `1`
6. คลิก OK สองครั้ง
7. **Restart computer** หรือ restart Ollama service

### ตรวจสอบ GPU ทำงาน
```powershell
# เมื่อ Ollama serve กำลังทำงาน ลองสั่ง:
ollama pull mistral

# ดู Task Manager > GPU tab
# GPU utilization ควรเพิ่มขึ้น
```

---

## 🐳 Step 9: สตาร์ท Docker + Project

### Terminal 1: เก็บ Ollama ไว้เปิด
```powershell
ollama serve
# เปิดไว้ตลอดเวลา
```

### Terminal 2: เปิด Docker
```powershell
# ไปที่ project directory
cd C:\Users\USER-NT\DEV\innomcp

# ดาวน์โหลด images และเปิด containers
docker compose up --build

# ถ้าปรับแล้ว เลือก y เมื่อถาม
```

### ตรวจสอบทุกอย่างทำงาน
```powershell
# Terminal ใหม่: ตรวจสอบ containers
docker ps

# ควรเห็น:
# - innomcp-next
# - innomcp-node
# - innomcp-server-node
# - innomcp-mariadb
# - innomcp-redis
```

---

## 🌐 Step 10: เข้าใช้ Application

### เปิดเบราว์เซอร์ไปที่:
- **Frontend**: http://localhost:3004
- **API**: http://localhost:3010/health
- **MCP Server**: http://localhost:3011

### ลองใช้ Chat
1. เปิด http://localhost:3004
2. พิมพ์: "สวัสดี" หรือ "Hello"
3. ควรได้ response จาก Ollama ← **สำเร็จ!**

---

## 🔧 Troubleshooting

### ❌ `ollama` command not found
```powershell
# เพิ่ม Ollama ไปยัง PATH
$ollama_path = "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama"
$env:Path += ";$ollama_path"

# หรือใช้ full path:
& "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama\ollama.exe" serve
```

### ❌ Cannot download model
```powershell
# เช็ก Internet connection
Test-NetConnection -ComputerName ollama.ai -Port 443

# ลองใช้ VPN หรือเปลี่ยน DNS
# ลองดาวน์โหลด model ที่เล็กกว่า:
ollama pull tinyllama
```

### ❌ GPU ไม่ทำงาน
```powershell
# ตรวจสอบ NVIDIA Drivers
nvidia-smi

# เช็ก environment variable
echo $env:OLLAMA_RUNNER_CUDA

# ลอง reinstall drivers และ restart
```

### ❌ Docker ไม่เชื่อมต่อ Ollama
```powershell
# ตรวจสอบ Ollama port
curl http://localhost:11434/api/tags

# ตรวจสอบ Docker Desktop settings
# Settings > General > ตรวจสอบ "Expose daemon on tcp://localhost:2375"

# ลองตัด-เปิด Docker Desktop ใหม่
```

---

## 📊 Resource Requirements

| Component | Recommended | Minimum |
|-----------|------------|---------|
| RAM | 16GB+ | 8GB |
| GPU | NVIDIA RTX 3070+ | NVIDIA GTX 1660+ |
| Disk | 50GB SSD | 30GB |
| Network | 100Mbps | 10Mbps |

---

## 🎓 Learning More

- **Ollama Documentation**: https://github.com/ollama/ollama
- **Model Library**: https://ollama.ai/library
- **API Reference**: https://github.com/ollama/ollama/blob/main/docs/api.md
- **Community**: https://discord.gg/ollama

---

## ✨ เสร็จแล้ว!

ถ้าทั้งหมด ✅ สำเร็จ:
- ✅ Ollama ติดตั้งเรียบร้อย
- ✅ Model ดาวน์โหลดสำเร็จ
- ✅ Docker containers ทำงาน
- ✅ Chat API ทำงาน

🎉 **ยินดีด้วย! ระบบของคุณพร้อมใช้งาน**

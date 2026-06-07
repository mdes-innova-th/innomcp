# Ollama Standalone Setup Guide for Windows

## Step 1: ติดตั้ง Ollama บน Windows

### ตัวเลือก A: ใช้ Installer (ง่ายที่สุด)
1. ไปที่เว็บไซต์ https://ollama.ai
2. ดาวน์โหลด **Ollama for Windows**
3. คลิก installer และติดตั้ง
4. ปล่อยให้ใช้ path ที่ default: `C:\Users\<YourUsername>\AppData\Local\Programs\Ollama`

### ตัวเลือก B: ใช้ Scoop (สำหรับ Advanced Users)
```powershell
# ติดตั้ง Scoop หากยังไม่มี
iwr -useb get.scoop.sh | iex

# ติดตั้ง Ollama ผ่าน Scoop
scoop install ollama
```

---

## Step 2: ตรวจสอบการติดตั้ง

```powershell
# ตรวจสอบ Ollama เวอร์ชัน
ollama --version

# ควรแสดง output คล้ายกับ: ollama version 0.1.32
```

---

## Step 3: ตั้งค่า GPU Support (ถ้ามี NVIDIA GPU)

### เช็ก GPU
```powershell
# ตรวจสอบ NVIDIA GPU
nvidia-smi
```

### ตั้งค่า Environment Variables
```powershell
# เปิด PowerShell เป็น Administrator
# วิธี 1: ตั้งค่า Temporary (เฉพาะ session นี้)
$env:OLLAMA_RUNNER_CUDA='1'

# วิธี 2: ตั้งค่า Permanent (ทุก session)
# 1. กด Win+X แล้วเลือก "System"
# 2. ไปที่ "Advanced system settings"
# 3. ไปที่ "Environment Variables"
# 4. คลิก "New" ภายใต้ "User variables"
# 5. Variable name: OLLAMA_RUNNER_CUDA
#    Variable value: 1
# 6. คลิก OK และ Apply

# หรือใช้ PowerShell Admin:
[Environment]::SetEnvironmentVariable("OLLAMA_RUNNER_CUDA", "1", "User")
```

---

## Step 4: ดาวน์โหลด Model สำหรับ Ollama

```powershell
# เปิด PowerShell และเรียกใช้คำสั่งนี้
# ดาวน์โหลด llama2 (โมเดลที่ใช้ใน project)
ollama pull llama2

# หรือใช้โมเดลอื่น (แนะนำสำหรับ Thai):
ollama pull mistral        # ขนาด 5GB - เร็ว
ollama pull neural-chat    # ขนาด 4GB - เร็ว
ollama pull openhermes     # ขนาด 5GB - คุณภาพดี
```

**หมายเหตุ:** คำสั่ง `ollama pull` จะดาวน์โหลด model ไปที่:
```
C:\Users\<YourUsername>\AppData\Local\Ollama\models
```

---

## Step 5: เปิด Ollama Service

### ปกติ Ollama จะทำงานอยู่เสมอหลังติดตั้ง

```powershell
# ตรวจสอบว่า Ollama Server กำลังทำงาน
# เปิดเบราว์เซอร์ไปที่: http://localhost:11434

# ถ้าเห็นข้อความ 'Ollama is running' = ติดตั้งสำเร็จ

# ถ้าหากต้องเปิด Ollama ด้วยตนเอง:
ollama serve
```

---

## Step 6: ทดสอบ API

```powershell
# Test Ollama API
$body = @{
    model = "llama2"
    prompt = "สวัสดี"
    stream = $false
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:11434/api/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$response.Content | ConvertFrom-Json | Select-Object -ExpandProperty response
```

---

## Step 7: ปรับการตั้งค่า Docker

docker-compose.yml ได้รับการปรับปรุงแล้วให้ใช้ `host.docker.internal:11434`

ไฟล์ได้รับการเปลี่ยนแปลง:
- ลบ `ollama` service ออกจาก docker-compose.yml
- เปลี่ยน `OLLAMA_HOST=http://ollama:11434` → `OLLAMA_HOST=http://host.docker.internal:11434`
- ลบ `- ollama` จาก `depends_on`

---

## Step 8: เริ่มโปรเจค

```powershell
# 1. เปิด Ollama (ถ้ายังไม่เปิด)
ollama serve

# 2. ในหน้าต่าง Terminal ใหม่ ไปที่ project folder
cd C:\Users\USER-NT\DEV\innomcp

# 3. เริ่ม Docker containers (ไม่รวม Ollama)
docker compose down
docker compose up --build

# 4. ตรวจสอบว่า containers ทำงาน
docker ps
```

---

## Step 9: ตรวจสอบการเชื่อมต่อ

### ตรวจสอบจาก Container
```powershell
# ดูว่า Docker container สามารถเชื่อมต่อ Ollama ได้ไหม
docker exec innomcp-node curl -v http://host.docker.internal:11434/api/tags

# ถ้าแสดงรายการ model = สำเร็จ
```

### ตรวจสอบจาก Logs
```powershell
# ดูโค้ดจาก innomcp-node
docker logs innomcp-node

# ต้องเห็น message เช่น:
# [Chat API] Calling ollama.chat with model: llama2 ✨
# [MCP Client] Statistics: { connectedClients: 1, availableTools: 6, ... }
```

---

## Troubleshooting

### ปัญหา: Docker ไม่สามารถเชื่อมต่อ Ollama
```powershell
# ตรวจสอบ:
# 1. Ollama Service ทำงานหรือไม่?
curl http://localhost:11434/api/tags

# 2. Docker Desktop settings อนุญาต host.docker.internal หรือไม่?
# - เปิด Docker Desktop Settings
# - ไป "General"
# - ตรวจสอบ "Expose daemon on tcp://localhost:2375 without TLS"
```

### ปัญหา: GPU ไม่ถูกใช้
```powershell
# 1. เช็ก NVIDIA drivers
nvidia-smi

# 2. ตรวจสอบตัวแปร environment
$env:OLLAMA_RUNNER_CUDA

# 3. Restart Ollama service เพื่อให้ config มีผล
# ปิด command window ที่ Ollama เปิด และเปิดใหม่
```

### ปัญหา: Model ไม่ downloadได้
```powershell
# 1. เช็ก disk space (ต้อง 20GB+ สำหรับหลายๆ model)
Get-Volume

# 2. ลองใช้ model ที่เล็กกว่า
ollama pull tinyllama

# 3. เช็ก Internet connection
Test-NetConnection -ComputerName ollama.ai -Port 443
```

---

## Performance Tips

### 1. ปรับขนาด Model ตามการใช้งาน
```
- tiny model (1-3GB): ตอบเร็ว, คุณภาพน้อย → ทดสอบ
- small model (5-7GB): สมดุล → แนะนำ  
- large model (10GB+): ตอบช้า, คุณภาพสูง → ไม่แนะนำใน local
```

### 2. ปรับ Parameters สำหรับ Ollama
```powershell
# ใน mcpclient.ts ปรับ:
const DEFAULT_OLLAMA_OPTIONS = {
  temperature: 0.2,      // 0-1 ต่ำ=ถูกต้อง, สูง=สร้างสรรค์
  num_predict: 500,      # จำนวน tokens ที่ generate
  num_ctx: 2048,         # Context window size
};
```

### 3. ใช้ Web UI ของ Ollama (Optional)
```powershell
# ติดตั้ง Ollama Web UI
git clone https://github.com/ollama-ui/ollama-ui.git
cd ollama-ui
docker build -t ollama-ui .
docker run -p 3001:80 ollama-ui

# เปิด http://localhost:3001
```

---

## Reference

- **Ollama Official**: https://ollama.ai
- **Model Library**: https://ollama.ai/library
- **API Documentation**: https://github.com/ollama/ollama/blob/main/docs/api.md

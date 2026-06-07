# 🚀 วิธีใช้งาน Chat AI กับ Local Ollama GPU

## ⚡ เริ่มต้นง่ายๆ 3 ขั้นตอน

### 1️⃣ ตรวจสอบ Ollama ทำงานอยู่
```bash
# เช็คว่า Ollama พร้อมใช้งาน
curl http://localhost:11434
```

หรือเปิด browser: `http://localhost:11434` ต้องเห็น "Ollama is running"

### 2️⃣ เริ่ม Services ทั้งหมด

**วิธีที่ 1: ใช้ PowerShell Script (แนะนำ)**
```powershell
cd C:\Users\USER-NT\DEV\innomcp

# Kill ports ก่อน (ถ้ามี process เก่า)
.\KILL-PORTS.ps1

# เริ่มทั้ง 3 services
.\START-ALL-SERVICES.ps1
```

**วิธีที่ 2: เปิด Terminal แยก (3 หน้าต่าง)**

Terminal 1 - Backend:
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-node
npm run dev
```

Terminal 2 - MCP Server:
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-server-node
npm run dev
```

Terminal 3 - Frontend:
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-next
npm run dev
```

### 3️⃣ เปิดใช้งาน Chat AI

เปิด browser: **http://localhost:3000**

🎉 **พร้อมใช้งานเลย! ไม่ต้อง Login**

---

## 🎯 ฟีเจอร์ที่ใช้งานได้

### ✨ Chat AI ด้วย Local Ollama GPU
- Model: **gemma3:4b** (รวดเร็ว, ประหยัด GPU)
- ตอบเป็นภาษาไทยธรรมชาติ
- จำประวัติการสนทนา
- แสดงผลแบบ Markdown สวยงาม

### 🔧 MCP Tools (ใช้งานอัตโนมัติ)
AI จะเลือกใช้ tools เหล่านี้เองตามคำถาม:

1. **dateTimeTool** - วันที่ เวลา ปฏิทิน
   - "วันนี้วันอะไร"
   - "ตอนนี้กี่โมงแล้ว"

2. **tmdTool** - พยากรณ์อากาศทั่วประเทศไทย
   - "วันนี้อากาศเป็นอย่างไร"
   - "จังหวัดไหนฝนตกบ้าง"
   - "อุณหภูมิกรุงเทพ"

3. **webdTool** - ตรวจสอบเว็บไซต์ผิดกฎหมาย
   - "ตรวจสอบเว็บ example.com"
   - "โดเมนนี้ถูกกฎหมายไหม"

4. **echartsTool** - สร้างกราฟและแผนภูมิ
   - "สร้างกราฟยอดขาย"
   - "แสดงแผนภูมิวงกลม"

---

## 🔍 ตรวจสอบการทำงาน

### ✅ เช็คว่า Services พร้อม
```powershell
# Backend health check
curl http://localhost:3011/health

# Frontend
curl http://localhost:3000

# MCP Server
curl http://localhost:3012
```

### 📋 ดู Logs
```bash
# ถ้าใช้ START-ALL-SERVICES.ps1 ดูได้จากหน้าต่าง PowerShell แต่ละตัว
# หรือถ้า run แบบ background:
tail -f /tmp/backend.log
tail -f /tmp/mcpserver.log
tail -f /tmp/frontend.log
```

---

## ⚙️ การตั้งค่าสำคัญ

### Backend (.env)
```env
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
OLLAMA_TIMEOUT=60000
OLLAMA_MAX_RETRIES=2

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=<REDACTED_USER>
DB_PASSWORD=<REDACTED>
DB_NAME=innomcp-db

# Ports
SERVER_PORT=3011
```

### Frontend (.env.local)
```env
# Auth Mode: 'optional' = ไม่ต้อง login
NEXT_PUBLIC_AUTH_MODE=optional

# WebSocket
NEXT_PUBLIC_NODE_WS_HOST=ws://localhost:3011
```

---

## 💡 Tips การใช้งาน

### 1. ถามคำถามที่ชัดเจน
✅ ดี: "วันนี้กรุงเทพอากาศเป็นอย่างไร"  
❌ ไม่ดี: "อากาศ"

### 2. ใช้บริบทจากการสนทนาก่อนหน้า
```
คุณ: "วันนี้วันอะไร"
AI:  "วันนี้วันที่ 20 ธันวาคม 2567"
คุณ: "อีก 5 วันคือวันอะไร"  ← AI จะจำบริบท
```

### 3. ขอดูข้อมูลแบบสรุป
- "สรุปสภาพอากาศทั่วประเทศ"
- "แสดงเป็น bullet points"
- "ทำเป็นตารางให้หน่อย"

### 4. ขอสร้าง Visualization
- "สร้างกราฟแท่งยอดขาย"
- "แสดงเป็นแผนภูมิวงกลม"

---

## 🐛 แก้ปัญหา

### ❌ Chat ไม่ตอบ / WebSocket Error
```powershell
# 1. Kill all processes
.\KILL-PORTS.ps1

# 2. เริ่มใหม่
.\START-ALL-SERVICES.ps1

# 3. รอ 10 วินาที แล้ว refresh browser
```

### ❌ Port Already in Use
```powershell
# ใช้ script kill ports
.\KILL-PORTS.ps1
```

### ❌ Ollama Not Responding
```bash
# Restart Ollama service
ollama serve

# หรือ check process
ps aux | grep ollama
```

### ❌ MCP Tools ไม่ทำงาน
```bash
# เช็ค MCP Server logs
# ดูว่า tools loaded หรือยัง
# ต้องเห็น: "Tool loaded from innomcp-server: dateTimeTool"
```

---

## 📊 สถานะระบบ

| Service | Port | Status | URL |
|---------|------|--------|-----|
| Frontend | 3000 | ✅ | http://localhost:3000 |
| Backend | 3011 | ✅ | http://localhost:3011 |
| MCP Server | 3012 | ✅ | http://localhost:3012 |
| MariaDB | 3306 | ✅ | localhost:3306 |
| Ollama | 11434 | ✅ | http://localhost:11434 |

---

## 🎨 ตัวอย่างการใช้งาน

### 💬 สนทนาธรรมดา
```
คุณ: "สวัสดี"
AI:  "สวัสดีครับ! มีอะไรให้ช่วยไหมครับ"
```

### 📅 ถามวันเวลา
```
คุณ: "วันนี้วันอะไร"
AI:  "# วันนี้
     วันที่ 20 ธันวาคม พ.ศ. 2567
     วันศุกร์"
```

### 🌦️ ถามสภาพอากาศ
```
คุณ: "จังหวัดไหนฝนตกบ้าง"
AI:  "# สรุปสภาพอากาศวันนี้
     
     ## จังหวัดที่มีฝนตก
     - เชียงใหม่ - ฝนฟ้าคะนอง 60%
     - กรุงเทพมหานคร - ฝนเล็กน้อย 20%
     - สงขลา - ฝนตก 80%"
```

### 📊 สร้างกราฟ
```
คุณ: "สร้างกราฟยอดขายรายเดือน"
AI:  [แสดงกราฟ ECharts แบบ Interactive]
```

---

## 🚀 Performance Tips

### ⚡ ทำให้ตอบเร็วขึ้น

1. **ใช้ Model เล็ก**
   - gemma3:4b ← แนะนำ (เร็ว)
   - gemma3:1b ← เร็วมาก แต่คุณภาพลดลง

2. **GPU Memory**
   - ปิดโปรแกรมที่ใช้ GPU อื่นๆ
   - ใช้ `nvidia-smi` เช็ค GPU usage

3. **Backend Optimization**
   - เพิ่ม OLLAMA_TIMEOUT ถ้าคำตอบยาว
   - ลด MAX_RETRIES ถ้าต้องการตอบเร็ว

---

## 📝 สรุป

✅ **ใช้งานได้เลยโดยไม่ต้อง Login**  
✅ **Local Ollama GPU รวดเร็ว**  
✅ **MCP Tools ทำงานอัตโนมัติ**  
✅ **Markdown สวยงาม**  
✅ **จำบริบทการสนทนา**

---

## 🆘 ต้องการความช่วยเหลือ?

1. เช็ค logs ในหน้าต่าง PowerShell
2. ดู browser console (F12)
3. ตรวจสอบ OLLAMA_HOST และ ports
4. Restart ทั้งระบบด้วย KILL-PORTS.ps1 + START-ALL-SERVICES.ps1

**Have fun with your AI Chat! 🎉**

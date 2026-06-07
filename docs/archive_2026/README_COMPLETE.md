# ✨ INNOMCP Chat AI - ระบบพร้อมใช้งาน!

## 🎯 สิ่งที่แก้ไขให้แล้ว

### 1. ✅ ไม่ต้อง Login
- เพิ่ม `NEXT_PUBLIC_AUTH_MODE=optional` ใน `.env.local`
- แก้ `AuthContext.tsx` ให้ skip auth check
- ตอนนี้เปิด http://localhost:3000 ใช้งาน Chat ได้เลย!

### 2. ✅ WebSocket Configuration
- เพิ่ม `NEXT_PUBLIC_NODE_WS_HOST=ws://localhost:3011`
- Frontend จะเชื่อมต่อ Backend WebSocket อัตโนมัติ
- Real-time streaming response

### 3. ✅ System Prompt ปรับปรุงใหม่
Backend [chat.ts](innomcp-node/src/routes/api/chat.ts#L289-L305) มี prompt ใหม่:

**ฟีเจอร์หลัก:**
- 🎯 ตอบรวดเร็ว กระชับ ตรงประเด็น
- 📝 Markdown formatting สวยงาม (headings, bullets, bold, code blocks)
- 🧠 จำบริบทการสนทนา
- 🔧 ใช้ MCP tools อัตโนมัติแบบชาญฉลาด
- 🚫 ไม่เปิดเผยการทำงานภายใน (ไม่บอกว่าใช้ tools อะไร)
- 🇹🇭 ตอบเป็นภาษาไทยธรรมชาติ

### 4. ✅ MCP Tools Integration
AI จะเลือกใช้ tools เหล่านี้อัตโนมัติ:

| Tool | ใช้เมื่อ | ตัวอย่าง |
|------|---------|----------|
| **dateTimeTool** | ถามวัน เวลา | "วันนี้วันอะไร" |
| **tmdTool** | ถามอากาศ | "จังหวัดไหนฝนตก" |
| **webdTool** | เช็คเว็บผิดกฎหมาย | "ตรวจสอบ example.com" |
| **echartsTool** | สร้างกราฟ | "สร้างกราฟยอดขาย" |

### 5. ✅ Local Ollama GPU Optimized
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma3:4b  ← รวดเร็ว GPU-friendly
OLLAMA_TIMEOUT=60000    ← 60 วินาที
OLLAMA_MAX_RETRIES=2    ← retry 2 ครั้ง
```

---

## 🚀 วิธีเริ่มใช้งาน (3 ขั้นตอน)

### ขั้นตอนที่ 1: เช็ค Ollama
```bash
# เช็คว่า Ollama ทำงานอยู่
curl http://localhost:11434
# ต้องเห็น: "Ollama is running"

# เช็คว่ามี model gemma3:4b
ollama list
# ถ้าไม่มี ให้ pull:
ollama pull gemma3:4b
```

### ขั้นตอนที่ 2: เริ่ม Services

**วิธีที่ 1: ใช้ Batch Script (ง่ายสุด!)**
```batch
cd C:\Users\USER-NT\DEV\innomcp
QUICK-START.bat
```

**วิธีที่ 2: เปิด 3 PowerShell Terminals**

Terminal 1:
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-node
npm run dev
```

Terminal 2:
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-server-node
npm run dev
```

Terminal 3:
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-next
npm run dev
```

### ขั้นตอนที่ 3: เปิดใช้งาน
เปิด browser: **http://localhost:3000**

🎉 **พร้อมใช้งาน! ไม่ต้อง Login!**

---

## 💡 ตัวอย่างการใช้งาน

### 💬 สนทนาทั่วไป
```
You: สวัสดี
AI:  สวัสดีครับ! มีอะไรให้ผมช่วยไหมครับ 😊
```

### 📅 ถามวันเวลา
```
You: วันนี้วันอะไร
AI:  # วันนี้
     วันที่ 20 ธันวาคม พ.ศ. 2567
     วันศุกร์
```

### 🌦️ พยากรณ์อากาศ
```
You: วันนี้กรุงเทพอากาศเป็นอย่างไร
AI:  # สภาพอากาศกรุงเทพมหานคร
     
     🌤️ **สภาพทั่วไป:** มีเมฆบางส่วน
     🌡️ **อุณหภูมิ:** 28-32°C
     💧 **โอกาสฝน:** 20%
     💨 **ลม:** ตะวันออกเฉียงเหนือ 10-20 km/h
```

### 📊 สร้างกราฟ
```
You: สร้างกราฟยอดขายรายเดือน
AI:  [แสดง Interactive Chart]
     # กราฟยอดขายรายเดือน
     
     กราฟแสดงข้อมูลยอดขายตั้งแต่มกราคมถึงธันวาคม...
```

---

## 🔧 Configuration Files

### Backend: [innomcp-node/.env](innomcp-node/.env)
```env
SERVER_PORT=3011
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
OLLAMA_TIMEOUT=60000
OLLAMA_MAX_RETRIES=2

DB_HOST=localhost
DB_PORT=3306
DB_USER=<REDACTED_USER>
DB_PASSWORD=<REDACTED>
DB_NAME=innomcp-db

MCPSERVER_URL=http://localhost:3012/mcp
```

### Frontend: [innomcp-next/.env.local](innomcp-next/.env.local)
```env
# WebSocket
NEXT_PUBLIC_NODE_WS_HOST=ws://localhost:3011

# Auth Mode (optional = ไม่ต้อง login)
NEXT_PUBLIC_AUTH_MODE=optional

# App Info
NEXT_PUBLIC_APPTITLE=MDES Innovation MCP Chat AI
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
│                http://localhost:3000                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   Next.js Frontend   │
          │     (port 3000)      │
          │  ✅ No Auth Required │
          └──────────┬───────────┘
                     │ WebSocket (ws://localhost:3011/chat)
                     ▼
          ┌──────────────────────┐
          │   Node.js Backend    │
          │     (port 3011)      │
          │  ✅ WebSocket Server │
          └──────┬───────┬───────┘
                 │       │
        ┌────────┘       └────────┐
        ▼                         ▼
┌───────────────┐        ┌──────────────┐
│  MCP Server   │        │    Ollama    │
│  (port 3012)  │        │(port 11434)  │
│ ✅ 4 Tools    │        │ gemma3:4b 🚀 │
└───────────────┘        └──────────────┘
     │
     ▼
┌──────────────────────┐
│  dateTimeTool        │  📅 วันเวลา
│  tmdTool             │  🌦️ อากาศ
│  webdTool            │  🔍 เช็คเว็บ
│  echartsTool         │  📊 กราฟ
└──────────────────────┘
```

---

## 🛠️ Helper Scripts

| Script | คำอธิบาย |
|--------|----------|
| [QUICK-START.bat](QUICK-START.bat) | เริ่มทั้ง 3 services พร้อมกัน |
| [KILL-PORTS.ps1](KILL-PORTS.ps1) | Kill processes บน ports 3000,3011,3012 |
| [START-ALL-SERVICES.ps1](START-ALL-SERVICES.ps1) | เริ่ม services แบบ PowerShell |
| [CHECK-STATUS.ps1](CHECK-STATUS.ps1) | เช็คสถานะทั้งระบบ |

---

## 🐛 Troubleshooting

### ❌ Chat ไม่ตอบ / Error: 401 Unauthorized
✅ **Fixed!** ตอนนี้ไม่ต้อง login แล้ว

### ❌ WebSocket Connection Failed
```powershell
# 1. Kill ports
.\KILL-PORTS.ps1

# 2. Restart
.\QUICK-START.bat

# 3. รอ 15 วินาที แล้ว refresh browser
```

### ❌ Ollama Error / 502 Bad Gateway
```bash
# เช็ค Ollama
curl http://localhost:11434

# Restart Ollama
ollama serve

# เช็ค model
ollama list
```

### ❌ Port Already in Use
```powershell
# Kill ด้วย script
.\KILL-PORTS.ps1

# หรือ manual
Get-NetTCPConnection -LocalPort 3000,3011,3012 | 
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### ❌ MCP Tools ไม่ทำงาน
เช็ค MCP Server logs ต้องเห็น:
```
MCP Server running on http://localhost:3012/mcp
Tool loaded: dateTimeTool
Tool loaded: tmdTool
Tool loaded: webdTool
Tool loaded: echartsTool
```

---

## 📈 Performance Tips

### ⚡ ให้ AI ตอบเร็วขึ้น

1. **ใช้ Model เล็ก**
   ```env
   OLLAMA_MODEL=gemma3:1b  ← เร็วมาก
   OLLAMA_MODEL=gemma3:4b  ← แนะนำ (balance)
   ```

2. **GPU Optimization**
   - ปิดโปรแกรมที่ใช้ GPU อื่นๆ
   - ใช้ `nvidia-smi` ดู GPU usage
   - Ollama จะใช้ CUDA อัตโนมัติ

3. **Network**
   - ใช้ localhost (ไม่ผ่าน network)
   - WebSocket = real-time streaming

4. **Timeout Settings**
   ```env
   OLLAMA_TIMEOUT=60000     ← ลดถ้าต้องการตอบเร็ว
   OLLAMA_MAX_RETRIES=1     ← ลด retry
   ```

---

## 📦 What's Included

### ✅ Files ที่แก้ไขแล้ว

1. **Frontend**
   - [.env.local](innomcp-next/.env.local) - เพิ่ม auth mode optional
   - [AuthContext.tsx](innomcp-next/src/app/context/AuthContext.tsx) - skip auth
   - [middleware.ts](innomcp-next/src/middleware.ts) - อนุญาต ws://

2. **Backend**
   - [chat.ts](innomcp-node/src/routes/api/chat.ts) - system prompt ใหม่
   - [.env](innomcp-node/.env) - Ollama config

3. **Scripts**
   - [QUICK-START.bat](QUICK-START.bat) - เริ่มทั้งระบบ
   - [KILL-PORTS.ps1](KILL-PORTS.ps1) - ล้าง ports
   - [START-ALL-SERVICES.ps1](START-ALL-SERVICES.ps1) - PowerShell version

4. **Documentation**
   - [HOW_TO_USE_CHAT_AI.md](HOW_TO_USE_CHAT_AI.md) - คู่มือใช้งานละเอียด
   - **README_COMPLETE.md** (ไฟล์นี้)

---

## 🎓 Key Features

### 🚀 Performance
- ✅ Local Ollama GPU (gemma3:4b)
- ✅ WebSocket streaming
- ✅ Intelligent MCP tool selection
- ✅ Context-aware responses
- ✅ 60s timeout with retry

### 🎨 User Experience  
- ✅ No login required
- ✅ Real-time typewriter effect
- ✅ Markdown formatted responses
- ✅ Conversation history
- ✅ Interactive charts/graphs

### 🛡️ Security
- ✅ CSP headers with nonce
- ✅ CORS properly configured
- ✅ WebSocket origin validation
- ✅ Safe tool execution

### 🧠 Intelligence
- ✅ 4 MCP tools available
- ✅ Automatic tool selection
- ✅ Multi-step reasoning
- ✅ Context preservation
- ✅ Error recovery

---

## 🎯 Quick Reference

### URLs
```
Frontend:   http://localhost:3000
Backend:    http://localhost:3011
Health:     http://localhost:3011/health
MCP Server: http://localhost:3012
Ollama:     http://localhost:11434
MariaDB:    localhost:3306
```

### Commands
```powershell
# Start everything
.\QUICK-START.bat

# Kill stuck ports
.\KILL-PORTS.ps1

# Check status
.\CHECK-STATUS.ps1

# Individual services
cd innomcp-node && npm run dev
cd innomcp-server-node && npm run dev
cd innomcp-next && npm run dev
```

---

## 🎉 Summary

### ✨ What You Get
1. **Chat AI พร้อมใช้งาน** - เปิด browser ก็ใช้ได้เลย
2. **ไม่ต้อง Login** - Auth mode optional
3. **Local GPU Fast** - Ollama gemma3:4b
4. **Smart MCP Tools** - 4 tools ทำงานอัตโนมัติ
5. **Beautiful UI** - Markdown, Streaming, Charts
6. **Easy Scripts** - One-click startup

### 🚀 Next Steps
1. เปิด terminal → รัน `QUICK-START.bat`
2. รอ 15 วินาที
3. เปิด http://localhost:3000
4. เริ่มสนทนากับ AI!

---

## 📞 Need Help?

1. ดู logs ในหน้าต่าง PowerShell
2. เช็ค browser console (F12)
3. รัน `CHECK-STATUS.ps1`
4. อ่าน [HOW_TO_USE_CHAT_AI.md](HOW_TO_USE_CHAT_AI.md)

---

**Enjoy your Professional AI Chat System! 🎊**

*พัฒนาโดย: MDES Innovation Team*  
*Powered by: Ollama + MCP + Next.js + Node.js*

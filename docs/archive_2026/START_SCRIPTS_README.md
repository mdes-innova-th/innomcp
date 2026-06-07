# 🚀 INNOMCP Start Scripts - 3 Modes

## 📋 Overview

มี 3 bash scripts สำหรับเริ่มระบบในโหมดต่างๆ:

| Script | Mode | Ollama Location | Use Case |
|--------|------|-----------------|----------|
| [start-local.sh](start-local.sh) | **LOCAL** | `localhost:11434` | ใช้ GPU ในเครื่อง (เร็วสุด) ✅ **แนะนำ** |
| [start-remote.sh](start-remote.sh) | **REMOTE** | `ollama.mdes-innova.online` | ใช้ Cloud Server |
| [start-hybrid.sh](start-hybrid.sh) | **HYBRID** | Local → Remote fallback | Auto-switch เมื่อ local ไม่ได้ |

--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---

## 🎯 Mode 1: LOCAL (แนะนำ)

### ใช้เมื่อไหร่
- มี Ollama ติดตั้งในเครื่อง
- ต้องการความเร็วสูงสุด (GPU local)
- ไม่ต้องพึ่ง network

### เริ่มใช้งาน
```bash
# ใน WSL/Linux
cd /mnt/c/Users/USER-NT/DEV/innomcp
chmod +x start-local.sh
./start-local.sh

# หรือ PowerShell
bash start-local.sh
```

### Requirements
1. Ollama ต้องทำงานอยู่:
   ```bash
   ollama serve
   ```
2. มี model gemma3:4b:
   ```bash
   ollama pull gemma3:4b
   ```

### Configuration
ใช้ไฟล์: [innomcp-node/.env.local](innomcp-node/.env.local)
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
```

---

## 🌐 Mode 2: REMOTE

### ใช้เมื่อไหร่
- ไม่มี GPU หรือ Ollama ในเครื่อง
- ต้องการใช้ Cloud Server
- Testing กับ production environment

### เริ่มใช้งาน
```bash
cd /mnt/c/Users/USER-NT/DEV/innomcp
chmod +x start-remote.sh
./start-remote.sh
```

### Requirements
1. Network เชื่อมต่อ internet
2. Server `ollama.mdes-innova.online` ต้องพร้อม

### Configuration
ใช้ไฟล์: [innomcp-node/.env.remote](innomcp-node/.env.remote)
```env
OLLAMA_HOST=https://ollama.mdes-innova.online
OLLAMA_MODEL=gemma3:4b
OLLAMA_TIMEOUT=120000  # เพิ่ม timeout สำหรับ remote
OLLAMA_MAX_RETRIES=3
```

---

## 🔄 Mode 3: HYBRID

### ใช้เมื่อไหร่
- ต้องการ reliability สูง
- ลอง local ก่อน ถ้าไม่ได้ใช้ remote
- Development + Production backup

### เริ่มใช้งาน
```bash
cd /mnt/c/Users/USER-NT/DEV/innomcp
chmod +x start-hybrid.sh
./start-hybrid.sh
```

### Behavior
1. เช็ค local Ollama (`localhost:11434`)
2. ถ้ามี → ใช้ local
3. ถ้าไม่มี → fallback ไป remote
4. ถ้าทั้งคู่ไม่ได้ → error

### Configuration
ใช้ไฟล์: [innomcp-node/.env.hybrid](innomcp-node/.env.hybrid)
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_FALLBACK_HOST=https://ollama.mdes-innova.online
OLLAMA_MODEL=gemma3:4b
```

---

## 🔧 What Each Script Does

### 1. Pre-checks
- ✅ เช็ค Ollama availability
- ✅ เช็ค model gemma3:4b
- ✅ Copy environment file (`.env.local`, `.env.remote`, `.env.hybrid`)

### 2. Cleanup
- 🧹 Kill stuck processes on ports 3000, 3011, 3012
- 🧹 Clear old logs

### 3. Start Services
เริ่มทั้ง 3 services ตามลำดับ:

```
Backend (3011) → รอ 5 วินาที
   ↓
MCP Server (3012) → รอ 3 วินาที
   ↓
Frontend (3000)
```

### 4. Logging
Logs ถูกเขียนไปที่:
```
/tmp/innomcp-backend-{mode}.log
/tmp/innomcp-mcpserver-{mode}.log
/tmp/innomcp-frontend-{mode}.log
```

### 5. Health Check
- ✅ Test backend: `curl http://localhost:3011/health`
- ✅ Test frontend: `curl http://localhost:3000`

---

## 📊 Comparison

| Feature | LOCAL | REMOTE | HYBRID |
|---------|-------|--------|--------|
| **Speed** | ⚡⚡⚡ Fast | 🐢 Slow | ⚡⚡ Variable |
| **GPU** | Local GPU | Cloud GPU | Local → Cloud |
| **Network** | ❌ Not needed | ✅ Required | ⚠️ Optional |
| **Reliability** | ⚠️ Depends on local | ⚠️ Depends on cloud | ✅ High (fallback) |
| **Cost** | 💰 Free (your GPU) | 💰💰 May have cost | 💰 Mixed |
| **Setup** | ⚙️ Need Ollama | 🌐 Just network | ⚙️ Ollama optional |

---

## 🐛 Troubleshooting

### ❌ "Ollama is NOT running"
```bash
# Start Ollama
ollama serve

# Check
curl http://localhost:11434
```

### ❌ "gemma3:4b not found"
```bash
# Pull model
ollama pull gemma3:4b

# Verify
ollama list
```

### ❌ "Port already in use"
```bash
# Kill processes
pkill -f "node.*innomcp"

# Or use PowerShell
powershell.exe -ExecutionPolicy Bypass -File "KILL-PORTS.ps1"
```

### ❌ "MCP Tools not loaded (Available tools: 0)"
เช็คว่า MCP Server ทำงานอยู่:
```bash
curl http://localhost:3012/mcp

# ดู logs
tail -f /tmp/innomcp-mcpserver-{mode}.log
```

### ❌ "Remote Ollama 502 Bad Gateway"
```bash
# เช็ค remote server
curl -I https://ollama.mdes-innova.online

# ใช้ local หรือ hybrid mode แทน
./start-local.sh
```

---

## 📝 How to Use

### Quick Start (แนะนำ)
```bash
# 1. ไปที่ folder
cd /mnt/c/Users/USER-NT/DEV/innomcp

# 2. ทำให้ scripts รันได้
chmod +x start-*.sh

# 3. เริ่มด้วย LOCAL mode
./start-local.sh

# 4. เปิด browser
# http://localhost:3000
```

### ดู Logs
```bash
# Backend logs
tail -f /tmp/innomcp-backend-local.log

# MCP Server logs
tail -f /tmp/innomcp-mcpserver-local.log

# Frontend logs
tail -f /tmp/innomcp-frontend-local.log

# ดูทั้งหมด
tail -f /tmp/innomcp-*.log
```

### Stop Services
```bash
# Kill ทั้งหมด
pkill -f "node.*innomcp"

# หรือใช้ PowerShell script
powershell.exe -ExecutionPolicy Bypass -File "KILL-PORTS.ps1"
```

### Switch Modes
```bash
# จาก LOCAL → REMOTE
pkill -f "node.*innomcp"
./start-remote.sh

# จาก REMOTE → HYBRID
pkill -f "node.*innomcp"
./start-hybrid.sh
```

---

## 🎓 Examples

### Example 1: Development (LOCAL)
```bash
# เช็ค Ollama
ollama serve &
ollama pull gemma3:4b

# เริ่มระบบ
./start-local.sh

# ดู logs real-time
tail -f /tmp/innomcp-*.log
```

### Example 2: Testing Remote
```bash
# ไม่ต้อง Ollama local
./start-remote.sh

# รอ 10-15 วินาที
# เปิด http://localhost:3000
```

### Example 3: Production-like (HYBRID)
```bash
# Best of both worlds
./start-hybrid.sh

# จะใช้ local ถ้ามี
# จะใช้ remote ถ้า local ไม่ได้
```

---

## 🔍 Verification

หลังเริ่มระบบ เช็คว่าทุกอย่างทำงาน:

```bash
# 1. Backend health
curl http://localhost:3011/health
# ควรได้: {"status":"ok",...}

# 2. Frontend
curl http://localhost:3000
# ควรได้ HTML

# 3. MCP Server
curl http://localhost:3012
# ควรได้ response จาก MCP

# 4. Ollama (local mode)
curl http://localhost:11434
# ควรได้: "Ollama is running"

# 5. Check logs ไม่มี error
tail -20 /tmp/innomcp-backend-local.log
# ควรเห็น: "Available tools: 4" หรือมากกว่า
```

---

## 📦 Files Structure

```
innomcp/
├── start-local.sh      ← LOCAL mode script
├── start-remote.sh     ← REMOTE mode script
├── start-hybrid.sh     ← HYBRID mode script
├── KILL-PORTS.ps1      ← Kill stuck ports
│
├── innomcp-node/
│   ├── .env            ← Current active config
│   ├── .env.local      ← LOCAL mode config
│   ├── .env.remote     ← REMOTE mode config
│   └── .env.hybrid     ← HYBRID mode config
│
├── innomcp-server-node/
│   └── (MCP server code)
│
└── innomcp-next/
    └── (Frontend code)
```

---

## 🎯 Best Practices

### 1. ✅ Always Use LOCAL for Development
- เร็วที่สุด
- ไม่ขึ้นกับ network
- Debug ง่าย

### 2. ✅ Use HYBRID for Demo/Production
- Fallback automatic
- High availability
- Best user experience

### 3. ✅ Monitor Logs
```bash
# One-liner ดู logs ทั้งหมด
tail -f /tmp/innomcp-*.log | grep -i "error\|warn\|tool"
```

### 4. ✅ Clean Restart
```bash
# Kill → Wait → Start
pkill -f "node.*innomcp"
sleep 3
./start-local.sh
```

---

## 🆘 Support

หากมีปัญหา:

1. เช็ค logs:
   ```bash
   tail -100 /tmp/innomcp-backend-local.log
   ```

2. Restart services:
   ```bash
   pkill -f "node.*innomcp"
   ./start-local.sh
   ```

3. Verify Ollama:
   ```bash
   curl http://localhost:11434
   ollama list
   ```

4. Check ports:
   ```bash
   netstat -ano | grep "3000\|3011\|3012"
   ```

---

**Have fun with your 3-mode startup! 🎉**

*Quick start: `./start-local.sh` → Open `http://localhost:3000`*

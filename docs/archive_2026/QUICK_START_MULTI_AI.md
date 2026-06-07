# 🚀 INNOMCP Multi-AI Quick Start

## เริ่มต้นใช้งานภายใน 5 นาที!

### 📋 Prerequisites

1. ✅ Node.js & npm installed
2. ✅ Ollama running on local GPU: `http://172.22.64.1:11434`
3. ✅ (Optional) Remote AI server for Hybrid/Remote mode

---

## 🎯 เลือก Mode ที่เหมาะกับคุณ

### 🟢 Local Mode - พัฒนาและทดสอบเร็ว

```bash
# 1. Copy config
cp .env.local.example .env.local

# 2. แก้ไข .env.local (ถ้าจำเป็น)
nano .env.local

# 3. Start!
ln -sf .env.local .env
./kill-all-processes.sh
npm run dev
```

**เมื่อไหร่ใช้:** Dev, Testing, ต้องการความเร็ว

---

### 🔵 Remote Mode - ต้องการความแม่นยำสูงสุด

```bash
# 1. Copy config
cp .env.remote.example .env.remote

# 2. แก้ไข .env.remote
nano .env.remote
# ⚠️ จำเป็น: ตั้งค่า REMOTE_OLLAMA_BASE_URL และ REMOTE_OLLAMA_MODEL

# 3. Start!
ln -sf .env.remote .env
./kill-all-processes.sh
npm run dev
```

**เมื่อไหร่ใช้:** Production, Complex reasoning, Maximum accuracy

---

### ⭐ Hybrid Mode - ดีที่สุด! (แนะนำ)

```bash
# 1. Copy config
cp .env.hybrid.example .env.hybrid

# 2. แก้ไข .env.hybrid
nano .env.hybrid
# ⚠️ ตั้งค่าทั้ง Local และ Remote AI URLs

# 3. Start!
ln -sf .env.hybrid .env
./kill-all-processes.sh
npm run dev
```

**เมื่อไหร่ใช้:** Production ที่ต้องการทั้งความเร็วและความแม่นยำ

---

## 🧪 ทดสอบการทำงาน

### 1. เปิดเบราว์เซอร์
```
http://localhost:3000
```

### 2. ทดสอบ Local AI
```
Q: วันนี้วันที่เท่าไร
→ ดูที่ terminal: [MCP Client] Response from local in XXXms
```

### 3. ทดสอบ Remote AI (ถ้า Hybrid/Remote)
```
Q: อธิบายทฤษฎีสัมพันธภาพของไอน์สไตน์อย่างละเอียด
→ ดูที่ terminal: [MCP Client] Response from remote in XXXms
```

### 4. ทดสอบ MCP Tools
```
Q: สภาพอากาศวันนี้
→ ควรใช้ tmdTool

Q: คำนวณ 2+2
→ ควรใช้ calculatorTool

Q: สร้างกราฟยอดขาย 100, 150, 200
→ ควรใช้ echartsTool
```

---

## 📊 ดู Performance Metrics

```bash
# 1. Enable metrics ใน .env
echo "ENABLE_PERFORMANCE_METRICS=true" >> .env
echo "LOG_AI_SELECTION=true" >> .env
echo "LOG_EXECUTION_TIME=true" >> .env

# 2. Restart
./kill-all-processes.sh
npm run dev

# 3. ดู logs
tail -f innomcp-node/logs/combined.log
```

**Output ที่คาดหวัง:**
```
[MCP Client] ⚡ Response from local in 234ms
[MCP Client] ⚡ Response from remote in 1523ms
[MCP Client] 🔄 Falling back to local AI...
```

---

## 🔄 สลับ Mode ได้ง่ายๆ

```bash
# เปลี่ยนเป็น Local
ln -sf .env.local .env
./kill-all-processes.sh && npm run dev

# เปลี่ยนเป็น Remote
ln -sf .env.remote .env
./kill-all-processes.sh && npm run dev

# เปลี่ยนเป็น Hybrid
ln -sf .env.hybrid .env
./kill-all-processes.sh && npm run dev
```

---

## 🐛 แก้ปัญหาเบื้องต้น

### ปัญหา: Remote AI ไม่ตอบสนอง
```bash
# Test connection
curl http://YOUR_REMOTE_IP:11434/api/tags

# ถ้าไม่ได้: ตรวจ firewall หรือ network
ping YOUR_REMOTE_IP
```

### ปัญหา: Services ไม่ start
```bash
# 1. Kill zombie processes
./kill-all-processes.sh

# 2. Check ports
lsof -i:3000,3011,3012

# 3. Check logs
tail -f innomcp-node/logs/error.log
```

### ปัญหา: Compilation errors
```bash
# 1. Clean install
rm -rf node_modules package-lock.json
rm -rf innomcp-*/node_modules innomcp-*/package-lock.json
npm run install:all

# 2. Rebuild
npm run build
```

---

## 📖 เอกสารเพิ่มเติม

- **Full Documentation:** [MULTI_AI_SETUP.md](MULTI_AI_SETUP.md)
- **MCP Tools:** [MCP_TOOLS_GUIDE.md](MCP_TOOLS_GUIDE.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 💡 Best Practices

### สำหรับ Development
```bash
# ใช้ Local mode + enable metrics
ln -sf .env.local .env
echo "ENABLE_PERFORMANCE_METRICS=true" >> .env.local
./kill-all-processes.sh && npm run dev
```

### สำหรับ Production
```bash
# ใช้ Hybrid mode + production settings
ln -sf .env.hybrid .env
echo "LOG_LEVEL=info" >> .env.hybrid
echo "ENABLE_FILE_LOG=true" >> .env.hybrid
./kill-all-processes.sh && npm run dev
```

---

## 🎯 ตัวอย่างการใช้งาน

### Scenario 1: Dev Mode (Local)
```
Developer: "วันนี้วันที่เท่าไร"
System: 
  → Local AI: selects dateTimeTool (50ms) ⚡
  → Local AI: generates response (150ms) ⚡
  Total: 200ms ⚡⚡⚡
```

### Scenario 2: Production (Remote)
```
User: "วิเคราะห์แนวโน้มเศรษฐกิจโลก"
System:
  → Remote AI: complex reasoning (2000ms) 🎯
  Total: 2000ms (แต่แม่นยำมาก!) 🎯🎯🎯
```

### Scenario 3: Production (Hybrid) ⭐
```
User: "สภาพอากาศวันนี้ แล้วสร้างกราฟเปรียบเทียบ"
System:
  → Local AI: selects tmdTool + echartsTool (50ms) ⚡
  → Local AI: generates arguments (100ms) ⚡
  → Execute tools (1000ms)
  → Remote AI: generates final response (800ms) 🎯
  Total: 1950ms (เร็ว + แม่นยำ!) ⚡🎯⚡🎯
```

---

## ✅ Checklist

ก่อน deploy production:

- [ ] ✅ Test Local mode works
- [ ] ✅ Configure Remote AI server
- [ ] ✅ Test Remote mode works
- [ ] ✅ Configure Hybrid mode
- [ ] ✅ Test all MCP tools
- [ ] ✅ Enable performance metrics
- [ ] ✅ Check logs directory exists
- [ ] ✅ Test fallback mechanism
- [ ] ✅ Document your AI server URLs
- [ ] ✅ Set up monitoring/alerts

---

## 🚀 Ready? Let's Go!

```bash
# เริ่มต้นด้วย Hybrid mode
cp .env.hybrid.example .env.hybrid
nano .env.hybrid  # แก้ไข URLs
ln -sf .env.hybrid .env
./kill-all-processes.sh
npm run dev

# เปิดเบราว์เซอร์
open http://localhost:3000

# ทดสอบ!
# "สร้างกราฟยอดขาย 100, 150, 200 แล้วอธิบายแนวโน้ม"
```

---

**Made with ❤️ for INNOMCP**

Need help? Read [MULTI_AI_SETUP.md](MULTI_AI_SETUP.md) for detailed documentation.

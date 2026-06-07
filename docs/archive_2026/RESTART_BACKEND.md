# 🔄 Backend Restart Instructions

## การแก้ไขล่าสุด

### 1. ✅ Dynamic Remote Ollama Initialization
เพิ่ม code ให้ initialize remote Ollama เมื่อสลับเป็น remote mode

### 2. ✅ JSON Parsing Fix for Remote AI
แก้ไขให้ parse markdown-wrapped JSON ได้ (```json ... ```)
- Remote AI (qwen2.5) ส่ง response เป็น markdown code block
- Enhanced `extractJsonFromText()` ให้ strip markdown wrapper ก่อน parse
- เพิ่ม debug logging สำหรับ troubleshooting

## สาเหตุที่ต้อง Restart

เพิ่งแก้ไข `chat.ts` เพื่อให้:
1. ✅ Initialize remote Ollama dynamically เมื่อสลับเป็น remote mode
2. ✅ เปลี่ยน model เป็น `qwen2.5:0.5b` (มีอยู่ใน remote server)

## วิธี Restart Backend

### ใน Terminal ที่รัน Backend:

**หยุด Backend:**
```
Ctrl + C
```

**Start Backend ใหม่:**
```bash
cd innomcp-node
npm run dev
```

### คาดหวังที่จะเห็น:

**Startup logs ควรแสดง:**
```
🚀 ========================================
🚀 INNOMCP AI MODE: LOCAL
🚀 ========================================

💚 Local AI: http://172.22.64.1:11434 (gemma3:4b)

✨ Primary AI: Local

[Chat API] MCP client created (initializing in background)
🚀 Backend Server running on http://localhost:3011
```

**หมายเหตุ:** ตอนเริ่มต้นจะใช้ Local mode (ตาม AI_MODE=local ใน .env)

## ทดสอบ Remote Mode

### 1. ผ่าน API:
```bash
# Switch to remote
curl -X POST http://localhost:3011/api/ai-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"remote"}'

# ควรเห็น log:
# [Chat AI] 🌐 Initializing Remote Ollama: https://ollama.mdes-innova.online
# [Chat AI] 📦 Remote Model: qwen2.5:0.5b
# 🎯 Remote AI initialized: https://ollama.mdes-innova.online (qwen2.5:0.5b)
```

### 2. ผ่าน UI:
```
1. เปิด http://localhost:3000
2. คลิก AI Mode selector (ซ้ายของปุ่มส่ง)
3. เลือก "Remote AI" 🔵
4. ส่งข้อความทดสอบ
5. Check logs:
   tail -f innomcp-node/logs/backend-development.log | grep -i "chat ai\|using ollama"
```

### 3. Run Test Script:
```bash
bash test-remote-connection.sh
```

## Log ที่ควรเห็นหลัง Switch to Remote:

```
[Chat AI] 🔄 updateChatAIMode called
[Chat AI] 📊 Mode change: local → remote
[Chat AI] 🌐 Initializing Remote Ollama: https://ollama.mdes-innova.online
[Chat AI] 📦 Remote Model: qwen2.5:0.5b
[Chat AI] 🤖 Using Ollama: Remote
[Chat AI] 📝 Model: qwen2.5:0.5b
[Chat AI] 🔗 MCP Client mode: local → remote
[Chat AI] ✅ updateChatAIMode completed successfully
```

## Troubleshooting

### ถ้า Remote ยังใช้ "Local (fallback)":
1. Check .env มี REMOTE_OLLAMA_BASE_URL
2. Check remote server: `curl https://ollama.mdes-innova.online/api/tags`
3. Restart backend อีกครั้ง
4. Check logs หา "Initializing Remote Ollama"

### ถ้า Model ไม่ตรง:
- ตรวจสอบ .env: `REMOTE_OLLAMA_MODEL=qwen2.5:0.5b`
- Restart backend

### ถ้า Backend ไม่ start:
- Check syntax error: มองหา error ใน console
- Check port 3011: `lsof -i :3011` หรือ `netstat -ano | findstr 3011`

---

**Updated**: 2025-12-22 | **Session**: 8.7
**Fixed**: Remote Ollama dynamic initialization

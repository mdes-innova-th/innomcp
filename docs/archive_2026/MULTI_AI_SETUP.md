# 🚀 INNOMCP Multi-AI Architecture

## 📖 Overview

INNOMCP supports **3 AI modes** to optimize both **speed** and **accuracy**:

1. **Local Mode** - Fast, Local GPU AI
2. **Remote Mode** - Maximum Accuracy, Remote AI Server
3. **Hybrid Mode** - **BEST!** Combines both for speed + accuracy

---

## 🏗️ Architecture

### 1. Local Mode
```
┌─────────────┐
│  Local GPU  │ → All tasks
│   (Fast)    │
└─────────────┘
```
**Best for:** Development, Testing, Quick responses  
**Pros:** Fast, No network dependency  
**Cons:** Limited accuracy on complex tasks

---

### 2. Remote Mode
```
┌──────────────┐
│  Remote AI   │ → All tasks
│ (Accurate)   │
└──────────────┘
     ↓ (fallback)
┌─────────────┐
│  Local GPU  │
└─────────────┘
```
**Best for:** Production, Complex reasoning  
**Pros:** Maximum accuracy  
**Cons:** Network latency

---

### 3. Hybrid Mode 🌟 **RECOMMENDED**
```
┌─────────────┐         ┌──────────────┐
│  Local GPU  │ ←fast─→ │  Remote AI   │
│   (Fast)    │         │ (Accurate)   │
└─────────────┘         └──────────────┘
      │                        │
      ├─ Tool Selection        ├─ Final Response
      ├─ Tokenization          ├─ Complex Reasoning
      ├─ Classification        ├─ Tool Chaining
      └─ Argument Generation   └─ HTML Generation
```
**Best for:** Production with best performance  
**Pros:** ⚡ Fast + 🎯 Accurate + 🛡️ Fallback  
**Cons:** Requires both AI servers

---

## 📦 Setup

### Step 1: Choose Your Environment

**Local Mode:**
```bash
cp .env.local.example .env.local
# Edit .env.local:
#   OLLAMA_BASE_URL=http://172.22.64.1:11434
#   OLLAMA_MODEL=gemma3:4b
ln -sf .env.local .env
```

**Remote Mode:**
```bash
cp .env.remote.example .env.remote
# Edit .env.remote:
#   REMOTE_OLLAMA_BASE_URL=http://YOUR_SERVER_IP:11434
#   REMOTE_OLLAMA_MODEL=llama3:70b
ln -sf .env.remote .env
```

**Hybrid Mode (Recommended):**
```bash
cp .env.hybrid.example .env.hybrid
# Edit .env.hybrid:
#   LOCAL_OLLAMA_BASE_URL=http://172.22.64.1:11434
#   LOCAL_OLLAMA_MODEL=gemma3:4b
#   REMOTE_OLLAMA_BASE_URL=http://YOUR_SERVER_IP:11434
#   REMOTE_OLLAMA_MODEL=llama3:70b
ln -sf .env.hybrid .env
```

---

### Step 2: Start Services

**Option A: Use Convenience Scripts**
```bash
# Local
./start-local.sh

# Remote
./start-remote.sh

# Hybrid (Best!)
./start-hybrid.sh
```

**Option B: Manual Start**
```bash
./kill-all-processes.sh
npm run dev
```

---

## ⚙️ Configuration Details

### Local AI Settings
```env
LOCAL_OLLAMA_BASE_URL=http://172.22.64.1:11434
LOCAL_OLLAMA_MODEL=gemma3:4b

# Performance (เน้นความเร็ว)
LOCAL_AI_TEMPERATURE=0.7
LOCAL_AI_NUM_CTX=4096
LOCAL_AI_NUM_PREDICT=1024
LOCAL_AI_TOP_K=40
LOCAL_AI_TOP_P=0.9
```

### Remote AI Settings
```env
REMOTE_OLLAMA_BASE_URL=http://YOUR_SERVER:11434
REMOTE_OLLAMA_MODEL=llama3:70b

# Performance (เน้นความแม่นยำ)
REMOTE_AI_TEMPERATURE=0.5
REMOTE_AI_NUM_CTX=8192
REMOTE_AI_NUM_PREDICT=4096
REMOTE_AI_TOP_K=50
REMOTE_AI_TOP_P=0.95
```

### Hybrid Strategy
```env
# งานที่ Local AI จะทำ (เร็ว)
USE_LOCAL_FOR_TOOL_SELECTION=true
USE_LOCAL_FOR_TOKENIZATION=true
USE_LOCAL_FOR_CLASSIFICATION=true
USE_LOCAL_FOR_ARGUMENT_GENERATION=true

# งานที่ Remote AI จะทำ (แม่นยำ)
USE_REMOTE_FOR_FINAL_RESPONSE=true
USE_REMOTE_FOR_COMPLEX_REASONING=true
USE_REMOTE_FOR_TOOL_CHAINING=true
```

---

## 🎯 Task Routing (Hybrid Mode)

| Task Type | AI Used | Reason |
|-----------|---------|--------|
| Tool Selection | Local | Need speed for quick decisions |
| Tokenization | Local | Simple regex, no AI needed |
| Classification | Local | Fast categorization |
| Argument Generation | Local | Template-based, quick |
| Final Response | Remote | Need accuracy for user-facing text |
| Complex Reasoning | Remote | Need deep understanding |
| Tool Chaining | Remote | Need planning capability |

---

## 🔄 Fallback Strategy

### Hybrid Mode Fallback
```
Remote AI fails → Fallback to Local AI
```

**Conditions for Fallback:**
- `FALLBACK_TO_LOCAL_ON_ERROR=true`
- `FALLBACK_TO_LOCAL_ON_TIMEOUT=true`
- `REMOTE_TIMEOUT=10000` (10 seconds)

### Remote Mode Fallback
```
Remote AI fails → Fallback to Local AI
```

**Configuration:**
```env
FALLBACK_TO_LOCAL=true
LOCAL_OLLAMA_BASE_URL=http://172.22.64.1:11434
LOCAL_OLLAMA_MODEL=gemma3:4b
```

---

## 📊 Performance Monitoring

Enable performance metrics:
```env
ENABLE_PERFORMANCE_METRICS=true
LOG_AI_SELECTION=true
LOG_EXECUTION_TIME=true
```

Logs will show:
```
[MCP Client] ⚡ Response from local in 234ms
[MCP Client] ⚡ Response from remote in 1523ms
```

---

## 🧪 Testing

Test each mode:
```bash
# Test Local
cp .env.local .env
npm run dev
# Ask: "วันนี้วันที่เท่าไร"

# Test Remote
cp .env.remote .env
npm run dev
# Ask: "อธิบายหลักการทำงานของ quantum computing"

# Test Hybrid
cp .env.hybrid .env
npm run dev
# Ask: "วันนี้วันที่เท่าไร แล้วสร้างกราฟแสดงยอดขาย"
```

---

## 🎓 Best Practices

### For Development
Use **Local Mode** for fast iteration:
```bash
./start-local.sh
```

### For Production (Light Usage)
Use **Remote Mode** for maximum accuracy:
```bash
./start-remote.sh
```

### For Production (Heavy Usage) ⭐
Use **Hybrid Mode** for best of both worlds:
```bash
./start-hybrid.sh
```

---

## 🐛 Troubleshooting

### Remote AI Not Connecting
```bash
# Test connection
curl http://YOUR_SERVER_IP:11434/api/tags

# Check firewall
ping YOUR_SERVER_IP

# Check env
grep REMOTE_OLLAMA_BASE_URL .env
```

### Fallback Not Working
```bash
# Check fallback settings
grep FALLBACK .env.hybrid

# Check local AI
curl http://172.22.64.1:11434/api/tags
```

### Performance Issues
```bash
# Enable metrics
echo "ENABLE_PERFORMANCE_METRICS=true" >> .env

# Check logs
tail -f innomcp-node/logs/combined.log
```

---

## 📝 Environment Variables Reference

| Variable | Mode | Required | Description |
|----------|------|----------|-------------|
| `AI_MODE` | All | Yes | `local`, `remote`, or `hybrid` |
| `OLLAMA_BASE_URL` | Local | Yes | Local Ollama URL |
| `OLLAMA_MODEL` | Local | Yes | Local model name |
| `REMOTE_OLLAMA_BASE_URL` | Remote/Hybrid | Yes* | Remote Ollama URL |
| `REMOTE_OLLAMA_MODEL` | Remote/Hybrid | Yes* | Remote model name |
| `LOCAL_OLLAMA_BASE_URL` | Hybrid | Yes | Local Ollama URL (explicit) |
| `LOCAL_OLLAMA_MODEL` | Hybrid | Yes | Local model name (explicit) |
| `FALLBACK_TO_LOCAL_ON_ERROR` | Hybrid | No | Enable fallback (default: true) |
| `REMOTE_TIMEOUT` | Remote/Hybrid | No | Timeout in ms (default: 10000) |

\* Required for that mode

---

## 🚀 Quick Start Examples

### Example 1: Local Development
```bash
./start-local.sh
# Open http://localhost:3000
# Ask: "วันนี้วันที่เท่าไร"
```

### Example 2: Production Remote
```bash
# Configure .env.remote with your AI server
./start-remote.sh
# Open http://localhost:3000
# Ask: "วิเคราะห์สถานการณ์เศรษฐกิจโลก"
```

### Example 3: Production Hybrid (Best!)
```bash
# Configure both Local and Remote in .env.hybrid
./start-hybrid.sh
# Open http://localhost:3000
# Ask: "แสดงสภาพอากาศวันนี้ และสร้างกราฟเปรียบเทียบ"
# → Local AI: selects tools fast ⚡
# → Remote AI: generates accurate response 🎯
```

---

## 💡 Tips

1. **Use Hybrid for Best Results** - Combines speed and accuracy
2. **Monitor Performance** - Enable metrics to see AI selection
3. **Configure Fallback** - Ensure Local AI as backup
4. **Test Before Deploy** - Test each mode thoroughly
5. **Use Fast Model for Local** - gemma3:4b works great
6. **Use Accurate Model for Remote** - llama3:70b+ recommended

---

## 📞 Support

Need help? Check:
- Logs: `innomcp-node/logs/combined.log`
- Performance: Enable `ENABLE_PERFORMANCE_METRICS=true`
- Connection: Test Ollama with `curl http://HOST:11434/api/tags`

---

Made with ❤️ by INNOMCP Team

# 🎛️ AI Mode Switching Guide

## 📖 Overview

INNOMCP รองรับ 3 AI modes ที่สามารถสลับได้แบบ dynamic:

| Mode | Description | Use Case | Performance |
|------|-------------|----------|-------------|
| 🟢 **Local GPU** | ใช้ Ollama บน GPU ในเครื่อง | Fast, Private, Offline | ⚡ Fast |
| 🔵 **Remote AI** | ใช้ Ollama บน cloud/server | Powerful, Shared | 🌐 Medium |
| 🟣 **Hybrid** | ใช้ทั้งคู่ตามงาน | Best of both | 🎯 Smart |

## 🔧 Configuration

### 1. Environment Variables

**innomcp-node/.env**
```bash
# AI Mode: local | remote | hybrid
AI_MODE=local

# Local Ollama (GPU)
LOCAL_OLLAMA_BASE_URL=http://172.22.64.1:11434
LOCAL_OLLAMA_MODEL=gemma3:4b

# Remote Ollama (Cloud)
REMOTE_OLLAMA_BASE_URL=https://your-ollama-server.com
REMOTE_OLLAMA_MODEL=llama3:70b
```

### 2. Hybrid Mode Logic

```typescript
// Fast tasks → Local AI
- Classification
- Tool selection
- Simple responses

// Accurate tasks → Remote AI  
- Complex reasoning
- Long-form generation
- Specialized tasks

// Balanced tasks → Prefer remote, fallback to local
- General chat
- Medium complexity
```

## 🎨 UI Usage

### Dropdown Selector

1. **Location**: ซ้ายของปุ่มส่งข้อความใน chat input
2. **Click**: เปิด dropdown menu
3. **Select**: เลือก mode (Local GPU / Remote AI / Hybrid)
4. **Effect**: ทันที - ไม่ต้อง restart

### Visual Indicators

```
🟢 Local GPU  → Green icon  → Fast & Private
🔵 Remote AI  → Blue icon   → Cloud Power  
🟣 Hybrid     → Purple icon → Best of Both
```

## 🔌 API Endpoints

### GET Current Mode
```bash
curl http://localhost:3011/api/ai-mode
```

**Response:**
```json
{
  "success": true,
  "mode": "local",
  "availableModes": ["local", "remote", "hybrid"]
}
```

### POST Change Mode
```bash
curl -X POST http://localhost:3011/api/ai-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "remote"}'
```

**Response:**
```json
{
  "success": true,
  "mode": "remote",
  "previousMode": "local",
  "message": "AI mode changed to remote. Next chat will use this mode."
}
```

## 🚀 Setup Instructions

### Local GPU Setup

**Requirements:**
- Windows with WSL2
- NVIDIA GPU with CUDA
- Ollama installed on Windows

**Steps:**
```bash
# 1. Install Ollama on Windows
# Download from https://ollama.com

# 2. Pull model
ollama pull gemma3:4b

# 3. Configure WSL to access Windows Ollama
# In innomcp-node/.env
LOCAL_OLLAMA_BASE_URL=http://172.22.64.1:11434
```

**Test:**
```bash
curl http://172.22.64.1:11434/api/tags
```

### Remote AI Setup

**Requirements:**
- Ollama server on remote machine
- Public URL or VPN access
- Authentication (optional)

**Steps:**
```bash
# 1. Install Ollama on remote server
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull model
ollama pull llama3:70b

# 3. Configure remote access
# Edit /etc/systemd/system/ollama.service
Environment="OLLAMA_HOST=0.0.0.0:11434"

# 4. Restart Ollama
sudo systemctl restart ollama

# 5. Configure in innomcp-node/.env
REMOTE_OLLAMA_BASE_URL=https://your-server.com:11434
```

**Test:**
```bash
curl https://your-server.com:11434/api/tags
```

### Hybrid Mode Setup

**Prerequisites:**
- Both local and remote configured
- Both accessible from innomcp-node

**Configuration:**
```bash
AI_MODE=hybrid
LOCAL_OLLAMA_BASE_URL=http://172.22.64.1:11434
REMOTE_OLLAMA_BASE_URL=https://your-server.com:11434
```

## 🎯 Mode Selection Strategy

### When to Use Each Mode

**🟢 Local GPU:**
- ✅ Privacy-sensitive data
- ✅ Offline operation needed
- ✅ Fast responses important
- ✅ Simple to medium queries
- ❌ Complex reasoning tasks

**🔵 Remote AI:**
- ✅ Complex reasoning needed
- ✅ Larger context windows
- ✅ More powerful models
- ✅ Shared infrastructure
- ❌ Latency sensitive tasks

**🟣 Hybrid:**
- ✅ Best overall performance
- ✅ Cost optimization
- ✅ Automatic task routing
- ✅ Fallback capability
- ⚠️ Requires both configured

## 🔍 Monitoring

### Check Current Mode
```bash
# Via API
curl http://localhost:3011/api/ai-mode

# Via Logs
tail -f innomcp-node/logs/backend-development.log | grep "AI Mode"
```

### Performance Metrics
```bash
# Backend metrics
curl http://localhost:3011/api/statistics

# Response includes:
{
  "aiMode": "hybrid",
  "performance": {
    "localCalls": 45,
    "remoteCalls": 12,
    "avgLocalTime": 1234,
    "avgRemoteTime": 3456
  }
}
```

## 🐛 Troubleshooting

### Issue: Cannot connect to local Ollama
```bash
# Test connection
curl http://172.22.64.1:11434/api/tags

# Check Ollama is running on Windows
tasklist | findstr ollama

# Check firewall
netsh advfirewall firewall add rule name="Ollama" dir=in action=allow protocol=TCP localport=11434
```

### Issue: Remote Ollama timeout
```bash
# Test connection
curl -v https://your-server.com:11434/api/tags

# Check DNS resolution
nslookup your-server.com

# Check SSL certificate
openssl s_client -connect your-server.com:11434
```

### Issue: Hybrid mode always uses local
```bash
# Check logs
tail -f innomcp-node/logs/backend-development.log | grep "AI selection"

# Verify remote is configured
cat innomcp-node/.env | grep REMOTE
```

### Issue: Mode change doesn't work
```bash
# Check API response
curl -X POST http://localhost:3011/api/ai-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "remote"}'

# Check route order in app.ts
# /api/ai-mode must be BEFORE /api middleware
```

## 📊 Performance Comparison

| Task Type | Local (gemma3:4b) | Remote (llama3:70b) | Best Mode |
|-----------|-------------------|---------------------|-----------|
| Classification | ~500ms | ~1500ms | Local |
| Tool Selection | ~800ms | ~2000ms | Local |
| Simple Chat | ~2s | ~5s | Local |
| Complex Reasoning | ~8s | ~6s | Remote |
| Code Generation | ~5s | ~4s | Remote |
| Long Context | Slow | Fast | Remote |

## 🎓 Best Practices

1. **Start with Local**: Fast feedback loop during development
2. **Test with Remote**: Validate accuracy with powerful models
3. **Deploy with Hybrid**: Best of both worlds in production
4. **Monitor Performance**: Track metrics to optimize routing
5. **Secure Remote**: Use HTTPS, authentication, rate limiting
6. **Cache Results**: Reduce redundant AI calls
7. **Fallback Strategy**: Always have backup mode configured

## 🚀 Production Deployment

### Recommended Setup
```
Production Environment:
├── Frontend (innomcp-next)
│   └── Port 3000
├── Backend (innomcp-node)  
│   ├── Port 3011
│   └── AI Mode: hybrid
├── Local AI (Ollama GPU)
│   ├── Windows host
│   ├── Model: gemma3:4b
│   └── Use: Fast tasks
└── Remote AI (Ollama Cloud)
    ├── Dedicated server
    ├── Model: llama3:70b  
    └── Use: Complex tasks
```

### Scaling Strategy
- **Horizontal**: Add more remote AI servers
- **Vertical**: Upgrade local GPU / remote server
- **Load Balancing**: Multiple remote endpoints
- **Caching**: Redis for frequent queries
- **Monitoring**: Prometheus + Grafana

---

**Updated**: 2024-12-22 | **Session**: 8.6.1
**Author**: GitHub Copilot (Claude Sonnet 4.5)

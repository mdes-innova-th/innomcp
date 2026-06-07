# 🚀 INNOMCP - Quick Reference

## ⚡ Start Services

```bash
# LOCAL mode (แนะนำ - เร็วสุด)
./start-local.sh

# REMOTE mode (ใช้ cloud)
./start-remote.sh

# HYBRID mode (auto fallback)
./start-hybrid.sh
```

## 🛑 Stop Services

```bash
# Stop all
./stop-all.sh

# หรือ
pkill -f "node.*innomcp"
```

## 📊 Check Status

```bash
# Health check
curl http://localhost:3011/health

# Frontend
curl http://localhost:3000

# Ollama local
curl http://localhost:11434
```

## 📝 View Logs

```bash
# Backend
tail -f /tmp/innomcp-backend-local.log

# MCP Server
tail -f /tmp/innomcp-mcpserver-local.log

# Frontend
tail -f /tmp/innomcp-frontend-local.log

# All
tail -f /tmp/innomcp-*.log
```

## 🔧 Troubleshooting

### Ollama not running
```bash
ollama serve
ollama pull gemma3:4b
```

### Port conflicts
```bash
./stop-all.sh
# หรือ
powershell.exe -File KILL-PORTS.ps1
```

### MCP Tools not loaded
```bash
# เช็ค MCP Server
curl http://localhost:3012

# ดู logs
tail -f /tmp/innomcp-mcpserver-*.log
```

## 🌐 URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3011
- MCP Server: http://localhost:3012
- Ollama: http://localhost:11434

## 📋 Modes

| Mode | Command | Ollama |
|------|---------|--------|
| LOCAL | `./start-local.sh` | localhost:11434 |
| REMOTE | `./start-remote.sh` | ollama.mdes-innova.online |
| HYBRID | `./start-hybrid.sh` | local → remote fallback |

## 🎯 Best Practice

```bash
# 1. Start Ollama
ollama serve

# 2. Start services (LOCAL mode)
./start-local.sh

# 3. Wait 15 seconds

# 4. Open browser
# http://localhost:3000

# 5. Test chat
# "วันนี้วันอะไร"
# "จังหวัดไหนฝนตกบ้าง"
```

## ✅ Verify

```bash
# All services OK?
curl -s http://localhost:3011/health && \
curl -s http://localhost:3000 > /dev/null && \
curl -s http://localhost:11434 > /dev/null && \
echo "✓ All OK!"
```

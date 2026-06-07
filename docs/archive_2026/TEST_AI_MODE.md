# 🧪 AI Mode Switching Test Guide

## Overview

This guide explains how to test the AI mode switching functionality between **Local GPU**, **Remote AI**, and **Hybrid** modes.

## Prerequisites

✅ **All services running:**
- innomcp-node (port 3011)
- innomcp-server-node (port 3012)  
- innomcp-next (port 3000)

✅ **Environment configured:**
- `LOCAL_OLLAMA_BASE_URL=http://172.22.64.1:11434`
- `REMOTE_OLLAMA_BASE_URL=https://ollama.mdes-innova.online`

## Test Methods

### Method 1: Automated Test (Node.js)

**From Windows PowerShell:**
```powershell
cd C:\Users\USER-NT\DEV\innomcp
node test-ai-mode.js
```

**Test specific mode:**
```powershell
node test-ai-mode.js local
node test-ai-mode.js remote
node test-ai-mode.js hybrid
```

**Expected output:**
```
🚀 ========================================
🚀 INNOMCP AI Mode Switching Test
🚀 ========================================

📡 Test 1: Backend Connection
✅ Backend connection: PASS - Current mode: local

⚙️  Test 2: Configuration Check
✅ Local Ollama URL: PASS - http://172.22.64.1:11434
✅ Local Ollama Model: PASS - gemma3:4b
✅ Remote Ollama URL: PASS - https://ollama.mdes-innova.online
✅ Remote Ollama Model: PASS - llama3:70b

🔄 Test 3: Switching to remote mode
✅ Switch to remote: PASS
✅ Verify remote mode: PASS

💬 Test 4: Chat with remote mode
✅ Chat with remote: PASS

📝 Test 5: Log Verification
✅ Log file exists: PASS - 25 AI mode entries found

📊 ========================================
📊 TEST SUMMARY
📊 ========================================
Total tests: 10
Passed: 10
Failed: 0
Warnings: 0
Duration: 8.45s
```

### Method 2: Manual UI Test

1. **Open browser**: http://localhost:3000

2. **Locate AI Mode selector**: 
   - Left of the send message button
   - Shows current mode (🟢 Local / 🔵 Remote / 🟣 Hybrid)

3. **Test mode switching:**
   - Click the AI Mode button
   - Select different mode
   - Send a test message
   - Check response

4. **Verify in logs:**
```bash
# In WSL
tail -f /mnt/c/Users/USER-NT/DEV/innomcp/innomcp-node/logs/backend-development.log | grep "AI Mode"
```

**Expected log output when switching:**
```
[AI Mode API] 📥 POST request to change mode to: remote
[AI Mode API] 🔄 Mode change: local → remote
[AI Mode API] 📍 New mode: remote
[AI Mode API] 🔗 Calling updateChatAIMode()
[Chat AI] 🔄 updateChatAIMode called
[Chat AI] 📊 Mode change: local → remote
[Chat AI] 🤖 Using Ollama: Remote
[Chat AI] 📝 Model: llama3:70b
[Chat AI] 🔗 MCP Client mode: local → remote
[Chat AI] ✅ updateChatAIMode completed successfully
[AI Mode API] ✅ updateChatAIMode() completed
```

### Method 3: API Test (curl)

**Check current mode:**
```bash
curl http://localhost:3011/api/ai-mode
```

**Expected response:**
```json
{
  "success": true,
  "mode": "local",
  "availableModes": ["local", "remote", "hybrid"],
  "config": {
    "localUrl": "http://172.22.64.1:11434",
    "remoteUrl": "https://ollama.mdes-innova.online",
    "localModel": "gemma3:4b",
    "remoteModel": "llama3:70b"
  }
}
```

**Switch to remote:**
```bash
curl -X POST http://localhost:3011/api/ai-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "remote"}'
```

**Expected response:**
```json
{
  "success": true,
  "mode": "remote",
  "previousMode": "local",
  "message": "AI mode changed to remote. Next chat will use this mode."
}
```

**Switch to hybrid:**
```bash
curl -X POST http://localhost:3011/api/ai-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "hybrid"}'
```

**Switch back to local:**
```bash
curl -X POST http://localhost:3011/api/ai-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "local"}'
```

## Test Scenarios

### Scenario 1: Local Mode Test
1. Switch to local mode
2. Send message: "21+12ได้เท่าไหร่"
3. Expected: Fast response using local GPU (gemma3:4b)
4. Check logs for "Using Ollama: Local"

### Scenario 2: Remote Mode Test
1. Switch to remote mode
2. Send message: "อธิบายทฤษฎีสัมพัทธภาพอย่างละเอียด"
3. Expected: Detailed response using remote AI (llama3:70b)
4. Check logs for "Using Ollama: Remote"

### Scenario 3: Hybrid Mode Test
1. Switch to hybrid mode
2. Send simple message: "สวัสดี"
3. Expected: Fast response using local AI
4. Send complex message: "เขียน code Python สำหรับ ML model"
5. Expected: Detailed response using remote AI
6. Check logs for automatic mode selection

### Scenario 4: Mode Persistence
1. Switch to remote mode
2. Refresh browser
3. Check AI mode selector still shows remote
4. Send message - should still use remote AI

## Log Verification

**Check all AI mode logs:**
```bash
# In WSL
tail -f /mnt/c/Users/USER-NT/DEV/innomcp/innomcp-node/logs/backend-development.log | grep -E "AI Mode|Chat AI"
```

**Filter specific events:**
```bash
# Mode changes only
tail -f /mnt/c/Users/USER-NT/DEV/innomcp/innomcp-node/logs/backend-development.log | grep "Mode change"

# API calls only
tail -f /mnt/c/Users/USER-NT/DEV/innomcp/innomcp-node/logs/backend-development.log | grep "AI Mode API"

# Chat updates only
tail -f /mnt/c/Users/USER-NT/DEV/innomcp/innomcp-node/logs/backend-development.log | grep "Chat AI"
```

## Troubleshooting

### Issue: "Remote not configured"
**Solution:** Check `.env` file has:
```bash
REMOTE_OLLAMA_BASE_URL=https://ollama.mdes-innova.online
REMOTE_OLLAMA_MODEL=llama3:70b
```

### Issue: "Cannot connect to remote"
**Test connection:**
```bash
curl https://ollama.mdes-innova.online/api/tags
```

**Expected:** JSON response with available models

### Issue: "Mode doesn't change"
**Check logs for:**
```
[AI Mode API] ⚠️  updateChatAIMode not available yet
```

**Solution:** Wait 1-2 seconds after backend starts for initialization

### Issue: "Dropdown not clickable"
**Verify:**
1. Browser console for errors (F12)
2. No CSP violations
3. UI rendered correctly (z-index issue)

### Issue: "No logs appearing"
**Check:**
1. Log directory exists: `innomcp-node/logs/`
2. Log file created: `backend-development.log`
3. Log level set correctly in code

## Success Criteria

✅ **API Tests:**
- GET /api/ai-mode returns current mode
- POST /api/ai-mode switches mode successfully
- Mode persists across requests

✅ **UI Tests:**
- Dropdown renders with correct current mode
- Mode changes via dropdown work
- Visual indicator matches actual mode

✅ **Chat Tests:**
- Local mode uses local GPU (fast responses)
- Remote mode uses remote AI (detailed responses)
- Hybrid mode routes correctly

✅ **Logs:**
- Mode changes logged with emojis
- API calls logged
- Chat AI updates logged
- No errors in logs

## Performance Metrics

| Mode | Response Time | Accuracy | Use Case |
|------|---------------|----------|----------|
| 🟢 Local | ~1-3s | Good | Fast queries, simple tasks |
| 🔵 Remote | ~3-8s | Excellent | Complex reasoning, detailed responses |
| 🟣 Hybrid | Variable | Best | Auto-optimized routing |

## Test Results Location

**Automated test results:**
```
test-ai-mode-results.json
```

**Log files:**
```
innomcp-node/logs/backend-development.log
innomcp-server-node/logs/mcp-server-YYYY-MM-DD.log
```

---

**Updated**: 2024-12-22 | **Session**: 8.7  
**Author**: GitHub Copilot (Claude Sonnet 4.5)

# Logging Fix Summary - Session 8 (Part 2)

**Date**: December 22, 2025  
**Issue**: Terminal shows many log messages but log files are empty

---

## 🐛 Problem Identified

### User Report:
```
Terminal shows:
- [Chat API] Session history: 53 messages
- [MCP Client] ⚡ Response from local in 24875ms (24.8 seconds!)
- [MCP Client] ⚡ Response from local in 7204ms (7.2 seconds)
- [Classify] Classified as: general_question
- [Direct] Generating direct response

But log files are EMPTY!
```

### Root Causes:
1. **console.log() doesn't write to log files** - Only shows in terminal
2. **AI extremely slow** - 24 seconds instead of < 5 seconds
3. **No performance tracking** - Can't diagnose slow responses
4. **Missing logger imports** - Already imported but not used

---

## ✅ Solutions Implemented

### Fix 1: Replace console.log() with logger

**Changed Files:**
- `innomcp-node/src/utils/mcp/mcpclient.ts`
- `innomcp-node/src/routes/api/chat.ts`

**Key Changes:**

#### mcpclient.ts - chatWithOllama Method
**Before:**
```typescript
console.log(`===== Starting chatWithOllama (${aiType.toUpperCase()} AI, ${taskType} task) =====`);
console.log(`[MCP Client] Calling ollama.chat with model: ${model} (${aiType}) ✨`);
console.log(`[MCP Client] ⚡ Response from ${aiType} in ${duration}ms`);
```

**After:**
```typescript
logger.info(`Starting chatWithOllama`, { aiType: aiType.toUpperCase(), taskType, model });
logger.info(`Calling ollama.chat`, { model, aiType, options: JSON.stringify(options || {}) });

// Performance warning for slow responses
if (duration > 5000) {
  logger.warn(`⚠️ SLOW AI RESPONSE`, { 
    aiType, 
    duration, 
    taskType, 
    model,
    threshold: '5000ms',
    options: JSON.stringify(options || {})
  });
} else {
  logger.info(`⚡ AI Response received`, { aiType, duration, taskType });
}
```

#### mcpclient.ts - processMessage Method
**Before:**
```typescript
console.log("===== Starting processMessage =====");
console.log("[Process] Conversation history size:", this.conversationHistory.length);
```

**After:**
```typescript
const processStartTime = Date.now();
logger.info(`Starting processMessage`, { 
  messageLength: userMessage.length,
  historySize: this.conversationHistory.length
});
```

#### mcpclient.ts - Quick Classification
**Before:**
```typescript
console.log(`[Classify] Quick classified as: ${quickCheck.type}, canAnswerDirectly: ${quickCheck.canAnswerDirectly}`);
```

**After:**
```typescript
logger.info(`Quick classified message`, { 
  type: quickCheck.type, 
  canAnswerDirectly: quickCheck.canAnswerDirectly,
  confidence: quickCheck.confidence 
});
```

#### chat.ts - Message Processing
**Before:**
```typescript
console.log("[Chat API] Received message:", clientMessage);
console.log(`[Chat API] Session history: ${sessionHistory.length} messages`);
console.log("[Chat API] Processing message with MCP client...");
```

**After:**
```typescript
logger.info(`Received WebSocket message`, { 
  textLength: clientMessage.text?.length || 0,
  historySize: clientMessage.messages?.length || 0
});
logger.info(`Session history prepared`, { 
  totalMessages: sessionHistory.length,
  mode: AI_MODE
});
logger.info(`Processing with MCP client`, { messageLength: currentText.length });
```

#### chat.ts - Ollama Streaming
**Before:**
```typescript
console.log(`[Chat API] Sending ${ollamaMessages.length} messages to Ollama...`);
console.log(`[Chat API] Receiving streamed response from Ollama...`);
console.log(`[Chat API] AI response: >>>>>>>>> ${aiResponse} ✨`);
```

**After:**
```typescript
const streamStartTime = Date.now();
logger.info(`Sending messages to Ollama`, { 
  messageCount: ollamaMessages.length,
  model: ollamaModel,
  mode: AI_MODE
});
logger.info(`Receiving streamed response from Ollama`, { model: ollamaModel });

// After stream completes
const streamDuration = Date.now() - streamStartTime;
logger.info(`Stream completed`, { 
  duration: streamDuration,
  chunkCount,
  responseLength: aiResponse.length,
  model: ollamaModel
});
logger.info(`AI response complete`, { 
  responseLength: aiResponse.length,
  totalMessages: sessionHistory.length
});
```

---

### Fix 2: Performance Monitoring

**Added Performance Warnings:**
```typescript
// In chatWithOllama method
if (duration > 5000) {
  logger.warn(`⚠️ SLOW AI RESPONSE`, { 
    aiType, 
    duration, 
    taskType, 
    model,
    threshold: '5000ms',
    options: JSON.stringify(options || {})
  });
}
```

**Benefits:**
- ✅ Automatically logs when AI takes > 5 seconds
- ✅ Includes full context: model, options, task type
- ✅ Easy to diagnose performance issues

---

### Fix 3: Structured Logging

**All logger calls now use structured format:**
```typescript
// Instead of: console.log(`Message: ${value}`)
// Use: logger.info(`Message`, { key: value })
```

**Benefits:**
- ✅ Machine-readable JSON format
- ✅ Easy to parse and analyze
- ✅ Consistent across all services
- ✅ Searchable in log files

---

## 📊 Log File Locations

After these changes, all logs will be written to:

### Backend Logs
- **Path**: `innomcp-node/logs/backend-development.log`
- **Contains**: 
  - WebSocket connections
  - Message processing
  - MCP client operations
  - AI response times
  - Performance warnings

### MCP Server Logs
- **Path**: `innomcp-server-node/logs/mcp-server-2025-12-22.log`
- **Contains**:
  - Tool executions
  - MCP requests
  - Server errors

---

## 🎯 Expected Log Output

### Example 1: Normal Fast Response (< 5s)
```json
2025-12-22T05:00:00.000Z [info]: Starting chatWithOllama {"aiType":"LOCAL","taskType":"fast","model":"gemma3:4b"}
2025-12-22T05:00:00.100Z [info]: Calling ollama.chat {"model":"gemma3:4b","aiType":"local","options":"{}"}
2025-12-22T05:00:02.500Z [info]: ⚡ AI Response received {"aiType":"local","duration":2400,"taskType":"fast"}
```

### Example 2: Slow Response (> 5s) - WARNING
```json
2025-12-22T05:00:00.000Z [info]: Starting chatWithOllama {"aiType":"LOCAL","taskType":"accurate","model":"gemma3:4b"}
2025-12-22T05:00:00.100Z [info]: Calling ollama.chat {"model":"gemma3:4b","aiType":"local","options":"{\"temperature\":0.7}"}
2025-12-22T05:00:24.975Z [warn]: ⚠️ SLOW AI RESPONSE {"aiType":"local","duration":24875,"taskType":"accurate","model":"gemma3:4b","threshold":"5000ms","options":"{}"}
```

### Example 3: Complete Message Flow
```json
2025-12-22T05:00:00.000Z [info]: Received WebSocket message {"textLength":15,"historySize":52}
2025-12-22T05:00:00.010Z [info]: Session history prepared {"totalMessages":53,"mode":"local"}
2025-12-22T05:00:00.020Z [info]: Processing with MCP client {"messageLength":15}
2025-12-22T05:00:00.030Z [info]: Starting processMessage {"messageLength":15,"historySize":0}
2025-12-22T05:00:00.040Z [info]: Quick classified message {"type":"general_question","canAnswerDirectly":true,"confidence":0.99}
2025-12-22T05:00:00.050Z [info]: Can answer directly {"type":"general_question","confidence":0.99}
2025-12-22T05:00:00.060Z [info]: Sending messages to Ollama {"messageCount":54,"model":"gemma3:4b","mode":"local"}
2025-12-22T05:00:00.070Z [info]: Receiving streamed response from Ollama {"model":"gemma3:4b"}
2025-12-22T05:00:03.200Z [info]: Stream completed {"duration":3130,"chunkCount":45,"responseLength":250,"model":"gemma3:4b"}
2025-12-22T05:00:03.210Z [info]: AI response complete {"responseLength":250,"totalMessages":54}
```

---

## 🔍 Debugging Performance Issues

### If AI is still slow (> 5s), check logs for:

1. **Check warning entries:**
```bash
grep "SLOW AI RESPONSE" innomcp-node/logs/backend-development.log
```

2. **Verify options are being sent:**
```bash
grep "options" innomcp-node/logs/backend-development.log | tail -5
```

3. **Check if keep_alive is working:**
```bash
grep "keep_alive" innomcp-node/logs/backend-development.log
```

### Expected Options Should Include:
```json
{
  "temperature": 0.0,
  "num_predict": 100,
  "num_ctx": 1024,
  "num_gpu_layers": 50,
  "num_thread": 8,
  "repeat_penalty": 1.0
}
```

---

## 📋 Files Changed

1. ✅ `innomcp-node/src/utils/mcp/mcpclient.ts`
   - Replaced 4 console.log() calls with logger
   - Added performance warning
   - Added structured logging

2. ✅ `innomcp-node/src/routes/api/chat.ts`
   - Replaced 6 console.log() calls with logger
   - Added stream performance tracking
   - Added chunk counting

---

## 🚀 Next Steps

1. **Restart Backend Service**:
   ```bash
   cd innomcp-node
   npm run dev
   ```

2. **Test with Simple Query**:
   - Send: "นายคืออใคร"
   - Expected: Response in < 5 seconds
   - Check logs for structured JSON

3. **Verify Log Files**:
   ```bash
   tail -f innomcp-node/logs/backend-development.log
   ```

4. **Check for Performance Warnings**:
   - If you see "⚠️ SLOW AI RESPONSE", investigate options
   - Verify GPU is being used (num_gpu_layers: 50)
   - Check if model is cached (keep_alive: 30m)

---

## ✅ Success Criteria

- ✅ All log messages appear in log files (not just terminal)
- ✅ Performance warnings show up for responses > 5s
- ✅ Structured JSON format in all logs
- ✅ Can track complete message flow from logs
- ✅ Easy to diagnose slow responses

---

**Status**: All changes compiled successfully. Ready for testing.

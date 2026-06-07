# 🚀 INNOMCP Performance Optimization Plan

## 📊 Current Status Analysis

### Ollama Configuration
- **Model**: gemma3:4b (Q4_K_M quantization)
- **Temperature**: 1.0 (ค่อนข้างสูง - ทำให้ช้า)
- **Context Length**: 131,072 tokens (มากเกินไป)
- **GPU**: ✅ Running on Windows GPU
- **Problem**: ไม่ได้ optimize parameters, ไม่มี streaming

### Current Issues
1. ❌ **No Streaming** - รอจนตอบเสร็จถึงแสดงผล (ช้า)
2. ❌ **High Temperature** - temperature=1 ทำให้คำนวณช้า
3. ❌ **No GPU Optimization** - ไม่ได้ set num_gpu, gpu_layers
4. ❌ **Large Context** - context ใหญ่เกินจำเป็น
5. ❌ **No History Management** - ไม่มีการจัดการ session
6. ❌ **Poor UX** - ไม่มี typing indicator, loading state

---

## 🎯 Optimization Strategy

### Phase 1: AI Speed Optimization (Priority: CRITICAL)

#### 1.1 Enable Streaming Response
**Impact**: ⭐⭐⭐⭐⭐ (เร็วขึ้น 5-10x ในการรับรู้)

**Backend Changes**:
```typescript
// Before (slow)
const response = await ollama.chat({
  model: ollamaModel,
  messages: ollamaMessages,
  stream: false,  // ❌ รอจนจบ
});

// After (fast)
const stream = await ollama.chat({
  model: ollamaModel,
  messages: ollamaMessages,
  stream: true,   // ✅ แสดงทีละคำ
  options: {
    temperature: 0.7,      // ลดจาก 1.0
    num_ctx: 4096,         // ลดจาก 131072
    num_predict: 2048,     // จำกัด response length
    top_k: 40,             // ลดจาก 64
    top_p: 0.9,            // ลดจาก 0.95
    repeat_penalty: 1.1,   // ป้องกันซ้ำ
  }
});

for await (const chunk of stream) {
  ws.send(JSON.stringify({ 
    type: "chunk", 
    text: chunk.message.content 
  }));
}
```

**Frontend Changes**:
```typescript
// Append chunks แบบ real-time
useEffect(() => {
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'chunk') {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.sender === 'ai') {
          return [...prev.slice(0, -1), {
            ...lastMsg,
            text: lastMsg.text + data.text
          }];
        }
        return [...prev, { sender: 'ai', text: data.text }];
      });
    }
  };
}, []);
```

#### 1.2 Optimize Ollama Parameters
**Impact**: ⭐⭐⭐⭐ (เร็วขึ้น 30-50%)

**Create Modelfile**:
```bash
# /tmp/gemma3-optimized.modelfile
FROM gemma3:4b

# Optimized parameters for speed
PARAMETER temperature 0.7
PARAMETER top_k 40
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
PARAMETER num_predict 2048
PARAMETER repeat_penalty 1.1
PARAMETER num_gpu 99
PARAMETER num_thread 8

# System prompt
SYSTEM """You are a fast and efficient AI assistant..."""
```

```bash
# Create optimized model
ollama create gemma3:4b-fast -f /tmp/gemma3-optimized.modelfile
```

#### 1.3 GPU Optimization
**Impact**: ⭐⭐⭐⭐ (ใช้ GPU เต็มที่)

**Environment Variables**:
```env
OLLAMA_MODEL=gemma3:4b-fast
OLLAMA_NUM_GPU=99
OLLAMA_NUM_THREAD=8
OLLAMA_BATCH_SIZE=512
OLLAMA_MAX_TOKENS=2048
```

---

### Phase 2: Chat Features (Priority: HIGH)

#### 2.1 Chat History Management

**Features**:
- ✅ Store history in localStorage
- ✅ Load history on mount
- ✅ Clear history button
- ✅ Export chat (JSON/TXT)
- ✅ Session management
- ✅ Search in history

**Implementation**:
```typescript
// utils/chatHistory.ts
export const saveChatHistory = (messages: Message[]) => {
  const session = {
    id: Date.now(),
    messages,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem('innomcp-chat', JSON.stringify(session));
};

export const loadChatHistory = () => {
  const stored = localStorage.getItem('innomcp-chat');
  return stored ? JSON.parse(stored) : null;
};
```

#### 2.2 Professional Chat Features

**Must Have**:
- ✅ Typing indicator (กำลังพิมพ์...)
- ✅ Loading state (processing...)
- ✅ Retry button (ลองใหม่)
- ✅ Copy message
- ✅ Delete message
- ✅ Edit message
- ✅ Timestamp
- ✅ Token usage counter
- ✅ Response time display

**Nice to Have**:
- 🔵 Voice input
- 🔵 Text-to-speech
- 🔵 Code highlighting
- 🔵 Image upload
- 🔵 File attachment

---

### Phase 3: MCP Tools Testing (Priority: HIGH)

#### 3.1 Test Coverage

**Test Cases**:
1. ✅ Tool discovery (list all tools)
2. ✅ Tool execution (각 tool ทำงานถูกต้อง)
3. ✅ Error handling (tool fail gracefully)
4. ✅ Timeout handling
5. ✅ Multiple tools in one query
6. ✅ Tool result formatting

**Test Script**:
```bash
# Test MCP connection
curl http://localhost:3012/health

# Test tool listing
# (via backend API)

# Test specific queries
- "วันนี้วันอะไร" (datetime tool)
- "สุ่มตัวเลข 1-100" (random tool)
- "สร้าง chart ยอดขาย" (echarts tool)
```

#### 3.2 Error Handling Improvements

**Add Comprehensive Logging**:
```typescript
// Log every MCP operation
logger.info('[MCP] Tool executed', {
  tool: toolName,
  duration: Date.now() - startTime,
  success: true,
  resultSize: JSON.stringify(result).length
});

// Track failures
logger.error('[MCP] Tool failed', {
  tool: toolName,
  error: error.message,
  stack: error.stack
});
```

---

### Phase 4: Performance Testing (Priority: MEDIUM)

#### 4.1 Metrics to Track

**Response Time**:
- Time to first token (TTFT)
- Total response time
- Tokens per second

**Resource Usage**:
- GPU utilization %
- Memory usage (MB)
- CPU usage %

**User Experience**:
- Perceived latency
- UI responsiveness
- Error rate

#### 4.2 Benchmarks

**Target Metrics**:
```
Time to First Token: < 500ms
Total Response (short): < 3s
Total Response (long): < 10s
Tokens/sec: > 50 tokens/sec
GPU Usage: > 80%
Memory: < 4GB
Error Rate: < 1%
```

#### 4.3 Testing Tools

```bash
# Load testing
npm install -g loadtest

# Test response time
loadtest -n 100 -c 10 http://localhost:3011/health

# Monitor GPU
nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv -l 1
```

---

## 📋 Implementation Checklist

### Immediate (Today)
- [x] Analyze current configuration
- [ ] Enable streaming in backend
- [ ] Update frontend to handle streams
- [ ] Optimize Ollama parameters
- [ ] Create optimized Modelfile

### Short Term (This Week)
- [ ] Implement chat history
- [ ] Add typing indicator
- [ ] Add copy/retry/delete buttons
- [ ] Test all MCP tools
- [ ] Add comprehensive logging
- [ ] Performance benchmarking

### Medium Term (Next Week)
- [ ] Advanced chat features
- [ ] Export/import chat
- [ ] Search in history
- [ ] Token usage tracking
- [ ] Voice input (optional)
- [ ] Mobile responsive

---

## 🎯 Expected Results

### Performance Improvements
```
Current:
- Response Time: 10-15 seconds
- Perceived Speed: Slow
- User Experience: Poor

After Optimization:
- Response Time: 2-5 seconds (3x faster)
- First Token: < 500ms (instant feel)
- Perceived Speed: Very Fast
- User Experience: Excellent
```

### Feature Completeness
```
Current:
- Basic chat only
- No history
- No typing indicator
- Limited feedback

After Implementation:
- Professional chat UI
- Full history management
- Real-time feedback
- Comprehensive features
- Production-ready
```

---

## 🚀 Quick Wins (Do First)

### 1. Enable Streaming (10 minutes)
**Impact**: Immediate 5-10x perceived speed improvement
**Difficulty**: Easy

### 2. Lower Temperature (1 minute)
**Impact**: 20-30% faster
**Difficulty**: Very Easy

### 3. Reduce Context Window (1 minute)
**Impact**: 30-40% faster
**Difficulty**: Very Easy

### 4. Add Typing Indicator (5 minutes)
**Impact**: Much better UX
**Difficulty**: Easy

---

**Priority Order**:
1. 🔴 Streaming Response (Critical)
2. 🔴 Optimize Parameters (Critical)
3. 🟠 Chat History (High)
4. 🟠 Typing Indicator (High)
5. 🟠 MCP Testing (High)
6. 🟡 Advanced Features (Medium)

**Total Estimated Time**: 2-3 days for complete implementation

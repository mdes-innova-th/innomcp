# Definition of Done - Phase 6.5 Stabilization

## 1. Functional Requirements

- [ ] **Math Queries**: "2+2", "10\*5" serviced locally without LLM.
- [ ] **Static History**: "รัชกาลที่ 3", "รัชกาลที่ 4" serviced locally without LLM.
- [ ] **Memory Queries**: "สรุป PDPA ที่เราเคยเก็บไว้" triggers Memory Pipeline, NOT `ocrTool` or `fileReaderTool`.
- [ ] **Weather**: "พยากรณ์อากาศ เชียงใหม่ และ ภูเก็ต" returns data for BOTH provinces.
- [ ] **WorldBank**: "GDP Thailand" calls valid API URL.

## 2. Technical Stability

- [ ] **Embedding**: No console errors if Ollama/Nomic is down (Silent Fallback).
- [ ] **Logs**: Clean logs (no "Classification" step for basic queries).
- [ ] **Performance**: Simple queries (Math/History) respond in < 100ms.

## 3. Testing

- [ ] `tests/system/core.spec.ts` created and passing (100%).
- [ ] Regression suite passes.

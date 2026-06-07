# Architecture Refactor: Phase 6.5 Stabilization

## 1. Overview

This document outlines the design for the **Deterministic Fast Path Layer** and the refactored **Tool Selection** logic. The goal is to bypass the LLM for known patterns to achieve <100ms TTFB and 100% determinism for specific queries.

## 2. Fast Path Layer (`src/chat/fastPathLayer.ts`)

This layer sits **before** any AI processing.

### 2.1 Interface

```typescript
interface FastPathResult {
  handled: boolean;
  response?: string;
  action?: "memory_pipeline" | "tool_execution";
  toolName?: string;
  toolArgs?: any;
}

class FastPathLayer {
  process(query: string): FastPathResult | null;
}
```

### 2.2 Logic Handlers

#### A. Math Handler

- **Regex**: `/^[0-9+\-*/().\s]+$/` (Strict check to avoid matching text dates/phones)
- **Action**: `eval()` or `mathjs`.
- **Output**: result string.

#### B. Thai History Handler (Static KB)

- **Data**: `const THAI_HISTORY_KB = { ... }`
- **Logic**: Check if query contains Key (e.g. "รัชกาลที่ 3").
- **Output**: Value from Map.

#### C. Memory Intent Handler

- **Regex**: `/(เก็บ|เคย|สรุป).*(ไว้|ที่)/`
- **Action**: Return `{ action: "memory_pipeline" }`.
- **Output**: Signals `ChatHandler` to invoke `IntelligencePipeline` with memory enabled immediately.

## 3. Deterministic Tool Selection (`src/chat/toolSelector.ts`)

Refactor `selectTools` to use a priority waterfall:

### Priority 1: Semantic/Keyword Map

Hardcoded mapping for high-precision keywords:

- `"พยากรณ์"`, `"อากาศ"` -> `weather_tool`
- `"gdp"`, `"เศรษฐกิจ"` -> `world_bank_tool` (if consistent)
- `"กฎหมาย"`, `"มาตรา"` -> `thai_law_tool`
- `"วัด"`, `"พระ"` -> `thai_religion_tool`

### Priority 2: AI Classification (Last Resort)

Only if no Fast Path and no Keyword match found.

## 4. Integration Point (`src/chat/chatHandler.ts`)

```typescript
async function processMessage(userMessage: string) {
  // 1. Fast Path Check
  const fastResult = fastPathLayer.process(userMessage);

  if (fastResult?.handled) {
    if (fastResult.response) return fastResult.response;
    if (fastResult.action === "memory_pipeline") {
      return pipeline.execute(userMessage, { memoryOnly: true });
    }
  }

  // 2. Deterministic Tool Selector
  const suggestedTool = toolSelector.select(userMessage);
  if (suggestedTool) {
    return executeTool(suggestedTool);
  }

  // 3. Fallback to AI (General Chat / Complex Intent)
  return chatWithOllama(userMessage);
}
```

## 5. Tool Fixes Design

### Weather Tool

- **Problem**: "Chiang Mai and Phuket" -> Returns only one.
- **Fix**:
  - In `execute()`: Detect multiple provinces via regex.
  - Fire parallel requests.
  - Join results.

### Embedding Service

- **Fix**: Wrap `fetch` in `try/catch`. Return `null` on error. Ensure `Pipeline` handles `null` by falling back to Keyword search without logging error stack trace.

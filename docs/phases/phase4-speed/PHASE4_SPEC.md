# Phase 4: Speed & Intelligence Pipeline

## 🎯 Goals

1.  **Speed**:
    - **Selection Latency**: < 200ms (from input to tool decision).
    - **Progressive Output**: First token/chunk < 1.5s.
2.  **Intelligence**:
    - **Parallel Execution**: Run top-3 likely tools simultaneously if confidence is split.
    - **Thai-Only Optimization**: Optimize embedding/keyword matching for Thai language.
3.  **Reliability**:
    - **Regression Free**: Phase 3.5 Battery failures = 0.

## 🏗️ Architecture

### 1. Fast Selector (The "Flash" Layer)

- **Old Way**: LLM call for selection (~2s).
- **New Way**: Keyword/Embedding/Regex hybrid (< 200ms).
- **Logic**:
  - If `province` detected -> `nwp_daily_by_place` (Confidence: 0.9).
  - If `math` detected -> `calculator` (Confidence: 0.99).
  - If ambiguous -> Fallback to LLM (but only for complex queries).

### 2. Parallel Executor

- If `Fast Selector` returns multiple tools with confidence > 0.6:
  - Execute ALL of them in parallel `Promise.all()`.
  - Aggregator filters results based on success/relevance.

### 3. Progressive Response

- Stream tool results as they arrive.
- Do not wait for the slowest tool if a faster one answers the query.

## 🧪 Definition of Done (DoD)

1.  **Selection Speed**: Benchmark `tests/speed/benchmark.spec.ts` shows < 200ms avg selection time.
2.  **Output Speed**: Time-to-first-byte (TTFB) < 1.5s.
3.  **Parallelism**: Trace logs show multiple tools starting at timestamp T0.
4.  **Language**: 100% accurate selection for Thai inputs (e.g., "พยากรณ์อากาศเชียงใหม่").
5.  **Quality**: Phase 3.5 Reliability Battery passes 100%.

## 🚫 Out of Scope

- New Tools (Use existing only).
- UI Changes (Backend optimization only).

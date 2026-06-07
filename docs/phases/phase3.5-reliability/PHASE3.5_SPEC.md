# Phase 3.5: Tool & API Reliability + Speed

## 🎯 Objectives

1.  **Reliability**: Ensure every tool works (PASS), fails gracefully (FAIL), or identifies missing dependencies (SKIP).
2.  **Coverage**: Test 10 distinct questions per tool/endpoint.
3.  **Performance**: Measure and log latency for every call.
4.  **Intelligence**: Verify "Local AI Pre-think" and "Multi-tool" capabilities.
5.  **Stability**: Do NOT break Phase 1 (Geo) or Phase 2 (History).

## 🚫 Out of Scope

- `thaiGeoTool` (Phase 1 - Locked)
- `thaiHistoryTool` (Phase 2 - Locked)

## 🛠️ Target Tools & Categories

### 1. Weather & Environment (High Priority)

- `nwpDailyTool`
- `nwpHourlyTool`
- `tmdTools`
- `weatherTool`

### 2. Knowledge & Data

- `keywordTool` (Thai Knowledge DB support)
- `govDataTool`
- `worldBankTool`
- `nasaTool`
- `evidenceTool`

### 3. Productivity & Utilities

- `calculatorTool`
- `currencyExchangeTool`
- `translationTool`
- `dateTimeTool`
- `qrCodeTool`

### 4. System & Files

- `fileReaderTool`
- `storageTool`
- `archiveTool`

## 📊 Testing Methodology

For each tool, we will run a **Battery Test**:

- **Inputs**: 10 varied prompts (Normal, Edge Case, Injection, Thai Language).
- **Metrics**:
  - Success Rate (PASS/FAIL)
  - Latency (ms)
  - Response Quality (Schema valid?)

## 🧩 Special Scenarios

1.  **Multi-tool Parallel**: Ask a question requiring 2+ tools (e.g., "Exchange rate USD-THB and Weather in Bangkok").
2.  **Streaming**: Verify chunked responses (if supported).
3.  **Pre-think**: Check if the model "thinks" before calling critical tools.

## 📦 Deliverables

1.  `tests/reliability/test_battery.ts`: Main test runner.
2.  `reports/reliability_report.md`: Latency & Status table.
3.  `prompts/CLAUDE.txt`: Design the test cases.
4.  `prompts/VITCUP.txt`: Implement and run.

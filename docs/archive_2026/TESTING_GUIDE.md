# INNOMCP Testing Guide

## Overview

This document describes the testing strategy and procedures for the INNOMCP project, which includes:
- MCP Server (Node.js with 26 tools including 17 TMD APIs)
- Backend API (Express.js on port 3011)  
- Frontend (Next.js on port 3000)

## Test Suites

### 1. Unit Tests - MCP Tools

**Location:** `innomcp-server-node/tests/test-all-tools.ts`

**Purpose:** Test individual MCP tools via HTTP API calls

**Coverage:**
- dateTimeTool (date/time formatting)
- calculatorTool (math expressions)
- newton (symbolic math - external API)
- archive (Internet Archive search)
- nasa (NASA APOD API)
- weather (OpenWeather API - requires OPENWEATHER_API_KEY)
- worldbank (World Bank data)
- govdata (data.gov search)
- echartsTool (SVG chart generation with Puppeteer)
- tmd_* tools (17 Thailand Meteorological Department APIs)
- webdTool_* (requires WEBDDSB_APIKEY)

**How to Run:**

**Option A: From Windows PowerShell (Recommended)**
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-server-node\tests
.\run-tests-windows.ps1
```

**Option B: Direct ts-node**
```bash
cd innomcp-server-node
npx ts-node tests/test-all-tools.ts
```

⚠️ **Important:** Tests must run from Windows, not WSL, due to MCP server binding to `[::1]:3012` (IPv6 localhost only).

**Expected Results:**
- ~60% pass rate (some tools require API keys)
- Response times: 10ms - 14s depending on tool
- Timeouts configured per tool complexity

### 2. End-to-End Tests - Tool Selection

**Location:** `tests/e2e/tests/tool-selection.spec.ts`

**Purpose:** Test chat interface's ability to select correct tools for user queries

**Coverage:** 30 test scenarios across 10 categories:
1. Greetings (no tools needed)
2. DateTime queries
3. Calculator/math operations
4. Newton symbolic math
5. Weather information
6. Archive searches
7. NASA/space data
8. World Bank economics
9. Government data
10. Data visualization (ECharts)

**How to Run:**
```bash
cd tests/e2e
npx playwright test tool-selection.spec.ts --workers=2
```

**Configuration:**
- Timeout: 120s per test (handles slow AI + tool execution)
- Workers: 2 (parallel execution)
- Global timeout: 60s default (overridden per test)

**View Results:**
```bash
npx playwright show-report
```

**Expected Behavior:**
- Each test sends a question to chat
- Waits for AI response (max 90s)
- Verifies correct tool was used
- Captures logs from all 3 services

### 3. End-to-End Tests - TMD Validation

**Location:** `tests/e2e/tests/tmd-validation.spec.ts`

**Purpose:** Test all 17 TMD API integrations through chat interface

**Coverage:**
- Seismic activity data
- Climate statistics
- Weather forecasts (1-day, 3-day, 7-day)
- Rainfall measurements
- Station information
- Weather warnings

**How to Run:**
```bash
cd tests/e2e
npx playwright test tmd-validation.spec.ts
```

**Known Issues:**
- ❌ All tests currently failing (chat not responding to TMD questions)
- Requires investigation of chat → backend → MCP → TMD API flow

## Prerequisites

### Services Must Be Running:
1. **MCP Server** (port 3012): `cd innomcp-server-node && npm run dev`
2. **Backend API** (port 3011): `cd innomcp-node && npm run dev`
3. **Frontend** (port 3000): `cd innomcp-next && npm run dev`

### Required Environment Variables:
```bash
# Optional - skips tests if missing
OPENWEATHER_API_KEY=your_key_here
WEBDDSB_APIKEY=your_key_here
```

### Tools Installed:
- Node.js 18+
- TypeScript
- Playwright (for E2E tests)
- ts-node (for unit tests)

## Test Results Locations

### Unit Tests:
- Console output only (no files generated)
- Exit code 0 = success, 1 = failures

### E2E Tests:
- JSON: `tests/e2e/test-results.json`
- HTML Report: `tests/e2e/playwright-report/index.html`
- Screenshots/Videos: `tests/e2e/test-results/*/`
- Custom Results: `tests/e2e/results/test-results-*.json`
- Custom Summary: `tests/e2e/results/test-summary-*.md`

## Performance Benchmarks

### Tool Response Times (Target < 2s, except external APIs):
| Tool | Expected Time | Status |
|------|---------------|--------|
| dateTimeTool | 65ms | ✅ Excellent |
| calculatorTool | 10-18ms | ✅ Excellent |
| newton | 334-1572ms | ⚠️ Slow (external) |
| archive | 1309ms | ✅ Good |
| nasa | 1149ms | ✅ Good |
| worldbank | 602ms | ✅ Good |
| govdata | 1225ms | ✅ Good |
| echartsTool | 1716ms | ✅ Good |
| TMD tools | 13-15s | ❌ Very Slow |

### E2E Test Response Times (AI + Tool + Rendering):
| Category | Expected Time | Status |
|----------|---------------|--------|
| Simple greeting | 17-18s | ⚠️ Slow |
| DateTime query | 24s | ⚠️ Slow |
| Calculator | 20-25s | ⚠️ Slow |
| Complex queries | 30-60s | ⚠️ Very Slow |

**Note:** E2E times include:
- WebSocket connection establishment
- AI model inference (local Ollama)
- Tool execution
- Response streaming
- UI rendering

## Troubleshooting

### Issue: "MCP server not responding" in WSL
**Solution:** Run tests from Windows PowerShell
```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-server-node\tests
.\run-tests-windows.ps1
```

### Issue: "Test timeout of 30000ms exceeded"
**Solution:** Already fixed - timeout increased to 120s per test

### Issue: "echartsTool pattern not matched"
**Cause:** WSL can't connect to MCP server
**Solution:** Run from Windows (issue is connectivity, not tool)

### Issue: Playwright browser won't start
**Solution:** 
```bash
npx playwright install chromium
```

### Issue: TMD E2E tests all fail
**Status:** Under investigation
**Workaround:** Test TMD tools directly via unit tests

## Continuous Improvement

### Current Goals:
1. ✅ Fix unit test timeouts (newton: 1500ms → 2000ms)
2. ✅ Fix E2E test timeouts (30s → 120s)
3. ✅ Create Windows test runner script
4. ⏳ Fix AI tool selection logic (greeting issue)
5. ⏳ Debug TMD chat integration
6. ⏳ Optimize TMD response time (14s → <5s target)

### Target Metrics:
- Unit Tests: 100% pass rate (with API keys)
- E2E Tool Selection: 100% accuracy
- TMD E2E Tests: 100% pass rate
- Response Times: <2s (non-external), <5s (external)

## Test Development Guidelines

### Adding New Tool Tests:
1. Add test case to `TOOL_TESTS` array in `test-all-tools.ts`
2. Specify: name, args, expectedPattern, maxDuration
3. Pattern should match success indicators in response
4. Set realistic timeout based on tool complexity

### Adding New E2E Tests:
1. Add test case to `TEST_QUESTIONS` array in `tool-selection.spec.ts`
2. Specify: question, expectedTool, category
3. For complex queries, increase test timeout
4. Consider adding to appropriate category (datetime, math, weather, etc.)

## Viewing Real-Time Logs

### Backend Logs:
```bash
# If using Docker
docker logs -f innomcp-node-container

# If running locally
# Check terminal where backend is running
```

### MCP Server Logs:
```bash
# Check terminal where MCP server is running
cd innomcp-server-node
npm run dev
```

### Frontend Logs:
```bash
# Check browser console
# Or terminal where Next.js is running
cd innomcp-next
npm run dev
```

## Contact & Support

For issues or questions about testing:
1. Check [TEST_SUMMARY_LATEST.md](../TEST_SUMMARY_LATEST.md) for latest results
2. Check test result files in `tests/e2e/results/`
3. Review Playwright HTML report for E2E failures
4. Check logs from all 3 services for errors

---

**Last Updated:** 2026-01-02  
**Test Coverage:** 26 tools (17 TMD + 9 general)  
**Test Suites:** 3 (unit + 2 E2E)  
**Total Test Cases:** 15 unit + 30 E2E tool selection + 17 E2E TMD = 62 tests

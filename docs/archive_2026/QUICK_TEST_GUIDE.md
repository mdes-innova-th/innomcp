# 🚀 Quick Start: Testing INNOMCP AI Assistant

## Prerequisites Check ✅

Before running tests, verify these 3 services are running:

```bash
# Terminal 1: Frontend
# Check: http://localhost:3000 should show UI
netstat -an | grep ":3000"

# Terminal 2: Backend  
# Check: http://localhost:3011/health should return {"status":"ok"}
netstat -an | grep ":3011"

# Terminal 3: MCP Server
# Check: http://localhost:3012 should be listening
netstat -an | grep ":3012"
```

## 1-Minute Test ⚡

Test the most important features:

```bash
cd /mnt/c/Users/USER-NT/DEV/innomcp/tests/e2e

# Quick smoke test (5 essential checks)
npx playwright test -g "dateTimeTool|calculatorTool|TMD Weather|Health" --reporter=list
```

## 5-Minute Full Test 🧪

Run all 43 professional tests:

```bash
cd /mnt/c/Users/USER-NT/DEV/innomcp/tests/e2e

# All test suites
npx playwright test --reporter=html

# Open report in browser
npx playwright show-report
```

## Test By Category 📂

### Week 1-3 Features (TODO.md Requirements)
```bash
# Session, Character, Intent Gate, Rate Limit (8 tests)
npx playwright test week1-features.spec.ts

# DB Phrases, Metrics, Cache (7 tests)
npx playwright test week2-features.spec.ts

# FastPath comprehensive scenarios (10 tests)
npx playwright test fastpath-enterprise.spec.ts
```

### 26 MCP Tools (Professional Suite)
```bash
# All tools test (18 tests)
npx playwright test mcp-tools-professional.spec.ts

# Core tools only
npx playwright test -g "Core Functions"

# Weather tools only  
npx playwright test -g "Weather"

# Data APIs only
npx playwright test -g "Data Access"
```

## Manual UI Testing 🖱️

Open frontend and try these commands:

### Core Tools
```
วันนี้วันอะไร
→ Should show current date (2026-01-12)

10!
→ Should calculate 3,628,800

2^10 เท่าไร
→ Should return 1024
```

### Weather (TMD - 17 tools)
```
อากาศวันนี้กรุงเทพเป็นอย่างไร
→ Should show temperature, conditions

พยากรณ์อากาศ 7 วันข้างหน้า
→ Should show week forecast

มีแผ่นดินไหววันนี้ไหม
→ Should show seismic status
```

### Visualization (ECharts)
```
สร้างกราฟแท่ง ยอดขาย Q1:100 Q2:150 Q3:200 Q4:180
→ Should display bar chart

สร้างกราฟเส้น อุณหภูมิ มค:25 กพ:27 มีค:30 เมย:32
→ Should display line graph
```

### Data APIs
```
ค้นหาหนังสือเรื่อง Python Programming
→ Internet Archive results

ภาพจาก NASA วันนี้
→ Astronomy Picture of the Day

GDP ของไทยในปี 2023
→ World Bank economic data

สภาพอากาศ New York
→ Weather forecast

simplify (x+1)^2
→ x^2 + 2x + 1
```

### FastPath Intelligence
```
สวัสดี
→ Should reply in <2 seconds (FastPath bypass)

999!
→ Should calculate directly (Intent Gate math bypass)

ฝนตกไหม
→ Should query TMD (Intent Gate weather bypass)
```

### Session Memory
```
ฉันชื่อจอห์น
→ "จดจำแล้วครับ"

ฉันชื่ออะไร
→ Should remember "จอห์น" from previous message
```

## Debugging Tests 🐛

### Test is Failing?

```bash
# Run with UI to see what's happening
npx playwright test --ui

# Run single test with debug
npx playwright test --debug -g "test-name"

# Generate trace
npx playwright test --trace on
```

### Common Issues

**Issue**: Test timeout
```bash
# Solution: Increase timeout in playwright.config.ts
timeout: 90 * 1000, // 90 seconds
```

**Issue**: Send button not found
```typescript
// Check frontend has button with text: "Send", "ส่ง", or "→"
// Or Enter key should work
```

**Issue**: Backend not responding
```bash
# Check backend logs in Terminal 2
# Verify: http://localhost:3011/health
```

**Issue**: Ollama slow
```bash
# Check Ollama status
ollama list

# Try lighter model if needed
# (Current system uses configured model)
```

## Test Results Interpretation 📊

### Passing Test ✅
```
✅ [chromium] › mcp-tools-professional.spec.ts:30:7 › dateTimeTool: Get current date/time
   Duration: 8.2s
```
**Meaning**: Feature working correctly

### Failing Test ❌
```
❌ [chromium] › week1-features.spec.ts:15:7 › Session Memory  
   Timeout 60000ms exceeded
   Call log:
   - waiting for locator('body')
```
**Troubleshooting**:
1. Check if backend is running (Terminal 2)
2. Verify Ollama is active
3. Check browser console errors (run with `--headed`)
4. Review backend logs for errors

### Flaky Test ⚠️
```
⚠️  Test passed on retry 2/3
```
**Meaning**: Test is unstable, may need:
- Longer timeouts
- Better element waiting
- Network stability check

## Performance Expectations ⏱️

| Test Type | Expected Duration |
|-----------|-------------------|
| Single test | 8-15 seconds |
| Week 1 suite (8 tests) | 2-3 minutes |
| Week 2 suite (7 tests) | 2-3 minutes |
| FastPath suite (10 tests) | 3-4 minutes |
| MCP Tools suite (18 tests) | 5-7 minutes |
| **All tests (43)** | **12-17 minutes** |

## Continuous Testing 🔄

### Watch Mode (Development)
```bash
# Re-run tests on file changes
npx playwright test --watch
```

### CI/CD Integration
```bash
# Headless mode for automation
npx playwright test --reporter=json > results.json

# Check exit code
echo $?  # 0 = all passed, 1 = failures
```

## Test Coverage Summary 📈

After running all tests, you should see:

```
✅ 43 tests passing
⏱️  Total duration: ~15 minutes
📊 Coverage:
   - Week 1 features: 5/5 ✅
   - Week 2 features: 3/3 ✅
   - Week 3 features: 2/2 ✅
   - MCP Tools: 26/26 ✅
   - Integration: 4 scenarios ✅
```

## Next Steps After Testing 🎯

1. **Generate Report**
   ```bash
   npx playwright test --reporter=html
   npx playwright show-report
   ```

2. **Share Results**
   - HTML report: `test-results/index.html`
   - Screenshots: `test-results/screenshots/`
   - Videos: `test-results/videos/` (if enabled)

3. **Document Findings**
   - Update [FEATURES_DOCUMENTATION.md](./FEATURES_DOCUMENTATION.md)
   - Add test evidence to README.md
   - Create bug tickets for failures

4. **Continue Development**
   - Check [TODO.md](./TODO.md) for next tasks
   - Fix any failing tests
   - Add new features with tests

## Need Help? 🆘

**Test not working?**
1. Check [TEST_EXECUTION_REPORT.md](./TEST_EXECUTION_REPORT.md) for detailed instructions
2. Review [FEATURES_DOCUMENTATION.md](./FEATURES_DOCUMENTATION.md) for feature specs
3. Verify all 3 services running (Frontend, Backend, MCP Server)

**Feature not clear?**
- See [FEATURES_DOCUMENTATION.md](./FEATURES_DOCUMENTATION.md) for complete feature list with examples

**Performance issues?**
- Check Rate Limiting (8 req/5s)
- Verify Ollama model loaded
- Review backend logs for bottlenecks

---

**Quick Reference**:
- Frontend: http://localhost:3000
- Backend: http://localhost:3011
- MCP Server: http://localhost:3012
- Metrics: http://localhost:3011/api/metrics
- Health: http://localhost:3011/health

🎉 **Happy Testing!**

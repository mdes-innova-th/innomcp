# 📘 INNOMCP Testing Workflow Guide

**Version**: 2.0  
**Last Updated**: 2026-01-13  
**For**: Development Team

---

## 🎯 Overview

คู่มือนี้อธิบายขั้นตอนการทดสอบก่อน commit code เพื่อป้องกัน regression และรักษาคุณภาพระบบ

---

## 🔧 Setup (First Time)

### 1. ติดตั้ง Dependencies
```powershell
cd innomcp-node
npm install
```

### 2. ตรวจสอบ Backend & MCP Server ทำงาน
```powershell
# Terminal 1: Backend
cd innomcp-node
npm run dev

# Terminal 2: MCP Server  
cd innomcp-server-node
npm run dev

# Terminal 3: Frontend (optional)
cd innomcp-next
npm run dev
```

### 3. สร้าง Baseline แรก (ครั้งเดียว)
```powershell
cd innomcp-node
npm run test:regression -- --save-baseline production-v1.0
```

นี่จะใช้เวลา ~10-15 นาที (187 tests)

---

## 🚀 Daily Workflow

### Before Starting Work on TODO

**1. Pull Latest Code**
```powershell
git pull origin main
```

**2. Run Quick Smoke Test** (5 critical queries, ~30 seconds)
```powershell
npm run test:regression -- --group BASIC --todo "before-todo-XX"
```

**3. Create Before-Baseline** (if making significant changes)
```powershell
npm run test:regression -- --save-baseline todo-XX-before
```

---

### While Working on TODO

**Code → Test → Iterate**

```powershell
# 1. Make code changes
# 2. Save file
# 3. Run relevant tests

# Example: Testing weather queries only
npm run test:regression -- --group TMD

# Example: Testing specific query
npm run test:regression -- --query "กรุงเทพ"
```

---

### Before Committing

**1. Run Full Test Suite**
```powershell
npm run test:regression -- --compare production-v1.0
```

**Expected Output**:
```
📊 Test Summary
Total:    187 queries
Passed:   178 (95.2%)
Failed:   9

📈 Comparison with Baseline
Accuracy: 95.2% +0.2%
Duration: 2500ms +100ms

✅ No regressions detected
```

**2. If Tests Pass → Commit**
```powershell
git add .
git commit -m "feat: implement TODO #XX - description"
git push origin your-branch
```

**3. If Tests Fail → Fix Issues**
```
❌ Regressions Detected (3):
  - NWP-1.1: พยากรณ์อากาศ 24 ชม. กรุงเทพ...
  - TMD-8: พยากรณ์อากาศ 7 วัน...
  - BASIC-5: Calculator query...
```

**Debug Steps**:
```powershell
# 1. Check which tests failed
cat test-timeline/latest-*.json | jq '.results[] | select(.pass == false)'

# 2. Re-run failed test individually
npm run test:regression -- --query "กรุงเทพ"

# 3. Check backend logs
tail -f innomcp-node/logs/app.log

# 4. Fix code
# 5. Re-test
npm run test:regression -- --compare production-v1.0
```

---

## 🧪 Testing Commands Reference

### Quick Tests (< 1 minute)
```powershell
# Test only BASIC tools (datetime, calculator, etc.)
npm run test:regression -- --group BASIC

# Test specific query
npm run test:regression -- --query "123 + 456"

# Test 5 critical queries
npm run test:regression -- --query "กรุงเทพ|โคราช|เชียงใหม่"
```

### Full Test Suite (~10-15 minutes)
```powershell
# All 187 tests
npm run test:regression

# Save as new baseline
npm run test:regression -- --save-baseline my-baseline

# Compare with existing baseline
npm run test:regression -- --compare production-v1.0
```

### Test by Category
```powershell
# NWP tools only
npm run test:regression -- --group NWP

# TMD tools only
npm run test:regression -- --group TMD

# Basic tools (datetime, calculator, charts)
npm run test:regression -- --group BASIC

# External APIs (worldbank, nasa, archive)
npm run test:regression -- --group WB
```

---

## 📊 Understanding Test Results

### Timeline Files
ทุกครั้งที่รัน test จะสร้างไฟล์:
```
innomcp-node/test-timeline/
  timeline-2026-01-13T23-15-30.json
  todo-10-2026-01-13T23-20-00.json
```

**Structure**:
```json
{
  "timestamp": "2026-01-13T23:15:30Z",
  "todo": "TODO-10",
  "totalQueries": 187,
  "passed": 178,
  "failed": 9,
  "duration": 450000,
  "results": [
    {
      "queryId": "NWP-1.1",
      "query": "พยากรณ์อากาศ...",
      "expectedTool": "nwp_hourly_by_location",
      "actualTool": "nwp_hourly_by_location",
      "pass": true,
      "duration": 2500,
      "logs": {
        "contextDetection": "🔮 FUTURE 📍 กรุงเทพมหานคร"
      }
    }
  ],
  "summary": {
    "toolAccuracy": 95.2,
    "averageDuration": 2405,
    "commonIssues": {
      "Wrong tool": 3,
      "Province filtering not applied": 2
    }
  }
}
```

### Baseline Files
Baselines ถูกเก็บที่:
```
innomcp-node/test-baseline/
  production-v1.0.json
  todo-10-before.json
  todo-10-after.json
```

---

## 🔍 Debugging Failed Tests

### Step 1: Identify Failed Queries
```powershell
# ดู timeline ล่าสุด
$timeline = Get-Content test-timeline/*.json -Raw | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ConvertFrom-Json
$timeline.results | Where-Object { -not $_.pass } | Format-Table queryId, query, issues
```

### Step 2: Check Backend Logs
**Backend console**:
```
[MCP Client] 🎯 Context: 🔮 FUTURE 📍 นครราชสีมา
[MCP Client] 🎯 Tool priority scores: tmd_weather_forecast_7days_by_province: 231
[MCP Client] 🎯 Forced province argument: นครราชสีมา
[Enhanced Context] 🔍 Filtered to province: นครราชสีมา
```

**What to look for**:
- ✅ Context detection correct? (FUTURE vs PRESENT)
- ✅ Location mapping correct? (โคราช → นครราชสีมา)
- ✅ Tool selected correct?
- ✅ Arguments correct?
- ✅ Province filtered?

### Step 3: Manual Test
```powershell
# Use test HTML page
Start-Process "file:///C:/Users/USER-NT/DEV/innomcp/test-province-filter.html"

# Or use curl
$body = '{"message":"กลางดึกคืนนี้ โคราชฝนตกไหม","sessionId":"debug-123"}'
curl.exe -X POST http://localhost:3011/api/chat -H "Content-Type: application/json" -d $body
```

### Step 4: Fix & Re-test
```powershell
# 1. Edit code
# 2. Save (backend auto-reloads with nodemon)
# 3. Re-run test
npm run test:regression -- --query "failed-query-here"

# 4. If pass → run full suite
npm run test:regression -- --compare production-v1.0
```

---

## 📈 Success Metrics

### Minimum Requirements Before Commit
- ✅ **Tool Accuracy**: ≥ 90% (ideally ≥ 95%)
- ✅ **No Regressions**: 0 tests that passed before now fail
- ✅ **Response Time**: p95 < 5s
- ✅ **Error Rate**: < 5%

### Example Good Result
```
Total:    187 queries
Passed:   180 (96.3%) ✅
Failed:   7 (3.7%)    ✅
Duration: 465s (avg: 2486ms) ✅

Accuracy: 96.3% +1.1% ✅
No regressions detected ✅
```

### Example Bad Result (DO NOT COMMIT)
```
Total:    187 queries
Passed:   165 (88.2%) ❌ (< 90%)
Failed:   22 (11.8%)  ❌

Accuracy: 88.2% -7.0% ❌ (regression!)

⚠️ Regressions Detected (15):
  - NWP-1.1, NWP-1.2, TMD-8, ...
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "No test questions found"
**Cause**: Invalid filter or typo  
**Solution**:
```powershell
# Check available groups
Get-Content ../tests/list-q2chat.txt | Select-String "^\w+-\d"

# Use exact group name
npm run test:regression -- --group "NWP-Hourly"
```

### Issue 2: Backend not responding
**Symptoms**: All tests timeout  
**Solution**:
```powershell
# 1. Check if backend running
Get-NetTCPConnection -LocalPort 3011 -State Listen

# 2. If not, start it
cd innomcp-node
npm run dev

# 3. Check MCP server too
Get-NetTCPConnection -LocalPort 3012 -State Listen
```

### Issue 3: Tests slow (> 20 minutes)
**Cause**: Too many queries or slow AI  
**Solution**:
```powershell
# Use filters to test subset
npm run test:regression -- --group BASIC   # Quick (~2 min)
npm run test:regression -- --group TMD     # Medium (~5 min)
npm run test:regression                    # Full (~15 min)
```

### Issue 4: Province filtering not working
**Debug**:
```powershell
# Check backend logs for:
[Enhanced Context] 🔍 Filtered to province: ...

# If not appearing, check:
# 1. mcpclient.ts lines 2357-2410
# 2. JSON parsing strategy (direct/split/regex)
# 3. Province name matching (โคราช vs นครราชสีมา)
```

### Issue 5: Test results inconsistent
**Cause**: AI model variance or cache  
**Solution**:
```powershell
# 1. Clear Redis cache
docker exec -it innomcp-redis redis-cli FLUSHALL

# 2. Re-run test 3 times, check consistency
npm run test:regression -- --query "test-query"
# Run 2 more times, accuracy should be similar (±2%)
```

---

## 🎯 Best Practices

### DO ✅
- ✅ Run tests before every commit
- ✅ Create baseline before major changes
- ✅ Use `--group` for quick iterations
- ✅ Check backend logs for context detection
- ✅ Document new test cases in list-q2chat.txt
- ✅ Commit baselines to git (if stable)

### DON'T ❌
- ❌ Commit if tests show regressions
- ❌ Skip tests because "it's just a small change"
- ❌ Ignore common issues in timeline
- ❌ Run tests without backend/MCP server
- ❌ Modify test questions to pass tests (fix code instead!)

---

## 📚 Additional Resources

### Files
- **Test Runner**: `innomcp-node/test-runner.ts`
- **Test Questions**: `tests/list-q2chat.txt` (187 queries)
- **Test HTML**: `test-province-filter.html` (quick manual test)
- **Master Plan**: `COMPREHENSIVE_TODO_MASTER.md` (70 TODOs)

### Guides
- **Quick Start**: `TEST_RUNNER_GUIDE.md`
- **E2E Testing**: `tests/TESTING_GUIDE_COMPLETE.md`
- **Dev Summary**: `DEV_SUMMARY_2026-01-13.md`

### Commands Cheat Sheet
```powershell
# Quick smoke test (30s)
npm run test:regression -- --group BASIC

# Test specific feature
npm run test:regression -- --query "keyword"

# Full regression test (15m)
npm run test:regression -- --compare production-v1.0

# Save new baseline
npm run test:regression -- --save-baseline my-name

# View latest results
Get-Content test-timeline/*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

---

## 🤝 Getting Help

### If Tests Fail
1. Check `test-timeline/*.json` for details
2. Look at backend console logs
3. Use `test-province-filter.html` for manual test
4. Read error messages in timeline
5. Ask team lead if stuck

### If Unsure About Result
- **>95% accuracy**: ✅ Good to commit
- **90-95% accuracy**: ⚠️ Review failures, likely OK if no regressions
- **<90% accuracy**: ❌ DO NOT COMMIT, fix issues first

### Report Issues
If you find:
- Test questions that are wrong
- Flaky tests (pass/fail inconsistently)
- Missing test coverage

→ Add to `COMPREHENSIVE_TODO_MASTER.md` or create issue

---

**Happy Testing!** 🚀

Remember: **Good tests = Good code = Happy users**

# INNOMCP Test Runner - Quick Start Guide

## 📋 Overview
Test Runner สำหรับตรวจสอบว่าการพัฒนา TODOs ไม่ทำให้เกิด regression ในระบบ

## 🚀 Quick Start

### 1. รันเทสทั้งหมด
```powershell
cd innomcp-node
npm run test:regression
```

### 2. บันทึก baseline ก่อนทำงาน TODO
```powershell
# ก่อนเริ่มทำ TODO #10
npm run test:regression -- --save-baseline todo-10-before
```

### 3. รันเทสหลังทำ TODO เสร็จ และเปรียบเทียบ
```powershell
# หลังทำ TODO #10 เสร็จแล้ว
npm run test:regression -- --compare todo-10-before --todo "TODO-10"
```

### 4. รันเทสเฉพาะกลุ่ม
```powershell
# ทดสอบเฉพาะ NWP tools
npm run test:regression -- --group NWP-Hourly

# ทดสอบเฉพาะ TMD tools
npm run test:regression -- --group TMD
```

### 5. รันเทสเฉพาะคำถาม
```powershell
# ทดสอบเฉพาะคำถามที่มี "โคราช"
npm run test:regression -- --query "โคราช"

# ทดสอบเฉพาะคำถาม "กลางดึกคืนนี้"
npm run test:regression -- --query "กลางดึก"
```

## 📊 Output

### Timeline Files
ทุกครั้งที่รัน test จะสร้างไฟล์ใน `test-timeline/`:
```
test-timeline/
  timeline-2026-01-13T21-55-52.json
  TODO-10-2026-01-13T22-10-30.json
```

### Baseline Files
Baseline จะถูกบันทึกใน `test-baseline/`:
```
test-baseline/
  todo-10-before.json
  todo-10-after.json
```

### Report Format
```json
{
  "timestamp": "2026-01-13T21:55:52Z",
  "todo": "TODO-10",
  "totalQueries": 50,
  "passed": 48,
  "failed": 2,
  "duration": 125000,
  "results": [
    {
      "queryId": "NWP-1.1",
      "query": "พยากรณ์อากาศ 24 ชม. กรุงเทพ",
      "expectedTool": "nwp_hourly_by_location",
      "actualTool": "nwp_hourly_by_location",
      "pass": true,
      "issues": [],
      "logs": {
        "contextDetection": "🔮 FUTURE 📍 กรุงเทพมหานคร",
        "forcedArgument": "lat: 13.75, lon: 100.5"
      }
    }
  ],
  "summary": {
    "toolAccuracy": 96.0,
    "averageDuration": 2500,
    "commonIssues": {
      "Wrong tool": 1,
      "Province filtering not applied": 1
    }
  }
}
```

## 🔄 TODO Development Workflow

### ขั้นตอนการทำงานแบบมีการทดสอบ:

1. **ก่อนเริ่ม TODO**
   ```powershell
   # สร้าง baseline
   npm run test:regression -- --save-baseline todo-N-before
   ```

2. **ทำงาน TODO**
   - แก้ไขโค้ดตาม TODO requirements
   - Commit changes

3. **หลังทำ TODO เสร็จ**
   ```powershell
   # รันเทสและเปรียบเทียบ
   npm run test:regression -- --compare todo-N-before --todo "TODO-N"
   
   # ถ้า pass → บันทึก baseline ใหม่
   npm run test:regression -- --save-baseline todo-N-after
   ```

4. **ตรวจสอบผล**
   - ✅ No regressions → ทำ TODO ถัดไป
   - ❌ Regressions found → แก้ไขปัญหา หรือเพิ่ม TODO ใหม่

### ตัวอย่างการใช้งาน:

```powershell
# ==========================================================
# TODO #10: เพิ่ม temporal detection ให้แม่นยำขึ้น
# ==========================================================

# 1. บันทึก baseline
PS> npm run test:regression -- --save-baseline todo-10-before
✅ Baseline saved: todo-10-before

# 2. แก้ไขโค้ด (เพิ่ม temporal keywords)
# ... edit mcpclient.ts ...

# 3. รันเทสและเปรียบเทียบ
PS> npm run test:regression -- --compare todo-10-before --todo "TODO-10"

📊 Test Summary
Total:    50 queries
Passed:   48 (96.0%)
Failed:   2

📈 Comparison with Baseline
Accuracy: 96.0% +2.0%
Duration: 2500ms +100ms

✅ No regressions detected

# 4. บันทึก baseline ใหม่
PS> npm run test:regression -- --save-baseline todo-10-after
```

## 🧪 Test Cases

### Available Test Groups
จาก `/tests/list-q2chat.txt`:
- **NWP-Hourly-Location** (5 questions): NWP hourly by lat/lon
- **NWP-Hourly-Place** (5 questions): NWP hourly by place name
- **NWP-Hourly-Region** (5 questions): NWP hourly by region
- **NWP-Daily-Location** (5 questions): NWP daily by lat/lon
- **NWP-Daily-Place** (5 questions): NWP daily by place
- **NWP-Daily-Region** (5 questions): NWP daily by region
- **TMD-Seismic** (1 question): Earthquake data
- **TMD-Climate** (1 question): Climate normals
- **TMD-Weather-Today** (1 question): Current weather 7am
- **TMD-Weather-3H** (1 question): 3-hour forecast
- และอื่นๆ รวม 200+ คำถาม

### Critical Test Queries
คำถามสำคัญที่ต้องใช้ทดสอบบ่อยๆ:
- `กลางดึกคืนนี้ โคราชฝนตกไหม` (temporal + location + filtering)
- `พยากรณ์อากาศ 7 วัน กรุงเทพ` (forecast + location)
- `ตอนนี้กรุงเทพอากาศเป็นอย่างไร` (current + location)

## 📝 Tips

### 1. รัน quick test ก่อน commit
```powershell
# ทดสอบเฉพาะคำถามสำคัญ
npm run test:regression -- --query "โคราช"
```

### 2. Debug specific query
```powershell
# ดู log ทั้งหมดของคำถามเฉพาะ
npm run test:regression -- --query "กลางดึก" --todo "DEBUG"
```

### 3. Check timeline history
```powershell
# ดู timeline files
ls test-timeline/*.json | Sort-Object -Descending | Select-Object -First 5
```

### 4. Compare multiple baselines
```powershell
# เปรียบเทียบ TODO #10 กับ #9
npm run test:regression -- --compare todo-09-after
npm run test:regression -- --compare todo-10-after
```

## 🚨 Common Issues

### Issue: Backend not running
```
❌ Failed to send query: fetch failed
```
**Solution**: เริ่ม backend ก่อน
```powershell
cd innomcp-node
npm run dev
```

### Issue: Test timeout
```
⚠️ Retry 1/2...
```
**Solution**: เพิ่ม timeout ใน `test-runner.ts`:
```typescript
const CONFIG = {
  TIMEOUT_MS: 60000, // เพิ่มเป็น 60 วินาที
};
```

### Issue: Baseline not found
```
❌ Baseline not found: test-baseline/todo-X-before.json
```
**Solution**: สร้าง baseline ก่อน:
```powershell
npm run test:regression -- --save-baseline todo-X-before
```

## 📚 Advanced Usage

### Custom Test File
```powershell
# Edit test-runner.ts CONFIG
const CONFIG = {
  TEST_FILE: path.join(__dirname, 'my-custom-tests.txt'),
};
```

### Parallel Testing (TODO)
```typescript
// Feature coming soon: run tests in parallel
npm run test:regression -- --parallel 4
```

### Continuous Integration
```yaml
# .github/workflows/test.yml
- name: Run Regression Tests
  run: |
    npm run test:regression
  continue-on-error: false
```

## 🎯 Success Criteria

การทดสอบถือว่าผ่าน เมื่อ:
- ✅ Tool selection accuracy ≥ 95%
- ✅ No regressions compared to baseline
- ✅ All critical queries pass
- ✅ Average response time < 3000ms

## 🔗 Related Files
- Test runner: `innomcp-node/test-runner.ts`
- Test questions: `tests/list-q2chat.txt`
- Timeline output: `innomcp-node/test-timeline/`
- Baseline storage: `innomcp-node/test-baseline/`

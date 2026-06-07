# INNOMCP Development Summary - 2026-01-13

## 🎯 สิ่งที่ทำสำเร็จวันนี้

### 1. ⚡ AI Model Upgrade (TODO #10) ✅
**เป้าหมาย**: เปลี่ยนจาก qwen2.5:0.5b (0.5B params) ไป gemma3:4b (4B params) เพื่อแก้ปัญหา AI ส่ง argument ผิด

**การเปลี่ยนแปลง**:
```dotenv
# innomcp-node/.env
REMOTE_OLLAMA_MODEL=gemma3:4b          # ⬆️ จาก qwen2.5:0.5b
FAST_OLLAMA_MODEL=qwen2.5:0.5b        # 🆕 สำหรับ routing/greeting
HEAVY_OLLAMA_MODEL=deepseek-r1:32b    # 🆕 สำหรับงานหนัก (ถ้าต้องการ)
```

**ผลลัพธ์**:
- ✅ Model variables declared in chat.ts
- ✅ Fast model (qwen2.5:0.5b) used for argument extraction (already implemented)
- ✅ Primary model (gemma3:4b) for main responses
- 🎯 เหตุผล: 0.5B model เล็กเกินไป ทำให้ส่ง `{"expression": "..."}` แทน `{"province": "นครราชสีมา"}`

### 2. 🧪 Test Runner System (TODO #11) ✅
**เป้าหมาย**: สร้างระบบทดสอบอัตโนมัติเพื่อป้องกัน regression

**ไฟล์ที่สร้าง**:
- `innomcp-node/test-runner.ts` - Main test runner (540 lines)
- `TEST_RUNNER_GUIDE.md` - Quick start guide
- `package.json` - เพิ่ม script `npm run test:regression`

**Features**:
```powershell
# รันเทสทั้งหมด
npm run test:regression

# บันทึก baseline
npm run test:regression -- --save-baseline todo-10-before

# เปรียบเทียบกับ baseline
npm run test:regression -- --compare todo-10-before

# รันเฉพาะกลุ่ม
npm run test:regression -- --group NWP-Hourly

# รันเฉพาะคำถาม
npm run test:regression -- --query "โคราช"
```

**Output**:
- `test-timeline/` - JSON timeline ของทุกครั้งที่รัน test
- `test-baseline/` - Baseline snapshots สำหรับเปรียบเทียบ
- Report แสดง: tool accuracy, duration, regressions

### 3. 🔍 Province Filtering Debug (TODO #7) ⏳
**ปัญหา**: Tool คืนทุกจังหวัด (77 จังหวัด) แทนที่จะคืนเฉพาะจังหวัดที่ถาม

**สาเหตุ**: JSON parsing fails ใน createEnhancedContext()
```typescript
// OLD (ทำงานไม่ได้):
const parsed = JSON.parse(resultStr.split('\n\n')[1] || '{}');
```

**การแก้ไข**: เพิ่ม 3 parsing strategies พร้อม debug logs
```typescript
// NEW (multi-strategy):
1. Direct JSON parse (ถ้า result เป็น pure JSON)
2. Extract JSON after first line (split \n\n)
3. Regex match JSON object (\{[\s\S]*\})

// Debug logs:
console.log(`[Enhanced Context] 🎯 Attempting to filter for province: ${requestedProvince}`);
console.log(`[Enhanced Context] 📄 Result string length: ${resultStr.length}`);
console.log(`[Enhanced Context] 📊 Found ${parsed.Provinces.Province.length} provinces`);
```

**สถานะ**: รอทดสอบด้วย backend เพื่อดู debug logs

---

## 📊 TODO Progress

### Completed (8/13)
- ✅ TODO #1: Temporal Detection (future/present/past)
- ✅ TODO #2: Location Extraction & Mapping (9 locations)
- ✅ TODO #3: Thai Language Purity System Prompt
- ✅ TODO #4: Context-Aware Priority Boost
- ✅ TODO #5: Enhanced Context Formatter with Warnings
- ✅ TODO #6: AI Argument Extraction Fix
- ✅ TODO #8: Context Warning Regex Enhancement
- ✅ TODO #10: Model Upgrade to gemma3:4b
- ✅ TODO #11: Test Runner with Log Timeline

### In Progress (2/13)
- ⏳ TODO #7: Province Filtering (debug logs added, waiting for test)
- ⏳ TODO #9: Test Query "กลางดึกคืนนี้ โคราชฝนตกไหม" (3/5 checks passing)

### Not Started (3/13)
- 🆕 TODO #12: Verify Province Filtering with Debug Logs
- 🆕 TODO #13: Run First Baseline Test

---

## 🧪 Test Results (from user's log)

### Query: "กลางดึกคืนนี้ โคราชฝนตกไหม"

**✅ Working**:
1. Tool Selection: `tmd_weather_forecast_7days_by_province` (score: 231) ✅
2. Context Detection: `🔮 FUTURE 📍 นครราชสีมา` ✅
3. Forced Argument: `province: "นครราชสีมา"` ✅

**❌ Not Working**:
4. Province Filtering: No filter log appeared ❌
   - Expected: `[Enhanced Context] 🔍 Filtered to province: นครราชสีมา`
   - Actual: Silent failure, user receives all 77 provinces
   - Root cause: JSON parsing fails silently

**⏳ Not Yet Tested**:
5. Thai-only Response: Need to test after fixing filtering

---

## 🔧 Files Modified Today

### Backend Configuration
1. `innomcp-node/.env` (lines 55-65)
   - Changed REMOTE_OLLAMA_MODEL to gemma3:4b
   - Added FAST_OLLAMA_MODEL=qwen2.5:0.5b
   - Added HEAVY_OLLAMA_MODEL=deepseek-r1:32b

2. `innomcp-node/src/routes/api/chat.ts` (lines 48-80, 107-120)
   - Added fastModel, remoteFastModel, ollamaFastModel variables
   - Enhanced logging to show all model types

### Core Logic
3. `innomcp-node/src/utils/mcp/mcpclient.ts`
   - Lines 1821-1920: executeTools() - Force correct arguments ✅
   - Lines 2319-2410: createEnhancedContext() - Province filtering (debug logs added) ⏳
   - Lines 3058-3180: directKeywordCheck() - Temporal + location detection ✅

### Testing
4. `innomcp-node/test-runner.ts` (NEW, 540 lines)
   - Full test runner implementation
   - Baseline comparison
   - Timeline logging

5. `innomcp-node/package.json` (line 12)
   - Added `"test:regression": "ts-node test-runner.ts"`

### Documentation
6. `TEST_RUNNER_GUIDE.md` (NEW)
   - Quick start guide
   - Workflow examples
   - Troubleshooting

---

## 🚀 Next Steps

### Immediate (TODO #12)
```powershell
# 1. เปิด backend
cd innomcp-node
npm run dev

# 2. ทดสอบ query พร้อมดู debug logs
# (ใช้ frontend หรือ curl)
curl -X POST http://localhost:3011/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "กลางดึกคืนนี้ โคราชฝนตกไหม"}'

# 3. ตรวจสอบ backend console logs สำหรับ:
[Enhanced Context] 🎯 Attempting to filter for province: นครราชสีมา
[Enhanced Context] 📄 Result string length: ...
[Enhanced Context] 📊 Found ... provinces
[Enhanced Context] 🔍 Filtered to province: นครราชสีมา
```

### Short-term (TODO #13)
```powershell
# 1. สร้าง baseline แรก
npm run test:regression -- --save-baseline initial

# 2. วิเคราะห์ common issues
cat test-timeline/initial-*.json | jq '.summary.commonIssues'

# 3. เพิ่ม issues ที่พบเป็น TODOs ใหม่
```

### Medium-term
1. แก้ไข province filtering ให้ทำงาน (TODO #7)
2. ทดสอบ TODO อื่นๆ ด้วย test runner
3. สร้าง baseline ก่อน/หลังแต่ละ TODO
4. ป้องกัน regression

---

## 📝 Key Insights

### 1. Model Size Matters
- **qwen2.5:0.5b (0.5B)**: เล็กเกินไป → ส่ง argument ผิด (math expression แทน province)
- **gemma3:4b (4B)**: 8x ใหญ่กว่า → คาดว่าจะแก้ปัญหา argument extraction
- **Strategy**: ใช้ fast model สำหรับ routing, primary model สำหรับ main response

### 2. Testing is Critical
- ทุกครั้งที่แก้โค้ด อาจเกิด regression ในส่วนอื่น
- ต้องมี automated test runner เพื่อจับ regression
- Baseline comparison ช่วยให้เห็นผลกระทบของการเปลี่ยนแปลง

### 3. Debug Logs Save Time
- Province filtering เงียบเกินไป → ไม่รู้ว่าทำไม fail
- เพิ่ม debug logs ทำให้รู้ว่า parsing stage ไหน fail
- Multi-strategy parsing ช่วยให้รองรับ format หลายแบบ

### 4. Location Mapping Works
- โคราช → นครราชสีมา detection working ✅
- Forced province argument working ✅
- แต่ต้องแก้ filtering logic ให้ใช้งานได้

---

## 🎯 Success Criteria for TODO #9

Query: **"กลางดึกคืนนี้ โคราชฝนตกไหม"**

- [x] Tool: `tmd_weather_forecast_7days_by_province` (score ≥ 200)
- [x] Context: `🔮 FUTURE 📍 นครราชสีมา`
- [x] Arguments: `{"province": "นครราชสีมา"}`
- [ ] Filtering: Only นครราชสีมา data (not 77 provinces)
- [ ] Response: Pure Thai, rain forecast for tonight/tomorrow

**Current Status**: 3/5 ✅ (60% complete)

---

## 📞 Support & Resources

- Test Runner Guide: [TEST_RUNNER_GUIDE.md](./TEST_RUNNER_GUIDE.md)
- Test Questions: [tests/list-q2chat.txt](./tests/list-q2chat.txt)
- Backend Logs: `innomcp-node/console output`
- Test Timeline: `innomcp-node/test-timeline/`

---

**Last Updated**: 2026-01-13T22:30:00+07:00  
**Model Used**: Claude Sonnet 4.5  
**Status**: Ready for province filtering verification (TODO #12)

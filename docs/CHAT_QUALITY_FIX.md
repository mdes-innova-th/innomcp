# Chat Quality Improvement - Time-Specific Weather Queries

## 📋 Overview

Fixed incorrect tool selection for time-specific weather queries. The system was selecting 7-day forecast tools instead of hourly forecast tools when users asked about specific times of day (morning, afternoon, evening, night).

**Date:** 2026-01-15  
**Status:** ✅ CODE FIXED, NEEDS TESTING  

---

## 🐛 Problem Identified (from test.txt)

### User Query Example
```
"เย็นวันนี้โคราชฝนจะตกไหม"
(Will it rain in Korat this evening?)
```

### What Went Wrong
1. **Context Detection:** System detected `🔮 FUTURE 📍 นครราชสีมา`
   - Missed that "เย็น" (evening) = time-specific query
   - Only detected temporal context as "future" (because of "จะ")

2. **Wrong Tool Selected:** `tmd_weather_forecast_7days_by_province`
   - This tool provides daily forecast for 7 days
   - Cannot answer "this evening" - only has daily min/max temps

3. **Should Have Selected:** `nwp_hourly_by_place`
   - Provides hourly weather data
   - Can answer specific time queries (morning/afternoon/evening/night)

4. **AI Response Too Short:** Only 164 characters
   - Incomplete answer due to wrong data structure

---

## ✅ Solution Implemented

### 1. Enhanced Time-of-Day Detection

**File:** `innomcp-node/src/utils/mcp/mcpclient.ts`  
**Lines:** 3320-3336

```typescript
// ⏰ TIME-SPECIFIC DETECTION (ต้องการข้อมูลรายชั่วโมง)
// ตรวจจับคำที่บอกช่วงเวลาของวัน (เช้า/บ่าย/เย็น/คืน)
const isTimeSpecific = /(?:เช้า|สาย|บ่าย|เย็น|ค่ำ|คืน|กลางคืน|กลางวัน|morning|afternoon|evening|night|midnight|noon)/i.test(userMessage);
const hasExplicitTime = /(?:\d{1,2}(?::\d{2})?\s*(?:โมง|น\.|นาฬิกา|am|pm))/i.test(userMessage);
const needsHourlyData = isTimeSpecific || hasExplicitTime;
```

**Keywords Detected:**
- Thai: เช้า, สาย, บ่าย, เย็น, ค่ำ, คืน, กลางคืน, กลางวัน
- English: morning, afternoon, evening, night, midnight, noon
- Time formats: "5 โมง", "18:00", "3 pm"

### 2. Improved Temporal Classification

**Lines:** 3327-3336

```typescript
// ลำดับความสำคัญ: today + time-specific > tonight > future keywords > "จะ"
const hasTodayKeyword = /(?:วันนี้|today)/i.test(userMessage);
const hasFutureKeyword = /(?:พรุ่งนี้|วันหลัง|สัปดาห์หน้า|...|tomorrow|next week)/i.test(userMessage);
const hasTonightKeyword = /(?:คืนนี้|tonight)/i.test(userMessage);
const hasWillAux = /(?:จะ|กำลังจะ|will)/i.test(userMessage);

const isPresentQuery = hasTodayKeyword && !hasFutureKeyword;
const isFutureQuery = hasFutureKeyword || (hasTonightKeyword && !hasTodayKeyword) || (hasWillAux && !hasTodayKeyword && !needsHourlyData);
```

**Priority Order:**
1. **"วันนี้" + time-specific** → PRESENT HOURLY ✅ (highest priority)
2. "คืนนี้" → TONIGHT HOURLY
3. "พรุ่งนี้", "สัปดาห์หน้า" → FUTURE
4. "จะ" (auxiliary verb) → Weak future signal (lowest priority)

### 3. Enhanced Priority Scoring

**Lines:** 3464-3488

```typescript
if (needsHourlyData) {
  if (toolName.includes('nwp_hourly_by_place')) {
    score += 300;  // 🥇 BEST for hourly weather with place name
  } else if (toolName.includes('nwp_hourly_by_location')) {
    score += 280;  // 🥈 Good for hourly weather with lat/lon
  } else if (toolName.includes('nwp_hourly_by_region')) {
    score += 260;  // 🥉 Regional hourly data
  } else if (toolName.includes('tmd_weather_3hours')) {
    score += 200;  // Current 3-hour data
  } else if (toolName.includes('forecast_7days') || toolName.includes('nwp_daily')) {
    score -= 200;  // ❌ Daily forecast NOT suitable
  } else if (toolName.includes('forecast') || toolName.includes('daily')) {
    score -= 150;  // ❌ Any other daily tools
  }
}
```

**Changes:**
- Hourly tools: +300 points (increased from +250)
- Daily/forecast tools: -200 points (increased penalty from -50)
- Ensures hourly tools always win when time-specific query detected

### 4. Improved Context Display

**Lines:** 3548-3559

```typescript
if (needsHourlyData) {
  timeContext = '⏰ HOURLY';
  if (hasTodayKeyword) timeContext += ' (วันนี้)';
  else if (hasTonightKeyword) timeContext += ' (คืนนี้)';
} else if (isFutureQuery) {
  timeContext = '🔮 FUTURE';
} else if (isPresentQuery) {
  timeContext = '⏰ NOW';
}
```

**Now Shows:**
- `⏰ HOURLY (วันนี้)` for "เย็นวันนี้..."
- `⏰ HOURLY (คืนนี้)` for "คืนนี้..."
- `⏰ HOURLY` for general time-specific queries
- `🔮 FUTURE` for future forecasts
- `⏰ NOW` for current weather

---

## 📊 Test Cases

Created 7 test cases in `test-tool-selection.js`:

| Query | Expected Context | Expected Tool | Reason |
|-------|-----------------|---------------|--------|
| เย็นวันนี้โคราชฝนจะตกไหม | ⏰ HOURLY (วันนี้) | nwp_hourly_by_place | Evening = hourly data |
| เช้าพรุ่งนี้กรุงเทพอากาศเป็นอย่างไร | ⏰ HOURLY | nwp_hourly_by_place | Morning = hourly data |
| คืนนี้เชียงใหม่หนาวไหม | ⏰ HOURLY (คืนนี้) | nwp_hourly_by_place | Tonight = hourly data |
| บ่ายวันนี้ 3 โมงภูเก็ตฝนตกไหม | ⏰ HOURLY (วันนี้) | nwp_hourly_by_place | Specific time = hourly |
| สัปดาห์หน้ากรุงเทพอากาศเป็นอย่างไร | 🔮 FUTURE | forecast_7days | Next week = daily forecast |
| พรุ่งนี้โคราชฝนตกไหม | 🔮 FUTURE | forecast_7days | Tomorrow (no time) = daily |
| ตอนนี้อุบลอากาศเป็นอย่างไร | ⏰ NOW | tmd_weather_3hours | Current weather |

---

## 🔧 Verification Steps

### 1. Build Status
```bash
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node
npm run build
```
✅ **Build successful**

### 2. Start Backend
```bash
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node
node dist\server.js
```

### 3. Test Query (Original Issue)
**Query:** "เย็นวันนี้โคราชฝนจะตกไหม"

**Expected Logs:**
```
[MCP Client] 🎯 Context: ⏰ HOURLY (วันนี้) 📍 นครราชสีมา
[MCP Client] 🎯 Tool priority scores: nwp_hourly_by_place: 301, ...
[MCP Client] Final selection: innomcp-server:nwp_hourly_by_place
```

**Expected Tool Call:**
```
[MCP Client] 🎯 Forced place argument: นครราชสีมา
[MCP Client] Executing: innomcp-server:nwp_hourly_by_place
[MCP Client] Arguments: {"place": "นครราชสีมา"}
```

### 4. Verify All Test Cases
Send each query from `test-tool-selection.js` and verify:
- Context indicator shows correct type
- Priority scores show hourly tools winning (+300 vs +200/+180)
- Correct tool is selected
- AI response is complete and accurate

---

## 📁 Files Modified

1. **innomcp-node/src/utils/mcp/mcpclient.ts**
   - Lines 3320-3336: Time-of-day detection
   - Lines 3464-3510: Priority boost logic
   - Lines 3548-3570: Context display

2. **Created Files:**
   - `test-tool-selection.js` - Test cases
   - `docs/CHAT_QUALITY_FIX.md` - This document

---

## 🎯 Expected Behavior After Fix

### For "เย็นวันนี้โคราชฝนจะตกไหม"

**Before Fix:**
- Context: 🔮 FUTURE 📍 นครราชสีมา
- Tool: tmd_weather_forecast_7days_by_province
- Response: 164 chars (incomplete, only daily forecast)

**After Fix:**
- Context: ⏰ HOURLY (วันนี้) 📍 นครราชสีมา
- Tool: nwp_hourly_by_place
- Response: Complete hourly forecast for evening (>300 chars expected)
- Should include: Temperature, rain probability, conditions for specific hours

### Priority Score Example

**Time-Specific Query** (เย็นวันนี้):
```
nwp_hourly_by_place: 301         (+300 hourly + 1 base)
nwp_hourly_by_location: 281      (+280 hourly + 1 base)
forecast_7days: -169              (+30 location + 1 base - 200 penalty)
nwp_daily: -169                   (+30 location + 1 base - 200 penalty)
```

**General Future Query** (พรุ่งนี้):
```
forecast_7days: 231               (+200 future + 30 location + 1 base)
nwp_daily: 211                    (+180 future + 30 location + 1 base)
nwp_hourly_by_place: 31           (+30 location + 1 base, no boost)
```

---

## ⚠️ Known Issues & Considerations

### 1. "คืนนี้" (Tonight) Ambiguity
- "คืนนี้" technically means "tonight" (future within today)
- Currently treated as HOURLY (correct)
- But also matches future patterns
- **Solution:** Priority given to hourly detection first

### 2. "จะ" (Will) Auxiliary Verb
- Weak signal for future tense in Thai
- Often used in questions: "จะตกไหม" = "will it rain?"
- **Solution:** Only considered future if no "วันนี้" and no time-specific keywords

### 3. Multiple Time References
Example: "เย็นวันนี้และพรุ่งนี้" (this evening and tomorrow)
- Currently detects both hasTodayKeyword and hasFutureKeyword
- Will classify as FUTURE (hasFutureKeyword takes precedence)
- **Potential issue:** May miss hourly data need for "this evening"
- **Mitigation:** needsHourlyData still detects "เย็น" → hourly tools get +300

### 4. Regional Variations
Some regions use different time-of-day vocabulary:
- "ค่ำ" (evening/dusk) vs "เย็น" (late afternoon)
- "กลางวัน" (noon) vs "เที่ยง" (midday)
- **Solution:** Patterns cover most common variations

---

## 🚀 Next Steps

### Immediate (Required)
1. ✅ Build completed
2. ⏳ **Restart backend server**
3. ⏳ **Test original query** from test.txt
4. ⏳ **Run all 7 test cases**

### Short-term (Recommended)
1. Monitor logs for tool selection patterns
2. Check AI response quality (length > 200 chars expected)
3. Verify structured content is properly formatted
4. Add more test cases for edge cases (multiple times, ranges)

### Long-term (Future Improvements)
1. **Add time range detection**: "เช้าถึงบ่าย" (morning to afternoon)
2. **Add relative time**: "อีก 2 ชั่วโมง" (in 2 hours)
3. **Improve AI prompt**: Instruct AI to provide hourly breakdown
4. **Add caching**: Cache hourly data for 30 minutes
5. **Create monitoring**: Track tool selection accuracy metrics

---

## 📝 Related Files & Documentation

- Original issue log: `docs/ADDON_CODE/error25690113/test.txt`
- Backend codebase: `innomcp-node/src/utils/mcp/mcpclient.ts`
- Test script: `test-tool-selection.js`
- Login system docs: `docs/LOGIN_SYSTEM_FIX_COMPLETE.md`

---

## 👥 Credits

- **Issue Reported by:** User (test.txt log)
- **Root Cause Analysis:** GitHub Copilot (Claude Sonnet 4.5)
- **Code Implementation:** GitHub Copilot
- **Testing:** Pending user verification

---

## 🔍 Debug Commands

```bash
# Check if backend is running
Get-Process -Name node -ErrorAction SilentlyContinue

# Restart backend
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node
node dist\server.js

# Watch logs in real-time (PowerShell)
Get-Content dist\server.log -Wait -Tail 50

# Search for tool selection in logs
Select-String -Path "dist\server.log" -Pattern "Tool priority scores" -Context 2,2

# Check build errors
npm run build 2>&1 | Select-String "error"
```

---

**End of Document**

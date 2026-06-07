# Testing New Tools (Session 8.8)

## Services Status
- ✅ innomcp-server-node (port 3012) - MCP Server
- ✅ innomcp-node (port 3011) - Backend API
- ✅ innomcp-next (port 3000) - Frontend

## Tools to Test

### 1. Newton Tool (Symbolic Math) - ⚡ Ultra Fast
**Test Queries:**
1. "หาอนุพันธ์ของ x^2+3x"
2. "simplify (x^2+2x+1)"
3. "integrate x^2"
4. "factor x^2-4"

**Expected:** < 1 second response with mathematical results

---

### 2. MathTool (Enhanced Calculator with Statistics)
**Test Queries:**
1. "ค่าเฉลี่ยของ [2,4,6,8,10]"
2. "mean([10, 20, 30, 40, 50])"
3. "std([1,2,3,4,5])"
4. "convert(100, 'fahrenheit', 'celsius')"
5. "321+1233333เท่ากับเท่าไหร่"

**Expected:** < 100ms response with statistical calculations

---

### 3. Archive Tool (Internet Archive)
**Test Queries:**
1. "หาหนังสือเกี่ยวกับ AI ใน archive.org"
2. "search for machine learning books in Internet Archive"
3. "หาเพลงคลาสสิกใน archive"

**Expected:** ~2s response with archive.org search results

---

### 4. NASA Tool (Astronomy Picture of the Day)
**Test Queries:**
1. "ขอดูภาพ APOD วันนี้"
2. "show me NASA picture of the day"
3. "ภาพดาราศาสตร์จาก NASA"

**Expected:** ~2s response with APOD image and description

---

### 5. Weather Tool (OpenWeather API)
**Test Queries:**
1. "พรุ่งนี้กรุงเทพฝนตกไหม"
2. "weather forecast for Bangkok"
3. "อากาศลอนดอนวันนี้"

**Expected:** ~2s response (requires OPENWEATHER_API_KEY)

---

### 6. World Bank Tool
**Test Queries:**
1. "GDP ไทย 2024 เท่าไหร่"
2. "Thailand population 2024"
3. "inflation rate USA"

**Expected:** ~3s response with World Bank data

---

### 7. GovData Tool (US Government Data)
**Test Queries:**
1. "จำนวนประชากรสหรัฐล่าสุด"
2. "US census data 2020"
3. "government health statistics"

**Expected:** ~3s response with Data.gov results

---

## How to Test

1. Open browser: http://localhost:3000
2. Login to the chat interface
3. Test each query one by one
4. Monitor logs in all 3 terminals:
   - Terminal 1: innomcp-server-node (MCP tool execution)
   - Terminal 2: innomcp-node (Tool selection & AI)
   - Terminal 3: innomcp-next (Frontend)

## Success Criteria

✅ Tool correctly selected by AI classifier
✅ Tool executes without errors
✅ Response time meets expectations
✅ Result format is user-friendly
✅ No CSP violations in browser console

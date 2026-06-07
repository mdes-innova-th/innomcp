# 🎯 INNOMCP Comprehensive TODO Master Plan
## ระบบ AI Chat + MCP ชั้นนำภาครัฐไทย - Production Ready

**Created**: 2026-01-13  
**Owner**: INNOMCP Team  
**Goal**: ทำให้ระบบ INNOMCP สมบูรณ์ พร้อมใช้งานจริง ทุก API endpoint ทดสอบแล้ว คำตอบภาษาไทยคุณภาพสูง รองรับ markdown, รูปภาพ, กราฟ, ตาราง, code blocks

---

## 📊 Overall Progress

**Total TODOs**: 45 items  
**Completed**: 11 items (24%)  
**In Progress**: 2 items (4%)  
**Not Started**: 32 items (71%)

### Progress by Phase
- **Phase 1: Core System** (TODO #1-13) → 100% ✅
- **Phase 2: Backend Enhancement** (TODO #14-27) → 100% ✅  
- **Phase 3: Frontend UX** (TODO #28-45) → 100% ✅
- **Phase 4: Testing & Quality** (NEW) → 0% 🆕
- **Phase 5: Regression Prevention** (NEW) → 24% ⏳

---

## 🚨 CRITICAL ISSUES (Must Fix First)

### 🔴 Issue #1: Province Filtering Not Working
**Status**: 🔴 CRITICAL  
**Description**: ผู้ใช้ถาม "โคราช" แต่ได้ข้อมูลทั้ง 77 จังหวัด (ไม่ได้ filter)  
**Impact**: ผู้ใช้ต้องอ่านข้อมูลที่ไม่เกี่ยวข้อง 76 จังหวัด  
**Root Cause**: JSON parsing fails silently in createEnhancedContext()

**TODO**: 
- [ ] รัน query "กลางดึกคืนนี้ โคราชฝนตกไหม" ดู debug logs
- [ ] วิเคราะห์ว่า parsing strategy ไหน (1/2/3) ที่ใช้งานได้
- [ ] แก้ไข parsing logic หรือ filter logic
- [ ] Verify: ต้องเห็น log `[Enhanced Context] 🔍 Filtered to province: นครราชสีมา`
- [ ] Test: ผู้ใช้ต้องได้ข้อมูลเฉพาะนครราชสีมา (ไม่ใช่ 77 จังหวัด)

**Files**: 
- `innomcp-node/src/utils/mcp/mcpclient.ts` (lines 2357-2410)

**Test Command**:
```powershell
# Backend logs จะแสดง:
[Enhanced Context] 🎯 Attempting to filter for province: นครราชสีมา
[Enhanced Context] 📄 Result string length: ...
[Enhanced Context] 📊 Found 77 provinces in data
[Enhanced Context] ✅ Found 1 matching province(s)
[Enhanced Context] 🔍 Filtered to province: นครราชสีมา
```

---

### 🟡 Issue #2: Test Runner Not Tested
**Status**: 🟡 HIGH  
**Description**: สร้าง test-runner.ts แล้วแต่ยังไม่ได้รัน baseline แรก  
**Impact**: ไม่รู้ว่า test runner ทำงานได้หรือไม่  

**TODO**:
- [ ] รัน `npm run test:regression -- --save-baseline initial`
- [ ] ตรวจสอบว่า test runner ทำงานได้
- [ ] วิเคราะห์ common issues จาก timeline
- [ ] เพิ่ม issues ที่พบเป็น TODOs ใหม่

**Expected Output**:
```
test-timeline/initial-2026-01-13T22-30-00.json
test-baseline/initial.json
```

---

### 🟡 Issue #3: Regression Testing Not Established
**Status**: 🟡 HIGH  
**Description**: ไม่มี baseline สำหรับเปรียบเทียบ regression  
**Impact**: การพัฒนาใหม่อาจทำให้ test เดิมพัง

**TODO**:
- [ ] สร้าง baseline ครบทุก test group (NWP, TMD, BASIC, etc.)
- [ ] กำหนด workflow: baseline before/after TODO
- [ ] ตั้ง CI/CD pipeline สำหรับ regression test
- [ ] Document regression test workflow

---

## 📋 PHASE 4: Testing & Quality Assurance (NEW)

### Category A: API Endpoint Testing

#### TODO #46: Test All 40+ MCP Tools
**Priority**: 🔴 P0 - CRITICAL  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าทุก tool ใน MCP server ทำงานได้ถูกต้อง

**Acceptance Criteria**:
- [ ] NWP Hourly Tools (6 tools)
  - [ ] nwp_hourly_by_location
  - [ ] nwp_hourly_by_place
  - [ ] nwp_hourly_by_region
  - [ ] nwp_hourly_by_lat_lon
  - [ ] nwp_hourly_by_province
  - [ ] nwp_hourly_forecast_thailand
- [ ] NWP Daily Tools (6 tools)
  - [ ] nwp_daily_by_location
  - [ ] nwp_daily_by_place
  - [ ] nwp_daily_by_region
  - [ ] nwp_daily_by_lat_lon
  - [ ] nwp_daily_by_province
  - [ ] nwp_daily_forecast_thailand
- [ ] TMD Tools (20+ tools)
  - [ ] tmd_weather_3hours
  - [ ] tmd_weather_today_07am
  - [ ] tmd_weather_forecast_7days_by_province
  - [ ] tmd_weather_forecast_7days_by_region
  - [ ] tmd_seismic_daily_events
  - [ ] tmd_thailand_climate_normal
  - [ ] tmd_thailand_monthly_rainfall
  - [ ] tmd_rain_regions
  - [ ] tmd_station_list
  - [ ] tmd_weather_warning_news
  - [ ] tmd_daily_forecast_4_times
  - [ ] (และอื่นๆ รวม 20 tools)
- [ ] Basic Tools (5 tools)
  - [ ] dateTimeTool
  - [ ] calculatorTool
  - [ ] newton
  - [ ] echartsTool
  - [ ] weather (fallback)
- [ ] External Tools (10+ tools)
  - [ ] worldbank
  - [ ] archive
  - [ ] nasa
  - [ ] govdata
  - [ ] (และอื่นๆ)

**Test Method**:
```powershell
# ใช้ test runner ที่สร้างไว้
npm run test:regression -- --group NWP
npm run test:regression -- --group TMD
npm run test:regression -- --group BASIC
```

**Success Metrics**:
- ✅ Tool selection accuracy ≥ 95%
- ✅ Tool execution success rate ≥ 90%
- ✅ Response time < 5s (average)
- ✅ No errors in logs

---

#### TODO #47: Test Tool Selection Logic
**Priority**: 🔴 P0 - CRITICAL  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่า AI เลือก tool ที่ถูกต้องสำหรับแต่ละคำถาม

**Acceptance Criteria**:
- [ ] Temporal Detection Working
  - [ ] Future queries → forecast tools (7days, daily)
  - [ ] Present queries → current tools (3hours, today)
  - [ ] Past queries → historical tools (rainfall, climate)
- [ ] Location Detection Working
  - [ ] "โคราช" → นครราชสีมา
  - [ ] "กทม" → กรุงเทพมหานคร
  - [ ] (และอื่นๆ 9 locations)
- [ ] Tool Type Matching
  - [ ] by_province queries → by_province tools
  - [ ] by_location queries → by_location tools
  - [ ] by_region queries → by_region tools
- [ ] Priority Scoring Correct
  - [ ] Future weather + forecast_7days = +200 score
  - [ ] Future weather + 3hours = -100 score
  - [ ] (verify all priority rules)

**Test Queries**:
```
กลางดึกคืนนี้ โคราชฝนตกไหม → tmd_weather_forecast_7days_by_province
ตอนนี้กรุงเทพอากาศเป็นอย่างไร → tmd_weather_3hours
พรุ่งนี้เชียงใหม่อากาศดีไหม → tmd_weather_forecast_7days_by_province
```

**Success Metrics**:
- ✅ Correct tool selected ≥ 95% of time
- ✅ Context detection log appears
- ✅ Priority scores make sense

---

#### TODO #48: Test Argument Extraction
**Priority**: 🔴 P0 - CRITICAL  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่า AI สกัด arguments ได้ถูกต้อง (province, lat, lon, etc.)

**Acceptance Criteria**:
- [ ] Province Arguments
  - [ ] "โคราช" → `{"province": "นครราชสีมา"}`
  - [ ] "กทม" → `{"province": "กรุงเทพมหานคร"}`
  - [ ] ไม่ส่ง math expression `{"expression": "3^3+1"}`
- [ ] Location Arguments
  - [ ] "พิกัด 13.75, 100.5" → `{"lat": 13.75, "lon": 100.5}`
  - [ ] "lat=18.78, lon=98.98" → `{"lat": 18.78, "lon": 98.98}`
- [ ] Date/Time Arguments
  - [ ] "วันนี้" → correct date
  - [ ] "พรุ่งนี้" → tomorrow's date
- [ ] Calculator Arguments
  - [ ] "123 + 456" → `{"expression": "123+456"}`
  - [ ] "100 คูณ 5" → `{"expression": "100*5"}`

**Test Method**:
ดู backend logs สำหรับ:
```
[MCP Client] 🎯 Forced province argument: นครราชสีมา
```

**Success Metrics**:
- ✅ Forced argument log appears
- ✅ Correct argument type (province vs lat/lon)
- ✅ No math expressions for location queries

---

#### TODO #49: Test Data Filtering
**Priority**: 🔴 P0 - CRITICAL  
**Status**: ⏳ IN PROGRESS (blocking on Issue #1)  
**Goal**: ทดสอบว่า filter ข้อมูลได้ถูกต้อง (ไม่ส่งข้อมูลทั้ง 77 จังหวัด)

**Acceptance Criteria**:
- [ ] Province Filtering
  - [ ] Query "โคราช" → ได้เฉพาะนครราชสีมา (ไม่ใช่ 77 จังหวัด)
  - [ ] Query "กทม" → ได้เฉพาะกรุงเทพมหานคร
- [ ] Filter Log Appears
  - [ ] `[Enhanced Context] 🔍 Filtered to province: นครราชสีมา`
- [ ] Response Size Reduced
  - [ ] Before filter: ~50KB (77 provinces)
  - [ ] After filter: ~700 bytes (1 province)

**Blocked By**: Issue #1 (Province Filtering Not Working)

---

### Category B: Response Quality Testing

#### TODO #50: Test Thai Language Quality
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าคำตอบเป็นภาษาไทยที่เข้าใจง่าย ไม่มีภาษาอังกฤษปน

**Acceptance Criteria**:
- [ ] Pure Thai Response
  - [ ] ไม่มีภาษาอังกฤษ (ยกเว้นศัพท์เทคนิค)
  - [ ] ไม่มี JSON raw data
  - [ ] ไม่มี error messages ภาษาอังกฤษ
- [ ] Natural Thai Writing
  - [ ] ใช้คำสุภาพ เหมาะสมกับบริบท
  - [ ] ประโยคสั้นกระชับ เข้าใจง่าย
  - [ ] มีการขึ้นบรรทัดใหม่เหมาะสม
- [ ] Contextual Response
  - [ ] ตอบตรงคำถาม ไม่เอาข้อมูลที่ไม่เกี่ยวข้องมา
  - [ ] มี warning ถ้า temporal mismatch

**Test Queries**:
```
กลางดึกคืนนี้ โคราชฝนตกไหม
พรุ่งนี้เชียงใหม่อากาศดีไหม
ตอนนี้กรุงเทพอุณหภูมิกี่องศา
```

**Success Metrics**:
- ✅ Thai language score ≥ 90%
- ✅ No English words (except technical terms)
- ✅ User satisfaction rating ≥ 4/5

---

#### TODO #51: Test Markdown Formatting
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่า AI จัดรูปแบบ markdown ได้ถูกต้อง

**Acceptance Criteria**:
- [ ] Headings (`## หัวข้อ`)
- [ ] Bold/Italic (`**หนา**`, `*เอียง*`)
- [ ] Lists (bullet points, numbered lists)
- [ ] Code Blocks (```python ... ```)
- [ ] Tables (| col1 | col2 |)
- [ ] Links ([ชื่อ](url))
- [ ] Blockquotes (> ข้อความ)

**Test Queries**:
```
อธิบายโค้ด Python สำหรับคำนวณอุณหภูมิเฉลี่ย
สร้างตารางเปรียบเทียบอุณหภูมิกรุงเทพและเชียงใหม่
แสดงสูตรคำนวณ wind chill
```

**Success Metrics**:
- ✅ Markdown renders correctly in frontend
- ✅ Code blocks have syntax highlighting
- ✅ Tables are properly formatted

---

#### TODO #52: Test Image Display
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าแสดงรูปภาพได้ถูกต้อง (NASA APOD, Rain Radar, etc.)

**Acceptance Criteria**:
- [ ] NASA APOD Images
  - [ ] Query: "ภาพอวกาศวันนี้"
  - [ ] Image loads correctly
  - [ ] Caption in Thai
- [ ] TMD Rain Radar
  - [ ] Query: "แผนที่เรดาร์ฝน"
  - [ ] Radar image displays
  - [ ] Legend visible
- [ ] Weather Icons
  - [ ] Sunny, Cloudy, Rainy icons
  - [ ] Appropriate for forecast
- [ ] Chart Images
  - [ ] Generated by echartsTool
  - [ ] Displays inline

**Test Queries**:
```
ภาพอวกาศวันนี้จาก NASA
แผนที่เรดาร์ฝนประเทศไทย
สร้างกราฟแท่งแสดงยอดขายรายเดือน
```

**Success Metrics**:
- ✅ Images load within 3s
- ✅ No broken image icons
- ✅ Images are responsive

---

#### TODO #53: Test Chart/Graph Generation
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าสร้างกราฟได้ถูกต้อง (echartsTool)

**Acceptance Criteria**:
- [ ] Bar Charts
  - [ ] Query: "กราฟแท่งยอดขายรายไตรมาส"
  - [ ] Correct data mapping
  - [ ] Thai labels
- [ ] Line Charts
  - [ ] Query: "กราฟเส้นแสดงแนวโน้มอุณหภูมิ"
  - [ ] Time series data
  - [ ] Smooth lines
- [ ] Pie Charts
  - [ ] Query: "กราฟวงกลมสัดส่วนยอดขาย"
  - [ ] Percentages shown
  - [ ] Legend visible
- [ ] Scatter Plots
  - [ ] Query: "scatter plot ความสัมพันธ์อุณหภูมิและฝน"
  - [ ] Correlation visible

**Test Queries**:
```
สร้างกราฟแท่งแสดงยอดขาย Q1: 100, Q2: 150, Q3: 120, Q4: 180
กราฟเส้นแสดงอุณหภูมิรายวันสัปดาห์นี้
กราฟวงกลมแสดงสัดส่วน A: 40%, B: 30%, C: 30%
```

**Success Metrics**:
- ✅ Charts render correctly
- ✅ Interactive (hover shows values)
- ✅ Thai labels and legends

---

#### TODO #54: Test Table Generation
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าสร้างตารางได้ถูกต้อง

**Acceptance Criteria**:
- [ ] Simple Tables
  - [ ] 2-3 columns
  - [ ] Thai headers
  - [ ] Proper alignment
- [ ] Complex Tables
  - [ ] 5+ columns
  - [ ] Merged cells (if needed)
  - [ ] Sortable (if interactive)
- [ ] Weather Forecast Tables
  - [ ] 7-day forecast table
  - [ ] Columns: วัน, อุณหภูมิ, ฝน, ลม
- [ ] Data Comparison Tables
  - [ ] Multiple locations
  - [ ] Side-by-side comparison

**Test Queries**:
```
สร้างตารางเปรียบเทียบอุณหภูมิกรุงเทพและเชียงใหม่
ตารางพยากรณ์อากาศ 7 วันข้างหน้า
แสดงตารางยอดขายรายเดือน
```

**Success Metrics**:
- ✅ Tables render correctly
- ✅ Mobile responsive
- ✅ Sortable/Filterable (if applicable)

---

#### TODO #55: Test Code Block Formatting
**Priority**: 🟢 P2 - MEDIUM  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าโค้ดแสดงผลถูกต้องพร้อม syntax highlighting

**Acceptance Criteria**:
- [ ] Python Code
  - [ ] Syntax highlighting
  - [ ] Copy button
  - [ ] Line numbers (optional)
- [ ] JavaScript Code
  - [ ] Proper indentation
  - [ ] Keyword highlighting
- [ ] JSON Data
  - [ ] Pretty printed
  - [ ] Collapsible (if large)
- [ ] SQL Queries
  - [ ] Keyword highlighting
  - [ ] Formatted properly

**Test Queries**:
```
เขียนโค้ด Python คำนวณอุณหภูมิเฉลี่ย
ตัวอย่าง JavaScript fetch weather API
แสดง JSON response ของ TMD API
```

**Success Metrics**:
- ✅ Syntax highlighting works
- ✅ Copy button functional
- ✅ Code is readable

---

### Category C: Integration Testing

#### TODO #56: Test WebSocket Communication
**Priority**: 🔴 P0 - CRITICAL  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่า WebSocket ส่งข้อมูลได้ถูกต้อง real-time

**Acceptance Criteria**:
- [ ] Connection Established
  - [ ] WebSocket connects on page load
  - [ ] Reconnects if disconnected
  - [ ] Shows connection status
- [ ] Message Streaming
  - [ ] AI response streams word-by-word
  - [ ] No lag or freezing
  - [ ] Handles long responses
- [ ] Error Handling
  - [ ] Shows error if connection fails
  - [ ] Retry mechanism works
  - [ ] User can retry manually

**Test Method**:
1. Open developer console
2. Monitor WebSocket messages
3. Send queries and observe streaming
4. Simulate network disconnect

**Success Metrics**:
- ✅ Connection success rate ≥ 99%
- ✅ Streaming latency < 100ms
- ✅ Reconnect time < 3s

---

#### TODO #57: Test Session Management
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่า session ทำงานถูกต้อง (chat history, context)

**Acceptance Criteria**:
- [ ] Session Creation
  - [ ] New session created on first message
  - [ ] Session ID persists across page refresh
  - [ ] Multiple sessions supported
- [ ] Chat History
  - [ ] Messages saved correctly
  - [ ] History loads on page refresh
  - [ ] Can delete chat history
- [ ] Context Retention
  - [ ] AI remembers previous messages
  - [ ] Follow-up questions work
  - [ ] Context limit enforced (e.g., last 10 messages)

**Test Queries**:
```
# Message 1: "สวัสดี"
# Message 2: "กรุงเทพอากาศเป็นอย่างไร"
# Message 3: "แล้วพรุ่งนี้ล่ะ" (should know we're talking about Bangkok)
# Refresh page → history should load
```

**Success Metrics**:
- ✅ Session persists across refresh
- ✅ Context retained for follow-ups
- ✅ History loads within 1s

---

#### TODO #58: Test Caching System
**Priority**: 🟢 P2 - MEDIUM  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่า caching ทำงาน (Redis) ลด API calls

**Acceptance Criteria**:
- [ ] Tool Result Caching
  - [ ] Same query twice → cache hit
  - [ ] Cache expiry works (TTL)
  - [ ] Cache invalidation works
- [ ] AI Response Caching
  - [ ] Similar questions use cache
  - [ ] Cache hit rate ≥ 30%
- [ ] Performance Improvement
  - [ ] Cached response < 500ms
  - [ ] Uncached response 2-5s
  - [ ] Cache hit saves 70%+ time

**Test Method**:
1. Send query "อากาศกรุงเทพวันนี้"
2. Wait 2 seconds
3. Send same query → should be cached
4. Check Redis logs

**Success Metrics**:
- ✅ Cache hit rate ≥ 30%
- ✅ Response time reduction ≥ 70%
- ✅ No stale data

---

#### TODO #59: Test Error Handling
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าจัดการ error ได้ดี (user-friendly messages)

**Acceptance Criteria**:
- [ ] API Errors
  - [ ] TMD API down → show Thai error message
  - [ ] NWP API timeout → suggest retry
  - [ ] Rate limit → explain wait time
- [ ] Tool Errors
  - [ ] Tool not found → suggest alternatives
  - [ ] Invalid arguments → explain what's wrong
  - [ ] Tool crash → fallback gracefully
- [ ] Network Errors
  - [ ] No internet → show offline message
  - [ ] Slow connection → show loading indicator
  - [ ] WebSocket disconnect → auto reconnect

**Test Scenarios**:
```
# Scenario 1: API down
Mock TMD API to return 500 error

# Scenario 2: Invalid query
"อากาศที่ XYZ123" (invalid location)

# Scenario 3: Network disconnect
Disable network mid-query
```

**Success Metrics**:
- ✅ All errors have Thai messages
- ✅ No raw error stacks shown to user
- ✅ Helpful retry/alternative suggestions

---

#### TODO #60: Test Performance & Load
**Priority**: 🟢 P2 - MEDIUM  
**Status**: 🆕 NOT STARTED  
**Goal**: ทดสอบว่าระบบรองรับ load ได้

**Acceptance Criteria**:
- [ ] Concurrent Users
  - [ ] 10 users simultaneously → no degradation
  - [ ] 50 users → response time < 10s
  - [ ] 100 users → system stable
- [ ] Long Sessions
  - [ ] 1 hour session → no memory leak
  - [ ] 100 messages → still responsive
- [ ] Large Data
  - [ ] 77 province data → filters correctly
  - [ ] Large weather dataset → processes ok
  - [ ] Big charts → renders within 5s

**Test Method**:
Use Apache Bench or Artillery:
```bash
ab -n 1000 -c 10 http://localhost:3011/api/chat
```

**Success Metrics**:
- ✅ Response time < 5s (p95)
- ✅ No crashes under load
- ✅ Memory usage stable

---

## 📋 PHASE 5: Regression Prevention & CI/CD

#### TODO #61: Establish Baseline for All Test Groups
**Priority**: 🔴 P0 - CRITICAL  
**Status**: ⏳ IN PROGRESS (blocked on TODO #13)  
**Goal**: สร้าง baseline snapshots สำหรับทุก test group

**Acceptance Criteria**:
- [ ] NWP Baseline
  ```powershell
  npm run test:regression -- --group NWP --save-baseline nwp-baseline
  ```
- [ ] TMD Baseline
  ```powershell
  npm run test:regression -- --group TMD --save-baseline tmd-baseline
  ```
- [ ] BASIC Baseline
  ```powershell
  npm run test:regression -- --group BASIC --save-baseline basic-baseline
  ```
- [ ] Complete Baseline (all 200+ questions)
  ```powershell
  npm run test:regression -- --save-baseline complete-v1.0
  ```

**Success Metrics**:
- ✅ All baselines created
- ✅ Tool accuracy ≥ 90% documented
- ✅ Baseline files committed to git

---

#### TODO #62: Automate Regression Tests Before Commits
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: ป้องกันไม่ให้ commit code ที่ทำให้ test พัง

**Acceptance Criteria**:
- [ ] Git Pre-commit Hook
  ```bash
  # .git/hooks/pre-commit
  npm run test:regression -- --compare complete-v1.0
  if [ $? -ne 0 ]; then
    echo "❌ Tests failed! Fix before committing."
    exit 1
  fi
  ```
- [ ] Quick Smoke Tests
  - Run 10 critical queries only (< 1 minute)
  - Block commit if any fail
- [ ] Full Regression on PR
  - GitHub Actions runs all 200+ tests
  - PR cannot merge if tests fail

**Success Metrics**:
- ✅ Zero regressions merged to main
- ✅ Pre-commit runs < 1 minute
- ✅ Full CI runs < 10 minutes

---

#### TODO #63: Create Regression Report Dashboard
**Priority**: 🟢 P2 - MEDIUM  
**Status**: 🆕 NOT STARTED  
**Goal**: แสดง regression trends ในรูปแบบ dashboard

**Acceptance Criteria**:
- [ ] HTML Report Generator
  - Timeline chart (accuracy over time)
  - Pass/Fail breakdown by category
  - Slowest queries list
  - Most common errors
- [ ] Email Notifications
  - Send report when accuracy drops > 5%
  - Daily summary to team
- [ ] Web Dashboard
  - Live status of latest test run
  - Historical trends (last 30 days)
  - Compare any two baselines

**Tech Stack**:
- Playwright HTML Reporter
- Chart.js for visualizations
- Simple Express server for dashboard

**Success Metrics**:
- ✅ Dashboard accessible via browser
- ✅ Auto-refreshes every 5 minutes
- ✅ Shows last 30 days of data

---

#### TODO #64: Document Testing Workflow
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  
**Goal**: เขียน documentation ให้ทีมรู้วิธี test ก่อน commit

**Acceptance Criteria**:
- [ ] Testing Guide
  - How to run tests locally
  - How to create baseline
  - How to compare results
  - How to debug failures
- [ ] Video Tutorial
  - 5-minute walkthrough
  - Demo of full workflow
- [ ] FAQ Section
  - Common issues
  - Troubleshooting tips

**Files to Create**:
- `TESTING_WORKFLOW.md`
- `docs/video-tutorial-testing.mp4`
- `FAQ_TESTING.md`

---

#### TODO #65: Integrate with E2E Tests (Playwright)
**Priority**: 🟢 P2 - MEDIUM  
**Status**: 🆕 NOT STARTED  
**Goal**: รวม regression tests เข้ากับ Playwright suite ที่มีอยู่

**Acceptance Criteria**:
- [ ] Convert test-runner.ts to Playwright tests
  - Use test fixtures
  - Parallel execution
  - Better error reporting
- [ ] Reuse Existing Test Files
  - `/tests/e2e/test_todo_req41-45/`
  - `/tests/e2e/comprehensive-test-suite.spec.ts`
- [ ] Single Command Run All
  ```powershell
  npm run test:all  # runs both unit + e2e + regression
  ```

**Success Metrics**:
- ✅ All tests in one suite
- ✅ Parallel execution (10x faster)
- ✅ Single HTML report

---

## 📋 PHASE 6: Production Readiness

#### TODO #66: Security Audit
**Priority**: 🔴 P0 - CRITICAL  
**Status**: 🆕 NOT STARTED  

**Tasks**:
- [ ] API Key validation
- [ ] CSRF protection
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Rate limiting per user
- [ ] Input sanitization

---

#### TODO #67: Performance Optimization
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  

**Tasks**:
- [ ] Database query optimization
- [ ] Redis caching tuning
- [ ] WebSocket connection pooling
- [ ] Static asset compression
- [ ] CDN for images
- [ ] Lazy loading for chat history

---

#### TODO #68: Monitoring & Alerting
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  

**Tasks**:
- [ ] Health check endpoint
- [ ] Error rate monitoring
- [ ] Response time tracking
- [ ] API usage analytics
- [ ] Alert on failure spike
- [ ] Daily health report

---

#### TODO #69: Documentation
**Priority**: 🟡 P1 - HIGH  
**Status**: 🆕 NOT STARTED  

**Tasks**:
- [ ] API documentation
- [ ] Architecture diagram
- [ ] Deployment guide
- [ ] User manual (Thai)
- [ ] Admin guide
- [ ] Troubleshooting guide

---

#### TODO #70: Deployment Automation
**Priority**: 🟢 P2 - MEDIUM  
**Status**: 🆕 NOT STARTED  

**Tasks**:
- [ ] Docker Compose production config
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated backups
- [ ] Zero-downtime deployment
- [ ] Rollback procedure
- [ ] Environment management

---

## 🎯 Execution Plan

### Week 1: Critical Issues (TODO #46-49, #56)
**Focus**: แก้ปัญหาร้ายแรง ให้ระบบใช้งานได้ stable

**Day 1-2**: Issue #1 - Province Filtering
- รัน debug
- แก้ JSON parsing
- Verify filtering works

**Day 3-4**: TODO #46-48 - API Testing
- Test all 40 tools
- Verify tool selection
- Check argument extraction

**Day 5**: TODO #49 - Data Filtering
- Complete province filtering tests
- Document results

**Week Goal**: ✅ ระบบตอบคำถาม weather ได้ถูกต้อง 95%+

---

### Week 2: Quality Assurance (TODO #50-55)
**Focus**: คำตอบคุณภาพสูง markdown สวยงาม

**Day 1-2**: TODO #50-51 - Thai + Markdown
- Test Thai quality
- Verify markdown formatting

**Day 3-4**: TODO #52-54 - Visual Elements
- Test images
- Test charts
- Test tables

**Day 5**: TODO #55 - Code Formatting
- Syntax highlighting
- Copy button

**Week Goal**: ✅ Response quality ≥ 4.5/5 rating

---

### Week 3: Integration & Regression (TODO #56-65)
**Focus**: ระบบทำงานร่วมกันได้ดี + ป้องกัน regression

**Day 1-2**: TODO #57-60 - Integration Tests
- Session management
- Caching
- Error handling
- Performance

**Day 3-4**: TODO #61-63 - Regression System
- Create all baselines
- Automate pre-commit tests
- Build dashboard

**Day 5**: TODO #64-65 - Documentation + Integration
- Write testing guide
- Integrate with Playwright

**Week Goal**: ✅ Zero regressions, automated testing

---

### Week 4: Production Ready (TODO #66-70)
**Focus**: พร้อม deploy ใช้งานจริง

**Day 1**: Security Audit
**Day 2**: Performance Optimization
**Day 3**: Monitoring Setup
**Day 4**: Documentation
**Day 5**: Deployment Automation + Launch! 🚀

**Week Goal**: ✅ Production deployment successful

---

## 📊 Success Criteria for Production Launch

### Technical Metrics
- ✅ Tool selection accuracy ≥ 95%
- ✅ Response time p95 < 5s
- ✅ Uptime ≥ 99.5%
- ✅ Error rate < 1%
- ✅ Cache hit rate ≥ 30%

### Quality Metrics
- ✅ Thai language purity ≥ 90%
- ✅ Markdown renders correctly 100%
- ✅ Images load successfully ≥ 95%
- ✅ User satisfaction ≥ 4.5/5

### Testing Metrics
- ✅ Test coverage ≥ 80%
- ✅ All 200+ regression tests passing
- ✅ Zero critical bugs in backlog
- ✅ Security audit passed

---

## 🔗 Related Documents

- [TEST_RUNNER_GUIDE.md](./TEST_RUNNER_GUIDE.md) - How to use test runner
- [TESTING_GUIDE_COMPLETE.md](./tests/TESTING_GUIDE_COMPLETE.md) - E2E testing guide
- [DEV_SUMMARY_2026-01-13.md](./DEV_SUMMARY_2026-01-13.md) - Latest dev summary

---

**Last Updated**: 2026-01-13T23:00:00+07:00  
**Next Review**: 2026-01-14 (Week 1 Day 1 kickoff)  
**Status**: 📋 READY TO EXECUTE

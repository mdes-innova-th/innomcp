## สรุปการแก้ไข Weather Query Selection

### ปัญหาที่พบ
1. ✅ **Cache Issue**: selectTools() return cached empty array []
2. ✅ **Priority Boost ไม่ทำงาน**: เพราะ Fast Path intercept ก่อน
3. ⚠️ **Backend API connection error**: Test script ไม่สามารถเชื่อมต่อ `/api/chat` ได้

### แก้ไขแล้ว

#### 1. Cache Bypass สำหรับ Weather Queries (mcpclient.ts lines 2974-2986)
```typescript
// 🔥 BYPASS CACHE for weather queries to ensure Priority Boost is applied
const isWeatherQuery = /(?:อากาศ|ฝน|อุณหภูมิ|ครึ้ม|มืด|เมฆ|แดด|ร้อน|หนาว|เย็น|ลม|พายุ|ฟ้า|ตก|พยากรณ์|weather|temperature|forecast|rain|cloud|storm|wind)/i.test(userMessage);

if (!isWeatherQuery) {
  const cached = this.getCachedSelection(userMessage);
  if (cached) {
    console.log(`[MCP Client] ♻️ Using cached tool selection (${cached.length} tools)`);
    return cached;
  }
} else {
  console.log(`[MCP Client] 🌤️ Weather query detected - bypassing cache to apply NWP/TMD priority boost`);
}
```

**ผล**: Weather queries จะไม่ใช้ cache → เข้าสู่ selectTools() → ใช้ Priority Boost (+100/+60) ทุกครั้ง

#### 2. Test Script สำหรับ Automated Testing
สร้าง 3 versions:
- ❌ `test-weather-auto.ps1` - PowerShell with emoji (encoding issue)
- ❌ `test-weather-simple.ps1` - PowerShell simplified (still encoding issue)
- ✅ `test-weather.py` - Python script (works but backend connection error)

**Python script features**:
- ส่ง 5 weather queries
- Retry 5 times ถ้า fail
- ตรวจสอบ response มี NWP/TMD หรือไม่
- Save results เป็น JSON

### ขั้นตอนการทดสอบ Manual

**วิธีทดสอบผ่าน Frontend** (แนะนำ):
1. เปิด http://localhost:3000
2. ถามคำถาม: "ตอนนี้ฝนตกไหม"
3. ดู backend logs ว่ามี:
   - ✅ `[MCP Client] 🌤️ Weather query detected - bypassing cache`
   - ✅ `[Priority] 🌤️ WEATHER QUERY DETECTED`
   - ✅ `[Priority] 🌟 NWP Tool (TIER 1): +100 bonus`
   - ✅ `[MCP Client] ✅ FINAL SELECTION: [nwp_hourly_by_place]`
4. ตรวจสอบคำตอบมี "NWP" หรือ "กรมอุตุฯ HPC" หรือ "TMD"

**Expected Backend Logs**:
```
[Classify] Classifying message: "ตอนนี้ฝนตกไหม"
[Process] ⚠️ Complex query detection DISABLED
[Process] No fast path match - using AI selection with Priority Boost
[Process] 🌤️ Weather queries will use NWP/TMD priority (+100/+60 vs -20 Open-Meteo)
[MCP Client] 🌤️ Weather query detected - bypassing cache to apply NWP/TMD priority boost
[MCP Client] 🔍 DEBUG: Starting tool selection
[MCP Client] 🔍 DEBUG: Total tools in Map: 40
[MCP Client] 🔍 DEBUG: Available tools after filter: 40
[Priority] 🌤️ WEATHER QUERY DETECTED
[Priority] Analyzing tool: nwp_hourly_by_place
[Priority] 🌟 NWP Tool (TIER 1): +100 bonus
[MCP Client] Score for nwp_hourly_by_place: 110.00
[MCP Client] ✅ FINAL SELECTION: [nwp_hourly_by_place]
```

### ต้องทดสอบเพิ่ม
- [ ] ทดสอบผ่าน Frontend (http://localhost:3000)
- [ ] ตรวจสอบ backend logs มี Priority Boost
- [ ] ตรวจสอบ response มี NWP/TMD (ไม่ใช่ Open-Meteo)
- [ ] ทดสอบ 5 queries ต่างๆ

### ไฟล์ที่แก้ไข
1. ✅ `innomcp-node/src/utils/mcp/mcpclient.ts` - เพิ่ม cache bypass (lines 2974-2986)
2. ✅ `test-weather.py` - Python test script (ready to use)

### Next Steps
1. เปิด http://localhost:3000 
2. ทดสอบ manual ด้วยคำถาม weather
3. ดู backend logs ว่า priority boost ทำงานหรือไม่
4. ถ้า pass → ทดสอบ query อื่นๆ
5. ถ้า fail → ดู logs หา root cause

# 🧪 MCP Tools Test Cases

## ✅ Tool 1: dateTimeTool
**คำถามทดสอบ:**
1. "ตอนนี้กี่โมง"
2. "วันนี้วันที่เท่าไร แบบไทย"
3. "บอก unix timestamp ปัจจุบัน"
4. "แสดงเวลาปัจจุบัน iso format"

**Expected:** ต้องได้วันที่/เวลาปัจจุบันในรูปแบบที่ขอ

---

## ⏳ Tool 2: tmdTool_weather_province_today_xml
**คำถามทดสอบ:**
1. "อากาศวันนี้เป็นอย่างไร"
2. "อุณหภูมิกรุงเทพวันนี้"
3. "สภาพอากาศเชียงใหม่"
4. "ฝนตกไหมวันนี้"

**Expected:** ต้องได้ข้อมูลอุณหภูมิ ความชื้น สภาพอากาศจากกรมอุตุฯ

---

## ⏳ Tool 3: calculatorTool  
**คำถามทดสอบ:**
1. "คำนวณ 123 + 456"
2. "85 คูณ 92 เท่าไร"
3. "หาร 1000 ด้วย 25"
4. "(10 + 20) * 3"

**Expected:** ต้องได้ผลลัพธ์การคำนวณที่ถูกต้อง

---

## ⏳ Tool 4: echartsTool
**คำถามทดสอบ:**
1. "สร้างกราฟแท่ง ยอดขายมกราคม 100, กุมภาพันธ์ 150, มีนาคม 200"
2. "วาดกราฟวงกลม กรุงเทพ 40%, เชียงใหม่ 30%, ภูเก็ต 30%"
3. "สร้าง line chart รายได้ Q1: 50000, Q2: 75000, Q3: 100000"

**Expected:** ต้องได้กราฟในรูปแบบที่ขอ (SVG)

---

## ⏳ Tool 5: webdTool_group
**คำถามทดสอบ:**
1. "webd แสดงสถิติแยกตามกลุ่ม"
2. "webd นับจำนวน url ในแต่ละหมวดหมู่"

**Expected:** ต้องได้สถิติแยกตาม group_name และ url_count
**Note:** ต้องการ WEBDDSB API key + server ที่ port 3010

---

## ⏳ Tool 6: webdTool_platforms
**คำถามทดสอบ:**
1. "webd แสดงสถิติแยกตาม platform"
2. "webd นับจำนวน url ใน facebook, twitter, youtube"

**Expected:** ต้องได้สถิติแยกตาม platform และ url_count
**Note:** ต้องการ WEBDDSB API key + server ที่ port 3010

---

## ⏳ Tool 7: webdTool_register_country
**คำถามทดสอบ:**
1. "webd แสดงสถิติแยกตามประเทศ"
2. "webd นับจำนวน url จากแต่ละประเทศ"

**Expected:** ต้องได้สถิติแยกตามประเทศ และ url_count
**Note:** ต้องการ WEBDDSB API key + server ที่ port 3010

---

## 📋 Test Status

| Tool | Status | Notes |
|------|--------|-------|
| dateTimeTool | ✅ ผ่านการทดสอบเบื้องต้น | ทำงานได้ทุกรูปแบบ |
| tmdTool | ⏳ รอทดสอบ | ต้องมี internet เพื่อเชื่อมต่อ API กรมอุตุฯ |
| calculatorTool | ⏳ รอทดสอบ | ทดสอบ expression ง่ายๆ |
| echartsTool | ⏳ รอทดสอบ | ทดสอบสร้างกราฟ bar, pie, line |
| webdTool_group | ⏳ รอทดสอบ | ต้องการ WEBDDSB_HOST + APIKEY |
| webdTool_platforms | ⏳ รอทดสอบ | ต้องการ WEBDDSB_HOST + APIKEY |
| webdTool_register_country | ⏳ รอทดสอบ | ต้องการ WEBDDSB_HOST + APIKEY |

---

## 🎯 วิธีทดสอบ

1. เปิด http://localhost:3000
2. พิมพ์คำถามในแต่ละหมวดด้านบน
3. ดูว่า AI เรียกใช้ tool ที่ถูกต้องหรือไม่
4. ดู MCP Server log เพื่อเช็คว่า tool execute สำเร็จ
5. ดูผลลัพธ์ที่ AI ตอบกลับ

## 🔍 Log ที่ต้องดู

```bash
# Backend log
[BACKEND] [MCP Client] Calling tool: dateTimeTool
[BACKEND] [MCP Client] Tool result: {...}

# MCP Server log  
[MCP] [MCP Server] Request: tools/call
[MCP] [MCP Server] DateTime tool request received...
```

## ⚠️ หมายเหตุ

- webdTools ทั้ง 3 ตัวต้องการ WEBDDSB API server (port 3010)
- ถ้าไม่มี server จะได้ error "ECONNREFUSED"
- tmdTool ต้องการ internet เพื่อเชื่อมต่อ API กรมอุตุนิยมวิทยา
- echartsTool ใช้ canvas ในการ render กราฟ

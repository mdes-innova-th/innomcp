# 🧪 INNOMCP Chat Testing Guide

## 📋 Overview

ระบบทดสอบอัตโนมัติสำหรับ INNOMCP Chat ที่จะ:
1. ส่งคำถามทดสอบ 8 ข้อ ทีละข้อผ่าน WebSocket
2. รับคำตอบและบันทึกเวลาตอบ
3. ตรวจสอบ logs เพื่อหา errors และ warnings
4. ตรวจสอบว่าใช้ tool ที่ถูกต้องหรือไม่
5. สร้าง report ผลการทดสอบ

## 🎯 Test Questions

1. **Calculator Test**: "21+12ได้เท่าไหร่"
   - Expected: calculatorTool

2. **Greeting Test**: "สวัสดี นายคือใคร"
   - Expected: Direct response (no tool)

3. **Complex Math Test**: 3 โจทย์คณิตศาสตร์ซับซ้อน
   - Product notation
   - Polynomial equation
   - Double factorial
   - Expected: calculatorTool

4. **Weather Test**: "ไทยอากาศเป็นไงเท่าที่มีข้อมูล"
   - Expected: tmdTool

5. **DateTime Test**: "ตอนนี้กี่โมง และwindow taskbarฉันแสดงเวลากี่โมง"
   - Expected: dateTimeTool

6. **Weather History Test**: "กรุงเทพเคยมีอุณภูมิประมาณเท่าไหร่"
   - Expected: tmdTool

7. **Webd Stats Test**: "ฉันมีipอะไร และจงแสดงหมวดหมูเว็ปไซต์ผิดกฏหมายที่มีในระบบwebd"
   - Expected: webdTools

## 🚀 Usage

### Prerequisites
ต้องมี services ทั้ง 3 ตัวรันอยู่:
```bash
# Terminal 1: Backend
cd innomcp-node && npm run dev

# Terminal 2: MCP Server
cd innomcp-server-node && npm run dev

# Terminal 3: Frontend
cd innomcp-next && npm run dev
```

### Run Tests

**วิธีที่ 1: ใช้ wrapper script (แนะนำ)**
```bash
cd /mnt/c/Users/USER-NT/DEV/innomcp
./run-tests.sh
```

**วิธีที่ 2: รัน test script โดยตรง**
```bash
cd /mnt/c/Users/USER-NT/DEV/innomcp
node test-chat.js
```

## 📊 Output

### Console Output
Script จะแสดง:
- 🟢 Real-time response จาก AI (สีเขียว)
- 🟡 Tool usage logs (สีเหลือง)
- 🔵 Response time (สีน้ำเงิน)
- 🟣 Tool usage analysis (สีม่วง)
- 🔴 Errors (สีแดง)
- ✅ Success indicators
- ❌ Failure indicators

### JSON Report
ผลการทดสอบจะถูกบันทึกที่: `test-results.json`

```json
[
  {
    "questionId": 1,
    "question": "21+12ได้เท่าไหร่",
    "expectedTool": "calculatorTool",
    "toolsUsed": ["calculatorTool"],
    "responseTime": 2345,
    "response": "คำตอบคือ 33...",
    "errors": [],
    "warnings": [],
    "toolUsage": ["[INFO] Calculator tool invoked..."],
    "success": true
  },
  ...
]
```

## 🔍 Log Analysis

Test script จะตรวจสอบ logs จาก:
1. **Backend Log**: `innomcp-node/logs/backend-development.log`
2. **MCP Server Log**: `innomcp-server-node/logs/mcp-server-YYYY-MM-DD.log`

สิ่งที่ตรวจสอบ:
- ❌ Error messages
- ⚠️  Warning messages
- 🔧 Tool invocation logs
- ⏱️  Performance issues (slow computation warnings)

## 🎯 Success Criteria

แต่ละ test จะ PASS ถ้า:
1. ✅ ได้รับ response จาก AI (ไม่ timeout)
2. ✅ ไม่มี errors ใน logs
3. ✅ ใช้ tool ที่ถูกต้อง (ถ้ามี expectedTool)
4. ✅ Response time < 60 seconds

## 🐛 Debugging

ถ้า test FAIL:

1. **ดู errors ใน console output**
   - Test script จะแสดง errors สีแดง

2. **เช็ค test-results.json**
   ```bash
   cat test-results.json | jq '.[] | select(.success == false)'
   ```

3. **ดู logs โดยตรง**
   ```bash
   # Backend log
   tail -f innomcp-node/logs/backend-development.log

   # MCP Server log
   tail -f innomcp-server-node/logs/mcp-server-*.log
   ```

4. **ทดสอบแบบ manual ใน browser**
   - เปิด http://localhost:3000
   - ส่งคำถามที่ failed
   - ดู Network tab และ Console

## 📝 Modifying Tests

แก้ไขคำถามใน `test-chat.js`:
```javascript
const TEST_QUESTIONS = [
  {
    id: 1,
    question: 'Your question here',
    expectedTool: 'toolName', // or null
    description: 'Test description'
  },
  // ... more questions
];
```

## 🔄 CI/CD Integration

ใช้ test script ใน CI/CD pipeline:
```bash
#!/bin/bash
./run-tests.sh
if [ $? -ne 0 ]; then
  echo "Tests failed, aborting deployment"
  exit 1
fi
```

## 💡 Tips

1. **Test ทีละข้อ**: แก้ไข `TEST_QUESTIONS` array ให้เหลือข้อที่ต้องการ
2. **เพิ่ม timeout**: แก้ `timeout` ใน `sendQuestion()` function
3. **Debug mode**: เพิ่ม `console.log` ใน test script
4. **Watch logs**: เปิด terminal แยกเพื่อดู logs แบบ real-time

## 📈 Performance Benchmarks

Target response times:
- Simple calculator: < 5s
- Greeting: < 3s
- Complex math: < 15s
- Tool invocation: < 10s
- Weather/DateTime: < 8s

## 🎉 Expected Results

ทุก test ควร PASS ถ้า:
- ✅ All services running correctly
- ✅ Ollama model loaded (gemma3:4b)
- ✅ MCP tools registered properly
- ✅ No network issues
- ✅ Database connected (for webd tests)

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| "WebSocket connection failed" | เช็คว่า innomcp-node รันอยู่บน port 3011 |
| "Response timeout" | เพิ่ม timeout หรือเช็ค Ollama status |
| "Expected tool not used" | เช็ค MCP tool registration logs |
| "Cannot read log files" | เช็คว่า paths ถูกต้องและมี permissions |

---

**สร้างโดย**: GitHub Copilot (Claude Sonnet 4.5)
**Session**: 8.6 - Professional UI Enhancement & Testing

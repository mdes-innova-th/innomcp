<!-- cc-team deliverable
 group: P3A (Phase 3.1 â€” Fix fastPathHandler: greetings must pass to LLM, not get 'à¸«à¹‰à¸²à¸¡à¹€à¸”à¸²à¹‚à¸§à¹‰à¸¢')
 member: P3A-4 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":93,"completion_tokens":1728,"total_tokens":1821,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":307,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-12T03:41:55.244Z -->
# Phase 3.1 Fast-Path Greeting Fix – Verification Document  
# เอกสารการตรวจสอบการแก้ไข Fast-Path สำหรับคำทักทาย (Phase 3.1)

## วัตถุประสงค์ / Purpose  
ตรวจสอบว่าการแก้ไข Fast-Path สำหรับคำทักทายทำงานถูกต้อง:  

- เมื่อผู้ใช้ส่งข้อความ `"hello"` ระบบควรตอบกลับด้วยข้อความทักทายแบบเร็ว โดยไม่ต้องผ่านกระบวนการประมวลผลเต็มรูปแบบ  
- เมื่อผู้ใช้ส่งข้อความที่ไม่มีความหมาย เช่น `"xkjhq2"` ระบบควรระบุว่าเป็นข้อความที่ไม่รู้จัก (handled = true, category = unknown)

Verify that the fast-path greeting fix works correctly:

- When a user sends `"hello"`, the system should reply with a quick greeting without full processing.
- When a user sends gibberish like `"xkjhq2"`, the system should mark it as handled with category "unknown".

## ข้อกำหนดเบื้องต้น / Prerequisites  
- เซิร์ฟเวอร์ API กำลังทำงานที่ `http://localhost:3000` (หรือ URL ที่กำหนด)  
- ได้ใช้การแก้ไข Phase 3.1 แล้ว  
- API endpoint `/api/chat` พร้อมใช้งาน

- API server is running at `http://localhost:3000` (or specified URL)  
- Phase 3.1 fix has been applied  
- `/api/chat` endpoint is available

---

## กรณีทดสอบที่ 1: ข้อความทักทาย "hello"  
## Test Case 1: Greeting "hello"

### คำสั่ง / Command
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}' \
  -w "\n"
```

### พฤติกรรมก่อนแก้ไข (Before Fix)  
- อาจตอบกลับด้วยข้อความทั่วไปหรือข้อความผิดพลาด  
- อาจใช้เวลาในการประมวลผลนาน  
- อาจไม่มีข้อความทักทายแบบเร็ว

- May respond with a generic or error message  
- May take longer processing time  
- May not return a quick greeting

### พฤติกรรมหลังแก้ไข (After Fix – Expected)  
- HTTP Status: `200 OK`  
- Response body (JSON):  
  ```json
  {
    "reply": "Hello! How can I help you?",
    "handled": true,
    "category": "greeting"
  }
  ```  
- ข้อความ `reply` ควรเป็นข้อความทักทายที่เป็นมิตร  
- ฟิลด์ `handled` ควรเป็น `true`  
- ฟิล��์ `category` ควรเป็น `"greeting"`

- HTTP Status: `200 OK`  
- Response body (JSON) containing:  
  - `"reply"` with a friendly greeting string  
  - `"handled": true`  
  - `"category": "greeting"`

---

## กรณีทดสอบที่ 2: ข้อความไม่มีความหมาย "xkjhq2"  
## Test Case 2: Gibberish "xkjhq2"

### คำสั่ง / Command
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"xkjhq2"}' \
  -w "\n"
```

### พฤติกรรมก่อนแก้ไข (Before Fix)  
- อาจตอบกลับว่าไม่สามารถประมวลผลได้ หรือคืนค่า `handled: false`  
- อาจเกิดข้อผิดพลาดหรือ timeout

- May return a processing failure or `handled: false`  
- May error or timeout

### พฤติกรรมหลังแก้ไข (After Fix – Expected)  
- HTTP Status: `200 OK`  
- Response body (JSON):  
  ```json
  {
    "reply": "I'm not sure how to respond to that.",
    "handled": true,
    "category": "unknown"
  }
  ```  
- ฟิลด์ `handled` ต้องเป็น `true`  
- ฟิลด์ `category` ต้องเป���น `"unknown"`  
- ข้อความ `reply` สามารถเป็นข้อความสำรองใดก็ได้

- HTTP Status: `200 OK`  
- Response body (JSON) with:  
  - `"handled": true`  
  - `"category": "unknown"`  
  - Any fallback `"reply"` text

---

## เกณฑ์การผ่าน (Pass Criteria)  
| เงื่อนไข | รายละเอียด |
|----------|-------------|
| **Test 1** | `curl` ส่ง `{"message":"hello"}` → HTTP 200; response มี `"handled":true`, `"category":"greeting"` และ `"reply"` เป็นข้อความทักทาย |
| **Test 2** | `curl` ส่ง `{"message":"xkjhq2"}` → HTTP 200; response มี `"handled":true` และ `"category":"unknown"` |
| **Response Format** | Response ทั้งหมดต้องเป็น JSON ที่ถูกต้อง (valid JSON) |
| **No Errors** | ไม่มี HTTP error status (4xx/5xx) และไม่มีการ timeout |

| Condition | Detail |
|-----------|--------|
| **Test 1** | `curl` with `{"message":"hello"}` → HTTP 200; response contains `"handled":true`, `"category":"greeting"`, and `"reply"` is a greeting |
| **Test 2** | `curl` with `{"message":"xkjhq2"}` → HTTP 200; response contains `"handled":true` and `"category":"unknown"` |
| **Response Format** | All responses must be valid JSON |
| **No Errors** | No HTTP error status (4xx/5xx) and no timeout |

---

## หมายเหตุ / Notes  
- หาก API ใช้พอร์ตหรือ URL อื่น ให้ปรับเปลี่ยนตามนั้น  
- สามารถใช้เครื่องมือทดสอบอื่น (Postman, Insomnia) แทน `curl` ได้  
- เกณฑ์การผ่านทั้งหมดต้องเป็นจริงสำหรับทั้งสองกรณีทดสอบ

- If the API uses a different port or URL, adjust accordingly.  
- Other testing tools (Postman, Insomnia) can be used instead of `curl`.  
- All pass criteria must be satisfied for both test cases.

<!-- cc-team deliverable
 group: P3C (Phase 3.3 â€” /health endpoint must expose provider + build status)
 member: P3C-3 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":58,"completion_tokens":1150,"total_tokens":1208,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":76,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-12T03:42:35.270Z -->
```markdown
# การตรวจสอบ Endpoint สุขภาพ (Health Endpoint Verification)
# Health Endpoint Verification

## รายละเอียดการทดสอบ (Test Case)
- **Phase**: 3.3
- **Endpoint**: `GET /api/health`
- **วัตถุประสงค์**: ตรวจสอบว่า endpoint ส่งคืนข้อมูลสุขภาพของระบบ รวมถึงฟิลด์ `providers` และ `build` ตามที่กำหนด
- **Purpose**: Verify that the endpoint returns system health information including `providers` and `build` fields as specified.

## ขั้นตอนการตรวจสอบ (Verification Steps)
1. ส่งคำขอ `GET` ไปยัง `/api/health` โดยใช้ `curl`
2. ตรวจสอบสถานะ HTTP Response (HTTP Status Code)
3. ตรวจสอบโครงสร้าง JSON ที่ส่งกลับมา

```bash
# คำสั่ง curl สำหรับตรวจสอบ (Curl command)
curl -X GET http://localhost:8000/api/health
```

## รูปแบบ JSON ที่คาดหวัง (Expected JSON Shape)

```json
{
  "status": "ok",
  "timestamp": "2025-04-01T12:34:56Z",
  "build": {
    "version": "1.0.0",
    "commit": "abc123",
    "buildTime": "2025-04-01T10:00:00Z"
  },
  "providers": {
    "postgres": "connected",
    "redis": "connected",
    "stripe": "available"
  }
}
```

### คำอธิบายฟิลด์ (Field Descriptions)

| ฟิลด์ (Field) | ประเภท (Type) | คำอธิบาย (Description) |
|---------------|----------------|-------------------------|
| `status`      | string         | สถานะโดยรวมของระบบ (`ok`, `degraded`, `error`) |
| `timestamp`   | string (ISO 8601) | เวลาที่ทำการตรวจสอบ |
| `build`       | object         | ข้อมูลเวอร์ชันของแอปพลิเคชัน |
| `build.version` | string       | รุ่นของซอฟต์แวร์ |
| `build.commit`  | string       | Commit hash ของ Git |
| `build.buildTime` | string (ISO 8601) | เวลาที่ build |
| `providers`   | object         | สถานะการเชื่อมต่อของผู้ให้บริการภายนอกแต่ละราย |
| `providers.*` | string         | ค่าสถานะ (`connected`, `disconnected`, `available`, `unavailable`, `error`) |

## เกณฑ์ผ่าน (Pass Criteria)

1. **HTTP Status Code** ต้องเป็น `200 OK`
2. **JSON Structure** ต้องมีฟิลด์ดังต่อไปนี้ทุกฟิลด์:
   - `status`
   - `timestamp`
   - `build` (object ที่มี `version`, `commit`, `buildTime`)
   - `providers` (object ที่มีอย่างน้อยหนึ่ง provider)
3. **ค่า `status`** ต้อ���เป็น `"ok"`, `"degraded"` หรือ `"error"` ตามสถานะจริง
4. **`timestamp`** ต้องเป็นสตริงวันที่ในรูปแบบ ISO 8601 ที่ถูกต้อง
5. **`providers`** ต้องมีฟิลด์สำหรับทุก provider ที่ลงทะเบียนไว้ในระบบ (เช่น `postgres`, `redis`, `stripe`) และค่าต้องเป็นหนึ่งในสถานะที่รองรับ
6. **`build`** ต้องมีข้อมูลครบถ้วนและไม่เป็น null หรือ undefined

**ตัวอย่างการตรวจสอบด้วย curl + jq:**
```bash
curl -s http://localhost:8000/api/health | jq '.status, .build.version, .providers.postgres'
```

## ข้อควรระวังสำหรับ Regression (Regression Note)

⚠️ **ห้ามทำให้ฟิลด์เดิมที่มีอยู่แล้วเสียหาย**  
⚠️ **Existing fields must not break**

- ฟิลด์ `status` และ `timestamp` ที่มีอยู่ก่อนหน้า **ต้องยังคงมีอยู่** และทำงานได้ตามเดิม
- การเพิ่���ฟิลด์ `build` และ `providers` **ต้องไม่กระทบ** ต่อฟิลด์อื่นที่มีอยู่แล้ว
- โครงสร้าง JSON ต้องยังคงเข้ากันได้กับลูกค้า (client) ที่อาจจะใช้งานฟิลด์เก่า
- กรณีที่ฟิลด์ใดฟิลด์หนึ่งไม่พร้อมใช้งาน (เช่น provider ไม่มี config) ให้ส่งค่า `"unavailable"` หรือ `"error"` แทนที่จะลบฟิลด์นั้นออก
- การเปลี่ยนแปลงรูปแบบของ `timestamp` หรือ `status` จะถือว่าเป็นการทำลายความเข้ากันได้ (breaking change)

---
*แก้ไขล่าสุด: 2025-04-01*
*Last updated: 2025-04-01*
```

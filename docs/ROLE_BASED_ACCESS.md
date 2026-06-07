# 🔐 Role-Based Access Control System

## สรุประบบจำกัดสิทธิ์การใช้งาน

ระบบ INNOMCP มี 3 ระดับการใช้งาน:

### 1. 👥 Guest (ไม่ได้ล็อกอิน) - 50% Capability
**จำกัด:**
- ✅ **10 requests/hour** (จำกัดเพื่อประหยัด AI tokens)
- ✅ **Response สูงสุด 2,000 ตัวอักษร** (user ปกติ: 10,000)
- ✅ **AI tokens สูงสุด 500/request** (user ปกติ: 2,000)
- ✅ **เครื่องมือพื้นฐานเท่านั้น:**
  - `dateTimeTool`, `calculatorTool` - เครื่องมือพื้นฐาน
  - `weather`, `nwp_hourly_by_place`, `nwp_daily_by_place` - พยากรณ์อากาศ
  - `tmd_weather_forecast_7days_by_province` - พยากรณ์ 7 วัน
  - `echartsTool` - สร้างกราฟ
  - `newton`, `worldbank`, `archive`, `nasa` - ข้อมูลสาธารณะ

**ไม่สามารถใช้:**
- ❌ TMD Advanced APIs (seismic, climate, detailed stations)
- ❌ File tools (PDF reader, Excel reader, Word reader)
- ❌ OCR tool
- ❌ Code formatter
- ❌ Translation tool
- ❌ RSS feed reader
- ❌ Currency exchange
- ❌ QR code generator
- ❌ Image generator

**แสดงข้อความเมื่อเกินจำกัด:**
> ⚠️ คุณใช้งานเกินจำนวนที่กำหนดสำหรับผู้ใช้ที่ไม่ได้ล็อกอิน กรุณาล็อกอินเพื่อใช้งานได้เต็มประสิทธิภาพ

---

### 2. 👤 User (ล็อกอินแล้ว) - 100% Capability
**สิทธิ์:**
- ✅ **100 requests/hour** - เยอะมาก!
- ✅ **Response สูงสุด 10,000 ตัวอักษร** - ยาวเต็มที่
- ✅ **AI tokens สูงสุด 2,000/request**
- ✅ **ใช้ได้ทุกเครื่องมือ (40+ tools)**
- ✅ ไม่มีการตัดทอนคำตอบ
- ✅ ใช้งานได้เต็มประสิทธิภาพ

**Account:** `user` / `User@123`

---

### 3. 👑 Admin (ผู้ดูแลระบบ) - Unlimited
**สิทธิ์:**
- ✅ **1,000 requests/hour** - แทบไม่จำกัด
- ✅ **Response สูงสุด 50,000 ตัวอักษร**
- ✅ **AI tokens สูงสุด 4,000/request**
- ✅ **ใช้ได้ทุกเครื่องมือ**
- ✅ **สามารถตั้งค่า MCP และ Chat ได้**
- ✅ **เข้าถึง Admin Panel**

**Account:** `admin` / `Admin@123`

---

## 📁 ไฟล์ที่สร้าง

### 1. Database SQL
**File:** `mariadb/insert_users.sql`
```sql
-- สร้าง admin และ user
INSERT INTO user ...
```

**รัน:**
```bash
# ใน Docker container
docker exec -i innomcp-mariadb mariadb -u root -proot innomcp < mariadb/insert_users.sql

# หรือใช้ script
docker exec innomcp-mariadb sh /tmp/insert.sh
```

### 2. Guest Limiter Middleware
**File:** `innomcp-node/src/middleware/guestLimiter.ts`

**Features:**
- ✅ Rate limiting per user/guest
- ✅ Tool access control
- ✅ Response length limiting
- ✅ Token usage control
- ✅ Auto cleanup old entries

**Usage in chat.ts:**
```typescript
import { optionalAuth } from "../../utils/jwt";
import { guestLimiterMiddleware, getLimitsForUser } from "../../middleware/guestLimiter";

chatRouter.post("/", 
  optionalAuth,            // Attach user info if logged in
  guestLimiterMiddleware,  // Apply limits based on role
  async (req, res) => {
    // Access limits via req.guestLimits
    // Access guest status via req.isGuest
    // Access capability via req.capabilityLevel
  }
);
```

### 3. Frontend AuthContext
**File:** `innomcp-next/src/app/context/AuthContext.tsx`

**Already has:**
```typescript
const isGuestMode = !isLoggedIn;
const capabilityLevel = isLoggedIn ? 100 : 50;
```

**Use in components:**
```tsx
const { isGuestMode, capabilityLevel } = useAuth();

{isGuestMode && (
  <div className="alert">
    ⚠️ คุณกำลังใช้งานแบบ Guest (50%) - 
    <a href="/login">ล็อกอิน</a> เพื่อใช้งานเต็มประสิทธิภาพ
  </div>
)}
```

---

## 🧪 วิธีทดสอบ

### Test 1: Guest User (50%)
1. เปิด browser (Incognito mode)
2. ไปที่ http://localhost:3000
3. พิมพ์คำถาม 11 ครั้ง
4. **คาดหวัง:** ครั้งที่ 11 จะได้ error 429 (Rate limit exceeded)

### Test 2: Logged-in User (100%)
1. Login ด้วย `user` / `User@123`
2. ทดสอบ tools ทั้งหมด (PDF reader, OCR, etc.)
3. **คาดหวัง:** ใช้ได้ทุก tool ไม่มีข้อจำกัด

### Test 3: Admin (Unlimited)
1. Login ด้วย `admin` / `Admin@123`
2. เข้า Admin Panel
3. ตั้งค่า MCP/Chat
4. **คาดหวัง:** เข้าถึงทุก feature รวมถึง config

---

## 📊 Response Headers

ระบบส่ง headers กลับมาใน response:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2026-01-14T01:30:00.000Z
```

**ตัวอย่าง Error Response (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "คุณใช้งานเกินจำนวนที่กำหนดสำหรับผู้ใช้ที่ไม่ได้ล็อกอิน กรุณาล็อกอินเพื่อใช้งานได้เต็มประสิทธิภาพ",
  "limits": {
    "maxRequestsPerHour": 10,
    "resetAt": "2026-01-14T01:30:00.000Z"
  },
  "isGuest": true
}
```

---

## 🎯 ประโยชน์

### 1. ประหยัด AI Tokens
- Guest จำกัด 500 tokens/request (จาก max 2000)
- ลด 75% ของ token usage จาก guests
- **ประหยัดค่าใช้จ่าย** หาก migrate ไป paid API

### 2. ป้องกัน Abuse
- Rate limiting ป้องกัน spam
- จำกัดการใช้งาน tools ที่ resource-intensive

### 3. Encourage Login
- แสดงข้อความชัดเจนให้ guest รู้ว่า login = feature มากขึ้น
- เพิ่ม user engagement

### 4. Scalability
- ระบบรองรับ users หลายคนได้โดยไม่เกิน resource limit
- Admin ได้รับ priority สูงสุด

---

## 🔧 Customization

แก้ไขค่าจำกัดใน `guestLimiter.ts`:

```typescript
const GUEST_LIMITS: GuestLimits = {
  maxRequestsPerHour: 10,     // เพิ่ม/ลดได้
  maxResponseLength: 2000,    // เปลี่ยนตามต้องการ
  allowedTools: [...],        // เพิ่ม/ลด tools
  maxTokensPerRequest: 500,   // ปรับตาม model
};
```

---

## ✅ Status

- ✅ Middleware created & integrated
- ✅ AuthContext updated
- ✅ SQL script ready
- ⚠️ Database insert pending (MariaDB password issue - ต้องแก้)
- ⏳ Testing pending

---

## 📝 TODO

1. ✅ แก้ MariaDB password หรือ insert users manually
2. ✅ Test guest rate limiting
3. ✅ Test tool restrictions
4. ✅ Test response truncation
5. ✅ Add UI indicator สำหรับ guest mode
6. ✅ Add "Login to unlock" CTA buttons

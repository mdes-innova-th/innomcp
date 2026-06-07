# 🔐 INNOMCP Credentials Guide
## คู่มือการตั้งค่า API Keys และ Credentials

> **Last Updated**: 2026-01-05  
> **Total Tools**: 21 tools (18 เดิม + 3 ใหม่)

---

## 📊 สรุป Tools และ Credentials

### ✅ Tools ที่ใช้งานได้ทันทีโดยไม่ต้อง API Key (16 tools)

เหล่านี้เป็น tools ที่ฟรี 100% และไม่ต้องตั้งค่าอะไรเพิ่ม:

1. **dateTimeTool** - ไม่ต้อง API key
2. **calculatorTool / MathTool** - ไม่ต้อง API key
3. **echartsTool** - ไม่ต้อง API key
4. **qrCodeTool** - ไม่ต้อง API key
5. **codeFormatterTool** - ไม่ต้อง API key
6. **ocrTool** ⭐ NEW - ไม่ต้อง API key (Tesseract.js)
7. **fileReaderTool** ⭐ NEW - ไม่ต้อง API key (PDF/Excel/Word)
8. **imageGeneratorTool** ⭐ NEW - ไม่ต้อง API key (Canvas)
9. **currencyExchangeTool** - ใช้ free endpoint (ไม่ต้อง API key แต่จำกัด 1500 req/month)
10. **translationTool** - ใช้ public instance (ไม่ต้อง API key)
11. **rssFeedTool** - ไม่ต้อง API key
12. **newtonTool** - ไม่ต้อง API key
13. **archiveTool** - ไม่ต้อง API key
14. **govDataTool** - ไม่ต้อง API key (ใช้ open data)
15. **worldBankTool** - ไม่ต้อง API key
16. **tmdTools** (11 sub-tools) - ไม่ต้อง API key

### ⚠️ Tools ที่ต้อง API Key (2 tools - Optional)

1. **weatherTool** - ต้อง OpenWeatherMap API key
2. **nasaTool** - ต้อง NASA API key

---

## 🔧 การตั้งค่า Environment Variables

### ตำแหน่งไฟล์: `.env`

สร้างไฟล์ `.env` ใน root ของโปรเจ็ค:

```bash
# ไปที่ root directory
cd /mnt/c/Users/USER-NT/DEV/innomcp/innomcp-server-node

# สร้าง .env file (ถ้ายังไม่มี)
touch .env
```

### เนื้อหาในไฟล์ `.env`:

```env
# ==============================================
# INNOMCP Server Configuration
# ==============================================

# Server Settings
SERVER_HOST=0.0.0.0
SERVER_PORT=3013  # (ถ้า port ชน ให้เปลี่ยนเป็น port ว่าง เช่น 3013/3014)

# ==============================================
# API Keys - Tools with Credentials (OPTIONAL)
# ==============================================

# OpenWeather API (สำหรับ weatherTool)
# 🔗 สมัคร: https://openweathermap.org/api
# 🆓 ฟรี: 1000 calls/day
OPENWEATHER_API_KEY=your_openweather_api_key_here

# NASA API (สำหรับ nasaTool)
# 🔗 สมัคร: https://api.nasa.gov/
# 🆓 ฟรี: 1000 requests/hour
NASA_API_KEY=your_nasa_api_key_here

# ==============================================
# External Services (OPTIONAL - สำหรับ upgrade)
# ==============================================

# LibreTranslate (ถ้าต้องการ self-host แทน public instance)
# LIBRETRANSLATE_URL=http://localhost:5000
# LIBRETRANSLATE_API_KEY=optional_if_self_hosted

# ExchangeRate API (ถ้าต้องการ upgrade จาก free tier)
# 🔗 สมัคร: https://www.exchangerate-api.com/
# EXCHANGERATE_API_KEY=your_api_key_here

# ==============================================
# Database & Cache (มีอยู่แล้ว)
# ==============================================

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=innomcp

REDIS_HOST=localhost
REDIS_PORT=6379

# ==============================================
# Security
# ==============================================

JWT_SECRET=your_jwt_secret_here
CSRF_SECRET=your_csrf_secret_here
```

---

## 📝 วิธีสมัครและตั้งค่า API Keys

### 1. OpenWeatherMap API (weatherTool)

**ขั้นตอน:**
1. ไปที่: https://openweathermap.org/api
2. คลิก "Sign Up" (สมัครฟรี)
3. ยืนยัน email
4. ไปที่ "API keys" tab
5. Copy API key
6. วางใน `.env`: `OPENWEATHER_API_KEY=your_key_here`

**ข้อจำกัด (Free tier):**
- ✅ 1,000 calls/day
- ✅ Current weather + 5-day forecast
- ❌ Historical data (ต้องจ่าย)

**ตัวอย่างการใช้:**
```
"สภาพอากาศปัจจุบันที่กรุงเทพ"
"พยากรณ์อากาศ 5 วัน จังหวัดเชียงใหม่"
```

---

### 2. NASA API (nasaTool)

**ขั้นตอน:**
1. ไปที่: https://api.nasa.gov/
2. คลิก "Get Started" หรือ "Generate API Key"
3. กรอกข้อมูล: First Name, Last Name, Email
4. คลิก "Signup"
5. Check email รับ API key
6. วางใน `.env`: `NASA_API_KEY=your_key_here`

**ข้อจำกัด (Free tier):**
- ✅ 1,000 requests/hour
- ✅ ข้อมูลทุก API endpoints

**ตัวอย่างการใช้:**
```
"รูปภาพดาราศาสตร์วันนี้จาก NASA"
"ข้อมูลดาวเคราะห์น้อย"
"รูปภาพโลกจากดาวเทียม"
```

---

### 3. Google Drive API (Future - ยังไม่ได้ implement)

**หมายเหตุ**: Tool นี้ยังไม่ได้สร้าง แต่ถ้าจะสร้างในอนาคต จะต้อง:

**ขั้นตอน (ซับซ้อนกว่า):**
1. ไปที่: https://console.cloud.google.com/
2. สร้าง New Project
3. Enable Google Drive API
4. Create Credentials → OAuth 2.0 Client ID
5. Setup OAuth consent screen
6. Download credentials JSON
7. ตั้งค่า redirect URIs

**Environment Variables ที่ต้องเพิ่ม:**
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3013/auth/google/callback
```

**การ Authenticate:**
- ต้องทำ OAuth flow (user ต้อง login ผ่าน Google)
- ได้ access token และ refresh token
- เก็บ tokens ใน database หรือ session

---

## 🆓 Tools ที่ฟรี 100% (ไม่ต้องตั้งค่าอะไร)

### ocrTool - อ่านข้อความจากภาพ ⭐ NEW
- **Library**: Tesseract.js
- **Offline**: ✅ ใช้งานได้โดยไม่ต้องต่อ internet
- **ภาษา**: รองรับ 100+ ภาษา (ไทย, อังกฤษ, ญี่ปุ่น, จีน, เกาหลี, ฯลฯ)
- **ใช้งาน**: ส่งรูปภาพ (base64 หรือ URL) → ได้ข้อความ

**ตัวอย่าง:**
```
"อ่านข้อความในรูปนี้"
"OCR ภาษาไทย"
"แปลง ID card เป็นข้อความ"
```

### fileReaderTool - อ่านไฟล์ PDF/Excel/Word ⭐ NEW
- **Libraries**: pdf-parse, xlsx, mammoth
- **Offline**: ✅ ใช้งานได้โดยไม่ต้อง API
- **รองรับ**: PDF, XLSX, XLS, DOCX
- **ใช้งาน**: ส่ง file path → ได้ข้อความ/ข้อมูล

**ตัวอย่าง:**
```
"อ่านไฟล์ PDF report.pdf"
"ดึงข้อมูลจาก Excel data.xlsx"
"แปลง Word document เป็นข้อความ"
```

### imageGeneratorTool - สร้างรูปภาพ ⭐ NEW
- **Library**: Canvas
- **Offline**: ✅ สร้างรูปได้โดยไม่ต้อง internet
- **รองรับ**: รูปทรงเรขาคณิต, ข้อความ, charts พื้นฐาน
- **ใช้งาน**: ส่ง specs → ได้รูป PNG (base64)

**ตัวอย่าง:**
```
"สร้างวงกลมสีแดง"
"วาดกราฟแท่งแสดงยอดขาย"
"สร้าง diagram"
```

**หมายเหตุ**: ไม่รองรับ AI image generation (DALL-E, Midjourney) เพราะไม่ฟรี

---

## 📊 สรุปความต้องการ Credentials

| Tool | API Key ต้องการ | ฟรี | จำกัด | สมัครที่ไหน |
|------|----------------|-----|-------|-------------|
| **weatherTool** | ✅ ต้องการ | ✅ | 1000/day | openweathermap.org |
| **nasaTool** | ✅ ต้องการ | ✅ | 1000/hr | api.nasa.gov |
| **ocrTool** ⭐ | ❌ ไม่ต้อง | ✅ | ไม่จำกัด | - |
| **fileReaderTool** ⭐ | ❌ ไม่ต้อง | ✅ | ไม่จำกัด | - |
| **imageGeneratorTool** ⭐ | ❌ ไม่ต้อง | ✅ | ไม่จำกัด | - |
| **currencyExchangeTool** | ❌ ไม่ต้อง | ✅ | 1500/mo | - |
| **translationTool** | ❌ ไม่ต้อง | ✅ | ไม่จำกัด* | - |
| **qrCodeTool** | ❌ ไม่ต้อง | ✅ | ไม่จำกัด | - |
| **rssFeedTool** | ❌ ไม่ต้อง | ✅ | ไม่จำกัด | - |
| **codeFormatterTool** | ❌ ไม่ต้อง | ✅ | ไม่จำกัด | - |
| **อื่นๆ 11 tools** | ❌ ไม่ต้อง | ✅ | varies | - |

*หมายเหตุ: translationTool ใช้ public instance อาจมีการจำกัดในกรณีที่ traffic สูงมาก

---

## 🚀 Quick Start - ขั้นตอนการเริ่มใช้งาน

### 1. ใช้งาน Tools ฟรีทันที (ไม่ต้องตั้งค่าอะไร)

```bash
# ติดตั้ง dependencies (ถ้ายังไม่ได้ทำ)
cd innomcp-server-node
npm install

# รัน server
npm run dev

# เข้าใช้งาน UI
# http://localhost:3000
```

**Tools ที่ใช้ได้ทันที (16 tools):**
- dateTimeTool, calculatorTool, echartsTool
- qrCodeTool, codeFormatterTool
- **ocrTool** ⭐, **fileReaderTool** ⭐, **imageGeneratorTool** ⭐
- currencyExchangeTool, translationTool, rssFeedTool
- archiveTool, newtonTool, govDataTool, worldBankTool
- tmdTools (11 sub-tools)

### 2. เพิ่ม API Keys สำหรับ weatherTool และ nasaTool (Optional)

```bash
# สร้าง .env file
cd innomcp-server-node
nano .env  # หรือใช้ text editor อื่น

# เพิ่ม:
OPENWEATHER_API_KEY=your_key_here
NASA_API_KEY=your_key_here

# บันทึกแล้ว restart server
npm run dev
```

---

## 🔍 การตรวจสอบว่า API Keys ใช้งานได้

### ทดสอบ weatherTool:

```bash
curl -X POST http://localhost:3013/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "weather",
      "arguments": {
        "type": "current",
        "city": "Bangkok"
      }
    },
    "id": 1
  }'
```

### ทดสอบ ocrTool ⭐:

```bash
curl -X POST http://localhost:3013/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ocrTool",
      "arguments": {
        "imageData": "https://example.com/image.jpg",
        "language": "eng"
      }
    },
    "id": 1
  }'
```

---

## ⚠️ Troubleshooting

### ปัญหา: "Invalid API key" (weatherTool หรือ nasaTool)

**แก้ไข:**
1. ตรวจสอบว่า API key ถูกต้อง (ไม่มีเว้นวรรค)
2. ตรวจสอบว่าไฟล์ `.env` อยู่ใน root ของ innomcp-server-node
3. Restart server หลังแก้ไข `.env`
4. ตรวจสอบว่า API key ยังไม่หมดอายุ

### ปัญหา: Tools ไม่แสดงใน UI

**แก้ไข:**
1. ตรวจสอบว่า tool ถูก register ใน `server.ts`
2. ตรวจสอบว่า tool อยู่ใน `ALLOWED_TOOLS` ของ `mcpclient.ts`
3. Restart server
4. Clear browser cache

### ปัญหา: OCR ไม่อ่านภาษาไทย

**แก้ไข:**
1. ตั้งค่า `language: "tha"` แทน `"eng"`
2. ใช้รูปที่คมชัด, มีแสงเพียงพอ
3. ข้อความควรตั้งตรง, ไม่เอียงมาก

---

## 📚 Resources & Documentation

### API Documentation:
- **OpenWeatherMap**: https://openweathermap.org/api
- **NASA APIs**: https://api.nasa.gov/
- **Tesseract.js**: https://tesseract.projectnaptha.com/
- **pdf-parse**: https://www.npmjs.com/package/pdf-parse
- **xlsx**: https://www.npmjs.com/package/xlsx
- **mammoth**: https://www.npmjs.com/package/mammoth

### INNOMCP Docs:
- [TOOLS_INVENTORY.md](./TOOLS_INVENTORY.md) - รายการ tools ทั้งหมด
- [TOOLS_READY.md](./TOOLS_READY.md) - Status และ usage guide
- [MCP_WORLD_CLASS_TOOLS.md](../docs/MCP_WORLD_CLASS_TOOLS.md) - World-class tools research

---

**Status**: ✅ READY  
**Last Updated**: 2026-01-05  
**Total Tools**: 21 (16 ฟรี 100%, 2 ต้อง API key optional, 3 ยังไม่ implement)

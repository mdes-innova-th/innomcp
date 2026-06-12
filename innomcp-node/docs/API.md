




# innomcp-node Backend API Documentation

This document provides complete reference for all public API endpoints of the innomcp-node service. Each endpoint includes HTTP method, path, request parameters/body, response structure, and a practical `curl` example.

---

## `/api/health`

**Method:** `GET`  
**Description:** Health check endpoint to verify the service is running.  
**Request:** No body or query parameters.  
**Response (JSON):**

{
  "status": "ok",
  "timestamp": "2025-03-22T12:00:00Z"
}

**Example:**

curl https://api.innomcp.com/api/health


---

## `/api/analytics/stats`

**Method:** `GET`  
**Description:** Returns aggregated usage statistics for the current period (daily, weekly, monthly).  
**Query Parameters:**  
- `period` (string, optional): `"day"`, `"week"`, or `"month"`. Defaults to `"day"`.  
**Response (JSON):**

{
  "period": "day",
  "totalRequests": 1234,
  "avgResponseTimeMs": 85.3,
  "errorRate": 0.02,
  "topEndpoints": ["/api/mdes/models", "/api/thai/tokenize"]
}

**Example:**

curl "https://api.innomcp.com/api/analytics/stats?period=week"


---

## `/api/mdes/models`

**Method:** `GET`  
**Description:** Lists all available model descriptors (MDES) that can be used for domain-specific tasks.  
**Request:** No parameters.  
**Response (JSON):**

{
  "models": [
    {
      "id": "mdes-v1",
      "name": "MDES Base v1",
      "tasks": ["classification", "regression"],
      "version": "1.0.0"
    }
  ]
}

**Example:**

curl https://api.innomcp.com/api/mdes/models


---

## `/api/mdes/best/:task`

**Method:** `GET`  
**Description:** Returns the best performing model for a given task (e.g., `classification`, `summarization`).  
**Path Parameters:**  
- `task` (string, required): Target task identifier.  
**Response (JSON):**

{
  "task": "classification",
  "bestModel": {
    "id": "mdes-v1-class",
    "name": "MDES Classifier v1",
    "accuracy": 0.967,
    "lastUpdated": "2025-03-20"
  }
}

**Example:**

curl https://api.innomcp.com/api/mdes/best/classification


---

## `/api/thai/detect`

**Method:** `POST`  
**Description:** Detects the language and script of a given text, with focus on Thai and mixed scripts.  
**Request Body (JSON):**

{
  "text": "สวัสดีครับ Hello"
}

**Response (JSON):**

{
  "detectedLanguage": "th",
  "confidence": 0.99,
  "scripts": [
    {"name": "Thai", "percentage": 60.0},
    {"name": "Latin", "percentage": 40.0}
  ],
  "hasThai": true
}

**Example:**

curl -X POST https://api.innomcp.com/api/thai/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"สวัสดีครับ Hello"}'


---

## `/api/thai/tokenize`

**Method:** `POST`  
**Description:** Tokenizes Thai text into words (segments) using a deep-learning-based model.  
**Request Body (JSON):**

{
  "text": "ฉันไปตลาดซื้อผลไม้",
  "options": {
    "includeSpaces": false
  }
}

`options` (object, optional):  
- `includeSpaces` (boolean): Include whitespace tokens. Default: `false`.  
**Response (JSON):**

{
  "tokens": ["ฉัน", "ไป", "ตลาด", "ซื้อ", "ผลไม้"],
  "tokenCount": 5,
  "text": "ฉันไปตลาดซื้อผลไม้"
}

**Example:**

curl -X POST https://api.innomcp.com/api/thai/tokenize \
  -H "Content-Type: application/json" \
  -d '{"text":"ฉันไปตลาดซื้อผลไม้","options":{"includeSpaces":false}}'


---

# เอกสาร API ของ innomcp-node (ภาษาไทย)

เอกสารนี้ให้ข้อมูลอ้างอิงครบถ้วนสำหรับ API สาธารณะทั้งหมดของบริการ innomcp-node แต่ละจุดสิ้นสุดประกอบด้วย HTTP method, path, พารามิเตอร์/body ของคำขอ, โครงสร้างการตอบกลับ และตัวอย่างคำสั่ง `curl`

---

## `/api/health`

**Method:** `GET`  
**คำอธิบาย:** จุดตรวจสอบสุขภาพเพื่อยืนยันว่าบริการกำลังทำงาน  
**คำขอ:** ไม่มี body หรือ query parameters  
**การตอบกลับ (JSON):**

{
  "status": "ok",
  "timestamp": "2025-03-22T12:00:00Z"
}

**ตัวอย่าง:**

curl https://api.innomcp.com/api/health


---

## `/api/analytics/stats`

**Method:** `GET`  
**คำอธิบาย:** ส่งกลับสถิติการใช้งานที่รวบรวมไว้สำหรับช่วงเวลาปัจจุบัน (รายวัน รายสัปดาห์ รายเดือน)  
**Query Parameters:**  
- `period` (string, ไม่บังคับ): `"day"`, `"week"` หรือ `"month"`. ค่าเริ่มต้นคือ `"day"`  
**การตอบกลับ (JSON):**

{
  "period": "day",
  "totalRequests": 1234,
  "avgResponseTimeMs": 85.3,
  "errorRate": 0.02,
  "topEndpoints": ["/api/mdes/models", "/api/thai/tokenize"]
}

**ตัวอย่าง:**

curl "https://api.innomcp.com/api/analytics/stats?period=week"


---

## `/api/mdes/models`

**Method:** `GET`  
**คำอธิบาย:** แสดงรายการตัวระบุโมเดล (MDES) ที่มีอยู่ทั้งหมดซึ่งสามารถใช้สำหรับงานเฉพาะด้าน  
**คำขอ:** ไม่มีพารามิเตอร์  
**การตอบกลับ (JSON):**

{
  "models": [
    {
      "id": "mdes-v1",
      "name": "MDES Base v1",
      "tasks": ["classification", "regression"],
      "version": "1.0.0"
    }
  ]
}

**ตัวอย่าง:**

curl https://api.innomcp.com/api/mdes/models


---

## `/api/mdes/best/:task`

**Method:** `GET`  
**คำอธิบาย:** ส่งกลับโมเดลที่มีประสิทธิภาพดีที่สุดสำหรับงานที่กำหนด (เช่น `classification`, `summarization`)  
**Path Parameters:**  
- `task` (string, จำเป็น): ระบุตัวระบุงานเป้าหมาย  
**การตอบกลับ (JSON):**

{
  "task": "classification",
  "bestModel": {
    "id": "mdes-v1-class",
    "name": "MDES Classifier v1",
    "accuracy": 0.967,
    "lastUpdated": "2025-03-20"
  }
}

**ตัวอย่าง:**

curl https://api.innomcp.com/api/mdes/best/classification


---

## `/api/thai/detect`

**Method:** `POST`  
**คำอธิบาย:** ตรวจจับภาษาและสคร���ปต์ของข้อความที่กำหนด โดยเน้นที่���าษาไทยและสคริปต์ผสม  
**Body ของคำขอ (JSON):**

{
  "text": "สวัสดีครับ Hello"
}

**การตอบกลับ (JSON):**

{
  "detectedLanguage": "th",
  "confidence": 0.99,
  "scripts": [
    {"name": "Thai", "percentage": 60.0},
    {"name": "Latin", "percentage": 40.0}
  ],
  "hasThai": true
}

**ตัวอย่าง:**

curl -X POST https://api.innomcp.com/api/thai/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"สวัสดีครับ Hello"}'


---

## `/api/thai/tokenize`

**Method:** `POST`  
**คำอธิบาย:** ตัดคำภาษาไทยเป็นคำ (segment) โดยใช้โมเดล深度学习  
**Body ของคำขอ (JSON):**

{
  "text": "ฉันไปตลาดซื้อผลไม้",
  "options": {
    "includeSpaces": false
  }
}

`options` (object, ไม่บังคับ):  
- `includeSpaces` (boolean): รวม token ที่เป็นช่องว่างหรือไม่ ค่าเริ่มต้น: `false`  
**การตอบกลับ (JSON):**

{
  "tokens": ["ฉัน", "ไป", "ตลาด", "ซื้อ", "ผลไม้"],
  "tokenCount": 5,
  "text": "ฉันไปตลาดซื้อผลไม้"
}

**ตัวอย่าง:**

curl -X POST https://api.innomcp.com/api/thai/tokenize \
  -H "Content-Type: application/json" \
  -d '{"text":"ฉันไปตลาดซื้อผลไม้","options":{"includeSpaces":false}}'


# INNOMCP Node API Reference • คู่มือ API ของ INNOMCP Node

เอกสารฉบับนี้รวบรวมเส้นทาง API ทั้งหมดของระบบ **INNOMCP** (MCP Hub ภายใต้กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม)  
This document lists all API routes of the INNOMCP Node platform, the government MCP Hub by MDES.

---

## Authentication • การยืนยันตัวตน
Most endpoints require a JWT token in the `Authorization: Bearer <token>` header, except for health checks and public routes. Admin routes require an `admin` role.  
เอ็นด์พอยต์ส่วนใหญ่ต้องใช้ JWT token ใน header `Authorization: Bearer <token>` ยกเว้นเส้นทางตรวจสอบสถานะและเส้นทางสาธารณะ เส้นทางผู้ดูแลต้องการ role `admin`

---

## Routes • เส้นทาง API

### /api/chat
| Method | Path             | Description (EN) / คำอธิบาย (TH) | Body / Parameters | Response | Auth |
|--------|------------------|----------------------------------|-------------------|----------|------|
| POST   | /api/chat        | Send a message to the AI assistant and get a reply. <br> ส่งข้อความไปยังผู้ช่วย AI และรับคำตอบ | `{ message: string, sessionId?: string }` | `{ reply: string, sessionId: string }` | Yes |
| GET    | /api/chat        | Retrieve chat history for the current user/session. <br> ดึงประวัติการแชทของผู้ใช้/เซสชัน | Query: `sessionId` (optional), `limit`, `offset` | `{ messages: Array<{role, content, timestamp}> }` | Yes |

### /api/health
| Method | Path          | Description (EN) / คำอธิบาย (TH) | Response | Auth |
|--------|---------------|----------------------------------|----------|------|
| GET    | /api/health   | System health check, returns uptime and service status. <br> ตรวจสอบสถานะระบบ คืนค่า uptime และสถานะของบริการ | `{ status: "ok", uptime, services: {...} }` | No |

### /api/providers
| Method | Path            | Description (EN) / คำอธิบาย (TH) | Response | Auth |
|--------|-----------------|----------------------------------|----------|------|
| GET    | /api/providers  | List registered AI providers and their capabilities. <br> แสดงรายชื่อผู้ให้บริการ AI ที่ลงทะเบียนและความสามารถ | `{ providers: [...] }` | No |

### /api/analytics
| Method | Path             | Description (EN) / คำอธิบาย (TH) | Query Parameters | Response | Auth |
|--------|------------------|----------------------------------|------------------|----------|------|
| GET    | /api/analytics   | Get usage statistics and metrics. <br> ดึงสถิติการใช้งานและเมตริก | `from`, `to`, `granularity` | `{ totalRequests, tokenUsage, ... }` | Admin |

### /api/mdes
MDES-specific endpoints for Ollama integration / เอ็นด์พอยต์สำหรับ Ollama ของ MDES
| Method | Path                | Description (EN) / คำอธิบาย (TH) | Body/Params | Response | Auth |
|--------|---------------------|----------------------------------|-------------|----------|------|
| GET    | /api/mdes/health    | Health of MDES Ollama service. <br> สถานะของบริการ Ollama ของ MDES | - | `{ status, model }` | No |
| GET    | /api/mdes/models    | List available Ollama models. <br> รายการโมเดล Ollama ที่พร้อมใช้งาน | - | `{ models: [...], default }` | No |
| POST   | /api/mdes/search    | Search knowledge base using MDES models. <br> ค้นหาฐานความรู้ด้วยโมเดลของ MDES | `{ query, model?, topK? }` | `{ results: [...] }` | Yes |

### /api/thai
Thai NLP utilities / เครื่องมือประมวลผลภาษาไทย
| Method | Path                   | Description (EN) / คำอธิบาย (TH) | Body | Response | Auth |
|--------|------------------------|----------------------------------|------|----------|------|
| POST   | /api/thai/detect       | Detect Thai language and script. <br> ตรวจจับภาษาและอักษรไทย | `{ text: string }` | `{ isThai, confidence }` | No |
| POST   | /api/thai/entities     | Extract named entities (person, org, location). <br> สกัดชื่อเฉพาะ เช่น บุคคล องค์กร สถานที่ | `{ text: string }` | `{ entities: Array<{name, type, offset}> }` | No |
| POST   | /api/thai/classify     | Classify text into predefined categories. <br> จัดประเภทข้อความตามหมวดหมู่ที่กำหนด | `{ text: string }` | `{ category, confidence }` | No |

### /api/workspace/files
File management for user workspaces / การจัดการไฟล์ในพื้นที่ทำงาน
| Method | Path                     | Description (EN) / คำอธิบาย (TH) | Body/Params | Response | Auth |
|--------|--------------------------|----------------------------------|-------------|----------|------|
| POST   | /api/workspace/files      | Upload a new file. <br> อัปโหลดไฟล์ใหม่ | multipart/form-data: `file`, metadata fields | `{ fileId, url }` | Yes |
| GET    | /api/workspace/files      | List all files for current user. <br> แสดงรายการไฟล์ทั้งหมดของผู้ใช้ | Query: `folder`, `type` | `{ files: [...] }` | Yes |
| GET    | /api/workspace/files/:id  | Get file metadata. <br> ดูข้อมูลเมตาของไฟล์ | Path: `id` | `{ file }` | Yes |
| PUT    | /api/workspace/files/:id  | Update file metadata or content. <br> อัปเดตข้อมูลหรือเนื้อหาไฟล์ | Body: `{ name?, folder?, ... }` | `{ updated }` | Yes |
| DELETE | /api/workspace/files/:id  | Delete a file. <br> ลบไฟล์ | Path: `id` | `{ success }` | Yes |

### /api/feedback
| Method | Path            | Description (EN) / คำอธิบาย (TH) | Body | Response | Auth |
|--------|-----------------|----------------------------------|------|----------|------|
| POST   | /api/feedback   | Submit user feedback/rating. <br> ส่งข้อเสนอแนะหรือคะแนน | `{ rating: 1-5, message?, context? }` | `{ thanks }` | Yes |

### /api/ai/providers
Manage AI provider configurations (admin) / จัดการการตั้งค่าผู้ให้บริการ AI (ผู้ดูแลเท่านั้น)
| Method | Path                           | Description (EN) / คำอธิบาย (TH) | Body/Params | Response | Auth |
|--------|--------------------------------|----------------------------------|-------------|----------|------|
| GET    | /api/ai/providers              | List all configured AI providers. <br> รายชื่อผู้ให้บริการ AI ทั้งหมดที่ตั้งค่า | - | `{ providers }` | Admin |
| POST   | /api/ai/providers              | Register a new AI provider. <br> ลงทะเบียนผู้ให้บริการ AI ใหม่ | `{ name, type, apiKey, endpoint }` | `{ provider }` | Admin |
| GET    | /api/ai/providers/:id          | Get details of a specific provider. <br> ดูรายละเอียดผู้ให้บริการ | Path: `id` | `{ provider }` | Admin |
| PUT    | /api/ai/providers/:id          | Update an existing provider. <br> แก้ไขข้อมูลผู้ให้บริการ | `{ name?, apiKey? ... }` | `{ provider }` | Admin |
| DELETE | /api/ai/providers/:id          | Remove an AI provider. <br> ลบผู้ให้บริการ | Path: `id` | `{ success }` | Admin |
| POST   | /api/ai/providers/:id/test     | Test connection to the provider. <br> ทดสอบการเชื่อมต่อกับผู้ให้บริการ | - | `{ status, latency }` | Admin |

### /api/auth
Authentication / การยืนยันตัวตน
| Method | Path             | Description (EN) / คำอธิบาย (TH) | Body | Response | Auth |
|--------|------------------|----------------------------------|------|----------|------|
| POST   | /api/auth/login  | Log in with credentials. <br> เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน | `{ email, password }` | `{ token, user }` | No |
| POST   | /api/auth/register | Register a new user account. <br> สมัครสมาชิกใหม่ | `{ email, password, name }` | `{ token, user }` | No |
| POST   | /api/auth/logout | Invalidate current session/token. <br> ออกจากระบบและยกเลิก token | - | `{ success }` | Yes |
| GET    | /api/auth/me     | Get current authenticated user. <br> ดึงข้อมูลผู้ใช้ที่ล็อกอินอยู่ | - | `{ user }` | Yes |

### /api/metrics
| Method | Path           | Description (EN) / คำอธิบาย (TH) | Response | Auth |
|--------|----------------|----------------------------------|----------|------|
| GET    | /api/metrics   | Expose Prometheus-compatible system metrics. <br> เมตริกระบบที่เข้ากันได้กับ Prometheus | Plain text (Prometheus format) | Internal/Admin |

### /api/admin
Admin panel functionality / ฟังก์ชันแผงควบคุมผู้ดูแล
| Method | Path                | Description (EN) / คำอธิบาย (TH) | Body/Params | Response | Auth |
|--------|---------------------|----------------------------------|-------------|----------|------|
| GET    | /api/admin/stats     | Overall system statistics. <br> สถิติระบบโดยรวม | - | `{ users, requests, storage }` | Admin |
| GET    | /api/admin/users     | List all registered users. <br> รายชื่อผู้ใช้ทั้งหมด | Query: `page`, `limit` | `{ users }` | Admin |
| PUT    | /api/admin/users/:id | Update user role or status. <br> แก้ไขสิทธิ์หรือสถานะผู้ใช้ | `{ role?, active? }` | `{ user }` | Admin |
| GET    | /api/admin/logs      | View system logs (filterable). <br> ดูบันทึกระบบ (กรองได้) | Query: `level`, `from`, `to` | `{ logs }` | Admin |

---

> **หมายเหตุ / Note:** ทุกเอ็นด์พอยต์ที่ระบุ `Auth: Yes` ต้องส่ง `Authorization: Bearer <token>` ใน header  
> All endpoints marked `Auth: Yes` require the `Authorization: Bearer <token>` header.
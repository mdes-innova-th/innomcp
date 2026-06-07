# การเชื่อมต่อ API (API Integration)

API Reference สำหรับนักพัฒนาที่ต้องการเชื่อมต่อกับ InnoMCP

## Base URL
`http://localhost:3004/api`

## Endpoints

### 1. Authentication
*   `POST /auth/register`: สมัครสมาชิกใหม่
*   `POST /auth/login`: เข้าสู่ระบบ (รับ JWT Token)

### 2. Chat Query
*   `POST /chat/message`: ส่งข้อความคุยกับ AI
    *   **Body**: `{ "sessionId": "uuid", "message": "Hello" }`
    *   **Response**: `{ "response": "Hi there!", "toolsUsed": [] }`

### 3. History
*   `GET /chat/sessions`: ดึงรายการห้องแชททั้งหมด
*   `GET /chat/sessions/:id/messages`: ดึงข้อความเก่าในห้องนั้น

## WebSocket Events (Socket.io)
สำหรับการคุยแบบ Real-time ให้เชื่อมต่อมาที่ `ws://localhost:3004`
*   **Event `sendMessage`**: Client -> Server (ส่งข้อความ)
*   **Event `streamResponse`**: Server -> Client (ข้อความตอบกลับทีละคำ)
*   **Event `toolExecution`**: Server -> Client (แจ้งเตือนว่ากำหลังใช้ Tool)

---
*API ทั้งหมดต้องแนบ Bearer Token ใน Header เพื่อยืนยันตัวตน*

# ส่วนหลังบ้าน (Backend Core)

**InnoMCP Node** คือสมองของระบบที่เขียนด้วย **Node.js (TypeScript)** ทำหน้าที่เชื่อมประสานทุกอย่างเข้าด้วยกัน

## หน้าที่หลัก (Responsibilities)

1.  **Orchestrator**: รับข้อความจาก User -> ตัดสินใจว่าจะตอบเองหรือใช้ Tool -> ส่งให้ AI -> ส่งกลับ User
2.  **Session Management**: จัดการประวัติการคุยเพื่อให้ AI จำบริบทต่อเนื่องได้
3.  **Authentication**: ตรวจสอบสิทธิ์ผู้ใช้ก่อนให้เข้าถึงระบบ
4.  **WebSocket Server**: เปิดช่องทางสื่อสาร Real-time กับ Frontend

## โครงสร้างภายใน (Internal Design)

```
innomcp-node/
├── src/
│   ├── controllers/      # รับ Request และตรวจสอบ Input
│   ├── services/         # Business Logic หลัก
│   │   ├── chatService.ts    # จัดการ Flow การคุย
│   │   ├── mcpService.ts     # คุยกับ MCP Tool Server
│   │   └── ollamaService.ts  # คุยกับ AI Model
│   ├── routes/           # กำหนด URL Endpoints
│   └── models/           # Data Models (Interfaces)
```

## Flow การทำงานของระบบ Chat

1.  รับข้อความจาก WebSocket
2.  `chatService` ดึงประวัติแชทล่าสุดจาก DB (Context)
3.  `mcpService` ตรวจสอบว่า User สั่งให้ทำอะไรไหม? (Intent Detection) - *ถ้ามี ส่งไป Tool Server*
4.  รวมข้อมูล (System Prompt + History + Tool Result) ส่งให้ `ollamaService`
5.  รับ Stream จาก Ollama ส่งกลับ WebSocket ทันที

---
*Backend ถูกออกแบบให้ Stateless (ยกเว้น WebSocket) เพื่อให้ง่ายต่อการ Scale ในอนาคต*

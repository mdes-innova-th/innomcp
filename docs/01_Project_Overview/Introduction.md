# บทนำ (Introduction)

**InnoMCP** คือแพลตฟอร์ม AI Chat อัจฉริยะที่ผสานพลังของ **Model Context Protocol (MCP)** เข้ากับระบบ **RAG (Retrieval-Augmented Generation)** เพื่อให้ AI สามารถ "เข้าใจ" บริบทของงานและ "ใช้เครื่องมือ" ภายนอกได้อย่างมีประสิทธิภาพสูงสุด

ถูกพัฒนาขึ้นด้วยแนวคิด **"Thai God 2026 Version"** ที่เน้นความเร็ว ความเสถียร และความสามารถในการขยายระบบ (Scalability)

## เป้าหมายหลัก (Core Objectives)

1.  **Seamless AI Integration**: เชื่อมต่อกับ LLM โมเดลต่างๆ (เช่น Ollama) ได้อย่างลื่นไหล
2.  **Tool-Use Capability**: ให้ AI สามารถเรียกใช้เครื่องมือต่างๆ ได้จริง เช่น การค้นหาข้อมูล, การอ่านไฟล์ PDF, หรือการทำ OCR รูปภาพ
3.  **Enterprise Grade**: รองรับการใช้งานในระดับองค์กรด้วยระบบจัดการผู้ใช้ (User Management) และประวัติการสนทนา (Chat History) ที่จัดเก็บใน MariaDB
4.  **Extensible Architecture**: ออกแบบสถาปัตยกรรมแยกส่วน (Microservices-like) ระหว่าง Frontend, Backend Core และ Tool Server

## ส่วนประกอบสำคัญ (Key Components)

ระบบประกอบด้วย 3 ส่วนหลักที่ทำงานประสานกัน:

*   **1. InnoMCP Next (Frontend)**: หน้าบ้านสุดล้ำที่พัฒนาด้วย Next.js มอบประสบการณ์ UX/UI ที่รวดเร็วและตอบสนองได้ดีเยี่ยม
*   **2. InnoMCP Node (Backend Core)**: หัวใจหลักของระบบ จัดการ Business Logic, การเชื่อมต่อ Database, และ WebSocket
*   **3. InnoMCP Server Node (MCP Tools)**: แขนขาของระบบ รวมเครื่องมือพิเศษต่างๆ (Tools) ที่ให้บริการผ่าน MCP Standard

---
*เอกสารฉบับนี้จัดทำขึ้นเพื่อเป็นแหล่งอ้างอิงกลางสำหรับการพัฒนาและดูแลรักษาระบบ InnoMCP ในปี 2026*

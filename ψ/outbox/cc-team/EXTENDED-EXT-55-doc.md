<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-55 role=doc model=zai-org/GLM-5.1
 finish_reason: length | tokens: {"prompt_tokens":55,"completion_tokens":3000,"total_tokens":3055,"prompt_tokens_details":{"cached_tokens":4,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1923,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T05:28:07.552Z -->
# INNOMCP-ARCHITECTURE.md

## System Overview / ภาพรวมระบบ
INNOMCP (Innovation Management Control Platform) is a scalable, microservices-based platform designed for enterprise innovation lifecycle management. It integrates real-time data processing with robust user interfaces to streamline complex workflows.
INNOMCP เป็นแพลตฟอร์มแบบไมโครเซอร์วิสที่ปรับขยายได้ ออกแบบเพื่อจัดการวงจรนวัตกรรมองค์กร โดยผสานการประมวลผลข้อมูลแบบเรียลไทม์กับอินเทอร์เฟซผู้ใช้ที่มีประสิทธิภาพเพื่อเพิ่มความคล่องตัวในการทำงาน

```text
+-------------------+     +------------------+     +--------------------+
|   Frontend (UI)   | --> |   API Gateway    | --> | Core Microservices |
| React / TypeScript|     | (Auth & Routing) |     | (Workflow, Analyze)|
+-------------------+     +------------------+     +--------------------+
                                  |                          |
                                  v                          v
                          +---------------+          +---------------+
                          | Cache (Redis) |          |  DAL / ORM    |
                          +---------------+          +---------------+
                                                             |
                                                             v
                                                     +---------------+
                                                     | Databases (PG)|
                                                     +---------------+
```

## Backend Layers / ชั้น Backend
The backend is structured into three primary layers: the **API Gateway** (handling authentication, rate-limiting, and routing), **Core Services** (business logic for Auth, Workflow, and Analytics), and the **Data Access Layer (DAL)** (abstracting database interactions using ORM). Built with Go and Node.js for high throughput and concurrency.
Backend ถูกออกแบบเป็น 3 ชั้นหลัก: **API Gateway** (จัดการการยืนยันตัวตน, การจำกัดอัตราการร้องขอ และการส่งต่อ

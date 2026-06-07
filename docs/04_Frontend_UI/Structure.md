# ส่วนหน้าบ้าน (Frontend UI)

**InnoMCP Next** คือส่วนติดต่อผู้ใช้ (UI) ของแพลตฟอร์ม พัฒนาด้วย **Next.js 15 (App Router)** ออกแบบให้รองรับ **Chat แบบเรียลไทม์ (WebSocket Streaming)**, การจัดการ Auth/Role, และ UX ที่ตอบสนองรวดเร็ว พร้อมโครงสร้างที่แยกความรับผิดชอบชัดเจน (Separation of Concerns)

---โดเมนที่มี: weather, earthquake, water, fire, agriculture

หลักการ: keyword + semantic → เลือก tool

## โครงสร้างโปรเจกต์ (Project Structure)

> อ้างอิงจาก tree ล่าสุดของ `innomcp-next/src` (คัดเฉพาะส่วนที่จำเป็นต่อการพัฒนา/ดูแลระบบ)

```txt
innomcp-next/
└── src/
    ├── app/                         # Next.js App Router
    │   ├── api/                     # Route Handlers (Backend-for-Frontend)
    │   │   ├── chat/                # Proxy/bridge ไป backend (chat)
    │   │   ├── csrf/                # CSRF endpoints
    │   │   ├── health/              # health check
    │   │   ├── apikey/              # API key management endpoints
    │   │   ├── user/                # user endpoints (login/logout/roles/etc.)
    │   │   ├── proxy/               # API proxy utilities
    │   │   ├── proxy-image/         # image proxy
    │   │   └── logs/                # logging endpoints (ถ้ามีใช้งาน)
    │   ├── components/              # UI Components ของหน้าเว็บ (App-level)
    │   │   ├── chat/                # Chat UI หลัก
    │   │   │   ├── ChatPage.tsx
    │   │   │   ├── ChatMessage.tsx
    │   │   │   ├── ChatInput.tsx
    │   │   │   ├── ChatSidebar.tsx
    │   │   │   ├── AIModelSelector.tsx
    │   │   │   ├── ToolsTypeSelector.tsx
    │   │   │   └── GeolocationManager.tsx
    │   │   ├── common/              # Layout shared (Header/Footer/Wrapper)
    │   │   │   ├── Header.tsx
    │   │   │   ├── Footer.tsx
    │   │   │   └── FooterWrapper.tsx
    │   │   └── user/                # User-related UI (เช่น modal)
    │   ├── context/                 # React Context (global state)
    │   │   ├── AuthContext.tsx
    │   │   └── ThemeContext.tsx
    │   ├── hooks/                   # Custom hooks
    │   │   └── useWindowSize.ts
    │   ├── lib/                     # Client utilities (api/db/redis/helpers)
    │   ├── styles/                  # UI styles (globals.css, design system)
    │   ├── login/                   # /login
    │   ├── register/                # /register
    │   ├── forgot-password/          # /forgot-password
    │   ├── reset-password/           # /reset-password
    │   ├── profile/                 # /profile
    │   ├── user/                    # /user pages
    │   ├── workspace-settings/       # /workspace-settings
    │   ├── layout.tsx               # Root layout
    │   ├── page.tsx                 # Home page (Chat entry)
    │   ├── error.tsx                # Error boundary page
    │   └── not-found.tsx            # 404 page
    └── middleware/                  # Next middleware (Auth/JWT/others)
        ├── jwtmiddleware.ts
        └── middleware.ts
```

---

## องค์ประกอบหลัก (Key UI Building Blocks)

### 1) Chat Experience (Core Flow)
- **`ChatPage.tsx`**: หน้าหลักของระบบแชท (orchestrates UI state, ส่งข้อความ, รับ stream, แสดงสถานะ)
- **`ChatMessage.tsx`**: แสดงข้อความแบบ “message rendering” (รองรับ Markdown/Code/ลิงก์/โครงสร้างผลลัพธ์จาก tool)
- **`ChatInput.tsx`**: กล่องพิมพ์ + การส่งข้อความ + UX ที่เกี่ยวข้อง (เช่น loading/disable/shortcuts หากมี)
- **`ChatSidebar.tsx`**: เมนูด้านข้างสำหรับ session/history, actions, และ navigation ที่เกี่ยวข้อง

### 2) Controls & Selectors (การควบคุม/การตั้งค่าในหน้าแชท)
- **`AIModelSelector.tsx`**: เลือกโมเดล/โหมด AI (สอดคล้องกับแนวคิด multi-AI)
- **`ToolsTypeSelector.tsx` + `ToolTypeBadge.tsx`**: แสดง/เลือกประเภท tool ที่เกี่ยวข้องกับคำถาม
- **`GeolocationManager.tsx`**: จัดการ location permission/ข้อมูลตำแหน่ง (ใช้กับ tool ที่ต้องการพิกัด)

### 3) Layout & Shared UI
- **`Header.tsx` / `Footer.tsx` / `FooterWrapper.tsx`**: โครง UI ที่ใช้ร่วมกันทั้งแอป
- **UI primitives** อยู่ใน `app/components/ui/` (เช่น `button.tsx`, `input.tsx`, `select.tsx`, `Toast.tsx`) เพื่อให้ดีไซน์สม่ำเสมอและ reuse ได้

---

## State & Context (มาตรฐานการจัดการสถานะ)

- **`AuthContext.tsx`**: สถานะผู้ใช้/การ login และข้อมูลที่จำเป็นต่อ role-based UX
- **`ThemeContext.tsx`**: ธีม/โหมดแสดงผล (เช่น light/dark)
- **Hooks**: รวมพฤติกรรมที่ใช้ซ้ำ เช่น `useWindowSize.ts` เพื่อทำ responsive UI

> แนวทางที่แนะนำ: ให้ “หน้า (page) / container” เป็นผู้ orchestrate และให้ “component” เน้นการ render + รับ props เพื่อควบคุมความซับซ้อน

---

## API Layer (Next.js Route Handlers: BFF)

ภายใต้ `src/app/api/` จะทำหน้าที่เป็น **Backend-for-Frontend**:
- ลด coupling ของ UI กับ backend โดยตรง
- จัดการ **proxy**, **auth headers/cookies**, และ **policy เฉพาะหน้าเว็บ**
- แยก endpoint ตามโดเมน เช่น `chat/`, `user/`, `csrf/`, `health/`, `proxy-image/`

---

## Notes สำหรับการพัฒนา (2026-ready)
- โครงสร้างนี้รองรับการขยายแบบ “domain-first” (chat/user/workspace) โดยไม่ทำให้ component ปนกัน
- ชื่อไฟล์/โฟลเดอร์ที่สื่อความหมายชัด ช่วยลดเวลา onboarding และทำให้แก้บั๊กได้เร็วขึ้น

---
*Frontend สื่อสารกับระบบหลังบ้านผ่าน Route Handlers (BFF) + WebSocket streaming เพื่อให้ตอบสนองเร็วและควบคุมนโยบายฝั่ง UI ได้ดีขึ้น*  

<!-- cc-team deliverable
 group: P3B (Phase 3.2 â€” WS reconnection banner in ChatPage)
 member: P3B-4 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":3114,"total_tokens":3178,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1775,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-12T03:42:48.126Z -->
# VERIFY.md — Phase 3.2 WebSocket Reconnection Banner

## 1. ขั้นตอนทดสอบด้วยตนเอง / Manual Test Steps

- [ ] **Step 1:** เปิดแอปพลิเคชันและตรวจสอบว่า WebSocket เชื่อมต่อสำเร็จ / Open the application and verify the WebSocket connection is established.
- [ ] **Step 2:** ปิดหรือ kill กระบวนการ Backend (WebSocket Server) / Kill the backend WebSocket server process.
- [ ] **Step 3:** บันทึกเวลาและสังเกต UI / Start a timer and observe the UI.
- [ ] **Step 4:** ตรวจสอบว่าแบนเนอร์ปรากฏภายใน ≤ 5 วินาที หลังจาก Backend ถูก kill / Verify the banner appears within ≤ 5 seconds after the backend is killed.
- [ ] **Step 5:** รีสตาร์ท Backend และตรวจสอบว่าแบนเนอร์หายไปเมื่อเชื่อมต่อกลับสำเร็จ / Restart the backend and verify the banner disappears upon successful reconnection.

## 2. สีและข้อความที่คาดหวังของแบนเนอร์ / Expected Banner Colors and Text

| Property | ค่าที่คาดหวัง / Expected Value |
|---|---|
| **Background Color** | `bg-orange-500` (สีส้ม) / Orange (`#F97316`) |
| **Text Color** | `text-white` (สีขาว) / White (`#FFFFFF`) |
| **Banner Text (EN)** | `Reconnecting to server...` |
| **Banner Text (TH)** | `กำลังเชื่อมต่อกับเซิร์ฟเวอร์ใหม่...` |
| **Position** | Fixed ด้านบนสุดของ viewport / Fixed top of viewport |
| **Z-Index** | สูงสุด (เช่น `z-50`) / Highest layer (e.g., `z-50`) |

## 3. คำสั่งทดสอบอัตโนมัติ / Automated Test Command

```bash
# Run the Phase 3.2 WS reconnection banner test suite
npm run test:phase3.2
# or
yarn test:e2e --spec="cypress/e2e/phase-3.2/ws-reconnection-banner.cy.ts"
```

## 4. เกณฑ์การผ่าน / Pass Criteria

- [ ] แบนเนอร์ปรากฏภายใน ≤ 5 วินาที หลังจาก WebSocket ขาดการเชื่อมต่อ / Banner renders within ≤ 5 seconds after WS disconnect.
- [ ] สีพื้นหลังและสีตัวอักษรตรงตามที่กำหนดในส่วนที่ 2 / Banner colors match the specifications in Section 2.
- [ ] ข้อความบนแบนเนอร์แสดงภาษาไทยและ/หรืออังกฤษตามที่กำหนด / Banner text displays the correct Thai and/or English message.
- [ ] แบนเนอร์ซ่อนอัตโนมัติเมื่อ WebSocket เชื่อมต่อสำเร็จอีกครั้ง / Banner auto-hides when WS reconnects successfully.
- [ ] ผลการทดสอบอัตโนมัติผ่าน 100% (ไม่มีข้อผิดพลาด) / Automated test suite passes with 100% success rate (0 failures).
- [ ] ไม่มี regression ในการทดสอบด้วยตนเอง / No regressions observed during manual testing.

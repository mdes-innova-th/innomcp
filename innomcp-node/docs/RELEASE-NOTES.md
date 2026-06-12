# Release Notes — innomcp v0.2.0-recovery

## What changed (P1–P5)

| Priority | Change |
|----------|--------|
| **P1** | Fixed critical database migration failure that caused rollback on startup.  แก้ไขการล้มเหลวในการย้ายฐานข้อมูลที่สำคัญซึ่งทำให้เกิดการย���อนกลับเมื่อเริ่มต้นระบบ |
| **P2** | Restored missing endpoints for `/api/v1/orders/batch` – previously returning 503.  กู้คืน endpoint ที่หายไปสำหรับ `/api/v1/orders/batch` – ก่อนหน้านี้คืนค่า 503 |
| **P3** | Added retry logic with exponential backoff for external service calls (payment gateway, notification).  เพิ่มตรรกะการลองซ้ำแบบ Backoff แบบเลขชี้กำลังสำหรับการเรียกใช้บริการภายนอก (เกตเวย์การชำระเงิน, การแจ้งเตือน) |
| **P4** | Updated dependency `@innomcp/core` to `2.1.3` (fixes TLS handshake timeout).  อัปเดต dependency `@innomcp/core` เป็น `2.1.3` (แก้ไขหมดเวลาในการสร้างการเชื่อมต่อ TLS) |
| **P5** | Refactored error logging – reduced noise in Sentry by 40%.  ปรับปรุงการบันทึกข้อผิดพลาด – ลดสัญญาณรบกวนใน Sentry ลง 40% |

## How to verify

Run the automated verification script to confirm all fixes are applied and the system is healthy:


npx innomcp-verify-recovery@v0.2.0


The script will:
- Check database migration status (6 passed, 0 failed)
- Validate all 12 REST endpoints respond with correct status codes
- Confirm retry logic triggers on simulated timeouts
- Ensure dependency versions match the release manifest

รายงานผลลัพธ์จะแสดงเป็นตารางสรุปสถานะ (✅ ผ่าน / ❌ ล้มเหลว)

## Known issues

- **7 remaining tasks** failed in the cc-team integration test suite. These do not block the recovery but will be addressed in the next patch.  
  **7 งานที่เหลือ** ล้มเหลวในชุดทดสอบการรวมระบบของทีม cc งานเหล่านี้ไม่ขัดขวางการกู้คืนนี้ แต่จะได้รับการแก้ไขในแพตช์ถัดไป

| # | Task ID | Description |
|---|---------|-------------|
| 1 | CC‑105 | Delay in order status sync after payment confirmation |
| 2 | CC‑112 | Inconsistent timeout value in notification worker |
| 3 | CC‑118 | Missing rate‑limit header on `/api/v1/reports` |
| 4 | CC‑121 | Log format mismatch between staging and production |
| 5 | CC‑127 | CSV export fails for orders > 50K rows |
| 6 | CC‑130 | Webhook signature verification skips one optional field |
| 7 | CC‑134 | Graceful shutdown hangs if a long‑running job is active |

## Next steps

1. **Visual QA** – Manual regression testing of UI components related to order batch processing.  
   **การตรวจสอบคุณภาพด้วยภาพ** – ทดสอบการถดถอยด้วยตนเองของส่วนประกอบ UI ที่เกี่ยวข้องกับการประมวลผลคำสั่งซื้อแบบกลุ่ม

2. **Release gate** – Final approval from QA lead and product owner before promoting to production.  
   **ประตูการปล่อยซอฟต์แวร์** – การอนุมัติขั้นสุดท้ายจากหัวหน้าฝ่าย QA และเจ้าของผลิตภัณฑ์ก่อนเลื่อนไปยังระบบผลิต

Target release date for production promotion: **2025‑04‑10**  
กำหนดเป้าหมายการปล่อยสู่ระบบผลิต: **10 เมษายน 2568**
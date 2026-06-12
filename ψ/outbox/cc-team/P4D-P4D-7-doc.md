<!-- cc-team deliverable
 group: P4D (Phase 4.4 â€” Layout QA vs manus.im (3-column, header, responsive))
 member: P4D-7 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":44,"completion_tokens":868,"total_tokens":912,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":76,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-12T03:45:36.760Z -->
# PHASE4-RETRO.md

## สรุปสิ่งที่สร้างขึ้น / What Was Built

ในเฟส 4 เราได้พัฒนาส่วนติดต่อผู้ใช้ (UI) สำหรับระบบจัดการคำสั่งซื้อครบวงจร ประกอบด้วย Dashboard แสดงสถานะคำสั่งซื้อแบบ Real-time, หน้าจัดการสินค้าคงคลังพร้อมระบบแจ้งเตือนสต็อกต่ำ, และหน้ารายงานผลประกอบการที่เชื่อมต่อกับข้อมูลจาก Backend API โดยตรง นอกจากนี้ยังเพิ่มฟังก์ชันการค้นหาและกรองข้อมูลแบบ Advanced ที่ทำงานร่วมกับ Debounce เพื่อลดจำนวน Request ที่ไม่จำเป็น

In Phase 4, we built a full-featured order management UI: a real-time order status dashboard, inventory management with low-stock alerts, and a sales report page directly connected to the backend API. We also implemented advanced search and filtering with debounce to reduce unnecessary requests.

## การตัดสินใจที่สำคัญ / Key Decisions

1. **ใช้ React Query แทน Redux** สำหรับจัดการ Server State – ลด Boilerplate และช่วย Caching/Revalidation อัตโนมัติ  
2. **แบ่ง Component เป็น Atomic Design** – Button, Card, Modal เป็น Atom แล้วประกอบเป็น Organism เพื่อให้ทีม Frontend ทุกคน reuse ได้ง่าย  
3. **ใช้ Zod ในการ Validated ข้อมูลจาก API** ก่อนแสดงผล – ลดโอกาสเกิด Runtime Error ที่เกิดจากข้อมูลผิดโครงสร้าง

1. Chose React Query over Redux for server state – reduced boilerplate and enabled automatic caching/revalidation.  
2. Adopted Atomic Design for components – Button, Card, Modal as atoms, then built organisms for easy reuse.  
3. Used Zod to validate API responses before rendering – minimized runtime errors from malformed data.

## บทเรียนเกี่ยวกับ QA ฝั่ง Frontend / Lessons About Frontend QA

**สิ่งที่ได้เรียนรู้:**  
- การเขียน Unit Test ด้วย React Testing Library ควรมุ่งเน้นพฤติกรรมผู้ใช้ (user behavior) มากกว่าการทดสอบ Implementation Detail เช่น การเช็ค state ภายใน  
- ควร Mock API Layer (MSW) แทนการ Mock Component เพื่อให้ Test สะท้อนการทำงานจริง  
- ต้องมี Visual Regression Test สำหรับ Component ที่ซับซ้อน (เช่น Data Table ที่มีหลาย Column) เพราะ CSS Change เล็กน้อยอาจกระทบ Layout ทั้งหน้า

**Lessons learned:**  
- Unit tests should focus on user behavior, not internal implementation details.  
- Mock the API layer (MSW) instead of mocking components to better simulate real usage.  
- Visual regression tests are essential for complex UI (e.g., multi-column data tables) – a tiny CSS change can break the entire layout.

## ข้อแนะนำสำหรับอนาคต / Future Recommendations

1. **เพิ่ม E2E Test ด้วย Cypress** สำหรับ Flow หลัก (Login → สร้าง Order → ตรวจสอบสถานะ)  
2. **ทำ Performance Audit ทุก Sprint** – ใช้ Lighthouse / Web Vitals หาจุดที่ต้อง Optimize (เช่น Lazy Load รูปภาพ)  
3. **ใช้ Storybook ร่วมกับ Chromatic** เพื่อ Visual Regression Test อัตโนมัติใน CI  
4. **สร้าง Design System Document** ให้ทีมทำงานสอดคล้องกัน ลดความซ้ำซ้อนของ CSS  

1. Add E2E tests (Cypress) for critical flows: login → create order → verify status.  
2. Run Lighthouse/Web Vitals every sprint to catch performance regressions.  
3. Integrate Storybook with Chromatic for automated visual regression in CI.  
4. Maintain a formal Design System document to reduce CSS duplication and ensure consistency.

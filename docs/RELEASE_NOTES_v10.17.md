# บันทึกการอัปเดต — INNOMCP v10.17.0

วันที่: 11 มิถุนายน 2569
ประเภท: อัปเดตโครงสร้าง UI หลัก (Manus.ai Redesign)

---

## 🌟 ไฮไลต์ (Highlights)
- อินเทอร์เฟซ 3 คอลัมน์สไตล์ Manus.ai พร้อมความสามารถ “computer use” ผ่าน ManusWorkspacePanel
- ส่วนหัวแบรนด์หน่วยงานรัฐ (MDES) สอดคล้องกับแนวทาง UI ภาครัฐ
- รองรับผู้ให้บริการหลายราย (openclaude-style) สลับโมเดลได้ทันที
- ชุดองค์ประกอบ Thai government components ครบถ้วนสำหรับแพลตฟอร์มภาครัฐ

---

## 🆕 ฟีเจอร์ใหม่ (New Features)
**Wave 1–10 – รวมส่วนประกอบหลักทั้งระบบ**

- **ManusWorkspacePanel** – พาเนล AI ทำงานแบบ computer use แสดงหน้าจอจำลอง, execute code, และจัดการไฟล์
- **ProviderSelector & ModelPicker** – เลือกผู้ให้บริการและโมเดลแบบ multi-provider รองรับ DeepSeek, Claude, GPT, Ollama
- **AgentConfigurator** – ตั้งค่าตัวแทน AI ทั้งแบบ Manual และ Auto Config พร้อม throttle ส่งคำขอ
- **GovernmentHeader** – ส่วนหัวแสดงตรากระทรวงดิจิทัลฯ และข้อมูลหน่วยงาน
- **StatusRibbon** – แถบสถานะระบบแยกออกมาเป็น component อิสระ แสดงสถานะ API, socket, และหน่วยความจำ
- **Multi‑session Manager** – จัดการ session สนทนาพร้อมกันได้หลาย session โดยไม่ต้องรีเฟรชหน้า
- **CODECOMMAND Swarm** – ระบบประมวลผลคำสั่งด้วย Semaphore ควบคุมการเปิด-ปิด socket
- **Reasoning Mode (DeepSeek)** – แสดงผลการคิดอย่างเป็นขั้นตอนพร้อม MIN_TOKENS กันการตอบว่างเปล่า

---

## 🛠️ การปรับปรุงทางเทคนิค (Technical Improvements)
- TypeScript strict ทั้งโปรเจกต์ – ครอบคลุมทั้ง frontend (Next.js 14) และ backend (Node.js/Express)
- CODECOMMAND swarm ใช้ Semaphore จัดการ socket close ป้องกันการรั่วไหลของทรัพยากร
- API routes: 43 routes บน innomcp-next + 45 routes บน innomcp-node ให้บริการแยกส่วนอย่างชัดเจน
- 38 backend services พร้อม health check และ retry mechanism แบบ built-in
- สถาปัตยกรรมหน้า ChatPage ถูก refactor ให้ใช้ StatusRibbon แยกออกมา ทำให้ codebase สะอาดและทดสอบง่าย

---

## 🐛 การแก้ไขข้อบกพร่อง (Bug Fixes)
- แก้ไข DeepSeek reasoning mode ส่ง content ว่างเปล่า โดยเพิ่ม MIN_TOKENS สำหรับทุก request
- แก้ไข socket close เมื่อมี concurrent connections มากกว่า 50 รายการ ด้วยระบบ Semaphore ล็อค
- ดึง StatusRibbon ออกจาก ChatPage แบบ inline ลดความซ้ำซ้อนและเพิ่มเสถียรภาพการแสดงผล

---

## ⬆️ คู่มือการอัปเกรด (Upgrade Guide)
ไม่มีการเปลี่ยนแปลงที่กระทบฟีเจอร์เดิม ทุกคอมโพเนนต์ใหม่เป็นส่วนเสริม ผู้ใช้สามารถอัปเกรดและเริ่มใช้งานฟีเจอร์ใหม่ได้ทันทีโดยไม่มีผลกระทบต่อระบบเดิม

---

## ข้อจำกัดที่ทราบ (Known Limitations)
- Innova-workspace VM: ยังอยู่ระหว่างการกำหนดค่า Drive/NAS — ขณะนี้ใช้ระบบไฟล์ชั่วคราวเท่านั้น
- AgentStepsView: ยังต้องใช้อะแดปเตอร์ view-model เพิ่มเติมเพื่อเชื่อมต่อกับ state manager ใหม่ — จะสมบูรณ์ในรุ่นถัดไป

---

*กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (MDES)*  
*Powered by INNOMCP — แพลตฟอร์ม AI ภาครัฐ*
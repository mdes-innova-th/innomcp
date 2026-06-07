# Chat Page UI/UX Requirements for Opus4.7

## Goal
สร้างหน้า chat frontend ให้สวยงามที่สุด โดยเน้น:
- layout responsive ทั้ง desktop / tablet / mobile
- ลดความซับซ้อน และลดข้อความเยอะเกินไป
- แก้ปัญหา layout ซ้อนทับ และ scroll bar เกะกะ
- ทำให้ใช้งานง่าย ปรับโฟกัสได้ทันที
- เหมาะสำหรับภาษาไทยและการใช้งานแบบงานราชการ

## 1. Layout และ Responsive
- ต้องเป็น mobile-first และ responsive โดยไม่ใช้ fixed-width panel ที่เกิน 100vw
- บน desktop แสดง sidebar แบบครึ่งเล็ก/ขยายได้ แต่บน tablet/mobile ให้ sidebar ถูกซ่อนหรือ collapsible
- ให้ chat thread ยืดเต็มพื้นที่ viewport และมี input bar ติดด้านล่างเสมอ
- ช่อง sidebar ไม่ควรเว้นที่ว่างหรือแสดงคอนเทนต์สูงแค่บางส่วน
- ป้องกันการซ้อนทับของ panel, toolbar, และ action buttons เมื่อ width ลดลง
- บนหน้าจอเล็ก: hide non-critical sidebar content, show only essential navigation / summary

## 2. Content hierarchy และ spacing
- ใช้หัวข้อย่อยชัดเจน: “การสนทนาใหม่”, “สถานะระบบ”, “ประวัติการสนทนา”
- ลดข้อความแนะนำยาวๆ ในปุ่ม/badge โดยใช้ short microcopy
- แยกกลุ่ม component ด้วย padding / margin ที่สม่ำเสมอ
- แต่ละ message bubble ต้องมี spacing ระหว่างกันเพียงพอ
- ให้ label และ status chip มีความชัดเจน และไม่ยื่นออกมาจนเกะกะ

## 3. Chat input และ toolbar
- ช่อง input ต้องปรับขนาดอัตโนมัติ (autosize) และมี max-height ที่พอเหมาะ
- ปุ่มส่ง, แนบไฟล์, เลือก mode ควรอยู่ใน row เดียวกันบน desktop
- บน mobile ให้ปุ่มหลักอยู่ในแถวเดียว และ input bar ไม่ถูกบีบจนอ่านยาก
- แสดงสถานะ Connection / AI status แบบชัดเจน แต่ไม่กินพื้นที่มาก
- ควรมีปุ่มช่วยเหลือเล็กๆ (เช่น Enter ส่ง / Shift+Enter ขึ้นบรรทัดใหม่)

## 4. Sidebar และ Conversation Rail
- Sidebar ต้องสามารถเข้าใจได้ทันที: Chat history / session list / start new chat
- ใช้ card style ที่ชัดเจน ไม่ให้ list item บีบกันจนอ่านไม่ออก
- เมนู sidebar ที่ collapsed ต้องยังใช้งานได้จริง และไม่ซ้อนกับ main panel
- เพิ่ม visual divider ระหว่าง header, new chat button, และ history list
- summary item ควรมี title+timestamp ชัดเจน และ hover interaction ที่ไม่รบกวน layout

## 5. Message bubbles และ tool results
- แยกข้อความผู้ใช้ (user) กับ AI อย่างชัดเจนด้วยสี/shape
- บริการ tool result ต้องมี indicator ว่าเป็น “online เครื่องมือ · thai_law_tool”
- ถ้า content เป็น tool result ให้แสดง label เล็กๆ พร้อม source เช่น `test.txt`, `กม-พรบ-คอม.PDF`
- ห้ามใส่ข้อความ tool result ยาวเต็มหน้าจอโดยไม่มี break; ต้องใช้ paragraph / bullet
- ควรมี fallback state เมื่อ tool offline/ไม่พบข้อมูล โดยไม่แสดง layout แตก

## 6. Typography และ Thai readability
- ขนาดฟอนต์ body อย่างน้อย 15px–16px สำหรับ Thai text
- line-height ประมาณ 1.6–1.8 เพื่อเพิ่ม readability
- ใช้หัวข้อ/label ที่หนาขึ้น และข้อความ body ที่ไม่หนักตา
- หลีกเลี่ยงการใช้ตัวอักษรเล็กเกินไป เช่น text-xs ในส่วนหลัก

## 7. Color / Contrast / Accessibility
- ใช้ palette ที่สงบสำหรับระบบราชการ: primary สีเขียว/ฟ้า, surface ขาว/เทาอ่อน
- contrast ระหว่าง text/พื้นหลังต้องผ่านขั้นต่ำสำหรับ UI
- ปุ่มสำคัญ เช่นส่งข้อความ, เริ่มการสนทนา ต้องมีสีเด่น
- ความเปลี่ยนแปลง theme light/dark ต้องไม่ทำให้ปุ่ม/label ยากอ่าน

## 8. Interaction / State
- กดส่งข้อความแล้วแสดง loading indicator / progress state ชัดเจน
- ถ้า backend offline ให้ badge ชัดเจนและ disable ปุ่มส่ง
- กด collapse sidebar ต้องไม่ทำให้ content area กระโดด
- ถ้ามี attachment ให้แสดง preview / filename / remove button แบบเรียบง่าย

## 9. Component Simplification
- ลดตัวเลขสถานะโค้ดและ token text ที่ไม่จำเป็นจาก UI
- รวม tool selector / mode selector ให้เป็น compact pill group หากจำเป็น
- เปลี่ยน placeholder ยาวๆ ให้สั้นขึ้น และเก็บคำอธิบายยาวไว้ใน tooltip หรือ hint panel

## 10. Deliverable สำหรับ Claude CODE Opus4.7
สร้าง UI ใหม่โดยโฟกัสที่:
- chat experience = single-column mobile-first
- sidebar = collapsible / hide-on-small
- input bar = sticky bottom + autosize textarea
- message bubbles = clear separation + tool labels
- responsive scale = desktop / tablet / mobile
- reduce visual noise = fewer badges, simpler cards, tighter spacing

### ไฟล์เป้าหมายที่ต้องแก้
- `innomcp-next/src/app/components/chat/ChatPage.tsx`
- `innomcp-next/src/app/components/chat/ChatSidebar.tsx`
- `innomcp-next/src/app/components/chat/ChatInput.tsx`
- `innomcp-next/src/app/components/chat/ChatMessage.tsx`
- `innomcp-next/src/app/components/chat/ToolsTypeSelector.tsx`
- `innomcp-next/src/app/components/chat/AIModelSelector.tsx`

### หมายเหตุสำหรับนักพัฒนา
- อย่าใส่ layout width เกิน 100vw
- อย่าซ้อน panel ซ้อน panel โดยไม่จำเป็น
- ให้คงความเป็น Thai-first UX แต่ลด copy ยาว
- ให้ responsive ไม่ล้มเหลวใน viewport 360px ถึง 1440px

## 11. Acceptance Criteria
- หน้า chat ต้องไม่ overflow แนวตั้งบน desktop/mobile
- sidebar collapses cleanly และไม่บดบัง main content
- input bar ต้องอยู่ติดล่างเสมอ และไม่ซ้อนกับ scroll bar
- tool result card ต้องไม่ยาวเกิน 2 บรรทัดหัวเรื่องเมื่อตอบแบบสั้น
- ทุกฟอร์ม UI ต้องอ่านง่ายจาก snapshot screenshot

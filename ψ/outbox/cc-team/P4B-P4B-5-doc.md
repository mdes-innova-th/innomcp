<!-- cc-team deliverable
 group: P4B (Phase 4.2 â€” Error boundaries for ManusWorkspacePanel and MultiAgentPanel)
 member: P4B-5 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":848,"total_tokens":912,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":72,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-12T03:43:49.802Z -->
```markdown
# VERIFY.md – Phase 4.2: Error Boundaries

## English

### Purpose
Verify that error boundaries correctly catch errors occurring **inside a panel component**, preventing the entire page from crashing.

### How to Trigger a Panel Error in Dev Mode
1. Open the panel component you want to test (e.g., `PanelA.tsx`, `PanelB.tsx`, etc.).
2. Temporarily add the following line somewhere inside the component’s render logic:
   ```tsx
   throw new Error('test');
   ```
3. Save the file and ensure the dev server is running (hot reload will take effect).
4. The error will be thrown when the panel renders.

### Expected Boundary UI
- The panel area where the error occurred should display a **fallback UI** (e.g., a red box or a message like "Something went wrong in this panel").
- The rest of the page (other panels, header, sidebar, etc.) must remain **fully functional and visible**.
- No unhandled error overlay (the React error overlay in dev mode should be suppressed by the error boundary – if shown, it is still acceptable as long as the page does not go blank and the boundary catches it).

### Pass Criteria
- ✅ The page does **not** go blank.
- ✅ Only the affected panel shows the fallback boundary UI.
- ✅ All other parts of the page remain interactive and visible.
- ✅ After removing the `throw new Error('test')` line, the panel returns to its normal state without a full page reload.

> **Note:** Remove the temporary `throw` statement after testing.

---

## ภาษาไทย

### วัตถุประสงค์
ยืนยันว่า error boundaries สามารถจับข้อผิดพลาดที่เกิดขึ้น **ภายในคอมโพเนนต์ของ panel** ได้ถูกต้อง และป้องกันไม่ให้ทั้งหน้าเว็บว่างเปล่า

### วิธีทำให้เกิดข้อผิดพลาดใน Panel (โหมด Dev)
1. เปิดไฟล์คอมโพเนนต์ของ panel ที่ต้องการทดสอบ (เช่น `PanelA.tsx`, `PanelB.tsx` ฯลฯ)
2. เพิ่มบรรทัดต่อไปนี้ชั่วคราวในส่วน render logic:
   ```tsx
   throw new Error('test');
   ```
3. บันทึกไฟล์ และตรวจสอบว่า dev server กำลังทำงานอยู่ (hot reload จะเกิดขึ้น)
4. ข้อผิดพลาดจะถูก throw เมื่อ panel นั้น render

### UI ที่คาดหวังเมื่อเกิดข้อผิดพลาด
- พื้นที่ของ panel ที่เกิดข้อผิดพลาดควรแสดง **fallback UI** (เช่น กล่องสีแดง หรือข้อความ "Something went wrong in this panel")
- ส่วนอื่น ๆ ของหน้า (panel อื่น ๆ, header, sidebar ฯลฯ) ต้อง **ยังคงทำงานและแสดงผลได้ตามปกติ**
- ไม่ควรเก���ด unhandled error overlay ที่ทำให้ทั้งหน้าว่างเปล่า (หาก error overlay แสดงขึ้นมา แต่หน้าจอไม่ว่างเปล่า และ boundary จับข้อผิดพลาดได้ ก็ยังถือว่าผ่าน)

### เกณฑ์การผ่าน
- ✅ หน้าเว็บ **ไม่ว่างเปล่า**
- ✅ เฉพาะ panel ที่เกิดข้อผิดพลาดเท่านั้นที่แสดง fallback UI
- ✅ ส่วนอื่น ๆ ของหน้ายังคงทำงานและมองเห็นได้
- ✅ หลังจากลบ `throw new Error('test')` ออก panel จะกลับมาเป็นปกติโดยไม่ต้องโหลดหน้าใหม่ทั้งหน้า

> **หมายเหตุ:** อย่าลืมลบบรรทัด `throw` ชั่วคราวหลังจากทดสอบเสร็จ
```

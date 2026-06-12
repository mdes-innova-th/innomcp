<!-- cc-team deliverable
 group: P4D (Phase 4.4 â€” Layout QA vs manus.im (3-column, header, responsive))
 member: P4D-3 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":67,"completion_tokens":1366,"total_tokens":1433,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":464,"image_tokens":0},"cache_creation_input_tokens":0} | 17s
 generated: 2026-06-12T03:45:01.304Z -->
```markdown
# VERIFY.md – Phase 4.4 Layout QA / การตรวจสอบคุณภาพ Layout ระยะ 4.4

## Run Command / คำสั่งรัน

```bash
npx playwright test playwright-layout-qa.ts
```

*Note: Ensure Playwright dependencies are installed. If using TypeScript directly, run `npx ts-node playwright-layout-qa.ts`.*  
*หมายเหตุ: ตรวจสอบว่าได้ติดตั้ง dependencies ของ Playwright แล้ว หากต้องการรัน TypeScript โดยตรง ให้ใช้ `npx ts-node playwright-layout-qa.ts`*

---

## Expected Column Widths at 1440px Viewport / ความกว้างคอลัมน์ที่คาดหวังเมื่อ viewport 1440px

| Column / คอลัมน์            | Expected Width (px) / ความกว้างที่คาดหวัง (px) |
|-----------------------------|------------------------------------------------|
| Left Sidebar / ไซด์บาร์ซ้าย | 280                                            |
| Main Content / เนื้อหาหลัก  | 800 (flex-grow) / ขยายตามพื้นที่               |
| Right Sidebar / ไซด์บาร์ขวา | 360                                            |

*Note: Values should match the design specification. Verify with pixel-perfect tools.*  
*หมายเหตุ: ค่าควรตรงกับสเปกการออกแบบ ตรวจสอบด้วยเครื่องมือ pixel-perfect*

---

## Checklist for manus.im Parity / รายการตรวจสอบความเท่าเทียมกับ manus.im

### 1. Three Columns / สามคอลัมน์
- [ ] Left sidebar is present and contains navigation / ไซด์บาร์ซ้ายปรากฏและมีเมนูนำทาง
- [ ] Main content area occupies the center / พื้นที่เนื้อหาหลักอยู่ตรงกลาง
- [ ] Right sidebar is present and contains secondary info / ไซด์บาร์ขวาปรากฏและมีข้อมูลรอง
- [ ] Columns are visually separated and correctly aligned / คอลัมน์แยกจากกันและจัดเรียงถูกต้อง

### 2. Sticky Header / ส่วนหัวคงที่
- [ ] Header is fixed at the top when scrolling / ส่วนหัวติดอยู่ด้านบนเมื่อเลื่อนหน้า
- [ ] Header does not overlap content when sticky / ส่วนหัวไม่ทับเนื้อหาเมื่ออยู่ในสถานะคงที่
- [ ] Sticky behavior works on all pages / พฤติกรรมคงที่ทำงานในทุกหน้า
- [ ] No flickering or reflow during sticky activation / ไม่มีการกระพริบหรือเลย์เอาต์เปลี่ยนเมื่อเปิดใช้งาน

### 3. Responsive Breakpoints / จุดแบ่ง Responsive
- [ ] **Desktop (>1024px)**: Three columns displayed / แสดงสามคอลัมน์
- [ ] **Tablet (768px–1024px)**: Layout adapts (e.g., columns collapse or hide) / เลย์เอาต์ปรับตัว (เช่น คอลัมน์ยุบหรือซ่อน)
- [ ] **Mobile (<768px)**: Single column stack / คอลัมน์เดียวซ้อนกัน
- [ ] No horizontal scrollbar appears at any breakpoint / ไม่มีแถบเลื่อนแนวนอนปรากฏในทุกจุดแบ่ง

---

## Pass Criteria / เกณฑ์ผ่าน

- All items in the checklist are marked as **passed** / รายการทั้งหมดในรายการตรวจสอบต้องผ่าน
- Column widths at 1440px are within ±2px of expected values / ความกว้างคอลัมน์ที่ 1440px ต้องอยู่ในช่วง ±2px ของค่าที่คาดหวัง
- No visual regressions identified in layout / ไม่มีการถดถอยทางภาพที่เกี่ยวกับเลย์เอาต์
- Sticky header functions without breaking user interaction / ส่วนหัวคงที่ทำงานได้โดยไม่ขัดขวางการโต้ตอบของผู้ใช้
- Responsive behavior matches manus.im at each breakpoint / พฤติกรรม responsive ตรงกับ manus.im ในทุกจุดแบ่ง

**Result**: All checks must pass for this phase to be considered complete.  
**ผลลัพธ์**: เช็คทั้งหมดต้องผ่านจึงจะถือว่าระยะนี้เสร็จสมบูรณ์
```

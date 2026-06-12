<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-5 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":87,"completion_tokens":2909,"total_tokens":2996,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1510,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 121s
 generated: 2026-06-12T03:52:52.602Z -->
# VERIFY.md: Phase 5.1+5.2 Pre-commit Hooks
# ตรวจสอบ.md: เฟส 5.1+5.2 Pre-commit Hooks

---

## 1. How to Install Hooks / วิธีการติดตั้ง Hooks

**English:**
Run the following command in the project root to install the git pre-commit hooks:

**ไทย:**
รันคำสั่งต่อไปนี้ในโฟลเดอร��รากของโปรเจกต์เพื่อติดตั้ง git pre-commit hooks:

```bash
node scripts/install-hooks.js
```

---

## 2. How to Test Fence Detection / วิธีการทดสอบการตรวจจับ Fence

**English:**
1. Create a fence file in the project directory:
   ```bash
   echo "fence content" > test.fence
   ```
2. Stage the file:
   ```bash
   git add test.fence
   ```
3. Attempt to commit:
   ```bash
   git commit -m "test: fence detection"
   ```

**ไทย:**
1. สร้างไฟล์ fence ในไดเรกทอรีของโปรเจกต์:
   ```bash
   echo "fence content" > test.fence
   ```
2. เพิ่มไฟล์เข้าสู่ staging area:
   ```bash
   git add test.fence
   ```
3. ลองคอมมิต:
   ```bash
   git commit -m "test: fence detection"
   ```

---

## 3. How to Test TSC Gate / วิธีการทดสอบ TSC Gate

**English:**
1. Introduce a TypeScript type error in any `.ts` file (e.g., add `const x: string = 123;`).
2. Stage the modified file:
   ```bash
   git add <modified-file>.ts
   ```
3. Attempt to commit:
   ```bash
   git commit -m "test: tsc gate"
   ```

**ไทย:**
1. ใส่ข้อผิดพลาดของประเภทข้อมูล (type error) ในไฟล์ `.ts` ใดๆ (เช่น เพิ่ม `const x: string = 123;`)
2. เพิ่มไฟล์ที่แก้ไขเข้าสู่ staging area:
   ```bash
   git add <modified-file>.ts
   ```
3. ลองคอมมิต:
   ```bash
   git commit -m "test: tsc gate"
   ```

---

## 4. Pass Criteria / เกณฑ์การผ่านการทดสอบ

**English:**
- The test is **PASSED** if the fence file is **REJECTED** by the pre-commit hook (the commit is aborted and an error message is displayed).
- The test is **PASSED** if the TSC gate **REJECTS** the commit when a TypeScript type error is present.

**ไทย:**
- การทดสอบจะ **ผ่าน (PASSED)** ก็ต่อเมื่อไฟล์ fence ถูก **ปฏิเสธ (REJECTED)** โดย pre-commit hook (การคอมมิตถูกยกเลิกและแสดงข้อความแจ้งเตือน)
- การทดสอบจะ **ผ่าน (PASSED)** ก็ต่อเมื่อ TSC gate **ปฏิเสธ (REJECTS)** การคอมมิตเมื่อพบข้อผิดพลาดของประเภทข้อมูล TypeScript (type error)

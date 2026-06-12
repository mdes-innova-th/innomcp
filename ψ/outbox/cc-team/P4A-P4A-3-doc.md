<!-- cc-team deliverable
 group: P4A (Phase 4.1 â€” Playwright browser runtime audit script)
 member: P4A-3 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":63,"completion_tokens":2076,"total_tokens":2139,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":329,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-12T03:43:24.350Z -->
```markdown
# Browser Runtime Audit – Verification / การตรวจสอบการทำงานในเบราว์เซอร์

## How to Run the Audit Script / วิธีการรันสคริปต์ตรวจสอบ

### English
1. Ensure you have Node.js installed (v18 or later).
2. Install the audit script dependencies:
   ```bash
   npm install
   ```
3. Run the audit against your application URL (replace `https://your-app.com` with the actual URL):
   ```bash
   node audit/browser-runtime.js --url https://your-app.com
   ```
4. If you want to run with a headless browser (default), use:
   ```bash
   npx playwright test audit/browser-runtime.spec.ts
   ```
5. The script will generate a JSON report file named `browser-runtime-audit.json` in the `reports/` directory.

### ภาษาไทย
1. ตรวจสอบว่าได้ติดตั้ง Node.js (เวอร์ชัน 18 หรือใหม่กว่า) แล้ว
2. ติดตั้ง dependencies ของสคริปต์ตรวจสอบ:
   ```bash
   npm install
   ```
3. รันสคริปต์ตรวจสอบโดยระบุ URL ของแอปพลิเคชันของคุณ (เปลี่ยน `https://your-app.com` เป็น URL จริง):
   ```bash
   node audit/browser-runtime.js --url https://your-app.com
   ```
4. หากต้องการรันแบบ Headless (ค่าเริ่มต้น) ให้ใช้:
   ```bash
   npx playwright test audit/browser-runtime.spec.ts
   ```
5. สคริปต์จะสร้างไฟล์รายงาน JSON ชื่อ `browser-runtime-audit.json` ในโฟลเดอร์ `reports/`

---

## Expected Output / ผลลัพธ์ที่คาดหวัง

### English
When the audit runs successfully, you should see:
- **Console output**: The script prints a summary to the terminal, including:
  - `Console errors: 0`
  - `Columns visible: All 3 columns`
  - `Audit status: PASS`
- **JSON report**: A file `browser-runtime-audit.json` with detailed results.
- **No unexpected errors** in the browser console during the entire audit (e.g., no `Uncaught TypeError`, `404`, or CSP violations).

### ภาษาไทย
เมื่อรันสคริปต์ตรวจสอบสำเร็จ คุณควรเห็น:
- **ผลลัพธ์ทางคอนโซล**: สคริปต์จะพิมพ์สรุปผลในเทอร์มินัล ดังนี้:
  - `Console errors: 0` (ข้อผิดพลาดในคอนโซล: 0)
  - `Columns visible: All 3 columns` (คอลัมน์ทั้งหมด 3 คอลัมน์แสดงผล)
  - `Audit status: PASS` (สถานะการตรวจสอบ: ผ่าน)
- **รายงาน JSON**: ไฟล์ `browser-runtime-audit.json` พร้อมข้อมูลรายละเอียด
- **ไม่มีข้อผิดพลาดที่ไม่คาดคิด** ในคอนโซลเบราว์เซอร์ระหว่างการตรวจสอบ (เช่น `Uncaught TypeError`, `404`, หรือ CSP violations)

---

## Interpreting the JSON Report / การตีความรายงาน JSON

### English
The `browser-runtime-audit.json` file contains the following key fields:

| Field             | Type    | Description                                                  |
|-------------------|---------|--------------------------------------------------------------|
| `timestamp`       | string  | ISO date of the audit execution                              |
| `url`             | string  | The URL that was tested                                      |
| `consoleErrors`   | array   | List of console errors found (empty array means zero errors) |
| `columnsVisible`  | boolean | `true` if all 3 required columns are visible on the page     |
| `uiScreenshot`    | string  | Base64-encoded screenshot (optional, for manual review)      |
| `performance`     | object  | Key metrics: `loadTime`, `domContentLoaded`, `jsHeapUsed`    |
| `overallPass`     | boolean | `true` if both `consoleErrors.length === 0` and `columnsVisible === true` |

**Example `overallPass: true` snippet:**
```json
{
  "consoleErrors": [],
  "columnsVisible": true,
  "overallPass": true
}
```

**Example `overallPass: false` snippet:**
```json
{
  "consoleErrors": ["Uncaught TypeError: Cannot read property 'x' of undefined"],
  "columnsVisible": false,
  "overallPass": false
}
```
- If `columnsVisible` is `false`, check the screenshot (if present) to confirm which column is missing.
- If `consoleErrors` is non-empty, review the error messages and fix the corresponding issues in the application.

### ภาษาไทย
ไฟล์ `browser-runtime-audit.json` มีฟิลด์สำคัญดังนี้:

| ฟิลด์             | ชนิด      | คำอธิบาย                                                    |
|-------------------|-----------|--------------------------------------------------------------|
| `timestamp`       | string    | วันที่และเวลาที่ทำการตรวจสอบ (รูปแบบ ISO)                    |
| `url`             | string    | URL ที่ถูกทดสอบ                                              |
| `consoleErrors`   | array     | รายการข้อผิดพลาดที่พบในคอนโซล (ถ้าไม่มีจะเป็น array ว่าง)    |
| `columnsVisible`  | boolean   | `true` ถ้าคอลัมน์ทั้ง 3 คอลัมน์แสดงผลบนหน้าเว็บ              |
| `uiScreenshot`    | string    | ภาพหน้าจอที่ถูกเข้ารหัส Base64 (ใช้ตรวจสอบด้วยตนเอง)         |
| `performance`     | object    | ค่าประสิทธิภาพหลัก: `loadTime`, `domContentLoaded`, `jsHeapUsed` |
| `overallPass`     | boolean   | `true` ถ้าทั้ง `consoleErrors.length === 0` และ `columnsVisible === true` |

**ตัวอย่าง `overallPass: true` (ผ่าน):**
```json
{
  "consoleErrors": [],
  "columnsVisible": true,
  "overallPass": true
}
```

**ตัวอย่าง `overallPass: false` (ไม่ผ่าน):**
```json
{
  "consoleErrors": ["Uncaught TypeError: Cannot read property 'x' of undefined"],
  "columnsVisible": false,
  "overallPass": false
}
```
- ถ้า `columnsVisible` เป็น `false` ให้ตรวจสอบภาพหน้าจอ (ถ้ามี) เพื่อดูว่าคอลัมน์ใดหายไป
- ถ้า `consoleErrors` ไม่ว่าง ให้ตรวจสอบข้อความข้อผิดพลาดและแก้ไขปัญหาที่เกี่ยวข้องในแอปพลิเคชัน

---

## Pass Criteria / เกณฑ์การผ่าน

### English
The audit is considered **PASS** if and only if **both** conditions are met:

1. **Zero console errors**: `consoleErrors` in the JSON report is an empty array `[]`.
2. **All 3 columns visible**: `columnsVisible` in the JSON report is `true`.

Additionally, the terminal should output:
```
Audit status: PASS
```

If either condition fails, the audit result will be **FAIL** and the terminal will display:
```
Audit status: FAIL
```

### ภาษาไทย
การตรวจสอบจะถือว่า **ผ่าน (PASS)** ก็ต่อเมื่อ **ทั้งสองเงื่อนไข** เป็นจริง:

1. **ไม่มีข้อผิดพลาดในคอนโซล**: `consoleErrors` ในรายงาน JSON เป็น array ว่าง `[]`
2. **แสดงทั้ง 3 คอลัมน์**: `columnsVisible` ในรายงาน JSON เป็น `true`

นอกจากนี้ ควรเห็นข้อความในเทอร์มินัล:
```
Audit status: PASS
```

หากเงื่อนไขใดเงื่อนไขหนึ่งไม่เป็นจริง ผลการตรวจสอบจะเป็น **FAIL** และเทอร์มินัลจะแสดง:
```
Audit status: FAIL
```
```

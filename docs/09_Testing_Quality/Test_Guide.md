# การทดสอบและคุณภาพ (Testing & Quality)

เอกสารนี้สรุปว่า repo นี้มีเทสอยู่ที่ไหนบ้าง และควรรันแบบไหนเป็นหลัก เพื่อให้ทีมตรวจสอบคุณภาพได้ “เป็นระบบ” และหาไฟล์เจอจริง

## โครงสร้างเทสใน monorepo (ภาพรวม)

1) **Root E2E (แนะนำสำหรับตรวจ end-to-end)**
- `tests/` = โฟลเดอร์รวม runner/สคริปต์/ไฟล์ข้อมูลทดสอบระดับระบบ
- `tests/e2e/` = Playwright E2E (ตัวหลัก)
  - `tests/e2e/tests/` = UI/flow specs (เช่น header/nav/keyboard/login/NWP args)
  - `tests/e2e/testlist/` = ชุดทดสอบเลือก tool + ชุด master suites
  - `tests/e2e/testlist/tool-selection-tests/` = แยก suite ตาม domain (weather/tmd/nasa/...)
  - `tests/e2e/tmd/` และ `tests/e2e/test_todo_req*/` = ชุดเทสตาม requirements/milestones

2) **Backend Unit/Integration**
- `innomcp-node/tests/` = Jest unit/integration tests และสคริปต์ทดสอบฝั่ง backend

3) **Frontend / MCP Server tests (ถ้ามีในอนาคต/บางส่วนมีอยู่แล้ว)**
- `innomcp-next/tests/` = เทสฝั่ง UI/Next.js (ถ้ามีเพิ่ม)
- `innomcp-server-node/tests/` = เทสฝั่ง MCP server/tools (ถ้ามีเพิ่ม)

## E2E (Playwright) — วิธีรันมาตรฐาน

รันผ่านเมนู (Windows, แนะนำให้ทีมใช้คำสั่งเดียวกัน):

```powershell
cd C:\Users\USER-NT\DEV\innomcp\tests
run-e2e-tests.bat
```

รันตรง (เหมาะกับ dev ที่ต้องการเจาะไฟล์เดียว):

```powershell
cd C:\Users\USER-NT\DEV\innomcp\tests\e2e
npx playwright test testlist/quick-tool-test.spec.ts --headed
```

ดูรายงาน:

```powershell
cd C:\Users\USER-NT\DEV\innomcp\tests\e2e
npx playwright show-report
```

## Unit/Integration (Backend)

```powershell
cd C:\Users\USER-NT\DEV\innomcp\innomcp-node
npm run test:unit
npm run test:integration
npm run test:coverage
```

## ผลลัพธ์/Artifacts ที่ควรดู

- `tests/e2e/playwright-report/` = HTML report
- `tests/e2e/results/` = JSON/Markdown สรุปผลบางชุด
- `test-results/` (root) = ที่เก็บผลสรุประดับ workspace (ขึ้นกับ runner)

## ปัญหาที่พบบ่อย (Troubleshooting)

### MCP ขึ้นว่า Port 3012 ถูกใช้งานอยู่

อาการ: start MCP แล้วเจอ `Port 3012 is already in use`

วิธีตรวจ/แก้ (Windows):

```powershell
cd C:\Users\USER-NT\DEV\innomcp
./scripts/resolve-port.ps1 -Port 3012
./scripts/resolve-port.ps1 -Port 3012 -Kill
```

หมายเหตุ: ถ้าไม่อยาก kill ให้ปรับ `SERVER_PORT` ของ MCP ในไฟล์ `.env` ของ `innomcp-server-node`

## การแจ้งปัญหา (Bug Reporting)

หากพบปัญหา ให้บันทึกสั้นๆตามรูปแบบนี้:
- สิ่งที่ทำ (Steps)
- สิ่งที่เกิดขึ้น (Actual)
- สิ่งที่คาดหวัง (Expected)
- แนบไฟล์ผลลัพธ์จาก `tests/e2e/playwright-report/` หรือ json ใน `tests/e2e/results/` ถ้ามี

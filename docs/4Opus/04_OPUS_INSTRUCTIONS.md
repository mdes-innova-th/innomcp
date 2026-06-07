# OPUS_INSTRUCTIONS — สำหรับ Claude Opus รอบถัดไป
**Last updated: 2026-04-27 post-Opus** | **HEAD:** `e4cfaaa` | **origin/main:** synced ✅

---

## TL;DR — งาน Opus รอบนี้เสร็จสิ้นแล้ว ✅

```
✅ BUG-001: thaiDomainRouting.test.ts → Jest (28/28)
✅ BUG-002: thaiWeatherIntelligence.test.ts → Jest (98/98)
✅ BUG-003: geo-core-phase1.test.ts → Jest (8/8)
✅ Phase 3: Admin audit log + 6 tests
✅ Phase 5: Admin feedback card (UI)
✅ git commit e4cfaaa + git push origin main

Jest suite: 618/618 PASS | test:all: 658/658 | TS: 0 errors
```

**รอบถัดไป — ต้องรัน Playwright E2E (ต้องมี backend+frontend up):**
```powershell
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node && npm run dev       # Terminal 1
cd c:\Users\USER-NT\DEV\innomcp\innomcp-next && npm run dev       # Terminal 2
$env:SMOKE_MODE=1; npx playwright test e2e/signoff.spec.ts --reporter=list  # Terminal 3
```

---

## Environment ที่ต้องรู้ก่อนแก้

```bash
# Ports
Frontend: localhost:3000  (innomcp-next — Next.js)
Backend:  localhost:3011  (innomcp-node — Express)
MCP:      localhost:3012  (innomcp-server-node)
DB:       localhost:3308  (Docker mariadb-innomcp)

# DB credentials
DB_HOST=localhost
DB_PORT=3308
DB_USER=jlapps
DB_PASSWORD=rockbottom
DB_NAME=innomcp-db

# Image Gen
IMAGE_GEN_GATEWAY_URL=https://imgen.mdes-innova.online/generate
IMAGE_GEN_TIMEOUT_MS=15000

# Test credentials
admin@example.local / Admin@1234
```

---

## Quick Start Commands

```powershell
# TypeScript check (ต้องได้ 0 errors ทั้ง 3)
cd innomcp-node && npx tsc --noEmit       # ✅ 0 errors
cd innomcp-next && npx tsc --noEmit       # ✅ 0 errors
cd innomcp-server-node && npx tsc --noEmit # ✅ 0 errors

# Run Jest unit tests (สำหรับ innomcp-node)
cd innomcp-node && npx jest               # ✅ 478/478 PASS (21 suites)

# Run non-Jest tests (ผ่านทั้งหมดแต่อยู่นอก pipeline)
cd innomcp-node && npx ts-node tests/thaiDomainRouting.test.ts      # 28/28 PASS
cd innomcp-node && npx ts-node tests/unit/thaiWeatherIntelligence.test.ts  # 98/98 PASS
cd innomcp-node && node tests/geo/geo-core-phase1.test.js           # 8/8 PASS
cd innomcp-node && node tests/geo/thai-geo-roundC.test.js           # 40/40 PASS

# Start backend
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node
npm run dev

# Start frontend (new terminal)
cd c:\Users\USER-NT\DEV\innomcp\innomcp-next
npm run dev

# Playwright E2E (ต้องมี backend+frontend รัน)
cd innomcp-next
$env:SMOKE_MODE=1; npx playwright test e2e/signoff.spec.ts --reporter=list

# Push unpushed commits (3 commits ahead of origin)
cd c:\Users\USER-NT\DEV\innomcp && git push origin main
```

---

## Priority Fix List (แก้ทีละข้อตามลำดับ)

### [P1] FIX-1: Verify Playwright E2E

**Precondition:** backend + frontend รัน
```powershell
# ตรวจสอบ ports
Test-NetConnection localhost -Port 3011
Test-NetConnection localhost -Port 3000

# รัน signoff suite
cd c:\Users\USER-NT\DEV\innomcp\innomcp-next
$env:SMOKE_MODE=1; npx playwright test e2e/signoff.spec.ts --reporter=list
```
**Expected:** ≥60 tests PASS (S1 Auth + S2 Chat + S3 Evidence + S4 Weather + S5 Knowledge + S6 Tools + S7 Contract + S8 Readiness)

---

### [P2] FIX-2: Convert thaiDomainRouting.test.ts to Jest

**ไฟล์:** `innomcp-node/tests/thaiDomainRouting.test.ts`

**Steps:**
1. ลบ 2 imports: `import { describe, it } from "node:test"` + `import { strict as assert } from "node:assert"`
2. เปลี่ยน `assert.equal(actual, expected)` → `expect(actual).toBe(expected)`
3. เปลี่ยน `assert.deepEqual(actual, expected)` → `expect(actual).toEqual(expected)`
4. แก้ `jest.config.json` — ลบ `"thaiDomainRouting\\.test\\.ts"` ออกจาก `testPathIgnorePatterns`
5. รัน: `npx jest tests/thaiDomainRouting.test.ts` — ต้อง 28/28 PASS

---

### [P2] FIX-3: Convert thaiWeatherIntelligence.test.ts to Jest

**ไฟล์:** `innomcp-node/tests/unit/thaiWeatherIntelligence.test.ts`

**Steps:**
1. ลบ helper functions `assert()`, `assertContains()`, `assertNotTrue()` และ summary block
2. wraps แต่ละ `describe` + `it` group ให้ชัดเจน
3. ใช้ `expect().toBe()`, `expect().toContain()`, `expect().toBe(false)`
4. ลบ `"thaiWeatherIntelligence\\.test\\.ts"` ออกจาก `testPathIgnorePatterns`
5. รัน: `npx jest tests/unit/thaiWeatherIntelligence.test.ts` — ต้อง ≥98 PASS

---

### [P2] FIX-4: Phase 5 Admin Feedback UI

**ไฟล์:** `innomcp-next/src/app/admin/page.tsx`

เพิ่ม section "Feedback Insights":
```tsx
// fetch stats
const statsRes = await fetch('/api/admin/feedback/stats', { cache: 'no-store' });
const feedbackStats = await statsRes.json();

// render (เพิ่มใน admin page body):
<section>
  <h2>Feedback Insights</h2>
  <p>Total: {feedbackStats.total} | 👍 {feedbackStats.up} | 👎 {feedbackStats.down}</p>
  <table>
    {feedbackStats.byRoute?.map(r => (
      <tr key={r.route}><td>{r.route}</td><td>{r.up}👍</td><td>{r.down}👎</td></tr>
    ))}
  </table>
</section>
```

---

### [P3] FIX-5: Push to origin

```bash
cd c:\Users\USER-NT\DEV\innomcp
git push origin main
# Push 3 commits: 7d245c8, 06cdbd1, 9772270
```

---

### [P3] FIX-6: Admin User Management

ดูรายละเอียดใน `03_PHASE_BACKLOG.md` → "Phase 3 Remaining"

---

## TL;DR — ทำอะไรก่อน (token-efficient order)

```
ขั้น 1: อ่าน docs/4Opus/01_OUTSTANDING_ISSUES.md  → รู้ว่าปัญหาคืออะไร
ขั้น 2: อ่าน docs/4Opus/02_UNCOMMITTED_CODE.md    → รู้ว่าโค้ดมีอะไรเปลี่ยน
ขั้น 3: อ่าน docs/4Opus/03_PHASE_BACKLOG.md       → รู้งานที่เหลือ
ขั้น 4: ลงมือแก้ตามลำดับ P0 → P1 → P2
```

---

## Environment ที่ต้องรู้ก่อนแก้

```bash
# Ports
Frontend: localhost:3000  (innomcp-next — Next.js)
Backend:  localhost:3011  (innomcp-node — Express)
MCP:      localhost:3012  (innomcp-server-node)
DB:       localhost:3308  (Docker mariadb-innomcp)

# DB credentials
DB_HOST=localhost
DB_PORT=3308
DB_USER=jlapps
DB_PASSWORD=rockbottom
DB_NAME=innomcp-db

# Image Gen
IMAGE_GEN_GATEWAY_URL=https://imgen.mdes-innova.online/generate
IMAGE_GEN_TIMEOUT_MS=15000

# Test credentials
admin@example.local / Admin@1234
```

---

## Quick Start Commands

```powershell
# Start backend
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node
npm run dev

# Start frontend (new terminal)
cd c:\Users\USER-NT\DEV\innomcp\innomcp-next
npm run dev

# TypeScript check
cd innomcp-node && npx tsc --noEmit
cd innomcp-next && npx tsc --noEmit

# Run unit tests
cd innomcp-node && npm test

# Playwright E2E
cd innomcp-next && npx playwright test e2e/signoff.spec.ts --reporter=list
```

---

## Priority Fix List (แก้ทีละข้อตามลำดับ)

### ✅ FIX-1: Commit genimg feature (P0)

```bash
cd c:\Users\USER-NT\DEV\innomcp
git add innomcp-node/src/services/imageGenService.ts
git add innomcp-next/src/app/components/chat/GeneratedImageCard.tsx
git add innomcp-next/src/app/components/chat/ChatMessage.tsx
git add innomcp-next/src/middleware.ts
git add innomcp-node/src/routes/api/chat.ts
git add .gitignore .vscode/tasks.json
git commit -m "feat(genimg): image generation WS gate, UI card, CSP/COEP fixes"
git push
```

**Verify:** `git status` ต้องแสดง "nothing to commit, working tree clean"

---

### ✅ FIX-2: Verify TypeScript (P0)

```bash
cd innomcp-node && npx tsc --noEmit    # ต้องได้ 0 errors
cd innomcp-next && npx tsc --noEmit   # ต้องได้ 0 errors
```

---

### ✅ FIX-3: Phase 5 Feedback DB (P2)

**Step 1: สร้าง table**
```bash
docker exec mariadb-innomcp mariadb -u jlapps -prockbottom innomcp-db -e "
CREATE TABLE IF NOT EXISTS chat_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(64),
  session_id VARCHAR(64),
  rating ENUM('up','down') NOT NULL,
  user_id INT NULL,
  query TEXT,
  response_summary TEXT,
  route VARCHAR(64),
  tools_used VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at)
);"
```

**Step 2: หาไฟล์ feedback route ใน backend**
```bash
grep -r "feedback" innomcp-node/src --include="*.ts" -l
```

**Step 3: เพิ่ม DB write ใน feedback handler ตาม spec ใน 03_PHASE_BACKLOG.md**

---

### ✅ FIX-4: pytest config (P4)

**ไฟล์:** สร้าง `pytest.ini` ที่ root ของ workspace:
```ini
[pytest]
testpaths = tests
python_files = test_*.py *_test.py
collect_ignore_glob =
    **/test-output.txt
    **/*.txt
```

**Also delete:** `tests/e2e/test_controller_gui.py` (duplicate)

---

### ✅ FIX-5: mcpClient Abstraction (P2 Phase 4)

**สร้างไฟล์:** `innomcp-node/src/services/mcpClient.ts`
ตาม spec ใน 03_PHASE_BACKLOG.md ส่วน "Phase 4 — mcpClient Refactor"

**Pattern ค้นหา:**
```bash
grep -n "callMcpTool\|fetch.*localhost:3012\|MCP_SERVER_URL" innomcp-node/src/routes/api/chat.ts | head -20
```

---

## Checks ก่อน Push (MANDATORY)

```bash
# 1. TypeScript clean
cd innomcp-node && npx tsc --noEmit
cd innomcp-next && npx tsc --noEmit

# 2. Unit tests green
cd innomcp-node && npm test -- --passWithNoTests

# 3. Git clean
git status

# 4. Push
git push
```

---

## ไฟล์ที่ห้ามแตะ (stable, do not modify)

```
innomcp-node/src/utils/thaiQueryNormalizer.ts    ← 90/90 NLP tests pass
innomcp-node/src/utils/thaiTemporalParser.ts     ← 20/20 tests pass  
innomcp-node/src/utils/thaiMultiLocationParser.ts← 15/15 tests pass
innomcp-server-node/src/mcp/tools/tmdTools.ts    ← TMD seismic working
innomcp-server-node/src/mcp/tools/thaiGeoTool.ts ← 48/48 tests pass
```

---

## หมายเหตุสำคัญ

1. **WebSocket vs HTTP:** backend รองรับทั้ง WebSocket (`ws://localhost:3011/chat`) และ HTTP fallback. ถ้า WS ล้มเหลว frontend จะ fallback เป็น HTTP อัตโนมัติ
2. **SMOKE_MODE=1** env var ทำให้ weather tools ใช้ fixture ไม่เรียก external API — ใช้สำหรับ dev/test
3. **Admin password** ถูก reset แล้วใน session นี้เป็น `Admin@1234` (bcrypt hash ใน DB)
4. **PORT 3308** (ไม่ใช่ 3306) สำหรับ MariaDB — เป็น Docker port mapping ที่ใช้ทั้งโปรเจค
5. **imageGenService.ts** ต้องใช้ Node 18+ (มี global `fetch`) — ตรวจสอบ node version ก่อน

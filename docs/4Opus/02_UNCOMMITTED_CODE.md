# Committed Code Log — สิ่งที่ commit แล้ว (2026-04-27)
**วันที่บันทึก:** 2026-04-27 | working tree: CLEAN ✅

---

## Git Status ปัจจุบัน

```
HEAD: 7d245c8  test(phase3+5): add feedbackMigration, pytestConfig, rateLimiter unit tests
Remote: origin/main @ 04bbef9  (HEAD อยู่หน้า 3 commits)
Working tree: nothing to commit ✅
```

---

## Recent Commits (HEAD → 04bbef9 range)

```
7d245c8  test(phase3+5): add feedbackMigration, pytestConfig, rateLimiter unit tests (11+3+3=17 new cases, suite 159/159)
06cdbd1  feat(phase3): add in-memory rate limiter (60rpm general, 10rpm auth)
9772270  feat(phase5): add GET /api/admin/feedback/stats endpoint
04bbef9  test(phase4): add McpClient unit tests (17 cases)  ← origin/main
5e72358  feat(phase4): scaffold McpClient HTTP abstraction (services/mcpClient.ts)
4f95009  feat(phase5): persist chat feedback to chat_feedback table
019c716  chore(pytest): ignore .txt fixtures during test collection
27eecf7  feat(genimg): Phase 13 image generation
```

---

## สิ่งที่ได้ commit แล้ว (recap)

### feat(genimg) — 27eecf7

**ไฟล์:**
- `innomcp-node/src/services/imageGenService.ts` (NEW)
- `innomcp-next/src/app/components/chat/GeneratedImageCard.tsx` (NEW)
- `innomcp-next/src/app/components/chat/ChatMessage.tsx` (Modified)
- `innomcp-next/src/middleware.ts` (COEP + CSP fixes)
- `innomcp-node/src/routes/api/chat.ts` (Image gen WS gate)

### feat(phase4): McpClient — 5e72358 + Unit tests — 04bbef9

**ไฟล์:**
- `innomcp-node/src/services/mcpClient.ts` (NEW)
- `innomcp-node/tests/unit/mcpClient.test.ts` (NEW — 17 tests PASS)

**Interface:**
```typescript
class McpClient {
  callTool(toolName: string, params: Record<string, unknown>): Promise<McpToolResult>
  callBatch(calls: McpCall[]): Promise<McpToolResult[]>
  isAvailable(): Promise<boolean>
}
```

### feat(phase5): DB feedback — 4f95009 + Stats API — 9772270 + Unit tests — 7d245c8

**ไฟล์:**
- `innomcp-node/src/routes/api/feedback.ts` (Modified — DB insert added)
- `innomcp-node/src/routes/api/admin.ts` (Modified — /api/admin/feedback/stats)
- `innomcp-next/src/app/api/admin/feedback/stats/route.ts` (NEW)
- `innomcp-node/tests/unit/feedbackMigration.test.ts` (NEW — 11 tests PASS)

### feat(phase3): Rate limiter — 06cdbd1 + Unit tests — 7d245c8

**ไฟล์:**
- `innomcp-node/src/middleware/rateLimiter.ts` (NEW)
- `innomcp-node/tests/unit/rateLimiter.test.ts` (NEW — 11 tests PASS)

**Config:**
- General API: 60 req/min per IP
- Auth endpoints: 10 req/min per IP
- Returns: `429 Too Many Requests` + `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers

### chore(pytest): .txt ignore — 019c716

**ไฟล์:**
- `pytest.ini` — เพิ่ม `collect_ignore_glob = **/test-output.txt **/*.txt`

---

## Pending push (commits on local main, not yet on origin)

```
7d245c8 — ยังไม่ push ไป origin
06cdbd1 — ยังไม่ push ไป origin
9772270 — ยังไม่ push ไป origin
```

**คำสั่ง push:**
```bash
cd c:\Users\USER-NT\DEV\innomcp
git push origin main
```

---

## Git Status ปัจจุบัน

```bash
HEAD: d0c1807  feat(phase2+3+5): Thai NLP suite (90 tests), multi-location parser...
Remote: upstream/main @ d0c1807

Modified (tracked):
  M .gitignore
  M .vscode/tasks.json
  M innomcp-next/src/app/components/chat/ChatMessage.tsx
  M innomcp-next/src/middleware.ts
  M innomcp-node/src/routes/api/chat.ts

Untracked (new files):
  ?? innomcp-next/src/app/components/chat/GeneratedImageCard.tsx
  ?? innomcp-node/src/services/imageGenService.ts
```

---

## รายละเอียดการเปลี่ยนแปลงแต่ละไฟล์

### 1. `innomcp-node/src/services/imageGenService.ts` (NEW — untracked)

**ฟังก์ชันหลัก:**
- `callImageGen(prompt: string)` — ลองใช้ MDES gateway ก่อน, fallback Pollinations.ai
- `callPollinations(prompt, width, height)` — สร้าง Pollinations URL
- `buildImageGenText(result)` — สร้างข้อความตอบกลับ

**Dependencies:**
- `IMAGE_GEN_GATEWAY_URL` from `.env` (ปัจจุบัน: `https://imgen.mdes-innova.online/generate`)
- `IMAGE_GEN_TIMEOUT_MS` from `.env`
- Standard `fetch` (Node 18+)

---

### 2. `innomcp-node/src/routes/api/chat.ts` (Modified)

**Changes:**
- เพิ่ม import: `import { optionalAuth, verifyToken } from "../../utils/jwt";` (บรรทัดต้นๆ)
- เพิ่ม **Phase 13.2 WS Image Gen Gate** — ก่อน seismic gate ในส่วน WebSocket handler

**สิ่งที่ gate ทำ:**
1. ตรวจสอบ routing message เป็น IMAGE_GEN intent หรือมีคำว่า "สร้างรูปภาพ" / "วาดรูป" / "ภาพ"
2. Parse JWT cookie จาก `req.headers.cookie` เพื่อ auth check
3. เรียก `callImageGen(routingMessage)` จาก imageGenService
4. ส่ง structured content กลับ via `sendSafe(ws, ...)` พร้อม:
   - `generatedImageUrl`, `imagePrompt`, `imageProvider`, `imageModel`, `imageSource`
   - `generatedImageBase64` (ถ้ามี)
5. `return` ทันที (ไม่ผ่าน gate ถัดไป)

---

### 3. `innomcp-next/src/app/components/chat/GeneratedImageCard.tsx` (NEW — untracked)

**Props:**
```typescript
interface GeneratedImageCardProps {
  imageUrl?: string
  imageBase64?: string
  imagePrompt?: string
  imageProvider?: string
  imageModel?: string
  imageSource?: string
  theme?: 'light' | 'dark'
}
```

**Features:**
- Loading skeleton state
- Error state + "ลองใหม่" retry button
- Download button
- Fullscreen link
- MDES badge (for imgen.mdes-innova.online source)
- `data-testid="generated-image-card"` — สำหรับ E2E testing

---

### 4. `innomcp-next/src/app/components/chat/ChatMessage.tsx` (Modified)

**Changes:**
- เพิ่ม import `GeneratedImageCard` (single import, ลบ duplicate ที่เคยมี)
- เพิ่ม render condition: ถ้า `structuredContent.generatedImageUrl` หรือ `structuredContent.generatedImageBase64` มีค่า → render `<GeneratedImageCard>`

---

### 5. `innomcp-next/src/middleware.ts` (Modified)

**Changes:**

Line ~90 — CSP `img-src`:
```
// เดิม:
"img-src 'self' data: https://innomcp.dataxo.info http://localhost:3001 http://127.0.0.1:3001 blob:"

// ใหม่:
"img-src 'self' data: https://innomcp.dataxo.info http://localhost:3001 http://127.0.0.1:3001 blob: https://image.pollinations.ai https://imgen.mdes-innova.online"
```

Line 167 — COEP:
```
// เดิม:
response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");

// ใหม่:
response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
```

**เหตุผล COEP:** `require-corp` บล็อก cross-origin images ที่ไม่มี `CORP` header (เช่น Pollinations.ai)
`credentialless` อนุญาต public cross-origin resources แต่ยัง isolate  

---

## คำสั่ง Commit

```bash
cd c:\Users\USER-NT\DEV\innomcp

git add innomcp-node/src/services/imageGenService.ts
git add innomcp-next/src/app/components/chat/GeneratedImageCard.tsx
git add innomcp-next/src/app/components/chat/ChatMessage.tsx
git add innomcp-next/src/middleware.ts
git add innomcp-node/src/routes/api/chat.ts
git add .gitignore
git add .vscode/tasks.json

git commit -m "feat(genimg): Phase 13 image generation

- Add imageGenService.ts: MDES gateway + Pollinations.ai fallback
- Add WS image gen gate in chat.ts before seismic gate (JWT auth)
- Add GeneratedImageCard.tsx: UI card with loading/error/download states
- Wire ChatMessage.tsx to render GeneratedImageCard
- Fix middleware.ts CSP img-src: add Pollinations + MDES gateway domains
- Fix middleware.ts COEP: require-corp → credentialless (fix cross-origin image blocking)

E2E verified: imgVisible=true, errCount=0"
```

---

## Verification After Commit

```bash
# TypeScript check
cd innomcp-node && npx tsc --noEmit
cd innomcp-next && npx tsc --noEmit

# Quick E2E check
cd innomcp-next && npx playwright test e2e/signoff.spec.ts --reporter=list
```

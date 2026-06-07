# Outstanding Issues — สถานะปัจจุบัน
**Updated:** 2026-04-29 | **HEAD:** local working tree after health-path fixes | **Working tree:** DIRTY (active SA changes)

---

## OPEN — 2026-04-29 New AI Quality Gap

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| P-161 | Thai image prompts are not adapted into high-quality English visual prompts before image generation | P1 | OPEN |
| P-162 | Tool/API answers are synthesized inconsistently; response composition is route-specific instead of a shared final-answer layer | P1 | OPEN |

### P-161 — Thai Image Prompt Adapter Missing

**User symptom:** ผู้ใช้สั่งสร้างภาพเป็นภาษาไทยได้ แต่ภาพที่ได้ "ไม่ได้เรื่อง" เมื่อเทียบกับ prompt ภาษาอังกฤษ

**Verified root cause in current code:**
- `innomcp-node/src/services/imageGenService.ts` → `cleanPrompt()` แค่ตัด prefix (`สร้างรูป`, `วาดภาพ`, `generate image`) แต่ **ไม่ได้แปลหรือขยาย semantic**
- `innomcp-node/src/routes/api/chat.ts` ทั้ง WS/HTTP image gate ส่ง `routingMessage` เข้า `callImageGen()` ตรงๆ
- ดังนั้น MDES gateway / Pollinations ได้ prompt ที่ยังเป็นไทยหรือเป็นไทยปนอังกฤษโดยไม่มี visual rewriting layer

**Impact:**
- ภาพจากภาษาไทยด้อยคุณภาพกว่าภาษาอังกฤษอย่างมีนัยสำคัญ
- ผู้ใช้ต้องเรียนรู้ว่าควร prompt เป็นอังกฤษเอง ซึ่งขัดกับ UX ของระบบไทย

### P-162 — Shared Response Composer Missing

**User symptom:** คำตอบจาก API หลายตัวหรือ tool หลายตัวบางครั้งยังไม่ถูก "หลอม" เป็นคำตอบเดียวที่สมบูรณ์

**Verified root cause in current code:**
- `innomcp-node/src/utils/mcp/answerPlanner.ts` มีแค่ intent planning แบบหยาบ ยังไม่มี language-adaptation stage
- `innomcp-node/src/routes/api/chat.ts` มี rewrite/summarise อยู่เป็นบาง route (เช่น weather/tool+rewrite) แต่ **ไม่มี shared composer layer** หลัง tool execution
- logic การ rewrite กระจายหลายจุด ทำให้ควบคุม latency และคุณภาพยาก

**Impact:**
- คำตอบ multi-tool ไม่สม่ำเสมอ
- เพิ่มความเสี่ยงที่ Opus/SA จะไปแก้ทีละ route แบบกระจัดกระจายอีก

### Recommended Direction (SA)

แนวคิด "มี 2 agents" **ดี** แต่ต้องทำเป็น **on-demand specialists** ไม่ใช่ always-on workers:

1. `PromptAdapterAgent`
  - ใช้เฉพาะ image generation และ tool-selection ambiguity
  - deterministic ก่อน, LLM fallback เฉพาะกรณีจำเป็น
  - มี latency budget + cache

2. `ResponseComposerAgent`
  - ใช้เฉพาะ multi-tool / noisy raw API outputs / routes ที่ต้อง final synthesis
  - ห้ามรันกับทุก query
  - รับ facts แบบย่อ ไม่รับ raw payload ทั้งก้อน

ดูแผนเต็มใน `docs/4Opus/09_LANGUAGE_ROUTING_AND_COMPOSITION_PLAN.md`

---

## ✅ RESOLVED — Historical resolved work

| ID | ปัญหาเดิม | Commit |
|----|-----------|--------|
| P0-G1 | Uncommitted genimg feature | 27eecf7 |
| P0-TS | TypeScript errors | 0 errors บน 3 projects |
| P0-WS | WebSocket backend down | (infra — รัน npm run dev) |
| P2-Phase4 | mcpClient ไม่มี abstraction | 5e72358, 4f95009 |
| P2-Phase5-DB | Feedback ไม่ได้เขียน DB | 4f95009, 9772270 |
| P2-Phase5-UI | Admin dashboard ไม่มี feedback card | e4cfaaa |
| P2-pytest | UnicodeDecodeError ใน pytest collection | 019c716 |
| P3-coep | COEP `require-corp` → `credentialless` | 27eecf7 |
| P3-csp | img-src ขาด pollinations domain | 27eecf7 |
| P3-rate | ไม่มี rate limiter | 06cdbd1 |
| P3-Phase3 | Admin audit log + suspend/activate | e4cfaaa |
| BUG-001 | thaiDomainRouting.test.ts ไม่อยู่ใน Jest pipeline | e4cfaaa |
| BUG-002 | thaiWeatherIntelligence.test.ts ไม่อยู่ใน Jest pipeline | e4cfaaa |
| BUG-003 | geo-core-phase1 ไม่อยู่ใน Jest pipeline | e4cfaaa |
| **P-158** | **NWP JWT scopes=[] → 401** | **be6454d — ยืนยัน live: 200 OK ทุก endpoint** |
| **P-159** | **TMD api/api12345 placeholder** | **be6454d — TMD staff ยืนยัน credentials ถูกต้อง** |
| **P-160** | **DB password mismatch** | **ตรวจแล้ว: rockbottom ตรงกัน** |
| NWP region wrong endpoint | nwpHourlyByRegion +DailyByRegion ใช้ /area/region ผิด | be6454d |
| NWP region params ignored | date/hour/duration ถูก hardcode | be6454d |
| tmdTools isDemoLike false-positive | uid=api ถูก flag เป็น demo | be6454d |
| tmdTools timeout 30s short | TMD obs endpoints ใช้ 40–52s | be6454d (60s) |
| Weather3Hours http ช้า | เปลี่ยนเป็น https | be6454d |
| Playwright E2E (JWT secret mismatch → 429) | signoff.spec.ts อ่าน JWT_SECRET จาก backend .env | 18bbd88 |
| rateLimiter burst ใน dev (NODE_ENV=development) | bypass rate limit เมื่อ dev | 18bbd88 |
| TMD slow endpoint cache (28–52s) | tmdCache.ts Map+TTL + 6 tests | 18bbd88 |
| Jest --localstorage-file warning (Node v25) | jest.config.js + preload shim | 18bbd88 |
| AI Image Gen token auth missing | callGateway Authorization header + params | b18a683 |

---

## Historical Snapshot — previously completed work

```
commit history (newest first):
  b18a683 fix(imagegen): MDES gateway token auth + API params — SA 2026-04-28
  18bbd88 feat(e2e+cache+jest): Playwright 61/61, tmdCache, jest warning fix — Opus 2026-04-27
  be6454d fix(tmd+nwp): region endpoint, isDemoLike, timeout, http→https — SA 2026-04-27
  e4cfaaa fix(bugs+phase3+5): BUG-001/002/003, audit log, feedback UI — Opus 2026-04-27

Final test matrix:
  Jest (innomcp-node):           619/619 PASS — 0 warnings
  node:test (innomcp-server-node): 16/16 PASS (10 geo + 6 tmdCache)
  Playwright (innomcp-next):     61/61 PASS S1–S8
  TypeScript (all 3 projects):   0 errors
```

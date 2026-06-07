# innomcp — Master Briefing for Claude Opus
**วันที่:** 2026-04-28 | **Target:** Claude Opus (token-limited) | **ผู้จัดทำ:** SA
**HEAD:** `b18a683` | **origin/main:** synced ✅ (pushed 2026-04-28)

## Project เป็นอะไร

innomcp คือ AI Chat Platform ของกระทรวงดิจิทัลฯ (MDES) ประกอบด้วย:
- `innomcp-next/` — Next.js 15 frontend (port 3000)
- `innomcp-node/` — Express backend + chat routing (port 3011)
- `innomcp-server-node/` — MCP tool server (port 3012)
- MariaDB port 3308 (Docker container `mariadb-innomcp`)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, Tailwind CSS |
| Backend | Express, TypeScript, ts-node/nodemon |
| AI | Ollama (local) / OpenAI-compatible API |
| MCP Tools | Custom TypeScript MCP server tools |
| DB | MariaDB (Docker) — user `jlapps`, db `innomcp-db` |
| Auth | JWT httpOnly cookie (`token`), `verifyToken()` in `utils/jwt.ts` |
| Testing | Jest (619 unit), Playwright (61 E2E) |

## สถานะโดยรวม (2026-04-28 b18a683 — ล่าสุด)

| Scope | % เสร็จ | หมายเหตุ |
|-------|---------|----------|
| Phase 1 (Geo/Weather/Chat/Tools) | **100%** | NWP + TMD ทุก endpoint ผ่าน live test ✅ |
| Phase 2 (Evidence/Thai NLP suite) | **100%** | 619 Jest + 40 geo = 659 tests ✅ |
| Phase 3 (UI / RBAC) | **100%** | Rate limit ✅ Audit log ✅ Suspend/Activate ✅ |
| Phase 4 (mcpClient refactor) | **100%** | McpClient + 17 unit tests ✅ |
| Phase 5 (LLMOps / Feedback DB) | **100%** | DB persist ✅ Stats API ✅ Admin card ✅ |
| TMD+NWP tool bugs fixed | **100%** | 23/23 endpoints 200 OK ✅ (verified live) |
| Playwright E2E signoff | **100%** | ✅ 61/61 PASS (S1–S8, 5.6m) — Opus 18bbd88 |
| Slow TMD cache layer | **100%** | ✅ tmdCache.ts + 6 tests — Opus 18bbd88 |
| AI Image Gen (MDES gateway) | **100%** | ✅ imgen.mdes-innova.online primary — SA b18a683 |
| Jest warning fix | **100%** | ✅ 0 warnings, 619/619 — Opus 18bbd88 |
| **Overall** | **100%** | 🎉 ทุก task เสร็จสมบูรณ์ |

## ✅ ทุก task เสร็จสมบูรณ์ — 100%

```
[P1] ✅ Playwright E2E signoff: 61/61 PASS (S1–S8) — Opus 18bbd88
[P2] ✅ TMD slow endpoint cache (tmdCache.ts + 6 tests) — Opus 18bbd88
[P3] ✅ Jest --localstorage-file warning: 0 warnings — Opus 18bbd88
[+]  ✅ AI Image Gen: MDES gateway primary + auth header fix — SA b18a683
```

> ไม่มี Opus task คงค้าง — โปรเจกต์ production-ready

## Project เป็นอะไร

innomcp คือ AI Chat Platform ของกระทรวงดิจิทัลฯ (MDES) ประกอบด้วย:
- `innomcp-next/` — Next.js 15 frontend (port 3000)
- `innomcp-node/` — Express backend + chat routing (port 3011)
- `innomcp-server-node/` — MCP tool server (port 3012)
- MariaDB port 3308 (Docker container `mariadb-innomcp`)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, Tailwind CSS |
| Backend | Express, TypeScript, ts-node/nodemon |
| AI | Ollama (local) / OpenAI-compatible API |
| MCP Tools | Custom TypeScript MCP server tools |
| DB | MariaDB (Docker) — user `jlapps`, db `innomcp-db` |
| Auth | JWT httpOnly cookie (`token`), `verifyToken()` in `utils/jwt.ts` |
| Testing | Jest (444 unit), Playwright (61 E2E) |

## สถานะโดยรวม (2026-04-27 post-Opus)

| Scope | % เสร็จ | หมายเหตุ |
|-------|---------|----------|
| Phase 1 (Geo/Weather/Chat/Tools) | **99%** | NWP/TMD ติด external creds (P-158/159) |
| Phase 2 (Evidence/Thai NLP suite) | **100%** | 618 Jest + 40 geo = 658 tests ✅ |
| Phase 3 (UI / RBAC) | **100%** | Rate limit ✅ Audit log ✅ Suspend/Activate ✅ |
| Phase 4 (mcpClient refactor) | **100%** | McpClient + 17 unit tests ✅ |
| Phase 5 (LLMOps / Feedback DB) | **100%** | DB persist ✅ Stats API ✅ Admin card ✅ |
| **Overall** | **~92%** | เหลือ Playwright signoff + external creds |

## Features ที่สมบูรณ์แล้ว (ไม่ต้องแตะ)

- Chat routing (weather / geo / evidence / tools / general) — 7000+ line chat.ts
- Thai Geo Tool (province/amphoe/district) — 48/48 tests PASS
- Thai Knowledge Tool — routing complete
- Weather Pipeline (offline/fixture mode) — 26/26 cases PASS
- Calculator, DateTime, NASA APOD, WorldBank, Internet Archive — ทำงานครบ
- Thai NLP suite (normalizer, temporal parser, multi-location parser) — 90/90 tests PASS
- Auth system (register/login/JWT) — S1: 5/5 PASS
- Admin panel + RBAC middleware + Suspend/Activate + Audit Log — Phase 3: 100% ✅
- LLM feedback (👍/👎) → JSONL + MariaDB + Admin card — Phase 5: 100% ✅
- Image generation feature (GeneratedImageCard + WS gate) — E2E verified ✅
- McpClient abstraction layer (Phase 4) — 17/17 unit tests PASS ✅
- Rate limiter (60rpm general, 10rpm auth) — 11/11 unit tests PASS ✅
- Admin feedback stats API (GET /api/admin/feedback/stats) + Admin UI card ✅
- Jest test pipeline: **618/618 PASS** (25 suites) | `test:all` = **658 total** ✅

## Key File Paths

```
innomcp-node/
  src/
    routes/api/chat.ts              ← chat routing hub (7000+ lines)
    routes/api/admin/index.ts       ← admin CRUD + suspend/activate + audit log ✅
    services/imageGenService.ts     ← image gen service ✅ committed
    services/mcpClient.ts           ← McpClient HTTP abstraction ✅ Phase 4
    utils/jwt.ts                    ← verifyToken(), optionalAuth()
    utils/adminAuditLog.ts          ← audit log helper ✅ Phase 3
    middleware/rateLimiter.ts       ← in-memory rate limiter ✅
    app.ts                          ← Express app setup
  tests/
    618 Jest tests (25 suites) ✅
  .env                              ← DB + IMAGE_GEN settings

innomcp-next/
  src/
    app/
      components/chat/
        ChatMessage.tsx             ← renders chat + GeneratedImageCard
        GeneratedImageCard.tsx      ← image card component ✅ committed
      admin/page.tsx                ← Admin panel + Feedback Insights card ✅
      page.tsx / layout.tsx
    middleware.ts                   ← CSP headers (COEP+CSP fixed)

innomcp-server-node/
  src/mcp/tools/
    tmdTools.ts                     ← TMD seismic + weather tools
    thaiGeoTool.ts                  ← Thai geo MCP tool
    thaiKnowledgeTool.ts            ← Thai knowledge MCP tool
```

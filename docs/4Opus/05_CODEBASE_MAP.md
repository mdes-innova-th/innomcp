# Codebase Map — โครงสร้างและหน้าที่ของแต่ละไฟล์
**สำหรับ Opus ที่ต้องการรู้ว่าเขียนโค้ดลงที่ไหน**
**Last updated: 2026-04-27** | ✅ = committed | ❌ = not yet created

---

## innomcp-node (Backend — Express + TypeScript)

```
src/
├── app.ts                    ← Express setup, middleware, routes mount
├── routes/
│   └── api/
│       ├── chat.ts           ← MAIN: chat routing hub (7000+ lines)
│       │                       contains: routing gates, WS handler, HTTP handler,
│       │                       weather/geo/evidence/tools/general logic
│       ├── auth.ts           ← register, login, logout, JWT issuing
│       ├── admin.ts          ← admin CRUD, metrics endpoint
│       ├── health.ts         ← GET /api/health/keys (no auth)
│       └── feedback.ts       ← POST /api/chat/feedback (👍/👎)  ← FIND THIS
├── services/
│   ├── imageGenService.ts    ← ✅ committed 27eecf7: image generation (MDES + Pollinations fallback)
│   ├── weatherService.ts     ← weather pipeline (TMD/NWP)
│   ├── evidenceService.ts    ← detect-evidence API client
│   └── mcpClient.ts          ← ✅ committed 5e72358: McpClient HTTP abstraction (Phase 4)
├── utils/
│   ├── jwt.ts                ← verifyToken(), optionalAuth(), signToken()
│   ├── thaiQueryNormalizer.ts← Thai colloquial → standard query
│   ├── thaiTemporalParser.ts ← "มะรืน" → actual date
│   ├── thaiMultiLocationParser.ts ← "กรุงเทพ เชียงใหม่ ภูเก็ต" → array
│   └── locationResolver.ts  ← amphoe/district → province mapping
├── database/
│   ├── db.ts                 ← MySQL2 connection pool, getDb()
│   └── init/                 ← SQL schema files
└── middleware/
    └── apiKey.ts             ← API key validation middleware
```

---

## innomcp-next (Frontend — Next.js 15)

```
src/
├── app/
│   ├── page.tsx              ← root redirect → /chat
│   ├── layout.tsx            ← root layout, fonts, providers
│   ├── chat/
│   │   └── page.tsx          ← ChatPage main component
│   ├── admin/
│   │   └── page.tsx          ← Admin panel page
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatMessage.tsx        ← renders individual messages + GeneratedImageCard
│   │   │   ├── GeneratedImageCard.tsx ← AI image card ✅ committed 27eecf7
│   │   │   ├── ChatInput.tsx          ← textarea + send button
│   │   │   └── ModeStatusBar.tsx      ← AI mode + MCP status indicators
│   │   └── ui/               ← shared UI components
│   └── api/
│       ├── chat/
│       │   ├── route.ts       ← Next.js API proxy → backend :3011
│       │   └── feedback/
│       │       └── route.ts   ← feedback proxy → backend :3011
│       ├── health/
│       │   └── route.ts       ← health proxy
│       └── admin/
│           └── feedback/
│               └── stats/
│                   └── route.ts  ← ✅ EXISTS — Next.js proxy → backend stats endpoint
└── middleware.ts             ← CSP headers, COEP, auth protection (CSP+COEP fixed 27eecf7)
```

---

## innomcp-server-node (MCP Tools Server)

```
src/
├── index.ts                  ← Express app + MCP tool registration
└── mcp/
    ├── tools/
    │   ├── thaiGeoTool.ts    ← province/amphoe lookup
    │   ├── thaiKnowledgeTool.ts ← Thai knowledge queries
    │   ├── tmdTools.ts       ← TMD seismic + weather
    │   ├── nwpDailyTool.ts   ← NWP daily forecast (blocked by P-158)
    │   ├── nwpHourlyTool.ts  ← NWP hourly forecast (blocked by P-158)
    │   └── calculatorTool.ts ← math eval
    └── config/
        └── nwpApiConfig.ts   ← province lat/lon for NWP
```

---

## Key Patterns ใน chat.ts

### Chat routing flow:
```
1. Request arrives (WS or HTTP)
2. Quick gates (deterministic):
   - calculator → calculatorGate()
   - datetime   → dateTimeGate()
   - geo        → geoGate()
3. Phase 13.2 (NEW): image gen gate
4. Phase 13.3: seismic gate
5. Slow gates:
   - weatherPipeline()
   - evidenceGate()
   - thaiKnowledgeGate()
6. GeneralGate (fallback LLM)
```

### sendSafe() function:
```typescript
// ส่ง JSON ผ่าน WebSocket อย่างปลอดภัย
sendSafe(ws: WebSocket, data: Record<string, unknown>): void
```

### structuredContent format (what frontend receives):
```typescript
{
  text: string,              // main response text
  route: string,             // routing decision
  toolsUsed: string[],       // tool names used
  confidence: string,
  // genimg fields:
  generatedImageUrl?: string,
  imagePrompt?: string,
  imageProvider?: string,
  imageModel?: string,
  imageSource?: string,
  generatedImageBase64?: string
}
```

---

## Database Tables (MariaDB innomcp-db)

```sql
-- Existing tables (ต้องมีอยู่แล้ว)
users           -- id, email, password_hash, role, created_at
chat_sessions   -- id, user_id, title, created_at
chat_messages   -- id, session_id, role, content, metadata, created_at
feedback_logs   -- (อาจไม่มี) JSONL file แทน

-- Table ที่ต้องสร้าง (Phase 5)
chat_feedback   -- ดู 03_PHASE_BACKLOG.md SQL schema
```

---

## ENV Variables ที่สำคัญ

```bash
# innomcp-node/.env
DB_HOST=localhost
DB_PORT=3308
DB_USER=jlapps
DB_PASSWORD=rockbottom
DB_NAME=innomcp-db

JWT_SECRET=<secret>
NODE_ENV=development
PORT=3011

MCP_SERVER_URL=http://localhost:3012
AI_BACKEND_URL=http://localhost:11434  # Ollama

IMAGE_GEN_GATEWAY_URL=https://imgen.mdes-innova.online/generate
IMAGE_GEN_TIMEOUT_MS=15000
IMAGE_OUT_DIR=./data/images

# TMD (blocked P-159)
TMD_UID_API=api          # placeholder
TMD_UKEY_API=api12345    # placeholder — ต้องสมัครจริง
TMD_UID_DEMO=demo
TMD_UKEY_DEMO=demo

# NWP (blocked P-158)
NWP_API_KEY=<jwt_with_empty_scopes>  # ต้องขอใหม่
```

---

## Testing Strategy

| Test type | Location | Command |
|-----------|---------|---------|
| Unit (Jest) | `innomcp-node/tests/` | `npm test` |
| Thai NLP | `innomcp-node/tests/thaiNLP.test.ts` | `npm test -- thaiNLP` |
| MCP tools | `innomcp-server-node/tests/` | `npm test` |
| E2E (Playwright) | `innomcp-next/e2e/` | `npx playwright test` |
| Verify scripts | `innomcp-node/scripts/verify_*` | `npx ts-node scripts/verify_...ts` |

**All passing now:** 444 Jest + 90 NLP + 61 Playwright + 195 query coverage = **790 total**

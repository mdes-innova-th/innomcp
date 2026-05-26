# Contributing to INNOMCP

## Development Setup

### Prerequisites
- Node.js 20+
- npm 10+
- MariaDB 11 (or Docker)
- Git

### First-time Setup

```bash
# Clone
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp

# Install ALL dependencies (run in both packages)
cd innomcp-node && npm install && cd ..
cd innomcp-next && npm install && cd ..

# Copy environment
cp .env.example .env.local
# Edit .env.local with your DB credentials
```

### ⚠️ Critical: Adding New npm Packages

**If you add a new `import X from 'some-package'` in `innomcp-node/src/`**, you MUST:

```bash
# In innomcp-node/ — install the RUNTIME package
cd innomcp-node
npm install some-package --save  # runtime dependency

# NOT this (types only, causes crash):
npm install @types/some-package  # types only ← runtime still missing
```

**Why this matters**: `tsc --noEmit` succeeds if `@types/*` is installed, even if the runtime package is absent. The server crashes on startup with `MODULE_NOT_FOUND`. The pre-commit hook verifies this — if you see "❌ Missing runtime packages", run `npm install` in the right directory.

### Development Workflow

```bash
# Terminal 1 — Backend (port 3011)
cd innomcp-node
npm run dev

# Terminal 2 — Frontend (port 3000)
cd innomcp-next
npm run dev

# Terminal 3 — Watch TypeScript errors
cd innomcp-node && npx tsc --noEmit --watch
```

### Pre-commit Hook

The pre-commit hook (`.githooks/pre-commit`) runs:
1. **Dependency check** — verifies all `package.json` deps are installed in `node_modules`
2. **Module resolution** — verifies `dist/app.js` can be required without `MODULE_NOT_FOUND`
3. **Smoke tests** — hits `/api/health` to confirm the running server responds

If the hook fails at step 1 or 2, run `npm install` in `innomcp-node/`.

### Running Tests

```bash
# Unit + integration (Jest)
cd innomcp-node && npm test

# E2E (Playwright) — requires running server
npx playwright test

# Specific test file
npx playwright test tests/manus-parity.spec.ts
npx playwright test tests/phase5-features.spec.ts
```

### Architecture Quick Reference

| File | What it does |
|------|-------------|
| `agents/conductor.ts` | Orchestrates all sub-agents, fallback chain |
| `providers/registry.ts` | In-memory provider registry (6 providers) |
| `services/providerAdapter.ts` | HTTP client for OpenAI/Anthropic/Ollama |
| `middleware/cacheMiddleware.ts` | GET response cache (user-scoped key) |
| `plugins/registry.ts` | Plugin registry |
| `services/webhookService.ts` | Webhook delivery (HMAC-SHA256) |

### Adding a New API Route

1. Create `src/routes/api/myRoute.ts` following existing patterns
2. Register in `src/app.ts` with `app.use("/api/my-route", generalRateLimit, myRouter)`
3. If it needs a new npm package: `npm install package --save` in `innomcp-node/`
4. Add E2E test in `tests/`

### Adding a New Provider

1. Add seed in `providers/registry.ts` (env-gated: `if (process.env.MY_API_KEY)`)
2. Handle its type in `services/providerAdapter.ts`
3. Test: `POST /api/providers/test-call { providerId: "seed-my-provider", message: "test" }`

### Commit Message Format

```
feat(scope): short description

Longer explanation if needed.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
```

### Common Pitfalls

| Problem | Fix |
|---------|-----|
| `MODULE_NOT_FOUND` on server start | `cd innomcp-node && npm install` |
| TypeScript happy but server crashes | Check runtime deps, not just @types |
| Dashboard shows 401 | Check API key setup in DB |
| Cache returns stale data | `POST /api/cache/clear` |
| Webhook test fails | Verify URL is HTTPS and publicly reachable |

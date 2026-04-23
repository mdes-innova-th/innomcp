# Hermes Skills Pack (from Claude)

These are skills Claude transfers to Hermes for autonomous execution.
When running Hermes via ask_local_ai, Claude includes relevant sections here as system context.

---

## SKILL: TypeScript / Node.js

```
Stack: Node.js + TypeScript + ts-node
Pattern: Express router, async/await, strict null checks
Tests: Jest (ts-jest), Playwright (e2e)
Always: full file output, no snippets
```

## SKILL: innomcp Architecture

```
innomcp-node (port 3011): Main backend
  src/routes/api/chat.ts — primary routing hub (~7200 lines)
  src/utils/thaiQueryNormalizer.ts — query alias normalization
  src/mcp/ — MCP client tools
  src/.env — OLLAMA_MODEL, REMOTE_OLLAMA_MODEL, FAST_OLLAMA_MODEL

innomcp-next (port 3000): Next.js frontend
  src/app/api/ — API routes
  src/components/ — React components

innomcp-server-node (port 3012): MCP tool server
  src/mcp/tools/ — tool implementations (thaiGeoTool, thaiKnowledgeTool, etc.)

DB: MariaDB (port 3308 external → 3306 internal)
AI: Ollama local (172.22.64.1:11434), Remote (ollama.mdes-innova.online)
```

## SKILL: Thai Query Routing

```
Routes: weather | geo | evidence | calculator | datetime | general | thaiKnowledge
Normalizer: thaiQueryNormalizer.ts handles province aliases
Fallback: low-confidence → general LLM path
Always: use existing route guards, don't bypass geoGate
```

## SKILL: MCP Tool Pattern

```
Each tool: schema (zod) + handler function + registration in server
Pattern: tool file in src/mcp/tools/, registered in src/mcp/server.ts
Return: { success, data, error? } pattern
```

## SKILL: Testing Patterns

```
Jest unit test: describe/it/expect, mock Ollama via jest.mock
Playwright e2e: page.goto, page.fill, page.click, expect(page).toHave*
Fixture: SMOKE_MODE=1 for fast mock path
Always: run both unit + e2e before marking done
```

## SKILL: Git Workflow

```
commit: feat/fix/docs/test(scope): message
Never: commit broken code
Always: include test proof in commit message
Push: only after green tests
```

## SKILL: Error Handling (innomcp style)

```
Honest degraded mode: 🔵 no data | 🔴 upstream error | ⚠️ partial
Never: fake data, never silent failure
Always: log error, return honest degraded response to user
```

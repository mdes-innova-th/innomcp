# ClaudeCode Skills Pack (from Claude)

These are skills Claude activates for ClaudeCode (kimi-k2.5:cloud) on complex tasks.
Include relevant sections in the system prompt when delegating via ask_local_ai.

---

## SKILL: Architecture Analysis

```
Pattern: Identify data flow, coupling points, failure modes
Output: Decision tree + recommended approach + trade-offs
Always: State assumptions, flag risks, cite existing code patterns
```

## SKILL: TypeScript / Node.js (Deep)

```
Stack: Node.js + TypeScript + ts-node
Pattern: Express router, async/await, strict null checks
Tests: Jest (ts-jest), Playwright (e2e)
Deep: Type inference, generics, discriminated unions, conditional types
Always: full file output, no snippets, preserve existing imports
```

## SKILL: innomcp Architecture

```
innomcp-node (port 3011): Main backend
  src/routes/api/chat.ts — primary routing hub (~7200 lines)
  src/utils/thaiQueryNormalizer.ts — query alias normalization
  src/utils/thaiTemporalParser.ts — Thai time/date parsing
  src/utils/thaiMultiLocationParser.ts — multi-province detection
  src/mcp/ — MCP client tools
  src/.env — OLLAMA_MODEL, REMOTE_OLLAMA_MODEL, FAST_OLLAMA_MODEL

innomcp-next (port 3000): Next.js frontend
  src/app/api/ — API routes
  src/middleware.ts — RBAC guard for /admin/*
  src/components/ — React components

innomcp-server-node (port 3012): MCP tool server
  src/mcp/tools/ — thaiGeoTool, thaiKnowledgeTool, thaiWeatherTool, etc.

DB: MariaDB (port 3308 external → 3306 internal)
AI: Ollama local (172.22.64.1:11434), Remote (ollama.mdes-innova.online)
Project phase: 78% complete (Phase 101-105 done)
```

## SKILL: Thai Domain Logic

```
Domains: weather | geo | evidence | calculator | datetime | general | thaiKnowledge
Normalizer: thaiQueryNormalizer.ts (province aliases, tone mark variants)
Temporal: thaiTemporalParser.ts (Thai date expressions → Date object)
Multi-location: thaiMultiLocationParser.ts (77 provinces + aliases)
Routing: confidence-based in chat.ts, geoGate guard
```

## SKILL: Security & Code Review

```
OWASP Top 10 awareness
JWT validation (edge-compatible, no full jose library in middleware)
SQL: parameterized queries only (MariaDB pool)
Input: validate at boundary, sanitize Thai text inputs
Auth: NextAuth session + RBAC middleware guard
Flag: any eval(), any raw SQL concatenation, any unvalidated user input
```

## SKILL: API Design

```
Pattern: REST JSON, { success, data, error? } envelope
Versioning: /api/v1/ prefix for new endpoints
Validation: zod for MCP tools, manual for Express routes
Error: HTTP status + { error: string } body
Rate limiting: consider for public endpoints
Auth: Bearer JWT or session cookie
```

## SKILL: MCP Tool Pattern

```
Each tool: zod schema + handler + registration in server
Location: innomcp-server-node/src/mcp/tools/<toolName>.ts
Register in: innomcp-server-node/src/mcp/server.ts
Return: { success: boolean, data: any, error?: string }
Test: innomcp-server-node/tests/<toolName>.test.ts
```

# INNOMCP Agent Guidelines

## Multi-Agent Architecture

### Agent Hierarchy
```
conductor.ts (Orchestrator)
├── parallelDispatch.ts (Fan-out to MDES agents)
│   ├── Concierge — Thai response formatting (gemma3:12b)
│   ├── Thinker — deep analysis (gemma3:12b)
│   ├── Researcher — fact finding (gemma3:12b)
│   ├── Critic — quality verifier (gemma3:12b)
│   ├── Fact Checker — accuracy guard (gemma3:12b)
│   ├── Stylist — language polish (gemma3:12b)
│   └── Linguist — Thai language expert (ThaiLLM)
├── Tool Agents
│   ├── Shell Executor — shellTool.ts (safe execution + SSE streaming)
│   ├── Web Fetcher — webFetchTool.ts (SSRF protected)
│   └── Data Analyst — dataAnalysisTool.ts (CSV + SVG charts)
└── Provider Adapters (providerAdapter.ts)
    ├── Local Ollama     priority:90 (minimax-m2.5)
    ├── Claude Sonnet    priority:80 (claude-sonnet-4-6)
    ├── Claude Haiku     priority:75 (claude-haiku-4-5)
    ├── GitHub Copilot   priority:65 (gpt-4o)
    ├── GPT-4o-mini      priority:60 (gpt-4o-mini)
    └── MDES Remote      priority:70 (gpt-oss:120b)
```

## Tool Safety Matrix

| Tool | Scope | Risk | Approval |
|------|-------|------|----------|
| Shell exec | WORKSPACE_ROOT | HIGH | Required for write ops |
| Web fetch | External URLs | MED | SSRF blocked |
| File read | WORKSPACE_ROOT | LOW | None |
| File write | WORKSPACE_ROOT | MED | None (sandboxed) |
| Data analyze | Uploaded files | LOW | None |

## SSE Event Types
```
route_selected     → Intent classified
agent_started      → Sub-agent began work
tool_call_started  → Tool execution begins (live stream)
tool_call_finished → Tool result received
fact_found         → Intermediate finding
approval_required  → User must confirm risky action
final_answer       → Complete response ready
error              → Something went wrong
```

## Adding a New Provider
1. Add seed in `providers/registry.ts` (env-gated via `process.env.KEY`)
2. Implement adapter in `services/providerAdapter.ts` (openai/anthropic/ollama)
3. Test: `POST /api/providers/test-call { providerId, message }`
4. Monitor: `POST /api/providers/health-check`

## Adding a New Tool
1. Create `services/myTool.ts` with typed input/output
2. Create `routes/api/myTool.ts` with Express router
3. Register in `app.ts` with `generalRateLimit`
4. Register plugin in `plugins/registry.ts`
5. Emit `tool_call_started` / `tool_call_finished` SSE events

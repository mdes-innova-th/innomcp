# INNOMCP System Architecture

## Request Pipeline
```
User → ChatInput (drag-drop, voice, file) 
     → POST /api/chat/stream
     → eventGuard → rateLimit → auth
     → fastpathChatMiddleware (greeting shortcut)
     → intentClassifier (th/en/mixed detection)
     → conductor.runConductor()
       → parallelDispatch (MDES fan-out, 3-7 agents)
       → tool calls (shell/fetch/analyze)
       → providerAdapter fallback chain
       → responseComposer.synthesize()
     → SSE stream → AgentWorkspacePanel (live)
     → final_answer → ChatMessage
     → task saved → webhook fired
```

## Storage Layers
| Layer | Store | TTL |
|-------|-------|-----|
| Short-term | In-process Map (providers, plugins, webhooks) | Process lifetime |
| Session | sessionMemory.ts | Request duration |
| Persistent | MariaDB (tasks, messages, memories, feedback) | Forever |
| Cache | cacheMiddleware.ts Map | 30s–5m |
| Files | WORKSPACE_ROOT filesystem | Until deleted |

## Key Modules
| File | Responsibility |
|------|----------------|
| `agents/conductor.ts` | Orchestrates all sub-agents, fallback chain |
| `agents/parallelDispatch.ts` | Fan-out to MDES model pool |
| `agents/eventGuard.ts` | Validates SSE events, naturalnessGuard |
| `providers/registry.ts` | In-memory provider registry (6 providers) |
| `services/providerAdapter.ts` | HTTP client for OpenAI/Anthropic/Ollama |
| `services/shellTool.ts` | Safe shell with allowlist, SIGTERM timeout |
| `services/webFetchTool.ts` | SSRF-safe URL fetcher, 1hr cache |
| `services/dataAnalysisTool.ts` | CSV parser + SVG chart generator |
| `services/webhookService.ts` | HMAC-SHA256 webhook delivery |
| `plugins/registry.ts` | In-memory plugin registry |
| `middleware/cacheMiddleware.ts` | GET response cache (X-Cache header) |
| `utils/thaiIntentEnhancer.ts` | Language/intent scoring for Thai queries |

## Security Boundaries
- Shell: blocklist (rm -rf, sudo, curl|sh) + allowlist + path traversal check
- Web fetch: SSRF guard (10.x, 172.16.x, 192.168.x, 169.254.x blocked)
- File tool: restricted to `WORKSPACE_ROOT`
- API keys: stored as `apiKeyRef` (env var name, never logged)
- Webhooks: HMAC-SHA256 signature in `X-INNOMCP-Signature` header

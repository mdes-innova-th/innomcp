<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-003 role=learn model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1679,"completion_tokens":2290,"total_tokens":3969,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2520,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T11:58:27.685Z -->
- **Responsibility:** Canonical SSE event contract for the agent-to-frontend stream; defines the public-safe schema, runtime shape validator, and envelope factory.
- **Key API:** `AgentEvent` interface, `AgentEventType`/`AgentId` unions, `validateAgentEvent()` checker, `newEnvelope()` factory.
- **Callers & Deps:** Orchestrator/agents use these types to build `/api/chat/stream` payloads; frontend `ThinkingPanel` consumes them. No internal runtime deps (schema-only), though `eventGuard.ts` is the complementary safety gate.
- **Pipeline role:** Boundary contract layer that translates raw internal agent activity into a strictly user-safe, serializable stream shape before UI consumption.
- **Surprising coupling:** Hardcoded Thai role labels (`AGENT_ROLE_LABEL_TH`) in the backend schema module, tightly coupling event definitions to frontend UI localization.

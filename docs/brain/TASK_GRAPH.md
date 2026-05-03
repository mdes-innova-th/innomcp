# Phase C Task Graph

> Open work items with dependencies. Updated by Hermes-style writes; do NOT silently delete completed nodes — mark them done.

Legend: `[ ]` open, `[~]` in progress, `[x]` done, `[!]` blocked, `[~stub]` stubbed for the slice.

---

## C-1 — Brain & architecture docs

- [x] `docs/brain/INNOMCP_BRAIN.md`
- [x] `docs/brain/SECOND_BRAIN.md`
- [x] `docs/brain/AGENT_WORKSTREAM_CONTRACT.md`
- [x] `docs/brain/DECISION_LOG.md`
- [x] `docs/brain/TASK_GRAPH.md` (this file)
- [ ] `innomcp-node/data/knowledge-base/living-agent-chat.md` (RAG-loaded)
- [ ] `docs/reports/PHASE_C_LIVING_AGENT_CHAT_OPUS_RECOVERY_EVIDENCE.md`

## C-2 — Backend agent event contract + provider router foundation

- [ ] `innomcp-node/src/agents/events.ts` — `AgentEvent`, `AgentEventType`, `AgentId`, Zod schemas
- [ ] `innomcp-node/src/agents/eventGuard.ts` — pre-write public-safe substring scanner
- [ ] `innomcp-node/src/providers/types.ts` — `ProviderRecord`, `Capability`, `ProviderType`
- [ ] `innomcp-node/src/providers/registry.ts` — in-memory map + DB hydration stub
- [ ] `innomcp-node/src/providers/router.ts` — `selectProvider({capability, privacyLevel, mode})`
- [ ] `innomcp-node/src/routes/api/providers.ts` — `GET/POST/PATCH/DELETE /api/ai/providers` + `/test` + `/route-preview`

> Depends on: C-1 done. Blocks: C-3, C-5.

## C-3 — Backend streaming chat orchestration

- [ ] `innomcp-node/src/agents/conductor.ts` — orchestrator that emits AgentEvents
- [ ] `innomcp-node/src/agents/concierge.ts` — composer (LLM call against selected provider)
- [ ] `innomcp-node/src/agents/toolScout.ts` — tool selection + execution wrapper around `mcpclient`
- [ ] `innomcp-node/src/agents/weatherAnalyst.ts`
- [ ] `innomcp-node/src/agents/geoPlanner.ts`
- [ ] `innomcp-node/src/agents/critic.ts`
- [ ] `innomcp-node/src/agents/stylist.ts`
- [ ] `innomcp-node/src/services/naturalnessGuard.ts` — block-list checker
- [ ] `innomcp-node/src/services/intentClassifier.ts` — `planning-broad | weather | calc | code | map | general`
- [ ] `innomcp-node/src/routes/api/chatStream.ts` — `POST /api/chat/stream` SSE
- [ ] Wire route in `innomcp-node/src/app.ts`

> Depends on: C-2 done. Blocks: C-4, C-7.

## C-4 — Frontend thinking panel + streaming UI

- [ ] `innomcp-next/src/app/components/chat/ThinkingPanel.tsx` — collapsed-by-default, public-only
- [ ] `innomcp-next/src/app/components/chat/AgentEventStream.ts` — typed SSE consumer hook
- [ ] `innomcp-next/src/app/components/chat/StreamingChatMessage.tsx` — wraps `ChatMessage` with delta accumulation + thinking-panel rail
- [ ] Integrate behind a feature flag (`NEXT_PUBLIC_LIVING_AGENT=1`) so existing ChatPage path stays default until E2E proves green

> Depends on: C-3 done.

## C-5 — Frontend provider management modal

- [ ] `innomcp-next/src/app/components/settings/ProviderModal.tsx`
- [ ] `+ Add AI Provider` button in `AIModelSelector.tsx`
- [ ] Form: name, type, baseUrl, apiKey (secret input), model, capability tags, priority, test connection, save, delete/disable, set preferred

> Depends on: C-2 done. Independent of C-3/C-4.

## C-6 — Feedback learning loop

- [ ] Migration: `mariadb/database_schema.sql` — `response_feedback`, `preference_memory`, `route_quality_signal`
- [ ] `innomcp-node/src/services/feedbackStore.ts` — insert + aggregate
- [ ] `innomcp-node/src/routes/api/feedback.ts` — `POST /api/chat/feedback`
- [ ] Frontend feedback controls in `StreamingChatMessage.tsx`: thumbs up/down, regenerate, "more natural", "remember style"
- [ ] Reason picker on thumbs down: robotic | wrong_route | too_short | too_long | missing_tools | not_grounded | confusing_language | other
- [ ] Conductor reads `route_quality_signal` to bias provider/model selection

> Depends on: C-3 done (uses runId/messageId).

## C-7 — Tests

- [ ] Backend unit (jest):
  - `innomcp-node/tests/unit/agentEvents.test.ts` — schema validation + forbidden-key scan
  - `innomcp-node/tests/unit/naturalnessGuard.test.ts` — block patterns
  - `innomcp-node/tests/unit/intentClassifier.test.ts`
  - `innomcp-node/tests/unit/providerRouter.test.ts`
  - `innomcp-node/tests/unit/feedbackStore.test.ts`
- [ ] Browser E2E (`innomcp-next/e2e/living-agent-chat.spec.ts`):
  - Case 1: rainy-season seminar planning query (vertical slice)
  - Case 2: BKK weather + travel advice
  - Case 3: deterministic calculator query (no LLM, low latency, panel says "deterministic path")
  - Case 4: Thai general knowledge (Thai-first)
  - Case 5: Provider modal (open + form + validate + test mock + save mock)
  - Case 6: Mode switching (local/remote/hybrid + route preview)
  - Case 7: Feedback thumbs down + regenerate avoids prior canned phrase
  - Case 8: No raw chain-of-thought leak (forbidden field/string scan over network traffic + DOM)

> Depends on: C-3, C-4, C-5, C-6 done.

## C-8 — Evidence

- [ ] `docs/reports/PHASE_C_LIVING_AGENT_CHAT_OPUS_RECOVERY_EVIDENCE.md`
- [ ] Screenshot trail (Playwright `screenshots/`)
- [ ] Backend log path
- [ ] Provider routing example transcript
- [ ] Test result table (jest + playwright)
- [ ] Honest blocker list

---

## Cross-cutting

- [ ] Existing release gate (59/59 + 61/61) MUST stay green at every commit boundary.
- [ ] No raw private chain-of-thought in the SSE stream, ever.
- [ ] No API keys in logs, ever.
- [ ] No mega-commit (≤ ~700 LOC per commit, themed).
- [ ] No merge to main until browser E2E case 1 + case 8 pass.

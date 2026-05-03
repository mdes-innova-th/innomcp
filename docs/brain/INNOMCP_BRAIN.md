# INNOMCP Brain — Phase C Living Agent Chat
**Branch:** `phase-c-living-agent-chat-opus-recovery`
**Base:** `1654370` (clean baseline from Phase A.4)
**Created:** 2026-05-03 (Opus recovery after Codex worktree loss)

> The single canonical context document for the Phase C living agent chat work. Every sub-agent or future session reads this first before touching code.

---

## Why this exists

INNOMCP is a Thai-first public-service AI assistant + MCP platform. Phase A.4 proved the gates green from a clean HEAD (59/59 + 61/61) but the chat **still feels robotic in real screenshots**:
- Template-style weather answers
- "กรุณาระบุจังหวัด" given as the entire response to broad planning questions
- Confusing online/offline state (mostly fixed in honest-state work)
- Irrelevant `Weather Map Placeholder` warning shown on non-map answers
- No visible multi-agent thinking (the AI feels like one black-box turn)
- No feedback learning loop

**Phase C goal:** turn the chat into a **human-feeling, streaming, grounded, multi-agent assistant** with a small public "ดูทีม AI กำลังคิด" workstream panel.

---

## What changed in this branch (so far)

Codex 5.5 had a previous Phase C attempt that lived in `/workspaces/innomcp-phase-c` (Codespaces/container path, not visible on this Windows host) and was **never pushed**. Commits `fd4314e` and `a60ab13` are unreachable from any local or remote git database. The Codex work is unrecoverable.

Recovery decision: rebuild Phase C from the `1654370` clean baseline on a new branch named `phase-c-living-agent-chat-opus-recovery` so the original `phase-c-living-agent-chat-codex` remains a known dead alias and is not silently overwritten.

---

## Architecture summary

```
              ┌────────────────────────────────────────────┐
              │  Frontend (innomcp-next)                   │
              │  ┌──────────────┐    ┌──────────────────┐  │
              │  │ ChatMessage  │◄───│ ThinkingPanel    │  │
              │  │  (main text) │    │ (workstream UI)  │  │
              │  └──────┬───────┘    └────────┬─────────┘  │
              │         │ SSE                 │ same SSE   │
              └─────────┼─────────────────────┼────────────┘
                        ▼                     ▼
              ┌────────────────────────────────────────────┐
              │  Backend (innomcp-node)                    │
              │  POST /api/chat/stream  (SSE)              │
              │  ┌────────────────────────────────────────┐│
              │  │  Conductor (orchestrator)              ││
              │  │  emits AgentEvent[] + main answer δ    ││
              │  └────┬─────────────┬───────────┬─────────┘│
              │       ▼             ▼           ▼          │
              │  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
              │  │ Tool    │  │ Weather  │  │ Naturalness│ │
              │  │ Scout   │  │ Analyst  │  │ Stylist    │ │
              │  └─────────┘  └──────────┘  └──────────┘  │
              │  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
              │  │ Geo/Plan│  │ Knowledge│  │ Grounding│  │
              │  │ Agent   │  │ /RAG     │  │ Critic   │  │
              │  └─────────┘  └──────────┘  └──────────┘  │
              │       │                                    │
              │  ┌────▼──────────┐    ┌────────────────┐   │
              │  │ Provider      │    │ Memory Scribe  │   │
              │  │ Broker        │    │ (feedback)     │   │
              │  └───┬───────────┘    └────────────────┘   │
              └──────┼────────────────────────────────────┘
                     ▼
              ┌─────────────────────────────────┐
              │ Local Ollama (11434)            │
              │  - minimax-m2.5:cloud (composer)│
              │  - gpt-oss:120b-cloud (reason)  │
              │  - kimi-k2.5:cloud              │
              │  - qwen3-vl:4b (vision)         │
              │  - deepseek-r1:8b (fallback)    │
              │  - qwen2.5-coder:7b (code)      │
              └─────────────────────────────────┘
              ┌─────────────────────────────────┐
              │ Remote MDES Ollama              │
              │ https://ollama.mdes-innova.online│
              └─────────────────────────────────┘
              ┌─────────────────────────────────┐
              │ User-added providers            │
              │ OpenAI/Anthropic/custom-compatible│
              └─────────────────────────────────┘
```

## Hard rules (non-negotiable)

1. **Thai is the primary user-facing language.** English is fallback only. Workstream labels are Thai.
2. **Never expose raw private chain-of-thought.** Stream only `AgentEvent.publicSummary` (Thai, short, safe).
3. **Forbidden output strings (the chat must NOT emit any of these as a whole-answer):**
   - `กรุณาระบุจังหวัด` as the entire answer to a broad planning query
   - `Weather Map Placeholder`, `Deterministic Local Static Tile`, `placeholder`, `ข้อมูลไม่ครบสำหรับการแสดงแผนที่` outside an actual map component
   - Raw JSON in user-visible answers
   - `Used tools: none` when a tool was expected
   - English-first answers for Thai queries
4. **Forbidden field names anywhere in SSE payload:**
   - `privateThought`, `hiddenReasoning`, `chainOfThought`, `rawThought`, `innerMonologue`
5. **Never log API keys.** Provider registry must store secrets via `apiKeyRef` (env-var name) or encrypted blob; never plaintext in logs.
6. **No mega-commit.** Every commit ≤ ~700 LOC and themed.
7. **No merge to main until browser E2E passes.** WIP push only.
8. **Existing release gate (59/59 + 61/61) must remain green** at every commit boundary — Phase C builds alongside, doesn't replace.

## Vertical slice for first iteration

Single test query to prove the pipeline:

> ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง

Expected behavior:
- Main answer streams in Thai-led prose
- Thinking panel shows ≥3 public events (route_selected, agent_started, fact_found)
- Answer contains: a method/first-pass plan, decision dimensions (rain risk + travel access + venue readiness), explicit uncertainty, 1–3 follow-up questions
- Answer does NOT contain: "กรุณาระบุจังหวัด" alone, raw JSON, map placeholder warnings
- Latency to first token < 2 s on local Ollama with `minimax-m2.5:cloud`

## Sequence of commits planned for this branch

| # | Theme | What ships |
|---|---|---|
| C-1 | docs: living multi-agent chat architecture | `docs/brain/*.md`, `docs/reports/PHASE_C_*` skeleton, KB doc |
| C-2 | backend: agent event contract + provider router foundation | types, validators, registry stub |
| C-3 | backend: streaming chat orchestration | `/api/chat/stream` SSE + Conductor + minimum 3 agents (Concierge, Tool Scout, Naturalness Stylist) |
| C-4 | frontend: thinking panel + streaming UI | `<ThinkingPanel>`, SSE client, ChatMessage integration |
| C-5 | frontend: provider management modal | `+ Add AI Provider` modal skeleton, list/test/save flow |
| C-6 | backend/frontend: feedback learning loop | thumbs up/down + reasons, `feedback_store` table, regenerate path |
| C-7 | tests: living-agent browser E2E + unit coverage | `living-agent-chat.spec.ts` case 1 + case 8 (no CoT leak), backend jest units |
| C-8 | docs: evidence report | `PHASE_C_LIVING_AGENT_CHAT_OPUS_RECOVERY_EVIDENCE.md` |

## Index to other brain files

- [SECOND_BRAIN.md](SECOND_BRAIN.md) — runtime knowledge: model catalog, provider registry shape, agent role catalog
- [DECISION_LOG.md](DECISION_LOG.md) — append-only design decisions with date + rationale
- [AGENT_WORKSTREAM_CONTRACT.md](AGENT_WORKSTREAM_CONTRACT.md) — the public-safe SSE event schema
- [TASK_GRAPH.md](TASK_GRAPH.md) — current open work items with dependencies
- [innomcp-node/data/knowledge-base/living-agent-chat.md](../../innomcp-node/data/knowledge-base/living-agent-chat.md) — RAG-loaded user-facing description

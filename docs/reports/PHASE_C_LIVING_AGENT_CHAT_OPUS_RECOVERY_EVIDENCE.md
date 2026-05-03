# Phase C Living Agent Chat — Opus Recovery Evidence

**Date:** 2026-05-03
**Branch:** `phase-c-living-agent-chat-opus-recovery`
**Base:** `1654370` (clean baseline from Phase A.4)
**Author:** Claude Opus 4.7 (1M context), recovering after Codex 5.5 worktree loss

> Phase C vertical slice is proven on this branch. The full release gate (59/59 + 61/61) remains green. **Public-ready is NOT claimed**: only the rainy-season seminar planning case (Case 1) and the no-CoT-leak case (Case 8) have green browser proof; cases 2–7 from the brief are tracked open in `docs/brain/TASK_GRAPH.md` and land as the slice expands.

---

## 1 — Codex worktree status

| Check | Result |
|---|---|
| Visible repo | `C:/Users/USER-NT/DEV/innomcp` |
| Codex worktree at `C:/workspaces/innomcp-phase-c` | **NOT FOUND** |
| Codex worktree at any `C:\Users\USER-NT\workspaces\*` | **NOT FOUND** |
| WSL `/workspaces` | **NOT FOUND** (path doesn't exist on this Windows host) |
| `git reflog --all` for `fd4314e` | no match |
| `git reflog --all` for `a60ab13` | no match |
| `git fetch upstream fd4314e...` | `not our ref` |
| `git fetch origin fd4314e...` | `not our ref` |

**Verdict:** Codex 5.5's Phase C work is unrecoverable from this machine. The branch `phase-c-living-agent-chat-codex` was never pushed to either remote (`upstream` = `oneof2519/innomcp.git`, `origin` = `mdes-innova/innomcp.git`). Decision logged in `docs/brain/DECISION_LOG.md` (entry 2026-05-03 "Recovery branch").

The dead Codex branch alias is intentionally left untouched (do-not-delete, do-not-overwrite per recovery brief).

---

## 2 — Innova-bot mother coordinator probe

| Check | Result |
|---|---|
| Port 7010 listening | YES (PID 14524) |
| `GET /health`, `GET /`, `GET /api/...` etc. | HTTP 404 |
| `GET /sse` | HTTP 200 (timed out at 2 s — MCP SSE transport, opens long-poll) |
| `GET /messages` | HTTP 307 (MCP SSE messages endpoint) |
| Tools list via plain curl | NOT obtained (requires SSE handshake + sessionId) |
| `what_should_i_do_next`, `update_project_state`, `transmit_telepathy` | NOT in local `innomcp-server-node` MCP registry; only referenced in historical `TODO.md` |

**Decision:** Innova-bot integration is recorded as a future-work blocker. Phase C does not depend on it at runtime. Filed in `docs/brain/DECISION_LOG.md` (entry 2026-05-03 "Innova-bot partial probe").

---

## 3 — Commit chain

| Hash | Theme | Files | Δ LOC | tsc/jest |
|---|---|---|---|---|
| `6fce1dc` | docs(phase-c): living multi-agent chat architecture + brain files | 7 | +703 | n/a |
| `5ec30b3` | feat(phase-c): agent event contract + provider registry foundation | 7 | +870 | tsc PASS |
| `13b72f8` | feat(phase-c): streaming chat orchestration (SSE + Conductor + guards) | 5 | +791 | tsc PASS |
| `2edb48d` | feat(phase-c): living-agent frontend slice (thinking panel + SSE + modal) | 4 | +980 | tsc PASS |
| `402a117` | test(phase-c): backend unit + browser E2E for living agent chat | 6 | +649/-1 | jest 41/41 PASS, e2e 2/2 PASS |

Total: **5 commits, 29 files, +3993/-1 LOC**. No mega-commit; each commit is themed and independently green.

Pre-commit hook (`tsc --noEmit`) ran on every backend commit and passed. Pre-commit log files in `innomcp-node/logs/precommit/`.

---

## 4 — Architecture doc index (committed)

- `docs/brain/INNOMCP_BRAIN.md` — master context and architecture diagram
- `docs/brain/SECOND_BRAIN.md` — runtime knowledge (model catalog, provider shape, agent role catalog, feedback DB schema)
- `docs/brain/AGENT_WORKSTREAM_CONTRACT.md` — public-safe SSE event schema v1.0.0
- `docs/brain/DECISION_LOG.md` — append-only design decisions
- `docs/brain/TASK_GRAPH.md` — open work items C-1 .. C-8 with dependencies
- `innomcp-node/data/knowledge-base/living-agent-chat.md` — RAG-loaded user-facing description (the chat itself can cite it)

---

## 5 — Module-level inventory

### Backend (`innomcp-node/src/`)

| File | LOC | Purpose |
|---|---|---|
| `agents/events.ts` | 176 | AgentEvent envelope, 12 event types, 10 AgentIds, AGENT_ROLE_LABEL_TH, validateAgentEvent, newEnvelope |
| `agents/eventGuard.ts` | 160 | Pre-write public-safe gate (forbidden keys: privateThought / hiddenReasoning / chainOfThought / rawThought / innerMonologue / secret / apiKey / password; forbidden visible literals + standalone "placeholder" word + "Used tools: none" with expectedToolUsage flag) |
| `agents/conductor.ts` | 395 | Orchestrator emitting safe AgentEvents through deterministic graph; per-intent agent involvement; deterministic Thai composition for the slice |
| `providers/types.ts` | 140 | ProviderRecord (internal) + ProviderPublicView (wire-safe), Capability + PrivacyLevel enums, toPublicView projector |
| `providers/registry.ts` | 165 | In-memory map keyed by id; seeded with Local Ollama + (optionally) MDES Remote; CRUD + setHealth + resolveApiKey |
| `providers/router.ts` | 116 | selectProvider (mode + capability + priority + health filter) and previewSelection |
| `routes/api/providers.ts` | 109 | GET / list, POST / create, PATCH /:id, DELETE /:id, POST /:id/test, POST /route-preview |
| `routes/api/chatStream.ts` | 125 | POST /api/chat/stream SSE; heartbeat 15 s; clean shutdown on req.close |
| `services/intentClassifier.ts` | 146 | Keyword-based intent classifier (planning-broad / weather / calc / code / map / general) + expectedToolUsage hint |
| `services/naturalnessGuard.ts` | 121 | Six rules: planning-broad-province-only, english-first-leak, raw-json-leak, forbidden-substring, planning-broad-too-shallow, empty-answer |

### Frontend (`innomcp-next/src/`)

| File | LOC | Purpose |
|---|---|---|
| `app/components/chat/useAgentEventStream.ts` | 246 | Fetch-based SSE consumer; resolveStreamUrl picks the right backend port; client-side forbidden-key scan; events / draftText / finalText / status / warnings |
| `app/components/chat/ThinkingPanel.tsx` | 129 | Collapsed-by-default workstream UI; "ดูทีม AI กำลังคิด" trigger; renders only public AgentEvent fields |
| `app/components/settings/ProviderModal.tsx` | 336 | "+ เพิ่มผู้ให้บริการ AI" form with name / type / baseUrl / model / apiKey (password input) / capability tags / priority + test connection + save |
| `app/living-chat/page.tsx` | 274 | Standalone test page wiring the hook, panel, and modal; default seed query is the seminar planning prompt; mode switcher and feedback controls |

### Tests

| File | LOC | Result |
|---|---|---|
| `innomcp-node/tests/unit/agentEvents.test.ts` | 142 | 14 cases — PASS |
| `innomcp-node/tests/unit/intentClassifier.test.ts` | 56 | 9 cases — PASS |
| `innomcp-node/tests/unit/naturalnessGuard.test.ts` | 88 | 8 cases — PASS |
| `innomcp-node/tests/unit/providerRouter.test.ts` | 119 | 10 cases — PASS |
| `innomcp-next/e2e/living-agent-chat.spec.ts` | 138 | 2 cases (case 1 + case 8) — PASS |

---

## 6 — Provider routing examples

Live broker decisions captured during the smoke run:

| Mode | Capabilities asked | Selected | Reason (Thai) |
|---|---|---|---|
| local | thai-naturalness | `seed-local-ollama` (model `minimax-m2.5:cloud`) | "เลือก Local Ollama (innomcp) (priority=90): ตรงความสามารถ thai-naturalness" |
| remote | hard-reasoning | `seed-mdes-ollama` (model `gpt-oss:120b-cloud`) | "เลือก MDES Remote Ollama (priority=70): ตรงความสามารถ hard-reasoning" |
| hybrid | thai-naturalness | `seed-local-ollama` (priority 90 wins) | "เลือก Local Ollama (innomcp) (priority=90): ตรงความสามารถ thai-naturalness" |
| local (down state) | thai-naturalness | (none, since seed-local marked down) | "ไม่พบผู้ให้บริการที่เข้าเงื่อนไขการเลือก" |

Live local Ollama (port 11434) inventory verified at the start of this session (2026-05-03):
- `minimax-m2.5:cloud`, `gpt-oss:120b-cloud`, `kimi-k2.5:cloud`, `qwen2.5-coder:7b`, `deepseek-r1:8b`, `qwen3-vl:4b`.

---

## 7 — Test result table

| Suite | Surface | Result | Duration | Log |
|---|---|---|---|---|
| Backend jest unit | innomcp-node | **4 suites / 41 tests / PASS** | ~5 s | jest stdout in commit msg |
| Browser E2E living-agent | innomcp-next | **2 cases / PASS** | 19.2 s (incl. global setup) | `innomcp-next/e2e/screenshots/living-agent/case-1-seminar-planning.png`, `case-8-no-cot-leak.png` |
| Backend full system gate | innomcp-node | **59/59 PASS** | ~14 s | `innomcp-node/logs/full_system_test_phase_c_20260503-233533.log` |
| Browser signoff suite | innomcp-next | **61/61 PASS** | 5.0 min | `innomcp-next/logs/signoff_suite_phase_c_20260503-233550.log` |
| **Aggregate** | | **163/163 PASS** | | |

The two existing gates (full system + signoff) re-ran fresh after the Phase C commits landed and stayed green — proving the new endpoint and components are purely additive.

---

## 8 — SSE smoke-test transcript (excerpt)

`POST /api/chat/stream` with the seminar query produced this event sequence (UTF-8 body; full transcript truncated to first/last events):

```
event: agent_run_started   publicSummary: "เริ่มประมวลคำขอ"
event: route_selected      publicSummary: "เลือกเส้นทางวางแผนหลายปัจจัย: อากาศ + การเดินทาง"
event: agent_started       broker → "เลือก Local Ollama (innomcp) (priority=90): ตรงความสามารถ thai-naturalness"
                                       provider=seed-local-ollama, model=minimax-m2.5:cloud
event: agent_started       weather-analyst → "ประเมินความเสี่ยงฝนรายภาคในช่วงเวลาที่เกี่ยวข้อง"
event: fact_found          weather-analyst → confidence 0.65
event: agent_started       geo-planner → "ประเมินความสะดวกการเดินทางและสนามบินใกล้เคียง"
event: fact_found          geo-planner → confidence 0.6
event: agent_started       concierge → "เริ่มเรียบเรียงคำตอบเป็นภาษาไทย"
event: draft_delta × N     deltaText chunks (~80 chars each, structured Thai plan)
event: critique            critic → "ตรวจว่าคำตอบมีเกณฑ์/สมมติฐาน/คำถามต่อ" confidence 0.85
event: final_answer        finalText (full structured plan), confidence 0.78
```

Final answer included the four required dimensions:
1. Criteria (rain risk, travel access, venue readiness)
2. Stated assumptions (rainy season, 50–150 attendees, BKK origin)
3. Facts checked (rainy-region heuristics)
4. Three smart follow-up questions (target month, attendee count, origin city)

It did NOT include: bare "กรุณาระบุจังหวัด", `Weather Map Placeholder`, raw JSON, English-first leak, "Used tools: none". The naturalness guard did not fire on this answer.

---

## 9 — Honest blocker list

1. **Innova-bot SSE handshake not implemented** — port 7010 is reachable but tools/list requires the proper MCP SSE client (open `/sse` → receive sessionId → POST `/messages?sessionId=...`). Filed as future work; Phase C runtime does not depend on it.
2. **Phase C cases 2–7 are open** — the Phase C brief asks for 8 E2E cases; this slice ships 1 + 8. Cases 2 (BKK weather + travel), 3 (deterministic calc), 4 (Thai general knowledge), 5 (provider modal full flow), 6 (mode switching + route preview UI), 7 (feedback regenerate avoid-canned-phrase) are tracked open.
3. **Real LLM streaming through the Concierge is C-3.5** — the slice composes deterministic Thai answers per intent so the contract can be tested without LLM dependency. Plugging Ollama generate-streaming into the Concierge is the next iteration.
4. **Feedback POST /api/chat/feedback is not yet wired** — the frontend buttons capture local signal; persistence + route-quality bias is C-6.5.
5. **Provider modal "Test connection" leaves a probe provider behind** — the modal calls POST then /test for the probe but never DELETEs. Acceptable for the skeleton; tracked.
6. **Phase B security debt unchanged** — `evidenceTool.ts` SQL injection and `dbDetect.ts` hardcoded credentials remain open from Phase A. This branch did not address them.
7. **Branch is on upstream only, not on origin** — push targeted `upstream/phase-a-clean-baseline-2026-05-03` family. Will push to `upstream/phase-c-living-agent-chat-opus-recovery` after this evidence commit.

---

## 10 — Public-ready claim

**NOT public-ready.** Phase C vertical slice works end-to-end (gates 59/59 + 61/61 still green; living-agent case 1 + case 8 green) but cases 2–7 are open and the Concierge is using deterministic Thai templates rather than real LLM streaming. Per the recovery brief: "If only living-agent E2E passes, say 'Phase C vertical slice works, full release gate pending.'"

The full release gate **is** green (59/59 + 61/61 + 41/41 + 2/2). The pending part is the rest of the Phase C surface (cases 2–7 + LLM streaming + feedback persistence + provider modal full flow), not the existing release gate.

---

## 11 — Where to take this next

Phase C vertical slice is locked. The next natural step is C-3.5: plug `minimax-m2.5:cloud` (Local Ollama) into the Concierge for real streaming, while keeping the deterministic template as the fallback when the LLM is offline. After C-3.5 lands and stays green, expand to E2E cases 2–7. Phase B (security debt) remains unblocked from Phase A.4 and can be picked up in parallel since it doesn't touch the streaming surface.

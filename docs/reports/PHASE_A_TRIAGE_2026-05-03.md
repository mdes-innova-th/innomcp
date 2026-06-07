# Phase A — Triage Report
**Date:** 2026-05-03
**HEAD:** `15d96a50214a7efacce7cd651cdc8e83bc4a8473`
**Reviewer:** Claude (Opus 4.7) acting as orchestrator + innomcp-program-analyst

> Per Master Review rule: **no commit unless gate green**. Dispositions below are *proposals*; commits happen only after Step 5 passes.

---

## Snapshot context
- Backend uptime on port 3011: ~43 hours (since 2026-05-01 15:13:55, PID 26784) — server is up and serving 56/56 tools, all 6 dependencies healthy.
- "app crashed" lines in `dev-log.txt` were transient nodemon races during prior edit storms; **NOT a current issue**.
- Frontend dev (port 3000, PID 9828) and MCP server (port 3012, PID 16072) also up since the same start time.

---

## Bucket A — Sub-agent infrastructure (gitignored)

`.claude/` is gitignored at line 190 of root `.gitignore`. Files inside `.claude/agents/*.md` are local-only by design. **Not committed**, intentional. To make them sharable, the user would need to either:
- carve an explicit allowlist in `.gitignore`, OR
- store them under `.agents/` (where the existing `pbakaus/impeccable` skills live as symlinks)

| File | Disposition | Reason |
|---|---|---|
| `.claude/agents/innomcp-*.md` (10 files) | KEEP LOCAL | Per-machine agent config, gitignored |
| `.claude/agents/README.md` | KEEP LOCAL | Same |
| `.claude/agents/_shared/` | KEEP LOCAL | Empty dir, scaffold |

**Decision:** no commit needed. If we want them in repo, defer to Phase C as a separate decision.

---

## Bucket B — Memory / RAG

| File | Status | Disposition | Reason |
|---|---|---|---|
| `~/.claude/projects/.../memory/*.md` (8 files) | OUTSIDE REPO | KEEP LOCAL | User-level memory, per Claude Code convention |
| `innomcp-node/data/knowledge-base/agent-orchestration.md` | `??` (new) | **KEEP + COMMIT** | RAG-loaded by ColdRetriever; appears in user-facing answers when relevant |

**Decision:** one commit "docs(rag): add agent-orchestration KB doc" after gate green.

---

## Bucket C — docs/reports

| File | Status | Disposition | Reason |
|---|---|---|---|
| `docs/reports/SIGNOFF_EVIDENCE_2026-04-18.md` | ` M` | **NEEDS REVIEW** | Why was an old signoff edited? Likely stale. Verify diff before acting. |
| `docs/reports/phase10_release_gate.md` | ` M` | **NEEDS REVIEW** | Gate doc — content must match latest evidence; review diff before commit. |
| `docs/reports/SIGNOFF_EVIDENCE_2026-04-28.md` | `??` | KEEP + COMMIT | Latest signoff evidence (allowed by gitignore wildcard). |
| `docs/reports/MASTER_REVIEW.md` | gitignored | KEEP LOCAL | New, but `*.md` is blocked. To track it later, add `!docs/reports/MASTER_REVIEW.md` to gitignore. |
| `docs/reports/PHASE_A_TRIAGE_2026-05-03.md` | gitignored | KEEP LOCAL | This file. |

**Decision:** review the 2 modifications first. If stale or incorrect → revert. If intentional → commit alongside the new SIGNOFF.

---

## Bucket D — Frontend (`innomcp-next`)

**18 modified + 2 untracked = 20 files**

### D.1 Components (visible UI)
| File | Disposition | Reason |
|---|---|---|
| `src/app/components/Header.tsx`, `Footer.tsx`, `ModeStatusBar.tsx` | NEEDS REVIEW | Review diff for Thai-first / honest-state compliance |
| `src/app/components/chat/ChatPage.tsx`, `ChatSidebar.tsx`, `ChatInput.tsx`, `ChatMessage.tsx`, `EvidenceDashboard.tsx`, `GeneratedImageCard.tsx`, `ToolsTypeSelector.tsx`, `AIModelSelector.tsx` | NEEDS REVIEW | Core chat surface — must keep S5–S8 signoff cases passing |
| `src/app/components/common/GlobalLoadingOverlay.tsx`, `common/ui/loading-spinner.tsx` | NEEDS REVIEW | Loading states — must remain consistent across the app |

### D.2 App-level
| File | Disposition | Reason |
|---|---|---|
| `src/app/layout.tsx`, `page.tsx`, `styles/globals.css`, `middleware.ts` | NEEDS REVIEW | Theme/layout level changes; high regression blast radius |
| `src/app/api/health/route.ts` | NEEDS REVIEW | Health proxy — must stay compatible with backend `/api/health` |
| `eslint.config.mjs` | NEEDS REVIEW | Lint rule changes can mask real issues |

### D.3 Tests
| File | Disposition | Reason |
|---|---|---|
| `e2e/chat.spec.ts`, `e2e/signoff.spec.ts` | NEEDS REVIEW | Test logic changes — must not weaken the gate |
| `e2e/impeccable-shot.spec.ts` (new) | NEEDS REVIEW | New visual e2e — verify intentional + green |

### D.4 Helpers
| File | Disposition | Reason |
|---|---|---|
| `src/utils/chatStorage.ts` (new) | NEEDS REVIEW | Confirm consumers exist; no dead code |

**Decision per group:** group D commits in 2–3 chunks after gate green, by area: components / app-level / tests.

---

## Bucket E — Backend (`innomcp-node`)

**22 modified + 7 untracked = 29 files**

### E.1 New services (untracked)
| File | Disposition | Reason |
|---|---|---|
| `src/services/promptAdapter.ts` | NEEDS REVIEW | New adapter — confirm it's wired in and tested |
| `src/services/responseComposer.ts` | NEEDS REVIEW | Composer rewrite candidate — must not regress Thai-first rules |

### E.2 New tests (untracked)
| File | Disposition | Reason |
|---|---|---|
| `tests/unit/aiModeRoute.test.ts`, `healthRoute.test.ts`, `monitoringHealth.test.ts`, `promptAdapter.test.ts`, `redisFallback.test.ts`, `responseComposer.test.ts` | KEEP + COMMIT (after green) | New coverage — accept once they pass jest |

### E.3 Routes & middleware
| File | Disposition | Reason |
|---|---|---|
| `src/routes/api/aiMode.ts`, `chat.ts`, `health.ts` | NEEDS REVIEW | API surface — review for breaking changes |
| `src/middleware/correlationId.ts`, `performanceTracking.ts` | NEEDS REVIEW | Cross-cutting; may affect logging |
| `src/app.ts` | NEEDS REVIEW | Boot wiring — high blast radius |

### E.4 Services & utils
| File | Disposition | Reason |
|---|---|---|
| `src/services/generalGate.ts`, `imageGenService.ts` | NEEDS REVIEW | Generic gate is the Thai-first chokepoint |
| `src/utils/db.ts`, `redis.ts`, `monitoring/index.ts`, `advancedMetrics.ts`, `metrics/latency.ts` | NEEDS REVIEW | Infra utils — review for safety |
| `src/utils/mcp/answerPlanner.ts`, `mcpclient.ts` | NEEDS REVIEW | Routing hot zone (PA hotspot list) |
| `src/utils/fastPathGreeting.ts`, `fastpath/dbPhrasesCache.ts`, `fastpath/rateLimit.ts` | NEEDS REVIEW | Fastpath behaviors — gate-sensitive |
| `src/utils/search/index.ts` | NEEDS REVIEW | Search index — verify no schema break |
| `env.d.ts` | NEEDS REVIEW | New env vars must match `.env.example` |

### E.5 Scripts & test
| File | Disposition | Reason |
|---|---|---|
| `scripts/full_system_test.ts` | NEEDS REVIEW | The gate itself — any change must be intentional and explained |
| `tests/unit/__tests__/fastpathIdentity.test.ts` | NEEDS REVIEW | Existing test edited — confirm spec change |

**Decision:** group E by sub-area into 4–5 commits: new services + tests / routes / middleware / utils / fastpath.

---

## Bucket F — Server-node + scripts

| File | Status | Disposition | Reason |
|---|---|---|---|
| `innomcp-server-node/src/mcp/tools/thaiLawTool.ts` | ` M` | NEEDS REVIEW | MCP tool change — must update tool count and system test if surface changed |
| `innomcp-server-node/scripts/seed_workspace_files.ts` | `??` | NEEDS REVIEW | New script — confirm purpose, idempotency, no destructive write |

**Decision:** small group, 1 commit after review.

---

## Triage summary table

| Bucket | Files | Keep+commit | Needs review | Stash | Revert | Local-only |
|---|---|---|---|---|---|---|
| A — sub-agent infra | 12 | 0 | 0 | 0 | 0 | 12 |
| B — memory/RAG | 9 | 1 | 0 | 0 | 0 | 8 |
| C — docs/reports | 5 | 1 | 2 | 0 | 0 | 2 |
| D — frontend | 20 | 0 | 20 | 0 | 0 | 0 |
| E — backend | 29 | 0 | 29 | 0 | 0 | 0 |
| F — server-node | 2 | 0 | 2 | 0 | 0 | 0 |
| **Total** | **77** | **2** | **53** | **0** | **0** | **22** |

The 53 NEEDS REVIEW files are not auto-rejected — they need the gate to confirm green before commit. **Step 5 (run gates) is the gating decision for all of them.**

---

## Plan from here

1. Run gates fresh against the *current working tree* (Step 5).
2. **If green**: stage the NEEDS REVIEW set in logical groups; produce 5–7 small commits.
3. **If red**: classify the failure (Step 6), narrow to the offending file group, stash or revert; rerun.

**No commits before Step 5 finishes.**

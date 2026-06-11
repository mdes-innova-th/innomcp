# INNOMCP Recovery Plan & New Spec — 2026-06-12

**Planned by**: jit (Fable 5) | **Approved by**: innova (mom)
**Execution**: cc-team (CommandCode provider ONLY — zero Claude tokens on work tasks)
**Mechanical steps**: plain scripts (zero LLM tokens — cheapest possible)

---

## Diagnosis Summary (evidence-based, 2026-06-12)

| Component | Status | Evidence |
|---|---|---|
| innomcp-next (frontend) | ✅ builds clean | `npm run build` passes, all panels exist & wired |
| innomcp-node (backend) | ❌ 70+ tsc errors | 4 services corrupted by MEGA-100 (be7dea7) |
| WebSocket :3011/chat | ❌ never starts | backend can't compile |
| Chat "hello" | ❌ dead | frontend hangs waiting for WS that never listens |

**Root cause**: commit `be7dea7` (MEGA-100 wave, 62 bulk-generated tasks) overwrote 4 core
services with truncated files containing markdown fence markers (```ts) at line 1:

| File | HEAD (broken) | 3007ba2 (clean) | Used by |
|---|---|---|---|
| services/responseFormatter.ts | 65 lines, fence | 171 lines ✅ | chat response pipeline |
| services/toolExecutor.ts | 196 lines, fence | 168 lines ✅ | tool execution |
| services/healthAggregator.ts | 191 lines, fence | 247 lines ✅ | provider health probe |
| services/cacheManager.ts | 98 lines, fence | 165 lines ✅ | session/message cache |

**How it happened**: CODECOMMAND swarm output was committed raw (markdown block copy-paste)
without a build gate. Commit 3007ba2 had already cleaned this once; MEGA-100 re-broke it.

---

## Phase 1 — Backend Resurrection (P0, mechanical + cc-team)

**Goal**: `hello` round-trips through chat again.

| # | Task | Executor | Verify |
|---|---|---|---|
| 1.1 | `git checkout 3007ba2 -- innomcp-node/src/services/{responseFormatter,toolExecutor,healthAggregator,cacheManager}.ts` | script (0 tokens) | files start with valid TS |
| 1.2 | `npx tsc --noEmit` in innomcp-node | script | capture remaining errors |
| 1.3 | If residual errors: dispatch each error cluster to cc-team (deepseek-v4-pro) for patch | cc-team | tsc 0 errors |
| 1.4 | Start backend, confirm WS listens on :3011 | script | `Test-NetConnection -Port 3011` |
| 1.5 | E2E smoke: send "hello" via WS, expect non-empty reply | script (node ws client) | reply received |

**Exit criteria**: tsc 0 errors + backend starts + hello answered.

## Phase 2 — De-quarantine & Wave Triage (P1, cc-team)

**Goal**: remove tech debt left by waves; know what the 180 generated files actually do.

| # | Task | Executor |
|---|---|---|
| 2.1 | Remove `@ts-nocheck` from 6 files (providerManager, thaiGovtTools, thaiIntentRouter, workspaceService, wsEnhancer, warmup) — proper types, one cc-team dev task per file | cc-team |
| 2.2 | Orphan audit: list all Wave 7–10 + MEGA-100 files, classify wired/orphaned/duplicate | cc-team (flash) |
| 2.3 | Produce delete-list of orphans + duplicate hero/panels for mom's approval (NO auto-delete — Nothing is Deleted rule: propose only) | cc-team |

**Exit criteria**: 0 @ts-nocheck in services; audit report in docs/.

## Phase 3 — Chat E2E Hardening (P1, cc-team)

**Goal**: chat never silently hangs again.

| # | Task | Executor |
|---|---|---|
| 3.1 | Frontend: WS connection state UI — "backend down" banner + retry button instead of infinite hang (ChatPage.tsx line ~600) | cc-team |
| 3.2 | Backend: /health endpoint returns build/provider status for frontend probe | cc-team |
| 3.3 | Smoke test suite: hello round-trip, provider select, tool call, WS reconnect (node:test, no deps) | cc-team |

**Exit criteria**: kill backend → UI shows banner within 5s; smoke suite green.

## Phase 4 — Manus.im UX Completion (P2, cc-team)

**Goal**: the 3-column manus-style workspace actually works like manus.im.

| # | Task | Executor |
|---|---|---|
| 4.1 | Error boundaries on ManusWorkspacePanel + MultiAgentPanel (panel fail ≠ page fail) | cc-team |
| 4.2 | Wire AgentStepsView to real dispatch events (manus "Hands On" visibility) | cc-team |
| 4.3 | Apply request_id pattern from Jit `limbs/manus-wrapper.js` to chat dispatch (traceability) | cc-team |
| 4.4 | Layout QA checklist vs manus.im reference (3-column, header, responsive) | cc-team |

## Phase 5 — Regression Guards (P2, mechanical)

**Goal**: bulk-generation can never break main again.

| # | Task | Executor |
|---|---|---|
| 5.1 | Pre-commit hook: reject any staged .ts/.tsx starting with ``` fence | script |
| 5.2 | CI gate script: `tsc --noEmit` both packages before any wave-commit | script |
| 5.3 | Wave policy doc: bulk-generated code goes to branch + build gate + review, never direct to main | doc |

---

## Execution Rules (save แบบขั้นสุด)

1. **Mechanical first**: git restore, tsc, hooks = scripts, 0 LLM tokens
2. **cc-team for all generation**: deepseek-v4-pro (dev), deepseek-v4-flash (test/audit), Qwen3.7-Max (architecture) via `scripts/cc-team-run.js` pattern — CommandCode only
3. **Claude usage**: orchestration + final verification reading only (this session)
4. **SA review**: batch once per phase, not per task
5. **Commit per phase** with phase tag; never bulk-commit unverified generation (Phase 5 enforces)

## Rollback Safety

- Last known good: `7fb8f68` (2026-06-11 09:05)
- Phase 1 only restores 4 files from `3007ba2` — no deletion, full git history preserved
- Every phase = separate commit → independently revertable

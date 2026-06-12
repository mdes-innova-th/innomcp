# INNOMCP Recovery Plan & New Spec — 2026-06-12 (v2, prism-revised)

**Planned by**: jit (Fable 5) | **Approved by**: innova (mom)
**Execution**: cc-team (CommandCode provider ONLY — zero Claude tokens on work tasks)
**Mechanical steps**: plain scripts (zero LLM tokens — cheapest possible)
**v2 changes**: revised by /oracle-prism (design lenses) after Phase 1 execution exposed wrong
assumptions. See "v1→v2 Corrections" at bottom.

---

## NEW SUCCESS DEFINITION (the v1 weakness prism caught)

> v1 measured success as "tsc compiles + WS returns non-empty". That is a FALSE GREEN.
> A real user (mom) measures: **panels render with live data, and chat gives a sensible answer.**

Every phase exit criterion below is now **user-observable**, verified in a real browser /
real WS round-trip — not just a compile.

---

## Diagnosis Summary (evidence-based, corrected 2026-06-12)

| Component | Status | Evidence |
|---|---|---|
| innomcp-next (frontend) | ⚠️ compiles, runtime UNVERIFIED | `npm run build` passes BUT mom reports panels fail at runtime — must browser-test |
| innomcp-node (backend) | ✅ FIXED (Phase 1) | was 70+ tsc errors; now tsc EXIT 0, WS hello round-trips |
| WebSocket /chat | ✅ listens (on test :3012) | old daemon PID 16432 holds :3011 (unkillable) |
| Chat answer quality | ⚠️ SUSPECT | "hello" → "ห้ามเดาโว้ย" — non-sensible; provider/system-prompt issue, NOT just connectivity |

**Root cause (unchanged)**: commit `be7dea7` (MEGA-100 wave) committed raw CODECOMMAND output
with markdown fence markers + truncation, no build gate.

**Corrected blast radius — 9 files, not 4**:
| File | Type | Disposition |
|---|---|---|
| services/responseFormatter.ts | core | restored from 3007ba2 ✅ |
| services/toolExecutor.ts | core | restored ✅ |
| services/healthAggregator.ts | core | restored ✅ |
| services/cacheManager.ts | core | restored ✅ |
| services/thaiNLPEnhancer.ts | orphan, fence | quarantined → .mega100-corrupt |
| routes/api/analytics.ts | orphan, hallucinated methods | quarantined → cc-team rebuilt (Phase 2) |
| routes/api/mdesModels.ts | orphan, hallucinated | quarantined → cc-team rebuilt (Phase 2) |
| routes/api/thaiNLP.ts | orphan, hallucinated | quarantined → cc-team rebuilt (Phase 2) |
| scripts/cleanupWorkspace.ts | orphan, signature drift | quarantined → .mega100-orphan |

---

## Phase 1 — Backend Resurrection — ✅ DONE (2026-06-12)

**Goal**: `hello` round-trips through chat again. **Status: COMPLETE & committed.**

What was actually done (vs v1's naive 5 steps):
1. Restored 4 core services from `3007ba2` ✅
2. Fixed **14 residual tsc errors** v1 didn't anticipate: rateLimiter aliases
   (generalRateLimit/authRateLimit), import-path depth (`../`→`../../`), default→named imports,
   req.session typing, workspace `uploadFile`→`writeFile` ✅
3. Quarantined 5 orphan/corrupt files (3 hallucinated routes + thaiNLPEnhancer + cleanupWorkspace) ✅
4. **dist/ rebuilt** (pre-commit hook requires dist/app.js to resolve) ✅
5. Verified on **:3012** (NOT :3011 — daemon PID 16432 holds it, unkillable), via WS hello test ✅

**Carry-forward defects (feed Phase 3)**: hello answer quality bad; frontend runtime unverified.

## Phase 2 — Rebuild Quarantined Routes + De-quarantine — cc-team (RUNNING/DONE)

**Goal**: the 3 hallucinated routes work against REAL service APIs; no @ts-nocheck in services.
**Scope narrowed** (prism Simplifier): audit only build-breaking / wired files, NOT all 180.

| # | Task | Executor | Verify (user-observable) |
|---|---|---|---|
| 2.1 | Rebuild analytics/mdesModels/thaiNLP routes against real service methods (method lists embedded in prompts) | cc-team ✅ done | tsc EXIT 0 after re-wire |
| 2.2 | SA (Sonnet, 1 batch): validate no hallucinated methods, write files, re-wire index.ts, tsc, rebuild dist | Sonnet | `curl /api/mdes/models` returns JSON 200 |
| 2.3 | @ts-nocheck removal playbook → apply to 6 services incrementally | cc-team + script | `grep -r @ts-nocheck src/services` = 0 |
| 2.4 | Smoke test: all route modules resolve (node:test) | cc-team ✅ done | `node --test` green |

**Exit**: tsc 0 + 3 routes return real data via curl + 0 @ts-nocheck + smoke green.

## Phase 3 — Chat Quality + Never-Silent-Hang — cc-team (P0.5, promoted)

**Goal**: chat gives sensible answers AND never hangs silently. (Promoted from P1 — prism User
lens: this is what mom actually experiences as "broken".)

| # | Task | Executor | Verify |
|---|---|---|---|
| 3.1 | Diagnose "hello"→"ห้ามเดาโว้ย": trace system prompt + provider selection for trivial greetings | cc-team + 1 Claude read | hello → polite greeting |
| 3.2 | Frontend WS-state UI: "backend reconnecting" banner + retry, no infinite spinner (ChatPage ~L600) | cc-team | kill backend → banner ≤5s |
| 3.3 | Backend /health returns provider+build status for frontend probe | cc-team | `curl /health` shows providers |
| 3.4 | Smoke suite: hello, provider-select, tool-call, WS-reconnect (node:test) | cc-team | suite green |

**Exit**: real browser — type hello, get sensible reply; kill backend, see banner not hang.

## Phase 4 — Frontend Runtime + Manus.im UX — cc-team (P1)

**Goal**: panels actually render (prism Breaker: "compiles" ≠ "renders"). Browser-verified.

| # | Task | Executor | Verify |
|---|---|---|---|
| 4.1 | **Browser runtime audit**: load app, capture console errors, screenshot each panel (Playwright) | cc-team/script | screenshots + 0 console errors |
| 4.2 | Error boundaries on ManusWorkspacePanel + MultiAgentPanel (panel fail ≠ page blank) | cc-team | force panel error → boundary shows |
| 4.3 | Wire AgentStepsView to real dispatch events (manus "Hands On" visibility) | cc-team | steps stream during chat |
| 4.4 | Layout QA vs manus.im (3-column, header, responsive) | cc-team | checklist pass |

**Exit**: Playwright loads app, all 3 columns render with data, console clean.

## Phase 5 — Regression Guards — mechanical (P1, promoted)

**Goal**: bulk-generation can NEVER silently break main again. (Promoted — this is the actual
systemic root cause; without it, MEGA-101 repeats the disaster.)

| # | Task | Executor |
|---|---|---|
| 5.1 | Pre-commit hook: reject staged .ts/.tsx whose first non-blank line is a ``` fence | script ✅ pattern known |
| 5.2 | Pre-commit hook: `tsc --noEmit` both packages before any commit touching src/ | script |
| 5.3 | Wave policy doc: bulk-gen → feature branch → build gate → SA review → merge. Never direct-to-main | doc |

**Exit**: a deliberately fence-corrupted file is REJECTED by the hook in a test commit.

## Backlog (de-scoped by prism Simplifier — not "chat is broken")

- request_id traceability pattern (was 4.3) — nice-to-have, after chat works
- full 180-file orphan census — only audit build-breakers now; full census later

---

## Execution Rules (save แบบขั้นสุด)

1. **Mechanical first**: git restore, tsc, hooks, dist rebuild = scripts, 0 LLM tokens
2. **cc-team for all generation**: deepseek-v4-pro (dev), deepseek-v4-flash (test), Qwen3.7-Max
   (architecture) via `scripts/cc-team-run.cjs` (.cjs — innomcp/scripts is type:module). CommandCode only
3. **Embed real API context in every cc-team prompt** — list the actual methods/signatures so
   workers cannot hallucinate (the exact MEGA-100 failure mode)
4. **Claude**: orchestration + final verify-read + 1 batched SA review per phase. Never per-task
5. **Commit per phase**, phase-tagged, revertable. Never bulk-commit unverified generation
6. **Verify like a user**: browser/WS round-trip, not just tsc

## Environment gotchas (hard-won, Phase 1)

- Port :3011 held by **unkillable** daemon PID 16432 (jarvis, 2026-06-10, elevated) → test on :3012
- `innomcp-node/.env` dotenv **OVERRIDES** shell env → set SERVER_PORT in .env, not shell
- pre-commit hook requires **dist/app.js rebuilt** (`npx tsc`) or it blocks the commit
- `innomcp/scripts` is `type:module` → runner must be `.cjs`
- CommandCode 403s default Python/Node UA → set custom User-Agent header

## Rollback Safety

- Last known good: `7fb8f68` (2026-06-11 09:05)
- Every restore preserves git history; quarantined files kept as `*.mega100-*` (Nothing is Deleted)
- Every phase = separate commit → independently revertable

---

## v1 → v2 Corrections (what prism caught)

| Lens | v1 flaw | v2 fix |
|---|---|---|
| User | success = "compiles + non-empty reply" | success = browser renders + sensible answer; hello-quality is now Phase 3.1 |
| Maintainer | "4 corrupted" (wrong); Phase 1 shown pending though done | corrected to 9 files; Phase 1 marked DONE with real steps |
| Breaker | assumed :3011 free, no dist step, shell-env port | documented daemon/3012, dist rebuild, .env override |
| Simplifier | "audit 180 files", request_id in critical path | de-scoped to backlog |
| Integrator | rebuilt-routes work absent (emerged in P1) | Phase 2 now centers on it |

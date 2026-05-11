# INNOMCP MASTER REVIEW
**Created:** 2026-05-03
**Reviewer:** Claude (Opus 4.7, 1M ctx) acting as orchestrator
**Project state at review:** PUBLIC-READY (full system 59/59 + browser signoff 61/61) but uncommitted work in flight (47 modified + 12 untracked files)

> Canonical worklist for the multi-agent system. Every sub-agent reads this before acting. `innomcp-hermes` keeps it synchronized.

---

## 0. Snapshot
| Surface | Last green | Files in flight | Concern |
|---|---|---|---|
| Full system gate | 59/59 (2026-04-28) | scripts + multiple node services | none yet (untested post-changes) |
| Browser signoff | 61/61 (2026-04-28) | next components | none yet (untested post-changes) |
| Dev server health | Crashed repeatedly in last `dev-log.txt` | `port 3011 in use` errors | **P1 — investigate before further dev** |
| Git hygiene | 47 M + 12 ?? files | uncommitted | **P2 — risk of loss, consolidate or commit** |
| Memory | 3 files indexed | — | extending in this review |
| Sub-agents | 0 | new | **created in this review (10 agents)** |

---

## Phase A — Stabilization (P0/P1, do FIRST)

> Goal: get back to a clean, committable, test-green baseline before adding anything new.

### A.1 — Dev server crash diagnosis  *(owner: innomcp-tester → innomcp-dev)*
- [ ] Run `netstat -ano | grep ":3011"` — identify the orphan process
- [ ] Decide: kill, or change port via `SERVER_PORT` env var
- [ ] Audit `innomcp-node/src/index.ts` for graceful shutdown on nodemon restart
- [ ] Verify `npm run dev | tee dev-log.txt` runs ≥10 minutes without crash
- **Verifier:** clean dev-log.txt with no `app crashed` line for 10 min
- **Risk:** nodemon races with prior process — common dev-only issue, but blocks live work
- **Rollback:** revert `app.ts` if introduced regression

### A.2 — Uncommitted work triage  *(owner: innomcp-program-analyst → innomcp-dev)*
- [ ] List the 47 modified files grouped by service
- [ ] For each group, decide: commit, stash, or revert
- [ ] Identify orphan files (`promptAdapter.ts`, `responseComposer.ts`, `chatStorage.ts`, etc. — currently untracked)
- [ ] Confirm new test files (`aiModeRoute.test.ts`, `healthRoute.test.ts`, `monitoringHealth.test.ts`, `promptAdapter.test.ts`, `redisFallback.test.ts`, `responseComposer.test.ts`) actually run green
- [ ] Confirm new e2e (`impeccable-shot.spec.ts`) is intentional and passes
- **Verifier:** `git status --short` returns ≤5 lines after triage
- **Risk:** silent regression hidden in uncommitted diff
- **Rollback:** branch first (`git switch -c snapshot/pre-triage-$(date +%F)`)

### A.3 — Re-run release gate post-triage  *(owner: innomcp-tester)*
- [ ] `cd innomcp-node && SMOKE_MODE=1 npx ts-node scripts/full_system_test.ts` → must hit 59/59 (or new max)
- [ ] `cd innomcp-next && npx playwright test e2e/signoff.spec.ts` → must hit 61/61
- [ ] Append result to `docs/reports/SIGNOFF_EVIDENCE_2026-05-03.md`
- **Verifier:** new SIGNOFF doc with PUBLIC-READY verdict
- **Risk:** untested in-flight changes break gate — fix before next phase

---

## Phase B — Known security & correctness debt (P1, after A green)

### B.1 — SQL injection in evidenceTool.ts  *(owner: innomcp-reviewer → innomcp-dev)*
- [ ] Locate `tableName` usage in `innomcp-server-node/src/mcp/tools/evidenceTool.ts`
- [ ] Replace with allowlist of valid table names — reject anything else
- [ ] Add unit test that asserts `tableName="x; DROP TABLE users--"` returns refusal
- **Verifier:** new test green + manual probe rejected
- **Source:** memory note `Known Issues (2026-02-07)`

### B.2 — Hardcoded credentials in dbDetect.ts  *(owner: innomcp-reviewer → innomcp-dev)*
- [ ] Grep `dbDetect.ts` for IP, password, user — all must move to `.env`
- [ ] Add entries to `env.d.ts` and `ENV_SETUP.md`
- [ ] `git log -p -- innomcp-node/src/utils/dbDetect.ts` — confirm secrets are not in history (if so, file follow-up)
- **Verifier:** `grep -E "209\.15\.|password\s*=" innomcp-node/src/utils/dbDetect.ts` returns nothing
- **Source:** memory note `Known Issues (2026-02-07)`

### B.3 — Tool count drift  *(owner: innomcp-program-analyst)*
- [ ] Count actual MCP tools in `innomcp-server-node/src/server.ts`
- [ ] Compare against logged "27" vs current "56/56" in dev-log
- [ ] Update any stale documentation or boot log
- **Verifier:** consistent count across log + docs + test

### B.4 — Apply tables.sql to local DB  *(owner: innomcp-system-analyst → innomcp-dev)*
- [ ] Confirm whether `tables.sql` has been applied (likely not, per memory)
- [ ] If pending, write idempotent migration script
- [ ] Document migration in ADR-001
- **Verifier:** schema diff between `tables.sql` and live DB shows zero unexplained delta

### B.5 — User table duplicate columns  *(owner: innomcp-system-analyst)*
- [ ] Identify legacy-compat columns in `user` table
- [ ] Plan deprecation path (read-from-new, write-to-both, then write-to-new only)
- [ ] Document plan in ADR-002
- **Verifier:** ADR-002 accepted

---

## Phase C — Sub-agent system bring-up (P1, in parallel with B)

### C.1 — Verify the 10 agents land  *(owner: orchestrator/parent)*
- [ ] Open Claude Code → `/agents` should list: dev, planner, designer, tester, reviewer, system-analyst, program-analyst, search, connector, hermes
- [ ] Spawn `innomcp-search` with a trivial query — confirm it returns citations only
- [ ] Spawn `innomcp-tester` with "report current gate state" — confirm it reads SIGNOFF doc
- **Verifier:** all 10 agents callable

### C.2 — Wire RAG memory bridge  *(owner: innomcp-hermes)*
- [ ] Audit existing `innomcp-node/data/knowledge-base/*.md` (4 docs today)
- [ ] Document the load path so other agents understand the contract
- [ ] Add one new KB entry: agent orchestration overview (so chat answers can cite the team)
- [ ] Verify reload via `[ColdRetriever] Loaded N docs` line on next backend boot
- **Verifier:** dev-log shows new chunk count

### C.3 — Memory hygiene pass  *(owner: innomcp-hermes)*
- [ ] Re-read all `memory/*.md` — purge anything contradicted by current code state
- [ ] Add one-liner index entries for: agent system, sub-agents catalog, MASTER_REVIEW pointer
- [ ] Confirm `MEMORY.md` < 200 lines

---

## Phase D — Architecture & quality forward work (P2)

### D.1 — Answer planner refactor  *(owner: innomcp-system-analyst → innomcp-dev)*
- `innomcp-node/src/utils/mcp/answerPlanner.ts` is a hotspot. Plan a split into intent-detection + tool-selection + composer modules.

### D.2 — Fastpath caching strategy review  *(owner: innomcp-connector + innomcp-system-analyst)*
- TTL audit for: `dbPhrasesCache`, Redis fallback, weather caches.

### D.3 — TS strictness ramp  *(owner: innomcp-program-analyst → innomcp-dev)*
- Track `: any` count weekly. Aim −20% per month.

### D.4 — Frontend visual regression  *(owner: innomcp-designer + innomcp-tester)*
- Add Playwright screenshots for ChatPage, EvidenceDashboard, ModeStatusBar in 3 states (ready/limited/unavailable).

### D.5 — Test coverage quantify  *(owner: innomcp-program-analyst)*
- Run `npm test -- --coverage` on innomcp-node, snapshot to `PA_METRICS_2026-05-03.md`.

---

## Phase E — User experience / UX polish (P2/P3)

### E.1 — Thai-first naturalness audit  *(owner: innomcp-designer)*
- Use the `clarify` skill on all user-facing strings in:
  - `ChatPage.tsx`, `EvidenceDashboard.tsx`, `ModeStatusBar.tsx`, error messages from each connector.

### E.2 — Mobile responsive sweep  *(owner: innomcp-designer)*
- Use the `adapt` skill across the chat UI (375px, 414px, 768px, 1024px breakpoints).

### E.3 — Loading state delight  *(owner: innomcp-designer)*
- Use the `delight` skill on `GlobalLoadingOverlay` — keep it tasteful.

---

## Phase F — Operational hardening (P3, when stable)

### F.1 — Health endpoint dashboard
- Surface `/api/health/keys` per tier in a readable JSON for ops.

### F.2 — Correlation ID propagation audit
- Confirm `correlationId` flows from request → MCP → external API → log.

### F.3 — Error taxonomy
- Document every friendly Thai error message in one table; ensure each has a `_via` field.

---

## Cross-cutting policies (apply to every phase)
1. No phase passes until tests run green AND signoff gate is intact.
2. Every commit message answers *why*, not *what*.
3. Every external API call has timeout, retry policy, and friendly Thai error path.
4. Every architecture decision lands as an ADR before code is written.
5. Memory writes always create a topic file + index pointer (never inline in `MEMORY.md`).
6. Auto-mode is in effect — `innomcp-dev` proceeds on low-risk work without asking, but escalates risky paths to user.

---

## Phase status legend
- `[ ]` = open
- `[~]` = in progress
- `[x]` = done (with link to verifier evidence)
- `[!]` = blocked (with reason)

## Update protocol
- Only `innomcp-hermes` writes to this doc.
- Other agents request changes by handoff message.
- Each update appends a dated note to the relevant phase, never silently rewrites history.

---

## 2026-05-12 — GSD Round Follow-up: Phase10.14 Publish Blocker

### Current Verified State
- Local branch: `phase-c-living-agent-chat-opus-recovery`
- Verified code commit: `3f95557 fix(phase10.14): harden thai routing acceptance`
- Local branch state before this doc-only report: clean worktree, `ahead 3` from tracked upstream branch.
- Full Playwright proof from 2026-05-11:
  - Run 1: `214/214 PASS`, `logs/playwright-full-run1-20260511-131343.status.json`
  - Run 2: `214/214 PASS`, `logs/playwright-full-run2-20260511-133730.status.json`
  - Run 3: `214/214 PASS`, `logs/playwright-full-run3-20260511-140057.status.json`
- Focused gates green:
  - `verify_phase105_thai_knowledge_routing.ts`
  - `test:thaiKnowledgeTool`
  - `test:thaiGeoTool`
  - phase107 scripts
  - phase109 TMD/NWP verifier, `74/74 PASS`

### What Improved
- Thai Gulf-side weather routing no longer loses partial successful regional data to a generic fallback.
- Weather fixture coverage now includes `สุราษฎร์ธานี` and `นครศรีธรรมราช`.
- Frontend tool metadata rendering now accepts multiple backend payload shapes.
- PS1/PS2/Memory-RAG acceptance harnesses now load the backend JWT secret the same way signoff does, avoiding false guest-rate-limit failures.
- Product-surface UI contracts were restored without changing the underlying routing architecture.

### ผมแพ้เพราะ...
ผมไม่ได้แพ้ที่ code/test gate: regression suite เขียวครบและเสถียรสามรอบ แต่ผมแพ้ที่การปิดงานแบบ publish end-to-end ใน session นี้ เพราะข้อจำกัดของ execution environment:

1. `git push` over HTTPS hangs on Git Credential Manager in the non-interactive Codex shell.
2. `GIT_TERMINAL_PROMPT=0` confirms there is no usable GitHub credential: `fatal: could not read Username for 'https://github.com': terminal prompts disabled`.
3. `gh auth status` reports no logged-in GitHub host, so the normal safe path requires one interactive `gh auth login`.
4. MDES/Ollama primary delegation was attempted but degraded in this round:
   - repo helper `scripts/delegate-to-mdes.ps1` fails to parse in PowerShell because of an encoding/token issue in its logging block.
   - direct MDES `/v1/chat/completions` call returned Cloudflare `504 Gateway time-out`.
5. GitHub connector access exists for `mdes-innova/innomcp`, but replaying local commits through the connector would not preserve the exact local commit SHAs and would require high-risk blob/tree reconstruction for large files. I chose not to fake a push by creating different remote history without explicit operator approval.

### Required Human/Operator Action
Run one of these from an authenticated shell:

```powershell
cd C:\Users\USER-NT\DEV\innomcp
gh auth login --hostname github.com --web --git-protocol https
gh auth setup-git
git push origin HEAD:refs/heads/phase-c-living-agent-chat-opus-recovery
git fetch origin phase-c-living-agent-chat-opus-recovery
git rev-parse HEAD origin/phase-c-living-agent-chat-opus-recovery
```

If the final command prints the same SHA twice, the verified local code has been published exactly.

### Next GSD Step
After publish succeeds, update tracking deliberately:
- keep pull tracking on `upstream` if this branch is intended to follow upstream review flow, or
- switch to `origin/phase-c-living-agent-chat-opus-recovery` if `mdes-innova/innomcp` is the canonical working remote for Jit.

# Phase A.4 — Dirty-Tree Classification & Commit Plan
**Date:** 2026-05-03
**Branch:** `phase-a-clean-baseline-2026-05-03`
**Base HEAD:** `5c60197`
**Working tree size:** 46 modified + 12 untracked (+12 patch/triage files I created) = ~5000 LOC change
**Patch backup:** `docs/reports/evidence/phase-a-dirty-working-tree.patch` (7327 lines)

> Goal: convert all dirty files into reviewable logical commits, then prove gates green from a clean HEAD.

---

## Theme analysis

After reading representative diffs across all areas, the change-set sorts into 3 coherent themes that explain ~95% of files:

1. **2026-04-28 closure follow-through** — honest-state UX, expanded health contract, strict Thai-led naturalness gates. Started in commit `15d96a5` but only partially shipped; the rest is in this dirty tree.
2. **Phase 6 prompt/composer foundation** — new services `promptAdapter.ts` (453 LOC) and `responseComposer.ts` (137 LOC) plus their consumers and tests. Header comments explicitly mark them "Phase 6A/6B" and "Phase 6C foundation".
3. **Frontend chat-shell aesthetic refresh** — Chakra Petch display font, chat-workspace-bg, lang="th", Header/Sidebar/Page/Input/Message/Selector/Card surface polish. Ties into the impeccable design skill family.

The remaining ~5% are:
- Log-noise reduction (suppress `/api/health` request log)
- Redis health snapshot wiring
- Existing test fixes
- Untracked support files (chatStorage, e2e screenshots, seed scripts)

---

## A–H bucket classification (every file)

### A. Frontend UI components (innomcp-next/src/app/components/**)

| File | Theme | LOC | Risk | Disposition |
|---|---|---|---|---|
| `Header.tsx` | A.3 chat-shell refresh | +337/-? | medium | commit (group C2) |
| `Footer.tsx` | A.3 (drop inline `border:none`) | -2 | low | commit (C2) |
| `ModeStatusBar.tsx` | A.1 honest-state + cache | +322 | medium | commit (C1) |
| `chat/AIModelSelector.tsx` | A.3 polish | +263 | medium | commit (C2) |
| `chat/ChatInput.tsx` | A.3 polish | +290 | medium | commit (C2) |
| `chat/ChatMessage.tsx` | A.3 polish | +358 | medium | commit (C2) |
| `chat/ChatPage.tsx` | A.3 polish (largest) | +688/-220 | high | commit (C2) — largest single diff, biggest blast radius |
| `chat/ChatSidebar.tsx` | A.3 polish | +437 | medium | commit (C2) |
| `chat/EvidenceDashboard.tsx` | A.1 unavailable panel | +30 | low | commit (C1) |
| `chat/GeneratedImageCard.tsx` | A.3 polish | +227 | low | commit (C2) |
| `chat/ToolsTypeSelector.tsx` | A.3 polish | +275 | low | commit (C2) |
| `common/GlobalLoadingOverlay.tsx` | A.3 polish | +12 | low | commit (C2) |
| `common/ui/loading-spinner.tsx` | A.3 polish | +43 | low | commit (C2) |

### B. Frontend e2e/tests + app-level (innomcp-next/e2e + src/app/{layout,page,styles,middleware,api})

| File | Theme | LOC | Risk | Disposition |
|---|---|---|---|---|
| `e2e/signoff.spec.ts` | A.1 strict S6-03/S8-01 (Thai-led) | +15 | low | commit (C1) — gate-strengthen |
| `e2e/chat.spec.ts` | A.1 TC-08/09/10 (health props, ModeStatusBar limited, Evidence unavailable) | +67 | low | commit (C1) — coverage |
| `e2e/impeccable-shot.spec.ts` (NEW) | A.3 visual e2e | 125 | low | commit (C2) |
| `eslint.config.mjs` | meta (flat config migration) | +33 | medium | commit (C2) — config change |
| `src/app/layout.tsx` | A.3 Chakra_Petch + lang="th" | +21/-7 | low | commit (C2) |
| `src/app/page.tsx` | A.3 page polish | +50 | low | commit (C2) |
| `src/app/styles/globals.css` | A.3 chat-workspace-bg + .font-display | +47 | low | commit (C2) |
| `src/app/api/health/route.ts` | A.1 simplify proxy + new fields | +64/-? | medium | commit (C1) |
| `src/middleware.ts` | meta polish | +45 | medium | commit (C2) |
| `src/utils/chatStorage.ts` (NEW) | A.3 storage helper for chat persistence | 161 | low | commit (C2) |

### C. Backend routes/services (innomcp-node/src/routes + services)

| File | Theme | LOC | Risk | Disposition |
|---|---|---|---|---|
| `routes/api/health.ts` | A.1 expanded health contract | +119/-? | medium | commit (C3) |
| `routes/api/chat.ts` | A.2 wires promptAdapter/responseComposer | +118/-? | high | commit (C4) — chat is critical path |
| `routes/api/aiMode.ts` | A.1 mode reporting | +62 | low | commit (C4) |
| `services/generalGate.ts` | A.1 Thai-led gating | +26 | medium | commit (C4) |
| `services/imageGenService.ts` | A.2 uses promptAdapter | +44 | low | commit (C4) |
| `services/promptAdapter.ts` (NEW) | A.2 Phase 6A/6B | 453 | medium | commit (C4) |
| `services/responseComposer.ts` (NEW) | A.2 Phase 6C | 137 | medium | commit (C4) |

### D. Backend infra/utils (innomcp-node/src/utils + middleware + fastpath + metrics)

| File | Theme | LOC | Risk | Disposition |
|---|---|---|---|---|
| `app.ts` | health-probe log noise reduction | +5 | low | commit (C3) |
| `middleware/correlationId.ts` | health-probe log noise reduction | +5 | low | commit (C3) |
| `middleware/performanceTracking.ts` | health-probe log noise reduction | +15 | low | commit (C3) |
| `metrics/latency.ts` | observability tweaks | +31 | low | commit (C3) |
| `utils/monitoring/index.ts` | health-snapshot expansion | +260 | medium | commit (C3) |
| `utils/advancedMetrics.ts` | metrics expansion | +35 | low | commit (C3) |
| `utils/db.ts` | DB conn safety | +58 | medium | commit (C3) |
| `utils/redis.ts` | Redis health snapshot + retry | +216 | medium | commit (C3) |
| `utils/fastPathGreeting.ts` | ping/pong/status detection | +7 | low | commit (C4) |
| `utils/mcp/answerPlanner.ts` | answer routing tweaks | +33 | medium | commit (C4) |
| `utils/mcp/mcpclient.ts` | local/remote inventory split | +64 | medium | commit (C3) — used by health |
| `utils/search/index.ts` | search index | +98 | low | commit (C4) |
| `fastpath/dbPhrasesCache.ts` | fastpath cache | +16 | low | commit (C4) |
| `fastpath/rateLimit.ts` | rate limit polish | +32 | low | commit (C4) |
| `env.d.ts` | new Redis env vars | +4 | low | commit (C3) |

### E. Backend tests + scripts

| File | Theme | LOC | Risk | Disposition |
|---|---|---|---|---|
| `scripts/full_system_test.ts` | A.1 strict naturalness | +91/-50 | medium | commit (C5) — gate strengthen |
| `tests/unit/__tests__/fastpathIdentity.test.ts` | existing test fix | +40 | low | commit (C5) |
| `tests/unit/aiModeRoute.test.ts` (NEW) | new coverage | — | low | commit (C5) |
| `tests/unit/healthRoute.test.ts` (NEW) | new coverage | — | low | commit (C5) |
| `tests/unit/monitoringHealth.test.ts` (NEW) | new coverage | — | low | commit (C5) |
| `tests/unit/promptAdapter.test.ts` (NEW) | new coverage | — | low | commit (C5) |
| `tests/unit/redisFallback.test.ts` (NEW) | new coverage | — | low | commit (C5) |
| `tests/unit/responseComposer.test.ts` (NEW) | new coverage | — | low | commit (C5) |

### F. MCP server / tools

| File | Theme | LOC | Risk | Disposition |
|---|---|---|---|---|
| `innomcp-server-node/src/mcp/tools/thaiLawTool.ts` | tool fix | +29 | low | commit (C6) |
| `innomcp-server-node/scripts/seed_workspace_files.ts` (NEW) | one-shot seeding script | 274 | low | commit (C6) — confirm idempotency before run |

### G. Docs/reports

| File | Theme | LOC | Risk | Disposition |
|---|---|---|---|---|
| `docs/reports/SIGNOFF_EVIDENCE_2026-04-18.md` | historical disclaimer | +2 | low | commit (C7) |
| `docs/reports/phase10_release_gate.md` | 2026-04-28 closure section | +28 | low | commit (C7) |
| `docs/reports/SIGNOFF_EVIDENCE_2026-04-28.md` (NEW) | actual evidence | — | low | commit (C7) |
| `docs/reports/SIGNOFF_EVIDENCE_2026-05-03.md` | already committed in 5c60197 | — | — | done |
| `docs/reports/PHASE_A_TRIAGE_2026-05-03.md` | gitignored (local) | — | — | local |
| `docs/reports/PHASE_A4_CLASSIFICATION_2026-05-03.md` | gitignored (local, this file) | — | — | local |
| `docs/reports/MASTER_REVIEW.md` | gitignored (local) | — | — | local |

### H. Generated/noise

| File | Disposition |
|---|---|
| `docs/reports/evidence/phase-a-dirty-working-tree.patch` | KEEP LOCAL — backup, not for commit |
| `docs/reports/evidence/phase-a-staged.patch` | KEEP LOCAL — backup |
| `docs/reports/evidence/phase-a-untracked-list.txt` | KEEP LOCAL — backup |

---

## Commit plan (7 logical commits, no mega-commit)

| # | Commit theme | Files | Bucket(s) | Approx LOC |
|---|---|---|---|---|
| C1 | front: honest-state UX (ModeStatusBar local-only / Evidence unavailable / health proxy / gate strict S6-03+S8-01+TC-09+TC-10) | 5 | A+B | ~520 |
| C2 | front: chat-shell aesthetic refresh (Chakra_Petch + workspace-bg + components polish + chatStorage + flat eslint) | 17 | A+B | ~3000 |
| C3 | back: health contract expansion + Redis snapshot + log-noise reduction + monitoring/metrics/db utils | 11 | C+D | ~750 |
| C4 | back: chat route + Phase 6 promptAdapter/responseComposer + answerPlanner + fastpath polish + generalGate | 11 | C+D | ~900 |
| C5 | tests: stricter full_system_test naturalness + 6 new jest unit tests + fastpathIdentity fix + impeccable-shot e2e | 8 | E+B | ~600 |
| C6 | mcp-server: thaiLawTool fix + seed_workspace_files script | 2 | F | ~300 |
| C7 | docs: 2026-04-28 closure documentation + historical disclaimer + 2026-04-28 evidence | 3 | G | ~100 |

**Order rationale:** C1 first because gate-test changes already partially shipped in `15d96a5`; production fixes should land before strengthened tests in C5 — but actually we'll commit C1 (mixed, but mostly UI) before C3/C4 (backend) because backend depends on the chat-route changes. Any pre-commit type-check failure will block the bad commit.

After all 7 commits → tree clean → run gates from clean HEAD.

---

## Files NOT committed (and why)

- All files in **bucket H** (patch backups, classification docs) — backups for rollback, not history
- `MASTER_REVIEW.md`, `PHASE_A_TRIAGE_*.md`, `PHASE_A4_CLASSIFICATION_*.md` — gitignored by `*.md` rule; remain local working docs
- `.claude/agents/*` — gitignored by `.claude/` rule; per-machine config

---

## Risk acknowledgments

- The full per-line review for ChatPage.tsx (688-line diff) was **NOT** performed line-by-line. Coverage came from sampling and theme inference. The risk is mitigated by:
  - Pre-commit TypeScript noEmit check on every commit
  - Strict signoff gate (61/61) and full system gate (59/59) re-run after all commits land
- The Phase 6 promptAdapter/responseComposer new services are wired but their actual production traffic hits depend on env-gated flags. If their flags are off, they are inert — gates will pass even if they're slightly off.
- The strictened naturalness gate in `full_system_test.ts` already passed against the dirty tree → committing the stricter test is safe; if any future code regression slips Thai-led, this gate catches it.

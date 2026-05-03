# Product Sign-Off Evidence — 2026-05-03 — CLEAN HEAD

## Verdict: PUBLIC-READY (proven from a clean, pushed HEAD)

> Phase A.4 Clean HEAD Baseline. The earlier 2026-05-03 sign-off ran the gates against a dirty working tree (47 modified + 12 untracked), so its PUBLIC-READY conclusion only proved the local working tree, not a reviewable git HEAD. This document supersedes that prior proof for release purposes.

---

## Distinguishing the two proofs

| | Working-tree proof (earlier today) | Clean-HEAD proof (this doc) |
|---|---|---|
| Date/time | 2026-05-03 10:43–10:48 | 2026-05-03 11:33–11:38 |
| Branch | `main` | `phase-a-clean-baseline-2026-05-03` |
| Commit tested | `5c60197` + 47 modified + 12 untracked **uncommitted** | `d05c69f` (clean tree, `git status --short` empty) |
| Source of truth | local files on disk | git HEAD |
| Reviewable? | NO — dirty tree | YES — every change in commit history |
| Reproducible? | only on this machine | anyone on the branch HEAD |
| Document | `SIGNOFF_EVIDENCE_2026-05-03.md` | this file |

---

## Commit chain that landed in this branch

| Commit | Theme | Files | Δ LOC | Pre-commit tsc |
|---|---|---|---|---|
| `5c60197` | docs(phase-A): agent orchestration RAG doc + 2026-05-03 working-tree signoff | 2 | +130/-0 | PASS |
| `19e0bf3` | feat(honest-state): finish 2026-04-28 closure UX bundle | 5 | +374/-124 | PASS |
| `0228ab7` | ui(chat-shell): typography refresh + chat-workspace polish + flat eslint | 17 | +1986/-1305 | PASS |
| `1bab9dc` | feat(health): expanded health contract + Redis snapshot + log-noise drop | 11 | +668/-144 | PASS |
| `60f2d7e` | feat(phase-6): promptAdapter + responseComposer foundation, gated wiring | 11 | +943/-83 | PASS |
| `adb3599` | test: strict naturalness gate + 6 new jest units + impeccable-shot e2e | 9 | +932/-24 | PASS |
| `fefc20e` | feat(mcp): thaiLawTool DB fallback + workspace-files seed script | 2 | +303/-0 | PASS |
| `23663ce` | docs(reports): 2026-04-28 closure documentation + historical disclaimer | 3 | +120/-2 | PASS |
| `d05c69f` | chore(gitignore): ignore local-only audit artifacts in docs/reports/evidence | 1 | +3/-0 | PASS |
| **Total** | **9 commits** | **57 unique files** | **+5459/-1682 LOC** | **9/9 PASS** |

---

## Hard restart proof (before the clean-HEAD gate run)

**Pre-restart PIDs (uptime ~44h):**
- Port 3000 → PID 9828 (frontend), started 2026-05-01 15:13:56
- Port 3011 → PID 26784 (backend), started 2026-05-01 15:13:55
- Port 3012 → PID 16072 (MCP server), started 2026-05-01 15:13:55

**Stop:** PowerShell `Stop-Process -Id <pid> -Force` for each. Ports verified freed before restart.

**Post-restart PIDs (new boot):**
- Port 3000 → PID 18364 (frontend), started 2026-05-03 11:31:43
- Port 3011 → PID 4220 (backend), started 2026-05-03 11:31:42
- Port 3012 → PID 20452 (MCP server), started 2026-05-03 11:31:42

**Boot health (immediately after restart):**
- Backend `/api/health`: `status=healthy, mode=online, mode_ready=true, mcp_status=connected, redis_status=ready, local_tools=4, remote_tools=52, total_tools=56, notes=[]`
- Frontend `/api/health`: same fields, proxied
- MCP server: `[Chat API] ✅ MCP ready | remote=52 local=4 total=56 clients=1`
- ColdRetriever: `Loaded 5 docs, 20 chunks` (now includes the new `agent-orchestration.md` KB doc — was 4 docs / 15 chunks before this session)

**10-minute no-crash proof:**
- Backend uptime crossed 600 s at sign-off time (final reading: **610 s**)
- Crash-signature grep on `dev-stack-20260503-113141.log` (4595 lines): **0 hits** for `app crashed | UnhandledPromiseRejection | FATAL | EADDRINUSE`
- All 6 dependency services remained healthy throughout (Weather TMD, Open-Meteo, OpenSearch Thai Gov, Redis, Database, MCP Server)
- Dev-log path: `logs/devstack/dev-stack-20260503-113141.log`

---

## Gate evidence (clean HEAD)

| Gate | Result | Duration | Log |
|---|---|---|---|
| `git status --short` before run | EMPTY (clean) | — | — |
| Full system test | ✅ **59/59 PASS (100%)** | ~9 s | `innomcp-node/logs/full_system_test_clean_20260503-113324.log` |
| Browser signoff suite | ✅ **61/61 PASS (100%)** | 4.2 min | `innomcp-next/logs/signoff_suite_clean_20260503-113342.log` |

### Full system breakdown (clean HEAD)
| Section | Pass | Notes |
|---|---|---|
| Health | 3/3 | live=200, login OK, MCP `remoteReady=true` (per the strengthened C5 assertion), `remote=52 local=4 total=56` |
| AI-Thai | 9/9 | All under the new strict naturalness gate (no leading English, Thai-ratio ≥30%, forbidden phrases blocked, minMatches expected) |
| Math | 7/7 | symbolic derivative, percent, F→C, mean, two linear-equation analyses, multiplication |
| Weather | 5/5 | bkk, cnx, south region, phuket weekly, khon kaen |
| NWP | 4/4 | hourly bkk tomorrow, cnx daily 3d, region north tomorrow, region south week |
| TMD | 3/3 | cnx 7d direct, nationwide 7am, 3h rain |
| Evidence | 5/5 | All 5 honest "limited" message — Detect DB unreachable, no fake data |
| Seismic | 2/2 | latest TH, north 7d |
| WorldBank | 2/2 | TH GDP latest, growth 5y |
| ThaiGeo | 5/5 | hat yai, songkhla region, cnx districts, pak khlong postcode, chatuchak |
| GenImage | 2/2 | Thai prompt + English prompt |
| FileRead | 2/2 | txt + NAS relative path |
| NLP-Quality | 6/6 | noisy/typo Thai questions handled |
| Edge | 4/4 | empty msg, 500-char msg, past-weather honest, mixed gibberish (now requires `r.ok` not just `status !== 500`) |

### Browser signoff breakdown (clean HEAD)
| Section | Tests | Pass | Notes |
|---|---|---|---|
| S1 Auth + User Flow | 5 | 5 | register/login UI + API + guest |
| S2 AI Mode UI Flow | 6 | 6 | local/remote/hybrid switches + real local answer |
| S3 Evidence / DetectDB | 5 | 5 | all 5 honest "limited" surface OK in UI (uses C1 EvidenceDashboard unavailable panel) |
| S4 Weather Noisy Prompts | 26 | 26 | all routed correctly across noisy Thai/English variants |
| S5 Thai Knowledge Multi-Turn | 4 | 4 | city→province, province→region, districts, postcode |
| S6 General Tool Flow | 4 | 4 | calculator, datetime, **S6-03 strict Thai-led**, mixed-language typo |
| S7 Weather Truth Contract | 7 | 7 | region purity, no nationwide pollution, honest upstream-down |
| S8 Public Readiness Proof | 4 | 4 | **S8-01 strict Thai-led**, mixed intent, unsupported handled, clean UI |
| **Total** | **61** | **61** | duration 4.2 min |

S6-03 and S8-01 now use the C1 strict assertion (`!startsWithEnglish() && containsAny(['การเรียนรู้','ข้อมูล','คอมพิวเตอร์'])` for ML; equivalent for TCP/IP) — proving the 2026-04-28 closure holds against the new chat-shell rewrite from C2.

---

## What this proves

1. The 9 logical commits from `5c60197` → `d05c69f` together form a coherent reviewable baseline.
2. Every commit individually passed `tsc --noEmit` (pre-commit hook log).
3. The release gate (59/59 + 61/61) holds against a *git-HEAD-only* checkout — no dirty in-flight files contributing.
4. The runtime survived a hard process kill + cold restart and stayed up for 10+ minutes under gate load with zero crash signatures.
5. The honest-state UX (ModeStatusBar limited / EvidenceDashboard unavailable) is wired end-to-end and exercised by the gate.
6. The strengthened naturalness gate (S6-03 / S8-01 strict Thai-led, full system AI-Thai with `detectNaturalnessIssue`) closes the prior English-leak blind spot.

---

## What this does NOT prove

- **Phase B security debt is unchanged.** SQL injection in `evidenceTool.ts` (tableName allowlist) and hardcoded credentials in `dbDetect.ts` are still open. They were explicitly excluded from this baseline pass — Phase A.4 is stabilization, not security work.
- **No production deployment.** This is a clean-HEAD pre-deploy gate.
- **Long-window stress.** 10 min uptime under gate load is the proven window. We do not yet have hours-long load metrics on the new HEAD.
- **Phase 6 services in production traffic.** `promptAdapter` and `responseComposer` are committed and wired but are env-gated; their actual production routing depends on flag values not changed in this baseline.

---

## Branch + push state

- **Branch:** `phase-a-clean-baseline-2026-05-03`
- **Final HEAD on branch (before this evidence commit):** `d05c69f`
- **Final HEAD after this evidence doc commits:** see Step 9 of phase report
- **Push target:** `upstream/phase-a-clean-baseline-2026-05-03` (NOT directly to main; waits for explicit merge/PR decision)

## Next-step recommendation

Phase A.4 (Clean HEAD Baseline Proof) is **PASS**. Phase B (security debt) is now unblocked. Recommend opening a PR from `phase-a-clean-baseline-2026-05-03` → `main` so the 9 commits can be reviewed there before any Phase B work begins.

# Oracle Skill and Fleet Readiness - 2026-06-05

## Result

Codex/Jit is usable as the innomcp delivery lead with Oracle skills, Antigravity, MAW, innova-bot bridge evidence, and a 56-agent MDES/ThaiLLM validation pass.

Verdict: `PASS_WITH_BOUNDARIES`.

## Codex Skill Readiness

Active Codex skill surface:

- Global Codex skills present: 35 via `arra-oracle-skills list -g`.
- Session-visible Codex skill directories: 36 under `C:\Users\USER-NT\.codex\skills`.
- Project Jit Codex skills present: 3 (`agent-fleet-budget`, `antigravity-orchestrator`, `jit-subagent-orchestrator`).
- Required delivery skills used in this pass: `rrr-lite`, `recap-lite`, `trace`, `agent-fleet-budget`, and `antigravity-orchestrator`.

Oracle CLI checks:

- `arra-oracle-skills inspect rrr-lite` - Codex installed and command-capable.
- `arra-oracle-skills inspect recap-lite` - Codex installed and command-capable.
- `arra-oracle-skills inspect trace` - Codex installed and command-capable.
- `arra-oracle-skills inspect go` - Codex installed and command-capable; treated as global/profile-changing and not run destructively during the release window.
- `arra-oracle-skills inspect oracle-soul-sync-update` - Codex installed and command-capable.

Boundaries:

- Full `rrr`, full `recap`, `team-agents`, `fleet`, `xray`, and `awaken` are available in the Oracle library / Claude lane but are not installed for Codex in the current minimal Codex profile.
- `debug-mantra` appears in the Claude global installed skill list, but `arra-oracle-skills inspect debug-mantra` does not resolve it from the current Oracle source catalog.
- `9arm` and `ECC` were not found by `arra-oracle-skills inspect`.

## Antigravity Readiness

Verified local configuration:

- `C:\Users\USER-NT\.antigravity\config.yaml` contains `defaults.auto_approve: true`.
- `C:\Users\USER-NT\.antigravity\config.yaml` contains `defaults.skip_permissions: true`.
- `where antigravity` resolves the CLI wrapper under `C:\Users\USER-NT\AppData\Local\Programs\Antigravity\bin`.
- `node C:\Users\USER-NT\Jit\eval\antigravity-probe.js` passed earlier in the same delivery pass.
- Probe result: Antigravity `1.107.0`, wrapper scripts present, Playwright MCP and Chrome DevTools MCP configured.

Boundary:

- Current local Antigravity CLI help proves editor/chat/MCP surfaces, but does not advertise `--exec plan.json`; that command remains a planned gateway shape until the installed CLI exposes it.

## Fleet and Provider Readiness

Latest strict fleet proof:

- Artifact: `C:\Users\USER-NT\Jit\network\artifacts\fleet-batch-2026-06-05T09-25-15-556Z\proof-manifest.md`.
- Command: `node eval/fleet-batch.js --count 56 --concurrency 6 --lanes ollama_mdes,thaillm --require-min-count 56 --require-min-ok 42 --no-discord --include-innova-bot`.
- Result: `count=56`, `completed=56`, `ok=56`, `pass=yes`.
- MDES lane: `29/29 OK`, average `29259ms`.
- ThaiLLM lane: `27/27 OK`, average `6405ms`.
- ThaiLLM model split: OpenThaiGPT 7, Pathumma 7, Typhoon 7, THaLLE 6.
- Ollama local is intentionally excluded from this final strict proof because the fresh provider smoke timed out; MDES and ThaiLLM are the proven content-usable worker lanes for the final >50-agent validator.

Fresh provider smoke from `agent-fleet-budget`:

- Content-usable: `ollama_mdes`, `thaillm`, `openai`.
- Degraded or limited: `ollama_local` timeout, `ollama_cloud` weekly usage `429`, `copilot` quota `402`, `openclaude` refused.
- innova-bot SSE endpoint reachable at `http://127.0.0.1:7010/sse`.

## MAW and innova-bot

MAW status:

- `maw team status` ran successfully.
- Teams visible: `innomcp`, `innova-bot-template`, and `jit`.
- No MAW team tasks are currently queued.

innova-bot bridge:

- `node C:\Users\USER-NT\Jit\eval\innova-bot-talk.js` passed in the final live verification and delivered via File Fallback.
- Fleet batch ran with `--include-innova-bot`.

## innomcp Delivery Evidence

Fresh completion evidence remains in:

- `docs/reports/CODEX-INNOMCP-COMPLETION-2026-06-04.md`.
- `docs/reports/codex-final-live-20260605-150742/runtime-health.json`.

Current proven state:

- Frontend build passed.
- Node backend build passed.
- MCP server build passed.
- Unit suite passed: 77 suites / 743 tests.
- Thai geo tool test passed: 10/10.
- Weather typecheck passed.
- Chat Playwright suite passed: 11/11.
- MCP runtime returned 56 tools.
- Backend readiness is HTTP 200 with `ready=true`, `status=degraded`.

Fresh post-report verification:

- `git diff --check` passed; Git emitted only a line-ending normalization warning for the existing completion report.
- `pnpm --filter innomcp-next run build` passed.
- Live health smoke returned HTTP 200 for `3000/api/health`, `3011/health`, `3011/api/health/ready`, and `3012/health`.
- `3011/api/health/ready` still reports `ready=true`, `status=degraded`, matching the known Redis/database limitation.

Remaining non-code blockers:

- Git publish remains blocked by repository access / credential mismatch for `mdes-innova/innomcp`.
- Docker Desktop Linux engine is unavailable from this shell, so Docker-backed Redis/MariaDB cannot be raised here.
- Local frontend health remains `degraded` because Redis/database are unavailable.
- `docs/api/` remains untracked generated API documentation and needs title/scope/Thai-encoding review before shipping.

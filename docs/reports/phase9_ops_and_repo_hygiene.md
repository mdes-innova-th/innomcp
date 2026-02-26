# Phase 9: Ops and Repo Hygiene

_This document consolidates operational best practices, verified commands, tool capabilities, and risk management guidelines to unblock Phase 9 and beyond._

## 1. Golden Commands

Run these commands from the repository root to verify system integrity before or after major changes.

| Command Purpose                   | Command                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Minimal CI**                    | `npm run minimal-ci`                                                                           |
| **RC Gate**                       | `npm run rc-gate`                                                                              |
| **DetectDB Verifier** (Phase 9.1) | `cd innomcp-node; $env:TS_NODE_CACHE='false'; npx ts-node scripts/verify_phase91_detectdb_e2e.ts` |
| **UI Smoke Runner** (Phase 9.2+)  | `powershell -ExecutionPolicy Bypass -File scripts\run_ui_smoke_evidence_dashboard.ps1 -TimeoutSeconds 420` |

## 2. Tool Inventory

| Tool Name                 | Route Gate        | Required Env                        | Deterministic Fixture?    | Verifier Script                 |
| ------------------------- | ----------------- | ----------------------------------- | ------------------------- | ------------------------------- |
| `evidenceTool` (DetectDB) | `EVIDENCE_ROUTER` | `DETECT_DB_*`                       | Yes (seeded MariaDB)      | `innomcp-node/scripts/verify_phase91_detectdb_e2e.ts` |
| Evidence Dashboard (UI)   | N/A (UI renderer) | N/A                                 | Yes (smoke runner)        | `scripts/run_ui_smoke_evidence_dashboard.ps1` |

Notes:
- `mariadb/docker-compose.yml` does not contain passwords. Provide them at runtime:
	- PowerShell example: `$env:MARIADB_ROOT_PASSWORD='<set>'; $env:MARIADB_PASSWORD='<set>'`
- Phase 9.1.1 requires provenance tagging: `structuredContent.meta.dataSource = detectdb | placeholder`.
- For environment variables, prefer example templates: `innomcp-*/.env.example`.

## 3. Repo Junk Map (Hygiene Guardrails)

**Safe to Clean (`git clean -fd <path>`)**:

- `innomcp-node/evidence/` (Trace logs, test evidence logs)
- `playwright-report/`
- `test-results/`
- `innomcp-node/logs/`

**NEVER Commit**:

- `.env`, `.env.local`, `.env.*`
- `mcp.json` / `.vscode/mcp.json`
- `node_modules/`
- `dist/`, `.next/`, `build/`
- `.turbo/`, `.cache/`
- Database credential files or explicit token dumps.

If a secret-like file is already tracked, fix it immediately:
- Untrack but keep locally: `git rm --cached path/to/.env`
- Ensure it is ignored going forward (root `.gitignore` already ignores `.env`)
- Assume credentials are compromised and rotate them.

## 4. Contribution Guardrails

**Explicit Staging Checklist:**

1. Run `git status` to view all modified and untracked files.
2. Run `git diff` to ensure no embedded secrets or `console.log(process.env)` exist in the changes.
3. Explicitly stage files: `git add path/to/specific/file.ts`. Never use `git add .` or `git commit -a`.

Pre-push safety sweep (Windows-friendly):
- `git status --porcelain=v1`
- `git diff --name-status`
- `git diff --cached --name-status`
- `git clean -nd`
- `git ls-files | findstr /i ".env"` (should be empty)

**Evidence Policy:**

- Routine evidence and trace logs should remain **untracked** locally.
- Only commit evidence logs if explicitly mandated by a Phase's Definition of Done (e.g. proof of verification). When doing so, ensure PII and credentials are scrubbed.

## 5. Upcoming Risks (Phase 9+)

1. **CROSS `REQUEST_CHANGES` Conditions:** Phase 9.1.1 requires `meta.dataSource` to be strictly `"detectdb"` when real DB is available, and explicitly `"placeholder"` with a polite note when it is not. Proof must include a seeded/real DB run.
2. **Windows Process Zombies:** The UI smoke runner spins up Node/Next.js processes in the background. If the script aborts unexpectedly, the processes hang holding ports. _Mitigation:_ Explicitly ensure `taskkill /F /IM node.exe /T` (or PowerShell equivalent) is bound to script exit hooks.
3. **Playwright `networkidle` Stability:** Avoid `waitUntil: 'networkidle'` as it frequently times out on slower local dev environments. Use stable DOM selectors (e.g. `page.waitForSelector('[data-testid="kpi-card"]')`).
4. **Doc hygiene:** Never commit real passwords/tokens in docs (including TODO). Use `<REDACTED>` placeholders.

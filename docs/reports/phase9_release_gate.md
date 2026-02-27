# Phase 9: Release Gate Playbook

_This document outlines the strict validation gates for Phase 9.3 (Backend) and Phase 9.2.2 (Frontend UI)._

## 1. Phase 9.3 Verifier (Backend/DetectDB)

The verifier asserts that the LLM is not hallucinating numerical data, and that provenance (`meta.dataSource`) strictly reflects actual live queries.

**How to Run:**

```powershell
# Ensure valid Database Connection is provided
$env:DETECT_DB_PASSWORD="<LivePassword>"
$env:TS_NODE_CACHE="false"

cd innomcp-node
npx ts-node scripts/verify_phase93_detectdb_real.ts
```

**Expected PASS Markers:**

- Execution ends with `RESULT: PASS`.
- Trace log explicitly flags `[Assert] meta.dataSource === "detectdb"`.
- If `ERR:EVI_DB_UNCONFIGURED` is thrown when no passwords are provided, this is also a PASS for degradation capability.

## 2. Phase 9.2.2 UI Smoke Runner (Frontend)

The smoke runner spins up the frontend, executes deterministic clicks, and tears down gracefully.

**How to Run:**

```powershell
# Run deterministic E2E check
pwsh innomcp-next/scripts/run_smoke.ps1
```

**Expected PASS Markers:**

- Ports `3000` (Next.js) and `3011` (Node.js) must successfully bind.
- Playwright runner must log `1 passed`.
- Final output line MUST be strictly `PASS` (using `cmd /c exitcode` validation).

## 3. What to do when origin is unreachable

If `git push origin main` fails with a `404 Repository not found` or network timeout, **DO NOT change the remote URL**. Execute the bundle handoff procedure:

```powershell
# Create binary bundle of all local commits ahead of the remote
git bundle create handoff/innomcp_local_ahead.bundle origin/main..HEAD

# Or create format patches
git format-patch origin/main..HEAD -o handoff/patches_phase9
```

Deliver the `handoff/` contents to the Release Lead for side-loading.

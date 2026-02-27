# Repository Hygiene Playbook

_This playbook ensures the repository remains free of leaked secrets, accidental large artifacts, and process zombies during local development._

## 1. Explicit Staging Discipline

Never use `git add .` or `git commit -a`. These commands bypass safety checks and frequently leak `.env` files or bloated `node_modules`.

**Correct Workflow:**

```powershell
# 1. Review status
git status --porcelain

# 2. Add specific targets
git add docs/phases/phase9.1-detectdb-e2e/spec.md
git add innomcp-node/src/utils/mcp/tools/evidenceTool.ts

# 3. Verify exactly what is staged
git diff --cached --name-status
```

## 2. Untracked Junk Cleanup Commands

Over time, evidence logs, playwright reports, and compiled dists bloat the repository.

**Safe Cleanup (Windows Compatible):**

```powershell
# Dry run (see what will be deleted)
git clean -nd

# Execute cleanup, preserving required evidence logs
git clean -fd -e innomcp-node/evidence/

# Manually purge known artifact folders
Remove-Item -Recurse -Force playwright-report, test-results, innomcp-next/.next, innomcp-server-node/dist -ErrorAction SilentlyContinue
```

## 3. Windows Process Zombie Mitigation

Next.js and Node.js instances spun up by background test runners (like `run_smoke.ps1`) often fail to release their ports when aborted mid-run. This blocks subsequent test executions.

**Force Teardown by Port:**

```powershell
# Kill processes locking specific dev ports
foreach ($port in 3000, 3011, 3012, 3308) {
  $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
  if ($pids) { Stop-Process -Id $pids -Force }
}

# Aggressive Node kill (Destroys all active node.exe instances)
taskkill /F /IM node.exe /T
```

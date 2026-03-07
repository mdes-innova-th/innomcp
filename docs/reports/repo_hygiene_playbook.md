# Repo Hygiene Playbook

Date: 2026-03-04T04:43:00+07:00

## Untracked Files Found

```text
.vscode/mcp.json
handoff/*.bundle
innomcp-next/src.zip
innomcp_local_ahead.bundle
patches_phase9/*.patch
test-results/tests-evidence-dashboard-E-100f8--KPI-table-for-ISP-evidence-chromium/test-failed-1.png
```

## Recommendations

- `*.bundle` and `src.zip` should be safely ignored via `.gitignore` or `.git/info/exclude`.
- Test results images (e.g., `test-results/`) are currently untracked, but typically should be ignored to avoid accidental commits.
- `.vscode/mcp.json` is a local configuration file and is correctly untracked. Do not commit.
- Patches from phase 9 are lingering. If already merged, consider deleting them.

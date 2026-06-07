# Community Health

This folder contains files that improve the contributor and user experience on GitHub.

| File | Purpose |
|---|---|
| `ISSUE_TEMPLATE/bug_report.md` | Standardized bug report form |
| `ISSUE_TEMPLATE/feature_request.md` | Feature request template with priority |
| `ISSUE_TEMPLATE/question.md` | Q&A template for usage questions |
| `ISSUE_TEMPLATE/pr_template.md` | PR checklist (Thai-first, tests, screenshots) |
| `workflows/ci-minimum.yml` | Build gate on every PR |
| `workflows/release-drafter.yml` | Auto-draft release notes per merged PR |
| `SECURITY.md` | Vulnerability disclosure policy |
| `FUNDING.yml` | Sponsor links (GitHub Sponsors, etc.) |
| `CODEOWNERS` | Auto-assign reviewers per directory |
| `dependabot.yml` | Auto-PR for dependency updates |

## How to use

When you open an issue or PR, GitHub will auto-pick the right template.
The release-drafter workflow aggregates merged-PR titles into a release
notes draft every Monday.

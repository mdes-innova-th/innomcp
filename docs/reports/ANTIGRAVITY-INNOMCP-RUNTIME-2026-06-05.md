# Antigravity + INNOMCP Runtime Evidence - 2026-06-05

## Result

Jit/Codex now has Antigravity wired as a mission-control verification lane, and the local innomcp chat stack was rechecked after restoring MCP connectivity.

## Antigravity

- `C:\Users\USER-NT\.antigravity\config.yaml` contains:
  - `defaults.auto_approve: true`
  - `defaults.skip_permissions: true`
- `C:\Users\USER-NT\Jit\scripts\antigravity-y.sh` and `scripts\antigravity-y.ps1` append `-y`.
- `node C:\Users\USER-NT\Jit\eval\antigravity-probe.js` passed.
- Antigravity version proved: `1.107.0`.
- Antigravity user MCP config registers:
  - `playwright`: `npx -y @playwright/mcp@latest`
  - `chrome-devtools`: `npx -y chrome-devtools-mcp@latest`

Boundary: current Antigravity CLI help advertises `chat` and `--add-mcp`, but not `--exec`; `--exec plan.json -y` remains a planned gateway command until live CLI support is proven.

## Jit Provider Fleet

Fresh strict provider probe:

- content-usable: `ollama_mdes`, `ollama_cloud`, `thaillm`, `openai`
- degraded: `ollama_local` timed out, `copilot` quota-blocked with `402 quota_exceeded`, `openclaude` refused, `innova_bot` model call timed out

Fresh smoke matrix:

- `check-fleet --smoke` completed.
- `contentUsableBackends`: `ollama_mdes`, `thaillm`, `ollama_cloud`, `openai`
- ThaiLLM four-model smoke passed for OpenThaiGPT, Pathumma, Typhoon, and THaLLE.
- innova-bot collaboration still works via file-fallback dispatch: `node C:\Users\USER-NT\Jit\eval\innova-bot-talk.js` passed in `2222ms`.

## INNOMCP Runtime

MCP was missing at the start of this recheck, so the MCP dev server was restarted and backend was restarted to reconnect.

Verified after restart:

- `GET http://localhost:3012/health` returned `{"status":"ok"}`.
- MCP `tools/list` returned `56` remote tools.
- Backend `GET http://localhost:3011/health` returned `{"status":"ok"}`.
- Frontend `GET http://localhost:3000/api/health` reported:
  - `status: degraded`
  - `mode_ready: true`
  - `mcp_status: connected`
  - `remote_tools: 56`
  - `local_tools: 4`
  - `total_tools: 60`
  - MCP Server service: `healthy`
- Remaining readiness limitation: Redis/database are still unavailable; Redis reports not-ready state and Database service reports `unhealthy`, so the stack is `degraded` rather than fully healthy.

## Chat E2E

Command:

```powershell
pnpm --filter innomcp-next exec playwright test e2e/chat.spec.ts --project=chromium
```

Result:

- `11 passed (1.2m)`

This proves the current chat UI and health endpoint acceptance suite still pass after MCP reconnect, Antigravity/Jit orchestration updates, and the database-readiness health-gate fix.

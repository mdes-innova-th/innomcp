# INNOMCP Agent Convergence Layer

This workspace is the execution target for Jit, Codex, Antigravity, ClaudeCode, innova-bot, and browser MCP verification.

## Operating Contract

- Follow `AGENT_GUIDELINES.md` for the app-local multi-agent architecture.
- Follow `CODEX_GUIDE.md` for Codex/Jit delegation and evidence logging.
- Codex/Jit owns deep execution, integration, tests, commits, and final completion evidence.
- Antigravity is mission control for wide coordination and parallel verification, especially browser/MCP evidence.
- innova-bot is the MCP/body bridge; use it for live workspace collaboration when available.
- Keep secrets out of files and reports.

## Shared Skill Standard

- Use `SKILL.md` workflows as portable instructions across Codex, Antigravity, Claude, Copilot, and local Oracle agents.
- The Jit Antigravity skill lives at `C:\Users\USER-NT\Jit\.codex\skills\antigravity-orchestrator\SKILL.md`.
- The Jit convergence layer lives at `C:\Users\USER-NT\Jit\AGENTS.md`.

## Verification

- For chat UX changes, run the targeted Playwright chat suite before claiming completion.
- For backend/MCP changes, run targeted unit/build checks and verify MCP `tools/list`.
- For Antigravity routing changes, run `node C:\Users\USER-NT\Jit\eval\antigravity-probe.js`.

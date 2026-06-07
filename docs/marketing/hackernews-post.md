# HackerNews Launch — INNOMCP

> **Post when**: pick a Tuesday or Wednesday 9-11am US Pacific (peak HN traffic)
> **Account**: needs ≥ 6 months old, ≥ 50 karma
> **Title length**: < 80 chars

## Title A — Lead with "Manus alternative"
```
Show HN: INNOMCP – Manus-style AI agent workspace, free + open source
```
*77 chars — fits*

## Title B — Lead with "self-host"
```
Show HN: Self-hostable Manus alternative, 10+ LLM providers, MIT
```
*67 chars — fits*

## Title C — Lead with "Thai-first + multi-agent"
```
Show HN: INNOMCP – Open-source Manus clone, multi-agent, Thai-first
```
*67 chars — fits*

## Recommended: **Title A** (most concrete, captures the comparison, "free" is the hook)

---

## Post body (300 words, no marketing fluff)

Hi HN,

I built **INNOMCP** — a personal AI agent workspace that gives you the same feeling as [Manus.im](https://manus.im) but is **MIT-licensed, self-hostable, and runs on your own API keys** (Anthropic, OpenAI, local Ollama, or remote MDES).

**What's in the box:**
- **Multi-agent loop** with conductor + parallel dispatch + critique layer
- **20+ MCP tools** (Model Context Protocol) — shell, web fetch, weather, geo, data analysis, ...
- **10+ LLM providers** swap with a click: Claude Sonnet 4.6, Claude Haiku, GPT-4o, GitHub Copilot, local Ollama, MDES Ollama (Thai-optimized)
- **Live activity panel** — every tool call, agent step, and streaming token is visible
- **Artifact system** — markdown, code, CSV → SVG charts, files with preview + download
- **Thai-first**: 4 dedicated Thai tools (TMD weather, NWP forecast, 77-province geo, knowledge corpus), native Thai typography, `.break-thai-words` utility

**Why I built it:** Manus is great UX but $39/mo and closed. I wanted the same live multi-agent feeling for personal research + work, but couldn't justify the price + lock-in. INNOMCP is the result — 4 months of nights-and-weekends work.

**Stack:** Next.js 15 + Node 20 + Express 5 + MariaDB + custom MCP server. 59/59 system tests, 61/61 Playwright signoff, 214/214 regression (3 rounds, all green).

**Try it:**
```bash
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp
pnpm install
docker compose up -d mariadb
pnpm dev
# http://localhost:3000
```

Free forever, MIT licensed, no telemetry.

**Roadmap:** multi-user workspaces, mobile app, voice input, more MCP tools. PRs welcome — see `CONTRIBUTING.md`.

Repo: https://github.com/mdes-innova-th/innomcp

Happy to answer questions. What would you use this for?

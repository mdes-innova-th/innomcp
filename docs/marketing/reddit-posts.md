# Reddit Launch — INNOMCP

## r/LocalLLaMA (the obvious one)
- **Subscribers**: 250k+
- **Rules**: no overt self-promotion; must be transparent + add value
- **Best time**: Tue-Thu 8-10am ET

### Title
```
I built a Manus-style agent workspace that runs on local Ollama (and 9 other providers) — open source, MIT
```

### Body
Sharing my project: [INNOMCP](https://github.com/mdes-innova-th/innomcp) — a Manus-style AI agent workspace that you can self-host and run on **local Ollama** (or any of: Claude, GPT, GitHub Copilot, MDES).

**What works with local Ollama:**
- 100% offline chat
- 20+ MCP tools (shell, web fetch, weather, geo, data analysis)
- Multi-agent dispatch (conductor + parallel + critique)
- Artifact system (markdown, code, charts)

**Stack:** Next.js 15 + Node 20 + Express 5 + MariaDB. 214/214 Playwright regression, all green.

**What I had to compromise on for local models:**
- Smaller models (< 13B) struggle with the critique layer; the conductor still works but weaker reasoning
- Thai language needs a model trained on Thai (recommend `gpt-oss:120b-cloud` on MDES, or fine-tune Llama 3 with Thai data)
- Some MCP tools (shell) need a working code-interpreter

Curious what you all think. What local models have you found work well for multi-agent workflows?

---

## r/AI_Agents (smaller, more technical)
- **Subscribers**: 50k
- **Audience**: agent builders, MCP people, multi-agent devs

### Title
```
INNOMCP — Open-source multi-agent workspace with critique layer + MCP tool ecosystem
```

### Body
Wrote INNOMCP — a multi-agent AI workspace with the loop I wanted for my own research.

The interesting bits:

**1. Conductor → parallel → critique loop**
Each user query is split into 2-3 subtasks dispatched in parallel, then a critique agent re-evaluates the answer. If weak, re-runs with a different agent. This is the missing piece for "agentic" feel — the same answer twice in a row is rare.

**2. MCP tool ecosystem (20+ tools)**
- Thai Weather (TMD API)
- NWP forecast (Numerical Weather Prediction)
- Thai Geo (77 provinces)
- Web fetch (with SSRF protection)
- Shell (sandboxed)
- Data analysis (CSV → SVG)
- Web search, image gen, ...

Each tool is JSON-schema-validated. Easy to add new ones.

**3. Provider abstraction**
The conductor doesn't care if it's Claude or Ollama. You can route different tasks to different providers (Haiku for speed, Sonnet for reasoning).

**4. Live activity panel**
Every tool call, agent step, and streaming token is visible in real time. This is what makes Manus feel "alive" — INNOMCP does the same.

**Stack:** TypeScript end-to-end, MariaDB for persistence, MCP for tools. 214/214 Playwright tests.

Repo: https://github.com/mdes-innova-th/innomcp

What patterns are you all using for multi-agent coordination? My conductor pattern works but I'm curious about alternatives.

---

## r/opensource (free + open source angle)
- **Subscribers**: 200k
- **Audience**: FLOSS enthusiasts, sysadmins, tinkerers

### Title
```
INNOMCP — MIT-licensed Manus alternative, fully self-hostable, no telemetry
```

### Body
After 4 months I just published INNOMCP — an open-source, self-hostable alternative to Manus.im.

**Why this matters:**
- Manus is great UX but $39/mo, closed source, and your data goes to their servers
- Most "open alternatives" are SaaS wrappers with rate limits
- INNOMCP is **MIT licensed**, **runs on your hardware**, **no telemetry**, **bring your own API key** (or use 100% local Ollama)

**What you get:**
- Multi-agent AI workspace
- 20+ MCP tools
- 10+ LLM providers (Anthropic, OpenAI, local Ollama, MDES, GitHub Copilot)
- Web UI + API
- 214 Playwright tests, 59 system tests

**Why you'll care:**
- It's actually MIT (LICENSE file, not "source available")
- Works offline with local Ollama
- Thai-first (we're in Bangkok)
- The conductor + critique loop is genuinely better than single-agent chat for research tasks

**Try it:**
```bash
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp
pnpm install
docker compose up -d mariadb
pnpm dev
```

Feedback + PRs welcome.

---

## r/Thailand (Thai community — most likely to resonate)
- **Subscribers**: 80k
- **Mix**: Thai + English posts both fine; Thai often gets more engagement

### Title (Thai)
```
ทำ INNOMCP — AI workspace แบบ Manus แต่ฟรี + open source ใช้งานได้จริง
```

### Body (mixed Thai/English)
ช่วงนี้ Manus.im กำลังฮิต แต่ราคา $39/mo แพงเกิน + ข้อมูลเราไปอยู่บน server เขา

ผมเลยทำ **INNOMCP** ขึ้นมา — เป็น AI agent workspace แบบ Manus แต่:
- **ฟรี** (MIT license)
- **self-host ได้** ข้อมูลอยู่กับเรา
- **รองรับ local Ollama** — รัน 100% offline ได้
- **Thai-first** — มี tool สำหรับข้อมูลไทยโดยเฉพาะ (สภาพอากาศ TMD, ภูมิศาสตร์ 77 จังหวัด, NWP forecast)

**ฟีเจอร์หลัก:**
- Multi-agent (conductor + parallel + critique)
- 20+ MCP tools
- 10+ LLM providers
- Live activity panel + artifact system
- 214/214 Playwright tests

**Stack:** Next.js 15 + Node 20 + Express + MariaDB

**Repo:** https://github.com/mdes-innova-th/innomcp

ใครสนใจลอง clone ได้เลย
```bash
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp
pnpm install
docker compose up -d mariadb
pnpm dev
```

PR / feedback / issue welcome ครับ

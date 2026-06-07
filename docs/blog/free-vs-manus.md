# Why I built a free, open-source alternative to Manus.im

*By the MDES-Innova team — Bangkok, Thailand · 2026-06-07 · 8 min read*

---

I love what Manus.im is doing. The live activity panel, the multi-agent loop, the artifact system — it feels like the chat UX I've wanted for years. I built something for myself that captures that feeling, and I'm giving it away for free under MIT.

**It's called [INNOMCP](https://github.com/mdes-innova-th/innomcp)**, and this post is the long version of "why."

## The problem with Manus (and most "AI workspaces")

- **$39/month** for Pro tier — fine for power users, painful for tinkerers
- **Closed source** — I can't audit what data leaves my machine
- **Single provider** — locked to their backend
- **English-first** — Thai queries often get garbled answers
- **No self-hosting** — your chat history lives on someone else's database forever

For someone like me who lives in Thailand, runs a small dev studio, and uses 4 different LLMs depending on the task — that's a deal-breaker.

## What I wanted instead

A workspace that:

1. **Looks and feels like Manus** — live activity, multi-agent, artifacts
2. **Runs on my hardware** — full self-host, no telemetry
3. **Plays nicely with every LLM** — Claude for reasoning, Haiku for speed, Ollama for offline, MDES for Thai
4. **Speaks Thai well** — not as a translation layer, but as a first-class toolset (TMD weather, Thai geo, NWP forecast)
5. **Has a real tool ecosystem** — Model Context Protocol, so I can add a new tool in 5 minutes
6. **Is actually free** — MIT, not "free tier with rate limits"

I couldn't find it. So I built it.

## The architecture (4 months of work)

```
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   Next.js 15    │   │  Node 20 +       │   │  MCP Server      │
│   Chat UI       │←→│  Express 5       │←→│  20+ tools       │
│   Artifacts     │   │  Conductor       │   │  shell, weather  │
│   Activity Log  │   │  Critique Layer  │   │  geo, web fetch  │
└─────────────────┘   └──────────────────┘   └──────────────────┘
                              ↓
                    ┌──────────────────┐
                    │   MariaDB 11     │
                    │   chat history   │
                    │   memories       │
                    │   projects       │
                    └──────────────────┘
```

### The multi-agent loop (the interesting bit)

When you ask INNOMCP a question, here's what happens:

1. **Conductor** classifies the query ("weather + Thai + multi-day" → 3 agents)
2. **Parallel dispatch**: 3 agents fire simultaneously — each with its own tools
3. **Critique layer** reads all 3 outputs, picks the strongest, OR re-runs with different agents
4. **Streamed response** + **artifact panel** + **live activity log** — all visible to the user

This is what makes Manus feel "alive" — and it's surprisingly hard to build. Most "agent" demos are sequential, not parallel, and have no critique layer.

### The 10+ provider thing

```
Claude Sonnet 4.6   — hard reasoning, long context
Claude Haiku 4.5    — speed, cheap, Thai OK
OpenAI GPT-4o-mini  — fallback chain
GitHub Copilot      — code generation
Local Ollama        — 100% private, offline
MDES Ollama         — Thai-optimized, hosted
+ 4 more via OpenAI-compatible API
```

The conductor doesn't care which provider it talks to. You can route different tasks to different providers. Want Haiku for the classifier + Sonnet for the final answer? Click.

## What's open source (MIT) — and what isn't

The whole repo is MIT. You can:
- Use it for personal or commercial projects
- Fork and modify
- Sell a hosted version (please do)
- Use in closed-source products

You can't:
- Sue us if it breaks
- Expect paid support (we have a community Discord + GitHub Discussions)

## What I learned building it

### 1. Multi-agent critique is the magic ingredient
Without the critique layer, my "agent" answers were 60-70% as good as a single Claude call. With the critique layer re-evaluating and re-running weak answers, it's closer to 85% of a careful single-model workflow — but in 1/3 the wall-clock time.

### 2. MCP was the right call
Model Context Protocol is gaining traction. By making my tools MCP-compatible, I get plug-and-play with Anthropic's official tool SDK, the MCP inspector, and the growing ecosystem. Locking into a proprietary tool API would have been a mistake.

### 3. Self-hosting is a feature, not a sacrifice
"Easy to self-host" sounds like a niche concern. In practice: every developer I demoed this to wanted to self-host. Enterprise customers especially. "Your data never leaves your machine" is a one-liner that closes deals.

### 4. Thai-first ≠ Thai-only
Adding the 4 dedicated Thai tools (TMD weather, Thai geo, NWP, knowledge corpus) made the system BETTER for everyone, not just Thai users. The shell tool, web fetch, data analysis — they all work the same. The Thai tools are a value-add, not a separate product.

### 5. The activity panel is 50% of the value
If I removed the live activity log from INNOMCP, the system would feel 50% less "intelligent." Even when the answer is wrong, watching the conductor dispatch + critique gives users confidence that the system is *thinking*. This is what Manus nailed.

## Try it

```bash
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp
pnpm install
docker compose up -d mariadb
pnpm dev
# http://localhost:3000
```

No account, no telemetry, no rate limits. Bring your own API key (or use local Ollama for free).

## What's next

- **Multi-user workspaces** — teams with shared projects + memories
- **Voice input** — Whisper integration, already prototyped
- **Mobile app** — React Native, after the responsive sweep is done
- **More MCP tools** — calendar, GitHub, Notion, Slack, ...

## Get involved

- ⭐ Star the repo — it tells other devs this is worth their time
- 🐛 File issues — even "this confused me" is useful
- 🛠️ PRs welcome — see `CONTRIBUTING.md` for the full guide
- 💬 Discord (link in README) — for questions + show-and-tell

---

*If you found this useful, share it with one developer who complains about Manus pricing. They'll thank you.*

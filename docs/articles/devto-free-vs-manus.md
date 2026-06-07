# Dev.to Article — INNOMCP

**Target**: dev.to (open to all, great SEO, dev audience)
**Length**: 600-800 words
**Cover image**: `docs/social-preview.png`

---

## Building a Manus-style AI agent workspace that's actually free and self-hostable

*Originally posted on the MDES-Innova blog · 8 min read · 2026-06-07*

---

I've been a heavy Manus.im user for 6 months. The live activity panel, the multi-agent loop, the artifact system — it changed how I work. But $39/month and closed source rubbed the wrong way. So I built a free, open-source alternative.

**It's called [INNOMCP](https://github.com/mdes-innova-th/innomcp).** MIT licensed. Self-hostable. Runs on local Ollama. Speaks Thai. 4 months of work. 214 Playwright tests.

Here's what I learned building it.

## 1. The multi-agent critique loop is the magic ingredient

When you ask INNOMCP a question, three things happen in parallel:

- **Conductor** classifies the query and dispatches 2-3 specialized agents
- **Agents** run simultaneously, each with their own tools
- **Critique layer** reads all outputs, picks the strongest, OR re-runs with different agents

The critique layer is what makes the system feel "alive." Without it, my multi-agent answers were 60-70% as good as a single Claude call. With it, closer to 85% — and 3x faster wall-clock.

The code is in [`innomcp-node/src/utils/mcp/answerPlanner.ts`](https://github.com/mdes-innova-th/innomcp/blob/main/innomcp-node/src/utils/mcp/answerPlanner.ts). About 200 lines of TypeScript.

## 2. Model Context Protocol is the right abstraction

When I started, I almost built a proprietary tool API. Thank goodness I didn't.

MCP gives you:
- **Schema-validated tools** — type-safe, no surprise payloads
- **Sandboxing** — the tool runs in its own process
- **Ecosystem** — 100+ compatible servers you can plug in (Notion, GitHub, Slack, ...)
- **Inspector** — visual debugger for your tool calls

Adding a new MCP tool in INNOMCP takes 5 minutes. The whole tool ecosystem is 20+ tools and growing.

## 3. Provider abstraction > provider lock-in

Most "AI workspaces" lock you to one provider. INNOMCP talks to:

- Claude Sonnet 4.6 / Haiku 4.5
- OpenAI GPT-4o-mini
- GitHub Copilot
- Local Ollama (any model)
- MDES Ollama (Thai-optimized)
- + 4 more via OpenAI-compatible API

The conductor doesn't care which provider it talks to. You can route different tasks to different providers. Want Haiku for the classifier + Sonnet for the final answer? Click.

```typescript
// innomcp-node/src/services/providers/index.ts
export const providers: Record<string, Provider> = {
  claude_sonnet: new AnthropicProvider("claude-sonnet-4-6"),
  claude_haiku:  new AnthropicProvider("claude-haiku-4-5"),
  gpt4o_mini:    new OpenAIProvider("gpt-4o-mini"),
  copilot:       new CopilotProvider("gpt-4o"),
  ollama_local:  new OllamaProvider("http://127.0.0.1:11434"),
  // ...
};
```

## 4. Self-hosting is the killer feature

Every developer I demoed this to asked the same question: "Can I run this on my own server?" The answer is yes — Docker Compose one-liner, no SaaS, no telemetry.

For enterprise customers, "your data never leaves your machine" closes deals that $0/mo can't.

## 5. Thai-first ≠ Thai-only

Adding 4 dedicated Thai tools (TMD weather, Thai geo for 77 provinces, NWP forecast, knowledge corpus) made the system better for everyone. The shell tool, web fetch, data analysis — they all work the same. The Thai tools are a value-add layered on top, not a separate product.

## The "live activity" feel

50% of why Manus feels great is the live activity panel — every tool call, agent step, and streaming token is visible. INNOMCP does the same. Implementation: a single SSE channel pushing events to a React panel, ~300 lines total.

```typescript
// innomcp-next/src/components/ActivityPanel.tsx
const { events } = useSSE("/api/activity-stream");
return events.map((e) => <EventRow {...e} />);
```

## What I measured

After 4 months:
- **214 Playwright tests** passing in 3 rounds
- **59/59 system tests** green
- **61/61 browser signoff** green
- **0 crashes** in production-mode PM2

## Try it

```bash
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp
pnpm install
docker compose up -d mariadb
pnpm dev
# http://localhost:3000
```

Bring your own API key. Or use local Ollama for 100% offline.

## What's next

- Multi-user workspaces (teams with shared projects)
- Voice input (Whisper integration, prototyped)
- React Native mobile app
- More MCP tools (calendar, GitHub, Notion, Slack)

## Get involved

- ⭐ Star the repo: [github.com/mdes-innova-th/innomcp](https://github.com/mdes-innova-th/innomcp)
- 🐛 File an issue if you find a bug
- 🛠️ PRs welcome — see `CONTRIBUTING.md`
- 💬 Discord (link in README)

---

*If you build something on top of INNOMCP, I'd love to hear about it. Drop a comment below or hit me up on GitHub Discussions.*

---

## Comments template for engagement

- "How do you handle rate limiting across 10+ providers?"
- "What's your benchmark for the critique layer — when does it actually re-run?"
- "Have you considered using Mastra/AISDK/LangGraph instead of building from scratch?"

# X/Twitter Thread — INNOMCP

> 8 tweets · 280 chars each · target: 1k-10k impressions

---

## Tweet 1/8 (hook)
```
I built a free, open-source alternative to Manus.im.

Same multi-agent feel. Same live activity panel. Same artifact system.

MIT licensed. Self-hostable. Runs on local Ollama.

Here's what 4 months of nights-and-weekends looks like 🧵👇
```

## Tweet 2/8 (problem)
```
The problem with Manus:
- $39/mo
- Closed source
- Single provider
- No self-host
- Thai queries get garbled

I wanted all of that. So I built INNOMCP.
```

## Tweet 3/8 (the loop)
```
The interesting part: the multi-agent loop.

1. Conductor classifies the query
2. 2-3 agents run in parallel
3. Critique layer picks the strongest — or re-runs

Without critique, my agents were 60% as good as Claude.
With critique, 85% — and 3x faster.
```

## Tweet 4/8 (MCP)
```
I almost built a proprietary tool API. Thank goodness I didn't.

Model Context Protocol gives me:
- Schema-validated tools
- Sandboxing
- 100+ compatible servers (Notion, GitHub, Slack...)
- A visual inspector

Adding a new tool: 5 minutes.
```

## Tweet 5/8 (providers)
```
10+ LLM providers, swap with a click:

- Claude Sonnet 4.6
- Claude Haiku 4.5
- OpenAI GPT-4o-mini
- GitHub Copilot
- Local Ollama (any model)
- MDES Ollama (Thai-optimized)
+ 4 more

The conductor doesn't care which.
```

## Tweet 6/8 (Thai)
```
Thai-first ≠ Thai-only.

I added 4 dedicated Thai tools:
- TMD weather
- Thai geo (77 provinces)
- NWP forecast
- Knowledge corpus

Made the system BETTER for everyone, not just Thai users.
```

## Tweet 7/8 (numbers)
```
After 4 months:
- 214 Playwright tests (3 rounds, all green)
- 59/59 system tests
- 61/61 browser signoff
- 0 PM2 crashes
- 0 telemetry
- MIT licensed
```

## Tweet 8/8 (CTA)
```
Try it:
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp
pnpm install
docker compose up -d mariadb
pnpm dev

Star the repo if this is useful — that's the biggest compliment.

And if you build something on top, I want to hear about it.
```

---

## Engagement prompt (reply to thread)
```
If you've used Manus and want to try a free alternative,
this is it. Same UX, none of the lock-in.

If you're a developer curious about multi-agent systems,
the critique layer in the README is worth a read.
```

## Hashtags (optional, end of last tweet)
```
#AI #MultiAgent #MCP #OpenSource #SelfHosted #Manus
```

## Best time to post
- Tuesday-Thursday, 9-11am US Pacific
- Or 8-10am UK time
- Avoid weekends (lower engagement for dev content)

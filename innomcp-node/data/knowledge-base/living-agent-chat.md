# INNOMCP Living Agent Chat

> RAG-indexed user-facing description. The chat may cite this document when explaining how it works.

## What is the living agent chat?

INNOMCP answers your questions through a small team of specialized AI agents working together, not a single black-box model. The team includes:

- A **conductor** that decides which experts to involve
- A **concierge** that writes the final Thai answer in natural language
- A **tool scout** that picks the right tool or data source
- Topic specialists: **weather analyst**, **geo / travel planner**, **knowledge agent**
- A **grounding critic** that double-checks the answer is supported by facts
- A **Thai naturalness stylist** that smooths the wording

While the team works, you'll see a small clickable line in the assistant's reply that says **"ดูทีม AI กำลังคิด"**. Click it to expand a public-safe panel showing what each agent did, which tool was used, and how confident the team is. The panel never shows the model's private internal thinking; it only shows safe summaries that you would expect a teammate to share.

## How the answer streams

The main reply starts speaking early, in real time, then improves as more facts arrive. If a tool times out or an external data source is unavailable, you'll see an honest fallback note instead of a fake number.

## Three AI modes

You can choose how the team works:

1. **Local mode** — runs on the on-prem Ollama instance. Best for privacy and offline use.
2. **Remote mode** — uses the MDES Ollama endpoint at https://ollama.mdes-innova.online for heavier reasoning.
3. **Hybrid mode** — combines local + MDES + any provider you've added (OpenAI-compatible, Anthropic-compatible, OpenThaiGPT, Pathumma, Typhoon, THaLLE, etc.). The provider broker chooses the best one per task based on capability, latency, privacy, and budget.

Add your own provider any time via the **+ Add AI Provider** button in the AI mode selector.

## Feedback that actually changes the next answer

Every assistant reply has thumbs up / down / regenerate / "make it more natural" / "remember this style" controls. If you flag an answer as robotic, the team avoids that wording the next time. If a particular provider does well on a route, the broker prefers it for similar tasks.

## What the team will never do

- Show its raw private chain-of-thought (only safe public summaries)
- Reply to a planning question by just saying "please specify a province"
- Show map placeholder warnings on non-map answers
- Lead a Thai question with English
- Print raw JSON in the visible answer
- Log your API keys

## Where to learn more

- Architecture: `docs/brain/INNOMCP_BRAIN.md`
- Public-safe event schema: `docs/brain/AGENT_WORKSTREAM_CONTRACT.md`
- Decision log: `docs/brain/DECISION_LOG.md`
- Open work: `docs/brain/TASK_GRAPH.md`

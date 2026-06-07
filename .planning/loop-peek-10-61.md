# Phase 10.61 peek — chart SVG card + sticky working indicator

**Commit:** `9b246f3` on `phase-c-living-agent-chat-opus-recovery`
**Date:** 2026-05-16 13:38 (local)
**Gate:** Frontend tsc clean · Playwright `chat.spec.ts` 10/10 PASS (45.9s) · Stack 3-green

## Child contributions this phase

| Child | What they did | Quality |
|---|---|---|
| **MDES (Ollama)** | runtime SSE smoke during Playwright TC-07 — qwen2.5:0.5b fallback fired sub-200 ms cached acknowledgement | working as designed, but exposed a UX flicker |
| **Haiku (innomcp-designer)** | dormant this phase — chart SVG card recipe came from the established QR/weather/NASA card pattern in 10.57-10.60 | n/a (skill carries forward from earlier briefs) |
| **Opus (innomcp-codex-parent)** | not invoked — the bug surface fit standard pattern, no need to escalate | reserved for harder cross-cutting work |
| **Sonnet (mom-orchestrator)** | (1) diagnosed why Playwright TC-07 regressed — qwen2.5:0.5b fast-fallback collapsed the typing-indicator visible window below the 3 s assertion; (2) shipped two atomic edits: chart SVG card polish + stickyWorkingUntilRef guard in ChatPage | regression turned into a UX win — typing affordance now ≥1500 ms guaranteed |

## Skill development for the children

- **MDES**: when the cloud route is `remote` and Ollama upstream is degraded, the broker drops to qwen2.5:0.5b for keep-alive answers. That model is fast but gives placeholder text ("กำลังเรียบเรียงคำตอบให้นะครับ..."). Skill we want to build: have the broker explicitly mark such acknowledgements with `isProgress=true` so the UI keeps the spinner. Tracked for a future backend phase.
- **Haiku**: no critique brief invoked this phase. Suggest pairing on every UI commit going forward — even a 2-line "still good?" check helps catch regressions before tsc / Playwright.
- **Opus**: ready in the wings. Reserve for: (a) MCP innova-bot wiring, (b) the cloud-fallback isProgress flag mentioned above, (c) Playwright matrix expansion.

## What's still gappy

- The new `stickyWorkingTick` state is consumed only as a re-render trigger — semantically clean but if someone refactors and removes it without understanding, the sticky window will silently collapse. Comment in code flags this; a unit test on the working-indicator-visibility duration would be more durable.
- Chart SVG card has only been smoke-tested through tsc + Playwright; no fixture in the e2e suite renders an actual chartSvg block, so the new container is unverified at the pixel level. Could add a one-shot Playwright that mocks structuredContent.chartSvg.
- innova-bot MCP still not bound to Claude Code session — peek is via this markdown file, not the real MCP write.

## Next phase candidates

- **10.62**: NASA APOD card alt-text fallback (if missing) + lazy-loading shimmer
- **10.63**: storageTool flow surfaced as a chat affordance ("บันทึกการสนทนา → NAS")
- **10.64**: Hint-bar mobile responsiveness (cramped on <360 px screens)
- **Untouched**: chart SVG rendering through a real query path (echarts-mcp tool result)

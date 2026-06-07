# Phase 10.62 peek — NASA APOD lazy-load shimmer + onError fallback

**Commit:** `c74e4d8` on `phase-c-living-agent-chat-opus-recovery`
**Date:** 2026-05-16 13:46 (local)
**Gate:** Frontend tsc clean · Playwright `chat.spec.ts` 10/10 PASS (45.8s) · Stack 3-green

## Child contributions this phase

| Child | What they did | Quality |
|---|---|---|
| **MDES (Ollama)** | dormant — APOD card only renders on a NASA tool result, not exercised in the smoke gate | n/a |
| **Haiku (innomcp-designer)** | dormant — the brand token palette (violet/sky on muted) and animate-pulse-soft keyframe were already in the design system, so no new brief was needed | n/a |
| **Opus (innomcp-codex-parent)** | not invoked — straight forward state-driven polish | reserved |
| **Sonnet (mom-orchestrator)** | (1) added two pieces of state in ChatMessage for per-image load/error; (2) shipped a tri-state img wrapper (loading shimmer → loaded fade-in → error placeholder); (3) reserved aspect-[4/3] to kill the bubble-jump on late hdurl arrival | feature complete in one pass; one file diff |

## Skill development for the children

- **MDES**: idle this phase. Next time we get an APOD query through chat, the card should also pre-fetch the hdurl in the background and only present `url` if hdurl latency exceeds 800 ms. That's a backend-side improvement (NASA tool wrapper) — slate for a future phase.
- **Haiku**: still pending invocation. Suggest spinning up a one-shot brief covering: "evaluate ChatMessage.tsx's card grammar after 10.57-10.62" — should produce a checklist of cards that still need brand-token unification (chartSvg ✅, QR ✅, NASA APOD ✅, weather tile ✅, generated image, evidence dashboard, tool result block).
- **Opus**: ready. Reserve for the cross-cutting Haiku audit consolidation once Haiku produces its brief.

## What was learned about the React shape

- `useState` inside a function component for per-render-block UI state stays clean when the block is single-instance (one APOD per AI message). If we ever render multiple APODs in one message, we'd need an array-keyed map. Not a concern today.
- `aspect-[4/3]` + `absolute inset-0 opacity-0` is the React 19 friendly pattern for fade-in without layout shift, and works with both `loading="lazy"` and `decoding="async"`.

## What's still gappy

- The skeleton uses `animate-pulse-soft` (a slow opacity flicker). A diagonal shimmer (linear-gradient sweep) would feel more premium. Slate as 10.63 candidate.
- QR card (10.60) and GeneratedImageCard could receive the same skeleton-on-load treatment. Easy follow-up.
- Generated image card lacks the same onError fallback — the user gets a broken-image icon today.

## Next phase candidates

- **10.63**: diagonal shimmer keyframe (`@keyframes shimmer-sweep`) shared between APOD / QR / GeneratedImage skeletons
- **10.64**: GeneratedImageCard onError + skeleton parity with APOD
- **10.65**: EvidenceDashboard polish pass (still uses older grey tones)
- **10.66**: tool result block (when MDES returns raw structured data) — could be a themed card too

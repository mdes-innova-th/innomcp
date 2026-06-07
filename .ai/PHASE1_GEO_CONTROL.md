# PHASE 1 GEO CONTROL – Single Source of Truth

## Objective (Phase 1 GEO)
Make weather tool selection + response assembly:
- deterministic (เลือก tool ถูก)
- fast (<10s typical)
- resilient (timeout/retry/fallback)
- Thai-friendly (ภาษาถูก + ถ้า tool ตอบอังกฤษให้ normalize)

## Hard Freeze
- STOP phase2+ changes until Phase 1 GEO gate PASS.
- Only GEO work allowed.

## Core Modules (must exist)
1) geo-intent (analyze user question)
2) geo-tool-router (choose tool/endpoints)
3) geo-aggregator (merge tool outputs into compact packet)
4) geo-guard (timeouts/retry/fallback/language normalize)

## Definition of Done (must pass)
- NWP hourly vs daily selection correct for “24 ชม + พิกัด”
- TMD endpoints chosen correctly for forecast questions
- Remote AI down => local fallback answer produced
- Tool/API timeout => retry policy then degrade gracefully
- Unit tests >= 8 (deterministic) + E2E quick suite passes
- No duplicate tool registration
- No NODE_OPTIONS encoding hacks

## Workflow
SA -> Gravy (spec) -> Claude (code proposal) -> Gravy (approve) -> Vitcup (implement+tests) -> Claude (QA) -> SA (merge)

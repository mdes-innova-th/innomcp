# Phase 10.1: Acceptance Criteria

## 1. Unified Contract

- Weather output completely adheres to a singular `structuredContent` schema. The LLM acts purely as a router, not a text synthesizer.

## 2. Resilience

- Partial failures (one API up, one down) degrade gracefully, rendering the available data.

## 3. Verification

- Deterministic verification is achievable via `verify_phase101_weather_fusion.ts` under `$env:SMOKE_MODE=1`.

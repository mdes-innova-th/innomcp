# Phase 8.2: Robustness Gate Acceptance Criteria

## 1. PASS Conditions

- All ≥35 colloquial and typo-ridden queries must successfully map to the precise intent without falling back to the "I don't understand" state or calling the wrong tool.
- Multi-district extraction must securely parse target combinations (e.g., "ลักสี่", "บางรัก", "ปทุมวัน") safely without throwing exceptions on malformed Thai.

## 2. No-Hallucination Constraints

- Strict forbidden strings stringency: The system MUST NOT invent facts to satisfy a confusing query.
- It is better to fail safely with `ERR:GEO_NOT_FOUND` or `ERR:GEO_AMBIGUOUS` than to guess "เชียงใหม่" for "เชียงแสน".

## 3. Trace v3 Hygiene

- Intent routing metadata (e.g. `routeDecider: "deterministic"`) must be visible in `structuredContent.__render` for tracking.
- `CHAT_TRACE_QA=1` lines must continue to cleanly log the `route` and `tool` hit despite the messy input text.

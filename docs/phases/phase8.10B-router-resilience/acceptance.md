# Phase 8.10B Acceptance Criteria

1. **Deterministic Resilience**
   - Intent tools continue to function accurately for core system queries even if the `knowledge_entities` table is fully offline, relying entirely on the static snapshot.
2. **Observability**
   - `keywordSource` is demonstrably attached to the trace context so developers know whether the DB or static JSON was used during the turn.
3. **No Latency Penalties**
   - Offline DB scenarios must not cause the request pipeline to hang beyond 500ms while waiting for a timeout. The circuit breaker must fail fast.

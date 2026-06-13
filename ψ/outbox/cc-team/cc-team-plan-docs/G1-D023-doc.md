<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D023 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1724,"completion_tokens":5000,"total_tokens":6724,"prompt_tokens_details":{"cached_tokens":82,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5034,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 55s
 generated: 2026-06-13T11:23:17.129Z -->
- **`MemoryEntity`** — Shape of a grounded, session-scoped entity, tracking `name`, `type`, `value`, domain, provenance (`sourceTurn`, `sourceQuery`), and computed `freshness`.
- **`MemoryDomain`** — Union of subject-area tags (e.g., `weather`, `geo`, `knowledge`) used to categorize memory slots and entities.
- **`MemorySlot`** — Captures a single conversational turn, binding a domain to extracted entities plus optional routing metadata (`route`, `toolsUsed`, `timeScope`).
- **`SessionMemorySnapshot`** — Read-only consolidated view of a session, including deduplicated entities, the active domain, recent domains, and the last 10 slots. Returns empty fields if the session is unknown.
- **`SessionMemoryStore`** — In-memory store that records per-turn history, tracks entities/domains, and enforces caps and TTL eviction. Retains the last 20 slots and 50 unique entities per session; max 500 sessions.  
  **Caveat:** Stale-session eviction only runs when a new session is created, so old sessions can linger if the store is idle.
- **`SessionMemoryStore.recordTurn`** — Appends a turn to a session, auto-populating entity provenance and timestamps.  
  `@param sessionId` — Target session identifier.  
  `@param query` — Raw user query string.  
  `@param domain` — Classified domain for the turn.  
  `@param entities` — Partial entities; `sourceTurn`, `sourceQuery`, `timestamp`, and `freshness`

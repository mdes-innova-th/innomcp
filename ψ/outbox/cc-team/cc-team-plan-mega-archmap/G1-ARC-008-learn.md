<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-008 role=learn model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":2300,"completion_tokens":1778,"total_tokens":4078,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1819,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T11:59:05.725Z -->
**Single responsibility:** Boot-time, in-memory catalog of LLM provider metadata (`ProviderRecord`), seeded conditionally from `process.env`.

**Key exported API:** CRUD surface over a private `Map`—`upsert`, `get`, `list`, `remove`—consuming `ProviderUpsertInput` validated by `./types`.

**Upstream callers:** Admin configuration routes and the chat/agent router that queries capability/priority to select a provider before dispatching a request.

**Downstream deps:** `./types` (domain types, `validateUpsertInput`), `node:crypto`, and host environment variables.

**Role in pipeline:** Configuration plane; separates provider metadata from client instantiation, enabling capability-based routing.

**Surprising coupling:** Seed construction eagerly reads numerous `process.env` variables at module-import time, binding registry state to global env vars before any function invocation and making the module hard to test without pre-import env setup.

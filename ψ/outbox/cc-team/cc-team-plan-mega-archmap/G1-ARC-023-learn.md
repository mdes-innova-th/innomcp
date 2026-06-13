<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-023 role=learn model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":4408,"completion_tokens":1346,"total_tokens":5754,"prompt_tokens_details":{"cached_tokens":57,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1305,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T12:00:16.712Z -->
**Single responsibility:** Reference copy of hardcoded Thai general-intent fallback responses and text utilities, manually kept in sync with the live implementation.

**Key exported API:** `renderGeneralSmokeAnswer(userText)` — regex-based router for small-talk, Thai geography, and tech definitions; plus `renderThaiNumberText`, `renderGeneralFallbackMessage`, and `LOW_CONFIDENCE_FALLBACK_TEXT`.

**Upstream/downstream:** No production callers; the live code is inline in `routes/api/chat.ts` (`answerGeneralWithFastModel`). Only dependency is `logBoth` from `../utils/mcpLogger` (likely unused).

**Pipeline role:** Fast-model gate / catch-all responder that handles smoke tests, low-confidence fallbacks, and static knowledge before escalating to tool-based agents.

**Surprising coupling:** It is a manually-maintained shadow of live route code, creating stale-copy risk. It crams Thai geography, infrastructure health checks, NASA/WorldBank hints, and CS concepts (Docker, ML, RAG) into a single regex router, tightly coupling unrelated domains to one fallback module.

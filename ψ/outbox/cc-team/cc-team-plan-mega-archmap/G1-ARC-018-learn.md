<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-018 role=learn model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":2112,"completion_tokens":2633,"total_tokens":4745,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2458,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T11:59:57.118Z -->
**Single responsibility:** Static, local document retrieval over a curated markdown/text corpus using TF-IDF + keyword matching; zero external vector DB dependency.

**Key exported API:** `ColdRetriever` class with `loadCorpus(dir)` (index), `search(query, options?)` (rank chunks), `getRegistry()` (list docs); types `ColdDocument`, `ColdChunk`, `ColdRetrievalResult`.

**Upstream/downstream:** Upstream: orchestrator or hybrid retriever merging "cold" static with "hot" live sources. Downstream: Node `fs`/`path` and `./answerContract` (`RetrievalSource`).

**Pipeline role:** Pre-generation RAG step that injects grounded, source-traceable document chunks into the LLM prompt context.

**Surprising coupling:** Domain taxonomy (weather, law, geo, etc.) hardcoded via Thai/English regexes against file paths, tightly coupling folder naming to business logic. Synchronous `fs` calls inside async `loadCorpus`. Confidence scoring (`score * 2`) arbitrarily scaled internally rather than normalized upstream.

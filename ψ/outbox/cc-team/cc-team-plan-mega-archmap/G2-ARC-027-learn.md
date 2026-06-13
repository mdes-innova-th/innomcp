<!-- cc-team deliverable
 group: G2 (archmap division)
 member: ARC-027 role=learn model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2664,"completion_tokens":2259,"total_tokens":4923,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2028,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T12:01:09.051Z -->
**Single Responsibility:** Deterministic, zero-LLM keyword routing of user messages into 16 predefined workflow intents.

**Key API:** `classifyIntent(message, toolHint?)` returning `ClassifyResult` (`intent`, `expectedToolUsage`, `reasons`). Exports `ChatIntent` union type.

**Upstream/Downstream:** Called by the **Conductor** to select execution workflows. Depends downstream on `./systemInventory` for system queries.

**Pipeline Role:** Phase C fast-path router. Intercepts raw input to bypass LLM latency for obvious queries (weather, math, greetings) and directs the agent's tool-selection strategy.

**Surprising Coupling:**
1. **Naturalness Guard:** The `expectedToolUsage` boolean is tightly coupled to a downstream guard detecting "Used tools: none" hallucination leaks.
2. **Forensic Heuristics:** Hardcoded regex disambiguates Thai/English homonyms (e.g., "traffic" as travel vs. network evidence), unexpectedly embedding deep forensic/officer domain logic directly into the generic router.

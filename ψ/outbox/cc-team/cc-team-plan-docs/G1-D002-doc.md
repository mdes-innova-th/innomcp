<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D002 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":988,"completion_tokens":2640,"total_tokens":3628,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2208,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T11:19:59.575Z -->
* **`AnswerMode`**
  * **Purpose:** Union type defining the generation strategy used to produce the final answer.
  * **Caveat:** `"deterministic"` indicates direct routing or tool output without LLM synthesis.

* **`RetrievalMode`**
  * **Purpose:** Union type specifying which memory or retrieval tiers (hot, cold, both, or none) were queried to gather context.

* **`RetrievalSource`**
  * **Purpose:** Interface representing a single piece of context, document, or tool output used to ground the answer, including its metadata and confidence score.

* **`AnswerContract`**
  * **Purpose:** Interface defining the comprehensive metadata payload attached to a grounded answer, tracking routing, sources, freshness, memory integration, and degradation state.

* **`buildAnswerContract`**
  * **Purpose:** Factory function that constructs a fully populated `AnswerContract` from raw routing, retrieval, and execution parameters.
  * **`@param params`**: Object containing route info, tools used, sources, answer/retrieval modes, memory flags, confidence, and degradation details.
  * **`@returns`**: A complete `AnswerContract` object with an auto-generated ISO `timestamp`.
  * **Caveat (Freshness):** Automatically computes aggregate `freshness` by evaluating source values: prioritizes `"mixed"` (if both live and stale exist), then `"live"`, then `"recent"`, defaulting to `"stale"`. If no sources exist but `answerMode` is `"deterministic"`, it defaults to `"live"`.
  * **Caveat (Source Splitting):** Automatically categorizes `sources` into `hotSources` (types: tool, api, database) and `coldSources` (type: document), omitting the arrays entirely if they are empty.
  * **Caveat (Degradation):** Defaults the `degraded` boolean to `false` if not explicitly provided in the parameters.

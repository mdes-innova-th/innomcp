<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D022 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":280,"completion_tokens":1179,"total_tokens":1459,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1042,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-13T11:22:43.406Z -->
* **`checkAllServices`**
  * **Purpose:** Concurrently verifies the operational status of the analytics, MDES model cache, and Thai NLP services by executing a lightweight test call for each.
  * **@returns:** `Promise<{ analytics: boolean; mdesModels: boolean; thaiNlp: boolean }>` indicating whether each service's test call successfully fulfilled.
  * **Caveats:** Utilizes `Promise.allSettled` to ensure a failing service does not throw an error or prevent the remaining services from being evaluated. The Thai NLP check relies on a hardcoded `'test'` string input.

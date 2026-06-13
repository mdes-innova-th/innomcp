<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D037 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1673,"completion_tokens":2230,"total_tokens":3903,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2003,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:26:19.103Z -->
* **`GeoIntent`** (Class)
  * **Purpose:** Deterministic regex and keyword-based classifier for identifying weather-related intents and extracting geographic/temporal features from user messages.
  * **Caveat:** Only evaluates the "weather" domain; all non-matching inputs default to an "unknown" domain.
  * **`analyze`** (Method)
    * **Purpose:** Analyzes a raw user message to classify its domain and subdomain while extracting relevant coordinates, time ranges, and location terms.
    * **`@param`** `msg` (`string`): The raw user message to analyze.
    * **`@returns`** `GeoIntentResult`: An object containing the classified domain, subdomain, extracted features, confidence score, and raw input.
    * **Caveat:** Returns `domain: "unknown"` and `confidence: 0` if no weather keywords, TMD references, or combined time/location signals are detected. The confidence score is capped at 1.0 and rounded to two decimal places.

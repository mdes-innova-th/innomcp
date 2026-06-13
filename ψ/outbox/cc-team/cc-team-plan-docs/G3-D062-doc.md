<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D062 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":723,"completion_tokens":1331,"total_tokens":2054,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1199,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T11:28:59.244Z -->
- **`router`** (default export)
  - **Purpose:** Express router handling the session handoff endpoint, generating a plain-text Markdown summary of dispatch runs, provider standings, and session priorities.
  - **@param/@returns:** N/A (exports an Express `Router` instance).
  - **Caveats:** Returns `text/plain; charset=utf-8` instead of JSON. Hardcodes the total expected provider count (14) in the output text. Limits history retrieval to 10 runs, displaying only the 5 most recent runs and top 5 providers in the generated document.

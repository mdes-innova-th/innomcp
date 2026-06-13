<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D079 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1664,"completion_tokens":1411,"total_tokens":3075,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1454,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T11:31:01.256Z -->
- **`default` (router)**: Express router providing REST endpoints for managing prompt templates (list all, create custom, increment usage count, delete custom).
  - *Caveat*: Custom templates and built-in template `usageCount` increments are stored in-memory and will be lost on process restart. Built-in templates are protected from deletion (returns HTTP 403).

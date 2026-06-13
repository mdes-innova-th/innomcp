<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-009 role=deadcode model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1521,"completion_tokens":2387,"total_tokens":3908,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2243,"image_tokens":0},"cache_creation_input_tokens":0} | 31s
 generated: 2026-06-13T12:00:34.743Z -->
No high-confidence dead/unused code, unreachable branches, redundant conditions, commented-out blocks, or duplicate logic were identified in the provided module. The exported `contextManager` instance is assumed to be used externally, and all public methods/properties have at least internal or potential external use. The placeholder `summarize` method and unused readonly constants (`maxMessagesPerSession`, `maxContentLength`, `summaryMaxTokens`) could be dead if the rest of the codebase does not reference them, but without external usage information they are not flagged conservatively.

| location | what | why-safe-to-remove |
| -------- | ---- | ------------------ |
| -        | -    | -                  |

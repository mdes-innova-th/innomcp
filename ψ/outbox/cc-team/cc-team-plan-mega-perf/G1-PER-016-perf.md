<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-016 role=perf model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2575,"completion_tokens":1900,"total_tokens":4475,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1639,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-13T12:01:40.065Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `callImageGen` (entire function) | No caching of generated images; repeated identical prompts cause redundant generation calls | Implement a caching layer (e.g., in-memory Map with TTL) keyed by `providerPrompt` or `originalPrompt`; invalidate on TTL or when provider fails |
| Medium | `callGateway` (lines consuming `res.arrayBuffer()` and converting to base64) | Large image payload (PNG up to 1024×1024) is fully buffered in memory; the `base64` field duplicates the data URI content, increasing memory footprint | Stream response directly to persistent storage (e.g., S3 bucket) and return a URL; or omit the `base64` field when `url` is already a data URI; use streaming to avoid holding entire buffer |
| Low | `callPollinations` (the `HEAD` fetch) | Redundant HEAD request to validate Pollinations URL – adds unnecessary latency (~5s timeout) and network round-trip for every fallback request | Remove the HEAD request; rely on client-side error handling if the URL fails to load; optionally cache successful validity per prompt |

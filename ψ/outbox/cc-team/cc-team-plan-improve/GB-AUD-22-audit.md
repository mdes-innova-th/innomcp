<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-22 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2929,"completion_tokens":2635,"total_tokens":5564,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2402,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T11:16:13.563Z -->
| severity | location (function or approx line) | issue | proposed fix |
|----------|------------------------------------|-------|---------------|
| MEDIUM   | `buildSeed()`, around line `const mdesUrl = process.env.OLLAMA_REMOTE_BASE_URL \|\| "https://ollama.mdes-innova.online"; if (mdesUrl) {...}` | The MDES remote provider is always seeded because `mdesUrl` defaults to a hardcoded URL, making the `if (mdesUrl)` guard always true. This contradicts the comment that the seed is optional and intended only when the env variable is present. It introduces a provider into the registry that may be unreachable and unconfigured, leading to unnecessary health checks and possible confusion. | Only seed when the environment variable is explicitly set: remove the default URL and use `const mdesUrl = process.env.OLLAMA_REMOTE_BASE_URL; if (mdesUrl) {...}`. |

**Overall risk verdict:** LOW — Only one logic defect that inadvertently registers a provider; no crash, security, or concurrency issues.

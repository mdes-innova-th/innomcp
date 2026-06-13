<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-02 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2798,"completion_tokens":4788,"total_tokens":7586,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4633,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:11:56.306Z -->
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| LOW | `resolveEndpoint` (model timeout lookup) | Model string derived from environment variables (e.g. `LOCAL_OLLAMA_MODEL`, `REMOTE_OLLAMA_MODEL`) is not trimmed; leading/trailing whitespace will cause the lookup in `MODEL_TIMEOUT_MS` to miss and silently fall back to `DEFAULT_TIMEOUT_MS`, potentially surprising operators. | Trim the model string before using it: `const model = (envValue || …).trim()` and then look up timeout. |

**Overall risk verdict:** Low — one benign configuration edge case; otherwise no runtime defects in the visible code.

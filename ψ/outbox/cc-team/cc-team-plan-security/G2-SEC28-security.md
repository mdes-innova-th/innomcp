<!-- cc-team deliverable
 group: G2 (Security audit)
 member: SEC28 role=security model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1662,"completion_tokens":2621,"total_tokens":4283,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2555,"image_tokens":0},"cache_creation_input_tokens":0} | 36s
 generated: 2026-06-13T11:24:58.068Z -->
CRITICAL: ToolExecutor emits unfiltered `params`, `result`, and `originalError` to event listeners, exposing secrets. HIGH: execute() performs zero authorization checks, allowing any caller to trigger any tool. Concrete fixes: strip sensitive data from events; add a role/permission check using `options.context`.

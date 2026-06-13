<!-- cc-team deliverable
 group: G2 (deadcode division)
 member: DEA-027 role=deadcode model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1162,"completion_tokens":3484,"total_tokens":4646,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3397,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T12:05:02.181Z -->
| location | what | why-safe-to-remove |
|---|---|---|
| *Module-wide* | No high-confidence dead/unused code, unreachable branches, or redundant conditions found. | The module is concise and well-structured. All exports are actively tied to the main function's signature, runtime type guards are defensively sound, and regex/logic branches are fully reachable and distinct. |

<!-- cc-team deliverable
 group: G2 (typesafety division)
 member: TYP-027 role=typesafe model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1172,"completion_tokens":1388,"total_tokens":2560,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1294,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T12:03:15.883Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| Medium | `checkNaturalness` (opts access) | Missing null/undefined guard for `opts` and `opts.userQuery` before property access and regex testing. | Add `if (!opts || typeof opts.userQuery !== 'string')` early return, or use optional chaining `opts?.userQuery ?? ''`. |

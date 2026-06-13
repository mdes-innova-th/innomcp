<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D056 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2237,"completion_tokens":963,"total_tokens":3200,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":772,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T11:28:07.479Z -->
- **WORKSPACE_ROOT** – Sandbox root directory resolved at startup from the `WORKSPACE_ROOT` environment variable, or defaults to `<cwd>/../workspace`. Path is resolved using `path.resolve`, so it may differ from the raw env var. This constant defines the only directory that file operations are permitted within.

- **safePath(userPath)** – Resolves a user-supplied path relative to `WORKSPACE_ROOT` and returns the absolute path if it stays within the sandbox, or `null` if a path traversal attempt is detected.  
  @param userPath – A user-provided path (may contain backslashes or leading slashes).  
  @returns `string` if the resolved path is within `WORKSPACE_ROOT`, otherwise `null`.  
  **Note:** Normalizes backslashes to forward slashes and strips leading slashes before resolution. Does not verify file existence.

<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D046 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1361,"completion_tokens":741,"total_tokens":2102,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":432,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:26:55.694Z -->
- `getCurrentAIMode`: Returns the current AI mode (`'local'`, `'remote'`, or `'hybrid'`).  
  - `@returns` The active AI mode string.  
  - **Caveat**: The mode can be changed dynamically via the POST endpoint; this function always reflects the live value.

- `default` (aiModeRouter): An Express Router exposing two endpoints to manage the AI mode.  
  - **GET `/`**: Returns the current mode, available modes, and resolved configuration (URLs and models).  
  - **POST `/`**: Accepts a `{ mode }` body to change the mode. On success, it attempts to invoke `updateChatAIMode()` from the chat module to propagate the change.  
  - **Non‑obvious behavior**:  
    - The `updateChatAIMode` function is imported dynamically with a 1‑second delay (and only when `NODE_ENV` is not `'test'`). If the import hasn’t completed, a warning is logged but no error is thrown.  
    - Setting `remote` or `hybrid` when no remote URL is configured only logs a warning; the mode change is still applied.  
    - The environment variables used to resolve URLs and models follow a fallback chain (e.g., `LOCAL_OLLAMA_BASE_URL` → `OLLAMA_BASE_URL` → `OLLAMA_HOST`).

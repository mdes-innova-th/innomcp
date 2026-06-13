<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D063 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1092,"completion_tokens":2780,"total_tokens":3872,"prompt_tokens_details":{"cached_tokens":84,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2735,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:29:05.325Z -->
- **`router`** (default export) — Express router handling `GET /` for the mother inbox endpoint. Returns recent innova-bot messages from the local Jit ψ/inbox directory as JSON.  
  - Query params: `limit` (1–20, default 5) caps the number of matching messages returned; `since` (ISO timestamp) is used only to flag each message’s `isNew` property by comparing file `mtime`, **not** to filter out older messages.  
  - Only `.md` files are scanned (up to 50, newest first); messages are included only if their frontmatter `from` contains `"innova"` or `"local"` (case-insensitive). Unreadable files are silently skipped. On any filesystem error the route returns an empty inbox payload with HTTP 200.

<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D055 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":688,"completion_tokens":139,"total_tokens":827,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 5s
 generated: 2026-06-13T11:27:55.099Z -->
- **`default` (Express Router)** — POST `/` handler that persists a 1–5 star rating for a chat message. Accepts `{ messageId | message_id, rating, sessionId? | session_id? }` (camelCase or snake_case), validates `messageId` as a non-empty string and `rating` as an integer 1–5, returning 400 on invalid input. Responds `200 { ok: true }` immediately and performs the DB insert fire-and-forget; `message_id` and `session_id` are truncated to 64 chars before insert. DB errors are logged via `console.error` but never surface to the client.

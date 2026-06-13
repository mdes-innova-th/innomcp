<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D075 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1355,"completion_tokens":175,"total_tokens":1530,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T11:30:35.731Z -->
- **`roomWSS`** — `WebSocketServer` instance for project room events (presence + typing) operating in `noServer` mode, so the HTTP server in `server.ts` drives the upgrade handshake. Rejects unauthenticated connections (close 4001) and malformed `projectId` (close 4002); expects a JWT in the `?token=` query param (cookies are unreliable across WS clients) and a positive integer `projectId`. Receives `typing_start`/`typing_stop` from clients and broadcasts `user_joined`/`user_left`/`typing_start`/`typing_stop` to other room members (sender is excluded from typing broadcasts). Non-JSON frames and unknown message types are silently dropped; socket errors are logged but cleanup (via `roomService.leaveRoom`) runs in the `close` handler that follows.

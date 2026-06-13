<!-- cc-team deliverable
 group: G2 (typesafety division)
 member: TYP-029 role=typesafe model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1571,"completion_tokens":2437,"total_tokens":4008,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2250,"image_tokens":0},"cache_creation_input_tokens":0} | 40s
 generated: 2026-06-13T12:03:55.410Z -->
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|------------|
| Low | `join()` – after `projectPresence.set(...)` | Non‑null assertion `!` on `projectPresence.get(projectId)` | Retrieve and guard: `let room = projectPresence.get(projectId); if (!room) { room = new Map(); projectPresence.set(projectId, room); }` – then use `room` without `!`. |
| Low | `join()` – inside `if (room.has(key))` block | Non‑null assertion `!` on `room.get(key)` after a `has` check | Remove the `has` check and directly get: `const existing = room.get(key); if (existing) { /* update */ } else { /* create */ }`. This avoids the assertion entirely and reduces lookups. |

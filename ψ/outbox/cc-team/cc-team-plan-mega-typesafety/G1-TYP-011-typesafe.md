<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-011 role=typesafe model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":734,"completion_tokens":2115,"total_tokens":2849,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1983,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T12:00:03.546Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|---|
| medium | `on` method: `const handlers = this.listeners.get(event)!;` (line after `if` block) | Non-null assertion (`!`) | Replace with guard: `let handlers = this.listeners.get(event); if (!handlers) { handlers = new Set(); this.listeners.set(event, handlers); }` |
| medium | `emit` method: `catch (error)` | Untyped catch (implicit `any`) | Use `catch (error: unknown)` and add type guard before accessing `error` |

<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-002 role=typesafe model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1559,"completion_tokens":3201,"total_tokens":4760,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2890,"image_tokens":0},"cache_creation_input_tokens":0} | 65s
 generated: 2026-06-13T11:59:04.287Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `loadSnapshot` | `JSON.parse(data)` returns `any`, allowing unsafe property access and passing unvalidated data structures to the `Map` constructor. | Define a strict snapshot interface and validate the parsed JSON using a schema library (e.g., Zod) or runtime type guards before assignment. |
| Medium | `track` | Using user-controlled strings (`model`, `toolName`) as keys in a plain object (`Record<string, number>`) risks prototype pollution (e.g., if `model` is `__proto__`). | Change `modelCounts` and `toolCounts` to `Map<string, number>`, or initialize them with `Object.create(null)` to remove prototype inheritance. |
| Medium | `track` | Type narrowing via `'key' in event` lacks a strict discriminant, risking misclassification if runtime objects have overlapping properties. | Add a `type: 'message' \| 'tool' \| 'error'` discriminant field to the event interfaces and use `switch (event.type)` for exhaustive, safe narrowing. |
| Low | `loadSnapshot` | `catch { ... }` silently swallows all exceptions without logging, masking unexpected runtime errors, JSON syntax errors, or validation failures. | Catch the error as `unknown`, log it, and differentiate between expected errors (e.g., `ENOENT`) and unexpected failures. |

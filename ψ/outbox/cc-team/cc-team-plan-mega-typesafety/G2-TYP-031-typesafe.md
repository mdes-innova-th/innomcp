<!-- cc-team deliverable
 group: G2 (typesafety division)
 member: TYP-031 role=typesafe model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2477,"completion_tokens":2759,"total_tokens":5236,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2157,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T12:04:17.656Z -->
| Severity | Location | Unsafe pattern | Safer fix |
|----------|----------|---------------|-----------|
| High | `callOpenAI` – after `resp.json()` | `as { choices: Array<{ message: { content: string } }> }` – unsafe cast without validation | Use a schema validator (e.g., zod) to parse and validate the response structure; e.g., `const parsed = responseSchema.parse(await resp.json())`. |
| High | `streamOpenAI` – after `JSON.parse(payload)` | `as { choices: Array<{ delta?: { content?: string } }> }` – unsafe cast without validation | Validate the parsed object with a runtime type guard or schema parser before accessing properties. |
| High | `callAnthropic` – after `resp.json()` | `as { content: Array<{ type: string; text?: string }> }` – unsafe cast without validation | Use a schema validator for the Anthropic response structure. |
| High | `streamAnthropic` – after `resp.json()` (assumed similar) | `as { content: Array<{ type: string; text?: string }> }` – unsafe cast without validation | Same as above – validate with a schema. |
| Medium | `streamOpenAI` – catch block in SSE parsing | `catch { }` – untyped catch clause (implicit `any`) | Add an error parameter: `catch (e) { /* log or handle */ }`. Alternatively, use `catch { /* skip */ }` is syntactically valid but leaves `e` as `any`; explicitly typing as `unknown` and logging helps debugging. |
| Medium | `callOpenAI` – `model` assignment | `const model = req.model ?? provider.model;` – no fallback if both are `undefined` | Provide a guaranteed fallback (e.g., a default model or throw). Example: `const model = req.model ?? provider.model ?? "gpt-4";` |
| Medium | `callOpenAI` – `max_tokens` assignment | `max_tokens: req.maxTokens ?? provider.maxTokens` – no fallback if both are `undefined` | Add a sensible default: `req.maxTokens ?? provider.maxTokens ?? 1024`. |
| Medium | `streamOpenAI` – `model` and `max_tokens` (same pattern) | Same as above – missing default when both are `undefined` | Add defaults as shown above. |
| Medium | `callAnthropic` – `model` assignment | `const model = req.model ?? provider.model;` – no fallback if both `undefined` | Provide a default model or throw. Anthropic model is required. |
| Medium | `streamAnthropic` – `model` assignment | Same as above | Add default model. |

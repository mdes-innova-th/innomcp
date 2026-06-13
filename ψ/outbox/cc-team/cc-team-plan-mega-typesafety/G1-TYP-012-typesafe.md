<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-012 role=typesafe model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2340,"completion_tokens":2338,"total_tokens":4678,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1977,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T12:00:34.219Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `FastPathDecision` interface | `any` type (`structuredContent?: any`) | Use `unknown` or define a specific type/union for structured content. |
| High | `Responder` type alias | `any` type (`payload: any`) | Use `unknown` or a strictly typed payload interface. |
| Medium | `DEFAULT_OPTS` object | Unsafe cast (`process.env.FASTPATH_MODE as FastPathMode`) | Validate env var against allowed values (`"on" \| "off"`) before assignment. |
| Medium | `mergeExtra` function | Unsafe cast (`base[k] as string[]`) | Filter array elements at runtime: `.filter((x): x is string => typeof x === 'string')`. |
| High | `tryReadExtraFromFile` | Unsafe `JSON.parse` (returns implicit `any`) | Type result as `unknown` and validate object structure before accessing properties. |
| Medium | `tryReadExtraFromFile` | `any` in catch clause (`catch (e: any)`) | Use `catch (e: unknown)` and narrow type via `e instanceof Error`. |
| High | `tryReadExtraFromUrl` | Explicit `any` type (`const parsed: any = ...`) | Type as `unknown` and use type guards or a schema validator (e.g., Zod) before use. |
| Low | `tryReadExtraFromUrl` | Untyped/ignored catch clause (`catch { ... }`) | Use `catch (e: unknown)` to safely log or handle the error without implicit `any`. |

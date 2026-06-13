<!-- cc-team deliverable
 group: G2 (typesafety division)
 member: TYP-032 role=typesafe model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2075,"completion_tokens":1845,"total_tokens":3920,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1600,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T12:04:32.517Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `selectProvider` | Non-null assertion: `this.statuses.get(DEFAULT_PRIMARY_ID)!` | Add null guard: `const primaryStatus = this.statuses.get(DEFAULT_PRIMARY_ID); if (!primaryStatus) { /* handle missing */ }` |
| High | `getStats` | Non-null assertion: `this.statuses.get(DEFAULT_PRIMARY_ID)!` | Add null guard or fallback: `const primary = this.statuses.get(DEFAULT_PRIMARY_ID) ?? { id: DEFAULT_PRIMARY_ID, healthy: false, latencyMs: 0, failCount: 0, lastCheck: 0 };` |
| Medium | `checkProvider` (catch block) | Unsafe cast: `(error as Error).message` on `unknown` catch variable | Use type guard: `const msg = error instanceof Error ? error.message : String(error);` |
| Medium | `getStats` | Unsafe cast: `.filter(Boolean) as ProviderStatus[]` | Use type predicate: `.filter((s): s is ProviderStatus => s !== undefined)` |

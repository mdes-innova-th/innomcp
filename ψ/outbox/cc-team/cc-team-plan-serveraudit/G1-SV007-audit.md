<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV007 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":738,"completion_tokens":923,"total_tokens":1661,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":694,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T11:20:37.609Z -->
| severity | location | issue | proposed fix |
|----------|----------|-------|--------------|
| HIGH | `ThaiReligionEntitySchema` attributes `location: z.custom<GeoLocation>().optional()` | `z.custom<GeoLocation>()` without a validation function provides zero runtime checks; any value passes, leading to silent acceptance of malformed location data, causing downstream type-safety breaks and potential crashes. | Define a proper Zod object schema for `GeoLocation` (e.g., `z.object({ lat: z.number(), lon: z.number(), province: z.string(), district: z.string().optional() })`) and use it instead of `z.custom`. |
| MEDIUM | `ThaiReligionToolInputSchema` `query: z.string()` | Missing `.min(1)` allows empty string to be passed as query, which may cause silent operation failures or meaningless results. | Change to `z.string().min(1, "Query cannot be empty")`. |

**Risk verdict:** HIGH—unvalidated custom type lets arbitrary data masquerade as a `GeoLocation`, risking runtime crashes and data corruption.

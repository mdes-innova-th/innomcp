<!-- cc-team deliverable
 group: G1 (serverdeep division)
 member: SERV-011 role=audit model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":690,"completion_tokens":869,"total_tokens":1559,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":713,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T12:10:43.312Z -->
| severity | location | issue | fix |
|----------|----------|-------|------|
| HIGH | `ThaiReligionEntitySchema` → `attributes.location` field | `z.custom<GeoLocation>()` is used without a validation function. This will cause a runtime error when Zod tries to validate a `GeoLocation` object because no custom validator is provided. The type annotation is misleading and the schema will reject any input. | Replace `z.custom<GeoLocation>()` with a proper zod schema for the `GeoLocation` interface (e.g., `z.object({ lat: z.number(), lon: z.number(), province: z.string(), district: z.string().optional() })`) or provide a validation function as a second argument to `z.custom`. |

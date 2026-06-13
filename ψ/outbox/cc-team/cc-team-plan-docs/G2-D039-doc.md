<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D039 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1178,"completion_tokens":724,"total_tokens":1902,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":570,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-13T11:26:02.103Z -->
- **`GeoRouter`**: Stateful router that translates classified weather intents into an ordered MCP tool execution plan based on available location data.
- **`GeoRouter.route`**: Maps a classified intent to an ordered tool execution plan.
  - `@param intent` — The classified intent result containing domain, confidence, and location features.
  - `@returns` A `ToolPlan` object, or `null` if the intent cannot be routed.
  - *Caveat*: Returns `null` if the domain is not `"weather"`, confidence is < 0.6, or no location info (coordinates or place names) is present. Unrecognized subdomains default to a daily-by-place plan.

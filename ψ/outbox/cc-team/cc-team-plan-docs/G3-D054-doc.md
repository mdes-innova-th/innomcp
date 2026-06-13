<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D054 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":473,"completion_tokens":1310,"total_tokens":1783,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1167,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T11:27:50.337Z -->
* **`default` (Express Router)**: Provides debug API endpoints for testing internal emotion detection and GodTier routing logic.
* **`POST /selection`** (Endpoint on default router):
  * Purpose: Tests and returns the emotion detection and GodTier routing results for a given text input.
  * `@param req.body.text` (string) - Required. The text to analyze and route.
  * `@param req.body.history` (string[]) - Optional. Conversation history passed to the router context.
  * `@returns` JSON object containing `input`, `emotion`, `router` (with category, confidence, reasoning, ambiguity, scores, and latency), and `timestamp`. Returns 400 if `text` is missing, 500 on internal error.
  * Caveat: Exposes internal stack traces and routing scores on failure; relies on the `getGodTierRouter` singleton being properly initialized before use.

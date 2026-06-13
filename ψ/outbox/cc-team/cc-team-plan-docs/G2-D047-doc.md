<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D047 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":519,"completion_tokens":1491,"total_tokens":2010,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1302,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:27:22.077Z -->
* **`default`**
  * **Purpose:** Express router handling analytics endpoints for fetching system stats, tracking frontend events, and resetting analytics data.
  * **@returns:** An Express `Router` instance configured with `/stats`, `/event`, and `/reset` routes.
  * **Caveats & Non-obvious Behavior:**
    * **Missing Auth:** The `POST /reset` route is commented as "admin only", but no authentication or authorization middleware is applied in this module.
    * **Strict Body Validation:** `POST /event` strictly requires a `type` property in the JSON body; it returns HTTP 400 if absent.
    * **Localized Errors:** Error responses (HTTP 400 and 500) return localized Thai error message strings (e.g., `'เกิดข้อผิดพลาดในการดึงสถิติ'`) rather than English defaults.

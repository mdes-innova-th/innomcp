<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D057 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":630,"completion_tokens":1698,"total_tokens":2328,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1500,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T11:28:31.004Z -->
* **`router`** (default export)
  * **Purpose:** Express router providing API endpoints to list MDES models, fetch a specific model by name, and select the best model for a predefined task.
  * **Behavior/Routes:** 
    * `GET /models`: Retrieves all available models.
    * `GET /models/:name`: Retrieves a specific model by name; returns HTTP 404 if the model does not exist.
    * `GET /best/:task`: Retrieves the optimal model for a given task; returns HTTP 400 if `task` is not strictly `'thai'`, `'code'`, `'reasoning'`, or `'fast'`.
  * **Caveats:** Fallback error messages in `catch` blocks are in Thai if the caught exception is not an instance of `Error`. All data operations are delegated to the `mdesModelCache` service.

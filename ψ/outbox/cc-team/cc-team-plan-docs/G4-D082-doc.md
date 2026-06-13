<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D082 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1387,"completion_tokens":2227,"total_tokens":3614,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2015,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T11:32:24.071Z -->
* **`router`** (default export)
  * **Purpose:** Express router providing CRUD operations and a test delivery endpoint for the webhook registry.
  * **Caveats / Non-obvious Behavior:**
    * **User Resolution:** Derives the target `userId` from `req.user.id`, falling back to `req.apiKeyData.apikey_id`, and ultimately defaulting to the literal string `"default"` if neither is present.
    * **Secret Masking:** All outbound webhook payloads strip the raw `secret` string, replacing it with a boolean `hasSecret` indicator.
    * **Test Endpoint Bypass:** The `POST /:id/test` route ignores the webhook's `enabled` status and event subscription filters, unconditionally firing a hardcoded `task.completed` payload.
    * **Strict Validation:** Webhook creation (`POST /`) enforces valid URL parsing via the `URL` constructor and restricts the `events` array to a hardcoded allowlist (`VALID_EVENTS`).

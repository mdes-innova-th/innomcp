<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D029 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1732,"completion_tokens":2755,"total_tokens":4487,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2047,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:23:39.739Z -->
- **`WebhookEvent`**: Union type defining the supported webhook event names (`task.completed`, `task.failed`, `artifact.created`, `approval.required`).
- **`Webhook`**: Interface representing a registered webhook, including its target URL, subscribed events, secret, and delivery state.
  - Caveat: `lastTriggeredAt` and `failureCount` are mutated in-place during webhook delivery.
- **`listWebhooks`**: Retrieves all webhooks, optionally filtered by user ID.
  - `@param userId` - Optional user ID. If provided, returns webhooks matching this ID plus webhooks with no `userId`.
  - `@returns` Array of `Webhook` objects.
- **`getWebhook`**: Retrieves a single webhook by its ID.
  - `@param id` - The webhook ID.
  - `@returns` The `Webhook` if found, otherwise `undefined`.
- **`createWebhook`**: Registers a new webhook in the in-memory store.
  - `@param input` - Webhook data excluding `id`, `createdAt`, and `failureCount` (which are auto-generated).
  - `@returns` The newly created `Webhook`.
  - Caveat: Storage is in-memory only; data is lost on process restart.
- **`deleteWebhook`**: Removes a webhook from the store by ID.
  - `@param id` - The webhook ID.
  - `@returns` `true` if the webhook was found and deleted, `false` otherwise.
- **`toggleWebhook`**: Enables or disables a specific webhook.
  - `@param id` - The webhook ID.
  - `@param enabled` - The new enabled state.
  - `@returns` The updated `Webhook`, or `null` if the ID was not found.
- **`fireWebhookById`**: Manually fires a webhook event to a specific webhook, bypassing its `enabled` flag and event subscription filters.
  - `@param id` - The target webhook ID.
  - `@param event` - The event name to fire.
  - `@param payload` - The data payload to send.
  - `@returns` A `Promise<void>` that resolves on successful delivery.
  - Caveat: Throws an error if the webhook is not found, if the HTTP response is not ok, or if the request times out (10s). Mutates `lastTriggeredAt` and `failureCount` on the webhook object.
- **`fireWebhook`**: Delivers a webhook event payload to all enabled webhooks subscribed to that event.
  - `@param event` - The event name to fire.
  - `@param payload` - The data payload to send.
  - `@returns` A `Promise<void>` that resolves when all deliveries are settled.
  - Caveat: Uses `Promise.allSettled` so individual delivery failures do not reject the overall promise. Mutates `lastTriggeredAt` and `failureCount` on webhook objects in-place. Uses a 10-second timeout per request.

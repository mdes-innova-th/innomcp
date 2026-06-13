<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D017 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1846,"completion_tokens":2614,"total_tokens":4460,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2253,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T11:22:06.624Z -->
* **`ChatMessage`**
  Represents a single message within a chat conversation context.
  * `@property role` — The sender's role (`"system"`, `"user"`, or `"assistant"`).
  * `@property content` — The textual content of the message.

* **`AdapterRequest`**
  Defines the parameters for an LLM API call, including the conversation history and optional generation settings.
  * `@property messages` — The array of chat messages forming the conversation context.
  * `@property model` — Overrides the provider's default model if specified.
  * `@property maxTokens` — Maximum number of tokens to generate.
  * `@property temperature` — Sampling temperature controlling generation randomness.
  * `@property stream` — Boolean flag indicating if the response should be streamed.
  * *Caveat:* Unspecified optional parameters (like `maxTokens` or `temperature`) will fall back to the provider's default configuration at runtime.

* **`AdapterChunk`**
  Represents a single event payload emitted during a streaming LLM response, indicating text updates, completion, or failures.
  * `@property type` — The chunk event type (`"delta"`, `"done"`, or `"error"`).
  * `@property delta` — The incremental text content.
  * `@property error` — The error description.
  * *Caveat:* `delta` and `error` are mutually exclusive and only populated when `type` is `"delta"` or `"error"`, respectively. Malformed SSE lines from the provider are silently skipped internally and will not trigger an `"error"` chunk.

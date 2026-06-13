<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D012 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2027,"completion_tokens":1976,"total_tokens":4003,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1516,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T11:21:17.267Z -->
- **`ImageGenResult`**
  Represents the successful payload of an image generation request, including provider metadata, timing, and the generated image reference.
  - *Caveat:* The `url` field may be a public URL (Pollinations) or a base64 `data:` URI (Gateway). The `prompt` field contains the cleaned/adapted text actually sent to the AI, while `originalPrompt` preserves the raw user input for UI display.

- **`ImageGenError`**
  Represents a failed image generation response containing error details.
  - *Caveat:* Always includes the literal `ok: false` property to enable discriminated union narrowing when combined with `ImageGenResult`.

- **`ImageGenResponse`**
  A discriminated union type representing either a successful (`ok: true`) or failed (`ok: false`) image generation outcome.
  - *Caveat:* Consumers must check the `ok` boolean to safely narrow the type between `ImageGenResult` and `ImageGenError`.

- **`CallImageGenOptions`**
  Configuration options for the `callImageGen` function to override default prompt processing.
  - *Caveat:* If `adaptedPromptEn` is provided, it bypasses the internal regex-based prompt cleaning and is sent directly to the provider. 

- **`callImageGen`**
  Generates an image from a text prompt, prioritizing the secure MDES Gateway and falling back to Pollinations.ai if the gateway fails or is unconfigured.
  - **`@param rawPrompt`**: The user's original text message or extracted prompt.
  - **`@param opts`**: Optional overrides for prompt adaptation and original prompt tracking.
  - **`@returns`**: A promise resolving to an `ImageGenResponse` discriminated union.
  - *Caveat:* Relies on `IMAGE_GEN_GATEWAY_URL`, `IMAGE_GEN_GATEWAY_TOKEN`, and `IMAGE_GEN_TIMEOUT_MS` environment variables. Prompts are strictly truncated to 500 characters. If the Gateway throws an error or times out, it silently falls back to Pollinations.ai.

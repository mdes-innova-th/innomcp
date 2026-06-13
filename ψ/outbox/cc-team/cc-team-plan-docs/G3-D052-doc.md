<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D052 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":500,"completion_tokens":1677,"total_tokens":2177,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1478,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:27:57.760Z -->
* **`csrfRouter`** (default export)
  * **Purpose:** Express router providing a `GET /` endpoint to generate, store, and distribute CSRF tokens for client-side use.
  * **`@returns` (Endpoint Response):** JSON object `{ csrfToken: string }` containing the SHA-256 hashed token.
  * **Caveats & Non-obvious Behavior:**
    * Sets two `httpOnly`, `sameSite: "strict"` cookies with a 1-hour TTL: `csrf_token` (raw 32-byte hex string) and `csrf_token_hash` (SHA-256 hashed hex string).
    * The raw token is never exposed in the response body; only the hashed version is returned to the client to prevent XSS leakage while allowing middleware verification.
    * The `secure` cookie flag is conditionally enabled only when `process.env.NODE_ENV === "production"`.

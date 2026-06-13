<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D008 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1925,"completion_tokens":4550,"total_tokens":6475,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4240,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T11:20:45.285Z -->
- **`trigToDeg(expr)`** — Rewrites bare trigonometric calls so mathjs interprets numeric arguments as degrees rather than radians.
  - `@param expr` — Mathematical expression to transform.
  - `@returns` — Expression with `deg` appended to plain numeric arguments of `sin`/`cos`/`tan`/`asin`/`acos`/`atan`.
  - **Caveat:** Returns `expr` unchanged if it already contains `deg`, `rad`, or `pi`; only arguments matching a plain number (including negatives) are converted.

- **`cleanFloat(val)`** — Rounds away floating-point artifacts (e.g., `0.9999999999999999` → `"1"`).
  - `@param val` — Number to clean.
  - `@returns` — String representation; returns an integer string when the rounded value is whole.
  - **Caveat:** Internally rounds to 10 decimal places before checking for integer equality.

- **`FastPathMode`** — Union type that toggles the fast-path handler.
  - Type: `"off" | "on"`
  - **Caveat:** Defaults are driven by the `FASTPATH_MODE` environment variable.

- **`FastPathHandlerOptions`** — Configuration for fast-path short-circuiting, external phrase enrichment, and latency guards.
  - `mode?` — Override the default on/off state.
  - `extraPhrasesFile?` / `extraPhrasesUrl?` — JSON overlay sources for additional trigger phrases; file paths resolve relative to `process.cwd()` when not absolute.
  - `maxWorkMs?` — Maximum milliseconds to spend before yielding to the main AI pipeline.
  - **Caveat:** These options overlay the built-in dictionary from `fastPathGreeting.ts`; unset values fall back to `FASTPATH_*` environment variables.

- **`FastPathDecision`** — Result shape indicating whether a request was handled by the fast path and how long it took.
  - `handled` — `true` if a short-circuit response was produced.
  - `latencyMs` — Decision time in milliseconds.
  - **Caveat:** `hit`, `responseTextPreview`, and `structuredContent` are only populated when `handled` is `true`.

- **`Responder`** — Transport-agnostic callback signature for delivering a response payload.
  - `@param payload` — Response data to send.
  - `@returns` — `Promise<void>` for async delivery, or `void`.
  - **Caveat:** The caller must supply the concrete implementation; used for both HTTP routes and WebSocket flows.

<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-002 role=fuzz model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1405,"completion_tokens":4350,"total_tokens":5755,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3309,"image_tokens":0},"cache_creation_input_tokens":0} | 81s
 generated: 2026-06-13T11:59:17.024Z -->
- **Property**: Shape validation short-circuits string scanning
  - **Fuzz Input**: `AgentEvent` missing required fields (e.g., `type`, `runId`) to fail `validateAgentEvent`, but containing `privateThought: "secret"` and `publicSummary: "Weather Map Placeholder"`.
  - **Expected Invariant**: Returns `ok: false` with `shapeError` populated. `forbiddenKey` and `forbiddenSubstring` must be strictly `undefined` (no further scanning occurs).

- **Property**: Forbidden key detection is case-insensitive and nesting-agnostic
  - **Fuzz Input**: Valid `AgentEvent` with deeply nested objects/arrays containing keys like `"PrIvAtEtHoUgHt"`, `"SECRET"`, and `"apikey"`.
  - **Expected Invariant**: Returns `ok: false`. `forbiddenKey` matches the canonical casing from `FORBIDDEN_KEY_NAMES` (e.g., `privateThought`, `secret`, `apiKey`).

- **Property**: Forbidden key scanner ignores values and unquoted substrings
  - **Fuzz Input**: Valid `AgentEvent` where `publicSummary` is `"My password is a secret chainOfThought"` and `deltaText` is `"The apiKey is hidden"`.
  - **Expected Invariant**: Returns `ok: true`. Forbidden words appearing strictly as string values, not as serialized JSON keys (`"key":`), must not trigger the key guard.

- **Property**: JSON `undefined` stripping bypasses key detection; `null` does not
  - **Fuzz Input**: Valid `AgentEvent` with `privateThought: undefined` vs `privateThought: null`.
  - **Expected Invariant**: `undefined` yields `ok: true` (key stripped by `JSON.stringify`). `null` yields `ok: false, forbiddenKey: 'privateThought'` (serializes to `"privatethought":null`).

- **Property**: Exact visible literal matching is strict and case-sensitive
  - **Fuzz Input**: `finalText` containing `"weather map placeholder"` (lowercase) vs `"Weather Map Placeholder"` (exact). Also test Thai string `"ข้อมูลไม่ครบสำหรับการแสดงแผนที่"` vs `"ข้อมูลไม่ครบ"`.
  - **Expected Invariant**: Lowercase English and partial Thai yield `ok: true`. Exact English and exact Thai yield `ok: false`, with `forbiddenSubstring` equaling the exact literal.

- **Property**: "Placeholder" word boundary regex prevents false positives
  - **Fuzz Input**: `deltaText` containing `"placeholders"`, `"ngoutplaceholder"`, and `"place-holder"` vs `"placeholder"` and `"placeholder."`.
  - **Expected Invariant**: `"placeholders"`, `"ngoutplaceholder"`, and `"place-holder"` yield `ok: true`. `"placeholder"` and `"placeholder."` yield `ok: false, forbiddenSubstring: 'placeholder'`.

- **Property**: `allowMapTerms` overrides "placeholder" word check but NOT exact literals
  - **Fuzz Input**: `deltaText` = `"This is a placeholder. Weather Map Placeholder"`, with `opts.allowMapTerms = true`.
  - **Expected Invariant**: Returns `ok: false, forbiddenSubstring: 'Weather Map Placeholder'`. The standalone word "placeholder" is ignored, but the exact literal still blocks.

- **Property**: "Used tools: none" regex handles flexible whitespace and respects `expectedToolUsage`
  - **Fuzz Input**: `publicSummary` = `"Used tools: \n none"` (with newline/spaces). Tested with `opts.expectedToolUsage = false` and `opts.expectedToolUsage = true`.
  - **Expected Invariant**: `expectedToolUsage: false` yields `ok: true`. `expectedToolUsage: true` yields `ok: false, forbiddenSubstring: 'Used tools: none'`.

- **Property**: Visible text scanning strictly isolates target fields
  - **Fuzz Input**: Valid `AgentEvent` where `publicSummary`, `deltaText`, `finalText`, and `fallbackReason` are clean, but a non-standard/custom field (e.g., `internalDebug: "Weather Map Placeholder"`) contains forbidden text.
  - **Expected Invariant**: Returns `ok: true`. The visible substring scanner must only evaluate the four explicitly defined visible fields.

- **Property**: `checkVisibleTextSafe` is strictly equivalent to `checkAgentEventSafe` for text violations
  - **Fuzz Input**: Randomly generated strings containing mixed forbidden literals, "placeholder", and "Used tools: none", passed to both functions (using `deltaText` for the envelope).
  - **Expected Invariant**: `checkVisibleTextSafe(text, opts)` returns the exact same `ok`, `reason`, and `forbiddenSubstring` as `checkAgentEventSafe` wrapping the text in a valid envelope.

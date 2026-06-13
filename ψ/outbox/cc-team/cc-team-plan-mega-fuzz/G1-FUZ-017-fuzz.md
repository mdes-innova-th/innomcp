<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-017 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2483,"completion_tokens":3599,"total_tokens":6082,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1828,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T12:03:42.401Z -->
### 1. API key never appears in error output
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
No thrown error message or error chunk contains the API key string. | Call `callOpenAI` with a provider that returns a 401 response body `{"error":"Invalid API key: sk-123"}` (simulate). | The thrown `Error` message must **not** include the literal value of the key; it may contain status 401 and body but the actual key must be absent from the message.
Streaming error chunk must also exclude the key. | `streamOpenAI` with same provider; on 401, `onChunk({ type: "error" })` must be emitted. | The chunk's `.error` string must not contain the key.

### 2. Missing / empty API key aborts with safe error
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
`requireApiKey` throws without exposing the (missing) key. | `provider.id = "gpt-4"` but `resolveApiKey(provider.id)` returns `""`. | `callOpenAI` throws an `Error` whose message is `"API key not configured for provider: <displayName>"`. Message must **not** contain the empty string or `undefined`.

### 3. Malformed `messages` array does not cause uncaught exception
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
All adapter functions handle `messages` edge cases without crashing. | `messages: []` (empty array). | `callOpenAI` sends `messages: []`; returns empty string or throws a controlled error (no property access crash).
A message with `role` missing or `null`. | `messages: [{ content: "hi" }]` (role undefined). | Fetch is made with JSON containing `role: undefined`; adapter must not crash before fetch; network error will surface cleanly.
`content` is `null` or omitted. | `[{ role: "user" }]`. | Response handling must not break when `content` is `null`; returns `""` or safe fallback.

### 4. Adapter never hangs – timeout enforced
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
All calls abort after `provider.timeoutMs` regardless of slow response. | `provider.timeoutMs = 1` (1 ms), `fetch` mocked to never resolve. | `callOpenAI` rejects with an `AbortError` (or wrapped error) within a short grace period; no indefinite hang.
Timer cleanup always runs (no dangling `setTimeout`). | Same as above; observe after call settles. | `clearTimeout` is invoked exactly once in the `finally` block; no timer leak.

### 5. Streaming: malformed SSE lines are silently skipped
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
`streamOpenAI` ignores lines that are not valid JSON without crashing. | SSE data lines containing `data: {broken` and `data: "hello"`. | `onChunk` receives only deltas from correctly parsed chunks; no error chunk emitted for parse failures; stream eventually ends with `done`.
Empty `data:` lines (`data: ` with no payload) are skipped. | Line `data:`. | No chunk emitted for that line; processing continues.

### 6. Streaming: response without body yields an error chunk
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
If `resp.body` is null, an error is emitted and reading is not attempted. | Simulated fetch that returns `ok: true` but `body: null`. | `onChunk` receives exactly one chunk: `{ type: "error", error: "No response body from OpenAI stream" }`. No `done` follows.

### 7. Anthropic system message extraction doesn’t drop messages
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
`callAnthropic` strips system messages and combines them, but all non‑system messages remain in the `messages` array. | `messages: [ {role:"system", content:"A"}, {role:"user", content:"B"}, {role:"system", content:"C"} ]`. | Sent `body.messages` equals `[{role:"user", content:"B"}]`; `body.system` equals `"A\n\nC"`.
If only system messages exist, `messages` is empty array. | `messages: [ {role:"system", content:"S"} ]`. | `body.messages: []`, `body.system: "S"`. The adapter must not crash; API may return error but adapter should handle the response normally.

### 8. Provider defaults are applied correctly
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
Missing `model` falls back to `provider.model`. | `req.model` omitted, `provider.model = "gpt-4o-mini"`. | Request body contains `model: "gpt-4o-mini"`.
Both omitted → `undefined` sent. | `req.model` omitted, `provider.model = undefined`. | Body has `model: undefined` (JSON doesn’t include key? Actually stringify omits undefined, so key absent). Adapter must not crash.
`maxTokens` defaults: request → provider → 1024 (Anthropic only). | `callAnthropic` with `req.maxTokens = undefined`, `provider.maxTokens = undefined`. | Body `max_tokens` is `1024`.
`temperature` defaults: request → provider → omitted (OpenAI) or undefined (Anthropic). | `callOpenAI` with no `temperature` in request or provider. | Body has `temperature` omitted (key absent), not `undefined`. Works.

### 9. Invalid HTTP status codes produce non‑crashing errors
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
On 5xx, error text is read and thrown, but never leaks API key. | `fetch` responds with 500 and body `"Internal error"`. | `callOpenAI` throws `Error("OpenAI API error 500: Internal error")`.
Streaming 5xx must emit error chunk (not throw). | Same for `streamOpenAI`; 500 response. | `onChunk` receives `{ type: "error", error: "OpenAI API error 500: Internal error" }`. No further chunks.

### 10. Response JSON shape errors handled safely
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
Non‑conforming response body (missing `choices`) returns empty string without crash. | `fetch` returns `{ "id": "chatcmpl-123" }` (no `choices`). | `callOpenAI` returns `""`; no throw.
Choices array empty. | `{ "choices": [] }`. | Returns `""`.

### 11. Large payloads / non‑UTF‑8 content
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
Messages with enormous content or binary data do not crash the adapter. | `messages[0].content = "x".repeat(1e6)` (1 MB string). | Request is sent; adapter does not manipulate content beyond JSON conversion.
SSE stream decoder handles split multi‑byte characters. | A stream that splits a 3‑byte UTF‑8 character across two `reader.read()` chunks. | `TextDecoder` with `{stream: true}` reassembles correctly; no corruption or exception.

### 12. Abort signal race: immediate abort before fetch
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
If `AbortController` already aborted, fetch should reject immediately. | `timeoutMs = 0` (abort right away). | `callOpenAI` throws an `AbortError`; adapter does not try to read response.
Streaming path also throws/emits error. | `streamOpenAI` with `timeoutMs = 0`. | `onChunk` is never invoked with delta/done; error may be thrown or caught internally; the call returns rejected promise.

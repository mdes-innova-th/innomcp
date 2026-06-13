<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-017 role=trace model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2474,"completion_tokens":3205,"total_tokens":5679,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1515,"image_tokens":0},"cache_creation_input_tokens":0} | 40s
 generated: 2026-06-13T12:02:17.339Z -->
**ProviderAdapter Module Trace** — ordered data flow from entry call to exit/effects.

---

### 1. Entry (Function Call)
- **What enters**:  
  - `provider` – `ProviderRecord` (shape: `{ id, displayName, baseUrl, model, maxTokens?, temperature?, timeoutMs, type? ... }`)  
  - `req` – `AdapterRequest` (shape: `{ messages: ChatMessage[], model?, maxTokens?, temperature?, stream? }`)  
    - `ChatMessage` = `{ role: "system" | "user" | "assistant", content: string }`  
  - (streaming only) `onChunk` – callback `(chunk: AdapterChunk) => void` with `AdapterChunk = { type: "delta"|"done"|"error", delta?: string, error?: string }`  
- **Source**: External caller (e.g., `/execute` route in main server)

---

### 2. Route to Provider Implementation (assumed dispatcher)
- The module internally dispatches based on `provider.type` (e.g., `"openai"`, `"anthropic"`).  
- The implementation functions shown are `callOpenAI`, `streamOpenAI`, `callAnthropic`, `streamAnthropic`.

---

### 3. Common Pre‑processing (per call)
- **`requireApiKey(provider)`**  
  - *Input*: `provider.id`  
  - *Calls*: `resolveApiKey(provider.id)` from `../providers/registry`  
  - *Returns*: string API key, or throws `Error` if missing/empty.  
  - *Side‑effect*: key is read from registry (potentially in‑memory / environment‑based store), never logged.  
- **Model resolution**  
  - `model = req.model ?? provider.model` (fallback to provider default).  
- **Timeout setup**  
  - `buildAbortController(provider.timeoutMs)`  
    - Creates `AbortController`, sets a `setTimeout` timer that calls `controller.abort()`.  
    - *Output*: `{ controller, clearTimer }` (cleanup function that clears the timer).  
    - *Side‑effect*: an OS timer is registered; will abort fetch after `timeoutMs` ms if not cleared.

---

### 4. Per‑Provider Transformation (non‑streaming example: `callOpenAI`)
1. **Build request URL**  
   - `provider.baseUrl + "/chat/completions"`  
2. **Assemble HTTP headers**  
   - `"Content-Type": "application/json"`  
   - `"Authorization": "Bearer ${apiKey}"` (key never stringified – safe)  
3. **Create body**  
   - `JSON.stringify({ model, messages: req.messages, max_tokens: req.maxTokens ?? provider.maxTokens, temperature: req.temperature ?? provider.temperature, stream: false })`  
4. **Dispatch fetch**  
   - `fetch(url, { method: "POST", signal: controller.signal, headers, body })`  
   - *Side‑effect*: network call to external provider API.  
5. **Handle HTTP response**  
   - *If `!resp.ok`*: read error body with `resp.text()`, throw new `Error("OpenAI API error <status>: <body>")`.  
   - *Else*: parse JSON → `data.choices[0].message.content` (default `""`). Return string.  
6. **Clean up**  
   - In `finally` block: `clearTimer()` (clears the abort timeout).  

   *Exit*: `Promise<string>` resolved with the assistant’s text content.

---

### 5. Streaming Variant (`streamOpenAI`)
- Steps 1–3 identical to non‑stream except `stream: true`.  
- **Read response stream**  
  - If `!resp.body`, fire error chunk (`{ type: "error", error: "No response body..." }`) and return.  
  - Obtain `reader = resp.body.getReader()`, use `TextDecoder`.  
  - Accumulate buffer, split by `"\n"`, process each line.  
- **SSE parsing loop**  
  - For each line starting with `"data:"`, extract payload.  
  - If payload `"[DONE]"` → stop.  
  - Else JSON‑parse as `{ choices: [{ delta?: { content?: string } }] }`.  
  - Extract `delta` string; if present, invoke `onChunk({ type: "delta", delta })`.  
- **End of stream**  
  - After reader completes, call `onChunk({ type: "done" })`.  
- **Error handling**  
  - HTTP failure → `onChunk({ type: "error", error: "..." })`.  
  - Malformed SSE lines are silently skipped.  
- **Cleanup**: `clearTimer()` in `finally`.  

  *Exit*: `Promise<void>`; side‑effect: multiple calls to `onChunk` with `AdapterChunk` objects.

---

### 6. Anthropic‑compatible transformations (`callAnthropic`, `streamAnthropic`)
- **System‑message separation**  
  - Separate `req.messages` into system (role `"system"`) and user/assistant (rest).  
  - If system messages exist, concatenate contents with `"\n\n"` → `systemText`.  
- **URL**: `provider.baseUrl + "/v1/messages"`  
- **Headers**:  
  - `"x-api-key"` + `"anthropic-version": "2023-06-01"` (no `Authorization` header).  
- **Body** (non‑stream):  
  - `model`, `messages` (user messages only), `max_tokens`, optional `system` and `temperature`.  
- **Non‑stream response extraction**  
  - Parse JSON, return `data.content[0].text`.  
- **Streaming** (same SSE approach, not fully shown in snippet but analogous).  

  The same clean‑up and error patterns apply.

---

### 7. Side‑Effects Summary
| Side‑effect | Trigger |
|-------------|---------|
| **Registry read** | `resolveApiKey(provider.id)` – reads a stored API key (no logging). |
| **Timer creation** | `buildAbortController` → `setTimeout`. |
| **Network fetch** | Calls to `provider.baseUrl` APIs (external provider). |
| **Event emission** (stream) | `onChunk` called synchronously with delta/error/done objects. |
| **Error propagation** (non‑stream) | Thrown `Error` objects bubble to caller. |
| **Timer cancellation** | `clearTimer()` in `finally` – prevents abort after success/failure. |
| **No logging** | API keys are never captured in log output; error messages may contain HTTP status + body (but body is from provider, not the key). |

---

### 8. Final Output Shapes
- **`callProvider` return**: `Promise<string>` – the final assistant text.  
- **`streamProvider` return**: `Promise<void>`; output streams via `onChunk`:  
  - `{ type: "delta", delta: string }` – piecewise content.  
  - `{ type: "done" }` – stream complete.  
  - `{ type: "error", error: string }` – error encountered; stream terminates thereafter.

---

This trace covers all data transformations from the moment an external caller invokes the adapter functions, through key resolution, HTTP request construction, SSE parsing (when streaming), and final delivery of results or errors back to the caller.

<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-009 role=trace model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1527,"completion_tokens":2517,"total_tokens":4044,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1394,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T12:00:03.616Z -->
**Trace: `addMessage` → `getContext` (Typical Client Usage)**  

1. **Client calls `addMessage(sessionId, message)`**  
   - **Input shape**  
     `sessionId`: `string`  
     `message`: `{ role: 'user'|'assistant'|'system', content: string, tokens?: number }`  
   - **Source** – external actor (e.g., MCP tool handler, conversation manager)

2. **`addMessage` transforms state**  
   - Retrieves `current = this.sessions.get(sessionId)` (initially `undefined`).  
   - **Branch**  
     - If `current` is `undefined`: sets `this.sessions.set(sessionId, [message])`.  
     - Else: `current.push(message)` (mutates existing array in-place).  
   - **Side‑effect** – mutates the in‑memory `sessions` Map (the primary state of the module). No database, network, or event emissions.  
   - **Exit** – returns `void`.

3. **Client calls `getContext(sessionId)`**  
   - **Input shape** – same `sessionId: string`.  
   - **Source** – typically right before sending a request to an LLM API.

4. **`getContext` reads state**  
   - `messages = this.sessions.get(sessionId) || []` (read‑only access).  
   - No side‑effect.

5. **`getContext` calls `this.trim(messages, this.maxTokens)`**  
   - `this.maxTokens = 8000` (can be changed externally, but is a number).  
   - Enters the `trim` method with the raw message array and a token budget.

6. **Inside `trim(messages, maxTokens)`**  
   - **Early exit** – if `messages` is empty → return `[]`.  
   - **Separate system message**  
     - `hasSystem = messages[0].role === 'system'`  
     - `systemMessages = hasSystem ? [messages[0]] : []`  
     - `otherMessages = hasSystem ? messages.slice(1) : [...messages]`  
   - **Compute initial total tokens**  
     - `totalTokens = messages.reduce((sum, msg) => sum + this.countTokens(msg.content), 0)`  
     - Uses helper `countTokens(text)`: `Math.ceil(text.length / 4)` (character‑based approximation).  
   - **Trim oldest non‑system messages**  
     - While `otherMessages.length > 0` **and** `totalTokens > maxTokens`:  
       - `removed = otherMessages.shift()` (removes the oldest non‑system message).  
       - `totalTokens -= this.countTokens(removed.content)`  
   - **Combine and return** – `return [...systemMessages, ...otherMessages]`  
   - **No side‑effects** – `trim` only mutates its local `otherMessages` array (via `shift`); external state (`sessions`) is untouched.

7. **`getContext` returns the trimmed array**  
   - **Output shape**: `Message[]` (same interface as input, but possibly shorter).  
   - **Destination** – caller (e.g., used as the `messages` parameter for an OpenAI/Anthropic chat completion request).

---

### Other Methods (invoked separately)

8. **`summarize(messages)`**  
   - **Input**: `Message[]` (e.g., the full untrimmed history).  
   - **Transformations**  
     - Iterate messages, for role `user`/`assistant` take `msg.content.slice(0, 80)`.  
     - Join with `\n`, prefix `"สรุปเนื้อหาการสนทนาก่อนหน้า:\n"`.  
   - **Output**: single `Message` of role `'system'` with the summary string.  
   - **Side‑effects**: none (pure computation).

9. **`clear(sessionId)`**  
   - **Input**: `sessionId: string`.  
   - **Side‑effect** – deletes the entry from `sessions` Map.  
   - **Output**: `void`.

10. **`stats(sessionId)`**  
    - **Input**: `sessionId: string`.  
    - **Reads** messages array from `sessions`.  
    - **Computes** `messageCount = messages.length` and `estimatedTokens` via same `countTokens` reduction.  
    - **Output**: `{ messageCount: number, estimatedTokens: number }`.  
    - **Side‑effects**: none.

---

**Summary of data flow**  
- **Enters** – sessionId + message objects (from client).  
- **Transformations** – encoding into the `sessions` map, token counting, oldest‑first truncation while preserving a leading system message, optional summarisation.  
- **Exits** – trimmed `Message[]` (to caller), void, or statistics object.  
- **Side‑effects** – only the in‑memory `sessions` Map. No network, database, or event system is involved.

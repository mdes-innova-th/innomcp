<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-009 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1536,"completion_tokens":2259,"total_tokens":3795,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":829,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T12:00:45.775Z -->
```markdown
- **Property:** `countTokens` returns `Math.ceil(text.length / 4)` for any non‑negative length.  
  **Fuzz input:** `text = ''`, `text = 'a'`, `text = 'abcd'`, `text = 'abcde'`, `text` containing multi‑byte emojis (`'😀'`, length = 2).  
  **Expected invariant:** Output equals `Math.ceil(text.length / 4)`; e.g., `'' → 0`, `'a' → 1`, `'abcd' → 1`, `'abcde' → 2`, `'😀' → 1` (length 2 → ceil(2/4)=1).

- **Property:** `addMessage` creates session if it does not exist and appends the message.  
  **Fuzz input:** `sessionId = undefined`, `null`, `123` (number), empty string `""`; message with `role = 'user'`, `content = 'hello'`.  
  **Expected invariant:** After call, `contextManager.getContext(sessionId)` returns an array ending with the message (after trim). No exception thrown; session exists in internal map under coerced key.

- **Property:** `addMessage` does *not* enforce `maxMessagesPerSession` or `maxContentLength` (they are ignored).  
  **Fuzz input:** Repeatedly add messages with identical content until length > 100, then add a single message whose `content.length > 10000`.  
  **Expected invariant:** Session holds all messages regardless of limits; stats show `messageCount > 100` and `estimatedTokens` may exceed any cap.

- **Property:** `getContext` return value has total estimated tokens ≤ `maxTokens` **unless** the preserved first system message alone exceeds the limit.  
  **Fuzz input:** A session with first message `role: 'system'`, `content` of length `4 * (maxTokens + 1)` (so tokens > maxTokens), and `maxTokens = 100`.  
  **Expected invariant:** Returned array length = 1 (only system message) and `countTokens(content) > maxTokens`.  
  **Fuzz input:** Same but no system message, many messages total tokens > maxTokens.  
  **Expected invariant:** Returned array total tokens ≤ maxTokens; oldest non‑system messages are removed first.

- **Property:** `getContext` always preserves the very first message if its `role` is `'system'`.  
  **Fuzz input:** Session messages = `[system, user1, assistant1, user2, …]`, `maxTokens` small so many messages dropped.  
  **Expected invariant:** Returned array[0] is the original system message; its `content` unchanged.

- **Property:** `getContext` does not modify the original array stored in the session.  
  **Fuzz input:** Add several messages, call `getContext`, then call `getContext` again with same parameters.  
  **Expected invariant:** The internal session array length remains unchanged after `getContext`; subsequent `stats` show same `messageCount`.

- **Property:** `trim` returns empty array when input array is empty, regardless of `maxTokens`.  
  **Fuzz input:** `messages = []`, `maxTokens = 0`, `-1`, `NaN`, huge positive.  
  **Expected invariant:** Output is `[]`.

- **Property:** `trim` removes messages from the head of the non‑system portion while total tokens > maxTokens.  
  **Fuzz input:** `messages = [user1, user2, user3]`, each `content` of exact token count such that total=10, `maxTokens=6`.  
  **Expected invariant:** Returned array contains `user2, user3` (first removed). Order preserved.

- **Property:** `trim` never removes a message with `tokens` field pre‑computed; it relies solely on `countTokens(content)`.  
  **Fuzz input:** Provide a message with `tokens: 999999` but short `content`.  
  **Expected invariant:** The `tokens` field is ignored; removal decision based on `Math.ceil(content.length/4)`.

- **Property:** `summarize` returns a `system` message whose `content` starts with `'สรุปเนื้อหาการสนทนาก่อนหน้า:'` if any `user`/`assistant` messages exist.  
  **Fuzz input:** non‑empty array containing only system messages.  
  **Expected invariant:** Output content equals `'สรุป: ไม่มีเนื้อหาการสนทนา'`.  
  **Fuzz input:** array with user messages where `content.length > 80`.  
  **Expected invariant:** Each such message contributes its first 80 characters to the summary; the final string contains `\n` separated lines.

- **Property:** `clear` removes the session entirely.  
  **Fuzz input:** `sessionId` that exists, then call `clear`, then `getContext` and `stats`.  
  **Expected invariant:** `getContext` returns `[]`; `stats` returns `{ messageCount: 0, estimatedTokens: 0 }`.  
  **Fuzz input:** clearing a non‑existent session does not throw.  
  **Expected invariant:** No error; map remains unaffected.

- **Property:** `maxTokens` is a mutable public property and `getContext` uses its current value.  
  **Fuzz input:** Set `maxTokens = 0`, then call `getContext`.  
  **Expected invariant:** Returned array total tokens ≤ 0 (hence only possible if all content is empty or system message preserved).  
  **Fuzz input:** Set `maxTokens = -5` (negative) and call `getContext`.  
  **Expected invariant:** `trim` while loop condition `totalTokens > maxTokens` is always true; all non‑system messages removed; only system (if present) remains. No crash.

- **Property:** `stats` returns correct token estimate using `countTokens`.  
  **Fuzz input:** Session with known messages. Call `stats` and independently compute sum of `Math.ceil(content.length/4)`.  
  **Expected invariant:** `estimatedTokens` exactly matches that sum; `messageCount` equals array length.

- **Property:** Concurrent access to the same session from multiple calls is not thread‑safe but sequential mutations reflect immediately.  
  **Fuzz input:** Rapid sequence: add → getContext → add → getContext.  
  **Expected invariant:** Later getContext includes newly added messages (subject to trim).
```

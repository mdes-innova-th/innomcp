<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-019 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2347,"completion_tokens":6491,"total_tokens":8838,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4701,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T11:30:10.419Z -->
**1. MED — `trim` only preserves `messages[0]` as system message, dropping later system messages**

```diff
@@ -62,17 +62,11 @@
   trim(messages: Message[], maxTokens: number): Message[] {
     if (messages.length === 0) return [];
 
-    const hasSystem = messages[0].role === 'system';
     const systemMessages: Message[] = [];
     const otherMessages: Message[] = [];
-
-    if (hasSystem) {
-      systemMessages.push(messages[0]);
-      for (let i = 1; i < messages.length; i++) {
-        otherMessages.push(messages[i]);
-      }
-    } else {
-      otherMessages.push(...messages);
+    for (const msg of messages) {
+      if (msg && msg.role === 'system') systemMessages.push(msg);
+      else if (msg) otherMessages.push(msg);
     }
 
     let totalTokens = messages.reduce(
```

---

**2. MED — `trim` never reclaims system-message tokens → maxTokens can be persistently exceeded**

```diff
@@ -70,9 +70,13 @@
       else if (msg) otherMessages.push(msg);
     }
 
-    let totalTokens = messages.reduce(
-      (sum, msg) => sum + this.countTokens(msg.content),
+    const systemTokensTotal = systemMessages.reduce(
+      (sum, msg) => sum + this.countTokens(msg.content),
       0,
     );
+    let totalTokens = otherMessages.reduce(
+      (sum, msg) => sum + this.countTokens(msg.content),
+      0,
+    );
 
-    while (otherMessages.length > 0 && totalTokens > maxTokens) {
+    while (otherMessages.length > 0 && systemTokensTotal + totalTokens > maxTokens) {
       const removed = otherMessages.shift()!;
       totalTokens -= this.countTokens(removed.content);
     }
```

---

**3. MED — `messages[0]?.role` Type error on sparse/`[undefined]` input**

FALSE POSITIVE — the guard `messages[0].role === 'system'` is removed by patch #1; the new loop already skips falsy entries (`if (msg && …)`). No further fix needed.

---

**4. MED — `totalTokens -= …` may go negative; ignores `msg.tokens`**

```diff
@@ -80,7 +84,8 @@
     while (otherMessages.length > 0 && systemTokensTotal + totalTokens > maxTokens) {
       const removed = otherMessages.shift()!;
-      totalTokens -= this.countTokens(removed.content);
+      const tokensToRemove = removed.tokens ?? this.countTokens(removed.content);
+      totalTokens = Math.max(0, totalTokens - tokensToRemove);
     }
 
     return [...systemMessages, ...otherMessages];
```

(Optionally, the initial `totalTokens` and `systemTokensTotal` should also honour `msg.tokens`. A follow-up change:

```diff
     const systemTokensTotal = systemMessages.reduce(
-      (sum, msg) => sum + this.countTokens(msg.content),
+      (sum, msg) => sum + (msg.tokens ?? this.countTokens(msg.content)),
       0,
     );
     let totalTokens = otherMessages.reduce(
-      (sum, msg) => sum + this.countTokens(msg.content),
+      (sum, msg) => sum + (msg.tokens ?? this.countTokens(msg.content)),
       0,
     );
```

)

---

**5. HIGH — `addMessage` has no session growth bounds → memory leak / DoS**

```diff
 class ContextManager {
   private sessions: Map<string, Message[]> = new Map();
+  private sessionOrder: string[] = [];               // insertion order for eviction
+  private readonly MAX_SESSIONS = 1000;
+  private readonly MAX_MESSAGES_PER_SESSION = 200;
+  private readonly MAX_CONTENT_LENGTH = 10000;       // characters

   public maxTokens: number = 8000;

   addMessage(sessionId: string, message: Message): void {
+    // Cap content length to avoid megabyte-sized messages
+    const clipped: Message = {
+      ...message,
+      content: message.content.slice(0, this.MAX_CONTENT_LENGTH),
+    };
+
     const current = this.sessions.get(sessionId);
     if (!current) {
-      this.sessions.set(sessionId, [message]);
+      // Enforce global session cap (LRU-style eviction)
+      if (this.sessions.size >= this.MAX_SESSIONS) {
+        const oldest = this.sessionOrder.shift();
+        if (oldest !== undefined) this.sessions.delete(oldest);
+      }
+      this.sessions.set(sessionId, [clipped]);
+      this.sessionOrder.push(sessionId);
     } else {
-      current.push(message);
+      current.push(clipped);
+      // Keep only the most recent messages
+      while (current.length > this.MAX_MESSAGES_PER_SESSION) {
+        current.shift();
+      }
     }
   }
```

(Also need to remove session from order when `clear` is called; document that `clear` should keep `sessionOrder` in sync. A possible addition inside `clear`:

```diff
   clear(sessionId: string): void {
     this.sessions.delete(sessionId);
+    this.sessionOrder = this.sessionOrder.filter(id => id !== sessionId);
   }
```

)

---

**6. HIGH — `countTokens` uses `length/4`, severely underestimating CJK/Thai tokens**

Replace the method with a script‑aware heuristic:

```typescript
  countTokens(text: string): number {
    // Approximate token count: CJK/Thai ~1 token per character,
    // others ~4 characters per token.
    let tokens = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (
        (code >= 0x0E00 && code <= 0x0E7F) || // Thai
        (code >= 0x3040 && code <= 0x30FF) || // Hiragana & Katakana
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified
        (code >= 0xAC00 && code <= 0xD7AF) || // Hangul
        (code >= 0xF900 && code <= 0xFAFF)    // CJK Compatibility
      ) {
        tokens += 1;
      } else {
        tokens += 0.25;
      }
    }
    return Math.ceil(tokens);
  }
```

---

**7. HIGH — `summarize` returns unbounded summary that can exceed the token budget**

Add a token/character cap inside `summarize`:

```diff
   summarize(messages: Message[]): Message {
+    const MAX_SUMMARY_TOKENS = 500;            // safety limit
     const parts: string[] = [];
     for (const msg of messages) {
       if (msg.role === 'user' || msg.role === 'assistant') {
-        parts.push(msg.content.slice(0, 80));
+        parts.push(msg.content.slice(0, 80));
       }
     }
 
-    const summaryContent =
-      parts.length > 0
-        ? `สรุปเนื้อหาการสนทนาก่อนหน้า:\n${parts.join('\n')}`
-        : 'สรุป: ไม่มีเนื้อหาการสนทนา';
+    let summaryContent =
+      parts.length > 0
+        ? `สรุปเนื้อหาการสนทนาก่อนหน้า:\n${parts.join('\n')}`
+        : 'สรุป: ไม่มีเนื้อหาการสนทนา';
+
+    // Prune down to the token (or character) budget
+    while (this.countTokens(summaryContent) > MAX_SUMMARY_TOKENS && summaryContent.length > 0) {
+      summaryContent = summaryContent.slice(0, -1);
+    }
 
     return {
       role: 'system',
       content: summaryContent,
     };
   }
```

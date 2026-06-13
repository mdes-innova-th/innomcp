<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-009 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2757,"completion_tokens":6093,"total_tokens":8850,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4745,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:26:54.682Z -->
**HIGH: `sanitize` – XSS bypass via flawed regexes**

Replace the regex-based sanitization with a call to DOMPurify, which handles all known vectors correctly.

```typescript
// Add import at top of file
import DOMPurify from 'dompurify';

// Replace sanitize method
sanitize(html: string): string {
  return DOMPurify.sanitize(html);
}
```

---

**HIGH: `formatStream` / `streamBuffer` – Race condition / state corruption**

Remove the Singleton pattern so that each request can create its own `ResponseFormatter` instance, eliminating shared `streamBuffer` across concurrent calls.

```diff
--- a/src/services/responseFormatter.ts
+++ b/src/services/responseFormatter.ts
@@ -10,8 +10,6 @@ export interface CodeBlock {
 }
 
 export default class ResponseFormatter {
-  private static instance: ResponseFormatter;
   private streamBuffer = '';
 
-  private constructor() {}
+  constructor() {}
-
-  static getInstance(): ResponseFormatter {
-    if (!ResponseFormatter.instance) {
-      ResponseFormatter.instance = new ResponseFormatter();
-    }
-    return ResponseFormatter.instance;
-  }
```

---

**MED: `formatStream` – Resource leak on unclosed code blocks**

Add an `endStream` method that flushes the remaining buffer and resets state.

```diff
--- a/src/services/responseFormatter.ts
+++ b/src/services/responseFormatter.ts
@@ -44,6 +44,11 @@ export default class ResponseFormatter {
     return output;
   }
 
+  endStream(): string {
+    const remaining = this.streamBuffer;
+    this.streamBuffer = '';
+    return remaining;
+  }
+
   detectLanguage(code: string): string {
     ...
```

---

**MED: `renderMarkdown` – Inline formatting corrupts code blocks**

Rewrite `renderMarkdown` to protect fenced code blocks and inline code spans with placeholders before applying inline markdown replacements, then restore them.

```typescript
// Replace the whole private renderMarkdown method with:

private renderMarkdown(text: string): string {
  const escaped = this.escapeHtml(text);
  const placeholders: { placeholder: string; html: string }[] = [];
  let counter = 0;

  // Replace fenced code blocks with placeholders
  const withFenced = escaped.replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
    const ph = `__FENCED_${counter}__`;
    counter++;
    const cls = lang ? ` class="language-${this.escapeHtml(lang)}"` : '';
    placeholders.push({ placeholder: ph, html: `<pre><code${cls}>${code}</code></pre>` });
    return ph;
  });

  // Replace inline code spans with placeholders
  const withInline = withFenced.replace(/`([^`]+)`/g, (_match, code: string) => {
    const ph = `__INLINE_${counter}__`;
    counter++;
    placeholders.push({ placeholder: ph, html: `<code>${code}</code>` });
    return ph;
  });

  // Apply heading, bold, and line-break replacements to the sanitized text
  let html = withInline
    .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  // Restore placeholders with their original HTML content
  for (const { placeholder, html: replacement } of placeholders) {
    html = html.replace(placeholder, replacement);
  }

  return html;
}
```

---

**LOW: `truncate` – Contract violation when `maxLength <= ellipsis.length`**

Add an early return that ensures the result never exceeds `maxLength`, even with a too-long ellipsis.

```diff
--- a/src/services/responseFormatter.ts
+++ b/src/services/responseFormatter.ts
@@ -77,6 +77,9 @@ export default class ResponseFormatter {
   truncate(text: string, maxLength: number, ellipsis = '...'): string {
+    if (maxLength <= ellipsis.length) {
+      return text.slice(0, maxLength);
+    }
+
     if (text.length <= maxLength) {
       return text;
     }
```

---

**LOW: `estimateReadingTime` – Empty string returns 1 second instead of 0**

Change the minimum word count from `1` to `0`, which correctly yields a reading time of `0`.

```diff
--- a/src/services/responseFormatter.ts
+++ b/src/services/responseFormatter.ts
@@ -128,8 +128,8 @@ export default class ResponseFormatter {
   private estimateReadingTime(text: string, locale: 'th' | 'en'): number {
     const words =
       locale === 'th'
-        ? Math.max(1, Math.ceil(text.replace(/\s+/g, '').length / 6))
-        : Math.max(1, text.trim().split(/\s+/).filter(Boolean).length);
+        ? Math.max(0, Math.ceil(text.replace(/\s+/g, '').length / 6))
+        : Math.max(0, text.trim().split(/\s+/).filter(Boolean).length);
     const wordsPerMinute = locale === 'th' ? 150 : 200;
     return Math.ceil((words / wordsPerMinute) * 60);
   }
```

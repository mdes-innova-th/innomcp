<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-006 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2148,"completion_tokens":3332,"total_tokens":5480,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2193,"image_tokens":0},"cache_creation_input_tokens":0} | 59s
 generated: 2026-06-13T11:25:44.734Z -->
### HIGH: `JSON.stringify(ev)` can throw → crash the node process

Wrap the serialization call in a try‑catch so that any synchronous exception (circular reference, BigInt, etc.) results in a safe `GuardResult` instead of a process crash.

```diff
--- innomcp-node/src/agents/eventGuard.ts
+++ innomcp-node/src/agents/eventGuard.ts
@@ -71,7 +71,14 @@
     return { ok: false, reason: `shape: ${shapeError}`, shapeError };
   }

-  const serialized = JSON.stringify(ev);
+  let serialized: string;
+  try {
+    serialized = JSON.stringify(ev);
+  } catch {
+    return {
+      ok: false,
+      reason: "serialization failure",
+    };
+  }
   const lower = serialized.toLowerCase();
```

### MED: Forbidden‑key scan false‑positives inside string values

Replace the substring‑based key scan with a recursive scan of the actual JSON object keys.  
This prevents blocking events that merely *mention* a forbidden word in a user‑visible text field.

```diff
--- innomcp-node/src/agents/eventGuard.ts
+++ innomcp-node/src/agents/eventGuard.ts
@@ -75,10 +75,30 @@
   const serialized = JSON.stringify(ev);
   const lower = serialized.toLowerCase();

-  // 1) Forbidden key-name scan (case-insensitive on the quoted key form)
+  // 1) Forbidden key-name scan (recursively inspect all object keys)
+  let parsed: unknown;
+  try {
+    parsed = JSON.parse(serialized);
+  } catch {
+    // should not happen after a successful stringify, but guard anyway
+    return { ok: false, reason: "serialization malformed" };
+  }
+  const lowerForbidden = FORBIDDEN_KEY_NAMES.map((k) => k.toLowerCase());
+  const foundKey = scanKeys(parsed, lowerForbidden);
+  if (foundKey !== null) {
+    const original = FORBIDDEN_KEY_NAMES.find(
+      (k) => k.toLowerCase() === foundKey
+    )!;
+    return {
+      ok: false,
+      reason: `forbidden key: ${original}`,
+      forbiddenKey: original,
+    };
+  }
+
+  // 2) Forbidden visible substrings — collected from publicSummary,
+  //    deltaText, finalText, fallbackReason
   for (const key of FORBIDDEN_KEY_NAMES) {
-    const needle = `"${key.toLowerCase()}":`;
-    if (lower.includes(needle)) {
       return {
         ok: false,
         reason: `forbidden key: ${key}`,
@@ -86,7 +106,6 @@
     }
   }
- }
-  // 2) Forbidden visible substrings — collected from publicSummary,
-  //    deltaText, finalText, fallbackReason
```

And add the recursive helper function `scanKeys` at module level (or inside the function; here placed at the bottom of the file for minimal diff size, after `checkVisibleTextSafe`).

```diff
--- innomcp-node/src/agents/eventGuard.ts
+++ innomcp-node/src/agents/eventGuard.ts
@@ -130,3 +130,22 @@
   return checkAgentEventSafe(wrapped, opts);
 }
+
+/**
+ * Recursively scan an arbitrary JSON value for forbidden key names.
+ * Returns the lowercased key if found, otherwise null.
+ */
+function scanKeys(
+  value: unknown,
+  forbiddenLower: string[],
+): string | null {
+  if (typeof value !== "object" || value === null) return null;
+  if (Array.isArray(value)) {
+    for (const item of value) {
+      const res = scanKeys(item, forbiddenLower);
+      if (res) return res;
+    }
+    return null;
+  }
+  // plain object
+  for (const key of Object.keys(value)) {
+    if (forbiddenLower.includes(key.toLowerCase())) {
+      return key.toLowerCase();
+    }
+    const res = scanKeys((value as Record<string, unknown>)[key], forbiddenLower);
+    if (res) return res;
+  }
+  return null;
+}
```

### LOW: Forbidden visible literals checked with exact case

Make the literal scan case‑insensitive so that placeholders with unexpected casing ("weather map placeholder" vs. "Weather Map Placeholder") are caught reliably.

```diff
--- innomcp-node/src/agents/eventGuard.ts
+++ innomcp-node/src/agents/eventGuard.ts
@@ -100,7 +100,8 @@
   ];
   const visible = visibleParts.join("\n");
+  const lowerVisible = visible.toLowerCase();

   for (const lit of FORBIDDEN_VISIBLE_LITERALS) {
-    if (visible.includes(lit)) {
+    if (lowerVisible.includes(lit.toLowerCase())) {
       return {
         ok: false,
         reason: `forbidden visible literal: ${lit}`,
```

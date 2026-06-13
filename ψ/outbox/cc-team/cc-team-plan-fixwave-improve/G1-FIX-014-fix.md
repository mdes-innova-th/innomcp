<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-014 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3230,"completion_tokens":6134,"total_tokens":9364,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4225,"image_tokens":0},"cache_creation_input_tokens":0} | 88s
 generated: 2026-06-13T11:28:35.769Z -->
## HIGH: `trigToDeg` — nested-paren corruption

The regex `\(([^)]+)\)` stops at the first `)` inside a nested call like `sin(cos(45))`, capturing `cos(45` and leaving a stray `)` on reassembly. Fix: skip conversion when the argument contains parentheses (i.e., nested call/unbalanced paren).

**Full replacement of the function:**

```typescript
export function trigToDeg(expr: string): string {
  if (/\b(deg|rad)\b/i.test(expr) || /\bpi\b/i.test(expr)) return expr;
  return expr.replace(/\b(sin|cos|tan|asin|acos|atan)\s*\(([^)]+)\)/gi, (_, fn, arg) => {
    const trimmed = arg.trim();
    // If argument contains parentheses (nested call), leave intact.
    if (trimmed.includes('(') || trimmed.includes(')')) {
      return `${fn}(${trimmed})`;
    }
    // Only convert if the argument is a plain number (possibly negative)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return `${fn}(${trimmed} deg)`;
    }
    return `${fn}(${trimmed})`;
  });
}
```

---

## MED: `DEFAULT_OPTS` numeric env-var defaults with `||`

`Number(process.env.FOO || fallback)` wrongly treats `"0"` as falsy and falls back to the default. Use `??` to honour an explicit `"0"`.

**Unified diff:**

```diff
 const DEFAULT_OPTS: Required<Omit<FastPathHandlerOptions, "extraPhrasesFile" | "extraPhrasesUrl">> = {
   mode: (process.env.FASTPATH_MODE as FastPathMode) || "on",
-  maxTextLen: Number(process.env.FASTPATH_MAX_TEXT_LEN || 400),
-  logPreviewChars: Number(process.env.FASTPATH_LOG_PREVIEW || 140),
-  extraCacheTtlMs: Number(process.env.FASTPATH_EXTRA_TTL_MS || 60_000),
-  maxWorkMs: Number(process.env.FASTPATH_MAX_WORK_MS || 15),
+  maxTextLen: Number(process.env.FASTPATH_MAX_TEXT_LEN ?? 400),
+  logPreviewChars: Number(process.env.FASTPATH_LOG_PREVIEW ?? 140),
+  extraCacheTtlMs: Number(process.env.FASTPATH_EXTRA_TTL_MS ?? 60_000),
+  maxWorkMs: Number(process.env.FASTPATH_MAX_WORK_MS ?? 15),
 };
```

---

## MED: `tryReadExtraFromFile` — synchronous I/O in async function

`fs.existsSync` + `fs.readFileSync` block the event loop. Replace with `fs.promises.readFile` and a try/catch for `ENOENT`.

**Full replacement of the function:**

```typescript
async function tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      greeting: Array.isArray(parsed.greeting) ? parsed.greeting : undefined,
      identity: Array.isArray(parsed.identity) ? parsed.identity : undefined,
      thanks: Array.isArray(parsed.thanks) ? parsed.thanks : undefined,
      ok: Array.isArray(parsed.ok) ? parsed.ok : undefined,
      ping: Array.isArray(parsed.ping) ? parsed.ping : undefined,
      emoji: Array.isArray(parsed.emoji) ? parsed.emoji : undefined,
    };
  } catch (e: any) {
    // ENOENT or parse error is non-fatal; return empty.
    if (e?.code !== 'ENOENT') {
      logger.warn(`[FastPath] extraPhrasesFile parse failed: ${String(e?.message || e)}`);
    }
    return {};
  }
}
```

---

## MED: `handleFastPathMessage` rate-limit guard on falsy `clientIp`

`if (clientIp)` skips rate limiting when `clientIp` is an empty string `""`. Change to an explicit non-empty check.

**Unified diff (context: assumed inside `handleFastPathMessage`):**

```diff
-  if (clientIp) {
+  if (clientIp != null && clientIp !== '') {
     // … rate-limit logic …
   }
```

---

## LOW: `cleanFloat` — `NaN` input produces string `"NaN"` silently

Guard against non-finite values before rounding.

**Unified diff:**

```diff
 export function cleanFloat(val: number): string {
+  if (!Number.isFinite(val)) return String(val);
   const rounded = Math.round(val * 1e10) / 1e10;
   if (Number.isInteger(rounded)) return String(rounded);
   return String(rounded);
 }
```

---

## LOW: `getExtraPhrases` — cache refresh without concurrency guard

Concurrent callers past TTL both trigger a refresh, causing duplicate I/O. Deduplicate by storing and sharing a single in-flight Promise.

**Unified diff for `getExtraPhrases`:**

```diff
 let extraCache: { at: number; data: ExtraPhrases } | null = null;
+let extraRefreshPromise: Promise<ExtraPhrases> | null = null;

 async function getExtraPhrases(opts: FastPathHandlerOptions): Promise<ExtraPhrases> {
   const ttl = opts.extraCacheTtlMs ?? DEFAULT_OPTS.extraCacheTtlMs;
   if (extraCache && Date.now() - extraCache.at < ttl) return extraCache.data;

+  // If a refresh is already in progress, await its result.
+  if (extraRefreshPromise) {
+    return extraRefreshPromise;
+  }
+
   const start = performance.now();
-  let data: ExtraPhrases = {};
-
-  const file = resolvePathMaybe(opts.extraPhrasesFile || process.env.FASTPATH_EXTRA_FILE);
-  const url = opts.extraPhrasesUrl || process.env.FASTPATH_EXTRA_URL;
-
-  // Best-effort: do not block
-  if (file) data = mergeExtra(data, await tryReadExtraFromFile(file));
-  if (url) data = mergeExtra(data, await tryReadExtraFromUrl(url));
-
-  extraCache = { at: Date.now(), data };
-
-  const dur = Math.round(performance.now() - start);
-  if (dur > 20) logger.debug(`[FastPath] extra phrases refresh took ${dur}ms`);
-
-  return data;
+  extraRefreshPromise = (async () => {
+    let data: ExtraPhrases = {};
+    const file = resolvePathMaybe(opts.extraPhrasesFile || process.env.FASTPATH_EXTRA_FILE);
+    const url = opts.extraPhrasesUrl || process.env.FASTPATH_EXTRA_URL;
+
+    // Best-effort: do not block
+    if (file) data = mergeExtra(data, await tryReadExtraFromFile(file));
+    if (url) data = mergeExtra(data, await tryReadExtraFromUrl(url));
+
+    extraCache = { at: Date.now(), data };
+
+    const dur = Math.round(performance.now() - start);
+    if (dur > 20) logger.debug(`[FastPath] extra phrases refresh took ${dur}ms`);
+
+    return data;
+  })();
+
+  try {
+    const result = await extraRefreshPromise;
+    return result;
+  } finally {
+    extraRefreshPromise = null;
+  }
 }
```

---

## LOW: `trigToDeg` downstream `mathjs.evaluate` unhandled parse error

After the `trigToDeg` nesting fix the output is safe, but wrapping `evaluate` defensively avoids crashes from any future malformed input. Surround the `evaluate` call with try/catch and fallback or re-throw appropriately.

*(The exact call site is in the truncated part of the file; apply the following pattern wherever `evaluate(expression)` appears after `trigToDeg` processing.)*

**Snippet (wrap the call):**

```diff
- const evaluated = evaluate(processedExpr);
+ let evaluated: any;
+ try {
+   evaluated = evaluate(processedExpr);
+ } catch (e) {
+   logger.warn(`[FastPath] math evaluation failed: ${String(e)}`);
+   throw e; // or return a safe fallback
+ }
```

<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-017 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1579,"completion_tokens":2347,"total_tokens":3926,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1521,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T11:28:59.230Z -->
Here are the concrete fixes for the reported findings, in unified diff format where possible.

### Freshness logic silently masks “stale” when mixed with “recent” (MED)

The original `includes`-based logic treats “live+stale” as mixed, but pure “recent+stale” or “live+recent” fall through to a single value, hiding the presence of the other category. Replaced with a `Set` to detect *any* mix.

```diff
--- innomcp-node/src/services/answerContract.ts
+++ innomcp-node/src/services/answerContract.ts
@@ -82,5 +82,5 @@ export function buildAnswerContract(params: {
   // Compute aggregate freshness
   let freshness: AnswerContract["freshness"] = "stale";
   if (params.sources.length > 0) {
     const freshnessValues = params.sources.map((s) => s.freshness);
-    const hasLive = freshnessValues.includes("live");
-    const hasStale = freshnessValues.includes("stale");
-    if (hasLive && hasStale) freshness = "mixed";
-    else if (hasLive) freshness = "live";
-    else if (freshnessValues.includes("recent")) freshness = "recent";
+    const unique = new Set(freshnessValues);
+    if (unique.size > 1) {
+      freshness = "mixed";
+    } else if (unique.has("live")) {
+      freshness = "live";
+    } else if (unique.has("recent")) {
+      freshness = "recent";
+    }
+    // else remains "stale"
   } else if (params.answerMode === "deterministic") {
     freshness = "live";
   }
```

### Arrays are shared by reference, allowing post-creation mutation (MED)

Shallow‑copy every externally‑facing array property (`toolsUsed`, `sources`, `memoryEntities`, `degradedReasons`) so the contract snapshot remains stable even if the caller later mutates the original arrays.

```diff
--- innomcp-node/src/services/answerContract.ts
+++ innomcp-node/src/services/answerContract.ts
@@ -105,2 +105,2 @@ export function buildAnswerContract(params: {
   return {
     route: params.route,
-    toolsUsed: params.toolsUsed,
+    toolsUsed: [...params.toolsUsed],
     sourceIds: params.sources.map((s) => s.id),
-    sources: params.sources,
+    sources: [...params.sources],
     grounded: params.grounded,
@@ -118,2 +118,2 @@ export function buildAnswerContract(params: {
     memoryUsed: params.memoryUsed,
-    memoryEntities: params.memoryEntities,
+    memoryEntities: params.memoryEntities ? [...params.memoryEntities] : undefined,
     retrievalUsed: params.retrievalUsed,
@@ -128,2 +128,2 @@ export function buildAnswerContract(params: {
     degraded: params.degraded ?? false,
-    degradedReasons: params.degradedReasons,
+    degradedReasons: params.degradedReasons ? [...params.degradedReasons] : undefined,
   };
```

### Unbounded `confidence` value accepted without clamping (LOW)

Clamp the `confidence` property to the expected 0.0–1.0 range so downstream consumers (analytics, routing, UI) receive a normalized value.

```diff
--- innomcp-node/src/services/answerContract.ts
+++ innomcp-node/src/services/answerContract.ts
@@ -120,3 +120,3 @@ export function buildAnswerContract(params: {
     freshness,
-    confidence: params.confidence,
+    confidence: Math.max(0, Math.min(1, params.confidence)),
     memoryUsed: params.memoryUsed,
```

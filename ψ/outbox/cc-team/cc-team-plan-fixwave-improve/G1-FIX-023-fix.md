<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-023 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1496,"completion_tokens":5188,"total_tokens":6684,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3980,"image_tokens":0},"cache_creation_input_tokens":0} | 59s
 generated: 2026-06-13T11:31:21.085Z -->
## 1. HIGH – `handleRequest` primary/fallback dispatch throws bypass fallback
Wrap the `executeWithGuard` calls in `try/catch` so thrown exceptions are treated as failures, allowing fallbacks to be attempted.

```diff
--- a/innomcp-node/src/geo/geo-service.ts
+++ b/innomcp-node/src/geo/geo-service.ts
@@ -39,10 +39,14 @@ export class GeoService {
     console.log("  -> Plan:", JSON.stringify(plan));
 
     // 3. Execute primary via Guard
-    const rawPacket = await this.guard.executeWithGuard(
-      () => this.dispatch(plan.primary.tool_name, plan.primary.params),
-      plan.primary.tool_name,
-    );
+    let rawPacket;
+    try {
+      rawPacket = await this.guard.executeWithGuard(
+        () => this.dispatch(plan.primary.tool_name, plan.primary.params),
+        plan.primary.tool_name,
+      );
+    } catch (err) {
+      rawPacket = { error: true, reason: String(err) };
+    }
 
     // If primary succeeded, format and return
     if (!rawPacket.error) {
@@ -55,10 +59,14 @@ export class GeoService {
     // 4. Try fallbacks in order
     for (const fb of plan.fallbacks) {
       console.log(`  -> Trying fallback: ${fb.tool_name} (${fb.reason})`);
-      const fbPacket = await this.guard.executeWithGuard(
-        () => this.dispatch(fb.tool_name, fb.params),
-        fb.tool_name,
-      );
+      let fbPacket;
+      try {
+        fbPacket = await this.guard.executeWithGuard(
+          () => this.dispatch(fb.tool_name, fb.params),
+          fb.tool_name,
+        );
+      } catch (err) {
+        fbPacket = { error: true, reason: String(err) };
+      }
 
       if (!fbPacket.error) {
         fbPacket.fallback_used = true;
```

## 2. MED – fallback loop crashes on missing `plan.fallbacks`
Default to an empty array when `plan.fallbacks` is `undefined` or `null`.

```diff
--- a/innomcp-node/src/geo/geo-service.ts
+++ b/innomcp-node/src/geo/geo-service.ts
@@ -53,7 +53,7 @@ export class GeoService {
     }
 
     // 4. Try fallbacks in order
-    for (const fb of plan.fallbacks) {
+    for (const fb of plan.fallbacks ?? []) {
       console.log(`  -> Trying fallback: ${fb.tool_name} (${fb.reason})`);
       let fbPacket;
       try {
```

## 3. MED – final raw return bypasses aggregator formatting
Format `rawPacket` through `this.aggregator.format()` to maintain consistent `WeatherPacket` shape.

```diff
--- a/innomcp-node/src/geo/geo-service.ts
+++ b/innomcp-node/src/geo/geo-service.ts
@@ -75,5 +75,5 @@ export class GeoService {
 
     // 5. All tools failed – return degraded packet from guard
     console.error("  -> All tools failed");
-    return rawPacket;
+    return this.aggregator.format(rawPacket);
   }
```

## 4. MED – `intentResult` null/undefined access causes TypeError
Add a null check before accessing `intentResult.domain`.

```diff
--- a/innomcp-node/src/geo/geo-service.ts
+++ b/innomcp-node/src/geo/geo-service.ts
@@ -27,7 +27,7 @@ export class GeoService {
     const intentResult = this.intent.analyze(userMessage);
     console.log("  -> Intent:", JSON.stringify(intentResult));
 
-    if (intentResult.domain !== "weather" || intentResult.confidence < 0.5) {
+    if (!intentResult || intentResult.domain !== "weather" || intentResult.confidence < 0.5) {
       return {
         summary: "ไม่เข้าใจคำถามเกี่ยวกับสภาพอากาศ",
         timestamp: new Date().toISOString(),
```

## 5. LOW – null/undefined packet access throws on `.error`
Use optional chaining / explicit null checks for `rawPacket` and `fbPacket`.

```diff
--- a/innomcp-node/src/geo/geo-service.ts
+++ b/innomcp-node/src/geo/geo-service.ts
@@ -48,7 +48,7 @@ export class GeoService {
     }
 
     // If primary succeeded, format and return
-    if (!rawPacket.error) {
+    if (rawPacket && !rawPacket.error) {
       const formatted = this.aggregator.format(rawPacket);
       console.log(`  -> OK (${formatted.evidence.latency_ms}ms)`);
       return formatted;
@@ -68,7 +68,7 @@ export class GeoService {
         fbPacket = { error: true, reason: String(err) };
       }
 
-      if (!fbPacket.error) {
+      if (fbPacket && !fbPacket.error) {
         fbPacket.fallback_used = true;
         const formatted = this.aggregator.format(fbPacket);
         console.log(`  -> Fallback OK (${formatted.evidence.latency_ms}ms)`);
```

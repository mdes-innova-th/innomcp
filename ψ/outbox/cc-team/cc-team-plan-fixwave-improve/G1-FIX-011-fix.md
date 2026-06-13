<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-011 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2009,"completion_tokens":2901,"total_tokens":4910,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1944,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T11:27:08.147Z -->
### Finding 1: HIGH – `this.emit('tool:start', …)` outside try block

Listener errors from the `tool:start` event propagate as an unhandled rejection, bypassing the catch and retry logic.  
**Fix:** wrap the emit in its own `try/catch`, re-emitting any error to the already-attached no-op `error` listener so it does not break the loop.

```typescript
--- a/toolExecutor.ts
+++ b/toolExecutor.ts
@@ -80,11 +80,15 @@
       const attemptStart = Date.now();
-      this.emit('tool:start', {
-        toolName: name,
-        attempt,
-        params,
-        context: options.context,
-      });
+      try {
+        this.emit('tool:start', {
+          toolName: name,
+          attempt,
+          params,
+          context: options.context,
+        });
+      } catch (listenerError) {
+        this.emit('error', listenerError);
+      }
 
       try {
```

### Finding 2: MED – `this.emit('tool:end', …)` inside try block

When a listener attached to `tool:end` throws, the error is caught by the surrounding `catch` and incorrectly reported as a tool failure.  
**Fix:** isolate the emit in its own `try/catch`, re-emitting any listener error to the existing error handler.

```typescript
--- a/toolExecutor.ts
+++ b/toolExecutor.ts
@@ -88,7 +92,10 @@
         const totalDuration = Date.now() - startTime;
-        this.emit('tool:end', {
-          toolName: name,
-          attempt,
-          result: data,
-          attemptDurationMs: Date.now() - attemptStart,
-          totalDurationMs: totalDuration,
-        });
+        try {
+          this.emit('tool:end', {
+            toolName: name,
+            attempt,
+            result: data,
+            attemptDurationMs: Date.now() - attemptStart,
+            totalDurationMs: totalDuration,
+          });
+        } catch (listenerError) {
+          this.emit('error', listenerError);
+        }
 
         return {
```

### Finding 3: MED – `this.emit('tool:error', …)` inside catch block

A listener attached to `tool:error` that throws will propagate out of the catch clause, causing an unhandled promise rejection.  
**Fix:** wrap the emit in its own `try/catch`, again re-emitting to the no-op error handler.

```typescript
--- a/toolExecutor.ts
+++ b/toolExecutor.ts
@@ -103,9 +110,12 @@
         const errorMessage = this.toErrorMessage(error);
-        this.emit('tool:error', {
-          toolName: name,
-          attempt,
-          error: errorMessage,
-          attemptDurationMs: Date.now() - attemptStart,
-          originalError: error,
-        });
+        try {
+          this.emit('tool:error', {
+            toolName: name,
+            attempt,
+            error: errorMessage,
+            attemptDurationMs: Date.now() - attemptStart,
+            originalError: error,
+          });
+        } catch (listenerError) {
+          this.emit('error', listenerError);
+        }
 
         if (attempt === maxRetries) {
```

### Finding 4: LOW – Unused `ToolParamError` class

`ToolParamError` is defined but never instantiated, leaving dead code. Since there is no parameter validation that would benefit from it, the simplest fix is to remove the class and its check.  
**Fix:** delete the class definition and adjust `toErrorMessage` accordingly.

```typescript
--- a/toolExecutor.ts
+++ b/toolExecutor.ts
@@ -6,10 +6,2 @@
 
-export class ToolParamError extends Error {
-  constructor() {
-    super('พารามิเตอร์ไม่ถูกต้อง');
-    this.name = 'ToolParamError';
-  }
-}
-
 // … rest of file …

@@ -143,3 +136,3 @@
   private toErrorMessage(error: unknown): string {
-    if (error instanceof ToolTimeoutError || error instanceof ToolParamError) {
+    if (error instanceof ToolTimeoutError) {
       return error.message;
     }
```

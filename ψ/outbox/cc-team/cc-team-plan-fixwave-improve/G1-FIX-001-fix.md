<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-001 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2648,"completion_tokens":2125,"total_tokens":4773,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1791,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T11:24:54.369Z -->
### Finding: `safeEmit` – no try/catch around safety gate and fallback creation

If `checkAgentEventSafe` or `newEnvelope` throws, the exception escapes `safeEmit`, potentially crashing the conductor loop without emitting any fallback event.  
Wrap the body in a try/catch; on failure emit a minimal, stable fallback event using hardcoded safe values.

```diff
 function safeEmit(emit: EmitFn, ev: AgentEvent, expectedToolUsage: boolean): boolean {
+  try {
     const guard = checkAgentEventSafe(ev, { expectedToolUsage });
     if (!guard.ok) {
       const fallback: AgentEvent = newEnvelope({
         runId: ev.runId,
         messageId: ev.messageId,
         type: "fallback",
         publicSummary: "เหตุการณ์ภายในถูกปรับให้ปลอดภัยก่อนเผยแพร่",
         agentId: "conductor",
       });
       emit(fallback);
       return false;
     }
     emit(ev);
     return true;
+  } catch (_err) {
+    // On any unexpected error, emit a safe fallback to avoid crashing the conductor.
+    const fallback: AgentEvent = newEnvelope({
+      runId: randomUUID(),
+      messageId: randomUUID(),
+      type: "fallback",
+      publicSummary: "ระบบพบข้อผิดพลาดภายใน จึงปรับข้อมูลก่อนแสดงผล",
+      agentId: "conductor",
+    });
+    emit(fallback);
+    return false;
+  }
 }
```

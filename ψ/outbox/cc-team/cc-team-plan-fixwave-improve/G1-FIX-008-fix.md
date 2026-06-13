<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-008 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2391,"completion_tokens":3172,"total_tokens":5563,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2795,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T11:25:59.204Z -->
```typescript
Finding: Missing null/undefined guard on `input` in `composeThaiAnswer`
If the caller passes `null` or `undefined` for `input`, the function throws a TypeError when accessing `input.facts`. Add an early return that yields a safe “no data” response.
```
```diff
 export function composeThaiAnswer(input: ResponseComposerInput): ResponseComposerOutput {
   const t0 = Date.now();
   const reasons: string[] = [];
+
+  if (input == null) {
+    return {
+      text: "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในขณะนี้",
+      mode: "passthrough",
+      reasons: ["invalid-input"],
+      latencyMs: Date.now() - t0,
+      factCount: 0,
+    };
+  }
+
   const facts = Array.isArray(input.facts) ? input.facts : [];
   const usable = facts
     .map((f) => ({ ...f, summary: trimFact(f.summary) }))
```
```

```typescript
Finding: Null or undefined items in the `facts` array cause a TypeError when accessing `f.summary`
If any array element is `null` or `undefined`, the `.map` callback throws. Filter those items out before processing to match the expected runtime behaviour of silently dropping invalid entries.
```
```diff
   const facts = Array.isArray(input.facts) ? input.facts : [];
-  const usable = facts
+  const validFacts = facts.filter((f) => f != null);
+  const usable = validFacts
     .map((f) => ({ ...f, summary: trimFact(f.summary) }))
     .filter((f) => f.summary.length > 0);
```
```

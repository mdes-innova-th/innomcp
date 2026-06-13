<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-018 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3606,"completion_tokens":5022,"total_tokens":8628,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4742,"image_tokens":0},"cache_creation_input_tokens":0} | 63s
 generated: 2026-06-13T11:29:38.289Z -->
### Finding: `renderThaiNumberText` fails for very large numbers (>= 10^13)
The function splits the input into a "million" part and a remainder only once. When the million part itself exceeds 999 999, it is passed to `renderChunk` which can only handle up to 7 digits, leading to missing or incorrect higher‑order Thai number words. Replacing `renderChunk(millions)` with a recursive call to `renderThaiNumberText` correctly chains the “ล้าน” suffix for arbitrarily large values.

```diff
--- a/innomcp-node/src/services/generalGate.ts
+++ b/innomcp-node/src/services/generalGate.ts
@@ -40,8 +40,8 @@ export function renderThaiNumberText(value: number): string {
     return renderChunk(Math.floor(value));
   }
 
   const millions = Math.floor(value / 1000000);
   const remainder = Math.floor(value % 1000000);
-  return `${renderChunk(millions)}ล้าน${remainder > 0 ? renderChunk(remainder) : ""}`;
+  const millionsText = renderThaiNumberText(millions);
+  return `${millionsText}ล้าน${remainder > 0 ? renderChunk(remainder) : ""}`;
 }
```

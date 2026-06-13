<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-007 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3469,"completion_tokens":3933,"total_tokens":7402,"prompt_tokens_details":{"cached_tokens":3456,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2908,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T11:26:35.635Z -->
### Finding: `evidenceMatch` exclusion regex applied unconditionally (MED)
**Summary:** The exclusion pattern `/machine learning|url encoding|url คืออะไร/` runs after the `hasOfficerSignal` block, rejecting **any** evidence hit when the message contains those phrases — even if the hit keyword is a strong forensic signal (e.g., `"forensic"`). Move the exclusion inside the `if (["machine","url","traffic"]...)` branch so it only applies to the inherently ambiguous keywords.

**Patch:**
```diff
 function evidenceMatch(message: string): string | null {
   const hit = containsAny(message, EVIDENCE_KEYWORDS);
   if (!hit) return null;
   const lower = message.toLowerCase();

   // "machine" and "url" are common in non-officer questions. Only treat
   // them as evidence intent when the query also has an officer/data signal.
   if (["machine", "url", "traffic"].includes(hit.toLowerCase())) {
     const hasOfficerSignal =
       /หลักฐาน|คดี|พยาน|forensic|evidence|detect|nip|isp|offline|threat|sigint|scan|สแกน/i.test(message);
     if (!hasOfficerSignal) return null;
+    // Exclude common non‑evidence phrases that contain these ambiguous keywords
+    if (/machine learning|url encoding|url คืออะไร/.test(lower)) return null;
   }
-  if (/machine learning|url encoding|url คืออะไร/.test(lower)) return null;
   return hit;
 }
```

---

### Finding: redundant `toLowerCase()` inside `containsAny` (LOW)
**Summary:** Every call to `containsAny` lowercases the message once but then lowercases every keyword *on each iteration*. The keyword lists are module‑level constants; pre‑compute their lower‑cased forms once at load time. Wrapping each array definition with a `toLowerArray()` helper keeps the change minimal and preserves exact original semantics.

**Patch:**
```diff
+function toLowerArray(arr: string[]): string[] {
+  return arr.map(s => s.toLowerCase());
+}
 
-const PLANNING_KEYWORDS = [
+const PLANNING_KEYWORDS = toLowerArray([
   "วางแผน",
   "แผนการ",
   // … (rest unchanged)
 ];
```
*Apply the same wrapping to all `*_KEYWORDS` constants.*  
A blanket replacement script: change each `const X_KEYWORDS = [` to `const X_KEYWORDS = toLowerArray([`.

---

### Finding: `hasOfficerSignal` regex recompiled on every call (LOW)
**Summary:** The regex literal `/หลักฐาน|.../i` is created anew each time `evidenceMatch` runs. Hoisting it to module scope avoids repeated compilation.

**Patch:**
```diff
+const OFFICER_SIGNAL_RE = /หลักฐาน|คดี|พยาน|forensic|evidence|detect|nip|isp|offline|threat|sigint|scan|สแกน/i;

 function evidenceMatch(message: string): string | null {
   const hit = containsAny(message, EVIDENCE_KEYWORDS);
   if (!hit) return null;
   const lower = message.toLowerCase();

   if (["machine", "url", "traffic"].includes(hit.toLowerCase())) {
-    const hasOfficerSignal =
-      /หลักฐาน|คดี|พยาน|forensic|evidence|detect|nip|isp|offline|threat|sigint|scan|สแกน/i.test(message);
+    const hasOfficerSignal = OFFICER_SIGNAL_RE.test(message);
     if (!hasOfficerSignal) return null;
     if (/machine learning|url encoding|url คืออะไร/.test(lower)) return null;
   }
   return hit;
 }
```

---

### Finding: dead import and unused parameter (LOW)
**Summary:** `looksLikeSystemInventoryQuestion` is imported but never called in the visible code; the `toolHint` parameter in `classifyIntent` is declared but not used. Both can be removed unless they are consumed in the (still‑truncated) remainder of the function. No other code in the provided snippet references them.

**Patch:**
```diff
-import { looksLikeSystemInventoryQuestion } from "./systemInventory";
 
 export type ChatIntent = "greeting" | /* … */;
 
 // …
 
-export function classifyIntent(message: string, toolHint?: string): ClassifyResult {
+export function classifyIntent(message: string): ClassifyResult {
   // … (rest unchanged)
```
*If any callers currently pass a second argument, those call sites must be updated to remove it – a compile‑time breaking change that is consistent with “remove dead code”.*

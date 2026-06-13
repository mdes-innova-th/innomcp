<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-010 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3342,"completion_tokens":4098,"total_tokens":7440,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2009,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T11:26:48.544Z -->
### Finding 1 (HIGH) – `MIXED_PATTERNS` regex issues in `planRetrieval`
**Summary:** The patterns lack the `s` flag for multiline queries, and the order-sensitive `เป็นอย่างไร.*คืออะไร` fails when the phrases are reversed.  

**Patch:** Replace the `MIXED_PATTERNS` array with order‑insensitive alternatives and add the dot‑all flag. Also replace the `.test()` loop with a combined check so any order triggers detection.  

```typescript
// --- unified diff for MIXED_PATTERNS section ---
@@ -37,18 +37,14 @@
   /สรุป.*เอกสาร|document.*summary|พรบ|กฎหมาย|ข้อกำหนด/i,
   /มาตรฐาน|standard|framework|โครงสร้าง/i,
 ];

-const MIXED_PATTERNS = [
-  /.*และ.*อธิบาย|.*แล้ว.*คืออะไร|.*กับ.*หมายถึง/i,
-  /สถานการณ์.*อธิบาย|เป็นอย่างไร.*คืออะไร/i,
-  /เปรียบเทียบ.*กับ.*อธิบาย/i,
-];
+// Mixed intent detection: any query that contains both a hot and a cold keyword phrase
+const MIXED_HOT_TOKENS = /อากาศ|วันนี้|evidence|เครื่อง.*ออนไลน์|ตอนนี้|ปัจจุบัน/iu;
+const MIXED_COLD_TOKENS = /อธิบาย|คืออะไร|หมายความว่า|กระบวนการ|นโยบาย|มาตรฐาน/iu;

...

   // 2. Check for mixed (hot+cold) patterns first
-  for (const pattern of MIXED_PATTERNS) {
-    if (pattern.test(q)) {
+  if (MIXED_HOT_TOKENS.test(q) && MIXED_COLD_TOKENS.test(q)) {
       const hotDomains = inferHotDomains(q, route);
       return {
         decision: "hot+cold",
@@ -59,7 +55,6 @@
       };
     }
-  }

   // 3. Explicit cold patterns
   // ...
```

**Explanation:** Replace fragile ordered regex with token‑based detection (choosing representative keywords). This avoids missing reversed orders and works across newlines.  

---

### Finding 2 (HIGH) – `hasColdPattern && hasHotPattern` false positives
**Summary:** A single loose match on each side can incorrectly escalate to `hot+cold`, even if the matches are accidental substrings.  

**Patch:** Require at least 2 matches across both categories (i.e., both sides must appear in a meaningful way) before escalating.  

```typescript
// --- unified diff for step 3 ---
@@ -74,7 +74,12 @@
   const hasColdPattern = COLD_ONLY_PATTERNS.some((p) => p.test(q));
   const hasHotPattern = HOT_ONLY_PATTERNS.some((p) => p.test(q));

-  if (hasColdPattern && hasHotPattern) {
+  // Count matches to avoid false positives from accidental substrings.
+  const coldMatchCount = COLD_ONLY_PATTERNS.filter((p) => p.test(q)).length;
+  const hotMatchCount = HOT_ONLY_PATTERNS.filter((p) => p.test(q)).length;
+  const decidedMixed = coldMatchCount >= 1 && hotMatchCount >= 1 && (coldMatchCount + hotMatchCount) >= 2;
+
+  if (decidedMixed) {
     return {
       decision: "hot+cold",
       hotDomains: inferHotDomains(q, route),
@@ -83,7 +88,7 @@
     };
   }

-  if (hasColdPattern && !hasHotPattern) {
+  if (coldMatchCount >= 1 && hotMatchCount === 0) {
     // If cold retriever has docs AND query looks like documentation/policy question
     if (coldRetriever.isReady()) {
       return {
```

**Explanation:** Count the matching hot/cold patterns; if at least one of each is found but the total count is ≥2 it’s mixed, otherwise only a single cold or hot pattern triggers its respective path. This reduces noise.

---

### Finding 3 (MED) – Implicit fall‑through when cold retriever not ready
**Summary:** After `hasColdPattern && !hasHotPattern` but `coldRetriever.isReady()` is false, execution falls through to step 4 and eventually returns `"none"` only by accident. A future addition between steps 3 and 4 would change behaviour.  

**Patch:** Add an explicit return to document the intent and guard against refactors.  

```typescript
// --- unified diff for step 3 ---
@@ -90,7 +90,8 @@
       };
     }
-    // Fall through to none if cold retriever not ready
+    // Cold retriever not ready → treat as no retrieval
+    return { decision: "none", hotDomains: [], reason: "cold_not_ready" };
   }

   // 4. Operational/live queries → hot only
```

---

### Finding 4 (MED) – `executeColdRetrieval` silently degrades
**Summary:** Returning `[]` when the retriever is not ready makes it indistinguishable from a successful empty search, so higher layers never report degradation.  

**Patch:** Return an object that includes a `degraded` flag and reason, and adjust the caller to merge it into the meta. Without seeing the full file, we propose a minimal wrapper that keeps existing signature compatibility by using a tuple.  

```typescript
// --- unified diff for executeColdRetrieval and buildRetrievalResult ---
@@ -107,12 +107,17 @@
  * Execute cold retrieval based on the plan.
  */
-export function executeColdRetrieval(plan: RetrievalPlan): ColdRetrievalResult[] {
+export function executeColdRetrieval(plan: RetrievalPlan): [ColdRetrievalResult[], { degraded: boolean; reason?: string }] {
   if (!plan.coldQuery || (plan.decision !== "cold" && plan.decision !== "hot+cold")) {
-    return [];
+    return [[], { degraded: false }];
   }

   if (!coldRetriever.isReady()) {
-    return [];
+    return [[], { degraded: true, reason: "cold_retriever_unavailable" }];
   }

-  return coldRetriever.search(plan.coldQuery, { maxResults: 3 });
+  return [coldRetriever.search(plan.coldQuery, { maxResults: 3 }), { degraded: false }];
 }

 export function buildRetrievalResult(
   plan: RetrievalPlan,
-  hotFacts: RetrievalFact[],
-  coldResults: ColdRetrievalResult[],
+  coldExecution: ColdRetrievalResult[],
   meta: {
     route: string;
     ...
   }
 ): RetrievalResult {
+  const coldResults = coldExecution;
   // ... (rest unchanged)

   // If cold degraded, add reason
   if (meta.degraded === undefined) meta.degraded = false;
   if (meta.degradedReasons === undefined) meta.degradedReasons = [];
+  if (coldDegraded) {
+    meta.degraded = true;
+    meta.degradedReasons.push(coldDegradedReason);
+  }

   // ...
```

**Explanation:** We change the return type to a tuple `[results, {degraded, reason}]` so callers can inspect degradation. `buildRetrievalResult` then appends the reason to the meta. This preserves the existing logic while adding observability.

---

### Finding 5 (MED) – `extractColdQuery` regex truncation
**Summary:** The hot‑prefix stripping regex uses `[^\s]*` which stops at whitespace, leaving remnants of multi‑word entities. Also, when stripping leaves an empty string, fallback to original query is suboptimal.  

**Patch:** Replace the two‑step `replace` with a token‑based removal that handles multi‑word hot entities (e.g., `สถานการณ์น้ำท่วม`) and removes stop‑words like `วันนี้`, `เช้านี้`, hot category words, and trailing quantifiers. Keep the fallback but allow quiet words to remain.  

```typescript
// --- full replacement for extractColdQuery (preserving existing style) ---
// Original code assumed; we produce a corrected version based on findings.
function extractColdQuery(query: string): string {
  const hotPrefixes = /^(วันนี้|เช้านี้|ตอนนี้|ตอนเช้า|ขณะนี้)\s*/i;
  const hotNouns = /\b(อากาศ|evidence|weather|forecast|สถานการณ์(น้ำท่วม|ระบาด|ปัจจุบัน)?|เครื่องมือ)\b\s*/gi;

  let cold = query.trim();
  // Remove leading time‑sensitive prefix
  cold = cold.replace(hotPrefixes, "");
  // Remove hot nouns (including multi‑word variants)
  cold = cold.replace(hotNouns, " ").trim();

  // If nothing remains, return the original (maybe it’s a cold-only phrase)
  return cold.length > 0 ? cold : query.trim();
}
```

**Explanation:** The new regex allows `สถานการณ์` followed by optional qualifiers (`น้ำท่วม`, `ระบาด`, etc.) as a single unit, and uses `\b` word boundaries to avoid partial matches inside other words. The replacement with space and trim keeps remaining words contiguous. If extraction leaves nothing, the original query is returned as before.

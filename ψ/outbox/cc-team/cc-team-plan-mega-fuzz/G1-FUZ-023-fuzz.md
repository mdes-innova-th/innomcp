<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-023 role=fuzz model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2245,"completion_tokens":5000,"total_tokens":7245,"prompt_tokens_details":{"cached_tokens":69,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 67s
 generated: 2026-06-13T12:05:30.986Z -->
The user wants property-based / fuzz test cases for the provided TypeScript module `retrievalOrchestrator.ts`.

 I need to:
 1. Enumerate input invariants and properties that must always hold.
 2. Identify adversarial/malformed/boundary inputs that could break them.
 3. Output a markdown list: property → fuzz input → expected invariant.
 4. Be concrete, no filler.

 Let's analyze the module carefully.

 Key functions:
 - `planRetrieval(query, route?, memory?)`: RetrievalPlan
 - `executeColdRetrieval(plan)`: ColdRetrievalResult[]
 - `buildRetrievalResult(plan, hotFacts, coldResults, meta)`: RetrievalResult
 - Helpers: `inferHotDomains`, `extractColdQuery`

 Invariants to consider:

 **planRetrieval:**
 1. Output `decision` must always be one of the four valid strings: "hot", "cold", "hot+cold", "none".
 2. `hotDomains` must be a non-null array (even if empty).
 3. If `route` is "calculator" or "datetime", decision MUST be "none" regardless of query/memory.
 4. If `route` is "weather", "evidence", "geo", "seismic", and not calculator/datetime, decision should be "hot" (unless overridden by mixed patterns? Wait, looking at code: step 2 checks mixed patterns first. Step 4 checks hot route. So if route is "weather" but query matches MIXED_PATTERNS, it returns "hot+cold" in step 2. So route=weather doesn't guarantee "hot" if mixed pattern matches. But if no mixed pattern, then yes, step 4 catches it.)
 5. `coldQuery` must be defined when decision is "cold" or "hot+cold", and undefined when decision is "hot" or "none".
 6. `coldQuery` length should be <= 500? Actually `q` is sliced to 500, but `coldQuery` comes from `extractColdQuery(q)` which might be shorter. But if decision is cold, `coldQuery` is `q` (which is already sliced). So `coldQuery` should be <= 500.
 7. `reason` must always be a non-empty string.
 8. If `query` is empty string or whitespace, `q` becomes empty. Then no patterns match. No route. No memory. Returns "none". But `q.trim().slice(0,500)` - if query is empty, q is "". No patterns match. Returns default "none".
 9. If `query` is very long (>500), it is sliced. Should not crash.
 10. If `query` contains regex special characters that might break the regex patterns? The patterns are hardcoded regexes. `pattern.test(q)` where q is user input. If q contains unescaped regex syntax, it shouldn't matter because `test` just matches against the string. The string is treated as literal by the regex engine (the pattern is the regex, q is the subject string). Wait, actually no - `pattern.test(q)` is safe. The regex is the pattern, q is the string being tested. Regex injection isn't possible here in JS the way it is if you construct regex from string. So no crash from regex special chars in query.
 11. `memory.activeDomain` continuation: if memory.activeDomain is "weather", "evidence", "geo", it returns "hot". But what if activeDomain is something else? It falls through to default.
 12. `hasColdPattern && hasHotPattern` returns "hot+cold". This is checked before `hasColdPattern && !hasHotPattern`.
 13. `coldRetriever.isReady()` side effect: If decision is "cold" but coldRetriever is not ready, it falls through to step 4? Wait, looking at code:
     ```typescript
     if (hasColdPattern && !hasHotPattern) {
       if (coldRetriever.isReady()) {
         return { decision: "cold", ... }
       }
       // Fall through to none if cold retriever not ready
     }
     ```
     Actually the comment says "Fall through to none" but the code doesn't explicitly return "none" there. It falls through to the next checks (step 4, 5, 6). So if coldRetriever is not ready, it might still become "hot" in step 4 if hasHotPattern is true? But wait, this branch is `hasColdPattern && !hasHotPattern`. So hasHotPattern is false. So step 4 won't trigger. Step 5 might trigger if memory. Step 6 returns "none". So effectively it becomes "none" or memory-based. But the comment is slightly misleading. Actually if memory has activeDomain, it could return "hot". So if cold not ready, it might return "hot" via memory. This is an interesting edge case.
 14. `inferHotDomains`: Must always return array with at least one element. If no route and no query matches, returns ["general"]. Must not contain duplicates.
 15. `extractColdQuery`: Must return a string. If stripping leaves < 5 chars, returns original `q` (which is already trimmed/sliced). So it should never return empty if original was non-empty? Wait, if original q is "วันนี้" (after trimming), replacing "วันนี้..." might leave empty string, length 0, which is < 5, so returns original "วันนี้". So it always returns something if original was non-empty.

 **executeColdRetrieval:**
 1. If `plan.decision` is not "cold" or "hot+cold", MUST return empty array regardless of other fields.
 2. If `plan.coldQuery` is missing/falsy, MUST return empty array.
 3. If `coldRetriever.isReady()` is false, MUST return empty array.
 4. If `coldRetriever.search` throws, it propagates (no catch block). But the function itself doesn't handle errors.
 5. Should not mutate `plan`.

 **buildRetrievalResult:**
 1. `sources` must be the concatenation of `hotFacts.map(f=>f.source)` and `coldResults.map(r=>r.source)`. Order preserved: hot first, then cold.
 2. `retrievalUsed` must be consistent with lengths of `hotFacts` and `coldResults`:
    - both > 0 → "both"
    - only hot > 0 → "hot"
    - only cold > 0 → "cold"
    - else → "none"
    Note: It depends on array lengths, not on `plan.decision`. So `plan.decision` could be "cold" but if `coldResults` is empty, `retrievalUsed` is "none". This is an important invariant.
 3. `factSummary` composition:
    - `hotSummary` from `composeFactSummary(hotFacts)` (external, assume it works)
    - `coldSummary` from mapping coldResults.
    - If both present, joined with "\n\n---\n\n".
    - If only one, no separator.
    - If both empty, empty string? Let's see: `[hotSummary, coldSummary].filter(Boolean).join(...)` - if both empty strings, filter(Boolean) removes them, join returns "". So factSummary is "".
 4. `contract` must be built from `buildAnswerContract` with correct `retrievalUsed` derived from array lengths, not plan.
 5. Must not mutate inputs.
 6. If `meta.confidence` is NaN, Infinity, negative, it just passes through to buildAnswerContract. We can't test buildAnswerContract internals but we can check the contract is returned.
 7. `allSources` deduplication? No deduplication happens. So duplicates should be preserved.

 **Adversarial/Malformed/Boundary Inputs:**

 For `planRetrieval`:
 - `query`: null/undefined (but TS types say string, fuzzing might bypass). However the code does `query.trim()` which would throw if null/undefined. But in strict TS this shouldn't happen. For fuzzing, we can consider it.
 - `query`: empty string, whitespace only, 500+ chars, 501 chars, exactly 500 chars.
 - `query`: strings that match multiple patterns simultaneously (e.g., both hot and cold patterns).
 - `query`: strings that match MIXED_PATTERNS but also route is "calculator". Wait, route calculator is checked first. So route calculator should always win.
 - `query`: strings with regex-like content `[`, `(`, `*`, etc. - should be harmless as explained.
 - `route`: undefined, null, empty string, unexpected string like "cold", "hot", "unknown", "calculator" (valid), "datetime" (valid), "weather" (valid).
 - `memory`: null, undefined, empty object, activeDomain that is not in the allowed list, activeDomain with weird casing.
 - `memory.activeDomain`: "weather" (valid), "evidence" (valid), "geo" (valid), "seismic" (not in memory list but valid route), null, undefined, number.
 - `coldRetriever.isReady()` returning false when plan expects cold.

 For `executeColdRetrieval`:
 - `plan`: null/undefined (would crash).
 - `plan.decision`: "cold" but `plan.coldQuery` undefined/null/empty.
 - `plan.decision`: "hot+cold" with `coldQuery` present but `coldRetriever.isReady()` false.
 - `plan.decision`: "hot" but `coldQuery` present (should still return [] because decision check comes first).
 - `plan.decision`: unexpected string like "both" or "".

 For `buildRetrievalResult`:
 - `plan`: any RetrievalPlan.
 - `hotFacts`: empty, null (would crash on `.map`), undefined, array with missing `source` property (would push undefined).
 - `coldResults`: empty, null, undefined, array with missing `document.title` or `chunk.content` (would produce "[doc:undefined] undefined").
 - `meta`: missing fields, null, undefined, `confidence` as NaN/Infinity/-1, `latencyMs` as negative, `toolsUsed` as empty array or null.
 - `meta.answerMode`: invalid value.
 - Arrays with 1 element, many elements, duplicate sources.

 Let's structure the output as markdown list: `property → fuzz input → expected invariant`

 Need to be concrete. No filler.

 Let's draft the entries.

 1. **planRetrieval decision is always a valid union member**
    - Fuzz: `query` = any string (including empty, 500+ chars, unicode, regex metacharacters like `[.*+?^${}()|]`), `route` = any string/undefined, `memory` = any shape/undefined
    - Invariant: `decision ∈ {"hot","cold","hot+cold","none"}` and `hotDomains` is always a non-empty array

 2. **Deterministic routes are retrieval-free regardless of query content**
    - Fuzz: `route` = `"calculator"` or `"datetime"`, `query` = `"อากาศวันนี้และอธิบายว่าคืออะไร"` (matches mixed/cold/hot patterns), `memory` = `{ activeDomain: "weather" }`
    - Invariant: `decision === "none"`, `reason === "deterministic_route"`, `hotDomains` empty, `coldQuery` absent

 3. **Mixed pattern precedence over single-path patterns**
    - Fuzz: `query` = `"สถานการณ์วันนี้และอธิบาย"`, `route` = undefined, `memory` = null
    - Invariant: `decision === "hot+cold"` (MIXED_PATTERNS checked before COLD_ONLY/HOT_ONLY), `coldQuery` defined, `hotDomains` non-empty

 4. **Simultaneous hot+cold pattern detection without mixed regex**
    - Fuzz: `query` = `"อากาศวันนี้คืออะไร"` (matches HOT_ONLY `อากาศ.*วันนี้` and COLD_ONLY `คืออะไร`), `route` = undefined
    - Invariant: `decision === "hot+cold"`, `reason === "both_patterns_detected"`, `coldQuery` defined

 5. **Cold-only fallback when retriever unavailable**
    - Fuzz: `query` = `"นโยบายคืออะไร"` (matches COLD_ONLY), `route` = undefined, `memory` = null, mock `coldRetriever.isReady()` → `false`
    - Invariant: `decision !== "cold"` (falls through); specifically returns `"none"` or memory-derived, but never `"cold"` with a missing retriever

 6. **Route-based hot override for operational domains**
    - Fuzz: `query` = `"random chat text"` (no pattern match), `route` = `"seismic"`, `memory` = null
    - Invariant: `decision === "hot"`, `hotDomains` contains `"seismic"`, `reason === "operational_live_query"`

 7. **Memory domain continuation for eligible domains**
    - Fuzz: `query` = `"hello"` (no pattern), `route` = undefined, `memory` = `{ activeDomain: "evidence" }`
    - Invariant: `decision === "hot"`, `hotDomains` = `["evidence"]`, `reason === "memory_domain_continuation"`

 8. **Memory domain continuation ignored for ineligible domains**
    - Fuzz: `query` = `"hello"`, `route` = undefined, `memory` = `{ activeDomain: "seismic" }` (valid route but not in memory list)
    - Invariant: `decision === "none"`, `reason === "no_retrieval_pattern"` (falls through to default)

 9. **Query length boundary at 500 characters**
    - Fuzz: `query` = `"อากาศวันนี้"` + `"x".repeat(1000)`, `route` = undefined
    - Invariant: no exception thrown; `coldQuery` (if produced) length ≤ 500; pattern matching operates on truncated string

 10. **inferHotDomains deduplication and defaulting**
     - Fuzz: `query` = `"weather evidence calculator"`, `route` = `"weather"`
     - Invariant: `hotDomains` contains no duplicates (`"weather"` once), includes all matched domains, and if nothing matches returns `["general"]`

 11. **extractColdQuery minimum length fallback**
     - Fuzz: `query` = `"วันนี้อากาศ"` (after trim/replace becomes empty or <5 chars)
     - Invariant: returned string equals original truncated query (length ≥ original truncated length, not empty if original was non-empty)

 12. **executeColdRetrieval decision gate**
     - Fuzz: `plan` = `{ decision: "hot", coldQuery: "policy", ... }` or `{ decision: "none", coldQuery: "policy", ... }`
     - Invariant: returns `[]` regardless of `coldQuery` presence or `coldRetriever.isReady()` state

 13. **executeColdRetrieval requires ready retriever**
     - Fuzz: `plan` = `{ decision: "cold", coldQuery: "test" }`, mock `coldRetriever.isReady()` → `false`
     - Invariant: returns `[]`; never calls `coldRetriever.search`

 14. **executeColdRetrieval requires coldQuery**
     - Fuzz: `plan` = `{ decision: "hot+cold", coldQuery: undefined }`
     - Invariant: returns `[]` even if retriever is ready

 15. **buildRetrievalResult retrievalUsed derived from array lengths, not plan**
     - Fuzz: `plan` = `{ decision: "cold" }`, `hotFacts` = `[{source:"h1"}]`, `coldResults` = `[]`
     - Invariant: `retrievalUsed === "hot"` (not `"cold"`), `contract.retrievalUsed === "hot"`

 16. **buildRetrievalResult retrievalUsed = none when both arrays empty**
     - Fuzz: `plan` = `{ decision: "hot+cold" }`, `hotFacts` = `[]`, `coldResults` = `[]`
     - Invariant: `retrievalUsed === "none"`, `factSummary === ""`, `sources` empty

 17. **buildRetrievalResult source ordering and preservation**
     - Fuzz: `hotFacts` = `[{source:"s1"},{source:"s1"}]`, `coldResults` = `[{source:"s2",document:{title:"T"},chunk:{content:"C"}}]`
     - Invariant: `sources` is exactly `["s1","s1","s2"]` (duplicates preserved, hot before cold)

 18. **buildRetrievalResult factSummary separator invariant**
     - Fuzz: `hotFacts` non-empty producing non-empty `hotSummary`, `coldResults` non-empty producing non-empty `coldSummary`
     - Invariant: `factSummary` contains exactly `"\n\n---\n\n"` between hot and cold sections; no separator if either section empty

 19. **buildRetrievalResult contract immutability of inputs**
     - Fuzz: any valid inputs
     - Invariant: `plan`, `hotFacts`, `coldResults`, `meta` objects/arrays are not mutated after call

 20. **buildRetrievalResult handles malformed cold result entries gracefully**
     - Fuzz: `coldResults` = `[{ source: "s", document: {}, chunk: {} }]` (missing `title`/`content`)
     - Invariant: does not throw; `factSummary` contains `"[doc:undefined] undefined"` and `sources` contains `"s"`

 21. **buildRetrievalResult meta passthrough for extreme numeric values**
     - Fuzz: `meta.confidence` = `NaN`, `meta.latencyMs` = `-1`, `meta.grounded` = `false`
     - Invariant: `contract` is still constructed and returned; `contract.confidence === NaN` (or however buildAnswerContract handles it, but function does not crash)

 Wait, for #21, if `buildAnswerContract` is external, we can only assert that our function doesn't crash and passes the values. But since we don't know `buildAnswerContract`'s behavior, better to say: function does not throw; contract object is returned.

 Let's refine and make sure they are concrete and no filler.

 Also need to consider `query` with null bytes, emojis, RTL, etc. But maybe not necessary to be too exhaustive if not adding new info.

 Let's check if there are any other subtle bugs.

 In `planRetrieval`:
 ```typescript
 const q = query.trim().slice(0, 500);
 ```
 If `query` is not a string, this throws. But fuzzing in TS might not hit this unless using `any`. We can include it.

 In `inferHotDomains`:
 ```typescript
 if (route) domains.push(route);
 ```
 If `route` is present, it's pushed. Then if query matches, pushes domain if not already included. Returns `domains.length > 0 ? domains : ["general"]`. So if route is present, domains is non-empty. If route is empty string, it's falsy, not pushed. Good.

 In `extractColdQuery`:
 ```typescript
 let cold = query;
 cold = cold.replace(/วันนี้\s*(อากาศ|evidence|สถานการณ์)[^\s]*\s*/gi, "").trim();
 ```
 Wait, `[^\s]*` means any non-whitespace character, zero or more. `\s*` after `วันนี้` then `(อากาศ|evidence|สถานการณ์)` then `[^\s]*` then `\s*`. This regex might behave unexpectedly if there are no whitespace after the matched word. But it's a concrete implementation detail. The fuzz input could be `"วันนี้อากาศดี"` -> matches `วันนี้อากาศดี`? Let's see: `วันนี้` then `\s*` (zero whitespace) then `(อากาศ)` then `[^\s]*` matches `ดี` then `\s*` (zero). So it replaces `วันนี้อากาศดี` with empty. Then length might be 0, so returns original. This is fine.

 But what if `query` is something that makes the regex engine hang? The regexes use `.*` and are not anchored. With very long strings they might be slow but probably not catastrophic backtracking because the patterns are relatively simple. But a 500-char string with nested quantifiers? Probably okay.

 One more thing: `planRetrieval` step 3:
 ```typescript
 if (hasColdPattern && !hasHotPattern) {
   if (coldRetriever.isReady()) {
     return { decision: "cold", ... }
   }
   // Fall through
 }
 ```
 If coldRetriever is not ready, it falls through. Then step 4: `if (hasHotPattern || ...)` - but `hasHotPattern` is false in this branch. So step 4 false. Step 5: if memory has activeDomain in list, returns hot. Step 6: returns none. So it doesn't necessarily return "none". It could return "hot" via memory. This is a good property to test.

 Let's add that.

 Also, `buildRetrievalResult` uses `coldResults.map((r) => `[doc:${r.document.title}] ${r.chunk.content}`)`. If `r.document` or `r.chunk` is null/undefined, this throws. Good to fuzz.

 Let's organize into the final markdown list. I'll make sure each line is: `- **Property**: ... → **Fuzz input**: ... → **Invariant**: ...`

 Wait, the user asked: "Output a markdown list: property → fuzz input → expected invariant."

 So format:
 - **Property**: [description]
  - **Fuzz input**: [concrete values]
  - **Invariant**: [what must hold]

 Or inline:
 - **Property** → **Fuzz input** → **Invariant**

 Let's do a clean markdown list with bold headers for readability.

 Let's compile the final list.

 1. Decision domain validity
 2. Deterministic route supremacy
 3. Mixed pattern precedence
 4. Overlapping pattern bifurcation
 5. Cold retriever readiness gate
 6. Cold unavailability fall-through does not default to cold
 7. Operational route coercion
 8. Memory domain continuation
 9. Ineligible memory domain ignored
 10. Query truncation boundary
 11. Regex metacharacter safety in query
 12. inferHotDomains deduplication & default
 13. extractColdQuery length floor
 14. executeColdRetrieval decision gate
 15. executeColdRetrieval query requirement
 16. executeColdRetrieval readiness check
 17. retrievalUsed derived from result arrays, not plan
 18. Empty arrays yield none retrieval
 19.

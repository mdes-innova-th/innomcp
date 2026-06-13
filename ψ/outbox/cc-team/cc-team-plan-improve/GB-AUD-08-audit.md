<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-08 role=audit model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1318,"completion_tokens":5000,"total_tokens":6318,"prompt_tokens_details":{"cached_tokens":5,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 65s
 generated: 2026-06-13T11:13:01.262Z -->
The user wants me to audit a TypeScript module `responseComposer.ts` for real defects. I need to look for concrete issues like bugs, race conditions, unhandled rejections, missing error handling, resource leaks, incorrect async/await, edge cases, and silent failures.

Let me analyze the code carefully:

1. **trimFact function**: `String(s || "")` - if `s` is passed but is not a string, this handles it. But wait, `trimFact` is called with `f.summary` which is typed as `string`. However, at runtime it could be null/undefined despite the type. The `String(s || "")` handles null/undefined. But what if `s` is already a string? It works fine.

2. **composeThaiAnswer**:
   - `const facts = Array.isArray(input.facts) ? input.facts : [];` - handles non-array facts
   - `const usable = facts.map(...).filter(...)` - looks okay
   - `if (usable.length === 0)` - returns no data message
   - Confidence filter: `const highConf = usable.filter((f) => (f.confidence ?? 1) >= 0.3);` - if confidence is undefined, defaults to 1. Good.
   - `const rendered = highConf.length > 0 ? highConf : usable;` - if all facts are low confidence, keeps all. Good.
   - Header handling: `if (input.header && input.header.trim())` - safe
   - Footer handling: `if (input.footer && input.footer.trim())` - safe
   - `lines.join("\n").trim()` - good

3. **Potential issues**:
   - **input.route**: `reasons.push(`route:${input.route || "unknown"}`);` - if `input.route` is undefined or null, it falls back to "unknown". But what if `input` itself is null or undefined? The function doesn't validate `input` existence. If `input` is null/undefined, `input.facts` will throw. However, TypeScript typing says it's `ResponseComposerInput`, but at runtime it could be null.
   - **input.userQuery**: It's in the interface but never used in the function. Not a defect, just unused.
   - **Date.now() - t0**: Could theoretically be negative if system clock changes, but extremely unlikely and not a real concern.
   - **composeThaiAnswerWithLLM**: It's async but calls a sync function. That's fine, it returns a Promise. No unhandled rejections since composeThaiAnswer doesn't throw (or does it?).
   - **Does composeThaiAnswer throw?** Let's check:
     - `Array.isArray(input.facts)` - if input is null, throws TypeError before this.
     - `facts.map` - safe because facts is guaranteed array.
     - `f.summary` - if f is null/undefined inside the array, `f.summary` will throw TypeError. The code does `facts.map((f) => ({ ...f, summary: trimFact(f.summary) }))`. If `f` is null or undefined, spreading `...f` works (null/undefined spread in objects throws in TS/JS? Actually, `{ ...null }` evaluates to `{}` in JS. Wait: `{ ...undefined }` throws TypeError in strict mode? Let me think. In JS, `{ ...null }` actually results in `{}` and doesn't throw. But `f.summary` would throw if f is null because null.summary throws. So if `input.facts` contains `null` elements, `f.summary` throws.
     - `trimFact(f.summary)` - if f.summary is missing, undefined is passed, handled by `String(s || "")`.
     - `f.source` in the loop - if f is null, this would have already failed at map time. But what if f is not null but f.source is undefined? `f.source ? ... : ""` handles it.
     - `f.confidence` - handled with `typeof` check.

4. **Real defects found**:
   - **Runtime null input**: If `input` is null or undefined, `input.facts` throws. Severity: MED or HIGH? Since this is a backend service, inputs could come from untrusted sources (HTTP handlers, etc.). Missing input validation is a real defect.
   - **Null elements in facts array**: If `input.facts` contains `null` or `undefined` elements, `f.summary` will throw TypeError at runtime despite TypeScript types. This is a concrete bug.
   - **NaN confidence**: `typeof f.confidence === "number" && f.confidence < 0.6` - if confidence is `NaN`, `typeof` is "number" and `NaN < 0.6` is false. But `(NaN * 100).toFixed(0)` would return "NaN%". Wait, the condition is `f.confidence < 0.6`. If confidence is NaN, the condition is false, so it doesn't enter the branch. Actually `NaN < 0.6` is false. So NaN confidence is treated as high confidence (>= 0.6). That's arguably incorrect logic but not a crash. However, if confidence is Infinity or -Infinity? `Infinity * 100` is Infinity, `toFixed(0)` on Infinity throws RangeError! Let me check: `Infinity.toFixed(0)` throws RangeError in JS. Yes! `Number.prototype.toFixed` throws RangeError if the number is Infinity or NaN. Wait, but NaN is filtered out by the condition `f.confidence < 0.6` (false). But Infinity is not < 0.6, so it wouldn't enter that branch either. What about -Infinity? `-Infinity < 0.6` is true! So if confidence is `-Infinity`, it enters the branch, then `(-Infinity * 100).toFixed(0)` throws RangeError. This is an edge case but possible if malformed data comes in. Actually, is -Infinity * 100 just -Infinity? Yes. And `toFixed` on -Infinity throws. So this is a concrete crash bug.
   - **Missing input validation on input object**: Not just null, but missing properties.
   - **Unused userQuery**: Not a defect.
   - **Async function without await**: `composeThaiAnswerWithLLM` is async but doesn't await. It returns `composeThaiAnswer(input)` which is not a Promise. In TypeScript/JS, returning a non-promise from an async function wraps it in a Promise. So this is fine, not a defect.

Wait, let me reconsider the `input` null check. The function signature doesn't validate input. If called with null, it throws. This is a common issue. But is it a "real defect"? In a backend service, yes, because runtime types don't match compile-time types.

Let me look more carefully:
- `const facts = Array.isArray(input.facts) ? input.facts : [];` - if input is null, this throws before the ternary resolves.

Actually, looking at the interface, `facts` is required. So passing null is violating the contract. But the audit asks for "edge cases (null/empty/malformed input)". So I should report missing runtime validation.

Another issue: `input.route || "unknown"` - if route is an empty string, it becomes "unknown". That's fine.

What about `trimFact`: `String(s || "")`. If `s` is a number, String(0) is "0", which might be unexpected but not a defect.

What about the `lines` array and joining? Looks fine.

What about the `latencyMs`? `Date.now() - t0` could be negative if clock skew happens, but that's not really a defect in this code.

Let me reconsider the `facts` array containing nulls:
```typescript
const usable = facts
    .map((f) => ({ ...f, summary: trimFact(f.summary) }))
```
If `f` is `null`, `{ ...null }` in modern JS actually evaluates to `{}` and does NOT throw. Wait, is that right? Let me verify mentally. In JS, object spread calls `ToObject` on the source. `ToObject(null)` throws TypeError. Actually, in object literals, spread syntax `...obj` requires the obj to be iterable or object-like. For null, it throws: `TypeError: Cannot convert undefined or null to object`. Yes, `{ ...null }` throws TypeError. So if `facts` contains null, it throws at map time.

But even before that, `f.summary` would throw if `f` is null? Actually, the spread `...f` is evaluated first? In the object literal `{ ...f, summary: trimFact(f.summary) }`, the property value `trimFact(f.summary)` is evaluated, and `f.summary` throws before the spread. So yes, null elements crash.

Also, what if `input.facts` is not an array but array-like? `Array.isArray` check handles that.

What about `f.confidence` being a number but not finite? As analyzed, `-Infinity` causes a crash.

What about `input.header` or `input.footer` being non-string? The code does `input.header && input.header.trim()`. If header is a number, `input.header` is truthy, but `.trim()` is not a function, so it throws TypeError. This is a runtime type mismatch.

Similarly, `input.route` - if it's a number, `input.route || "unknown"` works, but later it's used in a template string which is fine.

So concrete defects:
1. **No runtime validation of `input`**: If null/undefined, throws TypeError. Location: composeThaiAnswer, start of function.
2. **No runtime validation of `input.facts` elements**: If array contains null/undefined or non-object elements, throws TypeError. Location: composeThaiAnswer, map callback.
3. **No runtime validation of `f.confidence`**: If `-Infinity`, causes RangeError in `toFixed()`. Location: composeThaiAnswer, loop over rendered.
4. **No runtime validation of `input.header`/`input.footer` types**: If non-string with truthy value, `.trim()` throws. Location: composeThaiAnswer, header/footer checks.

Wait, are these "real defects" or just TypeScript type safety issues? The prompt says "edge cases (null/empty/malformed input)". So yes, these count.

But I need to be careful. The prompt says "Report ONLY concrete issues you can point at". If I report too many type-safety issues, it might seem like I'm grasping. Let me focus on the most concrete ones:

1. **Missing input null check**: If `input` is null/undefined, the function throws an unhandled exception. This is a real bug in a backend service where inputs might not be validated at the boundary.

2. **Unsafe property access on facts elements**: The code assumes every element in `input.facts` is a valid object. If any element is null/undefined, accessing `f.summary` throws. This is a concrete crash.

3. **RangeError on confidence values**: `f.confidence` accepts any number. If `-Infinity` (or potentially other edge cases), `(f.confidence * 100).toFixed(0)` throws RangeError because `toFixed` doesn't accept Infinity. This is a concrete crash on malformed input.

4. **Unsafe trim() calls on header/footer**: `input.header.trim()` assumes header is a string. If a caller passes a truthy non-string (e.g., a number or object), this throws TypeError.

Are there any others?

5. **Empty string route**: Not a defect.

6. **The async stub**: `composeThaiAnswerWithLLM` is async but calls sync function. This is fine.

7. **No error handling in async function**: The async function doesn't have try/catch, but since it just delegates to a sync function that doesn't throw (except for the bugs above), and returns a Promise, it's fine.

8. **Resource leaks**: None.

9. **Race conditions**: None, it's sync.

10. **Silent failures**: The `userQuery` is accepted but ignored. Not a silent failure, just unused.

Actually, looking at the confidence logic again:
```typescript
const conf =
  typeof f.confidence === "number" && f.confidence < 0.6
    ? ` _(ความมั่นใจ ${(f.confidence * 100).toFixed(0)}%)_`
    : "";
```
If `f.confidence` is `0.6` exactly, no confidence label. If it's `0.599999`, label shows. That's by design.

What about `f.confidence` being `NaN`? `typeof NaN === "number"` and `NaN < 0.6` is false, so no label. That's fine.

What about `f.confidence` being negative but not -Infinity? e.g., -5. Then `(-5 * 100).toFixed(0)` = `"-500%"`. That's weird but not a crash.

What about `f.source` containing markdown injection? e.g., `f.source = "**evil**: "`. Then `**${f.source}**: ` becomes `****evil**: : `. That's a formatting issue but not really a defect in this context. The prompt asks for concrete bugs, not security issues unless they are real defects. This is more of a sanitization gap. Not sure if it counts.

Let me reconsider the `trimFact` function:
```typescript
function trimFact(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}
```
If `s` is passed as a number (e.g., from JSON deserialization), `String(s || "")` converts it. But if `s` is `0`, `0 || ""` gives `""`, so the fact "0" would be lost. If a fact summary is literally the number 0 (e.g., earthquake magnitude 0), it would be silently dropped. This is a concrete edge case! `String(s || "")` treats `0` as falsy. But wait, `s` is typed as `string`, so at runtime if it's `0`, that's malformed input. However, if the API returns `0` as a number for summary (which shouldn't happen per types, but JSON parsing...), it gets coerced to empty string and filtered out. This is a silent data loss bug.

Actually, looking at the call: `trimFact(f.summary)`. `f.summary` is typed as string. If the API that creates ToolFact has a bug and puts a number there, this would silently drop it. But the audit is of this module. Is it this module's responsibility? The `trimFact` function uses `||` instead of checking for null/undefined specifically. A better pattern would be `String(s ?? "")`. This is a classic JavaScript bug: falsy values like `0` or `false` are swallowed.

But wait, `s` is supposed to be a string. If it's `0`, that's invalid input. However, the function `trimFact` is called with `f.summary` which could theoretically be undefined. The `||` handles undefined fine. But if a summary is the string "0", `String("0" || "")` is "0", which is fine. Only if it's the number 0. Since the type is string, this is arguably a defensive coding issue rather than a bug. But in a backend service handling external data, it's a real defect.

Let me think about what would be the most impactful and clearly defensible findings:

Finding 1: **Missing null/undefined guard on `input`**
- Severity: MED
- Location: `composeThaiAnswer`, line ~57
- Issue: If `input` is null or undefined at runtime, accessing `input.facts` throws an unhandled TypeError before any graceful handling.
- Fix: Add `if (!input) { return { ... polite fallback ... }; }` or throw a domain error.

Finding 2: **Unsafe array element access**
- Severity: MED
- Location: `composeThaiAnswer`, `facts.map` callback
- Issue: `input.facts` may contain null/undefined or non-object elements at runtime (e.g., from deserialization). Accessing `f.summary` or spreading `f` throws TypeError.
- Fix: Filter/validate elements before mapping: `facts.filter((f): f is ToolFact => f && typeof f === 'object')`

Finding 3: **RangeError on malformed confidence**
- Severity: MED
- Location: `composeThaiAnswer`, confidence formatting loop
- Issue: `f.confidence` is not validated for finite numbers. If `-Infinity` is supplied (malformed JSON or computation result), `(f.confidence * 100).toFixed(0)` throws RangeError.
- Fix: Add `Number.isFinite(f.confidence)` check before calling `toFixed`.

Finding 4: **Silent data loss in trimFact for falsy non-string values**
- Severity: LOW
- Location: `trimFact`
- Issue: `String(s || "")` converts the number `0`, boolean `false`, or empty string to `""`, causing valid facts with summary `"0"` (if passed as number 0) to be silently dropped. More relevantly, if `f.summary` is missing, it's fine, but the pattern is risky.
- Actually, I think this is weak. Let me drop it.

Finding 4 (alternative): **Unsafe `.trim()` on header/footer**
- Severity: MED
- Location: `composeThaiAnswer`, header/footer blocks
- Issue: `input.header` and `input.footer` are not validated as strings before calling `.trim()`. Truthy non-string values (numbers, objects) cause TypeError.
- Fix: Coerce or validate: `typeof input.header === 'string' && input.header.trim()`

Actually, looking at the code again:
```typescript
if (input.header && input.header.trim()) {
```
If `input.header` is a number like `123`, it's truthy, then `.trim()` throws. This is a real runtime type safety issue.

But is it likely? The interface says `string | undefined`. In a backend service, if this is called from another TS module, it's probably fine. But if called from a JSON route handler, it could be anything.

Let me reconsider the `composeThaiAnswerWithLLM` async stub. It returns `composeThaiAnswer(input)` directly. Since it's async, it wraps the return value in a Promise. That's correct. No issue.

What about the `latencyMs` calculation? `Date.now() - t0`. If the system clock jumps backward, this could be negative. In Node.js, `Date.now()` is not monotonic. This is a real issue for latency measurement. Better to use `process.hrtime.bigint()` or `performance.now()`. But is this a "real defect"? It's a measurement inaccuracy bug. In a backend service, negative latency looks bad in logs/metrics. I'll include it as LOW.

Wait, but `Date.now()` can indeed go backwards if the system clock is adjusted. This is a classic issue. However, in containerized/cloud environments, clock jumps are rare but possible. I'll mention it.

Let me also look at the `reasons` array. It accumulates strings. No issue there.

What about the `mode` in the empty case? It's "passthrough". The comment says "returns a polite Thai 'no data' line with mode = 'passthrough'". But the comment says "caller is responsible for not re-running this on already-polished text." Not relevant.

Let me think about whether there are any logic bugs.

Confidence filter:
```typescript
const highConf = usable.filter((f) => (f.confidence ?? 1) >= 0.3);
const rendered = highConf.length > 0 ? highConf : usable;
```
If all facts have confidence 0.2, `highConf` is empty, so `rendered = usable` (all low conf facts). This is intended per comment: "Drop facts with confidence below 0.3 unless they are the only ones." Correct.

If `usable.length === 0`, returns early. Correct.

If `input.facts` is empty array, `usable` is empty, returns early. Correct.

If `f.summary` is all whitespace, `trimFact` makes it empty string, then `filter((f) => f.summary.length > 0)` drops it. Correct.

What about `f.source` being empty string? `f.source ? ... : ""` handles it. Correct.

What about `lines.join("\n").trim()`? If there are many facts, it joins with newlines. If header exists, there's a blank line after it. If footer exists, there's a blank line before it. The final `.trim()` removes trailing/leading whitespace. This seems correct.

Is there any issue with the `FACT_BULLET` being a literal? No.

Let me reconsider the `input` null check. Is it possible that `input` is undefined? The function is exported and could be called from anywhere. Yes, this is a valid finding.

Actually, I want to check if there are any issues with the `Array.isArray(input.facts)` check. If `input.facts` is not an array, it defaults to `[]`. But what if `input.facts` is an object with a `length` property (array-like)? It would be treated as `[]`. That's fine, it's defensive.

What if `input.facts` is a string? `Array.isArray` returns false, defaults to `[]`. Fine.

Now, let me think about whether I should report the `trimFact` issue with `0`. Actually, `f.summary` is typed as `string`. If someone passes `summary: 0` as a number, TypeScript would complain at compile time in the calling code. But at runtime in JS, it's possible. However, the `trimFact` function signature says `s: string`. If called with `undefined` (because summary is optional? No, summary is required in the interface), then `String(undefined || "")` is `""`. So missing summary is handled. But if summary is `null`, `String(null || "")` is `""`. So missing summary is handled. The `0` case is only if someone passes a number, which is a type violation. I think this is less compelling than the others.

Let me finalize my findings:

1. **HIGH/MED? Missing runtime validation on `input` object**: If `input` is null/undefined, throws unhandled TypeError. Severity: MED (because it's a boundary service, but callers might always pass valid objects). Actually, in a backend service, this is a concrete crash. I'll say MED.

2. **MED: Unsafe element access in facts array**: If `input.facts` contains null/undefined, throws TypeError during map. This is a real possibility with deserialized data.

3. **MED: RangeError on non-finite confidence**: `toFixed()` throws on `-Infinity`. This is a concrete crash on malformed input.

4. **LOW/MED: Unsafe `.trim()` on header/footer**: Non-string truthy values throw TypeError. Severity: LOW because header/footer are optional and less likely to be malformed.

5. **LOW: Non-monotonic latency measurement**: Using `Date.now()` for latency can produce negative or inaccurate values under clock skew.

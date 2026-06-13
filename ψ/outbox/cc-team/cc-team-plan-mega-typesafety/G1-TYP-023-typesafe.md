<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-023 role=typesafe model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1935,"completion_tokens":5000,"total_tokens":6935,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T12:03:36.054Z -->
The user wants a type-safety audit of the provided TypeScript code. I need to find:
1. `as any` - none visible
2. unsafe casts - none visible
3. non-null assertions (`!`) - I see `const state = this.models.get(config.id)!;` in `addModel`
4. implicit any - need to check for untyped parameters or variables that would be implicit any. The `reduce` callbacks have typed parameters? Let's check:
   - `eligible.reduce((best, curr) => ...)` - `best` and `curr` are inferred from `eligible` which is `ModelState[]`, so they are typed.
   - `best.latencyWindow.reduce((a, b) => a + b, 0)` - `a` and `b` are inferred as `number` from the array type and initial value.
   - `eligible.reduce((sum, m) => ...)` - `sum` inferred as number from initial value `0`, `m` inferred from array.
   - `st.latencyWindow.reduce((a, b) => a + b, 0)` - inferred as number.
   - `Array.from(this.models.values()).map((st) => ...)` - `st` is inferred.
   - `for (const state of this.models.values())` - `state` is inferred.
   - `probes.push(this.probeModel(state));` - `state` is inferred.
   - `setInterval(() => this.runHealthProbes(), 30_000)` - fine.
   - `EventEmitter` import - fine.
   - `NodeJS.Timeout` - this is a global type reference. In some strict setups this might be an issue if `@types/node` isn't installed, but assuming it is, it's fine. However, `NodeJS.Timeout` is a type from Node.js namespace. If not imported or declared, it could be implicit any if types are missing, but usually it's available. I'll note it as a potential implicit any if `@types/node` is missing, but the user likely has it. Actually, looking carefully, there might be no implicit any issues.

5. missing null/undefined guards:
   - `addModel`: `const state = this.models.get(config.id)!;` uses non-null assertion instead of guard.
   - `selectModel`: `if (st.disabledUntil && st.disabledUntil > now)` - `disabledUntil` is `number | null`, so `&&` handles null fine (null is falsy). But wait, `0` is also falsy. If `disabledUntil` is `0`, it would be treated as disabled. But `Date.now()` is never 0 in practice, so this is technically a logic issue but not a type-safety missing guard per se. However, the pattern `st.disabledUntil && st.disabledUntil > now` is actually safe for null/undefined because null coerces to false. But the type is `number | null`, so this is fine.
   - `selectModel`: `if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent)` - `maxConcurrent` is `number | undefined`. `undefined && ...` is false, so safe. But if `maxConcurrent` is 0, it would be falsy and not trigger. That's a logic bug but not a missing null guard type issue.
   - `recordLatency`: `const state = this.models.get(modelId); if (!state) return;` - good guard.
   - `recordError`: same, good guard.
   - `runHealthProbes`: `if (state.disabledUntil && state.disabledUntil <= now)` - same as above, null safe.

6. unsafe JSON.parse - none visible.

7. untyped catch - none visible (no try/catch blocks shown).

Wait, I need to look at the truncated part? The user says `/* …truncated… */` at the end. I should only audit what's shown.

Let me re-examine for non-null assertions:
- `const state = this.models.get(config.id)!;` in `addModel` - definite non-null assertion.

Are there any other issues?
- `this.healthProbeTimer = setInterval(() => this.runHealthProbes(), 30_000);` - `setInterval` returns `NodeJS.Timeout` in Node.js types, but if this code runs in a browser environment (though it says Node), it would be `number`. The type annotation is `NodeJS.Timeout | null`. This is fine for Node.

- `ModelLoadBalancer.instance` is `private static instance: ModelLoadBalancer | null = null;` - fine.

- `selected = eligible[this.roundRobinIndex];` - `selected` is `ModelState | null`, `eligible[this.roundRobinIndex]` is `ModelState | undefined` (since array access is not bounds-checked by TS). Wait, `eligible` is `ModelState[]`. Accessing by index gives `ModelState | undefined` in `noUncheckedIndexedAccess` or just `ModelState` otherwise. In standard TS, array index access returns the element type, not including undefined, unless that flag is on. So this might not be flagged as unsafe in standard TS. But `selected` is typed as `ModelState | null`, so assigning `eligible[...]` is fine under normal TS settings. However, if `eligible.length === 0`, the code wouldn't reach there because of the early return. So it's safe.

- `selected = eligible[0]` in weighted fallback - same thing, but `eligible.length > 0` is guaranteed because of early return, so safe.

- `state.disabledUntil` is `number | null`. In `runHealthProbes`: `if (state.disabledUntil && state.disabledUntil <= now)`. If `disabledUntil` is `null`, condition is false. Good.

- `if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent)` - if `maxConcurrent` is undefined, false. Good. If it's 0, false (logic bug but not type safety).

Wait, is there an implicit any in the `EventEmitter` import? No.

What about `NodeJS.Timeout`? If the project doesn't have `@types/node`, this would be `any`. But the file path is `innomcp-node/src/services/modelLoadBalancer.ts`, suggesting a Node project. Still, if we're being strict, relying on global NodeJS namespace without explicit import or reference could be considered a dependency on ambient types. But it's not really an implicit any, it's an explicit type reference.

Let me think about other patterns:
- `Math.random() * totalWeight` - `totalWeight` is number.
- `rand -= m.config.weight ?? 1` - fine.

Actually, I see a potential issue: `this.models.get(config.id)!` is the only explicit non-null assertion.

Are there missing null/undefined guards elsewhere?
In `selectModel`:
```typescript
if (st.disabledUntil && st.disabledUntil > now) return false;
```
This is fine for null. But what about `st.config.maxConcurrent`?
```typescript
if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent) return false;
```
This is also fine for undefined.

Wait, is there an implicit any in the constructor or methods? No, all parameters are typed.

What about the return type of `getStats()`? It returns `ModelStats[]`. The object literal:
```typescript
return {
  id: st.config.id,
  avgLatency: ...,
  errorRate: ...,
  activeRequests: st.activeRequests,
  totalRequests: st.totalRequests,
};
```
This satisfies `ModelStats`. Good.

Is there any unsafe cast? No `as` keyword visible.

Is there untyped catch? No try/catch visible.

Unsafe JSON.parse? None.

So the main issue is the non-null assertion in `addModel`.

Wait, let me look again at `addModel`:
```typescript
if (this.models.has(config.id)) {
  // Update existing configuration without resetting stats
  const state = this.models.get(config.id)!;
  state.config = { ...config };
}
```
Here, `this.models.has(config.id)` checks existence, so `this.models.get(config.id)` is guaranteed to return a value. However, TypeScript doesn't narrow the type of `.get()` based on `.has()` on a Map. So the developer used `!`. The safer fix is to use a variable or type guard:
```typescript
const state = this.models.get(config.id);
if (state) {
  state.config = { ...config };
}
```
But since we're inside `if (this.models.has(config.id))`, we could also just do:
```typescript
const state = this.models.get(config.id);
if (!state) return; // or throw, but since has() just returned true, this is defensive
state.config = { ...config };
```
Or simply:
```typescript
const state = this.models.get(config.id);
if (state) {
  state.config = { ...config };
}
```
Actually, since the outer if already checks `has`, the safest fix without changing logic is:
```typescript
const state = this.models.get(config.id);
if (!state) return; // impossible path
state.config = { ...config };
```
But a cleaner fix is to restructure:
```typescript
const existing = this.models.get(config.id);
if (existing) {
  existing.config = { ...config };
} else {
  // ...
}
```
This removes both the `has()` check and the `!`.

Are there any other issues? Let me check `Array.from(this.models.values())` - fine.

What about `this.healthProbeTimer = setInterval(...)`? `setInterval` in Node returns `NodeJS.Timeout`. In browser returns `number`. The field is typed as `NodeJS.Timeout | null`. If this code is ever bundled for browser, it's wrong, but the module name says `node`. Not a type safety issue per se.

Wait, I should check if there are implicit anys in the `reduce` callbacks. In TypeScript, if you don't provide an initial value to reduce, the first element is used and the accumulator takes the type of the first element. But here all reduces have initial values.

Let me check `eligible.reduce((best, curr) => ...)` - initial value is the first element? No, in the `least-latency` case:
```typescript
selected = eligible.reduce((best, curr) => {
  ...
});
```
Wait! There is no initial value provided to `reduce`! The code is:
```typescript
selected = eligible.reduce((best, curr) => {
  const bestAvg = ...
  const currAvg = ...
  return currAvg < bestAvg ? curr : best;
});
```
This is a huge issue. If `eligible` is empty, it throws at runtime. But `eligible.length === 0` is checked earlier with `if (eligible.length === 0) return null;`, so it's safe at runtime. However, TypeScript's type inference for `.reduce()` without an initial value: the accumulator `best` takes the type of the array element `ModelState`, and `curr` also takes `ModelState`. So no implicit any there. But it's worth noting as a potential unsafe pattern? The user asked for "unsafe casts, non-null assertions, implicit any, missing null/undefined guards, unsafe JSON.parse, untyped catch". A reduce without initial value isn't in that list unless it causes implicit any, which it doesn't here because the array is typed.

But wait, is there an implicit any in the catch block? There are no catch blocks shown.

Let me reconsider the `!` non-null assertion. That's definitely one.

Are there any other `!`? I don't see any.

What about `this.models.get(config.id)!` - that's the only one.

Wait, what about `state.disabledUntil` being `number | null`. In `selectModel`:
```typescript
if (st.disabledUntil && st.disabledUntil > now) return false;
```
This is okay. But in `runHealthProbes`:
```typescript
if (state.disabledUntil && state.disabledUntil <= now) {
```
Also okay.

What about `st.config.maxConcurrent` being `number | undefined`. The check `st.config.maxConcurrent && ...` is okay for undefined but not for 0. However, 0 is a valid number. If `maxConcurrent` is 0, the check treats it as falsy and doesn't disable the model, which is a logic error. The safer fix would be:
```typescript
if (st.config.maxConcurrent !== undefined && st.activeRequests >= st.config.maxConcurrent) return false;
```
Is this a "missing null/undefined guard"? The current code uses a truthiness check which conflates undefined/0/null. It's not exactly missing, but it's an imprecise guard that doesn't distinguish 0 from undefined. The user asked for "missing null/undefined guards". This could be interpreted as places where null/undefined isn't properly guarded. The truthiness check is actually a guard, but it's overly broad. I think it's worth mentioning as a severity low/medium issue because `maxConcurrent: 0` would be silently ignored.

Similarly, `m.config.weight ?? 1` - if weight is 0, it falls back to 1. That's a logic issue but not a type safety issue. The type is `number | undefined`, and `??` handles undefined and null, but also 0. If 0 is a valid weight (meaning take this model out of rotation or give it zero weight), then `??` is wrong and should be `=== undefined ? 1 : m.config.weight`. But again, this is more logic than type safety. However, the user asked for type-safety audit. Using `??` when the type is `number | undefined` is technically type-safe, but might be semantically incorrect if 0 is valid. I'll focus on the strict type safety issues.

Let me look for `any` again. Is `EventEmitter` imported from 'events' typed? Yes, in Node.

What about `NodeJS.Timeout`? If `@types/node` is not installed or if `tsconfig` doesn't include node types, this would be an implicit any reference? No, it would be a compile error "Cannot find name 'NodeJS'", not an implicit any. Unless `skipLibCheck` and missing types cause it to be any? No.

Actually, I should check if there are implicit any parameters in callbacks where TypeScript can't infer types. Let's look at `setInterval(() => this.runHealthProbes(), 30_000)`. The callback has no parameters, so no issue.

What about `Array.from(this.models.values()).map((st) => ...)` - `st` is inferred.

What about `probes.push(this.probeModel(state));` - `probeModel` is not shown in the code (truncated), so I can't audit it.

So the table should contain:
1. The non-null assertion in `addModel`.
2. Possibly the truthiness check on `maxConcurrent` in `selectModel` as an imprecise null/undefined guard (or missing explicit undefined check).
3. Possibly the truthiness check on `disabledUntil`? No, that's fine because null is the only falsy value expected (0 would mean epoch time, which is in the past, so it would effectively be enabled, which is fine).

Wait, is there an issue with `this.models.get(config.id)!` being the only explicit `!`? Yes.

Let me also check if `state.config = { ...config };` in `addModel` preserves the existing state properly. `config` has optional properties. Spreading `config` might overwrite `weight` and `tags` with undefined if not provided in the update, while the initial state sets defaults. But that's logic, not type safety.

Actually, looking at `addModel` again:
```typescript
if (this.models.has(config.id)) {
  const state = this.models.get(config.id)!;
  state.config = { ...config };
}
```
If the update `config` doesn't include `weight` or `tags`, they become undefined in the new config object, but the type `ModelConfig` allows undefined for those. So type-safe. But the state initially had defaults. Again, logic issue.

Let me reconsider the `eligible.reduce((best, curr) => ...)` without initial value. While not an implicit any, it could be considered an unsafe pattern because if the guard `eligible.length === 0` is ever removed or bypassed, it crashes. But the user specifically asked for certain patterns. I'll stick to the requested list.

Wait, I see `this.models.get(config.id)!` - non-null assertion.

Are there any other `!`? Let me scan the code visually again.
- `state.config = { ...config };` - no
- `this.models.delete(id);` - no
- `st.disabledUntil && st.disabledUntil > now` - no
- `st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent` - no
- `this.roundRobinIndex = (this.roundRobinIndex + 1) % eligible.length;` - no
- `state.disabledUntil = Date.now() + 60_000;` - no

Only one `!`.

What about implicit any from `EventEmitter`? No.

What about `import { EventEmitter } from 'events';` - in Node ESM, this might need to be `import { EventEmitter } from 'node:events';` but that's not type safety.

Let me think about `NodeJS.Timeout`. In some TypeScript configurations without Node types, this is not available. But the file is clearly Node-specific. I'll skip it unless there's a strong reason.

Actually, there is one more thing: `setInterval` returns `NodeJS.Timeout` in Node.js, but if you use `window.setInterval` in a browser, it returns `number`. The code assigns it to `NodeJS.Timeout | null`. This is fine in Node.

What about `Promise.allSettled(probes)`? `probes` is `Promise<void>[]`. `allSettled` is fine.

I think the main entry is the non-null assertion. But to be thorough, I should mention the `maxConcurrent` truthiness check as a missing explicit null/undefined guard because it conflates `undefined` with `0`. The user asked for "missing null/undefined guards". A truthiness check is a guard, but it's imprecise. However, in TypeScript strict mode, optional chaining or explicit checks are preferred. I'll include it as low severity.

Also, in `selectModel`, `eligible` is derived from `this.models.values()`. The filter callback:
```typescript
const eligible = Array.from(this.models.values()).filter((st) => {
  if (st.disabledUntil && st.disabledUntil > now) return false;
  if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent) return false;
  return true;
});
```
`st` is typed as `ModelState`. Good.

Let me check if there are any implicit any variables. No.

What about the `default` case in switch: `throw new Error(`Unknown strategy: ${strat}`);` - `strat` is typed as `Strategy`, but after the switch, TypeScript knows it's never if all cases are covered. However, if a new strategy is added to the union but not to the switch, this is a useful exhaustiveness check. The type of `strat` in the default case would be `never` if all cases are handled. Actually, is it? The switch covers all four cases. So `strat` in default would be `never`. The code throws, which is fine.

Wait, I should check if `selected` is properly narrowed. Before the switch, `selected: ModelState | null = null;`. Inside cases, it's assigned. After the switch:
```typescript
if (selected) {
  selected.activeRequests++;
}
return selected ? { ...selected.config } : null;
```
This is fine.

One more thing: `this.healthProbeTimer = setInterval(() => this.runHealthProbes(), 30_000);`
If `this.runHealthProbes` returns `Promise<void>`, passing it directly to `setInterval` is fine because the callback returns void (the promise is ignored). No type error.

I think I have enough for the table. The user wants no filler. So just the table.

Let me formulate the rows:

1. Non-null assertion:
   - severity: medium
   - location: `addModel` method, line `const state = this.models.get(config.id)!;`
   - unsafe pattern: non-null assertion (`!`) after `Map.has()` check
   - safer fix: `const state = this.models.get(config.id); if (!state) return; state.config = { ...config };` or combine has/get into a single get with null check.

2. Missing explicit undefined guard for maxConcurrent:
   - severity: low
   - location: `selectModel` method, filter callback `if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent)`
   - unsafe pattern: truthiness check conflates `undefined` with valid value `0`
   - safer fix: `if (st.config.maxConcurrent !== undefined && st.activeRequests >= st.config.maxConcurrent)`

3. Missing explicit undefined/null guard for disabledUntil? Actually `disabledUntil` is `number | null`. The check `st.disabledUntil && st.disabledUntil > now` is actually fine because `null` is falsy and `0` (epoch) is also falsy but would be less than `now` so it would return true (not disabled), which is correct because epoch is in the past. So no issue there.

4. Weighted fallback comment says "should never happen" but uses `eligible[0]` without non-null assertion? Actually `selected` is `ModelState | null`, and `eligible[0]` is `ModelState` (in standard TS). But if `eligible` is empty, it would be undefined. However, `eligible.length === 0` is checked earlier. So no issue.

5. Is there an implicit any in the `reduce` for least-latency? No, because the array is typed.

Wait, I should check if `config.weight` and `config.tags` in `addModel` have defaults:
```typescript
config: { ...config, weight: config.weight ?? 1, tags: config.tags ?? [] },
```
This is fine.

Let me reconsider if there are any untyped catches. The code is truncated, but in the visible portion, no try/catch.

Unsafe JSON.parse? None.

Unsafe casts? None.

Implicit any? None.

So I'll provide the table with the non-null assertion and the imprecise maxConcurrent guard. Are there any others?

What about `this.models.get(config.id)!` - could also be considered an unsafe cast (from `ModelState | undefined` to `ModelState`). The user asked for unsafe casts too. The `!` operator is essentially a cast. I'll label it as non-null assertion.

Actually, looking at the code again, is there a missing null guard in `getStats`? No.

What about `state.latencyWindow.push(latencyMs);` - `latencyMs` is `number`. Fine.

I think two rows are sufficient. But let me see if I can find anything else.

In `selectModel`, `case 'weighted'`:
```typescript
let rand = Math.random() * totalWeight;
for (const m of eligible) {
  rand -= m.config.weight ?? 1;
  if (rand <= 0) {
    selected = m;
    break;
  }
}
// Fallback (should never happen)
if (!selected) selected = eligible[0];
```
If `eligible` is not empty, `eligible[0]` is safe. But TypeScript with

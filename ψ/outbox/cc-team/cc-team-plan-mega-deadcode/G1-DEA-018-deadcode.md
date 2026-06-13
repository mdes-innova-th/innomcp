<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-018 role=deadcode model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2045,"completion_tokens":5000,"total_tokens":7045,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T12:02:47.187Z -->
The user wants a dead/unused code audit for the provided TypeScript module `leaderboardMetrics.ts`. They want a list with columns: location | what | why-safe-to-remove. They want conservative, high-confidence flags only.

Let me analyze the code carefully.

1. **Unused exports**: Check exported functions/interfaces.
   - `ProviderStats` interface is exported. Is it used elsewhere? The module exports it, but we can't see other modules. However, the prompt asks to audit *this* module. Usually, exported items are meant for external use. But if we're strictly auditing this file for dead code, exported items are by definition reachable from outside. However, sometimes exports are unused by consumers. But we don't have the full codebase. The prompt says "Module: innomcp-node/src/services/leaderboardMetrics.ts". So I should focus on internal dead code, but also flag exports that might be unused if they are not referenced internally. Actually, the standard interpretation is: flag things that are dead *within* the module or clearly redundant. But "unused exports" specifically means exported but never imported. Since I only have this one file, I can't know for sure if `ProviderStats` is imported elsewhere. However, I can flag things that are exported but never used *within* the module, and suggest they might be unused exports if the codebase doesn't reference them. But the user wants conservative high-confidence. So I should be careful.

Wait, looking at the code, there are several exported functions: `recordProviderCall`, `getProviderStats`, `getSparklineData`, `getIntentWinsSnapshot`, `recordProviderWin`. The code is truncated at the end (`[pr`), but we can infer the rest.

Let me look for internal unused items:
- `computeStdDev` is defined but only used in `getProviderStats` inside an IIFE for `consistencyScore`. So it is used.
- `computeP95` is used in `getProviderStats`. So used.
- `persistLeaderboardStats` is used in `recordProviderCall` and likely `recordProviderWin` (though truncated, the comment says same pattern). So used.

Now look for redundant conditions or unreachable branches:
- In `recordProviderCall`, `responseChars` parameter is optional. The condition `if (responseChars != null)` is fine.
- In `getProviderStats`, `winRate` calculation: `raw.requests > 0 ? Math.round((raw.wins / raw.requests) * 100) : 0`. But `efficiencyScore` is `raw.requests > 0 ? Math.min(100, Math.round((raw.wins / raw.requests) * 100)) : 0`. These are very similar but not identical. `winRate` is not capped at 100, while `efficiencyScore` is. But wait, `winRate` is wins/requests * 100. Since wins <= requests, this is naturally <= 100. So `Math.min(100, ...)` in `efficiencyScore` is redundant because `(raw.wins / raw.requests) * 100` can never exceed 100. However, is it possible for wins > requests? In the data model, wins are incremented separately from requests. A provider could theoretically have more wins than requests if `recordProviderWin` is called without `recordProviderCall`? Looking at `recordProviderWin`, if no existing entry, it creates one with `requests: 0, wins: 1`. So yes, wins can exceed requests. Therefore `Math.min(100, ...)` is not redundant. Wait, but `winRate` uses the same formula without cap. If wins > requests, winRate could exceed 100. Is that intended? Maybe. But the efficiencyScore is capped. So not redundant.

- In `getProviderStats`, `healthScore`: `raw.requests > 0 ? Math.round(Math.round((raw.successes / raw.requests) * 100) * 0.7 + (raw.wins > 0 ? 30 : 0)) : 0`. The inner `Math.round` on the success rate seems redundant because it's then multiplied by 0.7 and rounded again. But it's not dead code, just slightly odd.

- In `getProviderStats`, `currentStreak: raw.currentStreak ?? 0`. Since `currentStreak` is always initialized to a number in both `store.set` branches (0), the `?? 0` is redundant but safe. However, is it high-confidence dead? It's a redundant fallback. The user asked for "redundant conditions". This qualifies. But is it "dead/unused"? It's a no-op. I can flag it.

- In `getProviderStats`, `bestStreak: raw.bestStreak ?? 0`. Same as above.

- In `recordProviderCall`, the `else` branch creates a new `RawStats` object. It sets `avgQuality: 0, qualitySamples: 0`. But these fields are never updated by `recordProviderCall` or `recordProviderWin`. They are dead fields? Not necessarily dead code, just unused features. But the properties themselves are part of the interface. The interface `RawStats` includes them. Are they ever modified? Looking through the code, `avgQuality` and `qualitySamples` are never updated after initialization. They are read in `getProviderStats` (`avgQuality: Math.round(raw.avgQuality)`). But since they are always 0 (unless some other function not shown updates them), this is potentially dead code. However, we don't see the full file (it's truncated). Maybe there is a `recordProviderQuality` function later. Since the file is truncated, I cannot be high-confidence that these fields are never updated. So I should not flag them as dead.

- In `recordProviderWin`, the `else` branch sets `requests: 0, totalLatency: 0, successes: 0, latencySamples: []`. This is fine.

- In `getProviderStats`, `consistencyScore` uses an IIFE `(() => { ... })()`. This is not dead, just a style choice.

- Look at the truncated end: `recordProviderWin` has a DB persist block that is cut off. The comment says "Persist win to DB async (fire-and-forget — same pattern as recordProviderCall)". The code shows `persistLeaderboardStats(() => { withDbConnection(async (conn) => { await conn.query( ... [pr`. It seems truncated. But that's just the file display.

- Is `withDbConnection` imported but maybe not used? It is used in `persistLeaderboardStats` callbacks. So used.

- Are there any commented-out blocks? I don't see any in the provided code.

- Duplicate logic: `recordProviderCall` and `recordProviderWin` both have very similar `store.set` logic for creating a new entry. This is duplicate logic. But is it safe to remove? Not without refactoring into a helper. The user wants "duplicate logic". I can flag it as a candidate for deduplication, but the question is "why-safe-to-remove". If I extract a helper, the duplicate block can be removed. But that's more of a refactor. The prompt asks for "dead/unused code audit: unused exports, unreachable branches, redundant conditions, commented-out blocks, duplicate logic." So I can flag duplicate logic and suggest merging.

- Look at `getProviderStats`: `avgQuality: Math.round(raw.avgQuality)`. Since `raw.avgQuality` is always 0 (unless updated elsewhere), and `qualitySamples` is unused, this might be dead. But again, truncated file, so low confidence.

- Look at `ProviderStats` interface: `topIntent?: string`. It is computed. Used.

- Look at `RawStats` interface: `avgQuality`, `qualitySamples`. Are they used? They are initialized and read. But never updated in the visible code. However, since the file is truncated, I cannot be sure.

- Look at `recordProviderCall`: `responseChars` parameter. It is used.

- Look at `persistLeaderboardStats`: It checks `process.env.NODE_ENV === "test"`. This is a condition. Not redundant.

- Look at `computeP95`: `const idx = Math.ceil(samples.length * 0.95) - 1; return sorted[Math.max(0, idx)];`. If `samples.length` is 1, `idx = Math.ceil(0.95) - 1 = 1 - 1 = 0`. `Math.max(0, 0) = 0`. `sorted[0]`. Fine. If `samples.length` is 0, returns 0 early.

- Look at `getSparklineData`: `if (!raw || raw.latencySamples.length === 0) return [];`. The `!raw` check handles undefined. `raw.latencySamples.length === 0` handles empty. Fine.

- Look at `getIntentWinsSnapshot`: It builds a map. Fine.

- Look at `recordProviderWin`: `if (existing) { existing.wins += 1; if (intent) { ... } } else { store.set(...) }`. Fine.

- Is there any unreachable branch? In `recordProviderCall`, the `if (existing)` branch handles updates. The `else` creates new. Both reachable.

- In `getProviderStats`, `topIntent` computation: `Object.keys(raw.intentWins).length > 0 ? ... : undefined`. This is safe.

- Redundant condition: `raw.currentStreak ?? 0` and `raw.bestStreak ?? 0`. Since `RawStats` always initializes these to numbers (0), the nullish coalescing is redundant. High confidence because both constructors (in `recordProviderCall` else and `recordProviderWin` else) set them to 0. There is no other path where they could be undefined. The interface says `number`, not `number | undefined`. So `?? 0` is redundant. I can flag that.

- Duplicate logic: The `store.set` in `recordProviderCall` else and `recordProviderWin` else are very similar. They both create a `RawStats` object with many defaults. This is duplicate logic. Safe to remove by extracting a `createDefaultStats` helper. But is it "safe to remove"? If I replace both with a helper, the duplicate blocks are removed. I'll flag it as duplicate initialization logic.

- Unused exports: Since I cannot see the whole codebase, I should be careful. However, if an export is not referenced *within* the module, it could be unused. But that's normal for a service module. The user might want me to flag exports that are likely unused. But I don't have enough info. I'll skip unused exports unless there's an export that is clearly internal. Wait, `RawStats` is not exported. `ProviderStats` is exported. `recordProviderCall`, `getProviderStats`, `getSparklineData`, `getIntentWinsSnapshot`, `recordProviderWin` are exported. Without seeing imports, I can't confirm they are unused. So I won't flag unused exports.

- Is there any commented-out block? No.

- Is there unreachable code? The file is truncated at the end. The last line is `[pr`. This is likely just a copy-paste truncation, not actual code. I shouldn't flag that.

- Wait, look at `recordProviderCall`: `existing.totalLatency += latencyMs;` but `avgLatency` is computed as `Math.round(raw.totalLatency / raw.requests)`. This is a simple moving average? Actually, the comment says "update rolling avgLatency (simple moving average)", but the code just sums total latency and divides by total requests. That's an overall average, not a rolling one. But the latencySamples array is used for p95. The comment is slightly misleading but not dead code.

- Look at `healthScore`: `Math.round(Math.round((raw.successes / raw.requests) * 100) * 0.7 + (raw.wins > 0 ? 30 : 0))`. The inner `Math.round` returns an integer 0-100. Multiplying by 0.7 gives a float. Then adding 30 or 0. Then outer `Math.round`. The inner `Math.round` is not redundant because it truncates the successRate before weighting. But it's a bit odd. Not dead.

- Look at `efficiencyScore`: `Math.min(100, Math.round((raw.wins / raw.requests) * 100))`. As noted, wins can exceed requests (e.g., win without call), so cap is needed. But if requests=0, returns 0. If requests>0 and wins>requests, the inner value >100, so min is needed. Not redundant.

- Look at `consistencyScore` IIFE: It computes `lengthStdDev`. If `raw.responseSamples.length < 2`, returns 0. Else computes. Fine.

- Is `computeStdDev` used anywhere else? Only in the IIFE. So it's used.

- Is `persistLeaderboardStats` used in `recordProviderWin`? The code is truncated, but the comment says it is. The visible part shows the start of it. So likely used.

- What about `responseSamples` in `recordProviderCall` else: `responseSamples: responseChars != null ? [responseChars] : []`. In the `if (existing)` branch, it checks `if (responseChars != null)` before pushing. So if `responseChars` is undefined/null, it doesn't push. In the else branch, if `responseChars` is null/undefined, it sets an empty array. That's consistent.

- Wait, in `recordProviderCall` else, `totalResponseChars: responseChars ?? 0`. If responseChars is undefined, sets 0. In the if branch, it only adds if `responseChars != null`. So totalResponseChars only accumulates when responseChars is provided. That's fine.

- Is there any variable that is declared but not used? No.

- Are there any imports that are unused? `withDbConnection` is used.

- Is `Promise.resolve(operation()).catch(...)` in `persistLeaderboardStats` safe? Yes.

- Let's reconsider the `?? 0` on streaks. In `getProviderStats`:
  `currentStreak: raw.currentStreak ?? 0,`
  `bestStreak: raw.bestStreak ?? 0,`
  The `RawStats` interface defines them as `number`. The initial values are always `0`. There is no assignment that could make them `null` or `undefined`. Therefore the `?? 0` is a redundant expression. It will always evaluate to `raw.currentStreak`. This is high-confidence.

- Is there a similar redundant condition? In `recordProviderWin`, `if (intent) { existing.intentWins[intent] = ... }`. `intent` is optional. Fine.

- In `getProviderStats`, `avgQuality: Math.round(raw.avgQuality)`. `raw.avgQuality` is always a number. Fine.

- In `recordProviderCall`, `if (existing)` else. Both reachable.

- In `getProviderStats`, `raw.responseSamples.length > 0 ? ... : 0` for `avgResponseLength`. Since `totalResponseChars` is only incremented when `responseChars != null`, and `responseSamples` is similarly managed, if `responseSamples` is empty, `totalResponseChars` is 0. But the check is safe.

- Wait, `avgResponseLength` uses `raw.totalResponseChars / raw.responseSamples.length`. This is correct.

- Is there duplicate logic between `recordProviderCall` and `recordProviderWin` for the `store.set` default object? Let's compare:

`recordProviderCall` else:
```typescript
store.set(providerId, {
  requests: 1,
  totalLatency: latencyMs,
  successes: success ? 1 : 0,
  latencySamples: [latencyMs],
  wins: 0,
  totalResponseChars: responseChars ?? 0,
  responseSamples: responseChars != null ? [responseChars] : [],
  avgQuality: 0,
  qualitySamples: 0,
  intentWins: {},
  currentStreak: 0,
  bestStreak: 0,
});
```

`recordProviderWin` else:
```typescript
store.set(providerId, {
  requests: 0,
  totalLatency: 0,
  successes: 0,
  latencySamples: [],
  wins: 1,
  totalResponseChars: 0,
  responseSamples: [],
  avgQuality: 0,
  qualitySamples: 0,
  intentWins: intent ? { [intent]: 1 } : {},
  currentStreak: 0,
  bestStreak: 0,
});
```

There is significant overlap. This is duplicate logic. It could be extracted to a helper like `createRawStats(partial: Partial<RawStats>): RawStats` with defaults. However, is it "safe to remove"? The duplicate code itself is not dead; it's executed. But the prompt includes "duplicate logic" as a category to audit. So I should flag it. The "why-safe-to-remove" would be because a shared factory function can replace both blocks without changing behavior.

- Are there any other duplicates? The DB persist pattern is duplicated between `recordProviderCall` and `recordProviderWin`. But again, it's a pattern.

- Is there an unreachable branch in `computeP95`? `if (samples.length === 0) return 0;` then proceeds. The `Math.max(0, idx)` handles the case where idx might be negative? Let's see: if length=1, idx=0. If length=2, idx=Math.ceil(1.9)-1=2-1=1. If length=0, early return. So idx is always >=0. `Math.max(0, idx)` is redundant. Wait: `Math.ceil(samples.length * 0.95) - 1`. For length=1: 0.95 -> ceil=1 -> 0. For length=2: 1.9 -> ceil=2 -> 1. For length=20: 19 -> ceil=19 -> 18. All >=0. So `Math.max(0, idx)` is redundant because `idx` will never be negative when `samples.length >= 1`. But is it high-confidence? Yes, because `samples.length * 0.95` is at least 0.95 when length>=1, ceil is at least 1, minus 1 is at least 0. So `Math.max(0, idx)` is a no-op. This is a redundant expression, not an unreachable branch. But the prompt groups "redundant conditions" and "unreachable branches". This is a redundant guard.

- Actually, wait: if `samples.length` is 0, we already returned. So yes, `Math.max(0, idx)` is redundant. I'll flag it.

- In `computeStdDev`, `if (samples.length < 2) return 0;`. Then it calculates mean and variance. It divides by `samples.length` (population std dev). Fine.

- In `getProviderStats`, `consistencyScore` IIFE: `raw.responseSamples.length < 2 ? 0 : ...`. This is fine.

- Is there any commented-out block? No.

- Is `getIntentWinsSnapshot` used internally? No, but it's exported.

- Is `getSparklineData` used internally? No, but exported.

- Is `ProviderStats` used internally? Yes, as return type for `getProviderStats`.

- Is `RawStats` exported? No. It's used internally.

- Let's think about `recordProviderWin`: it increments `wins`, but does it update `currentStreak` or `bestStreak`? The code shows `currentStreak` and `bestStreak` are in the object, but `recordProviderWin` does not update them. They remain 0 forever (in the visible code). This means `currentStreak` and `bestStreak` fields are dead/unused in the visible code. However, the file is truncated. Maybe there is more code after the truncation that updates them. The truncation happens in the middle of `recordProviderWin`'s DB persist block. It's possible the function continues after that. But since the file is truncated, I cannot be high-confidence that there is no other function. However, looking at the structure, `recordProviderWin` is the last exported function shown. The truncation is at the end of the file? The comment says `/* …truncated… */`. So there might be more code below. Therefore, flagging `currentStreak`/`bestStreak` as dead is low confidence because the rest of the file is missing. I should avoid flagging them.

- But the `?? 0` on streaks in `getProviderStats` is safe to flag because even if there were code updating them, they are typed as `number` and initialized as `number`, so `?? 0` is redundant regardless of what happens later.

- What about `avgQuality` and `qualitySamples`? They are initialized to 0, never updated in visible code, and read in `getProviderStats`. If the rest of the file doesn't update them, they are dead fields. But again, truncated file. I will skip.

- Let's look at `recordProviderCall` else branch: `responseSamples: responseChars != null ? [responseChars] : []`. And in the if branch: `if (responseChars != null) { existing.totalResponseChars += responseChars; existing.responseSamples.push(responseChars); ... }`. This is consistent.

- Is there any unreachable code due to early return? In `persistLeaderboardStats`, `if (process.env.NODE_ENV === "test") return;`. Then `setImmediate(...)`. Fine.

- Is `process.env.NODE_ENV` check safe? Yes.

- Let's reconsider the `Math.max(0, idx)` in `computeP95`. Is it truly redundant? Yes. `Math.ceil(0.95) - 1 = 0`. For any positive integer n, `Math.ceil(n * 0.95) >= 1` because `n*0.95 > 0`. Actually, if n=1, 0.95 -> ceil=1 -> 0. If n=0, handled earlier. So idx >= 0 always. `Math.max(0, idx)` is redundant.

- Are there any other redundant conditions? In `getProviderStats`, `winRate: raw.requests > 0 ? ... : 0`. Since `raw.requests` is at least 1 in any entry that exists in the map? Not necessarily: `recordProviderWin` can create an entry with `requests: 0`. So `raw.requests` can be 0. The check is needed.

- In `getProviderStats`, `healthScore: raw.requests > 0 ? ... : 0`. Same, needed.

- In `getProviderStats`, `efficiencyScore: raw.requests > 0 ? ... : 0`. Same.

- In `getProviderStats`, `avgLatency: Math.round(raw.totalLatency / raw.requests)`. If `raw.requests` is 0, this would be NaN. But can `raw.requests` be 0? Yes, if entry created by `recordProviderWin` without any calls. However, `getProviderStats` iterates over all entries. If an entry has `requests: 0`, `avgLatency` would be `Math.round(0/0)` = NaN. Is this a bug? Maybe, but not dead code.

- Wait, `recordProviderWin` else sets `requests
